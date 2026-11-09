import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { servicesPlugin, UIRouter } from '@uirouter/core';

import { createServerRouter, mergeSearch, routeTrie } from '../src/index.ts';
import type { MountConfig, RouteDeclaration } from '../src/index.ts';
import { registeredDelegates } from '../src/delegate-registry.ts';
import { installServerLocation } from '../src/location.ts';
import { compileRedirects } from '../src/redirects.ts';
import { onceSettled } from '../src/simulate.ts';
import { respell } from '../src/trailing-slash.ts';
import { applyUrlConfig } from '../src/url-config.ts';
import type { RouterUrlConfig } from '../src/url-config.ts';

const TIERS = ['matcher', 'trie', 'simulate'] as const;

type Tier = (typeof TIERS)[number];

const routes = [
  { name: 'home', url: '' },
  { name: 'pkg', url: '/{pkg}' },
  { name: 'pkg.index', url: '/index.json', response: true },
  { name: 'pkg.old', url: '/old', redirectTo: 'pkg' },
  { name: 'pkg.compare', url: '/diff/{from}...{to}' },
  { name: 'pkg.compare.patch', url: '/patch', response: true },
  { name: 'pkg.claims', url: '/claims', delegate: 'ledger' },
  { name: 'pkg.tab', params: { tab: 'notes' } },
  { name: 'notFound' },
] as const satisfies readonly RouteDeclaration[];

const pagesSlashed = {
  strict: false,
  trailingSlash: { pages: 'always' },
} as const satisfies RouterUrlConfig;

const mountOf = (tier: Tier, config: RouterUrlConfig): MountConfig => ({
  routes,
  config,
  otherwise: { state: 'notFound' },
  ...(tier === 'trie'
    ? { strategy: 'matcher', routeIndex: routeTrie }
    : { strategy: tier }),
});

const redirect = (location: string, status = 308) => ({
  kind: 'redirect',
  mount: '/app',
  location,
  status,
});

const shell = { kind: 'shell', mount: '/app' };

describe('respell', () => {
  it('moves the path slash and keeps the query and fragment', () => {
    assert.equal(respell('/a', 'always'), '/a/');
    assert.equal(respell('/a/', 'always'), '/a/');
    assert.equal(respell('', 'always'), '/');
    assert.equal(respell('/a?x=1#f', 'always'), '/a/?x=1#f');
    assert.equal(respell('/a/?x=1', 'never'), '/a?x=1');
    assert.equal(respell('/a', 'never'), '/a');
    assert.equal(respell('/a/', 'as-requested'), '/a/');
  });
});

for (const tier of TIERS) {
  describe(`trailingSlash verdicts (${tier} tier)`, () => {
    const router = createServerRouter({
      mounts: {
        '/app': mountOf(tier, pagesSlashed),
        '/drop': {
          ...mountOf(tier, {
            strict: false,
            trailingSlash: { pages: 'never', responses: 'never' },
          }),
        },
        '/': {
          ...mountOf(tier, {
            strict: false,
            trailingSlash: { pages: 'never' },
          }),
        },
      },
    });

    it('redirects a page to its slashed spelling with a 308', async () => {
      assert.deepEqual(await router.resolve('/app/lit'), redirect('/app/lit/'));
      assert.deepEqual(await router.resolve('/app'), redirect('/app/'));
      assert.deepEqual(
        await router.resolve('/app/lit/diff/1.0.0...2.0.0'),
        redirect('/app/lit/diff/1.0.0...2.0.0/'),
      );
    });

    it('serves a page at its slashed spelling', async () => {
      assert.deepEqual(await router.resolve('/app/lit/'), shell);
      assert.deepEqual(await router.resolve('/app/'), shell);
    });

    it('keeps a response state and a delegate at the spelling requested', async () => {
      for (const subpath of ['/lit/index.json', '/lit/index.json/']) {
        const verdict = await router.resolve(`/app${subpath}`);

        assert.equal(verdict.kind, 'response', subpath);
      }

      for (const subpath of ['/lit/claims', '/lit/claims/']) {
        const verdict = await router.resolve(`/app${subpath}`);

        assert.equal(verdict.kind, 'delegate', subpath);
      }
    });

    it('formats a redirectTo target in its canonical spelling, in one hop', async () => {
      assert.deepEqual(
        await router.resolve('/app/lit/old'),
        redirect('/app/lit/', 302),
      );
    });

    it('leaves the otherwise projection alone', async () => {
      assert.deepEqual(await router.resolve('/app/lit/a/b/c'), {
        ...shell,
        status: 404,
      });
    });

    it("drops the slash under 'never', but never the root's", async () => {
      assert.deepEqual(await router.resolve('/drop/lit/'), {
        ...redirect('/drop/lit'),
        mount: '/drop',
      });
      assert.deepEqual(await router.resolve('/drop/lit/index.json/'), {
        ...redirect('/drop/lit/index.json'),
        mount: '/drop',
      });
      assert.deepEqual(await router.resolve('/drop/'), {
        ...redirect('/drop'),
        mount: '/drop',
      });
      assert.deepEqual(await router.resolve('/'), {
        kind: 'shell',
        mount: '/',
      });
    });

    it('marks a non-navigation request at either spelling', async () => {
      const registration = registeredDelegates(router);
      assert.ok(registration);

      for (const path of ['/drop/lit/index.json', '/drop/lit/index.json/'])
        assert.equal((await registration.markedFor(path))?.kind, 'response');
    });
  });
}

describe('trailingSlash configuration', () => {
  it('needs strict: false on a mount, a redirect table and a client router', () => {
    for (const config of [
      { trailingSlash: { pages: 'always' } },
      { strict: true, trailingSlash: { responses: 'never' } },
    ] as const) {
      assert.throws(
        () => createServerRouter({ mounts: { '/': { routes, config } } }),
        /trailingSlash needs strict: false/,
      );
      assert.throws(
        () => compileRedirects({ routes, config }),
        /trailingSlash needs strict: false/,
      );
      assert.throws(
        () => applyUrlConfig(new UIRouter(), config),
        /trailingSlash needs strict: false/,
      );
    }
  });

  it("accepts a strict mount whose policy is all 'as-requested'", () => {
    assert.doesNotThrow(() =>
      createServerRouter({
        mounts: {
          '/': {
            routes,
            config: { trailingSlash: { pages: 'as-requested' } },
          },
        },
      }),
    );
  });
});

const clientRouter = (config: RouterUrlConfig, url?: string): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  installServerLocation(router, { url, baseHref: '/app/', urlConfig: config });
  router.stateService.defaultErrorHandler(() => {});

  for (const state of routes) router.stateRegistry.register({ ...state });

  return router;
};

describe('differential: core href under the policy vs server verdicts', () => {
  const server = createServerRouter({
    mounts: { '/app': mountOf('matcher', pagesSlashed) },
  });

  const client = clientRouter(pagesSlashed);

  const hrefs: [state: string, params: object, href: string][] = [
    ['home', {}, '/app/'],
    ['pkg', { pkg: 'lit' }, '/app/lit/'],
    ['pkg.index', { pkg: 'lit' }, '/app/lit/index.json'],
    [
      'pkg.compare',
      { pkg: 'lit', from: '1.0.0', to: '2.0.0' },
      '/app/lit/diff/1.0.0...2.0.0/',
    ],
    [
      'pkg.compare.patch',
      { pkg: 'lit', from: '1.0.0', to: '2.0.0' },
      '/app/lit/diff/1.0.0...2.0.0/patch',
    ],
    ['pkg.claims', { pkg: 'lit' }, '/app/lit/claims'],
    // A url-less state links to its navigable ancestor's canonical url.
    ['pkg.tab', { pkg: 'lit' }, '/app/lit/'],
  ];

  for (const [state, params, href] of hrefs) {
    it(`${state}: href is canonical, and the server answers it without a redirect`, async () => {
      assert.equal(client.stateService.href(state, params), href);
      assert.notEqual((await server.resolve(href)).kind, 'redirect');
    });
  }

  it('applies only to a router built with the policy', () => {
    const plain = clientRouter({ strict: false });

    assert.equal(plain.stateService.href('pkg', { pkg: 'lit' }), '/app/lit');
  });

  it('pushes the canonical url on a param transition', async () => {
    const router = clientRouter(pagesSlashed, '/lit/');
    const first = onceSettled(router);
    router.urlService.sync();
    assert.equal(await first, true);

    await router.stateService.go('pkg.compare', { from: '1.0.0', to: '2.0.0' });

    assert.equal(router.urlService.url(), '/lit/diff/1.0.0...2.0.0/');
  });

  it('formats a redirectTo landing in the canonical spelling under settle', async () => {
    const router = clientRouter(pagesSlashed, '/lit/old');
    const settled = onceSettled(router);
    router.urlService.sync();
    assert.equal(await settled, true);

    assert.equal(router.urlService.path(), '/lit/');
  });
});

describe('trailingSlash under a search-param ancestor', () => {
  const nested = [
    { name: 'home', url: '' },
    { name: 'list', url: '/list?q' },
    { name: 'list.item', url: '/{id}?sort' },
    { name: 'list.old', url: '/old/{id}', redirectTo: 'list.item' },
  ] as const satisfies readonly RouteDeclaration[];

  for (const strategy of ['matcher', 'simulate'] as const) {
    it(`respells the path before the merged query (${strategy} tier)`, async () => {
      const router = createServerRouter({
        mounts: { '/app': { routes: nested, config: pagesSlashed, strategy } },
      });

      for (const [path, location, status] of [
        ['/app/list/7?q=a&sort=n', '/app/list/7/', 308],
        ['/app/list/old/7?q=a&sort=n', '/app/list/7/', 302],
      ] as const) {
        const verdict = await router.resolve(path);

        assert.deepEqual(verdict, redirect(location, status), path);
        assert.equal(
          mergeSearch(location, path.slice(path.indexOf('?'))),
          '/app/list/7/?q=a&sort=n',
        );
      }

      assert.deepEqual(await router.resolve('/app/list/7/?q=a&sort=n'), shell);
    });
  }

  it('formats the client href with the slash before the query', () => {
    const client = new UIRouter();
    client.plugin(servicesPlugin);
    installServerLocation(client, {
      baseHref: '/app/',
      urlConfig: pagesSlashed,
    });

    for (const state of nested) client.stateRegistry.register({ ...state });

    assert.equal(
      client.stateService.href('list.item', { id: '7', q: 'a', sort: 'n' }),
      '/app/list/7/?q=a&sort=n',
    );
  });
});

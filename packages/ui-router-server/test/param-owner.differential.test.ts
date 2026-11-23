import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';
import type { RawParams, StateRule } from '@uirouter/core';

import { createServerRouter, routeTrie } from '../src/index.ts';
import type { MountConfig } from '../src/index.ts';
import { compileRoutes, matchRoute } from '../src/redirects.ts';
import type { RouteDeclaration, RouteMatch } from '../src/redirects.ts';
import { compileRouteTrie } from '../src/route-trie.ts';
import { format } from '../src/url-matcher.ts';

// The divergence guard for param ownership: a real core router registers the
// same table, and matching, formatting and every strategy's verdict must agree.

interface OwnerCase {
  label: string;
  routes: RouteDeclaration[];
  urls: string[];
  /** A state name, then the param values to format its url with. */
  formats: [state: string, values: RawParams][];
}

const cases: OwnerCase[] = [
  {
    label: "a descendant redeclares an ancestor url param's default",
    routes: [
      { name: 'l', url: '/:lang', params: { lang: 'en' } },
      { name: 'l.docs', url: '/docs', params: { lang: 'fr' } },
    ],
    urls: ['/docs', '/fr/docs', '/en/docs', '/'],
    formats: [
      ['l.docs', {}],
      ['l.docs', { lang: 'de' }],
      ['l', {}],
    ],
  },
  {
    label: 'a parent: link redeclares the default',
    routes: [
      { name: 'l', url: '/:lang', params: { lang: 'en' } },
      { name: 'docs', parent: 'l', url: '/docs', params: { lang: 'fr' } },
    ],
    urls: ['/docs', '/fr/docs'],
    formats: [['docs', {}]],
  },
  {
    label: 'only the descendant declares the ancestor url param',
    routes: [
      { name: 'l', url: '/:lang' },
      { name: 'l.docs', url: '/docs', params: { lang: 'fr' } },
    ],
    urls: ['/docs', '/fr/docs'],
    formats: [
      ['l.docs', {}],
      ['l.docs', { lang: 'de' }],
    ],
  },
  {
    label: 'a descendant redeclares squash under an abstract parent',
    routes: [
      {
        name: 'mission',
        url: '/mission/:id',
        abstract: true,
        params: { id: { value: '1', squash: true } },
      },
      {
        name: 'mission.log',
        url: '/log',
        params: { id: { value: '1', squash: false } },
      },
    ],
    urls: [
      '/mission/log',
      '/mission/1/log',
      '/mission/2/log',
      '/mission',
      '/mission/log/log',
    ],
    formats: [
      ['mission.log', {}],
      ['mission.log', { id: '2' }],
    ],
  },
  {
    label: 'a descendant redeclares the type under an abstract parent',
    routes: [
      {
        name: 'mission',
        url: '/mission/:id',
        abstract: true,
        params: { id: { value: '1', squash: true } },
      },
      { name: 'mission.log', url: '/log', params: { id: { type: 'string' } } },
    ],
    urls: ['/mission/log', '/mission/1/log', '/mission/2/log', '/mission'],
    formats: [
      ['mission.log', {}],
      ['mission.log', { id: '2' }],
    ],
  },
  {
    label: 'a descendant redeclares the type of an inline-typed param',
    routes: [
      {
        name: 'mission',
        url: '/mission/{id:int}',
        abstract: true,
        params: { id: { value: 1, squash: true } },
      },
      { name: 'mission.log', url: '/log', params: { id: { type: 'string' } } },
    ],
    urls: [
      '/mission/log',
      '/mission/1/log',
      '/mission/2/log',
      '/mission/x/log',
    ],
    formats: [
      ['mission.log', {}],
      ['mission.log', { id: 2 }],
    ],
  },
  {
    label: "a descendant url declares an ancestor's non-url param",
    routes: [
      { name: 'a', url: '/a', params: { x: '1' } },
      { name: 'a.b', url: '/b/:x' },
    ],
    urls: ['/a', '/a/b', '/a/b/2'],
    formats: [
      ['a.b', {}],
      ['a.b', { x: '2' }],
      ['a', {}],
    ],
  },
  {
    label:
      'a descendant url declares and configures a param its ancestor also names',
    routes: [
      { name: 'a', url: '/a', params: { x: '1' } },
      {
        name: 'a.b',
        url: '/b/:x',
        params: { x: { value: '9', squash: true } },
      },
    ],
    urls: ['/a/b', '/a/b/2', '/a/b/9'],
    formats: [
      ['a.b', {}],
      ['a.b', { x: '2' }],
    ],
  },
  {
    label: "a descendant redeclares an ancestor's search param",
    routes: [
      { name: 'a', url: '/a?q', params: { q: '1' } },
      { name: 'a.b', url: '/b', params: { q: '2' } },
    ],
    urls: ['/a/b'],
    formats: [
      ['a.b', {}],
      ['a.b', { q: '2' }],
    ],
  },
];

const coreRouter = (routes: RouteDeclaration[]): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);

  for (const route of routes) router.stateRegistry.register({ ...route });

  return router;
};

const coreMatch = (router: UIRouter, path: string): RouteMatch | null => {
  const result = router.urlService.match({ path, search: {}, hash: '' });

  if (!result) return null;
  assert.equal(result.rule.type, 'STATE');

  // SAFETY: a STATE rule is a StateRule, whose match is the params its url matcher extracted.
  return {
    state: (result.rule as StateRule).state.name,
    params: result.match as RawParams,
  };
};

const coreFormat = (
  router: UIRouter,
  state: string,
  values: RawParams,
): string | null => {
  const url = router.stateRegistry.get(state)?.$$state?.().url;
  assert.ok(url, state);

  return url.format(values);
};

const TIERS: [tier: string, config: Partial<MountConfig>][] = [
  ['matcher', { strategy: 'matcher' }],
  ['routeTrie', { strategy: 'matcher', routeIndex: routeTrie }],
  ['simulate', { strategy: 'simulate' }],
];

for (const { label, routes, urls, formats } of cases) {
  describe(`differential: param ownership vs @uirouter/core (${label})`, () => {
    const core = coreRouter(routes);

    it('matches the urls core matches, with the same params', () => {
      const compiled = compileRoutes(routes);
      const trie = compileRouteTrie(compiled);
      assert.deepEqual(trie.inexpressible, []);

      for (const url of urls) {
        const expected = coreMatch(core, url);

        assert.deepEqual(matchRoute(compiled, url), expected, `scan '${url}'`);
        assert.deepEqual(trie.match(url), expected, `trie '${url}'`);
      }
    });

    it('formats the urls core formats', () => {
      const compiled = new Map(
        compileRoutes(routes).map((route) => [route.name, route.matcher]),
      );

      for (const [state, values] of formats) {
        const matcher = compiled.get(state);
        assert.ok(matcher, state);

        assert.equal(
          format(matcher, values),
          coreFormat(core, state, values),
          `${state} ${JSON.stringify(values)}`,
        );
      }
    });

    for (const [tier, tierConfig] of TIERS) {
      it(`reaches core's verdict on the ${tier} strategy`, async () => {
        const router = createServerRouter({
          mounts: { '/app': { ...tierConfig, routes } },
        });

        for (const url of urls) {
          const { kind } = await router.resolve(`/app${url}`);

          assert.equal(
            kind,
            coreMatch(core, url) ? 'shell' : 'notFound',
            `'${url}'`,
          );
        }
      });
    }
  });
}

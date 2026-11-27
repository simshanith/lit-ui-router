import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Hono } from 'hono';

import { createConnectMiddleware } from '../src/connect.ts';
import { createFetchHandler } from '../src/fetch.ts';
import { serverRouterHono } from '../src/hono.ts';
import {
  createServerRouter as createRootRouter,
  diagnoseMounts as diagnoseRootMounts,
} from '../src/index.ts';
import {
  createServerRouter,
  diagnoseMounts,
  routeTrie,
} from '../src/router-matcher.ts';
import type { MountConfig } from '../src/router-matcher.ts';
import { config, hitPaths, MISS, REDIRECTS } from './route-tables.ts';

const app: MountConfig = {
  routes: [
    { name: 'home', url: '' },
    { name: 'contacts', url: '/contacts' },
    { name: 'contacts.detail', url: '/:contactId' },
    { name: 'legacy', url: '/legacy', redirectTo: 'contacts' },
    {
      name: 'moved',
      url: '/moved',
      redirectTo: 'contacts',
      redirectStatusCode: 301,
    },
    { name: 'badge', url: '/badge/:id', response: true },
    { name: 'search', url: '/search?q', delegate: 'search' },
    { name: 'notFound' },
  ],
  redirects: [
    { pattern: '/old/:contactId', to: 'contacts.detail' },
    { pattern: /^\/inbox$/, to: { state: 'contacts' } },
  ],
  otherwise: { state: 'notFound' },
};

const docs: MountConfig = {
  routes: [
    { name: 'page', url: '/{slug:path}/' },
    { name: 'index', url: '/' },
  ],
  config: { strict: false, trailingSlash: { pages: 'always' } },
  routeIndex: routeTrie,
};

const mounts = { '/app': app, '/docs': docs };

const probes = [
  '/app',
  '/app/contacts',
  '/app/contacts/7',
  '/app/legacy',
  '/app/moved',
  '/app/old/3',
  '/app/inbox',
  '/app/badge/9',
  '/app/search',
  '/app/nope',
  '/app//contacts',
  '/app/%E0%A4%A',
  '/docs/',
  '/docs/guide',
  '/docs/guide/',
  '/elsewhere',
];

describe('router/matcher createServerRouter', () => {
  it('answers every probe as the root entry does', async () => {
    const root = createRootRouter({ mounts });
    const matcher = createServerRouter({ mounts });

    for (const path of probes) {
      assert.deepEqual(
        await matcher.resolve(path),
        await root.resolve(path),
        path,
      );
    }
  });

  it('answers generated route tables as the root entry does', async () => {
    const table = config(100, 'matcher');
    const root = createRootRouter(table);
    const matcher = createServerRouter(table);

    for (const path of [...hitPaths(100), MISS, ...REDIRECTS]) {
      assert.deepEqual(
        await matcher.resolve(path),
        await root.resolve(path),
        path,
      );
    }
  });

  it('takes a base as the root entry does', async () => {
    const router = createServerRouter({
      base: '/site/',
      mounts: { '/site/app': app },
    });

    assert.equal(router.base, '/site/');
    assert.deepEqual(await router.resolve('/app/legacy'), {
      kind: 'redirect',
      mount: '/app',
      location: '/app/contacts',
      status: 302,
    });
  });

  it('throws at construction for a simulate mount, naming the root entry', () => {
    assert.throws(
      () =>
        createServerRouter({
          mounts: { '/app': app, '/sim': { ...app, strategy: 'simulate' } },
        }),
      {
        message:
          "Mount '/sim': the 'simulate' strategy needs createServerRouter from 'ui-router-server'; 'ui-router-server/router/matcher' builds 'matcher' mounts only",
      },
    );
  });

  it('names the base-stripped mount for a simulate mount under a base', () => {
    assert.throws(
      () =>
        createServerRouter({
          base: '/site/',
          mounts: { '/site/sim': { ...app, strategy: 'simulate' } },
        }),
      {
        message:
          "Mount '/sim': the 'simulate' strategy needs createServerRouter from 'ui-router-server'; 'ui-router-server/router/matcher' builds 'matcher' mounts only",
      },
    );
  });

  it('throws at construction for a prewarm count on a matcher mount', () => {
    assert.throws(
      () => createServerRouter({ mounts: { '/app': { ...app, prewarm: 1 } } }),
      { message: "Mount '/app': prewarm needs the 'simulate' strategy" },
    );
  });

  it('builds routers diagnoseMounts and the adapters accept', async () => {
    const router = createServerRouter({
      mounts: { '/app': { routes: [{ name: 'item', url: '/items/:id' }] } },
    });

    assert.deepEqual(
      diagnoseMounts(router).map((finding) => finding.kind),
      ['bareBaseNotFound'],
    );

    const handler = createFetchHandler(router, {
      serveShell: () => new Response('shell'),
    });

    const response = await handler(
      new Request('https://site.test/app/items/1', {
        headers: { accept: 'text/html' },
      }),
    );

    assert.equal(await response?.text(), 'shell');
  });

  it('shares diagnoseMounts with the root entry', () => {
    const table = {
      mounts: { '/app': { routes: [{ name: 'item', url: '/items/:id' }] } },
    };

    const matcher = createServerRouter(table);
    const root = createRootRouter(table);

    assert.equal(diagnoseMounts(matcher).length, 1);
    assert.deepEqual(diagnoseRootMounts(matcher), diagnoseMounts(matcher));
    assert.deepEqual(diagnoseMounts(root), diagnoseRootMounts(root));
  });
});

describe('router/matcher routers in the adapters', () => {
  const router = createServerRouter({ mounts: { '/app': app } });

  const post = (path: string): Request =>
    new Request(`https://site.test${path}`, { method: 'POST' });

  const badge = (path: string): Request =>
    new Request(`https://site.test${path}`, {
      headers: { accept: 'image/svg+xml' },
    });

  const options = {
    serveShell: () => new Response('shell'),
    delegates: { search: () => new Response('searched', { status: 202 }) },
    serveResponse: ({ state, params }: { state: string; params: object }) =>
      new Response(JSON.stringify({ state, params })),
  };

  it('delegates and answers response states through the fetch handler', async () => {
    const handler = createFetchHandler(router, options);

    assert.equal(
      await (await handler(post('/app/search')))?.text(),
      'searched',
    );
    assert.deepEqual(
      JSON.parse((await (await handler(badge('/app/badge/9')))?.text()) ?? ''),
      {
        state: 'badge',
        params: { id: '9' },
      },
    );
    assert.equal(await handler(post('/app/contacts')), null);
  });

  it('delegates and answers response states through Hono', async () => {
    const hono = new Hono()
      .use(serverRouterHono(router, options))
      .all('*', (c) => c.text('fallthrough', 418));

    assert.equal(
      await (await hono.request(post('/app/search'))).text(),
      'searched',
    );
    assert.deepEqual(
      JSON.parse(await (await hono.request(badge('/app/badge/9'))).text()),
      {
        state: 'badge',
        params: { id: '9' },
      },
    );
    assert.equal((await hono.request(post('/app/contacts'))).status, 418);
  });

  it('passes delegate and response verdicts on through Connect', async () => {
    const mw = createConnectMiddleware(router, {
      delegates: 'next',
      responses: 'next',
    });

    for (const url of ['/app/search', '/app/badge/9']) {
      const passed = await new Promise<unknown[]>((resolve, reject) => {
        mw(
          { url, method: 'GET', headers: { accept: 'text/html' } },
          {
            writeHead: () => reject(new Error(`answered ${url}`)),
            setHeader: () => {},
            end: () => reject(new Error(`answered ${url}`)),
          },
          (...args: unknown[]) => resolve(args),
        );
      });

      assert.deepEqual(passed, [], url);
    }
  });
});

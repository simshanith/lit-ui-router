import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Hono } from 'hono';

import { createConnectMiddleware } from '../src/connect.ts';
import { createFetchHandler } from '../src/fetch.ts';
import { serverRouterHono } from '../src/hono.ts';
import { createServerRouter } from '../src/index.ts';
import type { MountConfig } from '../src/index.ts';
import { prerender, redirectPages } from '../src/prerender.ts';
import {
  connect,
  memory,
  navigation,
  noShell,
  ORIGIN,
  previewMiddleware,
  STRATEGIES,
} from './redirect-fixtures.ts';
import type { Strategy } from './redirect-fixtures.ts';

// ':lang' matches an empty segment, so '//about' matches 'new' as written.
const site = (strategy: Strategy) =>
  ({
    routes: [
      { name: 'old', url: '/:lang/docs/:slug', redirectTo: 'new' },
      { name: 'new', url: '/:lang/:slug' },
      { name: 'about', url: '/about' },
    ],
    strategy,
    ignoreDiagnostics: ['bareBaseNotFound'],
  }) satisfies MountConfig;

// Where the leading run can sit: `mount` and `prefix` as `resolve` sees them, `served` as the host does.
const PLACEMENTS = [
  {
    name: 'at /',
    router: (strategy: Strategy) =>
      createServerRouter({ mounts: { '/': site(strategy) } }),
    base: '/',
    mount: '/',
    prefix: '',
    served: '',
  },
  {
    name: 'below mount /docs',
    router: (strategy: Strategy) =>
      createServerRouter({ mounts: { '/docs': site(strategy) } }),
    base: '/',
    mount: '/docs',
    prefix: '/docs',
    served: '/docs',
  },
  {
    name: 'under base /app/',
    router: (strategy: Strategy) =>
      createServerRouter({
        base: '/app/',
        mounts: { '/app/': site(strategy) },
      }),
    base: '/app/',
    mount: '/',
    prefix: '',
    served: '/app',
  },
  {
    name: 'below mount /docs under base /app/',
    router: (strategy: Strategy) =>
      createServerRouter({
        base: '/app/',
        mounts: { '/app/docs': site(strategy) },
      }),
    base: '/app/',
    mount: '/docs',
    prefix: '/docs',
    served: '/app/docs',
  },
] as const;

const CASES = STRATEGIES.flatMap((strategy) =>
  PLACEMENTS.map((placement) => ({
    ...placement,
    name: `${strategy} ${placement.name}`,
    router: () => placement.router(strategy),
  })),
);

describe('a request path that begins with //', () => {
  for (const { name, router, mount, prefix } of CASES) {
    it(`redirects to its collapsed spelling (${name})`, async () => {
      const { resolve } = router();

      for (const [path, location] of [
        ['//about', '/about'],
        ['///about', '/about'],
        ['////about', '/about'],
        ['//en/intro', '/en/intro'],
        // The collapsed path names 'new' with lang 'docs', never 'old' with an empty lang.
        ['//docs/evil.example', '/docs/evil.example'],
      ])
        assert.deepEqual(await resolve(prefix + path), {
          kind: 'redirect',
          mount,
          location: prefix + location,
          status: 302,
        });
    });

    it(`answers the redirect its collapsed spelling answers, in one hop (${name})`, async () => {
      assert.deepEqual(await router().resolve(`${prefix}//en/docs/intro`), {
        kind: 'redirect',
        mount,
        location: `${prefix}/en/intro`,
        status: 302,
      });
    });

    it(`answers notFound when its collapsed spelling matches no route (${name})`, async () => {
      const { resolve } = router();

      for (const path of ['//evil.example', '///evil.example'])
        assert.deepEqual(await resolve(prefix + path), {
          kind: 'notFound',
          mount,
        });
    });

    it(`leaves an empty segment below the first as it was (${name})`, async () => {
      const { resolve } = router();

      assert.deepEqual(await resolve(`${prefix}/en//x`), {
        kind: 'notFound',
        mount,
      });
      assert.deepEqual(await resolve(`${prefix}/about`), {
        kind: 'shell',
        mount,
      });
    });
  }

  for (const { name, router, base, served } of CASES) {
    const url = `${served}//about?x=1`;
    const location = `${served}/about?x=1`;

    it(`redirects through fetch, the query kept (${name})`, async () => {
      const handler = createFetchHandler(router(), { serveShell: noShell });
      const res = await handler(navigation(url));

      assert.equal(res?.status, 302);
      assert.equal(res?.headers.get('Location'), location);
    });

    it(`redirects through Connect, the query kept (${name})`, async () => {
      assert.deepEqual(await connect(createConnectMiddleware(router()), url), {
        status: 302,
        location,
      });
    });

    it(`redirects through Hono, the query kept (${name})`, async () => {
      const app = new Hono();
      app.use('*', serverRouterHono(router(), { serveShell: noShell }));
      app.all('*', (c) => c.text('downstream'));

      const res = await app.request(navigation(url));

      assert.equal(res.status, 302);
      assert.equal(res.headers.get('Location'), location);
    });

    it(`redirects through vite preview, the query kept (${name})`, async () => {
      assert.deepEqual(
        await connect(await previewMiddleware(router(), base), url),
        {
          status: 302,
          location,
        },
      );
    });

    it(`answers 404 and no Location when the collapsed path matches no route (${name})`, async () => {
      const lost = `${served}//evil.example`;
      const handler = createFetchHandler(router(), { serveShell: noShell });
      const res = await handler(navigation(lost));

      assert.equal(res?.status, 404);
      assert.equal(res?.headers.get('Location'), null);
      assert.deepEqual(await connect(createConnectMiddleware(router()), lost), {
        status: 404,
        location: undefined,
      });
    });

    it(`leaves a request that is not a navigation to the host (${name})`, async () => {
      const handler = createFetchHandler(router(), { serveShell: noShell });

      assert.equal(
        await handler(new Request(ORIGIN + url, { method: 'POST' })),
        null,
      );
      assert.deepEqual(
        await connect(createConnectMiddleware(router()), url, 'POST'),
        { next: true },
      );
    });
  }

  for (const strategy of STRATEGIES) {
    it(`${strategy}: redirects to the page an otherwise state renders at the collapsed path`, async () => {
      const { resolve } = createServerRouter({
        mounts: {
          '/': {
            routes: [{ name: 'new', url: '/:lang/:slug' }, { name: 'lost' }],
            otherwise: { state: 'lost' },
            strategy,
          },
        },
      });

      assert.deepEqual(await resolve('/nope'), {
        kind: 'shell',
        mount: '/',
        status: 404,
      });
      assert.deepEqual(await resolve('//nope'), {
        kind: 'redirect',
        mount: '/',
        location: '/nope',
        status: 302,
      });
    });

    it(`${strategy}: leaves a path no mount owns untouched`, async () => {
      const router = createServerRouter({
        mounts: { '/docs': site(strategy) },
      });

      assert.deepEqual(await router.resolve('//docs/about'), {
        kind: 'notFound',
      });
      assert.deepEqual(await router.resolve('//about'), { kind: 'notFound' });

      const handler = createFetchHandler(router, { serveShell: noShell });
      assert.equal(await handler(navigation('//docs/about')), null);
    });

    it(`${strategy}: redirects into a longer mount that owns the collapsed path`, async () => {
      const { resolve } = createServerRouter({
        mounts: {
          '/': site(strategy),
          '/docs': { routes: [{ name: 'guide', url: '/guide' }], strategy },
        },
      });

      assert.deepEqual(await resolve('//docs/guide'), {
        kind: 'redirect',
        mount: '/',
        location: '/docs/guide',
        status: 302,
      });
      assert.deepEqual(await resolve('/docs//guide'), {
        kind: 'redirect',
        mount: '/docs',
        location: '/docs/guide',
        status: 302,
      });
      assert.deepEqual(await resolve('//docs//guide'), {
        kind: 'redirect',
        mount: '/',
        location: '/docs/guide',
        status: 302,
      });
    });

    it(`${strategy}: redirects a navigation to a marked state, and leaves any other request to its handler`, async () => {
      const router = createServerRouter({
        mounts: {
          '/': {
            routes: [
              { name: 'feed', url: '/:lang/feed', delegate: 'feed' },
              { name: 'badge', url: '/:lang/badge.svg', response: true },
            ],
            strategy,
          },
        },
      });

      const handler = createFetchHandler(router, {
        serveShell: noShell,
        delegates: { feed: (request) => new Response(request.method) },
        serveResponse: () => new Response('badge'),
      });

      for (const path of ['/en/feed', '/en/badge.svg']) {
        const res = await handler(navigation(`/${path}`));

        assert.equal(res?.status, 302);
        assert.equal(res?.headers.get('Location'), path);
      }

      // As before the guard: url matching alone, an empty ':lang' included.
      const posted = await handler(
        new Request(`${ORIGIN}//feed`, { method: 'POST' }),
      );

      assert.equal(await posted?.text(), 'POST');

      const fetched = await handler(new Request(`${ORIGIN}//badge.svg`));
      assert.equal(await fetched?.text(), 'badge');
    });
  }
});

describe('a listed path that begins with //', () => {
  for (const { name, router, served } of CASES) {
    // The router's own base is stripped from listed paths, so the list is base-free.
    const table = { resolver: router(), pathsIncludeBase: false };
    const below = served.replace(/^\/app/, '');

    const lines = ['', '/'].map((slash) => ({
      from: `${served}//about${slash}`,
      to: `${served}/about`,
      status: 302,
    }));

    it(`writes rules lines that carry the base on both sides, and no page (${name})`, async () => {
      const { files, write } = memory();

      const { rules, pages } = await prerender({
        ...table,
        outDir: 'dist',
        paths: [`${below}//about`],
        render: () => assert.fail('a redirect renders no page'),
        write,
        notFound: false,
      });

      assert.deepEqual(rules, lines);
      assert.deepEqual(pages, []);
      assert.deepEqual([...files.keys()], ['dist/_redirects']);
    });

    it(`writes no redirect page over the page it redirects to (${name})`, async () => {
      const { files, write } = memory();

      const { rules } = await prerender({
        ...table,
        outDir: 'dist',
        paths: [`${below}//about`, `${below}/about`],
        render: () => '<p/>',
        rules: redirectPages(),
        write,
        notFound: false,
      });

      assert.deepEqual(rules, lines);
      assert.equal(files.size, 1);
      assert.doesNotMatch([...files.values()].join(''), /url=/);
    });

    it(`writes no redirect page for a backslash spelling of the page (${name})`, async () => {
      const { files, write } = memory();
      const backslash = String.fromCharCode(92);

      await prerender({
        ...table,
        outDir: 'dist',
        paths: [`${below}/${backslash}about`, `${below}/about`],
        render: () => '<p/>',
        rules: redirectPages(),
        write,
        notFound: false,
      });

      assert.equal(files.size, 1);
      assert.doesNotMatch([...files.keys()].join(''), /\\/);
      assert.doesNotMatch([...files.values()].join(''), /url=/);
    });

    it(`warns about one whose collapsed spelling matches no route (${name})`, async () => {
      const { files, write } = memory();

      const { rules, warnings } = await prerender({
        ...table,
        outDir: 'dist',
        paths: [`${below}//evil.example`],
        render: () => assert.fail('an unclaimed path renders no page'),
        write,
        notFound: false,
      });

      assert.deepEqual(rules, []);
      assert.deepEqual(warnings, [`${below}//evil.example`]);
      assert.equal(files.size, 0);
    });
  }

  it('takes the base off a path listed with it', async () => {
    const { write } = memory();

    const { rules } = await prerender({
      resolver: createServerRouter({
        base: '/app/',
        mounts: { '/app/': site('matcher') },
      }),
      outDir: 'dist',
      paths: ['/app//about'],
      render: () => assert.fail('a redirect renders no page'),
      write,
      notFound: false,
    });

    assert.deepEqual(
      rules.map((line) => `${line.from} ${line.to}`),
      ['/app//about /app/about', '/app//about/ /app/about'],
    );
  });
});

describe('a request path whose leading run holds a backslash', () => {
  // A url parser reads '/\\host' as '//host', so the run collapses like '//'.
  const BACKSLASH = String.fromCharCode(92);

  const pages = (strategy: Strategy) =>
    createServerRouter({
      mounts: {
        '/': {
          routes: [
            { name: 'page', url: '/:slug' },
            { name: 'old', url: '/:lang/docs/:slug', redirectTo: 'moved' },
            { name: 'moved', url: '/:lang/to/:slug' },
          ],
          strategy,
        },
      },
    });

  for (const strategy of STRATEGIES) {
    for (const lead of [`//${BACKSLASH}`, `/${BACKSLASH}`, `/${BACKSLASH}/`])
      it(`${strategy}: redirects '${lead}evil.example' to the page on this origin`, async () => {
        assert.deepEqual(await pages(strategy).resolve(`${lead}evil.example`), {
          kind: 'redirect',
          mount: '/',
          location: '/evil.example',
          status: 302,
        });
      });

    it(`${strategy}: answers a raw Connect target on this origin`, async () => {
      const { location } = await connect(
        createConnectMiddleware(pages(strategy)),
        `//${BACKSLASH}evil.example?x=1`,
      );

      assert.equal(location, '/evil.example?x=1');
      assert.equal(
        new URL(location ?? '', ORIGIN).origin,
        new URL(ORIGIN).origin,
      );
    });
  }
});

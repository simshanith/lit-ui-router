import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Hono } from 'hono';

import { createConnectMiddleware } from '../src/connect.ts';
import type { ConnectMiddleware, ConnectNext } from '../src/connect.ts';
import { createFetchHandler } from '../src/fetch.ts';
import { serverRouterHono } from '../src/hono.ts';
import { createServerRouter } from '../src/index.ts';
import type { MountConfig, ServerRouter, Verdict } from '../src/index.ts';
import { prerender, redirectPages } from '../src/prerender.ts';
import type { FileWriter } from '../src/prerender.ts';
import { serverRouterPlugin } from '../src/vite.ts';

const STRATEGIES = ['matcher', 'simulate'] as const;

// ':lang' matches an empty segment, so the target formats with a leading '//'.
const site = (strategy: (typeof STRATEGIES)[number]) =>
  ({
    routes: [
      { name: 'old', url: '/:lang/docs/:slug', redirectTo: 'new' },
      { name: 'new', url: '/:lang/:slug' },
    ],
    strategy,
  }) satisfies MountConfig;

const ORIGIN = 'https://site.test';

const HOSTILE = '//docs/evil.example';

// Each strategy at base '/' and under '/app/': the router, the hostile url and the Location it must answer.
const CASES = STRATEGIES.flatMap((strategy) => [
  {
    name: `${strategy} at /`,
    router: () => createServerRouter({ mounts: { '/': site(strategy) } }),
    base: '/',
    url: `${HOSTILE}?x=1`,
    location: '/evil.example?x=1',
  },
  {
    name: `${strategy} under /app/`,
    router: () =>
      createServerRouter({
        base: '/app/',
        mounts: { '/app/': site(strategy) },
      }),
    base: '/app/',
    url: `/app${HOSTILE}?x=1`,
    location: '/app/evil.example?x=1',
  },
]);

const routerOf = (verdict: Verdict): ServerRouter => ({
  resolve: () => Promise.resolve(verdict),
});

const navigation = (url: string) =>
  new Request(`${ORIGIN}${url}`, { headers: { accept: 'text/html' } });

const noShell = () => {
  throw new Error('serveShell must not be called');
};

// Runs Connect middleware once; answers the redirect it wrote.
const connect = (middleware: ConnectMiddleware, url: string) =>
  new Promise<{ status?: number; location?: string; error?: unknown }>(
    (resolve) => {
      const res = {
        writeHead: (status: number, headers?: { Location?: string }) =>
          resolve({ status, location: headers?.Location }),
        setHeader: () => {},
        end: () => {},
      };

      const next: ConnectNext = (error) => resolve({ error });

      middleware(
        { url, method: 'GET', headers: { accept: 'text/html' } },
        res,
        next,
      );
    },
  );

const memory = () => {
  const files = new Map<string, string>();

  const write: FileWriter = (file, body) => {
    files.set(file, body);
  };

  return { files, write };
};

// A path on this origin: one leading slash, never a second.
const SAME_ORIGIN = /^\/(?!\/)/;

describe("a redirect verdict's location", () => {
  for (const strategy of STRATEGIES) {
    it(`collapses the leading slashes an empty leading param formats (${strategy})`, async () => {
      const router = createServerRouter({ mounts: { '/': site(strategy) } });

      assert.deepEqual(await router.resolve(HOSTILE), {
        kind: 'redirect',
        mount: '/',
        location: '/evil.example',
        status: 302,
      });
      assert.deepEqual(await router.resolve('/en/docs/intro'), {
        kind: 'redirect',
        mount: '/',
        location: '/en/intro',
        status: 302,
      });
    });
  }

  for (const { name, router, url, location } of CASES) {
    it(`stays on this origin through fetch (${name})`, async () => {
      const handler = createFetchHandler(router(), { serveShell: noShell });
      const res = await handler(navigation(url));

      assert.equal(res?.status, 302);
      assert.equal(res?.headers.get('Location'), location);
    });

    it(`stays on this origin through Connect (${name})`, async () => {
      assert.deepEqual(await connect(createConnectMiddleware(router()), url), {
        status: 302,
        location,
      });
    });

    it(`stays on this origin through Hono (${name})`, async () => {
      const app = new Hono();
      app.use('*', serverRouterHono(router(), { serveShell: noShell }));
      app.all('*', (c) => c.text('downstream'));

      const res = await app.request(navigation(url));

      assert.equal(res.status, 302);
      assert.equal(res.headers.get('Location'), location);
    });

    it(`stays on this origin through vite preview (${name})`, async () => {
      const plugin = serverRouterPlugin(router());
      const installed: ConnectMiddleware[] = [];

      plugin.configResolved({
        root: '/nonexistent',
        base: name.endsWith('/app/') ? '/app/' : '/',
        command: 'serve',
        mode: 'production',
        build: { outDir: 'dist', ssr: false },
        logger: { info: () => {} },
      });
      plugin.configurePreviewServer({
        middlewares: { use: (mw: ConnectMiddleware) => installed.push(mw) },
      });
      const [middleware] = installed;
      assert.ok(middleware);

      assert.deepEqual(await connect(middleware, url), {
        status: 302,
        location,
      });
    });
  }

  for (const { name, router, base } of CASES) {
    // The router's own base is stripped from listed paths, so the list is base-free.
    const table = { resolver: router(), pathsIncludeBase: false };

    it(`writes no rules line whose target starts with '//' (${name})`, async () => {
      const { files, write } = memory();

      const { rules } = await prerender({
        ...table,
        outDir: 'dist',
        paths: [HOSTILE],
        render: () => '<p/>',
        write,
        notFound: false,
      });

      assert.ok(rules.length > 0);

      for (const line of rules) assert.match(line.to, SAME_ORIGIN);
      assert.match(
        files.get('dist/_redirects') ?? '',
        new RegExp(` ${base}evil\\.example 302\n`),
      );
      assert.doesNotMatch(files.get('dist/_redirects') ?? '', / \/\//);
    });

    // Under a base, redirectPages rejects the listed '//…' path itself as outside the base.
    if (base !== '/') continue;

    it(`writes no redirect page whose target starts with '//' (${name})`, async () => {
      const { files, write } = memory();

      await prerender({
        ...table,
        outDir: 'dist',
        paths: [HOSTILE],
        render: () => '<p/>',
        rules: redirectPages(),
        write,
        notFound: false,
      });

      const pages = [...files.values()];
      assert.ok(pages.length > 0);

      for (const page of pages) {
        assert.match(page, /url=\/evil\.example"/);
        assert.doesNotMatch(page, /(url=|href=")\/\//);
        assert.doesNotMatch(page, /"\/\/evil\.example/);
      }
    });
  }

  it('keeps a mount-joined path as formatted below the mount', async () => {
    const router = createServerRouter({
      mounts: { '/docs': site('matcher') },
    });

    assert.deepEqual(await router.resolve(`/docs${HOSTILE}`), {
      kind: 'redirect',
      mount: '/docs',
      location: '/docs//evil.example',
      status: 302,
    });
  });
});

describe('an explicitly external redirect target', () => {
  const EXTERNAL = ['//cdn.example/x', 'https://example.com/x'];

  for (const location of EXTERNAL) {
    const away = () =>
      routerOf({ kind: 'redirect', mount: '/', location, status: 301 });

    it(`passes a resolver's '${location}' through every adapter as written`, async () => {
      for (const base of ['/', '/app/']) {
        const url = `${base}x`;

        const handler = createFetchHandler(away(), {
          base,
          serveShell: noShell,
        });

        assert.equal(
          (await handler(navigation(url)))?.headers.get('Location'),
          location,
        );
        assert.deepEqual(
          await connect(createConnectMiddleware(away(), { base }), url),
          { status: 301, location },
        );

        const app = new Hono();
        app.use('*', serverRouterHono(away(), { base, serveShell: noShell }));
        const res = await app.request(navigation(url));
        assert.equal(res.headers.get('Location'), location);
      }
    });

    it(`passes a response state's '${location}' through as written`, async () => {
      const router = createServerRouter({
        base: '/app/',
        mounts: {
          '/app/': { routes: [{ name: 'out', url: '/out', response: true }] },
        },
      });

      const handler = createFetchHandler(router, {
        serveShell: noShell,
        serveResponse: () =>
          new Response(null, { status: 302, headers: { Location: location } }),
      });

      const res = await handler(navigation('/app/out'));
      assert.equal(res?.status, 302);
      assert.equal(res?.headers.get('Location'), location);
    });

    it(`writes a render's '${location}' into the rules as written`, async () => {
      const { files, write } = memory();

      await prerender({
        mounts: { '/': { routes: [{ name: 'out', url: '/out' }] } },
        base: '/app/',
        outDir: 'dist',
        paths: ['/out'],
        render: () => ({ location, status: 301 }),
        write,
        notFound: false,
      });

      assert.equal(
        files.get('dist/_redirects'),
        `/app/out ${location} 301\n/app/out/ ${location} 301\n`,
      );
    });
  }
});

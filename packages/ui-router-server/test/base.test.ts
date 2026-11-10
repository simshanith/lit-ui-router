import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Hono } from 'hono';

import { createConnectMiddleware } from '../src/connect.ts';
import type { ConnectNext } from '../src/connect.ts';
import { createFetchHandler } from '../src/fetch.ts';
import { serverRouterHono } from '../src/hono.ts';
import { createServerRouter } from '../src/index.ts';
import type { MountConfig, Verdict } from '../src/index.ts';
import { prerender } from '../src/prerender.ts';
import type { FileWriter, PrerenderOptions } from '../src/prerender.ts';

const site = {
  routes: [
    { name: 'home', url: '/' },
    { name: 'about', url: '/about' },
    { name: 'legacy', url: '/legacy', redirectTo: 'about' },
    { name: 'notFound' },
  ],
  otherwise: { state: 'notFound' },
  config: { strict: false },
} satisfies MountConfig;

const keyed = () =>
  createServerRouter({ base: '/app/', mounts: { '/app/': site } });

const CARRIED =
  /mount '\/app' already carries base '\/app\/': declare createServerRouter\(\{ base: '\/app\/', mounts \}\), or key the mount '\/'/;

const navigation = (url: string) =>
  new Request(`https://example.test${url}`, {
    headers: { accept: 'text/html' },
  });

const noShell = () => {
  throw new Error('serveShell must not be called');
};

// Runs Connect middleware once; answers what it wrote or what it passed on.
const connect = (
  middleware: ReturnType<typeof createConnectMiddleware>,
  url: string,
) =>
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

describe('createServerRouter({ base })', () => {
  it('compiles a table keyed by the base as the table at /', async () => {
    const router = keyed();
    assert.equal(router.base, '/app/');

    assert.deepEqual(await router.resolve('/legacy'), {
      kind: 'redirect',
      mount: '/',
      location: '/about',
      status: 302,
    });
    assert.equal((await router.resolve('/about')).kind, 'shell');
  });

  it('normalizes the base and admits keys spelled without the slash', () => {
    const router = createServerRouter({
      base: '/app',
      mounts: { '/app': site, '/app/admin': site },
    });

    assert.equal(router.base, '/app/');
  });

  it('throws for a key outside the base, and for a relative base', () => {
    assert.throws(
      () => createServerRouter({ base: '/app/', mounts: { '/': site } }),
      /createServerRouter: mount '\/' lies outside base '\/app\/'/,
    );
    assert.throws(
      () => createServerRouter({ base: './', mounts: { '/': site } }),
      /is relative/,
    );
  });

  it('declares no base without one', () => {
    assert.equal(createServerRouter({ mounts: { '/': site } }).base, undefined);
  });
});

describe("the adapters' base", () => {
  it("defaults to the router's, in Connect", async () => {
    const middleware = createConnectMiddleware(keyed());

    assert.deepEqual(await connect(middleware, '/app/legacy'), {
      status: 302,
      location: '/app/about',
    });
    assert.deepEqual(await connect(middleware, '/legacy'), {
      error: undefined,
    });
  });

  it("defaults to the router's, in fetch and Hono", async () => {
    const handler = createFetchHandler(keyed(), { serveShell: noShell });
    const res = await handler(navigation('/app/legacy'));
    assert.equal(res?.headers.get('Location'), '/app/about');
    assert.equal(await handler(navigation('/legacy')), null);

    const app = new Hono();
    app.use('*', serverRouterHono(keyed(), { serveShell: noShell }));
    app.all('*', (c) => c.text('downstream'));

    const hono = await app.request('/app/legacy', {
      headers: { accept: 'text/html' },
    });

    assert.equal(hono.headers.get('Location'), '/app/about');
  });

  it("throws for a base that differs from the router's", () => {
    const differs = /base '\/other\/' differs from the router's base '\/app\/'/;

    assert.throws(
      () => createConnectMiddleware(keyed(), { base: '/other/' }),
      differs,
    );
    assert.throws(
      () =>
        createFetchHandler(keyed(), { base: '/other/', serveShell: noShell }),
      differs,
    );
    assert.throws(
      () => serverRouterHono(keyed(), { base: '/other', serveShell: noShell }),
      differs,
    );
    assert.doesNotThrow(() =>
      createConnectMiddleware(keyed(), { base: '/app' }),
    );
  });

  it('fails every request when a mount already carries an undeclared base', async () => {
    const undeclared = createServerRouter({ mounts: { '/app/': site } });

    const { error } = await connect(
      createConnectMiddleware(undeclared, { base: '/app/' }),
      '/app/about',
    );

    assert.match(String(error), CARRIED);

    const handler = createFetchHandler(undeclared, {
      base: '/app/',
      serveShell: noShell,
    });

    await assert.rejects(handler(navigation('/app/about')), CARRIED);
  });
});

describe('prerender under a base', () => {
  const memory = () => {
    const files = new Map<string, string>();

    const write: FileWriter = (file, body) => {
      files.set(file, body);
    };

    return { files, write };
  };

  const render = (_verdict: Verdict, { path }: { path: string }) =>
    `<p>${path}</p>`;

  const paths = ['/', '/about', '/legacy'];

  it('writes the same files from a keyed table, a keyed resolver and a relative table', async () => {
    const tables: Pick<PrerenderOptions, 'mounts' | 'resolver' | 'base'>[] = [
      { mounts: { '/app/': site }, base: '/app/' },
      { resolver: keyed() },
      { mounts: { '/': site }, base: '/app/' },
    ];

    const runs = await Promise.all(
      tables.map(async (table) => {
        const { files, write } = memory();

        const notFound =
          table.resolver === undefined
            ? {}
            : { probe: '/__ui-router-server-probe__' };

        await prerender({
          ...table,
          outDir: 'dist',
          paths,
          render,
          write,
          notFound,
        });

        return files;
      }),
    );

    const [keyedTable, keyedResolver, relative] = runs;
    assert.equal(
      relative?.get('dist/_redirects'),
      '/app/legacy /app/about 302\n/app/legacy/ /app/about 302\n',
    );
    assert.deepEqual(
      relative?.get('dist/404.html'),
      '<p>/__ui-router-server-probe__</p>',
    );
    assert.deepEqual(keyedTable, relative);
    assert.deepEqual(keyedResolver, relative);
  });

  it('writes the same files from paths listed with the base under pathsIncludeBase', async () => {
    const run = async (listed: string[], pathsIncludeBase?: boolean) => {
      const { files, write } = memory();

      const result = await prerender({
        mounts: { '/app/': site },
        base: '/app/',
        pathsIncludeBase,
        outDir: 'dist',
        paths: listed,
        render,
        write,
      });

      return { files, result };
    };

    const free = await run(paths);
    const full = await run(['/app/', '/app/about', '/app/legacy'], true);
    assert.deepEqual(full.files, free.files);
    assert.deepEqual(full.result.rules, free.result.rules);
    assert.deepEqual(
      full.result.pages.map((page) => page.path),
      ['/app/', '/app/about', '/__ui-router-server-probe__'],
    );

    await assert.rejects(
      run(['/app/about', '/about'], true),
      /prerender: '\/about' lies outside base '\/app\/', and pathsIncludeBase lists every path under it/,
    );
  });

  it('reads a path that starts with the base as base-free without pathsIncludeBase', async () => {
    const { files, write } = memory();

    const result = await prerender({
      mounts: { '/': site },
      base: '/app/',
      outDir: 'dist',
      paths: ['/app/about'],
      render,
      write,
      notFound: false,
    });

    assert.deepEqual([...files.keys()], ['dist/app/about/index.html']);
    assert.equal(files.get('dist/app/about/index.html'), '<p>/app/about</p>');
    assert.equal(result.pages[0]?.verdict.kind, 'shell');
  });

  it("is a no-op under base '/'", async () => {
    const { files, write } = memory();

    await prerender({
      mounts: { '/': site },
      pathsIncludeBase: true,
      outDir: 'dist',
      paths: ['/about'],
      render,
      write,
      notFound: false,
    });

    assert.deepEqual([...files.keys()], ['dist/about/index.html']);
  });

  it("throws for a resolver whose mount already carries the base, or a base that differs from the resolver's", async () => {
    const { write } = memory();

    await assert.rejects(
      prerender({
        resolver: createServerRouter({ mounts: { '/app/': site } }),
        base: '/app/',
        outDir: 'dist',
        paths,
        render,
        write,
        notFound: false,
      }),
      CARRIED,
    );
    await assert.rejects(
      prerender({
        resolver: keyed(),
        base: '/other/',
        outDir: 'dist',
        paths,
        render,
        write,
        notFound: false,
      }),
      /prerender: base '\/other\/' differs from the router's base '\/app\/'/,
    );
  });

  it('throws for a table with keys both under and outside the base', async () => {
    const { write } = memory();

    await assert.rejects(
      prerender({
        mounts: { '/app/': site, '/docs': site },
        base: '/app/',
        outDir: 'dist',
        paths,
        render,
        write,
      }),
      /mount '\/docs' lies outside base '\/app\/'/,
    );
  });
});

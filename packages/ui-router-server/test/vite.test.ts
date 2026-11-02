import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { TestContext } from 'node:test';

import { createServerRouter } from '../src/index.ts';
import type { ServerRouter, Verdict } from '../src/index.ts';
import type { ConnectMiddleware } from '../src/connect.ts';
import { definePrerender, serverRouterPlugin } from '../src/vite.ts';
import type {
  PrerenderEntry,
  ServerRouterPluginOptions,
  ViteBuildContext,
  ViteResolvedConfig,
} from '../src/vite.ts';

const routerOf = (verdict: Verdict): ServerRouter => ({
  resolve: () => Promise.resolve(verdict),
});

// A fake Vite server that just captures whatever middleware the plugin installs.
const fakeServer = () => {
  const installed: ConnectMiddleware[] = [];

  return {
    installed,
    middlewares: { use: (mw: ConnectMiddleware) => installed.push(mw) },
  };
};

describe('serverRouterPlugin', () => {
  it('is a structural Vite plugin naming the package', () => {
    const plugin = serverRouterPlugin(routerOf({ kind: 'notFound' }));
    assert.equal(plugin.name, 'ui-router-server');
    assert.ok(plugin.configureServer instanceof Function);
    assert.ok(plugin.configurePreviewServer instanceof Function);
  });

  it('installs one middleware into both the dev and preview stacks', () => {
    const plugin = serverRouterPlugin(routerOf({ kind: 'notFound' }));
    const dev = fakeServer();
    const preview = fakeServer();
    plugin.configureServer(dev);
    plugin.configurePreviewServer(preview);
    assert.equal(dev.installed.length, 1);
    assert.equal(preview.installed.length, 1);
  });

  it('installs the Connect adapter behaviour (a redirect answers 302)', async () => {
    const plugin = serverRouterPlugin(
      routerOf({
        kind: 'redirect',
        mount: '/app',
        location: '/app/home',
        status: 302,
      }),
    );

    const server = fakeServer();
    plugin.configureServer(server);
    const middleware = server.installed[0];

    let status = 0;
    let location = '';
    let nexted = false;

    const req = {
      url: '/app/legacy?ref=x',
      method: 'GET',
      headers: { accept: 'text/html' },
    };

    await new Promise<void>((resolve) => {
      const res = {
        writeHead: (s: number, headers?: { Location?: string }) => {
          status = s;
          location = headers?.Location ?? '';

          return res;
        },
        setHeader: () => res,
        end: () => {
          resolve();

          return res;
        },
      };

      middleware(req, res, () => {
        nexted = true;
        resolve();
      });
    });
    assert.equal(status, 302);
    assert.equal(location, '/app/home?ref=x'); // search merged, not passed through
    assert.equal(nexted, false);
  });

  it('rewrites req.url and passes a shell into the downstream layer', async () => {
    const plugin = serverRouterPlugin(
      routerOf({ kind: 'shell', mount: '/app' }),
    );

    const server = fakeServer();
    plugin.configureServer(server);
    const middleware = server.installed[0];

    const req = {
      url: '/app/about',
      method: 'GET',
      headers: { accept: 'text/html' },
    };

    const link: string[] = [];
    await new Promise<void>((resolve) => {
      const res = {
        writeHead: () => res,
        setHeader: (_name: string, value: string) => {
          link.push(value);

          return res;
        },
        end: () => res,
      };

      middleware(req, res, () => resolve());
    });
    assert.equal(req.url, '/app'); // rewritten to the mount shell
    assert.deepEqual(link, ['</app>; rel="canonical"']);
  });

  it('never reports mount diagnostics; construction does', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});

    const router = createServerRouter({
      mounts: { '/app': { routes: [{ name: 'a', url: '/a' }] } },
    });

    assert.equal(warn.mock.callCount(), 1);

    const plugin = serverRouterPlugin(router);
    plugin.configureServer(fakeServer());
    plugin.configurePreviewServer(fakeServer());
    assert.equal(warn.mock.callCount(), 1);
  });
});

// A Vite root on disk: a built dist/index.html and one entry module.
const buildRoot = async (t: TestContext, entry: string) => {
  const root = await mkdtemp(path.join(tmpdir(), 'ui-router-server-hook-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'dist'));
  await writeFile(path.join(root, 'dist/index.html'), '<main></main>');
  await writeFile(path.join(root, 'entry.mjs'), entry);

  return root;
};

const configOf = (
  root: string,
  overrides: Partial<ViteResolvedConfig> = {},
): ViteResolvedConfig & { logged: string[] } => {
  const logged: string[] = [];

  return {
    root,
    command: 'build',
    mode: 'production',
    build: { outDir: 'dist', ssr: false },
    logger: { info: (message) => logged.push(message) },
    logged,
    ...overrides,
  };
};

const clientOf = (config: ViteResolvedConfig): ViteBuildContext => ({
  environment: { name: 'client', config },
});

const runHook = async (
  config: ViteResolvedConfig,
  context: ViteBuildContext = clientOf(config),
  error?: Error,
  prerender: ServerRouterPluginOptions['prerender'] = { entry: './entry.mjs' },
) => {
  const plugin = serverRouterPlugin(routerOf({ kind: 'notFound' }), {
    prerender,
  });

  plugin.configResolved(config);
  await plugin.closeBundle.handler.call(context, error);
};

const RESULT = 'tally: {}, pages: [], rules: [], warnings: [], delegated: []';

describe('serverRouterPlugin prerender build step', () => {
  it('hands the entry the outDir, the built index.html and a node:fs writer', async (t) => {
    const root = await buildRoot(
      t,
      `export default async ({ outDir, shellHtml, write }) => {
        await write(outDir + '/deep/page/index.html', shellHtml + '!');
        return { ${RESULT}, outDir };
      };`,
    );

    const config = configOf(root);
    await runHook(config);

    assert.equal(
      await readFile(path.join(root, 'dist/deep/page/index.html'), 'utf8'),
      '<main></main>!',
    );
    assert.match(config.logged[0] ?? '', /prerendered 0 files and 0 rules/);
  });

  it('takes the entry path as a string', async (t) => {
    const root = await buildRoot(
      t,
      `export default ({ outDir }) => ({ ${RESULT}, outDir });`,
    );

    const config = configOf(root);
    await runHook(config, clientOf(config), undefined, './entry.mjs');
    assert.match(config.logged[0] ?? '', /prerendered 0 files and 0 rules/);
  });

  it('definePrerender returns its argument', () => {
    const entry: PrerenderEntry = () => ({
      tally: {
        shell: 0,
        redirect: 0,
        notFound: 0,
        delegate: 0,
        response: 0,
        document: 0,
      },
      pages: [],
      rules: [],
      warnings: [],
      delegated: [],
    });

    assert.equal(definePrerender(entry), entry);
  });

  it('fails the build when a listed path matches no route', async (t) => {
    const root = await buildRoot(
      t,
      `export default () => ({ ${RESULT.replace('warnings: []', "warnings: ['/a', '/b']")} });`,
    );

    await assert.rejects(runHook(configOf(root)), /no route matched \/a, \/b/);
  });

  it('rejects an entry with no default export function', async (t) => {
    const root = await buildRoot(t, 'export const run = () => {};');
    await assert.rejects(
      runHook(configOf(root)),
      /has no default export function/,
    );
  });

  it('skips serve, SSR builds, other environments and failed builds', async (t) => {
    const root = await buildRoot(t, 'throw new Error("loaded");');
    await runHook(configOf(root, { command: 'serve' }));
    await runHook(configOf(root, { build: { outDir: 'dist', ssr: true } }));
    await runHook(configOf(root), {
      environment: { name: 'ssr', config: configOf(root) },
    });
    await runHook(configOf(root), undefined, new Error('build failed'));
    await assert.rejects(runHook(configOf(root)), /loaded/);
  });

  it("reads the client environment's config, not the last one resolved", async (t) => {
    const root = await buildRoot(
      t,
      `export default ({ outDir }) => ({ ${RESULT}, outDir });`,
    );

    const plugin = serverRouterPlugin(routerOf({ kind: 'notFound' }), {
      prerender: './entry.mjs',
    });

    const config = configOf(root);
    plugin.configResolved(config);
    plugin.configResolved(
      configOf('/nonexistent', { build: { outDir: 'ssr', ssr: true } }),
    );
    await plugin.closeBundle.handler.call(clientOf(config));
    assert.match(config.logged[0] ?? '', /prerendered 0 files and 0 rules/);
  });

  it('falls back to the resolved config without an environment', async (t) => {
    const root = await buildRoot(
      t,
      `export default ({ outDir }) => ({ ${RESULT}, outDir });`,
    );

    const config = configOf(root);
    await runHook(config, {});
    assert.match(config.logged[0] ?? '', /prerendered 0 files and 0 rules/);
  });

  it('does nothing without the prerender option', async () => {
    const plugin = serverRouterPlugin(routerOf({ kind: 'notFound' }));
    const config = configOf('/nonexistent');
    plugin.configResolved(config);
    await plugin.closeBundle.handler.call(clientOf(config));
  });

  it('previews the mount shell for a path the build wrote no page for', async () => {
    const plugin = serverRouterPlugin(
      routerOf({ kind: 'shell', mount: '/app' }),
      { prerender: { entry: './entry.mjs' } },
    );

    plugin.configResolved(configOf('/nonexistent'));
    const server = fakeServer();
    plugin.configurePreviewServer(server);

    const req = {
      url: '/app/about',
      method: 'GET',
      headers: { accept: 'text/html' },
    };

    const res = { writeHead: () => res, setHeader: () => res, end: () => res };

    await new Promise<void>((resolve) => {
      server.installed[0]?.(req, res, () => resolve());
    });
    assert.equal(req.url, '/app');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TestContext } from 'node:test';

import { createServerRouter, diagnoseMounts } from '../src/index.ts';
import type { MountConfig, ServerRouter, Verdict } from '../src/index.ts';
import type { ConnectMiddleware } from '../src/connect.ts';
import { serverRouterPlugin } from '../src/vite.ts';
import { stubDev } from './import-meta-env.ts';

const routerOf = (verdict: Verdict): ServerRouter => ({
  resolve: () => Promise.resolve(verdict),
});

// A fake Vite server that captures the middleware the plugin installs and the warnings it logs.
const fakeServer = () => {
  const installed: ConnectMiddleware[] = [];
  const warned: string[] = [];

  return {
    installed,
    warned,
    middlewares: { use: (mw: ConnectMiddleware) => installed.push(mw) },
    config: { logger: { warn: (message: string) => warned.push(message) } },
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
});

describe('serverRouterPlugin mount diagnostics', () => {
  const mounts = {
    '/app': { routes: [{ name: 'a', url: '/a' }] },
    '/served': { routes: [{ name: 'root', url: '' }] },
  } satisfies Record<string, MountConfig>;

  const pluginMessages = (router: ServerRouter) =>
    diagnoseMounts(router).map(
      ({ message }) => `ui-router-server: serverRouterPlugin: ${message}`,
    );

  const silenceConsole = (t: TestContext) =>
    t.mock.method(console, 'warn', () => {});

  it('logs each finding through the dev server logger once per router, and nothing in preview', (t) => {
    t.after(stubDev(false));
    const consoleWarn = silenceConsole(t);
    const router = createServerRouter({ mounts });
    const plugin = serverRouterPlugin(router);
    const preview = fakeServer();
    const dev = fakeServer();
    const restarted = fakeServer();

    plugin.configurePreviewServer(preview);
    plugin.configureServer(dev);
    plugin.configureServer(restarted);

    assert.deepEqual(preview.warned, []);
    assert.equal(pluginMessages(router).length, 1);
    assert.deepEqual(dev.warned, pluginMessages(router));
    assert.deepEqual(restarted.warned, []);
    assert.equal(consoleWarn.mock.callCount(), 0);
  });

  it('stays silent for a router built in development, which already warned', (t) => {
    const consoleWarn = silenceConsole(t);
    const server = fakeServer();

    serverRouterPlugin(createServerRouter({ mounts })).configureServer(server);

    assert.equal(consoleWarn.mock.callCount(), 1);
    assert.deepEqual(server.warned, []);
    assert.equal(server.installed.length, 1);
  });

  it('logs nothing for clean mounts', () => {
    const server = fakeServer();

    serverRouterPlugin(
      createServerRouter({ mounts: { '/served': mounts['/served'] } }),
    ).configureServer(server);

    assert.deepEqual(server.warned, []);
  });
});

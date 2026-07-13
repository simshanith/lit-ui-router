import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ServerRouter, Verdict } from '../src/index.ts';
import type { ConnectMiddleware } from '../src/connect.ts';
import { serverRouterPlugin } from '../src/vite.ts';

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
    assert.equal(typeof plugin.configureServer, 'function');
    assert.equal(typeof plugin.configurePreviewServer, 'function');
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
        writeHead: (s: number, headers?: unknown) => {
          status = s;
          location =
            (headers as { Location?: string } | undefined)?.Location ?? '';
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

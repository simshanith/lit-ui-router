import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Hono } from 'hono';

import type { ServerRouter, Verdict } from '../src/index.ts';
import { serverRouterHono } from '../src/hono.ts';

const routerOf = (verdict: Verdict): ServerRouter => ({
  resolve: () => Promise.resolve(verdict),
});

// The fetch globals shim shadows node's richer Response in the src graph;
// reach `.text()` through a cast rather than widening the shim for tests.
const bodyText = (res: Response): Promise<string> =>
  (res as unknown as { text(): Promise<string> }).text();

// A Hono app with the router middleware mounted before a sentinel fallthrough
// route, so a passed-through (`null`) verdict is observable as the sentinel.
const appWith = (verdict: Verdict, options = {}) => {
  const app = new Hono();
  app.use(
    '*',
    serverRouterHono(routerOf(verdict), {
      serveShell: (_mount, request) =>
        new Response(`shell:${new URL(request.url).pathname}`, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
      ...options,
    }),
  );
  app.all('*', (c) => c.text('downstream', 200));
  return app;
};

const navigate = (app: Hono, path: string) =>
  app.request(path, { headers: { accept: 'text/html' } });

describe('serverRouterHono', () => {
  it('answers a redirect verdict and never reaches downstream', async () => {
    const app = appWith({
      kind: 'redirect',
      mount: '/app',
      location: '/app/home',
      status: 302,
    });
    const res = await navigate(app, '/app/old?ref=email');
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Location'), '/app/home?ref=email');
  });

  it('answers a shell verdict via serveShell with the canonical Link', async () => {
    const app = appWith({ kind: 'shell', mount: '/app' });
    const res = await navigate(app, '/app/about');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Link'), '</app>; rel="canonical"');
    // serveShell got a request rewritten to the mount base.
    assert.equal(await bodyText(res), 'shell:/app');
  });

  it('answers a mount-owned miss with an honest 404', async () => {
    const app = appWith({ kind: 'notFound', mount: '/app' });
    const res = await navigate(app, '/app/nope');
    assert.equal(res.status, 404);
    assert.match(await bodyText(res), /404 Not Found — \/app/);
  });

  it('passes a mountless miss through to the downstream handler', async () => {
    const app = appWith({ kind: 'notFound' });
    const res = await navigate(app, '/elsewhere');
    assert.equal(res.status, 200);
    assert.equal(await bodyText(res), 'downstream');
  });

  it('passes a non-navigation request through to the downstream handler', async () => {
    const app = appWith({ kind: 'shell', mount: '/app' });
    // No text/html Accept: the default heuristic declines, so it falls through.
    const res = await app.request('/app/about', { headers: { accept: '*/*' } });
    assert.equal(res.status, 200);
    assert.equal(await bodyText(res), 'downstream');
  });
});

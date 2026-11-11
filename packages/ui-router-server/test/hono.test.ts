import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Hono } from 'hono';
import type { ExecutionContext } from 'hono';

import { createServerRouter } from '../src/index.ts';
import type { ServerRouter, Verdict } from '../src/index.ts';
import { delegateContext, serverRouterHono } from '../src/hono.ts';

const routerOf = (verdict: Verdict): ServerRouter => ({
  resolve: () => Promise.resolve(verdict),
});

const noShell = () => {
  throw new Error('serveShell must not be called');
};

// SAFETY: node's real Response, which the fetch globals shim shadows, has text().
const bodyText = (res: Response): Promise<string> =>
  (res as Response & { text(): Promise<string> }).text();

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

  it('puts the router in front of a bare Hono app.fetch, forwarding env and executionCtx', async () => {
    interface Bindings {
      queue: string[];
    }

    const ledger = new Hono<{ Bindings: Bindings }>();

    ledger.post('/app/claims/:id', async (c) => {
      const { state, params } = delegateContext(c.req.raw, 'ledger');
      c.env.queue.push(`${state}:${String(params.id)}:${await c.req.text()}`);

      return c.body(null, 202);
    });

    ledger.get('/app/ctx', (c) => c.text(String(c.executionCtx.props)));

    const app = new Hono<{ Bindings: Bindings }>();

    app.use(
      '*',
      serverRouterHono(
        routerOf({
          kind: 'delegate',
          mount: '/app',
          subpath: '/claims/7',
          delegate: 'ledger',
          state: 'claims',
          params: { id: '7' },
        }),
        { serveShell: noShell, delegates: { ledger: ledger.fetch } },
      ),
    );

    const queue: string[] = [];

    // SAFETY: Hono builds a real node Request, which the fetch globals shim shadows, and it takes a body.
    const res = await app.request(
      '/app/claims/7',
      {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: 'claim',
      } as RequestInit,
      { queue },
    );

    assert.equal(res.status, 202);
    assert.deepEqual(queue, ['claims:7:claim']);

    // SAFETY: a structural ExecutionContext; the delegate only reads it back.
    const executionCtx = {
      waitUntil: () => {},
      passThroughOnException: () => {},
      props: 'ctx-props',
    } as ExecutionContext;

    const withCtx = await app.request('/app/ctx', {}, { queue }, executionCtx);
    assert.equal(await bodyText(withCtx), 'ctx-props');
  });
});

describe('serverRouterHono under a base', () => {
  const app = new Hono();

  app.use(
    '*',
    serverRouterHono(
      createServerRouter({
        mounts: {
          '/': {
            routes: [
              { name: 'about', url: '/about' },
              { name: 'legacy', url: '/legacy', redirectTo: 'about' },
            ],
          },
        },
      }),
      {
        base: '/solar/',
        serveShell: (_mount, request) =>
          new Response(`shell:${new URL(request.url).pathname}`),
      },
    ),
  );
  app.all('*', (c) => c.text('downstream', 200));

  it('serves the shell at the base for a path under it', async () => {
    const res = await navigate(app, '/solar/about');
    assert.equal(await bodyText(res), 'shell:/solar/');
  });

  it('puts the base back on a redirect Location', async () => {
    const res = await navigate(app, '/solar/legacy');
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Location'), '/solar/about');
  });

  it('passes a request outside the base to the downstream handler', async () => {
    const res = await navigate(app, '/legacy');
    assert.equal(await bodyText(res), 'downstream');
  });
});

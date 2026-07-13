import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createServerRouter } from '../src/index.ts';
import type { ServerRouter, Verdict } from '../src/index.ts';
import { createFetchHandler } from '../src/fetch.ts';

// A router that answers every request with one fixed verdict — isolates the
// adapter's verdict -> response mechanics from the resolver under test.
const routerOf = (verdict: Verdict): ServerRouter => ({
  resolve: () => Promise.resolve(verdict),
});

// The fetch globals shim (fetch.globals.d.ts) declares only the surface the
// adapter touches; node's real Response has `.text()` at runtime, so reach it
// through a cast rather than widening the shim for tests.
const bodyText = (res: Response): Promise<string> =>
  (res as unknown as { text(): Promise<string> }).text();

const ORIGIN = 'https://example.test';
// A GET navigation is the default the middleware engages on.
const navigation = (path: string, init?: RequestInit): Request =>
  new Request(`${ORIGIN}${path}`, {
    method: 'GET',
    headers: { accept: 'text/html' },
    ...init,
  });

// Records the shell Request the adapter prepares, and returns a controllable
// raw asset Response for the adapter to wrap.
const shellSpy = (asset: Response) => {
  const calls: Array<{ mount: string; request: Request }> = [];
  return {
    calls,
    serveShell: (mount: string, request: Request) => {
      calls.push({ mount, request });
      return asset;
    },
  };
};

const noShell = () => {
  throw new Error('serveShell must not be called');
};

describe('createFetchHandler', () => {
  it('answers redirects 302 with the request search merged into the Location', async () => {
    const handler = createFetchHandler(
      routerOf({
        kind: 'redirect',
        mount: '/app',
        location: '/app/home',
        status: 302,
      }),
      { serveShell: noShell },
    );
    const res = await handler(navigation('/app/old?ref=email'));
    assert.ok(res);
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Location'), '/app/home?ref=email');
  });

  it('does not double-append search when the redirect target carries its own query', async () => {
    const handler = createFetchHandler(
      routerOf({
        kind: 'redirect',
        mount: '/app',
        location: '/app/home?tab=1',
        status: 302,
      }),
      { serveShell: noShell },
    );
    const res = await handler(navigation('/app/old?tab=2'));
    assert.ok(res);
    assert.equal(res.headers.get('Location'), '/app/home?tab=1');
  });

  it('drops the fragment before merging the request search', async () => {
    const handler = createFetchHandler(
      routerOf({
        kind: 'redirect',
        mount: '/app',
        location: '/app/home',
        status: 302,
      }),
      { serveShell: noShell },
    );
    const res = await handler(navigation('/app/old?ref=email#section'));
    assert.ok(res);
    assert.equal(res.headers.get('Location'), '/app/home?ref=email');
  });

  it('serves a plain shell with a canonical Link, from a request rewritten to the shell path', async () => {
    const asset = new Response('<html>shell</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html', ETag: '"v1"' },
    });
    const shell = shellSpy(asset);
    const handler = createFetchHandler(
      routerOf({ kind: 'shell', mount: '/app' }),
      { serveShell: shell.serveShell },
    );
    const res = await handler(navigation('/app/about'));
    assert.ok(res);
    // The host got a request at the mount base (default shellPath), same origin.
    assert.equal(shell.calls.length, 1);
    assert.equal(shell.calls[0].mount, '/app');
    assert.equal(shell.calls[0].request.url, `${ORIGIN}/app`);
    // The wrapped response carries the canonical Link and the asset's status/body.
    assert.equal(res.headers.get('Link'), '</app>; rel="canonical"');
    assert.equal(res.status, 200);
    assert.equal(await bodyText(res), '<html>shell</html>');
  });

  it('strips validators and relabels the status for a status’d shell', async () => {
    // The asset layer answers a full 200 body (validators are gone).
    const asset = new Response('<html>not found</html>', { status: 200 });
    const shell = shellSpy(asset);
    const handler = createFetchHandler(
      routerOf({ kind: 'shell', mount: '/app', status: 404 }),
      { serveShell: shell.serveShell },
    );
    const res = await handler(
      navigation('/app/missing', {
        headers: {
          accept: 'text/html',
          'If-None-Match': '"abc"',
          'If-Modified-Since': 'yesterday',
        },
      }),
    );
    assert.ok(res);
    // Conditional validators stripped from the shell request the host fetches.
    const shellRequest = shell.calls[0].request;
    assert.equal(shellRequest.headers.get('If-None-Match'), null);
    assert.equal(shellRequest.headers.get('If-Modified-Since'), null);
    // No canonical Link for an error representation; status relabeled to 404.
    assert.equal(res.headers.get('Link'), null);
    assert.equal(res.status, 404);
    assert.equal(await bodyText(res), '<html>not found</html>');
  });

  it('leaves the incoming request’s validators intact on a plain shell (deep-links still 304)', async () => {
    // A real 304 carries no body (undici enforces the null-body status).
    const asset = new Response(null, { status: 304 });
    const shell = shellSpy(asset);
    const handler = createFetchHandler(
      routerOf({ kind: 'shell', mount: '/app' }),
      { serveShell: shell.serveShell },
    );
    const res = await handler(
      navigation('/app/about', {
        headers: { accept: 'text/html', 'If-None-Match': '"v1"' },
      }),
    );
    assert.ok(res);
    // A plain shell carries the conditional header through, so the asset layer
    // can answer 304 — which the adapter passes unrelabeled.
    assert.equal(shell.calls[0].request.headers.get('If-None-Match'), '"v1"');
    assert.equal(res.status, 304);
  });

  it('answers a mount-owned miss with an honest 404', async () => {
    const handler = createFetchHandler(
      routerOf({ kind: 'notFound', mount: '/app' }),
      { serveShell: noShell },
    );
    const res = await handler(navigation('/app/nope'));
    assert.ok(res);
    assert.equal(res.status, 404);
    assert.match(await bodyText(res), /404 Not Found — \/app/);
  });

  it('sends no 404 body for a HEAD miss', async () => {
    const handler = createFetchHandler(
      routerOf({ kind: 'notFound', mount: '/app' }),
      { serveShell: noShell },
    );
    const res = await handler(navigation('/app/nope', { method: 'HEAD' }));
    assert.ok(res);
    assert.equal(res.status, 404);
    assert.equal(await bodyText(res), '');
  });

  it('passes a mountless miss straight through as null', async () => {
    const handler = createFetchHandler(routerOf({ kind: 'notFound' }), {
      serveShell: noShell,
    });
    const res = await handler(navigation('/elsewhere'));
    assert.equal(res, null);
  });

  it('never judges non-navigation requests (module and asset fetches pass as null)', async () => {
    const handler = createFetchHandler(
      routerOf({ kind: 'shell', mount: '/app' }),
      { serveShell: noShell },
    );
    // A module fetch on a route-shaped path: Accept: */*.
    const res = await handler(
      navigation('/app/about', { headers: { accept: '*/*' } }),
    );
    assert.equal(res, null);
  });

  it('honours shellPath and shouldHandle overrides', async () => {
    const asset = new Response('<html>shell</html>', { status: 200 });
    const shell = shellSpy(asset);
    const handler = createFetchHandler(
      routerOf({ kind: 'shell', mount: '/app' }),
      {
        serveShell: shell.serveShell,
        shellPath: (mount) => `${mount}/index.html`,
        shouldHandle: () => true,
      },
    );
    // A non-navigation POST the default heuristic would skip.
    const res = await handler(
      new Request(`${ORIGIN}/app/deep`, { method: 'POST', headers: {} }),
    );
    assert.ok(res);
    assert.equal(shell.calls[0].request.url, `${ORIGIN}/app/index.html`);
  });

  it('routes real createServerRouter verdicts end to end', async () => {
    const router = createServerRouter({
      mounts: {
        '/app': {
          routes: [
            { name: 'home', url: '' },
            { name: 'about', url: '/about' },
            { name: 'missing' },
          ],
          redirects: [{ pattern: '/legacy', to: { state: 'about' } }],
          otherwise: { state: 'missing' },
        },
      },
    });
    const shell = shellSpy(new Response('<html>shell</html>', { status: 200 }));
    const handler = createFetchHandler(router, {
      serveShell: shell.serveShell,
    });

    // A matched route -> shell at the mount base, canonical Link.
    {
      const res = await handler(navigation('/app/about'));
      assert.ok(res);
      assert.equal(shell.calls.at(-1)?.request.url, `${ORIGIN}/app`);
      assert.equal(res.headers.get('Link'), '</app>; rel="canonical"');
    }
    // A redirect rule -> 302.
    {
      const res = await handler(navigation('/app/legacy'));
      assert.ok(res);
      assert.equal(res.status, 302);
    }
    // An unknown path under a mount with `otherwise` -> status'd 404 shell.
    {
      const res = await handler(navigation('/app/ghost'));
      assert.ok(res);
      assert.equal(res.status, 404);
      assert.equal(res.headers.get('Link'), null);
    }
  });
});

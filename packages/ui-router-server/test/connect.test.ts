import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createServerRouter } from '../src/index.ts';
import type { ServerRouter, Verdict } from '../src/index.ts';
import { createConnectMiddleware } from '../src/connect.ts';
import type { ConnectRequest, ConnectResponse } from '../src/connect.ts';

// A router that answers every request with one fixed verdict — isolates the
// adapter's verdict → response mechanics from the resolver under test.
const routerOf = (verdict: Verdict): ServerRouter => ({
  resolve: () => Promise.resolve(verdict),
});

interface Harness {
  req: ConnectRequest;
  res: ConnectResponse;
  next: (...args: unknown[]) => void;
  // Resolves the moment the request is answered (res.end) or passed (next).
  done: Promise<void>;
  writeHead: Array<{ status: number; rest: unknown[] }>;
  headers: Record<string, string>;
  ended: boolean;
  body?: string;
  nextArgs: unknown[][];
}

// Builds a req/res/next triple that records everything the middleware touches.
// Headers default to a GET navigation so the middleware engages.
const harness = (overrides: Partial<ConnectRequest> = {}): Harness => {
  let settle!: () => void;
  const h: Harness = {
    req: {
      url: '/app/about',
      method: 'GET',
      headers: { accept: 'text/html' },
      ...overrides,
    },
    res: {
      writeHead(status: number, ...rest: unknown[]) {
        h.writeHead.push({ status, rest });
        return h.res;
      },
      setHeader(name: string, value: string) {
        h.headers[name] = value;
        return h.res;
      },
      end(body?: string) {
        h.ended = true;
        h.body = body;
        settle();
        return h.res;
      },
    },
    next: (...args: unknown[]) => {
      h.nextArgs.push(args);
      settle();
    },
    done: new Promise<void>((resolve) => {
      settle = resolve;
    }),
    writeHead: [],
    headers: {},
    ended: false,
    nextArgs: [],
  };
  return h;
};

const CANONICAL_APP = '</app>; rel="canonical"';

describe('createConnectMiddleware', () => {
  it('answers redirects 302 with the request search merged into the Location', async () => {
    const mw = createConnectMiddleware(
      routerOf({
        kind: 'redirect',
        mount: '/app',
        location: '/app/home',
        status: 302,
      }),
    );
    const h = harness({ url: '/app/old?ref=email' });
    mw(h.req, h.res, h.next);
    await h.done;
    assert.deepEqual(h.writeHead, [
      { status: 302, rest: [{ Location: '/app/home?ref=email' }] },
    ]);
    assert.equal(h.ended, true);
    assert.equal(h.nextArgs.length, 0);
  });

  it('does not double-append search when the redirect target carries its own query', async () => {
    const mw = createConnectMiddleware(
      routerOf({
        kind: 'redirect',
        mount: '/app',
        location: '/app/home?tab=1',
        status: 302,
      }),
    );
    const h = harness({ url: '/app/old?tab=2' });
    mw(h.req, h.res, h.next);
    await h.done;
    const location = (h.writeHead[0].rest[0] as { Location: string }).Location;
    assert.equal(location, '/app/home?tab=1');
  });

  it('serves a plain shell with a canonical Link and rewrites req.url into the static layer', async () => {
    const mw = createConnectMiddleware(
      routerOf({ kind: 'shell', mount: '/app' }),
    );
    const h = harness({ url: '/app/about' });
    mw(h.req, h.res, h.next);
    await h.done;
    assert.equal(h.headers.Link, CANONICAL_APP);
    assert.equal(h.req.url, '/app'); // default shellPath = mount base
    assert.equal(h.nextArgs.length, 1);
    assert.equal(h.ended, false); // the static layer ends it
  });

  it('strips validators and relabels the downstream status for a status’d shell', async () => {
    const mw = createConnectMiddleware(
      routerOf({ kind: 'shell', mount: '/app', status: 404 }),
    );
    const h = harness({
      url: '/app/missing',
      headers: {
        accept: 'text/html',
        'if-none-match': '"abc"',
        'if-modified-since': 'yesterday',
      },
    });
    mw(h.req, h.res, h.next);
    await h.done;
    // No canonical Link for an error representation.
    assert.equal(h.headers.Link, undefined);
    // Conditional validators gone so the assets fetch answers a full body.
    assert.equal(h.req.headers['if-none-match'], undefined);
    assert.equal(h.req.headers['if-modified-since'], undefined);
    assert.equal(h.nextArgs.length, 1);
    // The downstream 200 is relabeled to the verdict's 404; a 304 passes.
    h.res.writeHead(200, { 'Content-Type': 'text/html' });
    h.res.writeHead(304);
    assert.deepEqual(
      h.writeHead.map((call) => call.status),
      [404, 304],
    );
  });

  it('answers a mount-owned miss with an honest 404', async () => {
    const mw = createConnectMiddleware(
      routerOf({ kind: 'notFound', mount: '/app' }),
    );
    const h = harness({ url: '/app/nope' });
    mw(h.req, h.res, h.next);
    await h.done;
    assert.equal(h.writeHead[0].status, 404);
    assert.match(h.body ?? '', /404 Not Found — \/app/);
    assert.equal(h.nextArgs.length, 0);
  });

  it('sends no 404 body for a HEAD miss', async () => {
    const mw = createConnectMiddleware(
      routerOf({ kind: 'notFound', mount: '/app' }),
    );
    const h = harness({ url: '/app/nope', method: 'HEAD' });
    mw(h.req, h.res, h.next);
    await h.done;
    assert.equal(h.writeHead[0].status, 404);
    assert.equal(h.body, undefined);
  });

  it('passes a mountless miss straight through', async () => {
    const mw = createConnectMiddleware(routerOf({ kind: 'notFound' }));
    const h = harness({ url: '/elsewhere' });
    mw(h.req, h.res, h.next);
    await h.done;
    assert.equal(h.nextArgs.length, 1);
    assert.equal(h.writeHead.length, 0);
    assert.equal(h.ended, false);
  });

  it('never judges non-navigation requests (module and asset fetches pass)', async () => {
    const mw = createConnectMiddleware(
      routerOf({ kind: 'shell', mount: '/app' }),
    );
    // A Vite module fetch on a route-shaped path: Accept: */*.
    const h = harness({ url: '/app/about', headers: { accept: '*/*' } });
    mw(h.req, h.res, h.next);
    await h.done;
    assert.equal(h.nextArgs.length, 1);
    assert.equal(h.req.url, '/app/about'); // untouched, not rewritten
    assert.equal(h.headers.Link, undefined);
  });

  it('honours shellPath and shouldHandle overrides', async () => {
    const mw = createConnectMiddleware(
      routerOf({ kind: 'shell', mount: '/app' }),
      {
        shellPath: (mount) => `${mount}/index.html`,
        shouldHandle: () => true,
      },
    );
    // A non-navigation POST the default heuristic would skip.
    const h = harness({ url: '/app/deep', method: 'POST', headers: {} });
    mw(h.req, h.res, h.next);
    await h.done;
    assert.equal(h.req.url, '/app/index.html');
    assert.equal(h.nextArgs.length, 1);
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
    const mw = createConnectMiddleware(router);

    // A matched route → shell, rewritten to the mount base.
    {
      const h = harness({ url: '/app/about' });
      mw(h.req, h.res, h.next);
      await h.done;
      assert.equal(h.req.url, '/app');
      assert.equal(h.headers.Link, CANONICAL_APP);
    }
    // A redirect rule → 302.
    {
      const h = harness({ url: '/app/legacy' });
      mw(h.req, h.res, h.next);
      await h.done;
      assert.equal(h.writeHead[0].status, 302);
    }
    // An unknown path under a mount with `otherwise` → status’d 404 shell.
    {
      const h = harness({ url: '/app/ghost' });
      mw(h.req, h.res, h.next);
      await h.done;
      assert.equal(h.req.url, '/app'); // shell rewrite
      h.res.writeHead(200);
      assert.equal(h.writeHead.at(-1)?.status, 404); // relabeled
    }
  });
});

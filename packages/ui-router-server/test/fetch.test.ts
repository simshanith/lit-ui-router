import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { TransitionService } from '@uirouter/core';

import { registeredDelegates } from '../src/delegate-registry.ts';
import { createServerRouter } from '../src/index.ts';
import type { ServerRouter, Verdict } from '../src/index.ts';
import { createFetchHandler, delegateContext } from '../src/fetch.ts';
import type {
  DelegateContext,
  DelegateHandler,
  FetchAdapterOptions,
} from '../src/fetch.ts';

// A router that answers every request with one fixed verdict — isolates the
// adapter's verdict -> response mechanics from the resolver under test.
const routerOf = (verdict: Verdict): ServerRouter => ({
  resolve: () => Promise.resolve(verdict),
});

// SAFETY: node's real Response, which the fetch globals shim shadows, has text().
const bodyText = (res: Response): Promise<string> =>
  (res as Response & { text(): Promise<string> }).text();

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

  // The other direction: the fragment belongs to the TARGET, not the request.
  // Merging past it emitted `/app/home#section?ref=email`, where the agent
  // reads `section?ref=email` as the fragment and the params never come back.
  it('keeps the merged search ahead of a fragment the target declares', async () => {
    const handler = createFetchHandler(
      routerOf({
        kind: 'redirect',
        mount: '/app',
        location: '/app/home#section',
        status: 302,
      }),
      { serveShell: noShell },
    );

    const res = await handler(navigation('/app/old?ref=email'));
    assert.ok(res);
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Location'), '/app/home?ref=email#section');
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

const claimsVerdict: Verdict = {
  kind: 'delegate',
  mount: '/app',
  subpath: '/claims/7',
  delegate: 'ledger',
  state: 'claims',
  params: { id: '7' },
};

// SAFETY: node's real Request, which the fetch globals shim shadows, takes a body.
const post = (path: string, body: string): Request =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'text/plain' },
    body,
  } as RequestInit);

// SAFETY: node's real Request, which the fetch globals shim shadows, has text().
const requestText = (req: Request): Promise<string> =>
  (req as Request & { text(): Promise<string> }).text();

describe('createFetchHandler delegates', () => {
  it('hands any request to the mapped handler and returns its Response untouched', async () => {
    const calls: Array<{
      request: Request;
      context: DelegateContext<'ledger'>;
    }> = [];

    const accepted = new Response('queued', {
      status: 202,
      headers: { 'x-ledger': '1' },
    });

    const handler = createFetchHandler(routerOf(claimsVerdict), {
      serveShell: noShell,
      delegates: {
        ledger: (request) => {
          calls.push({ request, context: delegateContext(request, 'ledger') });

          return accepted;
        },
      },
    });

    const request = post('/app/claims/7', 'claim');
    const res = await handler(request);
    assert.equal(res, accepted);
    assert.equal(accepted.headers.get('Link'), null);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].request, request);
    assert.equal(await requestText(calls[0].request), 'claim');
    assert.deepEqual(calls[0].context, {
      mount: '/app',
      subpath: '/claims/7',
      delegate: 'ledger',
      state: 'claims',
      params: { id: '7' },
    });

    // A navigation that matches a delegating state delegates too.
    assert.equal(await handler(navigation('/app/claims/7')), accepted);
  });

  it('forwards the arguments after the request to the delegate, fetch-shaped', async () => {
    interface Env {
      QUEUE: string[];
    }

    interface Ctx {
      waitUntil(promise: Promise<unknown>): void;
    }

    const seen: Array<[Env, Ctx]> = [];

    // A Worker-style fetch, passed bare.
    const ledger = {
      fetch: (_request: Request, env: Env, ctx: Ctx): Response => {
        seen.push([env, ctx]);

        return new Response(null, { status: 202 });
      },
    };

    const handler = createFetchHandler(routerOf(claimsVerdict), {
      serveShell: noShell,
      delegates: { ledger: ledger.fetch },
    });

    const env: Env = { QUEUE: [] };
    const ctx: Ctx = { waitUntil: () => {} };
    const res = await handler(post('/app/claims', ''), env, ctx);
    assert.equal(res?.status, 202);
    assert.equal(seen.length, 1);
    assert.equal(seen[0][0], env);
    assert.equal(seen[0][1], ctx);
  });

  it('passes a non-navigation request that matches no delegating state as null', async () => {
    const handler = createFetchHandler(
      routerOf({ kind: 'shell', mount: '/app' }),
      { serveShell: noShell, delegates: {} },
    );

    assert.equal(await handler(post('/app/about', '')), null);
  });

  it('never resolves non-navigation requests without delegates', async () => {
    const handler = createFetchHandler(
      { resolve: () => Promise.reject(new Error('resolved')) },
      { serveShell: noShell },
    );

    assert.equal(await handler(post('/app/claims', '')), null);
  });

  it('throws at construction for a key the router names but delegates lacks', () => {
    const router = createServerRouter({
      mounts: {
        '/app': {
          routes: [{ name: 'claims', url: '/claims', delegate: 'ledger' }],
        },
      },
    });

    const unmapped: Array<FetchAdapterOptions['delegates']> = [
      undefined,
      {},
      { other: noShell },
    ];

    for (const delegates of unmapped)
      assert.throws(
        () => createFetchHandler(router, { serveShell: noShell, delegates }),
        /No handler in delegates for delegate key 'ledger'/,
      );
  });

  it('throws at match for a structural router whose verdict names an unmapped key', async () => {
    // SAFETY: Object.create's result is an object whose only key is the inherited handler.
    const inherited = Object.create({ ledger: noShell }) as Record<
      string,
      DelegateHandler
    >;

    const handler = createFetchHandler(routerOf(claimsVerdict), {
      serveShell: noShell,
      // An inherited key is not a mapping.
      delegates: inherited,
    });

    await assert.rejects(
      handler(post('/app/claims', '')),
      /No handler in delegates for delegate key 'ledger'/,
    );
  });

  it('propagates a throwing handler to the host', async () => {
    const handler = createFetchHandler(routerOf(claimsVerdict), {
      serveShell: noShell,
      delegates: {
        ledger: () => Promise.reject(new Error('ledger down')),
      },
    });

    await assert.rejects(handler(post('/app/claims', '')), /ledger down/);
  });

  it('routes real createServerRouter delegate verdicts end to end', async () => {
    const router = createServerRouter({
      mounts: {
        '/app': {
          routes: [
            { name: 'about', url: '/about' },
            { name: 'claims', url: '/claims/:id', delegate: 'ledger' },
          ],
        },
      },
    });

    const shell = shellSpy(new Response('<html>shell</html>', { status: 200 }));

    const handler = createFetchHandler(router, {
      serveShell: shell.serveShell,
      delegates: {
        ledger: (request) =>
          new Response(String(delegateContext(request, 'ledger').params.id), {
            status: 202,
          }),
      },
    });

    const res = await handler(post('/app/claims/9', ''));
    assert.ok(res);
    assert.equal(res.status, 202);
    assert.equal(await bodyText(res), '9');
    assert.equal(await handler(post('/app/about', '')), null);
    assert.equal((await handler(navigation('/app/about')))?.status, 200);
  });
});

describe('createFetchHandler delegate work', () => {
  const routes = [
    { name: 'about', url: '/about' },
    { name: 'claims', url: '/claims/:id', delegate: 'ledger' },
  ];

  const asset = (path: string): Request =>
    new Request(`${ORIGIN}${path}`, { headers: { accept: '*/*' } });

  const transitionsDuring = async (work: () => Promise<void>) => {
    const create = mock.method(TransitionService.prototype, 'create');

    try {
      await work();

      return create.mock.callCount();
    } finally {
      create.mock.restore();
    }
  };

  it('matches non-navigations on a simulate mount without starting a transition', async () => {
    const router = createServerRouter({
      mounts: { '/app': { routes, strategy: 'simulate' } },
    });

    const handler = createFetchHandler(router, {
      serveShell: () => new Response('shell'),
      delegates: { ledger: () => new Response(null, { status: 202 }) },
    });

    const nonNavigations = await transitionsDuring(async () => {
      assert.equal(await handler(asset('/app/about')), null);
      assert.equal(await handler(asset('/app/missing.js')), null);
      assert.equal((await handler(post('/app/claims/9', '')))?.status, 202);
    });

    assert.equal(nonNavigations, 0);

    const navigations = await transitionsDuring(async () => {
      await handler(navigation('/app/about'));
    });

    assert.equal(navigations, 1);
  });

  it('never resolves or matches a non-navigation when the router names no keys', async () => {
    const router = createServerRouter({
      mounts: { '/app': { routes: [{ name: 'about', url: '/about' }] } },
    });

    const registration = registeredDelegates(router);
    assert.ok(registration);
    const resolve = mock.method(router, 'resolve');
    const delegateFor = mock.method(registration, 'delegateFor');

    const handler = createFetchHandler(router, {
      serveShell: noShell,
      delegates: { ledger: noShell },
    });

    assert.equal(await handler(asset('/app/about')), null);
    assert.equal(await handler(post('/app/about', '')), null);
    assert.equal(resolve.mock.callCount(), 0);
    assert.equal(delegateFor.mock.callCount(), 0);
  });

  it('hands the delegate the in-mount subpath with the original request', async () => {
    const router = createServerRouter({ mounts: { '/app': { routes } } });
    const seen: Array<[Request, string]> = [];

    const handler = createFetchHandler(router, {
      serveShell: noShell,
      delegates: {
        ledger: (request) => {
          seen.push([request, delegateContext(request, 'ledger').subpath]);

          return new Response(null, { status: 202 });
        },
      },
    });

    const request = post('/app/claims/9?draft=1', '');
    await handler(request);
    assert.deepEqual(seen, [[request, '/claims/9']]);
  });
});

describe('delegateContext', () => {
  const delegated = async (key: string): Promise<Request> => {
    const request = post('/app/claims', '');

    const handler = createFetchHandler(routerOf(claimsVerdict), {
      serveShell: noShell,
      delegates: { [key]: () => new Response(null, { status: 202 }) },
    });

    await handler(request);

    return request;
  };

  it('throws for a request the adapter never delegated', () => {
    assert.throws(
      () => delegateContext(post('/app/claims', ''), 'ledger'),
      /this request was not delegated \(expected 'ledger'\)/,
    );
  });

  it('throws for a request delegated to another key', async () => {
    const request = await delegated('ledger');

    assert.throws(
      () => delegateContext(request, 'badge'),
      /delegated to 'ledger', not 'badge'/,
    );
  });

  it('checks the request came through the router it is given', async () => {
    const routes = [{ name: 'claims', url: '/claims', delegate: 'ledger' }];
    const router = createServerRouter({ mounts: { '/app': { routes } } });
    const other = createServerRouter({ mounts: { '/app': { routes } } });
    const request = post('/app/claims', '');

    await createFetchHandler(router, {
      serveShell: noShell,
      delegates: { ledger: () => new Response(null, { status: 202 }) },
    })(request);

    assert.equal(delegateContext(request, 'ledger', router).state, 'claims');
    assert.throws(
      () => delegateContext(request, 'ledger', other),
      /delegated by a handler built from another router/,
    );
  });

  it('has no context on a clone: it is keyed by the Request object', async () => {
    const request = await delegated('ledger');
    assert.equal(delegateContext(request, 'ledger').state, 'claims');

    // SAFETY: node's real Request, which the fetch globals shim shadows, has clone().
    const clone = (request as Request & { clone(): Request }).clone();

    assert.throws(() => delegateContext(clone, 'ledger'), /was not delegated/);
    assert.throws(
      () => delegateContext(new Request(request.url, request), 'ledger'),
      /was not delegated/,
    );
  });
});

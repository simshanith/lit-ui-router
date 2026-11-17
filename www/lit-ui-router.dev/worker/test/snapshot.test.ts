import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import worker from '../index.ts';
import { serveSnapshot, snapshotOf } from '../snapshot.ts';

const ORIGIN = 'http://docs.test';

/** A stand-in for the snapshot Worker's binding that records what it was handed. */
function fakeBinding(answer: (request: Request) => Promise<Response>) {
  const seen: Request[] = [];

  return {
    seen,
    binding: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);

        seen.push(request);

        return answer(request);
      },
    },
  };
}

describe('snapshotOf', () => {
  it('claims each bare prefix and its subpaths only', () => {
    assert.equal(snapshotOf('/v1'), 'v1');
    assert.equal(snapshotOf('/v1/'), 'v1');
    assert.equal(snapshotOf('/v1/guides/route-guards'), 'v1');
    assert.equal(snapshotOf('/main'), 'main');
    assert.equal(snapshotOf('/main/'), 'main');
    assert.equal(snapshotOf('/main/guides/route-guards'), 'main');

    for (const path of [
      '/',
      '/v10/',
      '/v1-notes',
      '/guides/v1/',
      '/maintenance',
      '/main-branch/',
      '/guides/main/',
      '/toString/',
    ])
      assert.equal(snapshotOf(path), undefined, path);
  });
});

describe('serveSnapshot', () => {
  it('hands the request over unchanged and returns the answer as is', async () => {
    const { seen, binding } = fakeBinding(() =>
      Promise.resolve(
        new Response(null, { status: 304, headers: { ETag: '"a"' } }),
      ),
    );

    const request = new Request(`${ORIGIN}/v1/assets/app.js?x=1`, {
      method: 'HEAD',
      headers: { 'If-None-Match': '"a"', Accept: 'text/javascript' },
    });

    const response = await serveSnapshot(request, 'v1', binding);

    assert.equal(response.status, 304);
    assert.equal(response.headers.get('ETag'), '"a"');
    assert.equal(seen.length, 1);

    const [handed] = seen;

    assert.equal(handed?.url, `${ORIGIN}/v1/assets/app.js?x=1`);
    assert.equal(handed?.method, 'HEAD');
    assert.equal(handed?.headers.get('If-None-Match'), '"a"');
    assert.equal(handed?.headers.get('Accept'), 'text/javascript');
  });

  it("passes the snapshot's redirects and 404 page through", async () => {
    for (const status of [301, 404]) {
      const { binding } = fakeBinding(() =>
        Promise.resolve(new Response('snapshot', { status })),
      );

      const response = await serveSnapshot(
        new Request(`${ORIGIN}/v1/x`),
        'v1',
        binding,
      );

      assert.equal(response.status, status);
      assert.equal(await response.text(), 'snapshot');
    }
  });

  it('answers a plain 503 without a binding, on a thrown fetch, and on a 5xx', async () => {
    const failing = [
      undefined,
      fakeBinding(() => Promise.reject(new Error('no such service'))).binding,
      fakeBinding(() =>
        Promise.resolve(new Response('worker error', { status: 500 })),
      ).binding,
    ];

    for (const binding of failing) {
      const response = await serveSnapshot(
        new Request(`${ORIGIN}/v1/guides/`),
        'v1',
        binding,
      );

      assert.equal(response.status, 503);
      assert.match(response.headers.get('Content-Type') ?? '', /^text\/plain/);
      assert.equal(
        await response.text(),
        'The 1.x docs are unavailable right now.\n',
      );
    }
  });

  it('names the snapshot its 503 stands in for', async () => {
    const response = await serveSnapshot(
      new Request(`${ORIGIN}/main/`),
      'main',
      undefined,
    );

    assert.equal(response.status, 503);
    assert.equal(
      await response.text(),
      'The unreleased docs are unavailable right now.\n',
    );
  });
});

describe('the docs worker', () => {
  it('hands /v1 and every /v1/ path to the snapshot binding', async () => {
    const { seen, binding } = fakeBinding((request) =>
      Promise.resolve(new Response(new URL(request.url).pathname)),
    );

    // SAFETY: a /v1 request reads only the snapshot binding.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- a one-binding object shares too few members with Env for one assertion
    const env = { DOCS_V1: binding } as unknown as Env;

    // SAFETY: a /v1 request never touches the context.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- an empty object shares no members with ExecutionContext
    const ctx = {} as unknown as ExecutionContext;

    for (const path of ['/v1', '/v1/', '/v1/releases/']) {
      const response = await worker.fetch(
        new Request(`${ORIGIN}${path}`),
        env,
        ctx,
      );

      assert.equal(await response.text(), path);
    }

    assert.equal(seen.length, 3);
  });

  it('hands /main and every /main/ path to its own binding, and answers 503 without one', async () => {
    const v1 = fakeBinding(() => Promise.resolve(new Response('v1')));

    const main = fakeBinding((request) =>
      Promise.resolve(new Response(new URL(request.url).pathname)),
    );

    // SAFETY: a /main request never touches the context.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- an empty object shares no members with ExecutionContext
    const ctx = {} as unknown as ExecutionContext;

    // SAFETY: a /main request reads only the snapshot bindings.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- a two-binding object shares too few members with Env for one assertion
    const bound = {
      DOCS_V1: v1.binding,
      DOCS_MAIN: main.binding,
    } as unknown as Env;

    // SAFETY: as above, without the binding, as a deploy that lacks it would run.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- a one-binding object shares too few members with Env for one assertion
    const unbound = { DOCS_V1: v1.binding } as unknown as Env;

    for (const path of ['/main', '/main/', '/main/releases/']) {
      const url = `${ORIGIN}${path}`;
      const handed = await worker.fetch(new Request(url), bound, ctx);
      const missing = await worker.fetch(new Request(url), unbound, ctx);

      assert.equal(await handed.text(), path);
      assert.equal(missing.status, 503, path);
    }

    assert.equal(main.seen.length, 3);
    assert.equal(v1.seen.length, 0);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import worker from '../index.ts';
import { isSnapshotPath, serveSnapshot } from '../snapshot.ts';

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

describe('isSnapshotPath', () => {
  it('claims the bare prefix and its subpaths only', () => {
    assert.ok(isSnapshotPath('/v1'));
    assert.ok(isSnapshotPath('/v1/'));
    assert.ok(isSnapshotPath('/v1/guides/route-guards'));
    assert.ok(!isSnapshotPath('/v10/'));
    assert.ok(!isSnapshotPath('/v1-notes'));
    assert.ok(!isSnapshotPath('/guides/v1/'));
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

    const response = await serveSnapshot(request, binding);

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
        binding,
      );

      assert.equal(response.status, 503);
      assert.match(response.headers.get('Content-Type') ?? '', /^text\/plain/);
      assert.match(await response.text(), /1\.x docs are unavailable/);
    }
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
});

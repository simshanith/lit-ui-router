import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Effect } from 'effect';
import {
  FetchHttpClient,
  HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from 'effect/http';

import {
  isGitHubRateLimit,
  listTags,
  ObservationError,
  requestedWait,
} from './observe.ts';

const NOW = Date.parse('2026-10-18T00:00:00.000Z');

const ENV = { OIDC_REPOSITORY: 'simshanith/lit-ui-router' };

const REFS = [{ ref: 'refs/tags/pkg@1.0.0', object: { sha: 'abc' } }];

const response = (status: number, headers: Record<string, string> = {}) =>
  new Response(status === 200 ? JSON.stringify(REFS) : '{}', {
    status,
    headers,
  });

const limited = (status: number, headers: Record<string, string> = {}) =>
  HttpClientResponse.fromWeb(
    HttpClientRequest.get('https://api.github.test'),
    response(status, headers),
  );

const statusError = (status: number, headers: Record<string, string> = {}) => {
  const failed = limited(status, headers);

  return new HttpClientError.HttpClientError({
    reason: new HttpClientError.StatusCodeError({
      request: failed.request,
      response: failed,
    }),
  });
};

describe('requestedWait', () => {
  it('reads Retry-After as seconds or an HTTP date', () => {
    const at = new Date(NOW + 90_000).toUTCString();

    assert.equal(
      requestedWait(limited(429, { 'retry-after': '120' }), NOW),
      120,
    );
    assert.equal(requestedWait(limited(429, { 'retry-after': at }), NOW), 90);
  });

  it("waits for GitHub's primary limit to reset", () => {
    const headers = {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(NOW / 1000 + 300),
    };

    assert.equal(requestedWait(limited(403, headers), NOW), 300);
  });

  it('asks for nothing without a hint', () => {
    assert.equal(requestedWait(limited(429), NOW), undefined);
    assert.equal(
      requestedWait(limited(403, { 'x-ratelimit-remaining': '12' }), NOW),
      undefined,
    );
  });
});

describe('isGitHubRateLimit', () => {
  it("takes GitHub's primary and secondary limit 403s as transient", () => {
    assert.ok(isGitHubRateLimit(statusError(403, { 'retry-after': '60' })));
    assert.ok(
      isGitHubRateLimit(statusError(403, { 'x-ratelimit-remaining': '0' })),
    );
  });

  it('leaves a plain 403 final', () => {
    assert.ok(!isGitHubRateLimit(statusError(403)));
    assert.ok(
      !isGitHubRateLimit(statusError(403, { 'x-ratelimit-remaining': '12' })),
    );
  });
});

describe('fetches', () => {
  /** Answers each call with the next response; counts the calls. */
  function answering(...responses: (Response | Error)[]) {
    const calls = { count: 0 };

    const fetch: typeof globalThis.fetch = () => {
      const next = responses[Math.min(calls.count, responses.length - 1)];

      calls.count += 1;

      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next ?? response(500));
    };

    const run = () =>
      Effect.runPromise(
        Effect.result(listTags(ENV)).pipe(
          Effect.provide(FetchHttpClient.layer),
          Effect.provideService(FetchHttpClient.Fetch, fetch),
        ),
      );

    return { calls, run };
  }

  it('retries a 429, a network failure and a 5xx, then answers', async () => {
    const { calls, run } = answering(
      response(429),
      new Error('connection reset'),
      response(200),
    );

    const result = await run();

    assert.equal(calls.count, 3);
    assert.deepEqual(result._tag === 'Success' && result.success, REFS);
  });

  it("retries GitHub's secondary limit after its Retry-After", async () => {
    const { calls, run } = answering(
      response(403, { 'retry-after': '0' }),
      response(200),
    );

    const result = await run();

    assert.equal(calls.count, 2);
    assert.equal(result._tag, 'Success');
  });

  it('answers a 404 as absent and fails a plain 403 without retrying', async () => {
    const absent = answering(response(404));

    const none = await absent.run();

    assert.deepEqual(none._tag === 'Success' && none.success, []);
    assert.equal(absent.calls.count, 1);

    const forbidden = answering(response(403));
    const result = await forbidden.run();

    assert.equal(forbidden.calls.count, 1);
    assert.ok(result._tag === 'Failure');
    assert.equal(result.failure.reason, 'HTTP 403');
  });

  it('gives up after three attempts', async () => {
    const { calls, run } = answering(response(503));

    const result = await run();

    assert.equal(calls.count, 3);
    assert.ok(result._tag === 'Failure');
    assert.deepEqual(
      result.failure,
      new ObservationError({ source: 'github tags', reason: 'HTTP 503' }),
    );
  });

  it('hands a long rate-limit wait to the queue instead of sleeping', async () => {
    const reset = String(Math.ceil(Date.now() / 1000) + 300);

    const limits: Record<string, string>[] = [
      { 'retry-after': '60' },
      { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset },
    ];

    for (const headers of limits) {
      const { calls, run } = answering(response(403, headers));

      const result = await run();

      assert.equal(calls.count, 1);
      assert.ok(result._tag === 'Failure');
      assert.ok((result.failure.retryAfter ?? 0) > 10);
    }
  });
});

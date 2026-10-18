import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { Effect } from 'effect';

import {
  backoffSeconds,
  ceiling,
  FETCH_ATTEMPTS,
  FETCH_MAX_WAIT_SECONDS,
  QUEUE_BACKOFF,
  QUEUE_MAX_DELAY_SECONDS,
  queueDelaySeconds,
  rateLimit,
} from './backoff.ts';
import { fetchWithBackoff, ObservationError } from './observe.ts';

const NOW = Date.parse('2026-10-18T00:00:00.000Z');

const response = (status: number, headers: Record<string, string> = {}) =>
  new Response(status === 204 ? null : '{}', { status, headers });

describe('backoff', () => {
  it('doubles the ceiling per attempt up to the cap', () => {
    assert.deepEqual(
      [1, 2, 3, 7, 8, 20].map((attempt) => ceiling(attempt, QUEUE_BACKOFF)),
      [30, 60, 120, 1920, 3600, 3600],
    );
  });

  it('jitters over the upper half of the ceiling', () => {
    assert.equal(
      backoffSeconds(3, QUEUE_BACKOFF, () => 0),
      60,
    );
    assert.equal(
      backoffSeconds(3, QUEUE_BACKOFF, () => 0.5),
      90,
    );
    assert.equal(
      backoffSeconds(3, QUEUE_BACKOFF, () => 0.999_999),
      119.99994,
    );
  });

  it('rounds the queue delay up to whole seconds', () => {
    assert.equal(
      queueDelaySeconds(1, undefined, () => 0.01),
      16,
    );
  });

  it('lets a rate limit wait win over the backoff', () => {
    assert.equal(
      queueDelaySeconds(9, 2.2, () => 0),
      3,
    );
    assert.equal(queueDelaySeconds(1, 0), 0);
  });

  it('caps the queue delay at what Queues accept', () => {
    assert.equal(queueDelaySeconds(1, 10 ** 6), QUEUE_MAX_DELAY_SECONDS);
  });
});

describe('rateLimit', () => {
  it('reads Retry-After seconds on a 429', () => {
    assert.deepEqual(rateLimit(response(429, { 'retry-after': '120' }), NOW), {
      wait: 120,
    });
  });

  it('reads Retry-After as an HTTP date', () => {
    const at = new Date(NOW + 90_000).toUTCString();

    assert.deepEqual(rateLimit(response(429, { 'retry-after': at }), NOW), {
      wait: 90,
    });
  });

  it("reads GitHub's secondary limit: a 403 with Retry-After", () => {
    assert.deepEqual(rateLimit(response(403, { 'retry-after': '60' }), NOW), {
      wait: 60,
    });
  });

  it("waits for GitHub's primary limit to reset", () => {
    assert.deepEqual(
      rateLimit(
        response(403, {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(NOW / 1000 + 300),
        }),
        NOW,
      ),
      { wait: 300 },
    );
  });

  it('leaves a 429 without a hint to the backoff', () => {
    assert.deepEqual(rateLimit(response(429), NOW), { wait: undefined });
  });

  it('is not a limit on a plain 403 or a 503', () => {
    assert.equal(rateLimit(response(403), NOW), undefined);
    assert.equal(
      rateLimit(response(403, { 'x-ratelimit-remaining': '12' }), NOW),
      undefined,
    );
    assert.equal(rateLimit(response(503), NOW), undefined);
  });
});

describe('fetchWithBackoff', () => {
  const realFetch = globalThis.fetch;
  const TINY = { base: 0.001, cap: 0.002 };

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /** Answers each call with the next response; counts the calls. */
  function answering(...responses: (Response | Error)[]) {
    const calls = { count: 0 };

    globalThis.fetch = () => {
      const next = responses[Math.min(calls.count, responses.length - 1)];

      calls.count += 1;

      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next ?? response(500));
    };

    return calls;
  }

  const get = () =>
    Effect.runPromise(
      Effect.result(fetchWithBackoff('test', 'https://example.test', {}, TINY)),
    );

  it('retries a 429, a 5xx and a network failure, then answers', async () => {
    const calls = answering(
      response(429),
      new Error('connection reset'),
      response(200),
    );

    const result = await get();

    assert.equal(calls.count, 3);
    assert.equal(result._tag === 'Success' && result.success.status, 200);
  });

  it('answers a 404 or a plain 403 without retrying', async () => {
    for (const status of [404, 403]) {
      const calls = answering(response(status));

      const result = await get();

      assert.equal(calls.count, 1);
      assert.equal(result._tag === 'Success' && result.success.status, status);
    }
  });

  it(`gives up after ${FETCH_ATTEMPTS} attempts`, async () => {
    const calls = answering(response(503));

    const result = await get();

    assert.equal(calls.count, FETCH_ATTEMPTS);
    assert.ok(result._tag === 'Failure');
    assert.deepEqual(
      result.failure,
      new ObservationError({ source: 'test', reason: 'HTTP 503' }),
    );
  });

  it('hands a long rate-limit wait to the queue instead of sleeping', async () => {
    const wait = FETCH_MAX_WAIT_SECONDS + 50;
    const calls = answering(response(429, { 'retry-after': String(wait) }));

    const result = await get();

    assert.equal(calls.count, 1);
    assert.ok(result._tag === 'Failure');
    assert.equal(result.failure.retryAfter, wait);
  });
});

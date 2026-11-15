import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Clock, Effect, Fiber } from 'effect';
import { TestClock } from 'effect/testing';

import type { PublishedVersions } from './published-versions.core.ts';
import {
  NotListed,
  type Retry,
  WAIT_FOR_LISTING,
  awaitedRelease,
  pendingTargets,
  retryAfterMs,
  retryMessage,
  waitForListings,
} from './resolve-published.core.ts';

/** Runs `effect` on a TestClock, stepping virtual time until it ends; `retries` holds each scheduled retry. */
async function onTestClock<A>(
  wait: (onRetry: (retry: Retry) => void) => Effect.Effect<A, unknown>,
): Promise<{ result: A; retries: Retry[]; waitedMs: number }> {
  const retries: Retry[] = [];

  return Effect.runPromise(
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        wait((retry) => retries.push(retry)),
      );

      while (fiber.pollUnsafe() === undefined) {
        yield* Effect.promise(
          () => new Promise((resolve) => setTimeout(resolve, 0)),
        );
        yield* TestClock.adjust('500 millis');
      }

      const result = yield* Fiber.join(fiber);

      return { result, retries, waitedMs: yield* Clock.currentTimeMillis };
    }).pipe(Effect.provide(TestClock.layer())),
  );
}

/** Re-reads per package: each call returns the next entry, then repeats the last. */
function registryOf(rereads: Record<string, Record<string, string>[]>) {
  const calls: string[] = [];

  return {
    read: (name: string) => {
      const seen = calls.filter((call) => call === name).length;
      const reads = rereads[name] ?? [{}];

      calls.push(name);

      return Promise.resolve(reads[Math.min(seen, reads.length - 1)] ?? {});
    },
    calls,
  };
}

const MEMBERS = [
  { name: 'lit-ui-router', version: '1.21.0' },
  { name: 'lit-ui-router-ssr', version: '0.11.1' },
  { name: 'ui-router-registry', version: '0.1.0' },
];

describe('awaitedRelease', () => {
  const publishable = ['lit-ui-router', 'lit-ui-router-ssr'];

  it('parses a release of a publishable package', () => {
    assert.deepEqual(awaitedRelease('lit-ui-router-ssr@0.11.1', publishable), {
      name: 'lit-ui-router-ssr',
      version: '0.11.1',
    });
  });

  it('names nothing when no release is given', () => {
    assert.equal(awaitedRelease('', publishable), undefined);
  });

  it('names nothing for a package outside the workspace', () => {
    assert.equal(awaitedRelease('left-pad@1.3.0', publishable), undefined);
  });

  it('names nothing for an unparseable release', () => {
    assert.equal(awaitedRelease('lit-ui-router-ssr', publishable), undefined);
    assert.equal(
      awaitedRelease('lit-ui-router-ssr@latest', publishable),
      undefined,
    );
  });
});

describe('pendingTargets', () => {
  const release = { name: 'lit-ui-router-ssr', version: '0.11.1' };

  it('waits for nothing when no release is named', () => {
    const first = {
      'lit-ui-router': { latest: '1.20.0' },
      'lit-ui-router-ssr': { latest: '0.11.0' },
    };

    assert.deepEqual(pendingTargets(undefined, MEMBERS, first), []);
  });

  it('waits for the release and every published package npm lags on', () => {
    const first = {
      'lit-ui-router': { latest: '1.20.0' },
      'lit-ui-router-ssr': { latest: '0.11.0' },
      'ui-router-registry': {},
    };

    assert.deepEqual(pendingTargets(release, MEMBERS, first), [
      { name: 'lit-ui-router', version: '1.21.0' },
      release,
    ]);
  });

  it('skips a never-published package and one already listed', () => {
    const first = {
      'lit-ui-router': { latest: '1.21.0' },
      'lit-ui-router-ssr': { latest: '0.11.1' },
      'ui-router-registry': {},
    };

    assert.deepEqual(pendingTargets(release, MEMBERS, first), []);
  });

  it('waits for the named package at its checked-out version, not the dispatched one', () => {
    const first = {
      'lit-ui-router': { latest: '1.21.0' },
      'lit-ui-router-ssr': { latest: '0.11.0' },
      'ui-router-registry': {},
    };

    const older = { name: 'lit-ui-router-ssr', version: '0.11.0' };

    assert.deepEqual(pendingTargets(older, MEMBERS, first), [
      { name: 'lit-ui-router-ssr', version: '0.11.1' },
    ]);
  });

  it('waits for the named release even on its first publish', () => {
    const first = {
      'lit-ui-router': { latest: '1.21.0' },
      'ui-router-registry': {},
    };

    const named = { name: 'ui-router-registry', version: '0.1.0' };

    assert.deepEqual(pendingTargets(named, MEMBERS, first), [named]);
  });
});

describe('waitForListings', () => {
  const first: PublishedVersions = {
    'lit-ui-router': { latest: '1.20.0' },
    'lit-ui-router-ssr': { latest: '0.11.0' },
    'ui-router-registry': {},
  };

  const pending = [
    { name: 'lit-ui-router', version: '1.21.0' },
    { name: 'lit-ui-router-ssr', version: '0.11.1' },
  ];

  it('reads nothing more when nothing is pending', async () => {
    const registry = registryOf({});

    const { result, retries } = await onTestClock((onRetry) =>
      waitForListings(registry.read, [], first, onRetry),
    );

    assert.deepEqual(result, { versions: first, unlisted: [] });
    assert.deepEqual(registry.calls, []);
    assert.deepEqual(retries, []);
  });

  it('re-reads each pending package only until it lists', async () => {
    const registry = registryOf({
      'lit-ui-router': [{ latest: '1.21.0' }],
      'lit-ui-router-ssr': [{ latest: '0.11.0' }, { latest: '0.11.1' }],
    });

    const { result, retries } = await onTestClock((onRetry) =>
      waitForListings(registry.read, pending, first, onRetry),
    );

    assert.deepEqual(result.unlisted, []);
    assert.deepEqual(result.versions, {
      ...first,
      'lit-ui-router': { latest: '1.21.0' },
      'lit-ui-router-ssr': { latest: '0.11.1' },
    });
    assert.deepEqual(registry.calls, [
      'lit-ui-router',
      'lit-ui-router-ssr',
      'lit-ui-router-ssr',
    ]);
    assert.deepEqual(
      retries.map(({ round }) => round),
      [1, 2],
    );
  });

  it('accepts a prerelease on a tag other than latest', async () => {
    const registry = registryOf({
      'lit-ui-router-ssr': [{ latest: '0.11.0', next: '0.12.0-rc.0' }],
    });

    const { result } = await onTestClock((onRetry) =>
      waitForListings(
        registry.read,
        [{ name: 'lit-ui-router-ssr', version: '0.12.0-rc.0' }],
        first,
        onRetry,
      ),
    );

    assert.deepEqual(result.unlisted, []);
    assert.equal(result.versions['lit-ui-router-ssr']?.next, '0.12.0-rc.0');
  });

  it('gives up once the budget is spent, naming only the unlisted', async () => {
    const registry = registryOf({
      'lit-ui-router': [{ latest: '1.21.0' }],
      'lit-ui-router-ssr': [{ latest: '0.11.0' }],
    });

    const { result, retries, waitedMs } = await onTestClock((onRetry) =>
      waitForListings(registry.read, pending, first, onRetry),
    );

    const { capMs, budgetMs } = WAIT_FOR_LISTING;
    const ceiling = capMs * 1.2;

    assert.deepEqual(result.unlisted, [
      { name: 'lit-ui-router-ssr', version: '0.11.1' },
    ]);
    assert.deepEqual(result.versions['lit-ui-router-ssr'], {
      latest: '0.11.0',
    });
    assert.ok(retries.every(({ delayMs }) => delayMs <= ceiling));
    assert.ok(retries.slice(4).every(({ delayMs }) => delayMs >= capMs * 0.8));
    assert.ok(retries.every(({ elapsedMs }) => elapsedMs <= budgetMs));
    assert.ok(waitedMs > budgetMs && waitedMs <= budgetMs + ceiling + 1000);
    assert.equal(
      registry.calls.filter((name) => name === 'lit-ui-router').length,
      1,
    );
    assert.equal(
      registry.calls.filter((name) => name === 'lit-ui-router-ssr').length,
      retries.length,
    );
  });

  it('retries a failed read and throws one that ends the wait', async () => {
    let calls = 0;

    const failing = () => {
      calls += 1;

      return Promise.reject(new Error('ECONNRESET'));
    };

    await assert.rejects(
      onTestClock((onRetry) =>
        waitForListings(failing, pending, first, onRetry),
      ),
      /ECONNRESET/,
    );
    assert.ok(calls > 2);
  });

  it("waits a 429's Retry-After instead of the backoff", async () => {
    const limited = Object.assign(new Error('rate limited'), {
      statusCode: 429,
      headers: { 'retry-after': ['20'] },
    });

    let calls = 0;

    const read = () => {
      calls += 1;

      return calls === 1
        ? Promise.reject(limited)
        : Promise.resolve({ latest: '0.11.1' });
    };

    const { result, retries } = await onTestClock((onRetry) =>
      waitForListings(
        read,
        [{ name: 'lit-ui-router-ssr', version: '0.11.1' }],
        first,
        onRetry,
      ),
    );

    assert.deepEqual(result.unlisted, []);
    assert.equal(retries[1]?.delayMs, 20_000);
  });
});

describe('retryAfterMs', () => {
  it('reads seconds from a 429', () => {
    assert.equal(
      retryAfterMs({ statusCode: 429, headers: { 'retry-after': ['7'] } }),
      7000,
    );
  });

  it('ignores other statuses and HTTP-dates', () => {
    assert.equal(
      retryAfterMs({ statusCode: 503, headers: { 'retry-after': ['7'] } }),
      undefined,
    );
    assert.equal(
      retryAfterMs({
        statusCode: 429,
        headers: { 'retry-after': ['Wed, 21 Oct 2026 07:28:00 GMT'] },
      }),
      undefined,
    );
  });
});

describe('retryMessage', () => {
  it('names what is still pending', () => {
    const cause = new NotListed([
      { name: 'lit-ui-router-ssr', version: '0.11.1' },
    ]);

    assert.equal(
      retryMessage({ cause, round: 2, elapsedMs: 6200, delayMs: 7800 }),
      "npm doesn't list lit-ui-router-ssr@0.11.1 yet (round 2, 6 s into the wait; next read in 8 s)",
    );
  });

  it('reports any other cause as a failed read', () => {
    assert.equal(
      retryMessage({
        cause: new Error('HTTP 503'),
        round: 3,
        elapsedMs: 14_000,
        delayMs: 9000,
      }),
      'npm dist-tags read failed: HTTP 503 (round 3, 14 s into the wait; next read in 9 s)',
    );
  });
});

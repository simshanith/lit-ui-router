import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  WAIT_FOR_LISTING,
  awaitedRelease,
  waitForListing,
} from './resolve-published.core.ts';

// Injectable sleep: record backoffs, never wait.
function fakeSleep(record: number[]): (ms: number) => Promise<void> {
  return (ms) => {
    record.push(ms);

    return Promise.resolve();
  };
}

/** A registry read that returns `reads` in turn, then repeats the last. */
function readsOf(reads: Record<string, string>[]) {
  let calls = 0;

  return {
    read: () => {
      const tags = reads[Math.min(calls, reads.length - 1)] ?? {};
      calls += 1;

      return Promise.resolve(tags);
    },
    calls: () => calls,
  };
}

describe('awaitedRelease', () => {
  const publishable = ['lit-ui-router', 'lit-ui-router-ssr'];

  it('parses a release of a publishable package', () => {
    assert.deepEqual(awaitedRelease('lit-ui-router-ssr@0.11.1', publishable), {
      name: 'lit-ui-router-ssr',
      version: '0.11.1',
    });
  });

  it('waits for nothing when no release is named', () => {
    assert.equal(awaitedRelease('', publishable), undefined);
  });

  it('waits for nothing on a package outside the workspace', () => {
    assert.equal(awaitedRelease('left-pad@1.3.0', publishable), undefined);
  });

  it('waits for nothing on an unparseable release', () => {
    assert.equal(awaitedRelease('lit-ui-router-ssr', publishable), undefined);
    assert.equal(
      awaitedRelease('lit-ui-router-ssr@latest', publishable),
      undefined,
    );
  });
});

describe('waitForListing', () => {
  it('reads once when the version is already listed', async () => {
    const slept: number[] = [];
    const registry = readsOf([{ latest: '0.11.1' }]);

    const result = await waitForListing(registry.read, '0.11.1', {
      ...WAIT_FOR_LISTING,
      sleep: fakeSleep(slept),
    });

    assert.deepEqual(result, { tags: { latest: '0.11.1' }, listed: true });
    assert.equal(registry.calls(), 1);
    assert.deepEqual(slept, []);
  });

  it('waits until a tag points at the version', async () => {
    const slept: number[] = [];

    const registry = readsOf([
      { latest: '0.11.0' },
      { latest: '0.11.0' },
      { latest: '0.11.1' },
    ]);

    const result = await waitForListing(registry.read, '0.11.1', {
      ...WAIT_FOR_LISTING,
      sleep: fakeSleep(slept),
    });

    assert.deepEqual(result, { tags: { latest: '0.11.1' }, listed: true });
    assert.equal(registry.calls(), 3);
    assert.deepEqual(slept, [5000, 10000]);
  });

  it('accepts a prerelease on a tag other than latest', async () => {
    const registry = readsOf([
      { latest: '0.11.0' },
      { latest: '0.11.0', next: '0.12.0-rc.0' },
    ]);

    const result = await waitForListing(registry.read, '0.12.0-rc.0', {
      ...WAIT_FOR_LISTING,
      sleep: fakeSleep([]),
    });

    assert.equal(result.listed, true);
    assert.equal(result.tags.next, '0.12.0-rc.0');
  });

  it('gives up after the budget with the last read', async () => {
    const slept: number[] = [];
    const registry = readsOf([{ latest: '0.11.0' }]);

    const result = await waitForListing(registry.read, '0.11.1', {
      ...WAIT_FOR_LISTING,
      sleep: fakeSleep(slept),
    });

    assert.deepEqual(result, { tags: { latest: '0.11.0' }, listed: false });
    assert.equal(registry.calls(), WAIT_FOR_LISTING.attempts);
    assert.deepEqual(slept, [5000, 10000, 20000, 40000, 80000, 160000]);
  });

  it('throws a registry error that outlasts the budget', async () => {
    await assert.rejects(
      waitForListing(() => Promise.reject(new Error('ECONNRESET')), '0.11.1', {
        ...WAIT_FOR_LISTING,
        sleep: fakeSleep([]),
      }),
      /ECONNRESET/,
    );
  });
});

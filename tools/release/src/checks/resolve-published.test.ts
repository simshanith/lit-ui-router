import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PublishedVersions } from './published-versions.core.ts';
import {
  NotListed,
  WAIT_FOR_LISTING,
  awaitedRelease,
  pendingTargets,
  retryMessage,
  waitForListings,
} from './resolve-published.core.ts';

// Injectable sleep: record backoffs, never wait.
function fakeSleep(record: number[]): (ms: number) => Promise<void> {
  return (ms) => {
    record.push(ms);

    return Promise.resolve();
  };
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
    const slept: number[] = [];
    const registry = registryOf({});

    const result = await waitForListings(registry.read, [], first, {
      ...WAIT_FOR_LISTING,
      sleep: fakeSleep(slept),
    });

    assert.deepEqual(result, { versions: first, unlisted: [] });
    assert.deepEqual(registry.calls, []);
    assert.deepEqual(slept, []);
  });

  it('re-reads each pending package only until it lists', async () => {
    const slept: number[] = [];

    const registry = registryOf({
      'lit-ui-router': [{ latest: '1.21.0' }],
      'lit-ui-router-ssr': [{ latest: '0.11.0' }, { latest: '0.11.1' }],
    });

    const result = await waitForListings(registry.read, pending, first, {
      ...WAIT_FOR_LISTING,
      sleep: fakeSleep(slept),
    });

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
    assert.deepEqual(slept, [5000, 10000]);
  });

  it('accepts a prerelease on a tag other than latest', async () => {
    const registry = registryOf({
      'lit-ui-router-ssr': [{ latest: '0.11.0', next: '0.12.0-rc.0' }],
    });

    const result = await waitForListings(
      registry.read,
      [{ name: 'lit-ui-router-ssr', version: '0.12.0-rc.0' }],
      first,
      { ...WAIT_FOR_LISTING, sleep: fakeSleep([]) },
    );

    assert.deepEqual(result.unlisted, []);
    assert.equal(result.versions['lit-ui-router-ssr']?.next, '0.12.0-rc.0');
  });

  it('gives up after one shared budget, naming only the unlisted', async () => {
    const slept: number[] = [];

    const registry = registryOf({
      'lit-ui-router': [{ latest: '1.21.0' }],
      'lit-ui-router-ssr': [{ latest: '0.11.0' }],
    });

    const result = await waitForListings(registry.read, pending, first, {
      ...WAIT_FOR_LISTING,
      sleep: fakeSleep(slept),
    });

    assert.deepEqual(result.unlisted, [
      { name: 'lit-ui-router-ssr', version: '0.11.1' },
    ]);
    assert.deepEqual(result.versions['lit-ui-router-ssr'], {
      latest: '0.11.0',
    });
    assert.deepEqual(slept, [5000, 10000, 20000, 40000, 80000, 160000]);
    assert.equal(
      registry.calls.filter((name) => name === 'lit-ui-router-ssr').length,
      WAIT_FOR_LISTING.attempts - 1,
    );
  });

  it('throws a registry error that outlasts the budget', async () => {
    await assert.rejects(
      waitForListings(
        () => Promise.reject(new Error('ECONNRESET')),
        pending,
        first,
        { ...WAIT_FOR_LISTING, sleep: fakeSleep([]) },
      ),
      /ECONNRESET/,
    );
  });
});

describe('retryMessage', () => {
  it('names what is still pending', () => {
    const cause = new NotListed([
      { name: 'lit-ui-router-ssr', version: '0.11.1' },
    ]);

    assert.equal(
      retryMessage(cause, 2, 7),
      "npm doesn't list lit-ui-router-ssr@0.11.1 yet (read 2 of 7); waiting",
    );
  });

  it('reports any other cause as a failed read', () => {
    assert.equal(
      retryMessage(new Error('HTTP 503'), 3, 7),
      'npm dist-tags read 3 of 7 failed: HTTP 503; retrying',
    );
  });
});

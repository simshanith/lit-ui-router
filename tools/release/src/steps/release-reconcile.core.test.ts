import assert from 'node:assert/strict';
import { test } from 'node:test';

import { packCacheOutcome, reconcile } from './release-reconcile.core.ts';

test('packCacheOutcome pulls the named task cache status/source', () => {
  const summary = {
    tasks: [
      { taskId: 'other#build', cache: { status: 'MISS', source: 'LOCAL' } },
      {
        taskId: '@tools/release#pack:all',
        cache: { status: 'HIT', source: 'REMOTE' },
      },
    ],
  };
  assert.deepEqual(packCacheOutcome(summary, '@tools/release#pack:all'), {
    status: 'HIT',
    source: 'REMOTE',
  });
});

test('packCacheOutcome tolerates a missing task or shape', () => {
  assert.deepEqual(packCacheOutcome({}, 'x'), {
    status: undefined,
    source: undefined,
  });
  assert.deepEqual(packCacheOutcome({ tasks: [] }, 'x'), {
    status: undefined,
    source: undefined,
  });
});

test('reconcile balances on a remote hit with matching hashes', () => {
  assert.deepEqual(
    reconcile('abc', 'abc', { status: 'HIT', source: 'REMOTE' }),
    {
      kind: 'balanced',
    },
  );
});

test('reconcile drifts on a remote hit with mismatched hashes', () => {
  assert.deepEqual(
    reconcile('abc', 'def', { status: 'HIT', source: 'REMOTE' }),
    {
      kind: 'drift',
    },
  );
});

test('reconcile is unverifiable when the credit is not a genuine remote hit', () => {
  for (const outcome of [
    { status: 'MISS', source: 'LOCAL' },
    { status: 'HIT', source: 'LOCAL' },
    { status: undefined, source: undefined },
  ]) {
    // A matching hash must NOT read as balanced: a local re-exec equals the
    // debit trivially, so there is no independent second ledger to trust.
    assert.equal(reconcile('abc', 'abc', outcome).kind, 'unverifiable');
  }
});

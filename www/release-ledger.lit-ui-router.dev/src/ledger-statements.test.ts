import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fold, moveDistTag } from '@tools/release-ledger';
import { ENVELOPE, NPM, OBSERVED, ROWS } from '@tools/release-ledger/fixtures';

import { foldStatements } from './ledger-statements.ts';

describe('foldStatements', () => {
  const move = moveDistTag(undefined, ROWS.released, 'next', ENVELOPE);

  it('reports applied when only a dist-tag moves', () => {
    const statements = foldStatements(
      fold(ROWS.released, OBSERVED, ENVELOPE),
      [move],
      'message-1',
    );

    assert.equal(statements.outcome, 'applied');
    assert.equal(statements.write, undefined);
    assert.equal(statements.distTags.length, 1);
    assert.equal(statements.ledger.length, 1);
  });

  it('rejects the whole claim with a rejected dist-tag outcome, carrying its reason', () => {
    assert.deepEqual(
      foldStatements(
        fold(undefined, OBSERVED, ENVELOPE),
        [moveDistTag(undefined, ROWS.tagged, 'next', ENVELOPE)],
        'message-1',
      ),
      {
        outcome: 'rejected',
        reason: 'lit-ui-router@1.0.0 is not on npm',
        write: undefined,
        distTags: [],
        ledger: [],
      },
    );
  });

  it('reports unchanged with nothing to write', () => {
    const statements = foldStatements(
      fold(ROWS.released, OBSERVED, ENVELOPE),
      [{ kind: 'unchanged' }],
      'message-1',
    );

    assert.deepEqual(statements, {
      outcome: 'unchanged',
      reason: null,
      write: undefined,
      distTags: [],
      ledger: [],
    });
  });

  it('reports rejected with the reason for malformed input', () => {
    const statements = foldStatements(
      fold(ROWS.published, { npm: { ...NPM, deprecated: '' } }, ENVELOPE),
      [],
      'message-1',
    );

    assert.equal(statements.outcome, 'rejected');
    assert.match(statements.reason ?? '', /empty deprecation message/);
  });
});

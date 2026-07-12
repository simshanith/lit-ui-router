import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { branchPrefix, commitMessageFromScript } from './release-bump.core.ts';

describe('branchPrefix', () => {
  it('derives release/{package}/v when the input is absent or blank', () => {
    assert.equal(
      branchPrefix(undefined, 'lit-ui-router'),
      'release/lit-ui-router/v',
    );
    assert.equal(branchPrefix('', 'lit-ui-router'), 'release/lit-ui-router/v');
    assert.equal(
      branchPrefix('  ', 'lit-ui-router-mobx'),
      'release/lit-ui-router-mobx/v',
    );
  });

  it('prefers a provided prefix verbatim', () => {
    assert.equal(branchPrefix('hotfix/v', 'lit-ui-router'), 'hotfix/v');
  });

  it('cannot derive a prefix for a nameless package', () => {
    assert.throws(() => branchPrefix(undefined, ''), /packageName/);
  });
});

describe('commitMessageFromScript', () => {
  it('strips trailing newlines like $(…) capture did', () => {
    assert.equal(
      commitMessageFromScript('Release 1.8.0\n\n* fix: things\n'),
      'Release 1.8.0\n\n* fix: things',
    );
    assert.equal(
      commitMessageFromScript('Release 1.8.0\n\n\n'),
      'Release 1.8.0',
    );
  });

  it('rejects an empty capture instead of committing with no message', () => {
    assert.throws(
      () => commitMessageFromScript('\n\n'),
      /empty commit message/,
    );
  });
});

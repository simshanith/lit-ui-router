import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { branchPrefix, releaseCommitMessage } from './release-bump.core.ts';

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

describe('releaseCommitMessage', () => {
  it('joins the version and the trimmed changelog like the old echo did', () => {
    assert.deepEqual(
      releaseCommitMessage('1.8.0', '\n### Bug Fixes\n\n* fix: things\n\n'),
      { message: 'Release 1.8.0\n\n### Bug Fixes\n\n* fix: things' },
    );
  });

  it('warns on an empty changelog and keeps the bare heading', () => {
    const { message, warning } = releaseCommitMessage('1.0.0', '\n\n', 'abc');
    assert.equal(message, 'Release 1.0.0');
    assert.match(warning ?? '', /empty changelog for 1\.0\.0 \(abc\.\.HEAD\)/);
  });

  it('rejects a blank version', () => {
    assert.throws(() => releaseCommitMessage(' ', '* fix'), /version/);
  });
});

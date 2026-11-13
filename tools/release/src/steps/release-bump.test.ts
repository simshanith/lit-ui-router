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
  const sha = 'a'.repeat(40);

  const stable = {
    version: '1.8.0',
    changelog: '\n### Bug Fixes\n\n* fix: things\n\n',
    section: {
      changelogPath: 'packages/lit-ui-router/CHANGELOG.md',
      notesThrough: sha,
    },
  };

  it('names the section and ends with the Notes-Through trailer, not the notes', () => {
    assert.deepEqual(releaseCommitMessage(stable), {
      message:
        'Release 1.8.0\n\n' +
        'Release notes: the 1.8.0 section of packages/lit-ui-router/CHANGELOG.md.\n\n' +
        `Notes-Through: ${sha}`,
    });
  });

  it('keeps a prerelease’s notes in the message, which has no section', () => {
    assert.deepEqual(
      releaseCommitMessage({
        version: '1.8.0-rc.0',
        changelog: '\n### Bug Fixes\n\n* fix: things\n\n',
      }),
      { message: 'Release 1.8.0-rc.0\n\n### Bug Fixes\n\n* fix: things' },
    );
  });

  it('warns on an empty changelog and keeps the section line and trailer', () => {
    const { message, warning } = releaseCommitMessage({
      ...stable,
      version: '1.0.0',
      changelog: '\n\n',
      from: 'abc',
    });

    assert.match(message, /^Release 1\.0\.0\n\nRelease notes: /);
    assert.match(message, /\n\nNotes-Through: a{40}$/);
    assert.match(warning ?? '', /empty changelog for 1\.0\.0 \(abc\.\.HEAD\)/);
  });

  it('keeps the bare heading for an empty prerelease changelog', () => {
    const { message, warning } = releaseCommitMessage({
      version: '1.0.0-rc.0',
      changelog: '\n',
    });

    assert.equal(message, 'Release 1.0.0-rc.0');
    assert.ok(warning);
  });

  it('rejects a blank version', () => {
    assert.throws(
      () => releaseCommitMessage({ ...stable, version: ' ' }),
      /version/,
    );
  });

  it('rejects an abbreviated or symbolic Notes-Through', () => {
    assert.throws(
      () =>
        releaseCommitMessage({
          ...stable,
          section: { ...stable.section, notesThrough: 'HEAD' },
        }),
      /not a full commit sha/,
    );
  });
});

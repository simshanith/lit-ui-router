import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bumpArgs,
  changelogArgs,
  currentReleaseVersionArgs,
  parseReleaseVersion,
  publishArgs,
  releaseVersionArgs,
  tagArgs,
} from './release-it.core.ts';
import { pnpmReleaseItArgs } from './release-it.ts';

// Baseline equivalence: every expectation below matches the argv the
// workflows' bash lines produced for the same inputs (captured before the
// collapse to mise tasks).

describe('releaseVersionArgs', () => {
  it('prefixes --release-version onto the increment argv', () => {
    assert.deepEqual(releaseVersionArgs(['--increment', 'patch']), [
      '--release-version',
      '--increment',
      'patch',
    ]);
    assert.deepEqual(releaseVersionArgs([]), ['--release-version']);
  });

  it('reads the current version with --no-increment', () => {
    assert.deepEqual(currentReleaseVersionArgs(), [
      '--release-version',
      '--no-increment',
    ]);
  });
});

describe('tagArgs', () => {
  it('tags the current version locally only (publish-gh.yml Tag step)', () => {
    assert.deepEqual(tagArgs(false), [
      '--no-increment',
      '--git.tag',
      'true',
      '--git.push',
      'false',
    ]);
  });

  it('appends --dry-run last, like the workflow line did', () => {
    assert.deepEqual(tagArgs(true).at(-1), '--dry-run');
  });
});

describe('bumpArgs', () => {
  it('commits and pushes the exact computed version', () => {
    assert.deepEqual(
      bumpArgs({
        version: '1.8.0',
        commitMessage: 'Release 1.8.0\n\n* fix: things',
        dryRun: false,
      }),
      [
        '--increment',
        '1.8.0',
        '--git.commit',
        'true',
        '--git.push',
        'true',
        '--git.commitMessage',
        'Release 1.8.0\n\n* fix: things',
      ],
    );
  });

  it('leads with --dry-run, matching the old flag position', () => {
    assert.equal(
      bumpArgs({ version: '1.8.0', commitMessage: 'x', dryRun: true })[0],
      '--dry-run',
    );
  });

  it('rejects a blank version', () => {
    assert.throws(
      () => bumpArgs({ version: ' ', commitMessage: 'x', dryRun: false }),
      /version/,
    );
  });
});

describe('publishArgs', () => {
  const base = {
    releaseVersion: '1.8.0',
    tarballPath: '/w/tools/release/.cache/publish/lit-ui-router.tgz',
    from: 'lit-ui-router@1.7.0',
    dryRun: false,
  };

  it('matches the publish-npm.yml Publish argv, range pinned to the previous tag', () => {
    assert.deepEqual(publishArgs(base), [
      '--no-increment',
      '--npm.publish',
      'true',
      '--npm.skipChecks',
      'true',
      '--npm.publishPath',
      '/w/tools/release/.cache/publish/lit-ui-router.tgz',
      '--github.release',
      'true',
      '--github.assets',
      '/w/tools/release/.cache/publish/lit-ui-router.tgz',
      '--git.tagExclude',
      '${npm.name}@1.8.0',
      '--plugins.@release-it/conventional-changelog.gitRawCommitsOpts.from=lit-ui-router@1.7.0',
    ]);
  });

  it('keeps ${npm.name} a literal release-it template, never expanded', () => {
    const args = publishArgs(base);
    const exclude = args[args.indexOf('--git.tagExclude') + 1];
    assert.equal(exclude, '${npm.name}@1.8.0');
  });

  it('pins a first release to the repo root sha, never leaving the range to release-it', () => {
    const root = '2407f49e29e058e21bffc9b0a69fd235e99a73c9';
    const args = publishArgs({ ...base, from: root });
    assert.equal(
      args.at(-1),
      `--plugins.@release-it/conventional-changelog.gitRawCommitsOpts.from=${root}`,
    );
  });

  it('appends --dry-run last for manual dry runs', () => {
    assert.equal(publishArgs({ ...base, dryRun: true }).at(-1), '--dry-run');
  });

  it('rejects blank version/tarball/from', () => {
    assert.throws(
      () => publishArgs({ ...base, releaseVersion: '' }),
      /releaseVersion/,
    );
    assert.throws(
      () => publishArgs({ ...base, tarballPath: '' }),
      /tarballPath/,
    );
    assert.throws(() => publishArgs({ ...base, from: ' ' }), /from/);
  });
});

describe('changelogArgs', () => {
  it('is the package changelog script plus the same range pin publish carries', () => {
    assert.deepEqual(
      changelogArgs({
        packageName: 'lit-ui-router',
        from: 'lit-ui-router@1.7.0',
      }),
      [
        '--changelog',
        '--git.tagMatch=lit-ui-router@[0-9]*.[0-9]*.[0-9]*',
        '--plugins.@release-it/conventional-changelog.gitRawCommitsOpts.from=lit-ui-router@1.7.0',
      ],
    );
  });

  it('rejects a blank package name or range start', () => {
    assert.throws(
      () => changelogArgs({ packageName: '', from: 'x' }),
      /packageName/,
    );
    assert.throws(
      () => changelogArgs({ packageName: 'lit-ui-router', from: '' }),
      /from/,
    );
  });
});

describe('parseReleaseVersion', () => {
  it('trims the captured stdout', () => {
    assert.equal(parseReleaseVersion('1.8.0\n'), '1.8.0');
  });

  it('rejects empty or multi-token captures instead of minting garbage refs', () => {
    assert.throws(() => parseReleaseVersion('\n'), /expected a single version/);
    assert.throws(
      () => parseReleaseVersion('WARN x\n1.8.0\n'),
      /expected a single version/,
    );
  });
});

describe('pnpmReleaseItArgs', () => {
  it('wraps release-it in the workspace filter, flags after --', () => {
    assert.deepEqual(pnpmReleaseItArgs('lit-ui-router', ['--dry-run']), [
      '--filter',
      'lit-ui-router',
      'exec',
      '--',
      'release-it',
      '--dry-run',
    ]);
  });

  it('rejects a blank package name', () => {
    assert.throws(() => pnpmReleaseItArgs('', []), /packageName/);
  });
});

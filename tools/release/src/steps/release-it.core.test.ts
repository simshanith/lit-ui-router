import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bumpArgs,
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
    tarballPath: '/w/packages/lit-ui-router/lit-ui-router-1.8.0.tgz',
    dryRun: false,
  };

  it('matches the publish-npm.yml Publish argv with a previous tag', () => {
    assert.deepEqual(publishArgs({ ...base, prevTag: 'lit-ui-router@1.7.0' }), [
      '--no-increment',
      '--npm.publish',
      'true',
      '--npm.skipChecks',
      'true',
      '--npm.publishPath',
      '/w/packages/lit-ui-router/lit-ui-router-1.8.0.tgz',
      '--github.release',
      'true',
      '--github.assets',
      '*.tgz',
      '--git.tagExclude',
      '${npm.name}@1.8.0',
      '--plugins.@release-it/conventional-changelog.gitRawCommitsOpts.from=lit-ui-router@1.7.0',
    ]);
  });

  it('keeps ${npm.name} a literal release-it template, never expanded', () => {
    const args = publishArgs({ ...base, prevTag: undefined });
    const exclude = args[args.indexOf('--git.tagExclude') + 1];
    assert.equal(exclude, '${npm.name}@1.8.0');
  });

  it('omits the changelog range override on a first release', () => {
    const args = publishArgs({ ...base, prevTag: undefined });
    assert.equal(
      args.some((a) => a.includes('gitRawCommitsOpts')),
      false,
    );
  });

  it('appends --dry-run last for manual dry runs', () => {
    assert.equal(
      publishArgs({ ...base, prevTag: undefined, dryRun: true }).at(-1),
      '--dry-run',
    );
  });

  it('rejects blank version/tarball', () => {
    assert.throws(
      () => publishArgs({ ...base, releaseVersion: '', prevTag: undefined }),
      /releaseVersion/,
    );
    assert.throws(
      () => publishArgs({ ...base, tarballPath: '', prevTag: undefined }),
      /tarballPath/,
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

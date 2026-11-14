import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bumpArgs,
  changelogArgs,
  currentReleaseVersionArgs,
  parseReleaseVersion,
  publishArgs,
  releaseNotesCommand,
  releaseVersionArgs,
  shellWord,
  tagArgs,
  writeSectionCommand,
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
        packageName: 'lit-ui-router',
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
        '--hooks.after:bump',
        'pnpm install --lockfile-only --fix-lockfile && mise run //tools/release:dependent_floor_gate --package \'lit-ui-router\' && git add ":(top)pnpm-lock.yaml"',
      ],
    );
  });

  it('leads with --dry-run, matching the old flag position', () => {
    assert.equal(
      bumpArgs({
        packageName: 'lit-ui-router',
        version: '1.8.0',
        commitMessage: 'x',
        dryRun: true,
      })[0],
      '--dry-run',
    );
  });

  it('rejects a blank version', () => {
    assert.throws(
      () =>
        bumpArgs({
          packageName: 'lit-ui-router',
          version: ' ',
          commitMessage: 'x',
          dryRun: false,
        }),
      /version/,
    );
  });

  it('rejects a package name the hook would have to quote', () => {
    assert.throws(
      () =>
        bumpArgs({
          packageName: "x' && rm -rf / #",
          version: '1.8.0',
          commitMessage: 'x',
          dryRun: false,
        }),
      /not a package name/,
    );
  });
});

describe('shellWord', () => {
  it('single-quotes a word, quotes included', () => {
    assert.equal(shellWord("/w/it's here"), `'/w/it'\\''s here'`);
  });

  it('refuses a ${ release-it would render as a template', () => {
    assert.throws(() => shellWord('/w/${version}'), /release-it template/);
  });
});

const notes = {
  changelog: '/w/packages/lit-ui-router/CHANGELOG.md',
  script: '/w/tools/changelog/src/write-section.ts',
};

describe('writeSectionCommand', () => {
  it('runs the write-section CLI on absolute paths, each a quoted word', () => {
    assert.equal(
      writeSectionCommand({
        notes,
        packageName: 'lit-ui-router',
        version: '1.8.0',
        notesPath: '/tmp/release-notes-x/notes.md',
      }),
      "node '/w/tools/changelog/src/write-section.ts' --file '/w/packages/lit-ui-router/CHANGELOG.md' --package 'lit-ui-router' --version '1.8.0' --notes '/tmp/release-notes-x/notes.md'",
    );
  });
});

describe('bumpArgs with a section', () => {
  it('writes and stages the section after the floor gate, inside the run', () => {
    const args = bumpArgs({
      packageName: 'lit-ui-router',
      version: '1.8.0',
      commitMessage: 'Release 1.8.0',
      section: { notes, notesPath: '/tmp/n.md' },
      dryRun: false,
    });

    assert.equal(
      args.at(-1),
      'pnpm install --lockfile-only --fix-lockfile && ' +
        "mise run //tools/release:dependent_floor_gate --package 'lit-ui-router' && " +
        "node '/w/tools/changelog/src/write-section.ts' --file '/w/packages/lit-ui-router/CHANGELOG.md' --package 'lit-ui-router' --version '1.8.0' --notes '/tmp/n.md' && " +
        `git add ":(top)pnpm-lock.yaml" '/w/packages/lit-ui-router/CHANGELOG.md'`,
    );
  });
});

describe('releaseNotesCommand', () => {
  it('runs the extract CLI on the absolute changelog, so release-it’s cwd does not matter', () => {
    assert.equal(
      releaseNotesCommand({
        notes: { ...notes, script: '/w/tools/changelog/src/extract.ts' },
        version: '1.8.0',
      }),
      "node '/w/tools/changelog/src/extract.ts' --file '/w/packages/lit-ui-router/CHANGELOG.md' --version '1.8.0'",
    );
  });
});

describe('publishArgs', () => {
  const base = {
    releaseVersion: '1.8.0',
    tarballPath: '/w/tools/release/.cache/publish/lit-ui-router.tgz',
    from: 'lit-ui-router@1.7.0',
    previousVersion: '1.7.0',
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
      '--plugins.@release-it/conventional-changelog.context.releaseVersion=1.8.0',
      '--plugins.@release-it/conventional-changelog.context.previousVersion=1.7.0',
    ]);
  });

  it('keeps ${npm.name} a literal release-it template, never expanded', () => {
    const args = publishArgs(base);
    const exclude = args[args.indexOf('--git.tagExclude') + 1];
    assert.equal(exclude, '${npm.name}@1.8.0');
  });

  it('pins a first release to the repo root sha, never leaving the range to release-it', () => {
    const root = '2407f49e29e058e21bffc9b0a69fd235e99a73c9';
    const args = publishArgs({ ...base, from: root, previousVersion: '' });
    assert.deepEqual(args.slice(-3), [
      `--plugins.@release-it/conventional-changelog.gitRawCommitsOpts.from=${root}`,
      '--plugins.@release-it/conventional-changelog.context.releaseVersion=1.8.0',
      '--plugins.@release-it/conventional-changelog.context.previousVersion=',
    ]);
  });

  it('appends --dry-run last for manual dry runs', () => {
    assert.equal(publishArgs({ ...base, dryRun: true }).at(-1), '--dry-run');
  });

  it('passes a stable release’s notes command as github.releaseNotes', () => {
    const args = publishArgs({ ...base, releaseNotes: "node '/w/x.ts'" });
    const at = args.indexOf('--github.releaseNotes');

    assert.equal(args[at + 1], "node '/w/x.ts'");
    assert.equal(args[at - 2], '--github.assets');
    assert.throws(
      () => publishArgs({ ...base, releaseNotes: ' ' }),
      /releaseNotes/,
    );
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
  const base = {
    packageName: 'lit-ui-router',
    version: '1.8.0',
    from: 'lit-ui-router@1.7.0',
    previousVersion: '1.7.0',
  };

  it('is the package changelog script plus the range pin and notes context publish carries', () => {
    assert.deepEqual(changelogArgs(base), [
      '--changelog',
      '--git.tagMatch=lit-ui-router@[0-9]*.[0-9]*.[0-9]*',
      '--plugins.@release-it/conventional-changelog.gitRawCommitsOpts.from=lit-ui-router@1.7.0',
      '--plugins.@release-it/conventional-changelog.context.releaseVersion=1.8.0',
      '--plugins.@release-it/conventional-changelog.context.previousVersion=1.7.0',
    ]);
  });

  it('passes the same notes context as publishArgs', () => {
    const publish = publishArgs({
      releaseVersion: base.version,
      tarballPath: '/w/lit-ui-router.tgz',
      from: base.from,
      previousVersion: base.previousVersion,
      dryRun: false,
    });

    assert.deepEqual(changelogArgs(base).slice(-3), publish.slice(-3));
  });

  it('rejects a blank package name, version or range start', () => {
    assert.throws(
      () => changelogArgs({ ...base, packageName: '' }),
      /packageName/,
    );
    assert.throws(() => changelogArgs({ ...base, version: ' ' }), /version/);
    assert.throws(() => changelogArgs({ ...base, from: '' }), /from/);
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

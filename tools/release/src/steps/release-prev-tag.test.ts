import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  describeArgs,
  isFirstReleaseError,
  isPrerelease,
  parsePrevTag,
  prereleaseChannel,
  prereleaseChannels,
} from './release-prev-tag.core.ts';
import { prevReleaseTag } from './release-prev-tag.ts';

describe('describeArgs', () => {
  it('anchors the match glob and excludes the tag being released', () => {
    assert.deepEqual(describeArgs('lit-ui-router', '1.6.0'), [
      'describe',
      '--tags',
      '--match=lit-ui-router@*',
      '--exclude=lit-ui-router@1.6.0',
      '--exclude=lit-ui-router@*-*',
      '--abbrev=0',
    ]);
  });

  it('keeps a prerelease in its lane by excluding the other channels', () => {
    assert.deepEqual(
      describeArgs('lit-ui-router', '1.6.0-rc.1', ['alpha', 'beta']),
      [
        'describe',
        '--tags',
        '--match=lit-ui-router@*',
        '--exclude=lit-ui-router@1.6.0-rc.1',
        '--exclude=lit-ui-router@*-alpha',
        '--exclude=lit-ui-router@*-alpha.*',
        '--exclude=lit-ui-router@*-beta',
        '--exclude=lit-ui-router@*-beta.*',
        '--abbrev=0',
      ],
    );
  });

  it('lets a prerelease with no other channels range from the nearest tag', () => {
    assert.deepEqual(describeArgs('lit-ui-router', '1.6.0-rc.1'), [
      'describe',
      '--tags',
      '--match=lit-ui-router@*',
      '--exclude=lit-ui-router@1.6.0-rc.1',
      '--abbrev=0',
    ]);
  });

  it('ignores otherChannels for a stable (the *-* glob already covers them)', () => {
    assert.deepEqual(describeArgs('lit-ui-router', '1.6.0', ['rc']), [
      'describe',
      '--tags',
      '--match=lit-ui-router@*',
      '--exclude=lit-ui-router@1.6.0',
      '--exclude=lit-ui-router@*-*',
      '--abbrev=0',
    ]);
  });

  it('rejects empty package or version (a blank env var upstream)', () => {
    assert.throws(() => describeArgs('', '1.0.0'), /packageName/);
    assert.throws(() => describeArgs('lit-ui-router', ' '), /releaseVersion/);
  });
});

describe('isPrerelease', () => {
  it('keys on the hyphen after the numeric core', () => {
    assert.equal(isPrerelease('1.0.0-rc.0'), true);
    assert.equal(isPrerelease('0.0.1-alpha.1'), true);
    assert.equal(isPrerelease('1.0.0'), false);
    assert.equal(isPrerelease('1.0.0+build.5'), false);
  });
});

describe('prereleaseChannel', () => {
  it('reads the identifier between the hyphen and the first dot', () => {
    assert.equal(prereleaseChannel('1.0.0-rc.0'), 'rc');
    assert.equal(prereleaseChannel('1.0.0-beta'), 'beta');
    assert.equal(prereleaseChannel('1.0.0-alpha.1+build.5'), 'alpha');
    assert.equal(prereleaseChannel('1.0.0'), undefined);
    assert.equal(prereleaseChannel('1.0.0+build.5'), undefined);
  });
});

describe('prereleaseChannels', () => {
  it('collects the distinct channels of this package only, first-seen order', () => {
    const tags = [
      'lit-ui-router@1.0.0',
      'lit-ui-router@1.0.0-rc.0',
      'lit-ui-router@1.0.0-rc.1',
      'lit-ui-router-mobx@0.1.0-canary.0',
      'lit-ui-router@0.9.0-alpha.0',
      '',
    ].join('\n');
    assert.deepEqual(prereleaseChannels('lit-ui-router', tags), [
      'rc',
      'alpha',
    ]);
  });

  it('is empty when no prerelease tags exist', () => {
    assert.deepEqual(
      prereleaseChannels('lit-ui-router', 'lit-ui-router@1.0.0\n'),
      [],
    );
    assert.deepEqual(prereleaseChannels('lit-ui-router', ''), []);
  });
});

describe('parsePrevTag', () => {
  it('trims the describe output to the tag', () => {
    assert.equal(parsePrevTag('lit-ui-router@1.5.2\n'), 'lit-ui-router@1.5.2');
  });

  it('treats empty output as no override', () => {
    assert.equal(parsePrevTag(''), undefined);
    assert.equal(parsePrevTag('\n'), undefined);
  });
});

describe('isFirstReleaseError', () => {
  it('recognizes both no-tags-at-all and none-matching messages', () => {
    assert.equal(
      isFirstReleaseError('fatal: No names found, cannot describe anything.'),
      true,
    );
    assert.equal(
      isFirstReleaseError("fatal: No tags can describe 'abc'."),
      true,
    );
  });

  it('keeps genuine git errors loud', () => {
    assert.equal(
      isFirstReleaseError('fatal: not a git repository (or any parent)'),
      false,
    );
  });
});

// End-to-end against real git: these pin git's own glob and tag-walk
// semantics the publish driver relies on, not our reimplementation of them.

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

function git(cwd: string, ...args: string[]): void {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
  assert.equal(run.status, 0, `git ${args.join(' ')} failed: ${run.stderr}`);
}

function commit(cwd: string, message: string, ...tags: string[]): void {
  git(cwd, 'commit', '--allow-empty', '-m', message);
  for (const tag of tags) git(cwd, 'tag', tag);
}

function prevTag(cwd: string, packageName: string, version: string) {
  return prevReleaseTag(packageName, version, { cwd });
}

describe('prevReleaseTag', () => {
  // history: 1.0.0 (+ a mobx tag) → 1.1.0-canary.0 → 1.1.0 at HEAD
  let repo: string;
  // a single commit tagged only for the OTHER package
  let mobxOnlyRepo: string;
  // rc-only history: the first stable rolls up from the root
  let prereleaseOnlyRepo: string;
  // lanes: 1.0.0 → 1.1.0-alpha.0 → alpha.1 → beta.0 → rc.0 → rc.1 at HEAD
  let lanesRepo: string;

  before(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'prev-tag-test-'));
    git(repo, 'init', '-q');
    commit(
      repo,
      'feat: first',
      'lit-ui-router@1.0.0',
      'lit-ui-router-mobx@0.3.0',
    );
    commit(repo, 'feat: canary', 'lit-ui-router@1.1.0-canary.0');
    commit(repo, 'feat: stable', 'lit-ui-router@1.1.0');

    mobxOnlyRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'prev-tag-test-'));
    git(mobxOnlyRepo, 'init', '-q');
    commit(mobxOnlyRepo, 'feat: mobx only', 'lit-ui-router-mobx@0.3.0');

    prereleaseOnlyRepo = fs.mkdtempSync(
      path.join(os.tmpdir(), 'prev-tag-test-'),
    );
    git(prereleaseOnlyRepo, 'init', '-q');
    commit(prereleaseOnlyRepo, 'feat: rc', 'lit-ui-router@1.0.0-rc.0');

    lanesRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'prev-tag-test-'));
    git(lanesRepo, 'init', '-q');
    commit(lanesRepo, 'feat: stable', 'lit-ui-router@1.0.0');
    commit(lanesRepo, 'feat: alpha 0', 'lit-ui-router@1.1.0-alpha.0');
    commit(lanesRepo, 'feat: alpha 1', 'lit-ui-router@1.1.0-alpha.1');
    commit(lanesRepo, 'feat: beta 0', 'lit-ui-router@1.1.0-beta.0');
    commit(lanesRepo, 'feat: rc 0', 'lit-ui-router@1.1.0-rc.0');
    commit(lanesRepo, 'feat: rc 1', 'lit-ui-router@1.1.0-rc.1');
  });

  after(() => {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(mobxOnlyRepo, { recursive: true, force: true });
    fs.rmSync(prereleaseOnlyRepo, { recursive: true, force: true });
    fs.rmSync(lanesRepo, { recursive: true, force: true });
  });

  it('resolves the package’s nearest previous tag', async () => {
    assert.equal(
      await prevTag(repo, 'lit-ui-router', '1.2.0'),
      'lit-ui-router@1.1.0',
    );
  });

  it('excludes the tag being released, so publish re-runs still range from before it', async () => {
    // the stable also skips the canary: its notes roll up from 1.0.0
    assert.equal(
      await prevTag(repo, 'lit-ui-router', '1.1.0'),
      'lit-ui-router@1.0.0',
    );
  });

  it('ranges a prerelease from the previous prerelease', async () => {
    assert.equal(
      await prevTag(prereleaseOnlyRepo, 'lit-ui-router', '1.0.0-rc.1'),
      'lit-ui-router@1.0.0-rc.0',
    );
  });

  it('keeps each prerelease channel in its own lane', async () => {
    // rc.2 from HEAD: nearest is rc.1, same lane
    assert.equal(
      await prevTag(lanesRepo, 'lit-ui-router', '1.1.0-rc.2'),
      'lit-ui-router@1.1.0-rc.1',
    );
    // a new beta from HEAD skips both rcs and lands on beta.0
    assert.equal(
      await prevTag(lanesRepo, 'lit-ui-router', '1.1.0-beta.1'),
      'lit-ui-router@1.1.0-beta.0',
    );
    // a new alpha skips rc and beta and lands on alpha.1
    assert.equal(
      await prevTag(lanesRepo, 'lit-ui-router', '1.1.0-alpha.2'),
      'lit-ui-router@1.1.0-alpha.1',
    );
    // a channel's FIRST tag falls through to the last stable
    assert.equal(
      await prevTag(lanesRepo, 'lit-ui-router', '1.1.0-canary.0'),
      'lit-ui-router@1.0.0',
    );
    // the stable rolls every lane up
    assert.equal(
      await prevTag(lanesRepo, 'lit-ui-router', '1.1.0'),
      'lit-ui-router@1.0.0',
    );
  });

  it('resolves undefined for a first stable whose only earlier tags are prereleases', async () => {
    assert.equal(
      await prevTag(prereleaseOnlyRepo, 'lit-ui-router', '1.0.0'),
      undefined,
    );
  });

  it('does not let lit-ui-router@* leak across the prefix into lit-ui-router-mobx tags', async () => {
    // nearer lit-ui-router@ tags exist on the walk; none of them may match
    assert.equal(
      await prevTag(repo, 'lit-ui-router-mobx', '0.4.0'),
      'lit-ui-router-mobx@0.3.0',
    );
  });

  it('resolves undefined on a first release', async () => {
    assert.equal(
      await prevTag(mobxOnlyRepo, 'lit-ui-router', '1.0.0'),
      undefined,
    );
  });
});

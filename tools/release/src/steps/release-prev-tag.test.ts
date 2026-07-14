import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  describeArgs,
  isFirstReleaseError,
  parsePrevTag,
} from './release-prev-tag.core.ts';
import { prevReleaseTag } from './release-prev-tag.ts';

describe('describeArgs', () => {
  it('anchors the match glob and excludes the tag being released', () => {
    assert.deepEqual(describeArgs('lit-ui-router', '1.6.0'), [
      'describe',
      '--tags',
      '--match=lit-ui-router@*',
      '--exclude=lit-ui-router@1.6.0',
      '--abbrev=0',
    ]);
  });

  it('rejects empty package or version (a blank env var upstream)', () => {
    assert.throws(() => describeArgs('', '1.0.0'), /packageName/);
    assert.throws(() => describeArgs('lit-ui-router', ' '), /releaseVersion/);
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
  });

  after(() => {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(mobxOnlyRepo, { recursive: true, force: true });
  });

  it('resolves the package’s nearest previous tag', async () => {
    assert.equal(
      await prevTag(repo, 'lit-ui-router', '1.2.0'),
      'lit-ui-router@1.1.0',
    );
  });

  it('excludes the tag being released, so publish re-runs still range from before it', async () => {
    // also pins that prerelease tags count as the previous release
    assert.equal(
      await prevTag(repo, 'lit-ui-router', '1.1.0'),
      'lit-ui-router@1.1.0-canary.0',
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

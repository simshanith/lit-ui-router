import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  classifyTagState,
  headShaArgs,
  isMissingRefError,
  isPushed,
  localTagShaArgs,
  parseLsRemoteSha,
  remoteTagShaArgs,
  tagStateMessage,
} from './release-tag-state.core.ts';
import { localTagSha } from './release-tag-state.ts';

const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);

describe('classifyTagState', () => {
  it('tags when nothing exists yet', () => {
    assert.equal(classifyTagState({ headSha: HEAD }), 'tag');
  });

  it('skips the tag when only a local one exists at HEAD', () => {
    assert.equal(
      classifyTagState({ localSha: HEAD, headSha: HEAD }),
      'skip-local',
    );
  });

  it('rejects a local-only tag off HEAD rather than letting the push ship it', () => {
    assert.throws(
      () => classifyTagState({ localSha: OTHER, headSha: HEAD }),
      /not HEAD/,
    );
  });

  it('reads a remote tag on this commit as already released', () => {
    assert.equal(
      classifyTagState({ localSha: HEAD, remoteSha: HEAD, headSha: HEAD }),
      'skip-remote-same',
    );
  });

  it('reads a remote tag on another commit as diverged, not released', () => {
    assert.equal(
      classifyTagState({ remoteSha: OTHER, headSha: HEAD }),
      'skip-remote-diverged',
    );
    // the remote is the released fact, whatever the fetched local ref says
    assert.equal(
      classifyTagState({ localSha: HEAD, remoteSha: OTHER, headSha: HEAD }),
      'skip-remote-diverged',
    );
  });

  it('rejects a blank HEAD rather than classifying against it', () => {
    assert.throws(() => classifyTagState({ headSha: ' ' }), /headSha/);
  });
});

describe('isPushed', () => {
  it('is true for exactly the two remote states', () => {
    assert.equal(isPushed('skip-remote-same'), true);
    assert.equal(isPushed('skip-remote-diverged'), true);
    assert.equal(isPushed('skip-local'), false);
    assert.equal(isPushed('tag'), false);
  });
});

describe('git argv', () => {
  it('queries the tag ref by name, peeled to a commit', () => {
    assert.deepEqual(localTagShaArgs('lit-ui-router@1.8.0'), [
      'rev-parse',
      '-q',
      '--verify',
      'refs/tags/lit-ui-router@1.8.0^{commit}',
    ]);
    assert.deepEqual(remoteTagShaArgs('lit-ui-router@1.8.0'), [
      'ls-remote',
      '--tags',
      'origin',
      'refs/tags/lit-ui-router@1.8.0',
    ]);
    assert.deepEqual(headShaArgs(), ['rev-parse', 'HEAD']);
  });

  it('refuses to compose a query for an empty tag name', () => {
    assert.throws(() => localTagShaArgs(''), /tagName/);
    assert.throws(() => remoteTagShaArgs(' '), /tagName/);
  });
});

describe('parseLsRemoteSha', () => {
  it('prefers the peeled commit of an annotated tag', () => {
    const stdout = `${OTHER}\trefs/tags/lit-ui-router@1.8.0\n${HEAD}\trefs/tags/lit-ui-router@1.8.0^{}\n`;
    assert.equal(parseLsRemoteSha(stdout), HEAD);
  });

  it('takes the ref line for a lightweight tag', () => {
    assert.equal(
      parseLsRemoteSha(`${HEAD}\trefs/tags/lit-ui-router@1.8.0\n`),
      HEAD,
    );
  });

  it('reads no output as no remote tag', () => {
    assert.equal(parseLsRemoteSha(''), undefined);
    assert.equal(parseLsRemoteSha('\n'), undefined);
  });
});

describe('isMissingRefError', () => {
  it('treats the silent -q failure as a missing ref', () => {
    assert.equal(isMissingRefError(''), true);
    assert.equal(isMissingRefError('\n'), true);
  });

  it('keeps genuine git errors fatal', () => {
    assert.equal(
      isMissingRefError('fatal: not a git repository (or any parent)'),
      false,
    );
  });
});

describe('tagStateMessage', () => {
  it('names the tag in every state', () => {
    for (const state of [
      'tag',
      'skip-local',
      'skip-remote-same',
      'skip-remote-diverged',
    ] as const) {
      assert.match(tagStateMessage(state, 'lit-ui-router@1.8.0'), /1\.8\.0/);
    }
    assert.match(
      tagStateMessage('skip-remote-same', 'p@1'),
      /already released/,
    );
  });
});

// End-to-end against real git: these pin git's own tag-peeling and
// missing-ref behavior the classification relies on.

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

function git(cwd: string, ...args: string[]): string {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
  assert.equal(run.status, 0, `git ${args.join(' ')} failed: ${run.stderr}`);
  return run.stdout.trim();
}

describe('localTagSha', () => {
  let repo: string;
  let head: string;

  before(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-state-test-'));
    git(repo, 'init', '-q');
    git(repo, 'commit', '--allow-empty', '-m', 'feat: first');
    head = git(repo, 'rev-parse', 'HEAD');
    // release-it tags annotated; a lightweight tag must resolve the same
    git(repo, 'tag', '-a', 'lit-ui-router@1.0.0', '-m', 'release');
    git(repo, 'tag', 'lit-ui-router@1.1.0');
  });

  after(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('peels an annotated tag to its commit, not the tag object', async () => {
    assert.equal(await localTagSha('lit-ui-router@1.0.0', { cwd: repo }), head);
  });

  it('resolves a lightweight tag', async () => {
    assert.equal(await localTagSha('lit-ui-router@1.1.0', { cwd: repo }), head);
  });

  it('resolves undefined for a tag that does not exist', async () => {
    assert.equal(
      await localTagSha('lit-ui-router@9.9.9', { cwd: repo }),
      undefined,
    );
  });

  it('rethrows a genuine git failure instead of reading it as absent', async () => {
    const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-state-test-'));
    try {
      await assert.rejects(
        localTagSha('lit-ui-router@1.0.0', { cwd: notARepo }),
        /not a git repository|fatal/i,
      );
    } finally {
      fs.rmSync(notARepo, { recursive: true, force: true });
    }
  });
});

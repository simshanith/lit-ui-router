import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { ConventionalChangelog } from 'conventional-changelog';

import config from './release-it.js';

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

// gitRawCommitsOpts.path drops empty commits, so each one touches a file.
function commit(cwd: string, file: string, message: string): void {
  fs.writeFileSync(path.join(cwd, file), message);
  git(cwd, 'add', file);
  git(cwd, 'commit', '-q', '-m', message);
}

const plugin = config.plugins['@release-it/conventional-changelog'];

async function renderNotes(cwd: string): Promise<string> {
  const generator = new ConventionalChangelog(cwd)
    .loadPreset(plugin.preset)
    .repository('https://github.com/simshanith/lit-ui-router')
    .context({ version: '1.0.0' })
    .commits(plugin.gitRawCommitsOpts)
    .writer(plugin.writerOpts);

  let notes = '';

  for await (const chunk of generator.write()) {
    notes += chunk;
  }

  return notes;
}

function issueLinks(notes: string): string[] {
  return Array.from(
    notes.matchAll(/\]\((https:\/\/github\.com\/[^)]+\/issues\/[^)]+)\)/g),
    ([, url]) => url,
  ).sort();
}

describe('release notes issue references', () => {
  let repo: string;
  let notes: string;

  before(async () => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'release-config-test-'));
    git(repo, 'init', '-q');
    commit(
      repo,
      'a.txt',
      'feat: resolve the #dev-gate subpath\n\nThe gate maps through package.json#imports.\n\nRefs #1282',
    );
    commit(
      repo,
      'b.txt',
      'fix: accept 0.4 as a peer\n\nCloses #805\nFixes example/repo#7',
    );
    notes = await renderNotes(repo);
  });

  after(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('links only numeric references', () => {
    assert.deepEqual(issueLinks(notes), [
      'https://github.com/example/repo/issues/7',
      'https://github.com/simshanith/lit-ui-router/issues/1282',
      'https://github.com/simshanith/lit-ui-router/issues/805',
    ]);
  });

  it('keeps the reference actions', () => {
    assert.match(notes, /closes \[#805\]/);
    assert.match(notes, /references \[#1282\]/);
  });

  it('leaves non-numeric hashes as plain text', () => {
    assert.match(notes, /resolve the #dev-gate subpath/);
    assert.doesNotMatch(notes, /dev-gate\]|imports\]/);
  });
});

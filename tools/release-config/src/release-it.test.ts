import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { stringify, type ToStringOptions } from 'yaml';

import { commitFiles, git, renderNotes } from './test-repo.ts';

// gitRawCommitsOpts.path drops empty commits, so each one touches a file.
function commit(cwd: string, file: string, message: string): void {
  commitFiles(cwd, { [file]: message }, message);
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
    commitFiles(
      repo,
      { 'package.json': '{"name":"fixture"}' },
      'chore: scaffold',
    );
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

type Catalogs = Record<string, Record<string, string>>;

const BASE_CATALOGS = {
  publishedPeerA: { x: '^1.0.0', y: '^1.0.0' },
  publishedPeerB: { z: '^1.0.0' },
  peerFloorA: { 'x-floor': 'npm:x@1.0.0' },
} satisfies Catalogs;

function workspaceYaml(
  catalogs: Catalogs,
  lit = '^3.0.0',
  options: ToStringOptions = {},
): string {
  return stringify(
    { packages: ['packages/*'], catalog: { lit }, catalogs },
    options,
  );
}

// Mutates, so each commit's workspace file carries the earlier edits.
function setEntry(
  catalogs: Catalogs,
  catalog: string,
  name: string,
  range: string,
) {
  catalogs[catalog] = { ...catalogs[catalog], [name]: range };

  return catalogs;
}

describe('release notes catalog commits', () => {
  let repo: string;
  let notesA: string;
  let notesB: string;

  before(async () => {
    const catalogs = structuredClone(BASE_CATALOGS);

    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'release-config-catalog-'));
    git(repo, 'init', '-q');
    commitFiles(
      repo,
      {
        'pnpm-workspace.yaml': workspaceYaml(BASE_CATALOGS),
        'packages/a/package.json': JSON.stringify({
          name: 'a',
          peerDependencies: { x: 'catalog:publishedPeerA', lit: 'catalog:' },
          devDependencies: { 'x-floor': 'catalog:peerFloorA' },
        }),
        'packages/b/package.json': JSON.stringify({
          name: 'b',
          peerDependencies: {
            y: 'catalog:publishedPeerA',
            z: 'catalog:publishedPeerB',
          },
        }),
      },
      'chore: scaffold',
    );
    commitFiles(
      repo,
      { 'packages/a/index.js': 'a' },
      'feat(a): add the entry point',
    );
    commitFiles(
      repo,
      {
        'pnpm-workspace.yaml': workspaceYaml(
          setEntry(catalogs, 'publishedPeerA', 'x', '^1.0.0 || ^2.0.0'),
        ),
      },
      'fix(a): accept x 2 as a peer',
    );
    commitFiles(
      repo,
      {
        'pnpm-workspace.yaml': workspaceYaml(
          setEntry(catalogs, 'publishedPeerA', 'y', '^2.0.0'),
        ),
      },
      'fix(b): require y 2',
    );
    commitFiles(
      repo,
      {
        'pnpm-workspace.yaml': workspaceYaml(
          setEntry(catalogs, 'publishedPeerB', 'z', '^2.0.0'),
        ),
      },
      'fix(b): require z 2',
    );
    commitFiles(
      repo,
      {
        'pnpm-workspace.yaml': workspaceYaml(
          setEntry(catalogs, 'peerFloorA', 'x-floor', 'npm:x@1.1.0'),
        ),
      },
      'fix(a): raise the x floor alias',
    );
    commitFiles(
      repo,
      { 'pnpm-workspace.yaml': workspaceYaml(catalogs, '^3.1.0') },
      'fix(a): require lit 3.1',
    );
    commitFiles(
      repo,
      {
        'packages/a/index.js': 'a2',
        'pnpm-workspace.yaml': workspaceYaml(catalogs, '^3.2.0'),
      },
      'fix(a): require lit 3.2 for the entry point',
    );
    commitFiles(
      repo,
      {
        'pnpm-workspace.yaml': workspaceYaml(catalogs, '^3.2.0', {
          defaultStringType: 'QUOTE_DOUBLE',
        }),
      },
      'fix: requote the workspace file',
    );
    notesA = await renderNotes(path.join(repo, 'packages/a'));
    notesB = await renderNotes(path.join(repo, 'packages/b'));
  });

  after(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('includes a commit that changes a consumed catalog entry', () => {
    assert.match(notesA, /accept x 2 as a peer/);
    assert.match(notesA, /require lit 3\.1/);
    assert.match(notesB, /require y 2/);
    assert.match(notesB, /require z 2/);
  });

  it('leaves out another entry in a consumed catalog', () => {
    assert.doesNotMatch(notesA, /require y 2/);
    assert.doesNotMatch(notesB, /accept x 2 as a peer/);
  });

  it('leaves out a catalog the package does not consume', () => {
    assert.doesNotMatch(notesA, /require z 2/);
    assert.doesNotMatch(notesB, /require lit/);
  });

  it('leaves out catalogs only devDependencies consume', () => {
    assert.doesNotMatch(notesA, /raise the x floor alias/);
  });

  it('leaves out a commit that only reformats the workspace file', () => {
    assert.doesNotMatch(notesA, /requote/);
    assert.doesNotMatch(notesB, /requote/);
  });

  it('keeps commits inside the package directory', () => {
    assert.match(notesA, /add the entry point/);
  });

  it('lists a commit touching both the directory and the workspace file once', () => {
    assert.equal(
      notesA.match(/require lit 3\.2 for the entry point/g)?.length,
      1,
    );
  });
});

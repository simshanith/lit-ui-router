import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { bumpedDirs, checkNotesThrough } from './notes-through.ts';

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

const root = mkdtempSync(join(tmpdir(), 'notes-through-'));

const pkg = join(root, 'packages/a');

function git(...args: string[]): string {
  const run = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: GIT_ENV,
  });

  assert.equal(run.status, 0, `git ${args.join(' ')} failed: ${run.stderr}`);

  return run.stdout.trim();
}

function commit(files: Record<string, string>, message: string): string {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
    git('add', file);
  }

  git('commit', '-q', '-m', message);

  return git('rev-parse', 'HEAD');
}

const workspace = (foo: string, bar: string) =>
  `packages:\n  - packages/*\ncatalog:\n  foo: ${foo}\n  bar: ${bar}\n`;

// `at` is the trailer range's end, as both callers pass it.
const check = (trailerRange: string, tip: string) =>
  checkNotesThrough({
    packageName: 'a',
    cwd: pkg,
    version: '1.1.0',
    at: trailerRange.split('..')[1] ?? '',
    trailerRange,
    tip,
  });

const marked = (sha: string, body: string) =>
  `# Changelog\n\n## 1.1.0 (2026-11-24)\n\n<!-- notes-through: ${sha} -->\n\n${body}\n`;

const manifest = (version: string) =>
  JSON.stringify({ name: 'a', version, dependencies: { foo: 'catalog:' } });

let cut = '';

before(() => {
  git('init', '-q', '-b', 'main');
  cut = commit(
    {
      'pnpm-workspace.yaml': workspace('^1.0.0', '^1.0.0'),
      'packages/a/package.json': JSON.stringify({
        name: 'a',
        version: '1.0.0',
        dependencies: { foo: 'catalog:' },
      }),
      'packages/a/CHANGELOG.md': '# Changelog\n',
      'packages/a/src/index.ts': 'export {};\n',
      'packages/b/src/index.ts': 'export {};\n',
    },
    'feat: start',
  );

  git('switch', '-q', '-c', 'release');
  commit(
    {
      'packages/a/package.json': JSON.stringify({
        name: 'a',
        version: '1.1.0',
        dependencies: { foo: 'catalog:' },
      }),
      'packages/a/CHANGELOG.md': '# Changelog\n\n## 1.1.0 (2026-11-12)\n',
    },
    `Release 1.1.0\n\nRelease notes: the 1.1.0 section of packages/a/CHANGELOG.md.\n\nNotes-Through: ${cut}`,
  );
  commit(
    {
      'packages/a/CHANGELOG.md':
        '# Changelog\n\n## 1.1.0 (2026-11-12)\n\n* edited\n',
    },
    'docs(changelog): edit the 1.1.0 notes by hand',
  );
  git('switch', '-q', 'main');
});

after(() => rmSync(root, { recursive: true, force: true }));

describe('checkNotesThrough', () => {
  it('passes while main gains only commits the notes would not list', () => {
    commit({ 'packages/a/src/index.spec.ts': 'test\n' }, 'test(a): add a spec');
    commit(
      { 'packages/a/src/index.ts': 'export {}; // tidy\n' },
      'chore: tidy',
    );
    commit(
      { 'packages/b/src/index.ts': 'export const b = 1;\n' },
      'fix(b): a fix elsewhere',
    );
    commit(
      { 'pnpm-workspace.yaml': workspace('^1.0.0', '^2.0.0') },
      'build: bump an unconsumed catalog entry',
    );

    const result = check('main..release', 'main');

    assert.deepEqual(result.stale, []);
    assert.equal(result.problem, undefined);
    assert.equal(result.notesThrough, cut);
  });

  it('fails on a listed commit to the package, and on a consumed catalog change', () => {
    const fix = commit(
      { 'packages/a/src/index.ts': 'export const a = 1;\n' },
      'fix(a): a late fix',
    );

    const bump = commit(
      { 'pnpm-workspace.yaml': workspace('^1.1.0', '^2.0.0') },
      'build: bump foo',
    );

    assert.deepEqual(
      check('main..release', 'main').stale.map(({ hash }) => hash),
      [bump, fix],
    );
  });

  it('reads the trailer from a squash commit and leaves that commit out of the range', () => {
    git('switch', '-q', '-c', 'squashed', cut);
    commit({ 'packages/a/src/index.spec.ts': 'test\n' }, 'test(a): a spec');
    commit(
      {
        'packages/a/package.json': JSON.stringify({
          name: 'a',
          version: '1.1.0',
          dependencies: { foo: 'catalog:' },
        }),
        'packages/a/CHANGELOG.md': '# Changelog\n\n## 1.1.0 (2026-11-12)\n',
        'packages/a/src/index.ts': 'export const squashed = 1;\n',
      },
      `Release 1.1.0 (#9)\n\nRelease notes: …\n\nNotes-Through: ${cut}\n\n* docs(changelog): edit\n\nCo-authored-by: x <x@example.com>`,
    );

    const result = check(`${cut}..HEAD`, 'HEAD');

    assert.deepEqual(result.stale, []);
    assert.equal(result.source, 'trailer');
    assert.equal(result.notesThrough, cut);
    git('switch', '-q', 'main');
  });

  it('fails when the section has no marker and no commit carries a trailer', () => {
    const result = check(`${cut}..main`, 'main');

    assert.match(
      result.problem ?? '',
      /no 1\.1\.0 section with a notes-through marker/,
    );
    assert.match(result.problem ?? '', /carries a Notes-Through trailer/);
  });
});

describe('checkNotesThrough with a marker', () => {
  let release = '';

  before(() => {
    git('switch', '-q', '-c', 'marked', cut);
    commit({ 'packages/a/src/index.spec.ts': 'test\n' }, 'test(a): a spec');
    // A listed header and no trailer, as a squash merge whose body was dropped.
    release = commit(
      {
        'packages/a/package.json': manifest('1.1.0'),
        'packages/a/CHANGELOG.md': marked(cut, '* one'),
      },
      'docs(a): release 1.1.0 (#10)',
    );
  });

  after(() => git('switch', '-q', 'main'));

  it('reads the sha from the section and leaves the commit that wrote the marker out', () => {
    const result = check(`${cut}..HEAD`, 'HEAD');

    assert.equal(result.problem, undefined);
    assert.equal(result.source, 'marker');
    assert.equal(result.notesThrough, cut);
    assert.equal(result.notesCommit, release);
    assert.deepEqual(result.stale, []);
  });

  it('still leaves the marker commit out after a later edit to the section body', () => {
    const edit = commit(
      {
        'packages/a/CHANGELOG.md': marked(cut, '* one\n* two'),
        'packages/a/src/index.ts': 'export const edited = 1;\n',
      },
      'fix(a): a fix that also edits the notes',
    );

    const result = check(`${cut}..HEAD`, 'HEAD');

    assert.equal(result.notesCommit, release);
    assert.deepEqual(
      result.stale.map(({ hash }) => hash),
      [edit],
    );
  });

  it('prefers the marker to a trailer', () => {
    git('switch', '-q', '-c', 'both', cut);

    const fix = commit(
      { 'packages/a/src/index.ts': 'export const both = 1;\n' },
      'fix(a): after the trailer, before the marker',
    );

    commit(
      {
        'packages/a/package.json': manifest('1.1.0'),
        'packages/a/CHANGELOG.md': marked(cut, '* one'),
      },
      `Release 1.1.0\n\nNotes-Through: ${fix}`,
    );

    const result = check(`${cut}..HEAD`, 'HEAD');

    assert.equal(result.source, 'marker');
    assert.deepEqual(
      result.stale.map(({ hash }) => hash),
      [fix],
    );
    git('switch', '-q', 'marked');
  });
});

describe('bumpedDirs', () => {
  it('names the members whose version the head changes', () => {
    assert.deepEqual(
      bumpedDirs(root, 'main', 'release', ['packages/a', 'packages/b']),
      [{ dir: 'packages/a', version: '1.1.0' }],
    );
  });
});

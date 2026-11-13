import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderChangelog } from '@tools/changelog';
import type { Exec } from '@tools/shared/exec.ts';

import {
  type Release,
  applyResync,
  editArgs,
  latestArgs,
  planResync,
  releaseListArgs,
  resyncMarkdown,
} from './release-notes-resync.core.ts';

const REPO = 'o/r';

const file = (name: string, ...sections: [string, string][]) => ({
  name,
  text: renderChangelog(
    name,
    sections.map(([version, body]) => ({
      version,
      heading: `${version} (2026-01-01)`,
      body,
    })),
  ),
});

const release = (tag: string, body: string | null, extra = {}): Release => ({
  tag,
  draft: false,
  prerelease: false,
  body,
  ...extra,
});

const FILES = [
  file(
    'a',
    ['1.2.0', 'unreleased'],
    ['1.1.0', '### Fixes\n\n* x'],
    ['1.0.0', 'same'],
  ),
  file('b', ['0.1.0', 'b notes']),
];

const RELEASES = [
  release('a@1.1.0', '## Fixes\n\n* x\n'),
  release('a@1.0.0', 'same\n'),
  release('a@1.1.0-rc.0', 'rc'),
  release('b@0.1.0', 'b notes'),
];

const ALL = { package: '', version: '' };

describe('planResync', () => {
  it('plans only stable releases whose body differs, skips sections without a release', () => {
    const plan = planResync(FILES, RELEASES, ALL);

    assert.deepEqual(
      plan.changes.map(({ tag, notes }) => [tag, notes]),
      [['a@1.1.0', '### Fixes\n\n* x\n']],
    );
    assert.deepEqual(plan.skipped, [
      { tag: 'a@1.2.0', reason: 'no GitHub release; never created' },
    ]);
    assert.deepEqual(plan.inSync, ['a@1.0.0', 'b@0.1.0']);
    assert.match(plan.changes[0]?.diff ?? '', /^-## Fixes\n\+### Fixes$/m);
  });

  it('skips a release marked draft or prerelease', () => {
    const plan = planResync(
      FILES,
      [release('a@1.1.0', 'old', { prerelease: true })],
      { package: 'a', version: '1.1.0' },
    );

    assert.deepEqual(plan.changes, []);
    assert.deepEqual(plan.skipped, [
      { tag: 'a@1.1.0', reason: 'the release is a prerelease' },
    ]);
  });

  it('narrows to one package and version', () => {
    const plan = planResync(FILES, RELEASES, { package: 'b', version: '' });

    assert.deepEqual(plan.changes, []);
    assert.deepEqual(plan.inSync, ['b@0.1.0']);
  });

  it('refuses an unknown package or a version with no section', () => {
    assert.throws(
      () => planResync(FILES, RELEASES, { package: 'c', version: '' }),
      /c is not a published package/,
    );
    assert.throws(
      () => planResync(FILES, RELEASES, { package: 'b', version: '1.0.0' }),
      /no CHANGELOG\.md section for version 1\.0\.0/,
    );
  });
});

describe('gh argv', () => {
  it('pins Latest explicitly and sends nothing but the notes', () => {
    assert.deepEqual(editArgs(REPO, 'a@1.1.0', '/tmp/n.md', false), [
      'release',
      'edit',
      'a@1.1.0',
      '--repo',
      REPO,
      '--notes-file',
      '/tmp/n.md',
      '--latest=false',
    ]);
    assert.equal(
      editArgs(REPO, 'a@1.1.0', '/tmp/n.md', true).at(-1),
      '--latest=true',
    );
  });

  it('reads releases and the Latest tag', () => {
    assert.deepEqual(releaseListArgs(REPO).slice(0, 3), [
      'api',
      '--paginate',
      'repos/o/r/releases?per_page=100',
    ]);
    assert.deepEqual(latestArgs(REPO).slice(0, 6), [
      'api',
      'graphql',
      '-F',
      'owner=o',
      '-F',
      'name=r',
    ]);
  });
});

/** A fake gh: records argv; the Latest query answers from `latest`, which an edit may move. */
function fakeGh(
  state: { latest: string },
  onEdit: (args: readonly string[]) => void = () => {},
) {
  const calls: string[][] = [];

  const exec: Exec = (command, args) => {
    calls.push([command, ...args]);

    if (args[0] === 'api')
      return Promise.resolve({ stdout: `${state.latest}\n`, stderr: '' });

    onEdit(args);

    return Promise.resolve({ stdout: '', stderr: '' });
  };

  return { exec, calls };
}

const CHANGES = [
  { tag: 'a@1.1.0', notes: 'one\n', diff: '' },
  { tag: 'z@9.0.0', notes: 'two\n', diff: '' },
];

const writeNotes = (tag: string) => Promise.resolve(`/tmp/${tag}.md`);

describe('applyResync', () => {
  it('edits each change with Latest pinned as it was, checking it after each edit', async () => {
    const { exec, calls } = fakeGh({ latest: 'z@9.0.0' });

    const applied = await applyResync(CHANGES, {
      exec,
      repo: REPO,
      latest: 'z@9.0.0',
      writeNotes,
    });

    assert.deepEqual(applied, {
      edited: ['a@1.1.0', 'z@9.0.0'],
      failure: undefined,
    });
    assert.deepEqual(
      calls.filter(([, sub]) => sub === 'release'),
      [
        ['gh', ...editArgs(REPO, 'a@1.1.0', '/tmp/a@1.1.0.md', false)],
        ['gh', ...editArgs(REPO, 'z@9.0.0', '/tmp/z@9.0.0.md', true)],
      ],
    );
    assert.equal(calls.filter(([, sub]) => sub === 'api').length, 2);
  });

  it('puts a moved Latest back and stops', async () => {
    const state = { latest: 'z@9.0.0' };

    const { exec, calls } = fakeGh(state, (args) => {
      if (args.includes('--notes-file')) state.latest = args[2] ?? '';
    });

    const applied = await applyResync(CHANGES, {
      exec,
      repo: REPO,
      latest: 'z@9.0.0',
      writeNotes,
    });

    assert.deepEqual(applied.edited, ['a@1.1.0']);
    assert.match(
      applied.failure ?? '',
      /moved Latest from z@9\.0\.0 to a@1\.1\.0/,
    );
    assert.deepEqual(calls.at(-1), [
      'gh',
      'release',
      'edit',
      'z@9.0.0',
      '--repo',
      REPO,
      '--latest',
    ]);
  });

  it('stops at a failed edit', async () => {
    const exec: Exec = (_command, args) =>
      args[0] === 'release'
        ? Promise.reject(new Error('HTTP 403'))
        : Promise.resolve({ stdout: '', stderr: '' });

    assert.deepEqual(
      await applyResync(CHANGES, {
        exec,
        repo: REPO,
        latest: undefined,
        writeNotes,
      }),
      { edited: [], failure: 'HTTP 403' },
    );
  });
});

describe('resyncMarkdown', () => {
  const plan = planResync(FILES, RELEASES, ALL);

  it('says what a dry run would edit, with its diff', () => {
    const markdown = resyncMarkdown(plan, 'z@9.0.0', undefined);

    assert.match(markdown, /^## Release notes re-sync \(dry run\)$/m);
    assert.match(
      markdown,
      /Would edit 1 release\(s\); 2 already match; Latest stays `z@9\.0\.0`/,
    );
    assert.match(markdown, /```diff\n[^]*\+### Fixes/);
    assert.match(markdown, /- `a@1\.2\.0`: no GitHub release; never created/);
  });

  it('says what an apply edited and why it stopped', () => {
    const markdown = resyncMarkdown(plan, undefined, {
      edited: [],
      failure: 'HTTP 403',
    });

    assert.match(markdown, /Edited 0 of 1 differing release\(s\)/);
    assert.match(markdown, /\*\*Stopped:\*\* HTTP 403/);
    assert.match(markdown, /<code>a@1\.1\.0<\/code> \(not edited\)/);
  });
});

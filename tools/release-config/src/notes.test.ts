import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { stringify } from 'yaml';

import { NO_CODE_CHANGES, releaseLinks, trimNoteText } from './notes.js';
import { commitFiles, git, renderNotes } from './test-repo.ts';

const PULL = 'https://github.com/simshanith/lit-ui-router/pull';

function workspaceYaml(x: string): string {
  return stringify({
    packages: ['packages/*', 'tools/*'],
    catalogs: { publishedPeerA: { x } },
  });
}

function manifest(name: string, peers: Record<string, string> = {}): string {
  return JSON.stringify({
    name,
    version: '1.0.0',
    files: ['dist/**', 'src/*.ts'],
    peerDependencies: peers,
  });
}

/** The lines between one `### ` heading and the next block. */
function section(notes: string, title: string): string[] {
  const match = new RegExp(`### ${title}\\n\\n((?:\\* .*\\n?)+)`).exec(notes);

  return match?.[1]?.trim().split('\n') ?? [];
}

function alsoTouched(notes: string): string[] {
  const match = /<summary>.*<\/summary>\n\n([\s\S]*?)\n\n<\/details>/.exec(
    notes,
  );

  return match?.[1]?.split('\n') ?? [];
}

describe('trimNoteText', () => {
  it('ends a breaking note at the first sub-commit line', () => {
    assert.equal(
      trimNoteText(
        'the old shape is gone.\nMigrate with x.\n\n* fix(a): tidy\n\n  more body\n- feat(b)!: other',
      ),
      'the old shape is gone.\nMigrate with x.',
    );
  });

  it('keeps prose that merely contains a colon', () => {
    assert.equal(
      trimNoteText('drop it.\nNote: x stays.\n* not a commit line'),
      'drop it.\nNote: x stays.\n* not a commit line',
    );
  });
});

describe('releaseLinks', () => {
  it('links the version page and the diff from the previous version', () => {
    assert.equal(
      releaseLinks('ui-router-registry', '0.4.0', '0.3.0'),
      '[Release page](https://lit-ui-router.dev/releases/ui-router-registry/0.4.0/) · ' +
        '[Diff from 0.3.0](https://lit-ui-router.dev/releases/ui-router-registry/diff/0.3.0...0.4.0/)',
    );
  });

  it('omits the diff on a first release and encodes a scoped name', () => {
    assert.equal(
      releaseLinks('@scope/c', '1.0.0', ''),
      '[Release page](https://lit-ui-router.dev/releases/%40scope%2Fc/1.0.0/)',
    );
  });
});

describe('scope-aware release notes', () => {
  let repo: string;
  let packageA: string;
  let notes: string;
  let firstRelease: string;

  const context = { version: '1.1.0', previousVersion: '1.0.0' };

  before(async () => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'release-config-notes-'));
    packageA = path.join(repo, 'packages/a');
    git(repo, 'init', '-q');
    commitFiles(
      repo,
      {
        'pnpm-workspace.yaml': workspaceYaml('^0.2.0'),
        'packages/a/package.json': manifest('a', {
          x: 'catalog:publishedPeerA',
          z: '^1.0.0',
        }),
        'packages/a/src/index.ts': 'export {};',
        'packages/a/README.md': '# a',
        'packages/b/package.json': manifest('b'),
        'packages/c/package.json': manifest('@scope/c'),
        'packages/c/README.md': '# c',
        'tools/site/package.json': JSON.stringify({
          name: '@tools/site',
          private: true,
        }),
      },
      'chore: scaffold',
    );
    git(repo, 'tag', 'a@1.0.0');

    commitFiles(
      repo,
      { 'packages/a/README.md': '# a\n\nOn the site.' },
      'docs(site): describe a on the site (#10)',
    );
    commitFiles(
      repo,
      { 'packages/a/src/index.ts': 'export const renamed = 1;' },
      "feat(b)!: rename b's export (#11)\n\nBREAKING CHANGE: b renames its export.",
    );
    commitFiles(
      repo,
      { 'pnpm-workspace.yaml': workspaceYaml('^0.3.0') },
      'fix(b): require x 0.3 (#12)',
    );
    commitFiles(
      repo,
      { 'packages/a/src/base.ts': 'export const base = 1;' },
      'feat(b): carry the base (#13)',
    );
    commitFiles(
      repo,
      { 'packages/a/src/base.ts': '' },
      'revert(a): hold back the base (#14)\n\nThe server half stays.\n\nReverts: #13',
    );
    commitFiles(
      repo,
      { 'packages/a/src/base.ts': 'export const base = 2;' },
      'feat(a): prerender under the base (#15)',
    );
    commitFiles(
      repo,
      { 'packages/a/src/shape.ts': 'export {};' },
      'feat(a): adopt the new shape (#16)\n\n* feat(a): adopt the new shape\n\n' +
        'BREAKING CHANGE: the old shape is gone.\n\n* fix(a): tidy\n\n* test(a): cover it',
    );
    commitFiles(
      repo,
      {
        'packages/a/package.json': manifest('a', {
          x: 'catalog:publishedPeerA',
          z: '^1.0.0 || ^2.0.0',
        }),
      },
      'fix(a): accept z 2 (#17)',
    );
    commitFiles(
      repo,
      { 'packages/c/README.md': '# c\n\nShared.' },
      "refactor(a): build a on c's helper (#21)",
    );

    notes = await renderNotes(packageA, { from: 'a@1.0.0', context });
    firstRelease = await renderNotes(path.join(repo, 'packages/c'), {
      context: { version: '1.0.0', previousVersion: '' },
    });
  });

  after(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('cuts a breaking note at the squash body’s sub-commit list', () => {
    assert.match(notes, /\* \*\*a:\*\* the old shape is gone\.\n/);
    assert.doesNotMatch(notes, /tidy|cover it/);
  });

  it('states a narrowed peer as breaking, resolved through the catalogs', () => {
    assert.deepEqual(section(notes, '⚠ BREAKING CHANGES'), [
      '* **a:** the x peer narrows from ^0.2.0 to ^0.3.0.',
      '* **a:** the old shape is gone.',
    ]);
  });

  it('states a widened peer in its own section', () => {
    assert.deepEqual(section(notes, 'Peer Dependencies'), [
      '* **a:** the z peer widens from ^1.0.0 to ^1.0.0 || ^2.0.0.',
    ]);
  });

  it('keeps a foreign commit that changed shipped code or a consumed catalog entry', () => {
    const features = section(notes, 'Features').join('\n');

    assert.match(features, /rename b's export/);
    assert.match(section(notes, 'Bug Fixes').join('\n'), /require x 0\.3/);
  });

  it("drops a foreign commit's breaking note", () => {
    assert.doesNotMatch(notes, /b renames its export/);
  });

  it('collapses a revert and its target, leaving the re-land', () => {
    assert.doesNotMatch(notes, /### Reverts/);
    assert.match(
      section(notes, 'Features').join('\n'),
      /prerender under the base/,
    );
    assert.doesNotMatch(
      section(notes, 'Features').join('\n'),
      /carry the base/,
    );
  });

  it('lists demoted and cancelled commits in the closing block', () => {
    assert.match(notes, /<summary>Also touched this package \(3\)<\/summary>/);
    assert.deepEqual(alsoTouched(notes), [
      `* **a:** hold back the base ([#14](${PULL}/14)), reverts [#13](${PULL}/13)`,
      `* **b:** carry the base ([#13](${PULL}/13)), reverted by [#14](${PULL}/14)`,
      `* **site:** describe a on the site ([#10](${PULL}/10))`,
    ]);
    assert.doesNotMatch(notes, new RegExp(NO_CODE_CHANGES));
  });

  it('ends with the release page and diff links', () => {
    assert.ok(
      notes.endsWith(
        '[Release page](https://lit-ui-router.dev/releases/a/1.1.0/) · ' +
          '[Diff from 1.0.0](https://lit-ui-router.dev/releases/a/diff/1.0.0...1.1.0/)',
      ),
    );
  });

  it('opens an all-foreign release with the no-code line, and links no diff on a first release', () => {
    assert.ok(firstRelease.startsWith(`${NO_CODE_CHANGES}\n\n<details>`));
    assert.deepEqual(alsoTouched(firstRelease), [
      `* **a:** build a on c's helper ([#21](${PULL}/21))`,
    ]);
    assert.doesNotMatch(firstRelease, /###/);
    assert.ok(
      firstRelease.endsWith(
        '[Release page](https://lit-ui-router.dev/releases/%40scope%2Fc/1.0.0/)',
      ),
    );
  });

  it('renders the same body at publish time, after the release commit', async () => {
    commitFiles(
      repo,
      {
        'packages/a/package.json': JSON.stringify({
          ...JSON.parse(
            fs.readFileSync(path.join(packageA, 'package.json'), 'utf8'),
          ),
          version: '1.1.0',
        }),
      },
      `Release 1.1.0\n\n${notes}`,
    );

    const published = await renderNotes(packageA, {
      from: 'a@1.0.0',
      context: { ...context, previousTag: 'a@1.0.0', currentTag: 'a@1.1.0' },
    });

    assert.equal(published, notes);
  });

  it('leaves out the peer statement and links when the drivers pass no context', async () => {
    const preview = await renderNotes(packageA, { from: 'a@1.0.0' });

    assert.doesNotMatch(preview, /peer narrows|lit-ui-router\.dev/);
  });
});

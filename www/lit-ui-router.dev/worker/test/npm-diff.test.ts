import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatDiff,
  packageFiles,
  shouldPrintPatch,
} from '../releases/npm-diff/format-diff.ts';
import { readTar } from '../releases/npm-diff/tar.ts';
import { files, pax, tar } from './npm-diff-fixtures.ts';

// Each expected patch is what libnpmdiff 8.1.12's format-diff.js prints for the same files.
const versions = { a: '1.0.0', b: '1.0.1' };

describe('readTar', () => {
  it('reads regular files in archive order, skipping other entries', () => {
    const entries = readTar(
      tar([
        { name: 'package/', type: '5' },
        { name: 'package/b.js', body: 'b' },
        { name: 'package/link', type: '2' },
        { name: 'package/a.js', body: 'a'.repeat(700), mode: 0o755 },
        { name: 'package/old-dir/', type: '0' },
      ]),
    );

    assert.deepEqual(
      entries.map(({ path, mode, data }) => [path, mode, data.length]),
      [
        ['package/b.js', 0o644, 1],
        ['package/a.js', 0o755, 700],
      ],
    );
  });

  it('joins the ustar prefix and applies pax and GNU long names to the next entry', () => {
    const long = `package/${'deep/'.repeat(30)}file.js`;

    const entries = readTar(
      tar([
        { name: 'file.js', prefix: 'package/lib', body: 'p' },
        pax({ path: `package/ünïcode-${'x'.repeat(100)}.js` }),
        { name: 'truncated', body: 'x' },
        { name: '././@LongLink', type: 'L', body: `${long}\0` },
        { name: 'truncated', body: 'l' },
        { name: 'package/plain.js', body: '' },
      ]),
    );

    assert.deepEqual(
      entries.map(({ path }) => path),
      [
        'package/lib/file.js',
        `package/ünïcode-${'x'.repeat(100)}.js`,
        long,
        'package/plain.js',
      ],
    );
  });
});

describe('packageFiles', () => {
  it('keys files below their top directory, keeps a BOM, and lets a later duplicate win', () => {
    const read = packageFiles(
      readTar(
        tar([
          { name: 'package/index.js', body: '﻿first' },
          { name: 'node/README.md', body: 'readme', mode: 0o755 },
          { name: 'package/index.js', body: '﻿second' },
        ]),
      ),
    );

    assert.deepEqual(
      [...read],
      [
        ['index.js', { content: '﻿second', mode: '100644' }],
        ['README.md', { content: 'readme', mode: '100755' }],
      ],
    );
  });
});

describe('shouldPrintPatch', () => {
  it('skips known binary extensions, reading a dotfile whole as its extension', () => {
    assert.equal(shouldPrintPatch('dist/index.js'), true);
    assert.equal(shouldPrintPatch('images/logo.png'), false);
    assert.equal(shouldPrintPatch('.png'), false);
    assert.equal(shouldPrintPatch('lib/.npmignore'), true);
    assert.equal(shouldPrintPatch('LICENSE'), true);
  });
});

describe('formatDiff', () => {
  it('prints a changed file with three lines of context', () => {
    const lines = 'one two three four five six seven eight nine ten'.split(' ');

    assert.equal(
      formatDiff({
        a: files(['index.js', `${lines.join('\n')}\n`]),
        b: files([
          'index.js',
          `${lines.map((line) => (line === 'five' ? 'FIVE' : line)).join('\n')}\n`,
        ]),
        versions,
      }),
      'diff --git a/index.js b/index.js\nindex v1.0.0..v1.0.1 100644\n--- a/index.js\n+++ b/index.js\n@@ -2,7 +2,7 @@\n two\n three\n four\n-five\n+FIVE\n six\n seven\n eight',
    );
  });

  it("prints removed files in the old tarball's order, then added ones", () => {
    assert.equal(
      formatDiff({
        a: files(['old.js', 'gone\n'], ['same.js', 'same\n']),
        b: files(['same.js', 'same\n'], ['new.js', 'fresh\nfile\n']),
        versions: { a: '1.0.0', b: '2.0.0' },
      }),
      'diff --git a/old.js b/old.js\ndeleted file mode 100644\nindex v1.0.0..v2.0.0 \n--- a/old.js\n+++ b/old.js\n@@ -1,1 +0,0 @@\n-gone\ndiff --git a/new.js b/new.js\nnew file mode 100644\nindex v1.0.0..v2.0.0 \n--- a/new.js\n+++ b/new.js\n@@ -0,0 +1,2 @@\n+fresh\n+file',
    );
  });

  it('prints a mode change without hunks', () => {
    assert.equal(
      formatDiff({
        a: files(['bin/cli.js', '#!/usr/bin/env node\n', '100644']),
        b: files(['bin/cli.js', '#!/usr/bin/env node\n', '100755']),
        versions: { a: '1.0.0', b: '1.1.0' },
      }),
      'diff --git a/bin/cli.js b/bin/cli.js\nold mode 100644\nnew mode 100755\nindex v1.0.0..v1.1.0 \n--- a/bin/cli.js\n+++ b/bin/cli.js',
    );
  });

  it('prints only the headers of a binary file and a binary dotfile', () => {
    assert.equal(
      formatDiff({
        a: files(
          ['logo.png', '\u0089PNG one'],
          ['.npmignore', 'a\n'],
          ['.png', 'x'],
        ),
        b: files(
          ['logo.png', '\u0089PNG two'],
          ['.npmignore', 'b\n'],
          ['.png', 'y'],
        ),
        versions,
      }),
      'diff --git a/logo.png b/logo.png\nindex v1.0.0..v1.0.1 100644\n--- a/logo.png\n+++ b/logo.png\ndiff --git a/.npmignore b/.npmignore\nindex v1.0.0..v1.0.1 100644\n--- a/.npmignore\n+++ b/.npmignore\n@@ -1,1 +1,1 @@\n-a\n+b\ndiff --git a/.png b/.png\nindex v1.0.0..v1.0.1 100644\n--- a/.png\n+++ b/.png',
    );
  });

  it('marks a missing final newline and strips a tab that ends a line', () => {
    assert.equal(
      formatDiff({
        a: files(['README.md', 'title\t\nbody']),
        b: files(['README.md', 'title\t\nbody\n']),
        versions,
      }),
      'diff --git a/README.md b/README.md\nindex v1.0.0..v1.0.1 100644\n--- a/README.md\n+++ b/README.md\n@@ -1,2 +1,2 @@\n title\n-body\n\\ No newline at end of file\n+body',
    );
  });

  it('prints an empty file gaining content, and nothing for unchanged files', () => {
    assert.equal(
      formatDiff({
        a: files(['empty.txt', ''], ['same.js', 'same\n']),
        b: files(['empty.txt', 'now\n'], ['same.js', 'same\n']),
        versions: { a: '0.1.0', b: '0.2.0' },
      }),
      'diff --git a/empty.txt b/empty.txt\nindex v0.1.0..v0.2.0 100644\n--- a/empty.txt\n+++ b/empty.txt\n@@ -0,0 +1,1 @@\n+now',
    );
    assert.equal(
      formatDiff({
        a: files(['same.js', 'same\n']),
        b: files(['same.js', 'same\n']),
        versions,
      }),
      '',
    );
  });
});

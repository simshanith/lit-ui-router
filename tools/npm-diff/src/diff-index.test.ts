import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { indexPatch } from './diff-index.ts';
import { formatDiff } from './format-diff.ts';
import { files } from './npm-diff-fixtures.ts';

const encoder = new TextEncoder();

const decoder = new TextDecoder();

type Entry = readonly [string, string];

const patchOf = (a: readonly Entry[], b: readonly Entry[]) =>
  encoder.encode(
    `${formatDiff({ a: files(...a), b: files(...b), versions: { a: '1.0.0', b: '2.0.0' } })}\n`,
  );

describe('indexPatch', () => {
  const patch = patchOf(
    [
      ['gone.js', 'old\n'],
      ['src/ünï.ts', 'const a = 1;\nconst b = 2;\n'],
      ['logo.png', 'one'],
      ['dir b/x b/y.js', 'x\n'],
    ],
    [
      ['src/ünï.ts', 'const a = 1;\nconst b = 3;\nconst c = 4;\n'],
      ['logo.png', 'two'],
      ['dir b/x b/y.js', 'y\n'],
      ['new.md', '# new\n\n- diff --git a/fake b/fake\n'],
    ],
  );

  const index = indexPatch(patch);

  it('lists each file in patch order with its kind and line counts', () => {
    assert.deepEqual(
      index.files.map(({ path, kind, added, removed }) => [
        path,
        kind,
        added,
        removed,
      ]),
      [
        ['gone.js', 'deleted', 0, 1],
        ['src/ünï.ts', 'modified', 2, 1],
        ['logo.png', 'modified', 0, 0],
        ['dir b/x b/y.js', 'modified', 1, 1],
        ['new.md', 'added', 3, 0],
      ],
    );
  });

  it('tiles the patch with byte ranges, each starting at its header', () => {
    assert.equal(index.bytes, patch.length);
    assert.equal(index.files[0]?.offset, 0);

    for (const [i, file] of index.files.entries()) {
      const next = index.files[i + 1];

      assert.equal(file.offset + file.length, next?.offset ?? patch.length);
      assert.ok(
        decoder
          .decode(patch.subarray(file.offset, file.offset + file.length))
          .startsWith(`diff --git a/${file.path} b/${file.path}\n`),
      );
    }
  });

  it('counts bytes, not characters, past a multibyte path', () => {
    const unicode = index.files[1];
    const binary = index.files[2];

    assert.ok(unicode && binary);
    assert.equal(
      binary.offset,
      unicode.offset +
        encoder.encode(
          decoder.decode(
            patch.subarray(unicode.offset, unicode.offset + unicode.length),
          ),
        ).length,
    );
  });

  it('indexes an empty patch as no files', () => {
    assert.deepEqual(indexPatch(new Uint8Array()), { files: [], bytes: 0 });
  });
});

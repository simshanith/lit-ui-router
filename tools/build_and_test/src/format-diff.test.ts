import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import type { FormatFinding } from './format-annotations.core.ts';
import { writePatch } from './format-diff.ts';

const finding = (file: string): FormatFinding => ({
  file,
  sources: [{ tool: 'oxfmt', directory: '', path: file }],
});

describe('writePatch', () => {
  it('replaces a stale patch with this session’s fixes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'format-diff-'));
    const path = join(dir, '.turbo/format.patch');

    try {
      assert.equal(
        writePatch([{ ...finding('old.ts'), patch: 'OLD\n' }], path)?.files,
        1,
      );

      const note = writePatch(
        [{ ...finding('a.ts'), patch: 'A\n' }, finding('b.ts')],
        path,
      );

      assert.equal(readFileSync(path, 'utf8'), 'A\n');
      assert.equal(note?.files, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('removes a stale patch when nothing was diffed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'format-diff-'));
    const path = join(dir, 'format.patch');

    try {
      writeFileSync(path, 'stale\n');

      assert.equal(writePatch([finding('a.ts')], path), undefined);
      assert.equal(existsSync(path), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

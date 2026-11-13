import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { preamble } from './changelog.ts';

const dir = mkdtempSync(join(tmpdir(), 'changelog-cli-'));

const file = join(dir, 'CHANGELOG.md');

const notes = join(dir, 'notes.md');

after(() => rmSync(dir, { recursive: true, force: true }));

function run(script: string, args: readonly string[]) {
  return spawnSync(
    process.execPath,
    [fileURLToPath(new URL(script, import.meta.url)), ...args],
    { encoding: 'utf8' },
  );
}

describe('write-section and extract', () => {
  it('writes a section the extract CLI prints back verbatim', () => {
    writeFileSync(
      file,
      `${preamble('lit-ui-router')}\n\n## 1.0.0 (2026-01-01)\n\n* first\n`,
    );
    writeFileSync(notes, '### Features\n\n* `@name` stays as written\n');

    const write = run('./write-section.ts', [
      '--file',
      file,
      '--package',
      'lit-ui-router',
      '--version',
      '1.1.0',
      '--notes',
      notes,
      '--date',
      '2026-11-12T23:59:59Z',
    ]);

    assert.equal(write.status, 0, write.stderr);
    assert.match(readFileSync(file, 'utf8'), /^## 1\.1\.0 \(2026-11-12\)$/m);

    const extract = run('./extract.ts', ['--file', file, '--version', '1.1.0']);

    assert.equal(extract.status, 0, extract.stderr);
    assert.equal(
      extract.stdout,
      '### Features\n\n* `@name` stays as written\n',
    );
  });

  it('fails without printing when the version has no section', () => {
    const extract = run('./extract.ts', ['--file', file, '--version', '9.9.9']);

    assert.equal(extract.status, 1);
    assert.equal(extract.stdout, '');
    assert.match(extract.stderr, /has no 9\.9\.9 section/);
  });
});

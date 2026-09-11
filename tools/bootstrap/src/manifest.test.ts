// The branches worth pinning are the ones that decide between "no manifest
// here" and "something is wrong": every caller treats undefined as a routine
// answer, so an error class that leaks through as undefined would read as an
// absent package rather than a broken one.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { readManifest, requireManifest } from './manifest.ts';

function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'manifest-test-'));
}

describe('readManifest', () => {
  it('parses the manifest in a directory', () => {
    const dir = scratch();
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'pkg', version: '1.2.3' }),
    );
    assert.deepEqual(readManifest(dir), { name: 'pkg', version: '1.2.3' });
  });

  it('returns undefined when there is no package.json (ENOENT)', () => {
    assert.equal(readManifest(scratch()), undefined);
  });

  it('returns undefined when the path is not a directory (ENOTDIR)', () => {
    const dir = scratch();
    const file = join(dir, 'not-a-dir');
    writeFileSync(file, 'x');
    assert.equal(readManifest(file), undefined);
  });

  it('rethrows anything that is not absence, rather than reporting absence', () => {
    // a directory named package.json reads as EISDIR: the manifest is not
    // missing, the layout is wrong, and undefined would hide that
    const dir = scratch();
    mkdirSync(join(dir, 'package.json'));
    assert.throws(
      () => readManifest(dir),
      (error: NodeJS.ErrnoException) => {
        assert.equal(error.code, 'EISDIR');
        return true;
      },
    );
  });

  it('names the file when the JSON is malformed', () => {
    const dir = scratch();
    const file = join(dir, 'package.json');
    writeFileSync(file, '{ not json');
    assert.throws(() => readManifest(dir), {
      message: `${file}: not valid JSON`,
    });
  });
});

describe('requireManifest', () => {
  it('returns the manifest when one exists', () => {
    const dir = scratch();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'pkg' }));
    assert.deepEqual(requireManifest(dir), { name: 'pkg' });
  });

  it('names the directory it looked in when there is none', () => {
    const dir = scratch();
    assert.throws(() => requireManifest(dir), {
      message: `no package.json in ${dir}`,
    });
  });
});

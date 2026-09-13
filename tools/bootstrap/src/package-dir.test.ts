// The walk-up earns its keep only if it stops at the nearest manifest and says
// so when there is none: a silent climb past the package is the `..` bug it
// replaces, wearing a different spelling.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import { readManifest } from './manifest.ts';
import { packageDir } from './package-dir.ts';

// realpath: macOS tmpdir is a symlink, and fileURLToPath does not resolve one
function scratch(): string {
  return realpathSync(mkdtempSync(join(tmpdir(), 'package-dir-test-')));
}

describe('packageDir', () => {
  it('is this package, from this module', () => {
    const dir = packageDir(import.meta.url);
    assert.equal(readManifest(dir)?.name, '@tools/bootstrap');
  });

  it('stops at the nearest manifest, not the outermost', () => {
    const outer = scratch();
    writeFileSync(join(outer, 'package.json'), '{"name":"outer"}');
    const inner = join(outer, 'nested');
    mkdirSync(inner);
    writeFileSync(join(inner, 'package.json'), '{"name":"inner"}');
    const url = pathToFileURL(join(inner, 'src', 'mod.ts')).href;
    assert.equal(packageDir(url), inner);
  });

  it('names the module when nothing above it has a package.json', () => {
    // nothing above tmpdir carries one, so the climb runs out at the root
    const url = pathToFileURL(join(scratch(), 'mod.ts')).href;
    assert.throws(() => packageDir(url), {
      message: `no package.json at or above ${url}`,
    });
  });
});

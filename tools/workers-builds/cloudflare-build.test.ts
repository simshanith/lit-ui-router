// Fixture-only: that the derived spec agrees with the repo's other pnpm pins
// is pnpm-pin.test.ts's job, so nothing here reads the real root.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { pnpmSpec } from './cloudflare-build.ts';

const rootWith = (packageManager?: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'cloudflare-build-'));
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(packageManager === undefined ? {} : { packageManager }),
  );
  return dir;
};

describe('pnpmSpec', () => {
  it('drops the integrity hash npm has no use for', () => {
    assert.equal(
      pnpmSpec(rootWith('pnpm@12.3.4+sha512.961aa41fb077da3a')),
      'pnpm@12.3.4',
    );
  });

  it('passes through a pin with no hash', () => {
    assert.equal(pnpmSpec(rootWith('pnpm@12.3.4')), 'pnpm@12.3.4');
  });

  // Bootstrapping the wrong package manager would fail deep inside the build,
  // where the message is about a missing binary rather than the manifest.
  it('rejects a manifest that names another package manager', () => {
    assert.throws(() => pnpmSpec(rootWith('yarn@4.0.0')), /not a pnpm pin/);
  });

  it('rejects a manifest with no packageManager at all', () => {
    assert.throws(() => pnpmSpec(rootWith()), /not a pnpm pin/);
  });
});

// SKIP_DEPENDENCY_INSTALL=1 means this script loads with no node_modules, which
// `.oxlintrc.json` guards per-specifier. oxlint's no-restricted-imports reads
// string literals only, so `import(spec)` slips past it; loading the script
// outside the repo catches every form. The tree is mirrored rather than
// flattened because the one allowed exception is a relative reach across a
// package boundary — copying it in is what puts that reach under test.
describe('cloudflare-build.ts resolution', () => {
  const PACKAGE_DIR = 'tools/workers-builds';
  const BOOTSTRAP_DIR = 'tools/bootstrap/src';

  it('loads with no node_modules on any parent', async () => {
    const root = new URL('../../', import.meta.url);
    const bootstrap = new URL(`${BOOTSTRAP_DIR}/`, root);
    const sources = (await readdir(bootstrap)).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    );

    const dir = await mkdtemp(join(tmpdir(), 'cloudflare-build-resolution-'));
    try {
      await mkdir(join(dir, PACKAGE_DIR), { recursive: true });
      await mkdir(join(dir, BOOTSTRAP_DIR), { recursive: true });
      await copyFile(
        fileURLToPath(new URL('./cloudflare-build.ts', import.meta.url)),
        join(dir, PACKAGE_DIR, 'cloudflare-build.ts'),
      );
      for (const name of sources) {
        await copyFile(
          fileURLToPath(new URL(name, bootstrap)),
          join(dir, BOOTSTRAP_DIR, name),
        );
      }
      // `import.meta.main` is false for an imported module, so this resolves
      // the graph without running the build steps.
      await writeFile(
        join(dir, 'load.mjs'),
        `await import('./${PACKAGE_DIR}/cloudflare-build.ts');\n`,
      );

      await promisify(execFile)(process.execPath, [join(dir, 'load.mjs')], {
        cwd: dir,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

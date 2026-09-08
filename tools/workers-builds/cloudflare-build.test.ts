// Fixture-only: that the derived spec agrees with the repo's other pnpm pins
// is pnpm-pin.test.ts's job, so nothing here reads the real root.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

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

// A claim is only worth declaring if the loop bundles the entry it names, so
// the manifest reader is pinned on the keys the entry loop skips.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readPackageProbe } from './entries.ts';

const packageWith = (bundleProbe: Record<string, unknown>): string => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bundle-probe-entries-'));
  mkdirSync(path.join(dir, 'src'));
  writeFileSync(path.join(dir, 'src', 'index.ts'), 'export const a = 1;\n');
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'probe-fixture',
      exports: {
        '.': './dist/index.js',
        './dist/*': './dist/*',
        './package.json': './package.json',
      },
      bundleProbe,
    }),
  );
  return dir;
};

describe('readPackageProbe claims', () => {
  it('attaches a claim to the entry it names', () => {
    const { entries } = readPackageProbe(
      packageWith({ '.': { free: ['lit'] } }),
    );
    assert.deepEqual(
      entries.map(({ label, free }) => ({ label, free })),
      [{ label: 'index', free: ['lit'] }],
    );
  });

  it('rejects a claim on an export the entry loop skips', () => {
    for (const subpath of ['./package.json', './dist/*']) {
      assert.throws(
        () => readPackageProbe(packageWith({ [subpath]: { free: ['lit'] } })),
        new RegExp(
          `'${subpath.replace('*', '\\*')}', which is not a bundled export`,
        ),
      );
    }
  });

  it('rejects a claim on a subpath the exports map lacks', () => {
    assert.throws(
      () => readPackageProbe(packageWith({ './missing': { free: ['lit'] } })),
      /'\.\/missing', which is not a bundled export/,
    );
  });
});

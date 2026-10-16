// A claim is only worth declaring if the loop bundles the entry it names, so
// the manifest reader is pinned on the keys the entry loop skips.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { ExportsTarget } from '@tools/bootstrap/types.ts';

import { readPackageProbe, type BundleProbeClaims } from './entries.ts';

const packageWith = (
  bundleProbe: BundleProbeClaims,
  root: ExportsTarget = './dist/index.js',
): string => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bundle-probe-entries-'));
  mkdirSync(path.join(dir, 'dist', 'node'), { recursive: true });
  writeFileSync(path.join(dir, 'dist', 'index.js'), 'export const a = 1;\n');
  writeFileSync(
    path.join(dir, 'dist', 'node', 'index.js'),
    'export const a = 1;\n',
  );
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'probe-fixture',
      exports: {
        '.': root,
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

  it('adds an entry per claimed condition, under the same free claims', () => {
    const { entries } = readPackageProbe(
      packageWith(
        { '.': { free: ['lit'], conditions: ['node'] } },
        { node: './dist/node/index.js', default: './dist/index.js' },
      ),
    );

    assert.deepEqual(
      entries.map(({ label, file, free }) => ({
        label,
        file: path.basename(path.dirname(file)),
        free,
      })),
      [
        { label: 'index', file: 'dist', free: ['lit'] },
        { label: 'index-node', file: 'node', free: ['lit'] },
      ],
    );
  });

  it('rejects a condition the export lacks or points outside dist', () => {
    const roots: ExportsTarget[] = [
      './dist/index.js',
      { default: './dist/index.js' },
      { node: './src/index.ts', default: './dist/index.js' },
    ];

    for (const root of roots) {
      assert.throws(
        () =>
          readPackageProbe(
            packageWith({ '.': { conditions: ['node'] } }, root),
          ),
        /condition 'node' on '\.' names no dist\/\*\.js target/,
      );
    }
  });

  it('rejects a condition whose target is not built', () => {
    assert.throws(
      () =>
        readPackageProbe(
          packageWith(
            { '.': { conditions: ['deno'] } },
            { deno: './dist/deno/index.js', default: './dist/index.js' },
          ),
        ),
      /condition 'deno' resolves to missing \.\/dist\/deno\/index\.js/,
    );
  });
});

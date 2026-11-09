import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { Json } from '@tools/bootstrap/types.ts';

import { packagePaths } from './resolution.ts';

const withManifest = (manifest: Json): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-example-check-'));

  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest));

  return dir;
};

describe('packagePaths', () => {
  it('maps each export subpath to its types target', () => {
    const dir = withManifest({
      exports: {
        '.': { types: './dist/index.d.ts', default: './dist/index.js' },
        './pure': { types: './dist/pure.d.ts', default: './dist/pure.js' },
        './source': './src/source.ts',
        './plain': './dist/plain.js',
        './package.json': './package.json',
      },
    });

    assert.deepEqual(Object.fromEntries(packagePaths('pkg', dir)), {
      pkg: [path.join(dir, 'dist/index.d.ts')],
      'pkg/pure': [path.join(dir, 'dist/pure.d.ts')],
      'pkg/source': [path.join(dir, 'src/source.ts')],
      'pkg/plain': [path.join(dir, 'dist/plain.d.ts')],
    });
  });

  it('treats a conditions-only exports object as the root export', () => {
    const dir = withManifest({
      exports: { types: './index.d.ts', default: './index.js' },
    });

    assert.deepEqual(Object.fromEntries(packagePaths('pkg', dir)), {
      pkg: [path.join(dir, 'index.d.ts')],
    });
  });

  it('falls back to the package directory without exports', () => {
    const dir = withManifest({ types: './index.d.ts' });

    assert.deepEqual(Object.fromEntries(packagePaths('pkg', dir)), {
      pkg: [dir],
      'pkg/*': [path.join(dir, '*')],
    });
  });
});

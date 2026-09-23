import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { STAGING_SKIP, keepEntry } from './pack-staged.core.ts';

describe('keepEntry', () => {
  it('keeps publish-shape entries', () => {
    for (const name of ['index.js', 'dist', 'src', 'package.json']) {
      assert.equal(keepEntry(`/abs/path/to/pkg/${name}`), true, name);
    }
  });

  it('skips every STAGING_SKIP name', () => {
    assert.deepEqual([...STAGING_SKIP].sort(), [
      '.cache',
      '.turbo',
      '.vitest',
      'coverage',
      'node_modules',
    ]);
    for (const name of STAGING_SKIP) {
      assert.equal(keepEntry(`/abs/path/to/pkg/${name}`), false, name);
    }
  });

  it('skips stale tarballs', () => {
    assert.equal(keepEntry('/abs/path/to/pkg/foo.tgz'), false);
  });

  it('matches on the basename only', () => {
    assert.equal(keepEntry('/abs/path/to/pkg/coverage'), false);
    assert.equal(keepEntry('/abs/path/to/pkg/src/coverage.ts'), true);
  });
});

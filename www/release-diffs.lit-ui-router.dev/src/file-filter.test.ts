import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type FileFilter, filtersOf, matchesFilter } from './file-filter.ts';

// lit-ui-router 1.17.0's tarball shape, one of each kind.
const PATHS = [
  'LICENSE',
  'README.md',
  'package.json',
  'custom-elements.json',
  'src/core.ts',
  'src/directives/ui-sref.ts',
  'dist/core.js',
  'dist/core.js.map',
  'dist/core.d.ts',
  'dist/core.d.ts.map',
] as const;

const shown = (filter: FileFilter) =>
  PATHS.filter((path) => matchesFilter(filter, path));

describe('the diff page file presets', () => {
  it('shows src and the root files under Source', () => {
    assert.deepEqual(shown('src'), [
      'LICENSE',
      'README.md',
      'package.json',
      'custom-elements.json',
      'src/core.ts',
      'src/directives/ui-sref.ts',
    ]);
  });

  it('shows built JavaScript under Published JS and declarations under Types', () => {
    assert.deepEqual(shown('js'), ['dist/core.js']);
    assert.deepEqual(shown('types'), ['dist/core.d.ts']);
  });

  it('leaves source maps to All', () => {
    assert.deepEqual(shown('all'), PATHS);
    assert.deepEqual(filtersOf('dist/core.js.map'), ['all']);
  });

  it('lists every preset a file belongs to, in preset order', () => {
    assert.deepEqual(filtersOf('README.md'), ['src', 'all']);
    assert.deepEqual(filtersOf('dist/core.d.mts'), ['types', 'all']);
  });
});

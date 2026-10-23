import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  comparePaths,
  filterCounts,
  filterOf,
  matchesFilter,
  urlWithFilter,
} from '../releases/npm-diff/file-filter.ts';

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

const shown = (filter: Parameters<typeof matchesFilter>[0]) =>
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
    assert.deepEqual(filterCounts(PATHS), { src: 6, js: 1, types: 1, all: 10 });
  });

  it('reads the preset from the search, defaulting to Source', () => {
    assert.equal(filterOf(''), 'src');
    assert.equal(filterOf('?files=types'), 'types');
    assert.equal(filterOf('?files=nope'), 'src');
  });

  it('names a preset other than the default in the url', () => {
    const base = 'https://lit-ui-router.dev/releases/x/diff/1.0.0...1.1.0/';

    assert.equal(urlWithFilter(`${base}#top`, 'js'), `${base}?files=js#top`);
    assert.equal(
      urlWithFilter(`${base}?files=js&ref=a`, 'src'),
      `${base}?ref=a`,
    );
  });

  it('orders paths as the tree lists them: directories first, then natural order', () => {
    assert.deepEqual(
      [
        'package.json',
        'src/z.ts',
        'dist/b/x.js',
        'dist/a10.js',
        'dist/a2.js',
        'README.md',
      ].sort(comparePaths),
      [
        'dist/b/x.js',
        'dist/a2.js',
        'dist/a10.js',
        'src/z.ts',
        'package.json',
        'README.md',
      ],
    );
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  comparePaths,
  filterCounts,
  filterNamed,
  shows,
} from '../releases/npm-diff/file-filter.ts';

// Index entries as the release-diffs worker lists their presets.
const FILES = [
  { path: 'package.json', filters: ['src', 'all'] },
  { path: 'src/core.ts', filters: ['src', 'all'] },
  { path: 'dist/core.js', filters: ['js', 'all'] },
  { path: 'dist/core.d.ts', filters: ['types', 'all'] },
  { path: 'dist/core.js.map', filters: ['all'] },
] as const;

describe('the diff page file presets', () => {
  it('shows the files whose index entry lists the preset', () => {
    assert.deepEqual(
      FILES.flatMap((file) => (shows('src', file) ? [file.path] : [])),
      ['package.json', 'src/core.ts'],
    );
    assert.ok(!shows('types', FILES[2]));
  });

  it('counts each preset from the index', () => {
    assert.deepEqual(filterCounts(FILES), { src: 2, js: 1, types: 1, all: 5 });
  });

  it('reads the preset a param names, defaulting to Source', () => {
    assert.equal(filterNamed(undefined), 'src');
    assert.equal(filterNamed('types'), 'types');
    assert.equal(filterNamed('nope'), 'src');
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

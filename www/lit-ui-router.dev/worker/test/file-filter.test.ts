import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  comparePaths,
  filterCounts,
  filterOf,
  shows,
  urlWithFilter,
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

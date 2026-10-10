import assert from 'node:assert/strict';
import { test } from 'node:test';

import { samplePages } from './pages.ts';

test('samplePages keeps every page outside the API reference', () => {
  const paths = ['/', '/guides/', '/guides/a', '/guides/b', '/404'];

  assert.deepEqual(samplePages(paths), [...paths].sort());
});

test('samplePages keeps the first page of each API reference directory', () => {
  const paths = [
    '/api/reference/types/B',
    '/api/reference/types/A',
    '/api/reference/core/X',
    '/api/reference/',
    '/api/',
  ];

  assert.deepEqual(samplePages(paths), [
    '/api/',
    '/api/reference/',
    '/api/reference/core/X',
    '/api/reference/types/A',
  ]);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { samplePages } from './pages.ts';

test('samplePages keeps every page outside the API reference', () => {
  const paths = ['/', '/guides/', '/guides/a', '/guides/b', '/404'];

  assert.deepEqual(samplePages(paths), [...paths].sort());
});

test('samplePages keeps the first API reference page of each kind', () => {
  const paths = [
    '/api/reference/types/B',
    '/api/reference/types/A',
    '/api/server/matcher/interfaces/Y',
    '/api/reference/interfaces/X',
    '/api/server/matcher/',
    '/api/server/connect/',
    '/api/server/',
    '/api/reference/',
    '/api/',
  ];

  assert.deepEqual(samplePages(paths), [
    '/api/',
    '/api/reference/',
    '/api/reference/interfaces/X',
    '/api/reference/types/A',
    '/api/server/connect/',
  ]);
});

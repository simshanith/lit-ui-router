import assert from 'node:assert/strict';
import { test } from 'node:test';

import { samplePages } from './pages.ts';

test('samplePages keeps every page outside the API reference', () => {
  const paths = ['/', '/guides/', '/guides/a', '/guides/b', '/404'];

  assert.deepEqual(samplePages(paths), [...paths].sort());
});

test('samplePages keeps the first API reference page of each kind', () => {
  const paths = [
    '/reference/lit-ui-router/types/B',
    '/reference/lit-ui-router/types/A',
    '/reference/ui-router-server/matcher/interfaces/Y',
    '/reference/lit-ui-router/interfaces/X',
    '/reference/ui-router-server/matcher/',
    '/reference/ui-router-server/connect/',
    '/reference/ui-router-server/',
    '/reference/lit-ui-router/',
    '/reference/',
  ];

  assert.deepEqual(samplePages(paths), [
    '/reference/',
    '/reference/lit-ui-router/',
    '/reference/lit-ui-router/interfaces/X',
    '/reference/lit-ui-router/types/A',
    '/reference/ui-router-server/connect/',
  ]);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { turboLogFile } from './turbo-log.ts';

test('names a package task log under its package directory', () => {
  assert.equal(
    turboLogFile('packages/lit-ui-router', 'typecheck:src'),
    'packages/lit-ui-router/.turbo/turbo-typecheck$colon$src.log',
  );
});

test('names a root task log under the repo root', () => {
  assert.equal(
    turboLogFile('', 'format:check:root'),
    '.turbo/turbo-format$colon$check$colon$root.log',
  );
});

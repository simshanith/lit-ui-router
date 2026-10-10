import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assetCandidates,
  runsWorkerFirst,
  workerFirstPatterns,
} from './site.core.ts';

test('workerFirstPatterns reads run_worker_first from JSONC', () => {
  const source = `{
    // comment
    "assets": { "run_worker_first": ["/app", "/app/*",] },
  }`;

  assert.deepEqual(workerFirstPatterns(source), ['/app', '/app/*']);
});

test('workerFirstPatterns rejects a config without the patterns', () => {
  assert.throws(() => workerFirstPatterns('{ "assets": {} }'));
  assert.throws(() => workerFirstPatterns('{ "assets": '));
});

test('runsWorkerFirst matches bare mounts exactly and wildcards below them', () => {
  const patterns = ['/app', '/app/*'];
  assert.equal(runsWorkerFirst(patterns, '/app'), true);
  assert.equal(runsWorkerFirst(patterns, '/app/'), true);
  assert.equal(runsWorkerFirst(patterns, '/app/mymessages/inbox'), true);
  assert.equal(runsWorkerFirst(patterns, '/app-mobx'), false);
  assert.equal(runsWorkerFirst(patterns, '/app.html'), false);
  assert.equal(runsWorkerFirst(patterns, '/guides/'), false);
});

test('assetCandidates follows auto-trailing-slash html handling', () => {
  assert.deepEqual(assetCandidates('/'), ['/index.html']);
  assert.deepEqual(assetCandidates('/guides/'), ['/guides/index.html']);
  assert.deepEqual(assetCandidates('/guides/route-guards'), [
    '/guides/route-guards',
    '/guides/route-guards.html',
    '/guides/route-guards/index.html',
  ]);
});

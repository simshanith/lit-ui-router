import assert from 'node:assert/strict';
import { test } from 'node:test';

import { runsWorkerFirst, workerFirstPatterns } from './worker-first.ts';

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

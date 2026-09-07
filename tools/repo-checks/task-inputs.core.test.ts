import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type AuditableTask,
  auditTaskInputs,
  formatFailure,
  packageFiles,
  unhashedFiles,
} from './task-inputs.core.ts';

const task = (over: Partial<AuditableTask> = {}): AuditableTask => ({
  taskId: 'pkg#test',
  directory: 'packages/pkg',
  command: 'vitest run',
  cache: true,
  inputs: {},
  ...over,
});

const tracked = [
  'packages/pkg/src/index.ts',
  'packages/pkg/vitest.setup.browser.ts',
  'packages/other/src/index.ts',
  'README.md',
];

describe('packageFiles', () => {
  it('rewrites tracked paths package-relative', () => {
    assert.deepEqual(packageFiles(tracked, 'packages/pkg'), [
      'src/index.ts',
      'vitest.setup.browser.ts',
    ]);
  });

  it('gives a root task the whole repo', () => {
    assert.deepEqual(packageFiles(tracked, ''), tracked);
  });
});

describe('unhashedFiles', () => {
  it('reports what the cache key misses', () => {
    assert.deepEqual(
      unhashedFiles(task({ inputs: { 'src/index.ts': 'abc' } }), tracked),
      ['vitest.setup.browser.ts'],
    );
  });

  it('passes when every tracked file is hashed', () => {
    const inputs = { 'src/index.ts': 'a', 'vitest.setup.browser.ts': 'b' };
    assert.deepEqual(unhashedFiles(task({ inputs }), tracked), []);
  });
});

describe('auditTaskInputs', () => {
  const gap = task({ inputs: { 'src/index.ts': 'abc' } });

  it('fails a task with unhashed tracked files', () => {
    const audit = auditTaskInputs([gap], tracked, []);
    assert.deepEqual(audit.failures, [
      { taskId: 'pkg#test', missing: ['vitest.setup.browser.ts'] },
    ]);
    assert.equal(audit.audited, 1);
  });

  it('skips uncacheable tasks and scriptless graph nodes', () => {
    const audit = auditTaskInputs(
      [
        task({ taskId: 'pkg#dev', cache: false }),
        task({ taskId: 'pkg#transit', command: '<NONEXISTENT>' }),
      ],
      tracked,
      [],
    );
    assert.deepEqual(audit.failures, []);
    assert.equal(audit.audited, 0);
  });

  it('exempts by task name, across every package', () => {
    const audit = auditTaskInputs(
      [gap, task({ taskId: 'other#test', directory: 'packages/other' })],
      tracked,
      [{ task: 'test', why: 'because' }],
    );
    assert.deepEqual(audit.failures, []);
    assert.deepEqual(audit.stale, []);
  });

  it('reports an exemption no task needs any more', () => {
    const audit = auditTaskInputs([gap], tracked, [
      { task: 'test', why: 'because' },
      { task: 'lint:markdown', why: 'md only' },
    ]);
    assert.deepEqual(audit.stale, ['lint:markdown']);
  });

  it('sorts failures by task id', () => {
    const audit = auditTaskInputs(
      [
        task({ taskId: 'z-pkg#test' }),
        task({ taskId: 'a-pkg#test', directory: 'packages/other' }),
      ],
      tracked,
      [],
    );
    assert.deepEqual(
      audit.failures.map(({ taskId }) => taskId),
      ['a-pkg#test', 'z-pkg#test'],
    );
  });
});

describe('formatFailure', () => {
  it('names the task, the files and the fix', () => {
    assert.match(
      formatFailure({ taskId: 'pkg#test', missing: ['vitest.setup.ts'] }),
      /^pkg#test does not hash 1 tracked file\(s\).*vitest\.setup\.ts.*\$TURBO_DEFAULT\$/,
    );
  });

  it('truncates a long list', () => {
    const missing = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    assert.match(formatFailure({ taskId: 'pkg#test', missing }), /\+2 more/);
  });
});

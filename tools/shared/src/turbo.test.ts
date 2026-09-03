import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Exec } from './exec.ts';
import { resolvedTaskDeps, splitTaskId } from './turbo.ts';

describe('splitTaskId', () => {
  it('splits package and task, root included', () => {
    assert.deepEqual(splitTaskId('docs#build'), ['docs', 'build']);
    assert.deepEqual(splitTaskId('//#lint:templates'), [
      '//',
      'lint:templates',
    ]);
    assert.deepEqual(splitTaskId('@tools/release#pack:all'), [
      '@tools/release',
      'pack:all',
    ]);
  });

  it('rejects a bare task or package', () => {
    assert.throws(() => splitTaskId('build'));
    assert.throws(() => splitTaskId('docs#'));
  });
});

describe('resolvedTaskDeps', () => {
  const plan = JSON.stringify({
    tasks: [
      { taskId: 'lit-ui-router#docs:api', dependencies: [] },
      {
        taskId: 'docs#build',
        dependencies: ['^build', 'lit-ui-router#docs:api'],
      },
    ],
  });

  it('runs a filtered dry-run and returns the task dependencies', async () => {
    const calls: unknown[] = [];
    const exec: Exec = (command, args) => {
      calls.push([command, args]);
      return Promise.resolve({ stdout: plan, stderr: '' });
    };
    assert.deepEqual(await resolvedTaskDeps('docs#build', exec), [
      '^build',
      'lit-ui-router#docs:api',
    ]);
    assert.deepEqual(calls, [
      ['turbo', ['run', 'build', '--filter=docs', '--dry-run=json']],
    ]);
  });

  it('throws when the plan lacks the task', async () => {
    const exec: Exec = () => Promise.resolve({ stdout: plan, stderr: '' });
    await assert.rejects(resolvedTaskDeps('docs#typecheck', exec), /no task/);
  });
});

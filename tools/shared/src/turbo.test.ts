import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Exec } from './exec.ts';
import { plannedTasks, resolvedTaskDeps, splitTaskId } from './turbo.ts';

describe('splitTaskId', () => {
  it('splits package and task, root included', () => {
    assert.deepEqual(splitTaskId('lit-ui-router.dev#build'), [
      'lit-ui-router.dev',
      'build',
    ]);
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
    assert.throws(() => splitTaskId('lit-ui-router.dev#'));
  });
});

describe('resolvedTaskDeps', () => {
  const plan = JSON.stringify({
    tasks: [
      { taskId: 'lit-ui-router#docs:api', dependencies: [] },
      {
        taskId: 'lit-ui-router.dev#build',
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
    assert.deepEqual(await resolvedTaskDeps('lit-ui-router.dev#build', exec), [
      '^build',
      'lit-ui-router#docs:api',
    ]);
    assert.deepEqual(calls, [
      [
        'turbo',
        ['run', 'build', '--filter=lit-ui-router.dev', '--dry-run=json'],
      ],
    ]);
  });

  it('throws when the plan lacks the task', async () => {
    const exec: Exec = () => Promise.resolve({ stdout: plan, stderr: '' });
    await assert.rejects(
      resolvedTaskDeps('lit-ui-router.dev#typecheck', exec),
      /no task/,
    );
  });
});

describe('plannedTasks', () => {
  const planFor = (name: string) =>
    JSON.stringify({
      tasks: [
        {
          taskId: `lit-ui-router.dev#${name}`,
          directory: 'www/lit-ui-router.dev',
          command: `run ${name}`,
          // the status object turbo emits, truthy even when uncacheable
          cache: { local: false, remote: false, status: 'MISS', timeSaved: 0 },
          resolvedTaskDefinition: { cache: name !== 'dev' },
          inputs: { 'package.json': 'abc' },
        },
      ],
    });

  const undeclared = (name: string) =>
    Object.assign(new Error('turbo failed'), {
      // turbo wraps the message at terminal width
      stderr: `× Missing tasks in project\n  ╰─▶ × Could not find task\n      \`${name}\` in project`,
    });

  it('collects every planned task, keyed by task id', async () => {
    const calls: string[] = [];
    const argv: unknown[] = [];
    const exec: Exec = (command, args) => {
      calls.push(args[1] ?? '');
      argv.push([command, args]);
      return Promise.resolve({ stdout: planFor(args[1] ?? ''), stderr: '' });
    };
    const planned = await plannedTasks(['build', 'test'], exec, 1);
    assert.deepEqual(calls, ['build', 'test']);
    assert.deepEqual(argv, [
      ['turbo', ['run', 'build', '--only', '--dry-run=json']],
      ['turbo', ['run', 'test', '--only', '--dry-run=json']],
    ]);
    assert.deepEqual(
      [...planned.keys()],
      ['lit-ui-router.dev#build', 'lit-ui-router.dev#test'],
    );
    assert.deepEqual(planned.get('lit-ui-router.dev#build')?.inputs, {
      'package.json': 'abc',
    });
  });

  it('skips a script name turbo has no task for', async () => {
    const exec: Exec = (_command, args) =>
      args[1] === 'prepare'
        ? Promise.reject(undeclared('prepare'))
        : Promise.resolve({ stdout: planFor(args[1] ?? ''), stderr: '' });
    const planned = await plannedTasks(['prepare', 'test'], exec, 1);
    assert.deepEqual([...planned.keys()], ['lit-ui-router.dev#test']);
  });

  it('rethrows any other turbo failure', async () => {
    const exec: Exec = () =>
      Promise.reject(
        Object.assign(new Error('turbo failed'), {
          stderr: '× Invalid task configuration',
        }),
      );
    await assert.rejects(plannedTasks(['e2e'], exec, 1), /turbo failed/);
  });

  it('reads cacheability off the resolved definition, not the status object', async () => {
    const exec: Exec = (_command, args) =>
      Promise.resolve({ stdout: planFor(args[1] ?? ''), stderr: '' });
    const planned = await plannedTasks(['dev', 'build'], exec, 1);
    assert.equal(planned.get('lit-ui-router.dev#dev')?.cache, false);
    assert.equal(planned.get('lit-ui-router.dev#build')?.cache, true);
  });

  it('defaults missing plan fields rather than dropping the task', async () => {
    const exec: Exec = () =>
      Promise.resolve({
        stdout: JSON.stringify({ tasks: [{ taskId: '//#lint' }] }),
        stderr: '',
      });
    const planned = await plannedTasks(['lint'], exec, 1);
    assert.deepEqual(planned.get('//#lint'), {
      taskId: '//#lint',
      directory: '',
      command: '',
      cache: true,
      inputs: {},
    });
  });
});

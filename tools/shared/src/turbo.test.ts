import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Exec } from './exec.ts';
import {
  planLanes,
  plannedTasks,
  resolvedTaskDeps,
  splitTaskId,
  undeclaredTaskNames,
} from './turbo.ts';

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

describe('plannedTasks', () => {
  const planFor = (name: string) =>
    JSON.stringify({
      tasks: [
        {
          taskId: `docs#${name}`,
          directory: 'docs',
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
    assert.deepEqual([...planned.keys()], ['docs#build', 'docs#test']);
    assert.deepEqual(planned.get('docs#build')?.inputs, {
      'package.json': 'abc',
    });
  });

  it('skips a script name turbo has no task for', async () => {
    const exec: Exec = (_command, args) =>
      args[1] === 'prepare'
        ? Promise.reject(undeclared('prepare'))
        : Promise.resolve({ stdout: planFor(args[1] ?? ''), stderr: '' });
    const planned = await plannedTasks(['prepare', 'test'], exec, 1);
    assert.deepEqual([...planned.keys()], ['docs#test']);
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
    assert.equal(planned.get('docs#dev')?.cache, false);
    assert.equal(planned.get('docs#build')?.cache, true);
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

describe('undeclaredTaskNames', () => {
  it('collects every name turbo reported at once', () => {
    const stderr =
      '× Missing tasks in project\n' +
      '  ├─▶ × Could not find task `prepare` in project\n' +
      '  ╰─▶ × Could not find task `postinstall` in project';
    assert.deepEqual(undeclaredTaskNames(stderr), ['prepare', 'postinstall']);
  });

  // verbatim turbo 2.10.11, both wrap shapes: the gutter lands between the
  // name and `in project`, and again between `in` and `project`
  it('reads through the wrap gutter', () => {
    const stderr =
      '  × Missing tasks in project\n' +
      '  ├─▶   × Could not find task `example:install:design-system-links`\n' +
      '  │     │ in project\n' +
      '  ╰─▶   × Could not find task `typecheck:hellosolarsystem-mobx` in\n' +
      '        │ project\n';
    assert.deepEqual(undeclaredTaskNames(stderr), [
      'example:install:design-system-links',
      'typecheck:hellosolarsystem-mobx',
    ]);
  });

  it('rejoins a name the wrap split', () => {
    const stderr =
      '× Could not find task `example:install:\n  │     │ hellosolarsystem` in project';
    assert.deepEqual(undeclaredTaskNames(stderr), [
      'example:install:hellosolarsystem',
    ]);
  });

  it('finds nothing in an unrelated failure', () => {
    assert.deepEqual(undeclaredTaskNames('× Invalid task configuration'), []);
  });
});

describe('planLanes', () => {
  // the failure this guard exists for: turbo rejects the whole run up front
  const persistent =
    '  × Invalid task configuration\n' +
    '  ╰─▶ × "docs#docs" is a persistent task, "sample-app-lit-e2e#e2e"\n' +
    '      │ cannot depend on it';

  it('plans every lane in one run, without --only', async () => {
    const argv: unknown[] = [];
    const exec: Exec = (command, args) => {
      argv.push([command, args]);
      return Promise.resolve({ stdout: '{}', stderr: '' });
    };
    assert.deepEqual(await planLanes(['build', 'e2e'], exec), {
      planned: ['build', 'e2e'],
    });
    assert.deepEqual(argv, [
      ['turbo', ['run', 'build', 'e2e', '--dry-run=json']],
    ]);
  });

  it('drops undeclared names and retries once', async () => {
    const argv: string[][] = [];
    const exec: Exec = (_command, args) => {
      argv.push([...args]);
      return argv.length === 1
        ? Promise.reject(
            Object.assign(new Error('turbo failed'), {
              stderr: '× Could not find task `prepare` in project',
            }),
          )
        : Promise.resolve({ stdout: '{}', stderr: '' });
    };
    assert.deepEqual(await planLanes(['build', 'prepare'], exec), {
      planned: ['build'],
    });
    assert.deepEqual(argv, [
      ['run', 'build', 'prepare', '--dry-run=json'],
      ['run', 'build', '--dry-run=json'],
    ]);
  });

  it('reports an invalid edge instead of retrying it away', async () => {
    let calls = 0;
    const exec: Exec = () => {
      calls += 1;
      return Promise.reject(
        Object.assign(new Error('turbo failed'), { stderr: persistent }),
      );
    };
    const { planned, failure } = await planLanes(['e2e'], exec);
    assert.deepEqual(planned, []);
    assert.match(failure ?? '', /persistent task/);
    assert.equal(calls, 1);
  });

  it('reports an invalid edge the retry uncovers', async () => {
    const exec: Exec = (_command, args) =>
      args.includes('prepare')
        ? Promise.reject(
            Object.assign(new Error('turbo failed'), {
              stderr: '× Could not find task `prepare` in project',
            }),
          )
        : Promise.reject(
            Object.assign(new Error('turbo failed'), { stderr: persistent }),
          );
    const { planned, failure } = await planLanes(['e2e', 'prepare'], exec);
    assert.deepEqual(planned, []);
    assert.match(failure ?? '', /persistent task/);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Exec } from './exec.ts';
import {
  planLanes,
  plannedTasks,
  resolvedTaskDeps,
  splitTaskId,
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

  // CI gets ASCII box drawing, a UTF-8 terminal the box characters; the name
  // must be read out of either gutter
  it('skips a script name reported through the ASCII gutter', async () => {
    const exec: Exec = (_command, args) =>
      args[1] === 'prepare'
        ? Promise.reject(
            Object.assign(new Error('turbo failed'), {
              stderr:
                '  x Missing tasks in project\n' +
                '  `->   x Could not find task `prep\n' +
                '        | are` in project\n',
            }),
          )
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

describe('planLanes', () => {
  // the failure this guard exists for: turbo rejects the whole run up front
  const persistent =
    '  × Invalid task configuration\n' +
    '  ╰─▶ × "docs#docs" is a persistent task, "sample-app-lit-e2e#e2e"\n' +
    '      │ cannot depend on it';

  // `--only` per lane classifies it, then one run without the flag validates
  // the edges that flag would have stripped
  it('classifies each lane, then plans them together without --only', async () => {
    const argv: string[][] = [];
    const exec: Exec = (_command, args) => {
      argv.push([...args]);
      return Promise.resolve({ stdout: '{}', stderr: '' });
    };
    assert.deepEqual(await planLanes(['build', 'e2e'], exec), {
      planned: ['build', 'e2e'],
    });
    assert.deepEqual(argv, [
      ['run', 'build', '--only', '--dry-run=json'],
      ['run', 'e2e', '--only', '--dry-run=json'],
      ['run', 'build', 'e2e', '--dry-run=json'],
    ]);
  });

  // under --only a lane can only fail one way, so the exit code is the whole
  // signal — no turbo prose is read to decide this
  it('drops a lane whose --only run fails, whatever it printed', async () => {
    const argv: string[][] = [];
    const exec: Exec = (_command, args) => {
      argv.push([...args]);
      return args.includes('prepare')
        ? Promise.reject(new Error('exit 1'))
        : Promise.resolve({ stdout: '{}', stderr: '' });
    };
    assert.deepEqual(await planLanes(['build', 'prepare'], exec), {
      planned: ['build'],
    });
    assert.deepEqual(argv.at(-1), ['run', 'build', '--dry-run=json']);
  });

  it('keeps the caller order however the lanes resolve', async () => {
    const exec: Exec = (_command, args) =>
      args.includes('prepare')
        ? Promise.reject(new Error('exit 1'))
        : Promise.resolve({ stdout: '{}', stderr: '' });
    const { planned } = await planLanes(
      ['test', 'prepare', 'build', 'e2e'],
      exec,
    );
    assert.deepEqual(planned, ['test', 'build', 'e2e']);
  });

  it('reports an invalid edge the combined plan rejects', async () => {
    const exec: Exec = (_command, args) =>
      args.includes('--only')
        ? Promise.resolve({ stdout: '{}', stderr: '' })
        : Promise.reject(
            Object.assign(new Error('turbo failed'), { stderr: persistent }),
          );
    const { planned, failure } = await planLanes(['e2e', 'build'], exec);
    assert.deepEqual(planned, []);
    assert.match(failure ?? '', /persistent task/);
  });

  it('reports a failure that carries no stderr', async () => {
    const exec: Exec = (_command, args) =>
      args.includes('--only')
        ? Promise.resolve({ stdout: '{}', stderr: '' })
        : Promise.reject(new Error('turbo exploded'));
    const { failure } = await planLanes(['build'], exec);
    assert.match(failure ?? '', /turbo exploded/);
  });

  // every lane failing means turbo planned nothing; the caller fails closed on
  // it, so planLanes must not run the combined plan and call that a pass
  it('plans nothing when no lane is declared', async () => {
    let calls = 0;
    const exec: Exec = () => {
      calls += 1;
      return Promise.reject(new Error('exit 1'));
    };
    assert.deepEqual(await planLanes(['prepare', 'postinstall'], exec), {
      planned: [],
    });
    assert.equal(calls, 2);
  });
});

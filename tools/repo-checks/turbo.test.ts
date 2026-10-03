import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Exec } from '@tools/shared/exec.ts';
import {
  declaredLanes,
  nonPersistentWith,
  planFailure,
  plannedLanes,
  plannedTasks,
  resolvedTaskDeps,
  splitTaskId,
} from './turbo.ts';

describe('splitTaskId', () => {
  it('splits package and task, root included', () => {
    assert.deepEqual(splitTaskId('@www/lit-ui-router.dev#build'), [
      '@www/lit-ui-router.dev',
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
    assert.throws(() => splitTaskId('@www/lit-ui-router.dev#'));
  });
});

describe('resolvedTaskDeps', () => {
  const plan = JSON.stringify({
    tasks: [
      { taskId: 'lit-ui-router#docs:api', dependencies: [] },
      {
        taskId: '@www/lit-ui-router.dev#build',
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
    assert.deepEqual(
      await resolvedTaskDeps('@www/lit-ui-router.dev#build', exec),
      ['^build', 'lit-ui-router#docs:api'],
    );
    assert.deepEqual(calls, [
      [
        'turbo',
        ['run', 'build', '--filter=@www/lit-ui-router.dev', '--dry-run=json'],
      ],
    ]);
  });

  it('keeps the dry run off the remote cache', async () => {
    let env: NodeJS.ProcessEnv | undefined;
    const exec: Exec = (_command, _args, options) => {
      env = options?.env;
      return Promise.resolve({ stdout: plan, stderr: '' });
    };
    await resolvedTaskDeps('@www/lit-ui-router.dev#build', exec);
    assert.equal(env?.TURBO_CACHE, 'local:r');
    assert.equal(env?.TURBO_TOKEN, '');
  });

  it('throws when the plan lacks the task', async () => {
    const exec: Exec = () => Promise.resolve({ stdout: plan, stderr: '' });
    await assert.rejects(
      resolvedTaskDeps('@www/lit-ui-router.dev#typecheck', exec),
      /no task/,
    );
  });
});

describe('plannedTasks', () => {
  const planFor = (name: string) =>
    JSON.stringify({
      tasks: [
        {
          taskId: `@www/lit-ui-router.dev#${name}`,
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
      ['@www/lit-ui-router.dev#build', '@www/lit-ui-router.dev#test'],
    );
    assert.deepEqual(planned.get('@www/lit-ui-router.dev#build')?.inputs, {
      'package.json': 'abc',
    });
  });

  it('skips a script name turbo has no task for', async () => {
    const exec: Exec = (_command, args) =>
      args[1] === 'prepare'
        ? Promise.reject(undeclared('prepare'))
        : Promise.resolve({ stdout: planFor(args[1] ?? ''), stderr: '' });
    const planned = await plannedTasks(['prepare', 'test'], exec, 1);
    assert.deepEqual([...planned.keys()], ['@www/lit-ui-router.dev#test']);
  });

  it('skips a long name turbo wraps mid-name, in color', async () => {
    const name = 'typecheck:example:hellosolarsystem-mobx';
    const exec: Exec = (_command, args) =>
      args[1] === name
        ? Promise.reject(
            Object.assign(new Error('turbo failed'), {
              stderr:
                '  \x1B[31m×\x1B[0m Missing tasks in project\n' +
                '\x1B[31m  ╰─▶ \x1B[0m  \x1B[31m×\x1B[0m Could not find task `typecheck:example:hellosolarsystem-\n' +
                '\x1B[31m      \x1B[0m  \x1B[31m│\x1B[0m mobx` in project\n',
            }),
          )
        : Promise.resolve({ stdout: planFor(args[1] ?? ''), stderr: '' });
    const planned = await plannedTasks([name, 'test'], exec, 1);
    assert.deepEqual([...planned.keys()], ['@www/lit-ui-router.dev#test']);
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
    assert.equal(planned.get('@www/lit-ui-router.dev#dev')?.cache, false);
    assert.equal(planned.get('@www/lit-ui-router.dev#build')?.cache, true);
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

describe('declaredLanes', () => {
  it('unqualifies task ids and unions across configs', () => {
    const root = `{
      // turbo.json carries comments
      "tasks": { "build": {}, "docs#docs:api": {}, "//#lint:templates": {} }
    }`;
    const pkg = '{ "tasks": { "build": {}, "e2e": {} } }';
    assert.deepEqual([...declaredLanes([root, pkg])].sort(), [
      'build',
      'docs:api',
      'e2e',
      'lint:templates',
    ]);
  });

  it('throws on malformed JSONC rather than reading no lanes', () => {
    assert.throws(
      () => declaredLanes(['{ "tasks": { ']),
      /invalid turbo\.json/,
    );
  });

  it('tolerates a config with no tasks at all', () => {
    assert.deepEqual([...declaredLanes(['{ "extends": ["//"] }'])], []);
  });
});

describe('nonPersistentWith', () => {
  const root = `{
    // turbo.json carries comments
    "tasks": {
      "e2e": { "with": ["docs#serve"], "persistent": true },
      "lint": { "dependsOn": ["lint:oxlint"] }
    }
  }`;

  it('passes `with` on a persistent task', () => {
    assert.deepEqual(
      nonPersistentWith([{ path: 'turbo.json', text: root }]),
      [],
    );
  });

  it('reports `with` on finite tasks, root and package, sorted', () => {
    const rootWith = `{ "tasks": {
      "typecheck": { "with": ["typecheck:src"] },
      "e2e": { "with": ["docs#serve"], "persistent": true }
    } }`;
    const pkg = '{ "tasks": { "build": { "with": ["build:hash"] } } }';
    assert.deepEqual(
      nonPersistentWith([
        { path: 'turbo.json', text: rootWith },
        { path: 'apps/a/turbo.json', text: pkg },
      ]),
      ['apps/a/turbo.json: build', 'turbo.json: typecheck'],
    );
  });

  it('inherits persistent from the root task of the same name', () => {
    const pkg = '{ "tasks": { "e2e": { "with": ["wrangler:dev"] } } }';
    assert.deepEqual(
      nonPersistentWith([
        { path: 'turbo.json', text: root },
        { path: 'www/turbo.json', text: pkg },
      ]),
      [],
    );
  });

  it('lets a package override opt out of persistence', () => {
    const pkg =
      '{ "tasks": { "e2e": { "with": ["serve"], "persistent": false } } }';
    assert.deepEqual(
      nonPersistentWith([
        { path: 'turbo.json', text: root },
        { path: 'www/turbo.json', text: pkg },
      ]),
      ['www/turbo.json: e2e'],
    );
  });

  it('counts an empty `with` list, which still names the key', () => {
    const pkg = '{ "tasks": { "lint": { "with": [] } } }';
    assert.deepEqual(nonPersistentWith([{ path: 'a/turbo.json', text: pkg }]), [
      'a/turbo.json: lint',
    ]);
  });
});

describe('plannedLanes', () => {
  it('returns the unqualified names turbo plans for the run', async () => {
    const argv: unknown[] = [];
    const exec: Exec = (command, args) => {
      argv.push([command, args]);
      return Promise.resolve({
        stdout: JSON.stringify({
          tasks: [
            { taskId: 'docs#build' },
            { taskId: '//#lint:templates' },
            { taskId: 'lit-ui-router#build' },
            // turbo has emitted an entry without an id before now
            {},
          ],
        }),
        stderr: '',
      });
    };
    assert.deepEqual(
      [...(await plannedLanes(['ci', 'ci:main'], exec))].sort(),
      ['build', 'lint:templates'],
    );
    assert.deepEqual(argv, [
      ['turbo', ['run', 'ci', 'ci:main', '--dry-run=json']],
    ]);
  });
});

describe('planFailure', () => {
  it('plans the lanes in one run, without --only', async () => {
    const argv: unknown[] = [];
    const exec: Exec = (command, args) => {
      argv.push([command, args]);
      return Promise.resolve({ stdout: '{}', stderr: '' });
    };
    assert.equal(await planFailure(['e2e', 'dev'], exec), undefined);
    assert.deepEqual(argv, [
      ['turbo', ['run', 'e2e', 'dev', '--dry-run=json']],
    ]);
  });

  it('returns the complaint about an invalid edge', async () => {
    const exec: Exec = () =>
      Promise.reject(
        Object.assign(new Error('turbo failed'), {
          stderr:
            '  × Invalid task configuration\n' +
            '  ╰─▶ × "docs#docs" is a persistent task, "sample-app-lit-e2e#e2e"\n' +
            '      │ cannot depend on it',
        }),
      );
    assert.match((await planFailure(['e2e'], exec)) ?? '', /persistent task/);
  });

  it('falls back to the error itself when it carries no stderr', async () => {
    const exec: Exec = () => Promise.reject(new Error('turbo exploded'));
    assert.match((await planFailure(['e2e'], exec)) ?? '', /turbo exploded/);
  });
});

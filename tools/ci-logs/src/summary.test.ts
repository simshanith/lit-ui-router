import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { turboLogFile } from '@tools/shared/turbo-log.ts';
import * as v from 'valibot';

import {
  compareTasks,
  mergeTasks,
  parseArtifactName,
  planArtifacts,
  RUN_GROUP,
  SummarySchema,
  type Summary,
} from './summary.ts';

const json: unknown = JSON.parse(
  readFileSync(new URL('summary.fixtures.json', import.meta.url), 'utf8'),
);

const fixture = v.parse(SummarySchema, json);

const summary = (
  ...tasks: [taskId: string, status: 'HIT' | 'MISS'][]
): Summary => ({
  tasks: tasks.map(([taskId, status]) => ({
    taskId,
    logFile: `${taskId}.log`,
    cache: { status },
  })),
});

test('reads a real turbo summary: task id, log file and cache status', () => {
  assert.deepEqual(fixture.tasks, [
    {
      taskId: '@tools/dts-backtest#test:matrix',
      logFile: 'tools/dts-backtest/.turbo/turbo-test$colon$matrix.log',
      cache: { status: 'MISS' },
    },
    {
      taskId: '//#format:check:root',
      logFile: '.turbo/turbo-format$colon$check$colon$root.log',
      cache: { status: 'HIT' },
    },
  ]);
});

test('derives the log file turbo names for each real task', () => {
  const { tasks } = v.parse(
    v.object({
      tasks: v.array(
        v.object({
          task: v.string(),
          directory: v.string(),
          logFile: v.string(),
        }),
      ),
    }),
    json,
  );

  for (const { task, directory, logFile } of tasks) {
    assert.equal(turboLogFile(directory, task), logFile);
  }
});

test('derives the log file a cache: false task leaves out', () => {
  const { tasks } = v.parse(SummarySchema, {
    tasks: [
      {
        taskId: 'sample-app-routes#bench',
        task: 'bench',
        directory: 'apps/sample-app-routes',
        cache: { status: 'MISS' },
      },
    ],
  });

  assert.equal(
    tasks[0]?.logFile,
    'apps/sample-app-routes/.turbo/turbo-bench.log',
  );
});

test('names the unsuffixed artifacts the run group', () => {
  assert.deepEqual(parseArtifactName('turbo-task-logs'), {
    kind: 'turbo-task-logs',
    group: RUN_GROUP,
  });
  assert.deepEqual(parseArtifactName('turbo-run-summaries-docs'), {
    kind: 'turbo-run-summaries',
    group: 'docs',
  });
  assert.deepEqual(parseArtifactName('turbo-task-logs-a11y'), {
    kind: 'turbo-task-logs',
    group: 'a11y',
  });
});

test('ignores artifacts that are not task logs or run summaries', () => {
  assert.equal(parseArtifactName('cypress-screenshots-docs'), undefined);
  assert.equal(parseArtifactName('turbo-task-logsx'), undefined);
});

test('splits wanted artifacts into downloads and expired', () => {
  assert.deepEqual(
    planArtifacts([
      { name: 'turbo-task-logs', expired: true },
      { name: 'turbo-run-summaries', expired: false },
      { name: 'vitest-attachments', expired: false },
      { name: 'turbo-task-logs-docs', expired: false },
    ]),
    {
      download: ['turbo-run-summaries', 'turbo-task-logs-docs'],
      expired: ['turbo-task-logs'],
    },
  );
});

test('a task executed when any of its group summaries missed the cache', () => {
  const tasks = mergeTasks([
    {
      group: 'docs',
      summary: summary(['a#build', 'MISS'], ['b#build', 'HIT']),
    },
    { group: 'docs', summary: summary(['a#build', 'HIT'], ['b#build', 'HIT']) },
    { group: 'mobx', summary: summary(['a#build', 'HIT']) },
  ]);

  assert.deepEqual(
    [...tasks.values()].map(({ group, taskId, executed }) => [
      group,
      taskId,
      executed,
    ]),
    [
      ['docs', 'a#build', true],
      ['docs', 'b#build', false],
      ['mobx', 'a#build', false],
    ],
  );
});

test('orders the run group first, then groups and tasks by name', () => {
  const task = (group: string, taskId: string) => ({
    group,
    taskId,
    logFile: '',
    executed: true,
  });

  assert.deepEqual(
    [
      task('docs', 'b'),
      task(RUN_GROUP, 'z'),
      task('a11y', 'a'),
      task('docs', 'a'),
    ]
      .sort(compareTasks)
      .map(({ group, taskId }) => `${group} ${taskId}`),
    ['run z', 'a11y a', 'docs a', 'docs b'],
  );
});

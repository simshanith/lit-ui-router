import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractEslintDiagnostics,
  parseEslintStylish,
} from './eslint-annotations.core.ts';
import {
  type RunSummary,
  type SummaryTask,
  planAnnotations,
} from './run-summary.core.ts';

const ESC = '\u001B';

const ROOT = '/home/runner/work/lit-ui-router/lit-ui-router';

// Captured from `//#lint:package-json` with `version` renamed in packages/lit-ui-router.
const requiredKeyLog = [
  '$ eslint "**/package.json" pnpm-workspace.yaml',
  `${ESC}[0m`,
  `${ESC}[4m${ROOT}/packages/lit-ui-router/package.json${ESC}[24m`,
  `  ${ESC}[2m1:1${ESC}[22m  ${ESC}[31merror${ESC}[39m  Property 'version' is required  ${ESC}[2mpackage-json/require-version${ESC}[22m`,
  '',
  `${ESC}[31m${ESC}[1m✖ 1 problem (1 error, 0 warnings)${ESC}[22m${ESC}[39m`,
  `${ESC}[0m`,
  '[ELIFECYCLE] Command failed with exit code 1.',
].join('\n');

// Two files, padded columns, a warning, and a parse error that names no rule.
const multiLog = [
  '$ eslint "**/package.json" pnpm-workspace.yaml',
  '',
  `${ROOT}/tools/crap/package.json`,
  '  28:15  error    Expect to use catalog instead of plain specifier, got "^1.0.0" for package "oxlint"  pnpm/json-enforce-catalog',
  '  30:3   warning  Short                                                                              package-json/sort-collections',
  '',
  `${ROOT}/pnpm-workspace.yaml`,
  '  4:1  error  Parsing error: Unexpected token',
  '',
  '✖ 3 problems (2 errors, 1 warning)',
].join('\n');

function task(over: Partial<SummaryTask>): SummaryTask {
  return {
    taskId: '//#lint:package-json',
    task: 'lint:package-json',
    package: '//',
    directory: '',
    command: 'eslint "**/package.json" pnpm-workspace.yaml',
    logFile: '.turbo/turbo-lint$colon$package-json.log',
    execution: { startTime: 0, endTime: 1, exitCode: 1 },
    ...over,
  };
}

function summary(tasks: SummaryTask[]): RunSummary {
  return {
    id: 'run-id',
    turboVersion: '2.11.8',
    execution: {
      command: 'turbo run lint',
      success: 0,
      failed: 1,
      cached: 0,
      attempted: tasks.length,
      startTime: 0,
      endTime: 1,
      exitCode: 1,
    },
    tasks,
  };
}

describe('parseEslintStylish', () => {
  it('annotates one finding with a repo-relative file and its rule', () => {
    assert.deepEqual(parseEslintStylish(requiredKeyLog, '', ROOT), [
      {
        level: 'error',
        message: "Property 'version' is required",
        properties: {
          file: 'packages/lit-ui-router/package.json',
          line: 1,
          col: 1,
          title: 'package-json/require-version',
        },
      },
    ]);
  });

  it('splits padded columns, keeps warnings, and allows a missing rule', () => {
    assert.deepEqual(
      parseEslintStylish(multiLog, '', ROOT).map((a) => [
        a.level,
        a.properties.file,
        a.properties.line,
        a.properties.col,
        a.properties.title,
        a.message,
      ]),
      [
        [
          'error',
          'tools/crap/package.json',
          28,
          15,
          'pnpm/json-enforce-catalog',
          'Expect to use catalog instead of plain specifier, got "^1.0.0" for package "oxlint"',
        ],
        [
          'warning',
          'tools/crap/package.json',
          30,
          3,
          'package-json/sort-collections',
          'Short',
        ],
        [
          'error',
          'pnpm-workspace.yaml',
          4,
          1,
          undefined,
          'Parsing error: Unexpected token',
        ],
      ],
    );
  });

  it('refuses a file outside the root and rows with no file header', () => {
    const bad = [
      '/etc/package.json',
      '  1:1  error  outside  some/rule',
      '',
      '  2:2  error  orphan  some/rule',
    ].join('\n');

    assert.deepEqual(parseEslintStylish(bad, '', ROOT), []);
    assert.deepEqual(parseEslintStylish(requiredKeyLog, '', undefined), []);
  });
});

describe('extractEslintDiagnostics', () => {
  it('reads failed tasks only and rebuilds one command per finding', () => {
    const run = summary([
      task({}),
      task({
        taskId: '//#lint:complexity',
        execution: { startTime: 0, endTime: 1, exitCode: 0 },
      }),
    ]);

    const logs = new Map([
      ['//#lint:package-json', requiredKeyLog],
      ['//#lint:complexity', multiLog],
    ]);

    assert.deepEqual(
      planAnnotations(extractEslintDiagnostics(run, logs, ROOT)).commands,
      [
        "::error file=packages/lit-ui-router/package.json,line=1,col=1,title=package-json/require-version::Property 'version' is required",
      ],
    );
  });
});

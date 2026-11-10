import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type RunSummary,
  type SummaryTask,
  planAnnotations,
} from './run-summary.core.ts';
import {
  extractTscDiagnostics,
  parseTscDiagnostics,
} from './tsc-annotations.core.ts';

const ESC = '\u001B';

const c = (code: number, text: string) => `${ESC}[${code}m${text}${ESC}[0m`;

// Captured from `turbo run typecheck:tsc --filter=@tools/shared` with two injected errors.
const tscLog = [
  '$ tsc -p tsconfig.json --noEmit',
  `${c(96, 'src/gha.core.ts')}:${c(93, '94')}:${c(93, '14')} - ${c(91, 'error')}${ESC}[90m TS2322: ${ESC}[0mType '(a: number) => void' is not assignable to type '(a: string) => void'.`,
  "  Types of parameters 'a' and 'a' are incompatible.",
  "    Type 'string' is not assignable to type 'number'.",
  '',
  `${c(7, '94')} export const f: (a: string) => void = (a: number) => { void a; };`,
  `${c(7, '  ')} ${c(91, '             ~')}`,
  '',
  `${c(96, 'src/gha.core.ts')}:${c(93, '96')}:${c(93, '14')} - ${c(91, 'error')}${ESC}[90m TS2741: ${ESC}[0mProperty 'b' is missing in type '{ a: string; }' but required in type 'Foo'.`,
  '',
  `${c(7, '96')} export const foo: Foo = { a: 'x' };`,
  `${c(7, '  ')} ${c(91, '             ~~~')}`,
  '',
  `  ${c(96, 'src/gha.core.ts')}:${c(93, '95')}:${c(93, '28')} - 'b' is declared here.`,
  `    ${c(7, '95')} interface Foo { a: string; b: string }`,
  `    ${c(7, '  ')} ${c(96, '                           ~')}`,
  '',
  '',
  `Found 2 errors in the same file, starting at: src/gha.core.ts${c(90, ':94')}`,
  '',
  '[ELIFECYCLE] Command failed with exit code 1.',
].join('\n');

// Captured from `vite build` with vite-plugin-checker and a missing import.
const viteLog = [
  '$ vite build --outDir dist/vanilla',
  `${ESC}[36mvite v8.3.2 ${ESC}[32mbuilding client environment for production...${ESC}[36m${ESC}[39m`,
  'transforming...',
  `${c(96, 'src/main.ts')}:${c(93, '1')}:${c(93, '18')} - ${c(91, 'error')}${ESC}[90m TS2307: ${ESC}[0mCannot find module './does-not-exist.ts' or its corresponding type declarations.`,
  '',
  `${c(7, '1')} import nope from "./does-not-exist.ts";`,
  `${c(7, ' ')} ${c(91, '                 ~~~~~~~~~~~~~~~~~~~~~')}`,
  '',
  '',
  `Found 1 error in src/main.ts${c(90, ':1')}`,
].join('\n');

const missingModule =
  "Cannot find module './does-not-exist.ts' or its corresponding type declarations.";

function task(over: Partial<SummaryTask>): SummaryTask {
  return {
    taskId: '@tools/shared#typecheck:tsc',
    task: 'typecheck:tsc',
    package: '@tools/shared',
    directory: 'tools/shared',
    command: 'tsc -p tsconfig.json --noEmit',
    logFile: 'tools/shared/.turbo/turbo-typecheck$colon$tsc.log',
    execution: { startTime: 0, endTime: 1, exitCode: 1 },
    ...over,
  };
}

function summary(tasks: SummaryTask[]): RunSummary {
  return {
    id: 'run-id',
    turboVersion: '2.10.9',
    execution: {
      command: 'turbo run ci',
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

describe('parseTscDiagnostics', () => {
  it('annotates each diagnostic with its message chain, repo-relative', () => {
    assert.deepEqual(parseTscDiagnostics(tscLog, 'tools/shared'), [
      {
        level: 'error',
        message: [
          "Type '(a: number) => void' is not assignable to type '(a: string) => void'.",
          "Types of parameters 'a' and 'a' are incompatible.",
          "  Type 'string' is not assignable to type 'number'.",
        ].join('\n'),
        properties: {
          file: 'tools/shared/src/gha.core.ts',
          line: 94,
          col: 14,
          title: 'TS2322',
        },
      },
      {
        level: 'error',
        message:
          "Property 'b' is missing in type '{ a: string; }' but required in type 'Foo'.",
        properties: {
          file: 'tools/shared/src/gha.core.ts',
          line: 96,
          col: 14,
          title: 'TS2741',
        },
      },
    ]);
  });

  it('ignores the footer, code frames and related information', () => {
    const noise = [
      'Found 2 errors in the same file, starting at: src/core.ts:272',
      'Found 1 error in src/core.ts:272',
      '272 export const mutant: number = 1;',
      '                 ~~~~~~',
      "  src/core.ts:95:28 - 'b' is declared here.",
    ].join('\n');

    assert.deepEqual(parseTscDiagnostics(noise, 'tools/shared'), []);
  });

  it('reads vite-plugin-checker output, on its own line or after a redraw', () => {
    const expected = {
      level: 'error',
      message: missingModule,
      properties: {
        file: 'apps/app/src/main.ts',
        line: 1,
        col: 18,
        title: 'TS2307',
      },
    };

    assert.deepEqual(parseTscDiagnostics(viteLog, 'apps/app'), [expected]);
    const glued = `transforming...src/main.ts:1:18 - error TS2307: ${missingModule}`;
    assert.deepEqual(parseTscDiagnostics(glued, 'apps/app'), [expected]);
    const redrawn = `transforming (3) src/x.ts\rsrc/main.ts:1:18 - error TS2307: ${missingModule}\r`;
    assert.deepEqual(parseTscDiagnostics(redrawn, 'apps/app'), [expected]);
  });

  it('reads the non-pretty form', () => {
    const plain = [
      "src/a.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.",
      "src/b.ts(1,1): warning TS6133: 'x' is declared but its value is never read.",
    ].join('\n');

    assert.deepEqual(
      parseTscDiagnostics(plain, 'tools/x').map((a) => [
        a.level,
        a.properties.file,
        a.properties.line,
        a.properties.col,
      ]),
      [
        ['error', 'tools/x/src/a.ts', 3, 7],
        ['warning', 'tools/x/src/b.ts', 1, 1],
      ],
    );
  });

  it('refuses a file outside the repo or a zero position', () => {
    const bad = [
      '../../../etc/a.ts:1:1 - error TS1: escape',
      'src/a.ts:0:1 - error TS1: zero line',
    ].join('\n');

    assert.deepEqual(parseTscDiagnostics(bad, 'tools/x'), []);
  });
});

describe('extractTscDiagnostics', () => {
  it('reads failed tasks only', () => {
    const run = summary([
      task({}),
      task({
        taskId: 'lit-ui-router#test',
        directory: 'packages/lit-ui-router',
        execution: { startTime: 0, endTime: 1, exitCode: 0 },
      }),
    ]);

    const logs = new Map([
      ['@tools/shared#typecheck:tsc', tscLog],
      ['lit-ui-router#test', tscLog],
    ]);

    const files = extractTscDiagnostics(run, logs).map(
      (a) => a.properties.file,
    );

    assert.deepEqual(files, [
      'tools/shared/src/gha.core.ts',
      'tools/shared/src/gha.core.ts',
    ]);
  });

  it('rebuilds the chain as one escaped command', () => {
    const plan = planAnnotations(parseTscDiagnostics(tscLog, 'tools/shared'));
    assert.equal(
      plan.commands[0],
      "::error file=tools/shared/src/gha.core.ts,line=94,col=14,title=TS2322::Type '(a: number) => void' is not assignable to type '(a: string) => void'.%0ATypes of parameters 'a' and 'a' are incompatible.%0A  Type 'string' is not assignable to type 'number'.",
    );
  });
});

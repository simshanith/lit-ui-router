import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';
import type { TestEvent } from 'node:test/reporters';

import { failureAnnotation, frameIn } from './test-reporter.ts';

type TestFail = Extract<TestEvent, { type: 'test:fail' }>['data'];

const FILE = '/repo/tools/x/src/a.test.ts';

function failure(error: Error, overrides: Partial<TestFail> = {}): TestFail {
  return {
    name: 'adds',
    nesting: 0,
    testNumber: 1,
    testId: 1,
    type: 'test',
    file: FILE,
    line: 4,
    column: 3,
    details: { duration_ms: 1, error },
    ...overrides,
  } as TestFail;
}

function wrapped(cause: unknown, failureType = 'testCodeFailure'): Error {
  return Object.assign(new Error('test failed', { cause }), {
    code: 'ERR_TEST_FAILURE',
    failureType,
  });
}

function thrown(message: string, stack: string): Error {
  return Object.assign(new Error(message), { stack });
}

describe('frameIn', () => {
  it('takes the innermost frame in the file, as a URL or a path', () => {
    const stack = [
      'AssertionError: nope',
      '    at helper (file:///repo/tools/x/src/util.ts:9:1)',
      `    at TestContext.<anonymous> (file://${FILE}:7:10)`,
      `    at ${FILE}:12:5`,
    ].join('\n');
    assert.deepEqual(frameIn(stack, FILE), { line: 7, col: 10 });
    assert.deepEqual(frameIn(`    at ${FILE}:12:5`, FILE), {
      line: 12,
      col: 5,
    });
  });

  it('finds nothing when no frame is in the file', () => {
    assert.equal(frameIn('Error\n    at node:internal/x:1:1', FILE), undefined);
  });
});

describe('failureAnnotation', () => {
  it('places the error on the failing frame, relative to cwd', () => {
    const cause = thrown(
      'Expected values to be strictly equal:\n\n1 !== 2\n',
      `AssertionError\n    at TestContext.<anonymous> (file://${FILE}:7:10)`,
    );
    assert.equal(
      failureAnnotation(failure(wrapped(cause)), '/repo/tools/x'),
      '::error file=src/a.test.ts,line=7,col=10,title=adds::' +
        'Expected values to be strictly equal:%0A%0A1 !== 2',
    );
  });

  it('falls back to where the test is declared', () => {
    assert.equal(
      failureAnnotation(failure(wrapped('a string')), '/repo/tools/x'),
      '::error file=src/a.test.ts,line=4,col=3,title=adds::a string',
    );
  });

  it('strips colour from the message', () => {
    const cause = thrown('\u001B[32m+ actual\u001B[39m', 'Error');
    assert.match(
      failureAnnotation(failure(wrapped(cause)), '/repo') ?? '',
      /::\+ actual$/,
    );
  });

  it('skips failures that only echo a subtest or parent failure', () => {
    for (const type of ['subtestsFailed', 'cancelledByParent']) {
      assert.equal(
        failureAnnotation(failure(wrapped('x', type)), '/'),
        undefined,
      );
    }
  });

  it('skips a failure with no file', () => {
    const data = failure(wrapped('x'), { file: undefined });
    assert.equal(failureAnnotation(data, '/'), undefined);
  });
});

describe('the reporter', () => {
  const reporter = fileURLToPath(new URL('test-reporter.ts', import.meta.url));
  const cwd = mkdtempSync(join(tmpdir(), 'test-reporter-'));
  after(() => rmSync(cwd, { recursive: true, force: true }));
  writeFileSync(
    join(cwd, 'failing.test.mjs'),
    [
      "import assert from 'node:assert/strict';",
      "import { describe, it } from 'node:test';",
      '',
      "describe('fixture', () => {",
      "  it('passes', () => {});",
      "  it('fails on the assertion line', () => {",
      '    assert.equal(1, 2);',
      '  });',
      '});',
      '',
    ].join('\n'),
  );

  function run(annotate: boolean): string {
    const env: NodeJS.ProcessEnv = { ...process.env };
    // set inside a node:test run; the nested runner would report as a child
    delete env.NODE_TEST_CONTEXT;
    delete env.GITHUB_ACTIONS;
    if (annotate) env.GITHUB_ACTIONS = 'true';
    const result = spawnSync(
      process.execPath,
      ['--test', `--test-reporter=${reporter}`, 'failing.test.mjs'],
      { cwd, env, encoding: 'utf8' },
    );
    assert.equal(result.status, 1, result.stderr);
    return result.stdout;
  }

  it('prints spec output and no commands off Actions', () => {
    const out = run(false);
    assert.match(out, /✖ failing tests:/);
    assert.doesNotMatch(out, /^::/m);
  });

  it('adds one error on the assertion line on Actions', () => {
    const commands = run(true)
      .split('\n')
      .filter((line) => line.startsWith('::'));
    assert.deepEqual(commands, [
      '::error file=failing.test.mjs,line=7,col=12,' +
        'title=fails on the assertion line::' +
        'Expected values to be strictly equal:%0A%0A1 !== 2',
    ]);
  });
});

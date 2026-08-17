import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type RunSummary,
  type SummaryTask,
  buildReports,
  directReproduction,
  excerptLog,
  failedTasks,
  fenceFor,
  guardCommands,
  headline,
  parseRunSummary,
  stdoutReport,
  stripAnsi,
  summaryMarkdown,
  turboReproduction,
} from './error-summary.core.ts';

// The escape byte, spelled rather than embedded, so this file stays printable.
const ESC = '\u001B';

function task(over: Partial<SummaryTask> = {}): SummaryTask {
  return {
    taskId: 'lit-ui-router#typecheck:src',
    task: 'typecheck:src',
    package: 'lit-ui-router',
    directory: 'packages/lit-ui-router',
    command: 'tsc -p tsconfig.src.json --noEmit',
    logFile: 'packages/lit-ui-router/.turbo/turbo-typecheck$colon$src.log',
    cache: { status: 'MISS' },
    execution: { startTime: 1_000, endTime: 8_000, exitCode: 1 },
    ...over,
  };
}

function summary(tasks: SummaryTask[], exitCode = 1): RunSummary {
  return {
    id: 'run-id',
    turboVersion: '2.10.9',
    execution: {
      command: 'turbo run ci',
      success: 61,
      failed: tasks.filter((t) => (t.execution?.exitCode ?? 0) !== 0).length,
      cached: 58,
      attempted: 76,
      startTime: 0,
      endTime: 9_000,
      exitCode,
    },
    tasks,
  };
}

describe('parseRunSummary', () => {
  it('rejects a summary with no tasks array', () => {
    assert.throws(() => parseRunSummary({ execution: { exitCode: 1 } }), {
      message: /no tasks\[\] array/,
    });
  });

  it('rejects a summary with no execution.exitCode', () => {
    assert.throws(() => parseRunSummary({ tasks: [] }), {
      message: /no execution\.exitCode/,
    });
  });

  it('accepts the real shape', () => {
    const parsed = parseRunSummary(summary([task()]));
    assert.equal(parsed.tasks.length, 1);
  });
});

describe('failedTasks', () => {
  // The whole point of reading the summary instead of the stream: turbo prints
  // ELIFECYCLE for tasks it cancelled, and omits them from tasks[]. Anything
  // present with exitCode 0 succeeded; anything absent was never run.
  it('selects only non-zero exits, ignoring successes', () => {
    const failing = failedTasks(
      summary([
        task({
          taskId: 'a#lint',
          execution: { startTime: 5, endTime: 6, exitCode: 0 },
        }),
        task({ taskId: 'b#typecheck' }),
      ]),
    );
    assert.deepEqual(
      failing.map((t) => t.taskId),
      ['b#typecheck'],
    );
  });

  it('ignores a task with no execution record', () => {
    const failing = failedTasks(
      summary([task({ taskId: 'c#build', execution: undefined })]),
    );
    assert.deepEqual(failing, []);
  });

  it('orders oldest-started first, so the earliest cause reads first', () => {
    const failing = failedTasks(
      summary([
        task({
          taskId: 'late',
          execution: { startTime: 900, endTime: 950, exitCode: 1 },
        }),
        task({
          taskId: 'early',
          execution: { startTime: 100, endTime: 150, exitCode: 2 },
        }),
      ]),
    );
    assert.deepEqual(
      failing.map((t) => t.taskId),
      ['early', 'late'],
    );
  });
});

describe('stripAnsi', () => {
  it('removes the SGR colouring turbo captures from tool output', () => {
    assert.equal(
      stripAnsi(`${ESC}[96msrc/core.ts${ESC}[0m:${ESC}[93m272${ESC}[0m`),
      'src/core.ts:272',
    );
  });

  it('leaves plain text untouched', () => {
    assert.equal(stripAnsi('Found 2 errors.'), 'Found 2 errors.');
  });
});

describe('excerptLog', () => {
  it('publishes a short log whole', () => {
    const { text, omittedLines } = excerptLog('one\ntwo\nthree');
    assert.equal(text, 'one\ntwo\nthree');
    assert.equal(omittedLines, 0);
  });

  it('drops the pnpm `$ <script>` echo, which the repro lines already say', () => {
    const { text } = excerptLog(
      '$ tsc -p tsconfig.src.json --noEmit\nerror TS2322',
    );
    assert.equal(text, 'error TS2322');
  });

  it('trims trailing blank lines', () => {
    assert.equal(excerptLog('body\n\n\n').text, 'body');
  });

  it("drops pnpm's trailing ELIFECYCLE epitaph, which the exit column says", () => {
    assert.equal(
      excerptLog(
        'Found 1 error in src/core.ts:272\n\n[ELIFECYCLE] Command failed with exit code 1.\n',
      ).text,
      'Found 1 error in src/core.ts:272',
    );
  });

  it('elides the middle and says how much, keeping head and tail', () => {
    const lines = Array.from({ length: 500 }, (_, i) => `line ${i}`);
    const { text, omittedLines } = excerptLog(lines.join('\n'), {
      headLines: 2,
      tailLines: 3,
      maxBytes: 1024,
    });
    assert.equal(omittedLines, 495);
    assert.deepEqual(text.split('\n'), [
      'line 0',
      'line 1',
      '… 495 lines omitted …',
      'line 497',
      'line 498',
      'line 499',
    ]);
  });

  it('enforces the byte cap from the head, because the verdict is at the tail', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `${i}`.repeat(40));
    const { text, omittedLines } = excerptLog(lines.join('\n'), {
      headLines: 50,
      tailLines: 50,
      maxBytes: 200,
    });
    assert.ok(Buffer.byteLength(text, 'utf8') <= 200 + 64);
    assert.ok(text.startsWith('… head trimmed to 200 bytes …'));
    assert.ok(text.endsWith('49'.repeat(40)), 'the last line survives');
    assert.ok(omittedLines > 0);
  });
});

describe('reproduction lines', () => {
  it('filters a package task by its package name', () => {
    assert.equal(
      turboReproduction(task()),
      'turbo run typecheck:src --filter=lit-ui-router --force',
    );
  });

  it('filters a root task with //', () => {
    assert.equal(
      turboReproduction(task({ package: '//', task: 'lint:root' })),
      'turbo run lint:root --filter=// --force',
    );
  });

  it('gives the exact command and directory turbo used', () => {
    assert.equal(
      directReproduction(task()),
      'cd packages/lit-ui-router && tsc -p tsconfig.src.json --noEmit',
    );
  });

  it('uses . for a root task, whose directory is the empty string', () => {
    assert.equal(
      directReproduction(task({ directory: '', command: 'oxlint .' })),
      'cd . && oxlint .',
    );
  });
});

describe('buildReports', () => {
  it('pairs each failing task with its log excerpt and duration', () => {
    const [report] = buildReports(
      summary([task()]),
      new Map([['lit-ui-router#typecheck:src', 'error TS2322: nope']]),
    );
    assert.equal(report.durationMs, 7_000);
    assert.equal(report.excerpt.text, 'error TS2322: nope');
  });

  it('falls back to execution.error when the log file is missing', () => {
    const [report] = buildReports(
      summary([
        task({
          execution: {
            startTime: 1,
            endTime: 2,
            exitCode: 1,
            error: 'pnpm run typecheck:src exited (1)',
          },
        }),
      ]),
      new Map(),
    );
    assert.match(report.excerpt.text, /no log file at/);
    assert.match(report.excerpt.text, /exited \(1\)/);
  });
});

describe('headline', () => {
  it('names the failing tasks and the graph size', () => {
    const run = summary([task()]);
    assert.equal(
      headline(run, buildReports(run, new Map())),
      '1 failing task: lit-ui-router#typecheck:src — 61 succeeded, 58 cached, 76 attempted',
    );
  });

  it('says so plainly when the run died outside any task', () => {
    const run = summary([]);
    assert.match(headline(run, []), /no task reported a non-zero exit/);
  });
});

describe('summaryMarkdown', () => {
  it('leads with a table and gives each failure its repro block', () => {
    const run = summary([task()]);
    const markdown = summaryMarkdown(
      run,
      buildReports(
        run,
        new Map([['lit-ui-router#typecheck:src', 'error TS2322']]),
      ),
    );
    assert.match(markdown, /^## CI failure summary/);
    assert.match(
      markdown,
      /\| `typecheck:src` \| `lit-ui-router` \| 1 \| 7\.0s \|/,
    );
    assert.match(
      markdown,
      /turbo run typecheck:src --filter=lit-ui-router --force/,
    );
    assert.match(markdown, /error TS2322/);
    // Short logs are not hidden behind a disclosure — that is the whole point.
    assert.doesNotMatch(markdown, /<details>/);
  });

  it('hides a truncated excerpt behind a disclosure, labelled with the loss', () => {
    const run = summary([task()]);
    const long = Array.from({ length: 400 }, (_, i) => `line ${i}`).join('\n');
    const markdown = summaryMarkdown(
      run,
      buildReports(run, new Map([['lit-ui-router#typecheck:src', long]])),
    );
    assert.match(markdown, /<details><summary>Log excerpt — 300 lines omitted/);
  });

  it('explains an exit with no failing task instead of rendering an empty report', () => {
    const markdown = summaryMarkdown(summary([]), []);
    assert.match(markdown, /no task reported a non-zero exit/);
    assert.match(markdown, /died outside a task/);
  });
});

describe('stdoutReport', () => {
  // A step summary never reaches the logs API, so an agent running
  // `gh run view --log-failed` sees only this lane.
  it('prints the excerpt and both repro lines, headline last', () => {
    const run = summary([task()]);
    const lines = stdoutReport(
      run,
      buildReports(
        run,
        new Map([['lit-ui-router#typecheck:src', 'error TS2322']]),
      ),
    );
    const text = lines.join('\n');
    assert.match(text, /── lit-ui-router#typecheck:src \(exit 1\)/);
    assert.match(text, /repro: turbo run typecheck:src/);
    assert.match(text, /exact: cd packages\/lit-ui-router/);
    assert.match(text, /error TS2322/);
    assert.match(lines.at(-1) ?? '', /^1 failing task:/);
  });
});

// Log text is untrusted — it is whatever a PR's own build printed. Both output
// lanes embed it in a format with its own escape syntax.
describe('untrusted log text', () => {
  const hostile = [
    '::error file=evil.ts,line=1::forged annotation',
    '::stop-commands::attacker',
    '```',
    '</details><script>alert(1)</script>',
  ].join('\n');

  function hostileRun() {
    const run = summary([task()]);
    return {
      run,
      reports: buildReports(
        run,
        new Map([['lit-ui-router#typecheck:src', hostile]]),
      ),
    };
  }

  it('guardCommands leaves chunks alone with no token', () => {
    assert.deepEqual(guardCommands(['a', 'b']), ['a', 'b']);
    assert.deepEqual(guardCommands(['a'], ''), ['a']);
  });

  it('guardCommands brackets the chunks with a stop/resume pair', () => {
    const out = guardCommands(['a', 'b'], 'tok');
    assert.deepEqual(out, ['::stop-commands::tok', 'a', 'b', '::tok::']);
  });

  it('a `::` log line lands inside the guard, not before it', () => {
    const { run, reports } = hostileRun();
    const out = guardCommands(stdoutReport(run, reports), 'tok');
    const forged = out.findIndex((chunk) =>
      chunk.includes('forged annotation'),
    );
    assert.ok(forged > 0, 'the excerpt is emitted');
    assert.equal(out.indexOf('::stop-commands::tok'), 0);
    assert.equal(out.at(-1), '::tok::');
    assert.ok(forged < out.length - 1, 'and lands before the resume line');
  });

  it('fenceFor outgrows the longest backtick run in the text', () => {
    assert.equal(fenceFor('no backticks'), '```');
    assert.equal(fenceFor('a ``` b'), '````');
    assert.equal(fenceFor('a ````` b'), '``````');
  });

  it('summaryMarkdown fences an excerpt that contains a fence', () => {
    const { run, reports } = hostileRun();
    const markdown = summaryMarkdown(run, reports);
    // The excerpt's own ``` must not be able to close the block we opened.
    assert.match(markdown, /````text\n/);
    assert.ok(
      markdown.includes('</details><script>'),
      'the excerpt is still reported verbatim',
    );
  });
});

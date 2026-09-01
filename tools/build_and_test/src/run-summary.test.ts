import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type RunSummary,
  type SummaryTask,
  MISS_LIST_LIMIT,
  SLOWEST_LIMIT,
  artifactLink,
  buildReports,
  cacheTally,
  cell,
  criticalPath,
  directReproduction,
  excerptLog,
  failedTasks,
  fenceFor,
  guardCommands,
  headline,
  humanDuration,
  inlineCode,
  omittedTaskCount,
  overviewLines,
  overviewMarkdown,
  parseRunSummary,
  remoteCacheAnomaly,
  savedClause,
  slowestTasks,
  stdoutReport,
  stripAnsi,
  summaryMarkdown,
  turboReproduction,
} from './run-summary.core.ts';

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

function summary(
  tasks: SummaryTask[],
  exitCode = 1,
  execOver: Partial<RunSummary['execution']> = {},
): RunSummary {
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
      ...execOver,
    },
    tasks,
  };
}

/** A cache hit: turbo records no elapsed time and a source for these. */
function hit(over: Partial<SummaryTask> = {}): SummaryTask {
  return task({
    cache: { status: 'HIT', source: 'REMOTE', timeSaved: 2_000 },
    execution: { startTime: 5_000, endTime: 5_000, exitCode: 0 },
    ...over,
  });
}

/** A task that ran and passed, taking `ms`. */
function ran(taskId: string, ms: number, over: Partial<SummaryTask> = {}) {
  return task({
    taskId,
    cache: { status: 'MISS', timeSaved: 0 },
    execution: { startTime: 0, endTime: ms, exitCode: 0 },
    ...over,
  });
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

  it('summaryMarkdown fences a repro whose command carries a fence', () => {
    // turbo echoes the command back from the run summary; a newline plus ```
    // in it would close a fixed fence and forge markdown after the block.
    const escape = 'tsc --noEmit\n```\n</details><script>alert(1)</script>';
    const run = summary([task({ command: escape })]);
    const markdown = summaryMarkdown(
      run,
      buildReports(run, new Map([['lit-ui-router#typecheck:src', 'boom']])),
    );
    assert.match(markdown, /````sh\n/);
    assert.ok(
      markdown.includes(escape),
      'the command is still reported verbatim',
    );
    // The forged tail stays inside the block: the excerpt after it still
    // opens its own fence, so nothing between them escaped.
    assert.match(markdown, /```text\nboom/);
  });

  it('inlineCode outgrows a backtick inside the span', () => {
    assert.equal(inlineCode('plain'), '`plain`');
    assert.equal(inlineCode('a ` b'), '``a ` b``');
    // Leading/trailing backticks need the padding CommonMark strips back off.
    assert.equal(inlineCode('`lead'), '`` `lead ``');
  });

  it('cell neutralises what would end the cell or the row', () => {
    assert.equal(cell('a | b'), 'a \\| b');
    assert.equal(cell('a\nb'), 'a b');
  });
});

describe('cacheTally', () => {
  it('splits hits by source and sums the time saved', () => {
    const run = summary([
      hit({
        taskId: 'a',
        cache: { status: 'HIT', source: 'REMOTE', timeSaved: 1_500 },
      }),
      hit({
        taskId: 'b',
        cache: { status: 'HIT', source: 'LOCAL', timeSaved: 500 },
      }),
      ran('c', 3_000),
    ]);
    assert.deepEqual(cacheTally(run), {
      hit: 2,
      local: 1,
      remote: 1,
      miss: 1,
      savedMs: 2_000,
    });
  });

  it('counts a task with no cache record as a miss', () => {
    const run = summary([task({ cache: undefined })]);
    assert.equal(cacheTally(run).miss, 1);
  });
});

describe('remoteCacheAnomaly', () => {
  const localOnly = () =>
    cacheTally(
      summary([
        hit({
          taskId: 'a',
          cache: { status: 'HIT', source: 'LOCAL', timeSaved: 1 },
        }),
      ]),
    );

  it('fires when everything hit but nothing came from the remote', () => {
    assert.match(
      remoteCacheAnomaly(localOnly(), true) ?? '',
      /none from the remote/,
    );
  });

  it('stays quiet off Actions, where local hits are the whole point', () => {
    assert.equal(remoteCacheAnomaly(localOnly(), false), undefined);
  });

  it('stays quiet when a hit came from the remote', () => {
    assert.equal(
      remoteCacheAnomaly(cacheTally(summary([hit()])), true),
      undefined,
    );
  });

  it('stays quiet when nothing hit — a full invalidation is not a fault', () => {
    const run = summary([ran('a', 10), ran('b', 20)]);
    assert.equal(remoteCacheAnomaly(cacheTally(run), true), undefined);
  });
});

describe('slowestTasks', () => {
  it('ranks by execution time and excludes cache hits', () => {
    const run = summary([
      ran('slow', 9_000),
      hit({ taskId: 'cached' }),
      ran('quick', 100),
      ran('middling', 2_000),
    ]);
    assert.deepEqual(
      slowestTasks(run, 10).map((t) => t.taskId),
      ['slow', 'middling', 'quick'],
    );
  });

  it('honours the limit', () => {
    const run = summary([ran('a', 3), ran('b', 2), ran('c', 1)]);
    assert.equal(slowestTasks(run, 2).length, 2);
  });
});

describe('omittedTaskCount', () => {
  it('is the gap between what turbo attempted and what it recorded', () => {
    const run = summary([task(), task({ taskId: 'other' })], 1, {
      attempted: 5,
    });
    assert.equal(omittedTaskCount(run), 3);
  });

  it('never goes negative when the counts disagree the other way', () => {
    const run = summary([task()], 0, { attempted: 0 });
    assert.equal(omittedTaskCount(run), 0);
  });
});

describe('criticalPath', () => {
  it('follows the slowest chain, not the longest one', () => {
    // short: a(1000) → b(1000) = 2000. long: c(500) → d(4000) = 4500.
    const run = summary([
      ran('a', 1_000),
      ran('b', 1_000, { dependencies: ['a'] }),
      ran('c', 500),
      ran('d', 4_000, { dependencies: ['c'] }),
    ]);
    assert.deepEqual(criticalPath(run), {
      taskIds: ['c', 'd'],
      totalMs: 4_500,
    });
  });

  it('ignores a dependency that is not in the summary', () => {
    const run = summary([
      ran('a', 1_000, { dependencies: ['cancelled#task'] }),
    ]);
    assert.deepEqual(criticalPath(run), { taskIds: ['a'], totalMs: 1_000 });
  });

  it('keeps a cached ancestor in the chain, though it costs nothing', () => {
    // The 7s floor really is build → typecheck; dropping the 0ms build would
    // report the same number but hide where it came from.
    const run = summary([
      hit({ taskId: 'build' }),
      ran('typecheck', 7_000, { dependencies: ['build'] }),
    ]);
    assert.deepEqual(criticalPath(run), {
      taskIds: ['build', 'typecheck'],
      totalMs: 7_000,
    });
  });

  it('terminates on a cycle turbo should never emit', () => {
    const run = summary([
      ran('a', 1_000, { dependencies: ['b'] }),
      ran('b', 1_000, { dependencies: ['a'] }),
    ]);
    assert.ok(criticalPath(run).totalMs > 0);
  });
});

describe('humanDuration', () => {
  it('stays in seconds below a minute', () => {
    assert.equal(humanDuration(26_400), '26.4s');
  });

  it('switches to minutes where seconds stop meaning anything', () => {
    assert.equal(humanDuration(480_827), '8m 1s');
  });
});

describe('overviewMarkdown', () => {
  const green = () =>
    summary([hit({ taskId: 'cached' }), ran('lit-ui-router#build', 4_000)], 0, {
      success: 1,
      failed: 0,
      cached: 1,
      attempted: 2,
    });

  it('leads with the counts, which is what makes the timings comparable', () => {
    const md = overviewMarkdown(green());
    const counts = md.indexOf('2 attempted, 1 cached');
    const timing = md.indexOf('Slowest tasks');
    assert.ok(counts > 0 && counts < timing, 'counts precede every duration');
  });

  it('reports the cache split and the time saved', () => {
    assert.match(
      overviewMarkdown(green()),
      /\*\*Cache\*\* — 1 hit \(1 remote, 0 local\), 1 miss, 2\.0s of task time saved\./,
    );
  });

  it('lists the misses and omits the hits from the slowest table', () => {
    const md = overviewMarkdown(green());
    assert.match(md, /1 cache miss<\/summary>/);
    assert.ok(!md.includes('| `cached` |'), 'a hit is never a slow task');
  });

  it('caps the miss list rather than scaling with the task count', () => {
    const many = Array.from({ length: MISS_LIST_LIMIT + 5 }, (_, i) =>
      ran(`pkg-${i}#build`, i),
    );
    const md = overviewMarkdown(summary(many, 0, { attempted: many.length }));
    assert.match(md, /… 5 more/);
  });

  it('caps the slowest table at SLOWEST_LIMIT rows', () => {
    const many = Array.from({ length: SLOWEST_LIMIT + 3 }, (_, i) =>
      ran(`pkg-${i}#build`, i * 100),
    );
    const run = summary(many, 0, { attempted: many.length });
    const rows = overviewMarkdown(run)
      .split('\n')
      .filter((l) => l.startsWith('| `'));
    assert.equal(rows.length, SLOWEST_LIMIT);
  });

  it('warns about cancelled tasks the artifact left out', () => {
    const run = summary([ran('a', 10)], 1, { attempted: 4 });
    assert.match(overviewMarkdown(run), /> \[!WARNING\]\n> 3 tasks cancelled/);
  });

  it('says nothing about cancellation when the counts agree', () => {
    const md = overviewMarkdown(green());
    assert.ok(!md.includes('cancelled'));
  });

  it('names the longest dependency chain', () => {
    const run = summary(
      [ran('a', 1_000), ran('b', 2_000, { dependencies: ['a'] })],
      0,
      { attempted: 2 },
    );
    assert.match(overviewMarkdown(run), /3\.0s across 2 tasks/);
    assert.match(overviewMarkdown(run), /`a` → `b`/);
  });

  it('skips the chain when no task depends on another', () => {
    assert.ok(!overviewMarkdown(green()).includes('Longest dependency chain'));
  });
});

describe('overviewLines', () => {
  it('stays short enough that a green run costs no scroll', () => {
    const run = summary([hit(), ran('a', 100)], 0, { attempted: 2 });
    assert.ok(
      overviewLines(run).length <= 4,
      'a clean run is a handful of lines',
    );
  });

  it('carries the same notes as the markdown lane', () => {
    const run = summary([ran('a', 10)], 1, { attempted: 4 });
    assert.ok(overviewLines(run).some((l) => l.includes('3 tasks cancelled')));
  });
});

describe('artifactLink', () => {
  const URL = 'https://github.com/o/r/actions/runs/1/artifacts/2';

  it('names the file so a reader can find it inside the zip', () => {
    const link = artifactLink({ artifactUrl: URL, fileName: 'abc.json' });
    assert.ok(link?.markdown.includes(`(<${URL}>)`));
    assert.ok(link?.markdown.includes('`abc.json`'));
    assert.equal(link?.line, `   full json: ${URL}`);
  });

  it('drops the file clause when the name is unknown', () => {
    const link = artifactLink({ artifactUrl: URL });
    assert.ok(link !== undefined);
    assert.ok(!link.markdown.includes('()'));
  });

  it('stays absent locally, where the file is already on disk', () => {
    assert.equal(artifactLink({}), undefined);
    assert.equal(artifactLink({ artifactUrl: '' }), undefined);
  });

  it('refuses anything but a plain https URL', () => {
    // The URL comes from the runner, but a markdown destination is a place
    // where trusting the input has never paid off.
    assert.equal(
      artifactLink({ artifactUrl: 'javascript:alert(1)' }),
      undefined,
    );
    assert.equal(artifactLink({ artifactUrl: 'https://x/a>b' }), undefined);
    assert.equal(artifactLink({ artifactUrl: 'https://x/a b' }), undefined);
  });
});

describe('the artifact link in the overview', () => {
  const URL = 'https://github.com/o/r/actions/runs/1/artifacts/2';
  const run = () => summary([hit(), ran('a', 100)], 0, { attempted: 2 });

  it('closes the markdown overview, after the capped lists it backs', () => {
    const md = overviewMarkdown(run(), {
      artifactUrl: URL,
      fileName: 'abc.json',
    });
    assert.ok(md.includes(URL));
    assert.ok(md.trimEnd().endsWith('artifacts.'));
  });

  it('adds exactly one line to the stdout lane', () => {
    assert.equal(
      overviewLines(run(), { artifactUrl: URL }).length,
      overviewLines(run()).length + 1,
    );
  });

  it('is absent from both lanes without a URL', () => {
    assert.ok(!overviewMarkdown(run()).includes('--summarize'));
    assert.ok(!overviewLines(run()).some((l) => l.includes('full json')));
  });
});

describe('savedClause', () => {
  const tally = (savedMs: number) => ({
    hit: 1,
    local: 0,
    remote: 1,
    miss: 0,
    savedMs,
  });

  it('reports the time when turbo populated it', () => {
    assert.equal(savedClause(tally(2_000), ' saved'), ', 2.0s saved');
  });

  it('says nothing rather than "0.0s saved" beside a hit count', () => {
    // Remote hits leave timeSaved at 0, so on CI the clause would contradict
    // the count next to it.
    assert.equal(savedClause(tally(0), ' saved'), '');
  });

  it('keeps the cache line coherent when every hit was remote', () => {
    const run = summary(
      [hit({ cache: { status: 'HIT', source: 'REMOTE' } })],
      0,
      {
        attempted: 1,
        cached: 1,
      },
    );
    assert.match(
      overviewMarkdown(run),
      /\*\*Cache\*\* — 1 hit \(1 remote, 0 local\), 0 miss\./,
    );
  });
});

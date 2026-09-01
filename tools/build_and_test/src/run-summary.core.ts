// Pure reporting logic for the CI run-summary step: turbo run summary in, two
// reports out — an overview of every run, and the failure detail of a red one.
// The IO (locating the summary, reading log files, writing the two output
// lanes) lives in ./run-summary.ts.
//
// The input is turbo's `--summarize` artifact, not its stdout. That choice is
// the whole design: when turbo tears a run down, the in-flight tasks it kills
// print `ELIFECYCLE Command failed` indistinguishably from the task that
// actually failed, and the run summary omits them from `tasks[]` entirely. The
// triage the stream cannot do, the summary has already done.
//
// The overview exists because a green run also has things worth saying: which
// tasks missed the cache, where the wall clock went, and whether the remote
// cache did anything at all. Those are silent failure modes — nothing is red,
// so nothing prompts anyone to look.

import {
  type WarnLaneLineOptions,
  type WarnLaneState,
  WARN_WATCHED_LANES,
  findWarnLaneState,
  warnLaneLine,
} from '@tools/warn-lanes/warn-lanes.core.ts';

/** Per-task execution record. turbo 2.10 carries no `status` — exitCode is it. */
export interface TaskExecution {
  startTime: number;
  endTime: number;
  exitCode?: number | null;
  error?: string;
}

/** turbo's per-task cache verdict. `source` is present only on a HIT. */
export interface TaskCache {
  status?: string;
  source?: 'LOCAL' | 'REMOTE';
  /** Execution time the hit avoided, in ms. 0 on a miss. */
  timeSaved?: number;
}

export interface SummaryTask {
  taskId: string;
  task: string;
  package: string;
  directory: string;
  command: string;
  /** Repo-root-relative; written as the task runs, so it survives the failure. */
  logFile: string;
  cache?: TaskCache;
  execution?: TaskExecution;
  /** taskIds this task waited on. Absent on older turbo; treated as empty. */
  dependencies?: string[];
}

export interface RunSummary {
  id: string;
  turboVersion: string;
  execution: {
    command: string;
    success: number;
    failed: number;
    cached: number;
    attempted: number;
    startTime: number;
    endTime: number;
    exitCode: number;
  };
  tasks: SummaryTask[];
}

/** A failing task plus the excerpt of its log we chose to republish. */
export interface FailureReport {
  task: SummaryTask;
  durationMs: number;
  excerpt: Excerpt;
}

export interface Excerpt {
  text: string;
  /** Lines dropped from the middle, 0 when the log was published whole. */
  omittedLines: number;
}

/**
 * Typed boundary: turbo owns this schema, so assert the two fields the report
 * cannot work without and cast. A shape change should fail loudly here rather
 * than produce a silently empty report — the step runs only when CI is already
 * red, and a blank summary there reads as "nothing to see".
 */
export function parseRunSummary(value: unknown): RunSummary {
  const summary = value as RunSummary;
  if (!Array.isArray(summary?.tasks)) {
    throw new Error('turbo run summary has no tasks[] array');
  }
  if (typeof summary.execution?.exitCode !== 'number') {
    throw new Error('turbo run summary has no execution.exitCode');
  }
  return summary;
}

/**
 * The genuinely-failing tasks, oldest first. Cancelled tasks never reach here
 * (turbo omits them), and a missing `execution` means the task never ran.
 */
export function failedTasks(summary: RunSummary): SummaryTask[] {
  return summary.tasks
    .filter((task) => {
      const code = task.execution?.exitCode;
      return typeof code === 'number' && code !== 0;
    })
    .sort(
      (a, b) => (a.execution?.startTime ?? 0) - (b.execution?.startTime ?? 0),
    );
}

// CSI + OSC sequences. Task logs hold raw tool output, which is coloured;
// markdown code fences render the escapes literally, so they have to go.
// Built from a string so no ESC byte sits in this file.
const ESC = '\\u001B';
const ANSI = new RegExp(
  `${ESC}\\[[0-9;?]*[ -/]*[@-~]|${ESC}\\][^]*?(?:\\u0007|${ESC}\\\\)`,
  'g',
);

export function stripAnsi(value: string): string {
  return value.replaceAll(ANSI, '');
}

export interface ExcerptBudget {
  /** Lines kept from the top when the log must be cut. */
  headLines: number;
  /** Lines kept from the bottom when the log must be cut. */
  tailLines: number;
  /** Hard cap after line selection; trimmed from the head, which is the less
   *  informative end for every runner in this repo. */
  maxBytes: number;
}

/**
 * Defaults sized from the real spread of task logs (112 B for a lint task,
 * 389 KB for the Cypress e2e suite): the common failure — typecheck, lint, a
 * unit suite — fits whole, and only the e2e-class logs are ever cut.
 *
 * Tail-weighted because tsc, oxlint and node:test all put the verdict last.
 * Cypress buries its failure mid-log behind a passing-suite preamble, which is
 * why the head is kept too rather than tailing alone.
 */
export const DEFAULT_BUDGET: ExcerptBudget = {
  headLines: 20,
  tailLines: 80,
  maxBytes: 16 * 1024,
};

export function excerptLog(raw: string, budget = DEFAULT_BUDGET): Excerpt {
  const lines = stripAnsi(raw)
    .split('\n')
    // pnpm echoes `$ <script body>` as the first line; the report prints the
    // reproduction commands itself, so the echo is duplication.
    .filter((line, index) => !(index === 0 && line.startsWith('$ ')));

  // pnpm's own epitaph, on every failing task. The exit code is already in
  // the table and the headline; here it just pushes the real error up.
  while (
    lines.length > 0 &&
    (lines.at(-1)?.trim() === '' ||
      lines.at(-1)?.startsWith('[ELIFECYCLE]') === true)
  ) {
    lines.pop();
  }

  const keep = budget.headLines + budget.tailLines;
  let omitted = 0;
  let kept = lines;
  if (lines.length > keep) {
    omitted = lines.length - keep;
    kept = [
      ...lines.slice(0, budget.headLines),
      `… ${omitted} lines omitted …`,
      ...lines.slice(-budget.tailLines),
    ];
  }

  let text = kept.join('\n');
  if (Buffer.byteLength(text, 'utf8') > budget.maxBytes) {
    // Trim from the head: the tail holds the verdict.
    const buffer = Buffer.from(text, 'utf8');
    text = buffer.subarray(buffer.length - budget.maxBytes).toString('utf8');
    // The byte cut lands mid-line; drop the partial leader.
    text = text.slice(text.indexOf('\n') + 1);
    omitted = Math.max(omitted, 1);
    text = `… head trimmed to ${budget.maxBytes} bytes …\n${text}`;
  }
  return { text, omittedLines: omitted };
}

/**
 * How to re-run just this task locally. `--force` because the failure is not
 * in the cache (turbo never caches a failure) but its dependencies are, and a
 * reader chasing a flake wants the bypass anyway.
 */
export function turboReproduction(task: SummaryTask): string {
  const filter = task.package === '//' ? '//' : task.package;
  return `turbo run ${task.task} --filter=${filter} --force`;
}

/** The exact command turbo ran, and where. The literal repro, not a re-derivation. */
export function directReproduction(task: SummaryTask): string {
  const dir = task.directory === '' ? '.' : task.directory;
  return `cd ${dir} && ${task.command}`;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Same as `seconds` until a minute, where "480.8s" stops meaning anything. */
export function humanDuration(ms: number): string {
  if (ms < 60_000) return seconds(ms);
  const whole = Math.round(ms / 1000);
  return `${Math.floor(whole / 60)}m ${whole % 60}s`;
}

export function buildReports(
  summary: RunSummary,
  logs: Map<string, string>,
  budget = DEFAULT_BUDGET,
): FailureReport[] {
  return failedTasks(summary).map((task) => {
    const exec = task.execution;
    const raw = logs.get(task.taskId);
    return {
      task,
      durationMs: (exec?.endTime ?? 0) - (exec?.startTime ?? 0),
      excerpt:
        raw === undefined
          ? {
              text: `(no log file at ${task.logFile})\n${exec?.error ?? ''}`.trim(),
              omittedLines: 0,
            }
          : excerptLog(raw, budget),
    };
  });
}

// ── Overview analysis ────────────────────────────────────────────────────────
// Everything below reads the same artifact the failure report does. A green run
// still answers: did the cache work, and where did the wall clock go.

/** Wall time the task itself took. A cache hit has none — start equals end. */
export function taskDuration(task: SummaryTask): number {
  const exec = task.execution;
  return (exec?.endTime ?? 0) - (exec?.startTime ?? 0);
}

export function wasCacheHit(task: SummaryTask): boolean {
  return task.cache?.status === 'HIT';
}

export interface CacheTally {
  hit: number;
  /** Hits served from the on-disk cache. */
  local: number;
  /** Hits served from the remote cache. */
  remote: number;
  miss: number;
  /** Summed `timeSaved` across hits: task time the run did not have to spend. */
  savedMs: number;
}

/**
 * The saved-time clause, dropped when turbo reports nothing. It fills in
 * `timeSaved` for local hits but leaves it 0 for remote ones, so on CI — where
 * every hit is remote — "73 hit, 0.0s saved" reads as a contradiction of the
 * count beside it. Silence is the honest rendering of an unpopulated field.
 */
export function savedClause(tally: CacheTally, suffix: string): string {
  return tally.savedMs > 0 ? `, ${humanDuration(tally.savedMs)}${suffix}` : '';
}

export function cacheTally(summary: RunSummary): CacheTally {
  const tally: CacheTally = {
    hit: 0,
    local: 0,
    remote: 0,
    miss: 0,
    savedMs: 0,
  };
  for (const task of summary.tasks) {
    if (!wasCacheHit(task)) {
      tally.miss += 1;
      continue;
    }
    tally.hit += 1;
    tally.savedMs += task.cache?.timeSaved ?? 0;
    if (task.cache?.source === 'REMOTE') tally.remote += 1;
    else if (task.cache?.source === 'LOCAL') tally.local += 1;
  }
  return tally;
}

/**
 * The remote cache did nothing, on a run where something hit.
 *
 * Only meaningful on Actions: CI restores no `.turbo` directory — the workflow
 * caches the browser binaries and nothing else — so every hit there has to
 * come from the remote, and a LOCAL one means the run found a cache it should
 * not have. On a developer's machine local hits are the whole point, which is
 * why this is gated rather than merely worded for CI.
 *
 * Silent when nothing hit at all: a change that invalidates the whole graph is
 * the ordinary reason for that, and a note that fires on legitimate runs is a
 * note people learn to skip.
 */
export function remoteCacheAnomaly(
  tally: CacheTally,
  onActions: boolean,
): string | undefined {
  if (!onActions || tally.hit === 0 || tally.remote > 0) return undefined;
  return `${tally.hit} cache hit${tally.hit === 1 ? '' : 's'}, none from the remote cache — CI restores no local .turbo, so the remote cache is likely misconfigured (check TURBO_TOKEN, TURBO_API, TURBO_TEAM and the signature key)`;
}

/** Tasks that had to run, slowest first. Hits are excluded — they took no time. */
export function slowestTasks(
  summary: RunSummary,
  limit: number,
): SummaryTask[] {
  return summary.tasks
    .filter((task) => !wasCacheHit(task))
    .sort((a, b) => taskDuration(b) - taskDuration(a))
    .slice(0, limit);
}

/**
 * Tasks turbo counted but left out of `tasks[]` — the ones it cancelled when
 * tearing a failed run down. The count is the only trace they leave, and it is
 * the difference between "3 things broke" and "1 broke, 2 were killed".
 */
export function omittedTaskCount(summary: RunSummary): number {
  return Math.max(0, summary.execution.attempted - summary.tasks.length);
}

export interface CriticalPath {
  /** Task ids from the root of the chain to its last task. */
  taskIds: string[];
  /** Summed execution time along the chain. */
  totalMs: number;
}

/**
 * The longest dependency chain by execution time. Not the true wall-clock
 * critical path — that depends on how many tasks turbo could run at once — but
 * it is the floor no amount of concurrency can beat, which is the number worth
 * optimising against.
 */
/**
 * Longer wins; on a tie, the chain with more tasks in it. Without the
 * tie-break a cached dependency — which costs 0ms — drops out of the chain it
 * belongs to, and `build → typecheck` renders as `typecheck` alone.
 */
function longerPath(a: CriticalPath, b: CriticalPath): CriticalPath {
  if (b.totalMs > a.totalMs) return b;
  if (b.totalMs === a.totalMs && b.taskIds.length > a.taskIds.length) return b;
  return a;
}

export function criticalPath(summary: RunSummary): CriticalPath {
  const byId = new Map(summary.tasks.map((task) => [task.taskId, task]));
  const memo = new Map<string, CriticalPath>();
  const visiting = new Set<string>();

  function walk(taskId: string): CriticalPath {
    const cached = memo.get(taskId);
    if (cached !== undefined) return cached;
    const task = byId.get(taskId);
    // Unknown id, or a cycle turbo should never emit: contribute nothing
    // rather than recurse forever.
    if (task === undefined || visiting.has(taskId)) {
      return { taskIds: [], totalMs: 0 };
    }

    visiting.add(taskId);
    let best: CriticalPath = { taskIds: [], totalMs: 0 };
    for (const dep of task.dependencies ?? [])
      best = longerPath(best, walk(dep));
    visiting.delete(taskId);

    const result = {
      taskIds: [...best.taskIds, taskId],
      totalMs: best.totalMs + taskDuration(task),
    };
    memo.set(taskId, result);
    return result;
  }

  let longest: CriticalPath = { taskIds: [], totalMs: 0 };
  for (const task of summary.tasks)
    longest = longerPath(longest, walk(task.taskId));
  return longest;
}

/** One-line headline, reused by both output lanes and by the run annotation. */
export function headline(
  summary: RunSummary,
  reports: FailureReport[],
): string {
  const { attempted, success, cached } = summary.execution;
  const names = reports.map((report) => report.task.taskId).join(', ');
  const what =
    reports.length === 0 ? 'no task reported a non-zero exit' : names;
  return `${reports.length} failing task${reports.length === 1 ? '' : 's'}: ${what} — ${success} succeeded, ${cached} cached, ${attempted} attempted`;
}

/**
 * A fence longer than the longest backtick run in `text`, so an excerpt that
 * itself contains ``` cannot close the block and inject markdown into the
 * summary. Log text is untrusted: a PR's own test output ends up in here.
 */
function longestBacktickRun(text: string): number {
  let longest = 0;
  for (const run of text.match(/`+/g) ?? [])
    longest = Math.max(longest, run.length);
  return longest;
}

export function fenceFor(text: string): string {
  return '`'.repeat(Math.max(3, longestBacktickRun(text) + 1));
}

/**
 * `fenceFor` for a span rather than a block. Task ids and commands are
 * repo-controlled, not log text, so this is defence in depth rather than a
 * live hole — but the overview puts them in a table, where an unbalanced
 * backtick corrupts every row after it.
 */
export function inlineCode(text: string): string {
  const delimiter = '`'.repeat(longestBacktickRun(text) + 1);
  // A span whose content starts or ends with a backtick needs the padding
  // spaces; CommonMark strips one from each side on render.
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${delimiter}${pad}${text}${pad}${delimiter}`;
}

/** A table cell: a literal `|` ends the cell, and a newline ends the row. */
export function cell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

/**
 * Wraps stdout chunks in a `::stop-commands::` pair so the runner reads the
 * republished logs as plain text. Same untrusted-text problem as `fenceFor`,
 * different parser: on Actions a log line starting with `::` IS a workflow
 * command, so an excerpt could forge annotations or stop command processing
 * for the rest of the job. The token must be unguessable — a log that could
 * predict it could emit the resume line itself and escape the guard.
 *
 * No token (running locally) leaves the chunks alone; nothing parses them.
 */
export function guardCommands(chunks: string[], token?: string): string[] {
  if (token === undefined || token === '') return chunks;
  return [`::stop-commands::${token}`, ...chunks, `::${token}::`];
}

/** Slowest-task rows. Ten fits on screen; the tail is never the problem. */
export const SLOWEST_LIMIT = 10;

/**
 * Cap on the listed cache misses. A change that invalidates the whole graph
 * would otherwise print every task, and a report that scales with the task
 * count is one people stop reading.
 */
export const MISS_LIST_LIMIT = 25;

/** The counts line. Deliberately ahead of every duration below it: task counts
 *  and cache buckets are what make the timings comparable between runs. */
function overviewHeadline(summary: RunSummary): string {
  const { command, attempted, cached, success, failed, startTime, endTime } =
    summary.execution;
  return `${inlineCode(command)} — ${attempted} attempted, ${cached} cached, ${success} succeeded, ${failed} failed, in ${humanDuration(endTime - startTime)}.`;
}

/**
 * A warn-only lane and whatever it asserted about itself this run. Warn lanes
 * exit 0, so nothing in the run summary distinguishes one carrying 36 warnings
 * from a clean one — the state comes from a marker the lane prints into its own
 * task log, and `undefined` means the lane did not run (or ran before the
 * marker existed), which is itself worth saying out loud.
 */
export interface WarnLaneEntry {
  task: string;
  state?: WarnLaneState;
}

/**
 * The watched lanes, in list order — not in the order turbo happened to run
 * them, and never derived from the summary: a lane that did not run must still
 * get a line, or its absence reads as "fine".
 */
export function warnLaneEntries(logs: Map<string, string>): WarnLaneEntry[] {
  return WARN_WATCHED_LANES.map((task) => ({
    task,
    state: findWarnLaneState(stripAnsi(logs.get(task) ?? '')),
  }));
}

export function warnLaneReport(
  entries: readonly WarnLaneEntry[],
  options: WarnLaneLineOptions = {},
): string[] {
  return entries.map(({ task, state }) => warnLaneLine(task, state, options));
}

/**
 * What the renderers need beyond the summary itself. An options object rather
 * than more positional parameters: these fields are unrelated to each other,
 * and a call site reading `(summary, true, url)` says nothing about any of them.
 */
export interface OverviewContext {
  /** `GITHUB_ACTIONS`; gates the notes that only mean something on a runner. */
  onActions?: boolean;
  /** The uploaded `--summarize` JSON — the uncapped copy of this report. */
  artifactUrl?: string;
  /** Which file in that artifact this report read. */
  fileName?: string;
  /**
   * Warn-only lanes and the state each asserted. Not derivable from `summary`:
   * these lanes exit 0, so the artifact cannot tell one carrying warnings from
   * a clean one. Empty renders nothing.
   */
  warnLanes?: readonly WarnLaneEntry[];
}

/**
 * Link to the uploaded summary JSON. Every list above is capped, so the
 * artifact is where the tail lives; the caps stay honest instead of silently
 * standing in for the whole run. Angle-bracket destination, and https only —
 * the URL arrives from the runner, but nothing here needs to trust it.
 */
export function artifactLink(
  context: OverviewContext,
): { markdown: string; line: string } | undefined {
  const { artifactUrl, fileName } = context;
  if (artifactUrl === undefined || !artifactUrl.startsWith('https://')) {
    return undefined;
  }
  if (/[\s<>]/.test(artifactUrl)) return undefined;
  const which =
    fileName === undefined ? '' : ` (${inlineCode(cell(fileName))})`;
  return {
    markdown: `[Full \`--summarize\` JSON](<${artifactUrl}>)${which} — the untruncated run, downloadable from this run's artifacts.`,
    line: `   run summary json: ${artifactUrl}`,
  };
}

/** The overview lane's notes: things that are wrong but not red. */
function overviewNotes(
  summary: RunSummary,
  tally: CacheTally,
  onActions: boolean,
): string[] {
  const notes: string[] = [];
  const omitted = omittedTaskCount(summary);
  if (omitted > 0) {
    notes.push(
      `${omitted} task${omitted === 1 ? '' : 's'} cancelled — turbo killed them as it tore the run down and left them out of the summary. They are not failures.`,
    );
  }
  const anomaly = remoteCacheAnomaly(tally, onActions);
  if (anomaly !== undefined) notes.push(anomaly);
  return notes;
}

/**
 * The always-on half of the report. Runs green or red; on a red run it sits
 * above the failure detail, because "16 of 158 ran" is the context for
 * whichever one of them broke.
 */
export function overviewMarkdown(
  summary: RunSummary,
  context: OverviewContext = {},
): string {
  const onActions = context.onActions ?? false;
  const tally = cacheTally(summary);
  const out: string[] = [
    '## Turbo run summary',
    '',
    overviewHeadline(summary),
    '',
  ];

  for (const note of overviewNotes(summary, tally, onActions)) {
    out.push('> [!WARNING]', `> ${note}`, '');
  }

  out.push(
    `**Cache** — ${tally.hit} hit (${tally.remote} remote, ${tally.local} local), ${tally.miss} miss${savedClause(tally, ' of task time saved')}.`,
    '',
  );

  const slowest = slowestTasks(summary, SLOWEST_LIMIT);
  if (slowest.length > 0) {
    out.push(
      '**Slowest tasks** — cache misses only; a hit costs no time.',
      '',
      '| Task | Time |',
      '| --- | ---: |',
    );
    for (const task of slowest) {
      out.push(
        `| ${inlineCode(cell(task.taskId))} | ${humanDuration(taskDuration(task))} |`,
      );
    }
    out.push('');
  }

  const path = criticalPath(summary);
  if (path.taskIds.length > 1) {
    out.push(
      `**Longest dependency chain** — ${humanDuration(path.totalMs)} across ${path.taskIds.length} tasks, the floor no extra concurrency can beat.`,
      '',
      path.taskIds.map((id) => inlineCode(id)).join(' → '),
      '',
    );
  }

  const warnLines = warnLaneReport(context.warnLanes ?? []);
  if (warnLines.length > 0) {
    out.push(
      '**Warn-only lanes** — green by design; the floor is `tools/lint-elements/warnings.json`.',
      '',
      ...warnLines.map((line) => `- ${line}`),
      '',
    );
  }

  const misses = summary.tasks.filter((task) => !wasCacheHit(task));
  if (misses.length > 0) {
    out.push(
      `<details><summary>${misses.length} cache miss${misses.length === 1 ? '' : 'es'}</summary>`,
      '',
    );
    for (const task of misses.slice(0, MISS_LIST_LIMIT)) {
      out.push(`- ${inlineCode(task.taskId)}`);
    }
    if (misses.length > MISS_LIST_LIMIT) {
      out.push(`- … ${misses.length - MISS_LIST_LIMIT} more`);
    }
    out.push('', '</details>', '');
  }

  const link = artifactLink(context);
  if (link !== undefined) out.push(link.markdown, '');

  return `${out.join('\n')}\n`;
}

/** The stdout twin of `overviewMarkdown`, kept to a handful of lines: on a
 *  green run nobody is reading this, and it should not cost them a scroll. */
export function overviewLines(
  summary: RunSummary,
  context: OverviewContext = {},
): string[] {
  const onActions = context.onActions ?? false;
  const tally = cacheTally(summary);
  const { attempted, cached, success, failed, startTime, endTime } =
    summary.execution;
  const lines = [
    `── ${summary.execution.command} — ${attempted} attempted, ${cached} cached, ${success} succeeded, ${failed} failed, ${humanDuration(endTime - startTime)}`,
    `   cache: ${tally.hit} hit (${tally.remote} remote, ${tally.local} local), ${tally.miss} miss${savedClause(tally, ' saved')}`,
  ];

  const slowest = slowestTasks(summary, SLOWEST_LIMIT);
  if (slowest.length > 0) {
    lines.push(
      `   slowest: ${slowest.map((task) => `${task.taskId} ${humanDuration(taskDuration(task))}`).join(', ')}`,
    );
  }

  const path = criticalPath(summary);
  if (path.taskIds.length > 1) {
    lines.push(
      `   longest chain: ${humanDuration(path.totalMs)} across ${path.taskIds.length} tasks`,
    );
  }

  // Verdict only: the breakdown is a markdown-twin luxury, and here it competes
  // for one terminal row with the thing a reader actually needs off this line.
  for (const line of warnLaneReport(context.warnLanes ?? [], { rules: false }))
    lines.push(`   warn-lane: ${line}`);

  for (const note of overviewNotes(summary, tally, onActions))
    lines.push(`   note: ${note}`);

  // Blank line first: the link is a footer for the whole block, and set flush
  // against the facts it reads as a continuation of whichever one ran last.
  const link = artifactLink(context);
  if (link !== undefined) lines.push('', link.line);
  return lines;
}

/** The `$GITHUB_STEP_SUMMARY` lane: rendered markdown on the run page. */
export function summaryMarkdown(
  summary: RunSummary,
  reports: FailureReport[],
): string {
  const out: string[] = ['## CI failure summary', ''];

  if (reports.length === 0) {
    out.push(
      `\`${summary.execution.command}\` exited ${summary.execution.exitCode}, but no task reported a non-zero exit.`,
      '',
      'That means the run died outside a task — a turbo-level error, a runner',
      'timeout, or a cancellation. The full step log is the only source.',
      '',
    );
    return `${out.join('\n')}\n`;
  }

  const { attempted, success, cached } = summary.execution;
  out.push(
    `\`${summary.execution.command}\` — **${reports.length} failing**, ${success} succeeded, ${cached} cached, of ${attempted} attempted.`,
    '',
    '| Task | Package | Exit | Time |',
    '| --- | --- | ---: | ---: |',
  );
  for (const { task, durationMs } of reports) {
    out.push(
      `| \`${task.task}\` | \`${task.package}\` | ${task.execution?.exitCode} | ${seconds(durationMs)} |`,
    );
  }
  out.push('');

  for (const { task, excerpt } of reports) {
    // Fenced with `fenceFor`, like the excerpt below it: the repro carries
    // `task.command`, so a backtick run in it would otherwise close the block
    // early and let the rest render as markdown.
    const reproduction = [
      turboReproduction(task),
      '# or, exactly as CI ran it:',
      directReproduction(task),
    ].join('\n');
    const fence = fenceFor(reproduction);
    out.push(
      `### \`${task.taskId}\``,
      '',
      'Reproduce:',
      '',
      `${fence}sh`,
      reproduction,
      fence,
      '',
    );
    if (excerpt.omittedLines > 0) {
      out.push(
        `<details><summary>Log excerpt — ${excerpt.omittedLines} lines omitted, full log in the step output</summary>`,
        '',
      );
    }
    const excerptFence = fenceFor(excerpt.text);
    out.push(`${excerptFence}text`, excerpt.text, excerptFence, '');
    if (excerpt.omittedLines > 0) out.push('</details>', '');
  }
  return `${out.join('\n')}\n`;
}

/**
 * The stdout lane. A step summary never appears in the logs API, so an agent
 * running `gh run view --log-failed` cannot see it — the same content has to
 * be printed too. Grouped per task, and the headline lands outside every group
 * so it is visible without expanding anything.
 */
export function stdoutReport(
  summary: RunSummary,
  reports: FailureReport[],
): string[] {
  const lines: string[] = [];
  for (const { task, excerpt } of reports) {
    lines.push(
      `── ${task.taskId} (exit ${task.execution?.exitCode})`,
      `   repro: ${turboReproduction(task)}`,
      `   exact: ${directReproduction(task)}`,
      '',
      excerpt.text,
      '',
    );
  }
  lines.push(headline(summary, reports));
  return lines;
}

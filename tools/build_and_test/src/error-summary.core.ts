// Pure reporting logic for the CI error-summary step: turbo run summary in,
// focused failure report out. The IO (locating the summary, reading log files,
// writing the two output lanes) lives in ./error-summary.ts.
//
// The input is turbo's `--summarize` artifact, not its stdout. That choice is
// the whole design: when turbo tears a run down, the in-flight tasks it kills
// print `ELIFECYCLE Command failed` indistinguishably from the task that
// actually failed, and the run summary omits them from `tasks[]` entirely. The
// triage the stream cannot do, the summary has already done.

/** Per-task execution record. turbo 2.10 carries no `status` — exitCode is it. */
export interface TaskExecution {
  startTime: number;
  endTime: number;
  exitCode?: number | null;
  error?: string;
}

export interface SummaryTask {
  taskId: string;
  task: string;
  package: string;
  directory: string;
  command: string;
  /** Repo-root-relative; written as the task runs, so it survives the failure. */
  logFile: string;
  cache?: { status?: string };
  execution?: TaskExecution;
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
export function fenceFor(text: string): string {
  let longest = 0;
  for (const run of text.match(/`+/g) ?? [])
    longest = Math.max(longest, run.length);
  return '`'.repeat(Math.max(3, longest + 1));
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
    out.push(
      `### \`${task.taskId}\``,
      '',
      'Reproduce:',
      '',
      '```sh',
      turboReproduction(task),
      '# or, exactly as CI ran it:',
      directReproduction(task),
      '```',
      '',
    );
    if (excerpt.omittedLines > 0) {
      out.push(
        `<details><summary>Log excerpt — ${excerpt.omittedLines} lines omitted, full log in the step output</summary>`,
        '',
      );
    }
    const fence = fenceFor(excerpt.text);
    out.push(`${fence}text`, excerpt.text, fence, '');
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

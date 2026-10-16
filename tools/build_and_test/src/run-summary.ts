#!/usr/bin/env node
// Reports a `turbo run` on both lanes: `$GITHUB_STEP_SUMMARY` (rendered
// markdown, for humans reading the run page) and stdout (for agents, which
// reach CI through the logs API and never see a step summary).
//
// Two sections. The overview runs every time — cache split, slowest tasks,
// longest dependency chain — because a green run still hides things worth
// knowing. The failure detail is appended only when a task actually failed,
// and is empty rather than absent on a green run: `failedTasks()` returns [].
// On Actions, annotation commands the tools wrote into their task logs are
// re-emitted too, since turbo's line prefix keeps the runner from seeing them.
//
// Input is every `.turbo/runs/*.json` this session wrote, in the order they
// ran — `mise run ci` invokes turbo three times (the graph, the docs build,
// the e2e suites), and reporting only the newest showed whichever finished
// last. The session boundary comes from the marker the `mark_session` task
// writes; without one this reports the newest run alone. See
// run-summary.core.ts for why the summary, not the stream, is the input.
//
// Fails open, always. On a red job a second red step here would be noise
// pointing at the reporter instead of the failure, and an exception must never
// mask the real one; on a green job it must never be what turns the build red.
// Every failure path warns and exits 0.
//
// env: GITHUB_STEP_SUMMARY (runner file; printed when unset),
//      TURBO_RUNS_DIR (override for tests and local reproduction),
//      TURBO_SUMMARY_SESSION (the session marker; same override reasons),
//      TURBO_SUMMARY_ARTIFACT_URL (the uploaded `--summarize` JSON, linked as
//      the uncapped copy of the capped lists this prints),
//      VITEST_ATTACHMENTS_ARTIFACT_URL (the uploaded `.vitest/` dirs, linked
//      when a failing spec wrote a screenshot or attachment),
//      CYPRESS_SCREENSHOTS_ARTIFACT_URL (the uploaded Cypress screenshots,
//      linked when an e2e suite failed),
//      A11Y_SCREENSHOTS_ARTIFACT_URL (the uploaded axe screenshots, linked
//      when the axe pass found violations),
//      TURBO_LOGS_ARTIFACT_URL (the uploaded per-task turbo logs),
//      GITHUB_RUN_ID (names the run in the format.patch download command).

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { appendFile, readdir, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

import {
  type FormatFinding,
  type PatchNote,
  FORMAT_DIFF_LIMIT,
  FORMAT_PATCH,
  extractFormatFindings,
  formatPatch,
  formattingLines,
  formattingMarkdown,
  formattingTier,
  parseHunks,
  parsePreview,
  patchCommand,
  patchSection,
} from './format-annotations.core.ts';

import {
  type OverviewContext,
  type RunReport,
  type RunSummary,
  type StructuredLogEntry,
  annotationNote,
  buildReports,
  extractAnnotations,
  guardCommands,
  parseRunSummary,
  planAnnotations,
  sessionFailureMarkdown,
  sessionHeadline,
  sessionLines,
  sessionMarkdown,
  sessionStdoutReport,
  structuredTaskLog,
  type ToolAnnotation,
} from './run-summary.core.ts';
import { extractTscDiagnostics } from './tsc-annotations.core.ts';
import { errorCommand, warningCommand } from '@tools/shared/gha.core.ts';
import { onActions } from '@tools/shared/gha.ts';

const RUNS_DIR = process.env.TURBO_RUNS_DIR ?? '.turbo/runs';

/** Where `turbo --log-file` writes by default: an uncached task's only log. */
const LOGS_DIR = '.turbo/logs';

const SESSION_FILE =
  process.env.TURBO_SUMMARY_SESSION ?? '.turbo/summary-session';

/** Fresh per run: a log that could guess the token could escape the guard. */
function commandToken(): string | undefined {
  return onActions() ? randomUUID() : undefined;
}

function warn(message: string): void {
  console.log(onActions() ? warningCommand(message) : message);
}

/**
 * When the current session started, as epoch ms. Written by the `mark_session`
 * task as the first step of `mise run ci`, which is what makes "this job's
 * runs" answerable at all: `--summarize` takes only true|false, no path, so a
 * summary carries no job identity and the runs directory is append-only.
 *
 * Absent is normal — a bare `turbo run --summarize` then this reporter — and
 * means "report the newest run only", which is what this step did before it
 * learned to report a whole session.
 */
async function sessionStart(): Promise<number | undefined> {
  try {
    const raw = Number.parseInt(await readFile(SESSION_FILE, 'utf8'), 10);

    return Number.isFinite(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

interface FoundFile {
  path: string;
  mtimeMs: number;
}

/** Every `*.json` in `dir`, newest first. */
async function allJson(dir: string): Promise<FoundFile[]> {
  let names: string[];

  try {
    names = (await readdir(dir)).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }

  const found: FoundFile[] = [];

  for (const name of names) {
    const path = join(dir, name);
    const { mtimeMs } = await stat(path);
    found.push({ path, mtimeMs });
  }

  return found.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * The run summaries or `--log-file` logs this session wrote under `dir`, oldest
 * first — `mise run ci` invokes turbo three times (the graph, the docs build,
 * the e2e suites) and every one of them is a run worth seeing.
 *
 * Selected by mtime against the session marker rather than by parsing each
 * file, so a half-written or malformed summary costs its own line and not the
 * report. With no marker this degrades to the newest single run.
 */
async function sessionFiles(dir: string): Promise<string[]> {
  const found = await allJson(dir);

  if (found.length === 0) return [];
  const started = await sessionStart();

  if (started === undefined) return [found[0]?.path ?? ''].filter(Boolean);
  const mine = found.filter((entry) => entry.mtimeMs >= started);

  // A marker older than every summary would still be a session of one: the
  // newest run is never wrong to report, and an empty report always is.
  if (mine.length === 0) return [found[0]?.path ?? ''].filter(Boolean);

  return mine.reverse().map((entry) => entry.path);
}

/**
 * Every task's log: failing tasks for the excerpts, warn-watched lanes for
 * their state, and all of them for tool annotations — a green lint task's
 * warnings live only in the log it printed (which turbo replays on a cache hit).
 */
async function readLogs(
  summary: RunSummary,
  structured: readonly StructuredLogEntry[],
): Promise<Map<string, string>> {
  const logs = new Map<string, string>();

  for (const task of summary.tasks) {
    const own =
      task.logFile === undefined
        ? undefined
        : await readFile(task.logFile, 'utf8').catch(() => undefined);

    const log = own ?? structuredTaskLog(structured, task);

    // Left unset: buildReports renders the execution.error instead.
    if (log !== undefined) logs.set(task.taskId, log);
  }

  return logs;
}

/** Every entry of this session's `--log-file` logs; an unreadable one is skipped. */
async function readStructuredLogs(): Promise<StructuredLogEntry[]> {
  const entries: StructuredLogEntry[] = [];

  for (const path of await sessionFiles(LOGS_DIR)) {
    try {
      // SAFETY: turbo's documented --log-file shape, a JSON array at all times
      entries.push(
        ...(JSON.parse(await readFile(path, 'utf8')) as StructuredLogEntry[]),
      );
    } catch (error: unknown) {
      warn(
        `skipping ${basename(path)}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return entries;
}

/** The formatter's verdict on `finding` from stdin; the checkout is never written. */
function formatted(finding: FormatFinding): string | undefined {
  const cwd = resolve(finding.directory || '.');

  const [command, args] =
    finding.tool === 'oxfmt'
      ? [
          join(cwd, 'node_modules/.bin/oxfmt'),
          [`--stdin-filepath=${finding.path}`],
        ]
      : ['taplo', ['fmt', '-']];

  const result = spawnSync(command, args, {
    cwd,
    input: readFileSync(finding.file),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30_000,
  });

  return result.status === 0 ? result.stdout : undefined;
}

/** `git diff` of `file` against `target`, with `context` lines around each hunk. */
function diffAgainst(
  file: string,
  target: string,
  context: number,
): string | undefined {
  const diff = spawnSync(
    'git',
    [
      'diff',
      '--no-index',
      '--no-color',
      '--no-ext-diff',
      `-U${context}`,
      '--',
      file,
      target,
    ],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );

  // 1 means the files differ, the expected case.
  return diff.status === 0 || diff.status === 1 ? diff.stdout : undefined;
}

/** Each finding's hunks, preview and patch; one that cannot be diffed stays file-level. */
function diffFormatting(findings: readonly FormatFinding[]): void {
  if (findings.length === 0) return;
  const dir = mkdtempSync(join(tmpdir(), 'format-diff-'));

  try {
    for (const [at, finding] of findings
      .slice(0, FORMAT_DIFF_LIMIT)
      .entries()) {
      try {
        const output = formatted(finding);

        if (output === undefined) continue;
        const target = join(dir, String(at));
        writeFileSync(target, output);
        const ranges = diffAgainst(finding.file, target, 0);

        if (ranges === undefined) continue;
        finding.hunks = parseHunks(ranges);
        finding.preview = parsePreview(ranges);
        const full = diffAgainst(finding.file, target, 3);

        finding.patch =
          full === undefined ? undefined : patchSection(full, finding.file);
      } catch (error: unknown) {
        warn(
          `no lines for ${finding.file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Writes every diffed file's fix to `FORMAT_PATCH`, replacing a stale one. */
function writePatch(findings: readonly FormatFinding[]): PatchNote | undefined {
  rmSync(FORMAT_PATCH, { force: true });
  const text = formatPatch(findings);

  if (text === '') return undefined;

  try {
    mkdirSync(dirname(FORMAT_PATCH), { recursive: true });
    writeFileSync(FORMAT_PATCH, text);
  } catch (error: unknown) {
    warn(
      `no ${FORMAT_PATCH}: ${error instanceof Error ? error.message : String(error)}`,
    );

    return undefined;
  }

  return {
    command: patchCommand(onActions() ? process.env.GITHUB_RUN_ID : undefined),
    files: findings.filter(({ patch }) => patch !== undefined).length,
  };
}

async function publish(
  runs: RunReport[],
  context: OverviewContext,
  annotations: readonly ToolAnnotation[],
  formatting: readonly FormatFinding[],
  patch: PatchNote | undefined,
): Promise<void> {
  const summaries = runs.map(({ summary }) => summary);
  const allReports = runs.flatMap(({ reports }) => reports);
  const line = sessionHeadline(summaries, allReports);

  // A run's own verdict, not `reports.length`: a red run whose tasks all
  // exited 0 still needs the failure section, which is where the "turbo died
  // outside a task" wording lives. `--continue` would give the mirror case.
  const failures = runs.filter(
    ({ summary, reports }) =>
      summary.execution.exitCode !== 0 || reports.length > 0,
  );

  const failed = failures.length > 0;

  // Off Actions nothing parses them, and the note would describe nothing.
  const plan = onActions()
    ? planAnnotations(annotations, { error: failed ? 1 : 0 }, [
        formattingTier(formatting),
      ])
    : undefined;

  if (plan !== undefined) context.annotations = annotationNote(plan);
  // The failure leads on both lanes: a red build opens this step, and the
  // reader came for what broke. The overview follows as context.
  const overview = sessionMarkdown(runs, context);

  const markdown = failed
    ? `${sessionFailureMarkdown(failures)}${formattingMarkdown(formatting, patch)}\n${overview}`
    : overview;

  const file = process.env.GITHUB_STEP_SUMMARY;
  const toFile = file !== undefined && file !== '';

  // The stdout lane, ungrouped: an agent reading `gh run view --log-failed`
  // gets the excerpts inline, and a human scanning the step sees the headline
  // without expanding anything. Grouping is deliberately NOT used — a
  // collapsed group is exactly the problem this step exists to solve.
  const chunks = failed
    ? [
        ...sessionStdoutReport(failures, summaries),
        '',
        ...formattingLines(formatting, patch),
        ...sessionLines(runs, context),
        '',
      ]
    : [...sessionLines(runs, context), ''];

  // The fallback prints the same untrusted excerpts, so it goes inside the guard.
  if (!toFile) chunks.push(`\n${markdown}`);

  for (const chunk of guardCommands(chunks, commandToken())) console.log(chunk);

  // After the guard resumed: our own annotation has to be parsed. The step
  // summary file is markdown, never scanned for commands, so it needs none.
  if (toFile) await appendFile(file, markdown);

  // Rebuilt from validated fields, so these are the only commands a log can
  // cause; on green runs too, where a lint warning is the whole finding.
  for (const command of plan?.commands ?? []) console.log(command);

  // The annotation is the top-of-page pointer; the summary is the detail. Only
  // on a failure: a green run has nothing that warrants an annotation.
  if (onActions() && failed) {
    console.log(errorCommand(line));
  }
}

async function main(): Promise<void> {
  const paths = await sessionFiles(RUNS_DIR);

  if (paths.length === 0) {
    warn(
      `no turbo run summary under ${RUNS_DIR} — the job ended before or outside the turbo run; read the full step log`,
    );

    return;
  }

  // No exitCode gate: the step runs on green runs too, and a red run whose
  // tasks all exited 0 — turbo itself died, or the runner timed out — is a
  // case the failure section reports rather than one to bail on.
  const runs: RunReport[] = [];
  // One map across the session: failing-task logs are looked up by taskId,
  // and no task appears in two runs of one session.
  const logs = new Map<string, string>();
  const annotations: ToolAnnotation[] = [];
  const structured = await readStructuredLogs();

  for (const path of paths) {
    let summary: RunSummary;

    try {
      summary = parseRunSummary(JSON.parse(await readFile(path, 'utf8')));
    } catch (error: unknown) {
      // One unreadable summary must not cost the report the others: a run that
      // turbo killed mid-write is exactly when the rest is worth reading.
      warn(
        `skipping ${basename(path)}: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    const runLogs = await readLogs(summary, structured);

    for (const [taskId, log] of runLogs) logs.set(taskId, log);
    annotations.push(...extractAnnotations(summary, runLogs, process.cwd()));
    annotations.push(...extractTscDiagnostics(summary, runLogs, process.cwd()));
    runs.push({ summary, fileName: basename(path), reports: [] });
  }

  if (runs.length === 0) {
    warn(`no readable turbo run summary under ${RUNS_DIR}`);

    return;
  }

  // Reports built after every log is in hand, so a task's log is available
  // whichever run of the session wrote it.
  for (const run of runs) run.reports = buildReports(run.summary, logs);

  const formatting = runs.flatMap(({ summary }) =>
    extractFormatFindings(summary, logs, process.cwd()),
  );

  diffFormatting(formatting);
  const patch = writePatch(formatting);

  await publish(
    runs,
    {
      onActions: onActions(),
      // Set by the workflow from the upload step's `artifact-url` output; absent
      // locally, where the files this read are already on disk. Every file is
      // named: the artifact holds them all under one URL, and GitHub gives no
      // per-file link to hand out instead.
      artifactUrl: process.env.TURBO_SUMMARY_ARTIFACT_URL,
      fileNames: runs.map((run) => run.fileName ?? ''),
      attachmentsUrl: process.env.VITEST_ATTACHMENTS_ARTIFACT_URL,
      screenshotsUrl: process.env.CYPRESS_SCREENSHOTS_ARTIFACT_URL,
      a11yScreenshotsUrl: process.env.A11Y_SCREENSHOTS_ARTIFACT_URL,
      logsUrl: process.env.TURBO_LOGS_ARTIFACT_URL,
    },
    annotations,
    formatting,
    patch,
  );
}

main().catch((cause: unknown) => {
  warn(
    `run summary failed, the full step log is unaffected: ${
      cause instanceof Error ? cause.message : String(cause)
    }`,
  );
});

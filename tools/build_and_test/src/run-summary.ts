#!/usr/bin/env node
// Reports a `turbo run` on both lanes: `$GITHUB_STEP_SUMMARY` (rendered
// markdown, for humans reading the run page) and stdout (for agents, which
// reach CI through the logs API and never see a step summary).
//
// Two sections. The overview runs every time — cache split, slowest tasks,
// longest dependency chain — because a green run still hides things worth
// knowing. The failure detail is appended only when a task actually failed,
// and is empty rather than absent on a green run: `failedTasks()` returns [].
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
//      the uncapped copy of the capped lists this prints).

import { randomUUID } from 'node:crypto';
import { appendFile, readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { WARN_WATCHED_LANES } from '@tools/warn-lanes/warn-lanes.core.ts';

import {
  type OverviewContext,
  type RunReport,
  type RunSummary,
  buildReports,
  guardCommands,
  parseRunSummary,
  sessionFailureMarkdown,
  sessionHeadline,
  sessionLines,
  sessionMarkdown,
  sessionStdoutReport,
  warnLaneEntries,
} from './run-summary.core.ts';
import { errorCommand, warningCommand } from '@tools/shared/gha.core.ts';
import { onActions } from '@tools/shared/gha.ts';

const RUNS_DIR = process.env.TURBO_RUNS_DIR ?? '.turbo/runs';
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

interface FoundSummary {
  path: string;
  mtimeMs: number;
}

/** Every `*.json` in the runs directory, newest first. */
async function allSummaries(): Promise<FoundSummary[]> {
  let names: string[];
  try {
    names = (await readdir(RUNS_DIR)).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  const found: FoundSummary[] = [];
  for (const name of names) {
    const path = join(RUNS_DIR, name);
    const { mtimeMs } = await stat(path);
    found.push({ path, mtimeMs });
  }
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * The summaries this session wrote, oldest first — `mise run ci` invokes turbo
 * three times (the graph, the docs build, the e2e suites) and every one of them
 * is a run worth seeing.
 *
 * Selected by mtime against the session marker rather than by parsing each
 * file, so a half-written or malformed summary costs its own line and not the
 * report. With no marker this degrades to the newest single run.
 */
async function sessionSummaries(): Promise<string[]> {
  const found = await allSummaries();
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
 * Logs for the tasks the report reads: every failing task, plus every
 * warn-watched lane whatever its exit code — those pass by design, and their
 * state lives only in the log they printed (which turbo replays on a cache hit).
 */
async function readLogs(summary: RunSummary): Promise<Map<string, string>> {
  const logs = new Map<string, string>();
  for (const task of summary.tasks) {
    const code = task.execution?.exitCode;
    const watched = WARN_WATCHED_LANES.includes(task.taskId);
    if (!watched && (typeof code !== 'number' || code === 0)) continue;
    try {
      logs.set(task.taskId, await readFile(task.logFile, 'utf8'));
    } catch {
      // Left unset: buildReports renders the execution.error instead.
    }
  }
  return logs;
}

async function publish(
  runs: RunReport[],
  context: OverviewContext,
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
  // The overview leads on both lanes: the counts are the context for whichever
  // task broke, and on a green run they are the whole report.
  const overview = sessionMarkdown(summaries, context);
  const markdown = failed
    ? `${overview}\n${sessionFailureMarkdown(failures)}`
    : overview;
  const file = process.env.GITHUB_STEP_SUMMARY;
  const toFile = file !== undefined && file !== '';

  // The stdout lane, ungrouped: an agent reading `gh run view --log-failed`
  // gets the excerpts inline, and a human scanning the step sees the headline
  // without expanding anything. Grouping is deliberately NOT used — a
  // collapsed group is exactly the problem this step exists to solve.
  const chunks = [...sessionLines(summaries, context), ''];
  if (failed) chunks.push(...sessionStdoutReport(failures, summaries));
  // The fallback prints the same untrusted excerpts, so it goes inside the guard.
  if (!toFile) chunks.push(`\n${markdown}`);
  for (const chunk of guardCommands(chunks, commandToken())) console.log(chunk);

  // After the guard resumed: our own annotation has to be parsed. The step
  // summary file is markdown, never scanned for commands, so it needs none.
  if (toFile) await appendFile(file, markdown);

  // The annotation is the top-of-page pointer; the summary is the detail. Only
  // on a failure: a green run has nothing that warrants an annotation.
  if (onActions() && failed) {
    console.log(errorCommand(line));
  }
}

async function main(): Promise<void> {
  const paths = await sessionSummaries();
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
  // One map across the session: warn-lane state and failing-task logs are
  // looked up by taskId, and no task appears in two runs of one session.
  const logs = new Map<string, string>();
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
    for (const [taskId, log] of await readLogs(summary)) logs.set(taskId, log);
    runs.push({ summary, reports: [] });
  }
  if (runs.length === 0) {
    warn(`no readable turbo run summary under ${RUNS_DIR}`);
    return;
  }
  // Reports built after every log is in hand, so a task's log is available
  // whichever run of the session wrote it.
  for (const run of runs) run.reports = buildReports(run.summary, logs);

  await publish(runs, {
    onActions: onActions(),
    warnLanes: warnLaneEntries(logs),
    // Set by the workflow from the upload step's `artifact-url` output; absent
    // locally, where the files this read are already on disk. Named only when
    // the session is one run — the artifact holds every summary either way.
    artifactUrl: process.env.TURBO_SUMMARY_ARTIFACT_URL,
    fileName: paths.length === 1 ? basename(paths[0] ?? '') : undefined,
  });
}

main().catch((error: unknown) => {
  warn(
    `run summary failed, the full step log is unaffected: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
});

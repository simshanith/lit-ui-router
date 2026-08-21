#!/usr/bin/env node
// Republishes the failing tasks of a red `turbo run` as a focused report, on
// both lanes: `$GITHUB_STEP_SUMMARY` (rendered markdown, for humans reading the
// run page) and stdout (for agents, which reach CI through the logs API and
// never see a step summary).
//
// Input is the newest `.turbo/runs/*.json`, written by `--summarize` on the
// `ci` / `ci_main` mise tasks. See error-summary.core.ts for why the summary,
// not the stream, is the input.
//
// Fails open, always. It runs only when the job is already red; a second red
// step here would be noise pointing at the reporter instead of the failure,
// and an exception must never mask the real one. Every failure path warns and
// exits 0.
//
// env: GITHUB_STEP_SUMMARY (runner file; printed when unset),
//      TURBO_RUNS_DIR (override for tests and local reproduction).

import { randomUUID } from 'node:crypto';
import { appendFile, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { WARN_WATCHED_LANES } from '@tools/shared/warn-lanes.core.ts';

import {
  type FailureReport,
  type RunSummary,
  type WarnLaneEntry,
  buildReports,
  guardCommands,
  headline,
  parseRunSummary,
  stdoutReport,
  summaryMarkdown,
  warnLaneEntries,
} from './error-summary.core.ts';

const RUNS_DIR = process.env.TURBO_RUNS_DIR ?? '.turbo/runs';

function onActions(): boolean {
  return process.env.GITHUB_ACTIONS === 'true';
}

/** Fresh per run: a log that could guess the token could escape the guard. */
function commandToken(): string | undefined {
  return onActions() ? randomUUID() : undefined;
}

function warn(message: string): void {
  console.log(
    onActions() ? `::warning::${message.replaceAll('\n', '%0A')}` : message,
  );
}

/**
 * Newest summary by mtime. `--summarize` takes only true|false — no path — so
 * recency is the only handle. In CI the job writes exactly one, but a local
 * runs directory accumulates, hence the explicit exitCode check downstream
 * rather than trusting recency to mean "the red one".
 */
async function newestSummary(): Promise<string | undefined> {
  let names: string[];
  try {
    names = (await readdir(RUNS_DIR)).filter((name) => name.endsWith('.json'));
  } catch {
    return undefined;
  }
  let newest: { path: string; mtimeMs: number } | undefined;
  for (const name of names) {
    const path = join(RUNS_DIR, name);
    const { mtimeMs } = await stat(path);
    if (newest === undefined || mtimeMs > newest.mtimeMs) {
      newest = { path, mtimeMs };
    }
  }
  return newest?.path;
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
  summary: RunSummary,
  reports: FailureReport[],
  warnLanes: WarnLaneEntry[],
): Promise<void> {
  const line = headline(summary, reports);
  const markdown = summaryMarkdown(summary, reports, warnLanes);
  const file = process.env.GITHUB_STEP_SUMMARY;
  const toFile = file !== undefined && file !== '';

  // The stdout lane, ungrouped: an agent reading `gh run view --log-failed`
  // gets the excerpts inline, and a human scanning the step sees the headline
  // without expanding anything. Grouping is deliberately NOT used — a
  // collapsed group is exactly the problem this step exists to solve.
  const chunks = stdoutReport(summary, reports, warnLanes);
  // The fallback prints the same untrusted excerpts, so it goes inside the guard.
  if (!toFile) chunks.push(`\n${markdown}`);
  for (const chunk of guardCommands(chunks, commandToken())) console.log(chunk);

  // After the guard resumed: our own annotation has to be parsed. The step
  // summary file is markdown, never scanned for commands, so it needs none.
  if (toFile) await appendFile(file, markdown);

  // The annotation is the top-of-page pointer; the summary is the detail.
  if (onActions() && reports.length > 0) {
    console.log(`::error::${line.replaceAll('\n', '%0A')}`);
  }
}

async function main(): Promise<void> {
  const path = await newestSummary();
  if (path === undefined) {
    warn(
      `no turbo run summary under ${RUNS_DIR} — the job failed before or outside the turbo run; read the full step log`,
    );
    return;
  }

  const summary = parseRunSummary(JSON.parse(await readFile(path, 'utf8')));
  if (summary.execution.exitCode === 0) {
    warn(
      `newest turbo run summary (${path}) exited 0 — nothing to report; the failure is outside the turbo run`,
    );
    return;
  }

  const logs = await readLogs(summary);
  const reports = buildReports(summary, logs);
  await publish(summary, reports, warnLaneEntries(logs));
}

main().catch((error: unknown) => {
  warn(
    `error summary failed, the full step log is unaffected: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
});

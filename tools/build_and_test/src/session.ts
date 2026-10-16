// Reads the turbo runs one CI session wrote, and every task log they point at,
// for run-summary.ts and format-patch.ts. Fails open like both: an unreadable
// file warns and is skipped.
//
// env: TURBO_RUNS_DIR (override for tests and local reproduction),
//      TURBO_SUMMARY_SESSION (the session marker; same override reasons).

import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

import {
  type RunSummary,
  type StructuredLogEntry,
  logFilePath,
  parseRunSummary,
  structuredTaskLog,
} from './run-summary.core.ts';
import { warningCommand } from '@tools/shared/gha.core.ts';
import { onActions } from '@tools/shared/gha.ts';

const RUNS_DIR = process.env.TURBO_RUNS_DIR ?? '.turbo/runs';

/** Where `turbo --log-file` writes by default: the fallback when a task's own log can't be read. */
const LOGS_DIR = '.turbo/logs';

const SESSION_FILE =
  process.env.TURBO_SUMMARY_SESSION ?? '.turbo/summary-session';

/** A warning annotation on Actions; stdout either way, the lane agents read. */
export function warn(message: string): void {
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
    const path = logFilePath(task);

    const own =
      path === undefined
        ? undefined
        : await readFile(path, 'utf8').catch(() => undefined);

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

export interface SessionRun {
  summary: RunSummary;
  fileName: string;
  /** This run's task logs, by taskId. */
  logs: Map<string, string>;
}

export interface Session {
  runs: SessionRun[];
  /** Every run's task logs in one map: no task appears in two runs of one session. */
  logs: Map<string, string>;
}

/** This session's readable runs, oldest first; undefined, after a warning, when there are none. */
export async function readSession(): Promise<Session | undefined> {
  const paths = await sessionFiles(RUNS_DIR);

  if (paths.length === 0) {
    warn(
      `no turbo run summary under ${RUNS_DIR} — the job ended before or outside the turbo run; read the full step log`,
    );

    return undefined;
  }

  const runs: SessionRun[] = [];
  const logs = new Map<string, string>();
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
    runs.push({ summary, fileName: basename(path), logs: runLogs });
  }

  if (runs.length === 0) {
    warn(`no readable turbo run summary under ${RUNS_DIR}`);

    return undefined;
  }

  return { runs, logs };
}

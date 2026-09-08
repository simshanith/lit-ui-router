// Pure logic for check-task-inputs.ts, which owns the IO.

import path from 'node:path';

import { splitTaskId } from './turbo.ts';

/** Only what the audit reads of a planned task; see turbo.ts `PlannedTask`. */
export type AuditableTask = {
  taskId: string;
  directory: string;
  command: string;
  cache: boolean;
  inputs: Record<string, string>;
};

/** A task name whose inputs are narrow on purpose, keyed by name so every package's copy is covered. */
export type InputsExemption = {
  task: string;
  /** Why the narrow key is the read-set. */
  why: string;
};

/** A generated path some task hashes on purpose, keyed by repo-relative path. */
export type InputsAllowance = {
  /** Repo-relative file, or directory covering everything beneath it. */
  path: string;
  /** Why hashing this untracked file is the honest key. */
  why: string;
};

export type InputsFailure = { taskId: string; missing: string[] };

export type InputsOverhash = { taskId: string; untracked: string[] };

export type InputsAudit = {
  failures: InputsFailure[];
  /** Tasks whose key hashes files git does not track. */
  overhashing: InputsOverhash[];
  /** Exempt names that no longer have any gap — the exemption outlived its reason. */
  stale: string[];
  /** Tasks actually audited (cacheable, with a command). */
  audited: number;
};

/** Repo-relative tracked paths rewritten package-relative, as turbo reports inputs. */
export function packageFiles(
  tracked: readonly string[],
  directory: string,
): string[] {
  if (directory === '' || directory === '.') return [...tracked];
  const prefix = `${directory.replace(/\/$/, '')}/`;
  return tracked
    .filter((file) => file.startsWith(prefix))
    .map((file) => file.slice(prefix.length));
}

/**
 * A task input rewritten repo-relative. turbo reports inputs package-relative,
 * so a `$TURBO_ROOT$` glob comes back as `../../<path>`.
 */
export function inputPath(directory: string, input: string): string {
  return path.posix.normalize(path.posix.join(directory || '.', input));
}

/** Tracked files in the task's package that its cache key does not hash. */
export function unhashedFiles(
  task: AuditableTask,
  tracked: readonly string[],
): string[] {
  const hashed = new Set(Object.keys(task.inputs));
  return packageFiles(tracked, task.directory)
    .filter((file) => !hashed.has(file))
    .sort();
}

/**
 * Files the task's cache key hashes that git does not track — build output,
 * coverage, installed dependencies. Neither an explicit glob nor a
 * `$TURBO_ROOT$` one is gitignore-pruned (only `$TURBO_DEFAULT$` is), so a
 * `**` walk picks up whatever happens to be on disk and the key churns on
 * every unrelated build.
 *
 * Untracked is the cheap half of the question: a file the author has written
 * but not yet added is untracked too, and failing on that would break the lane
 * for anyone mid-edit. `narrowToGenerated` settles the other half.
 */
export function untrackedInputs(
  task: AuditableTask,
  tracked: ReadonlySet<string>,
  allowed: readonly InputsAllowance[] = [],
): string[] {
  return Object.keys(task.inputs)
    .map((input) => inputPath(task.directory, input))
    .filter(
      (file) =>
        !tracked.has(file) &&
        !allowed.some(
          ({ path: entry }) => file === entry || file.startsWith(`${entry}/`),
        ),
    )
    .sort();
}

/** A task turbo will not hash-and-skip has no stale-cache failure mode. */
function audits(task: AuditableTask): boolean {
  return task.cache && task.command !== '' && task.command !== '<NONEXISTENT>';
}

export function auditTaskInputs(
  tasks: readonly AuditableTask[],
  tracked: readonly string[],
  exemptions: readonly InputsExemption[],
  allowances: readonly InputsAllowance[] = [],
): InputsAudit {
  const exempt = new Set(exemptions.map(({ task }) => task));
  const used = new Set<string>();
  const trackedSet = new Set(tracked);
  const failures: InputsFailure[] = [];
  const overhashing: InputsOverhash[] = [];
  let audited = 0;

  for (const task of tasks) {
    if (!audits(task)) continue;
    audited += 1;

    const untracked = untrackedInputs(task, trackedSet, allowances);
    if (untracked.length > 0) {
      overhashing.push({ taskId: task.taskId, untracked });
    }

    const missing = unhashedFiles(task, tracked);
    if (missing.length === 0) continue;
    const [, name] = splitTaskId(task.taskId);
    if (exempt.has(name)) {
      used.add(name);
      continue;
    }
    failures.push({ taskId: task.taskId, missing });
  }

  failures.sort((a, b) => a.taskId.localeCompare(b.taskId));
  overhashing.sort((a, b) => a.taskId.localeCompare(b.taskId));
  return {
    failures,
    overhashing,
    stale: exemptions
      .map(({ task }) => task)
      .filter((name) => !used.has(name))
      .sort(),
    audited,
  };
}

/** Error text naming the files the cache key misses. */
export function formatFailure({ taskId, missing }: InputsFailure): string {
  const shown = missing.slice(0, 5).join(', ');
  const rest = missing.length > 5 ? `, +${missing.length - 5} more` : '';
  return `${taskId} does not hash ${missing.length} tracked file(s) in its package: ${shown}${rest} — lead its "inputs" with "$TURBO_DEFAULT$"`;
}

/**
 * Over-hash reports cut down to files the repo actually ignores. An untracked
 * file that is *not* ignored is either the author's work in progress — never a
 * failure — or a generated tree missing from the ignore rules, which is a bug
 * in those rules rather than in the cache key.
 */
export function narrowToGenerated(
  overhashing: readonly InputsOverhash[],
  ignored: ReadonlySet<string>,
): InputsOverhash[] {
  return overhashing
    .map(({ taskId, untracked }) => ({
      taskId,
      untracked: untracked.filter((file) => ignored.has(file)),
    }))
    .filter(({ untracked }) => untracked.length > 0);
}

/** Error text naming the generated files the cache key should not hash. */
export function formatOverhash({ taskId, untracked }: InputsOverhash): string {
  const shown = untracked.slice(0, 5).join(', ');
  const rest = untracked.length > 5 ? `, +${untracked.length - 5} more` : '';
  return `${taskId} hashes ${untracked.length} untracked file(s): ${shown}${rest} — negate the generated tree in its "inputs" (only "$TURBO_DEFAULT$" is gitignore-pruned)`;
}

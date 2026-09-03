// Pure logic for the inputs-must-over-approximate guard. A turbo task's
// `inputs` is a cache key, so it has to be a superset of everything the task
// reads; an enumerated list always drifts behind the files (a setup file, a
// suite outside src/) and the failure mode is `cache hit` + `exit 0` on a tree
// the task would have rejected. The invariant checked here: every tracked file
// in a task's package is hashed by that task, unless the task is exempt
// because its read-set genuinely is one file type. The IO (git ls-files, the
// turbo dry runs) lives in check-task-inputs.ts.

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
  /** Why the narrow key is the read-set, in the words the next maintainer needs. */
  why: string;
};

export type InputsFailure = { taskId: string; missing: string[] };

export type InputsAudit = {
  failures: InputsFailure[];
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

/** A task turbo will not hash-and-skip has no stale-cache failure mode. */
function audits(task: AuditableTask): boolean {
  return task.cache && task.command !== '' && task.command !== '<NONEXISTENT>';
}

export function auditTaskInputs(
  tasks: readonly AuditableTask[],
  tracked: readonly string[],
  exemptions: readonly InputsExemption[],
): InputsAudit {
  const exempt = new Set(exemptions.map(({ task }) => task));
  const used = new Set<string>();
  const failures: InputsFailure[] = [];
  let audited = 0;

  for (const task of tasks) {
    if (!audits(task)) continue;
    audited += 1;
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
  return {
    failures,
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

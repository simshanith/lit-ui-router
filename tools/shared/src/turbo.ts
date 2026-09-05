// Ask turbo for a task's resolved dependencies via `--dry-run=json`. The graph
// guards assert against what turbo will actually run, so package-qualified
// edges in any turbo.json count without anyone parsing JSONC or manifests.

import { defaultExec, type Exec } from './exec.ts';

type DryRun = { tasks?: { taskId?: string; dependencies?: string[] }[] };

/** One entry of `--dry-run=json`'s `tasks`, as the input guard reads it. */
export type PlannedTask = {
  taskId: string;
  /** Package directory, repo-relative; `""` for root (`//`) tasks. */
  directory: string;
  command: string;
  /** From `resolvedTaskDefinition.cache`; the entry's own `cache` is this run's status object. */
  cache: boolean;
  /** Resolved input files (package-relative) turbo hashes, file -> hash. */
  inputs: Record<string, string>;
};

type DryRunTasks = {
  tasks?: (Omit<Partial<PlannedTask>, 'cache'> & {
    resolvedTaskDefinition?: { cache?: boolean };
  })[];
};

/** `['<pkg>', '<task>']` from a turbo task id like `lit-ui-router.dev#build` or `//#lint`. */
export function splitTaskId(taskId: string): [string, string] {
  const at = taskId.lastIndexOf('#');
  if (at <= 0 || at === taskId.length - 1) {
    throw new Error(`not a turbo task id: ${taskId}`);
  }
  return [taskId.slice(0, at), taskId.slice(at + 1)];
}

/** Resolved `dependencies` of `taskId` per `turbo run --dry-run=json`. */
export async function resolvedTaskDeps(
  taskId: string,
  exec: Exec = defaultExec,
): Promise<string[]> {
  const [pkg, task] = splitTaskId(taskId);
  const { stdout } = await exec('turbo', [
    'run',
    task,
    `--filter=${pkg}`,
    '--dry-run=json',
  ]);
  const plan = JSON.parse(stdout) as DryRun;
  const entry = plan.tasks?.find((t) => t.taskId === taskId);
  if (!entry) throw new Error(`turbo dry-run has no task ${taskId}`);
  return entry.dependencies ?? [];
}

/** A script name with no turbo task declared for it — skip, don't fail. */
function isUndeclared(name: string, error: unknown): boolean {
  const stderr =
    typeof error === 'object' && error !== null && 'stderr' in error
      ? String(error.stderr)
      : '';
  // turbo wraps the message across lines at terminal width
  return stderr
    .replaceAll(/\s+/g, ' ')
    .includes(`Could not find task \`${name}\``);
}

/**
 * Every task turbo plans for `names`, keyed by task id. One `--only` dry run
 * per name: a name with no turbo task is skipped, every other failure throws,
 * so a broken config can never read as an empty plan.
 */
export async function plannedTasks(
  names: readonly string[],
  exec: Exec = defaultExec,
  concurrency = 4,
): Promise<Map<string, PlannedTask>> {
  const planned = new Map<string, PlannedTask>();
  const queue = [...names];
  const worker = async () => {
    for (let name = queue.shift(); name; name = queue.shift()) {
      let stdout: string;
      try {
        ({ stdout } = await exec('turbo', [
          'run',
          name,
          '--only',
          '--dry-run=json',
        ]));
      } catch (error) {
        if (isUndeclared(name, error)) continue;
        throw error;
      }
      for (const task of (JSON.parse(stdout) as DryRunTasks).tasks ?? []) {
        if (task.taskId === undefined) continue;
        planned.set(task.taskId, {
          taskId: task.taskId,
          directory: task.directory ?? '',
          command: task.command ?? '',
          cache: task.resolvedTaskDefinition?.cache ?? true,
          inputs: task.inputs ?? {},
        });
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker()),
  );
  return planned;
}

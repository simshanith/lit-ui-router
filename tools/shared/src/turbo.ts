// Ask turbo for a task's resolved dependencies via `--dry-run=json`. The graph
// guards assert against what turbo will actually run, so package-qualified
// edges in any turbo.json count without anyone parsing JSONC or manifests.

import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';

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

/** `['<pkg>', '<task>']` from a turbo task id like `docs#build` or `//#lint`. */
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
 * Task names declared across `configs` (raw turbo.json text), unqualified:
 * `docs#build` and `build` both count as `build`. turbo has no CLI that lists
 * declared tasks — `turbo query` and `turbo ls` report package *scripts*, which
 * differs in both directions (scripts with no task, aggregator tasks with no
 * script), so the configs are the only source.
 */
export function declaredLanes(configs: readonly string[]): Set<string> {
  const lanes = new Set<string>();
  for (const text of configs) {
    const errors: ParseError[] = [];
    // turbo.json carries comments, so JSON.parse alone won't do
    const config = parse(text, errors, { allowTrailingComma: true }) as {
      tasks?: Record<string, unknown>;
    } | null;
    const [first] = errors;
    if (first) {
      throw new Error(
        `invalid turbo.json at offset ${first.offset}: ${printParseErrorCode(first.error)}`,
      );
    }
    for (const id of Object.keys(config?.tasks ?? {})) {
      lanes.add(id.slice(id.lastIndexOf('#') + 1));
    }
  }
  return lanes;
}

/** Unqualified task names turbo plans when it runs `lanes`. */
export async function plannedLanes(
  lanes: readonly string[],
  exec: Exec = defaultExec,
): Promise<Set<string>> {
  const { stdout } = await exec('turbo', ['run', ...lanes, '--dry-run=json']);
  const plan = JSON.parse(stdout) as DryRun;
  return new Set(
    (plan.tasks ?? [])
      .map((task) => task.taskId)
      .filter((id) => id !== undefined)
      .map((id) => splitTaskId(id)[1]),
  );
}

/**
 * turbo's complaint about planning `lanes`, or `undefined` when it plans. The
 * dry run deliberately omits `--only`: that flag strips the dependency edges,
 * and an invalid edge — `dependsOn` onto a persistent task — is exactly what
 * hides behind it. turbo validates only the subgraph the run names, so a lane
 * has to be named here to be checked at all.
 */
export async function planFailure(
  lanes: readonly string[],
  exec: Exec = defaultExec,
): Promise<string | undefined> {
  try {
    await exec('turbo', ['run', ...lanes, '--dry-run=json']);
    return undefined;
  } catch (error) {
    return typeof error === 'object' && error !== null && 'stderr' in error
      ? String(error.stderr)
      : String(error);
  }
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

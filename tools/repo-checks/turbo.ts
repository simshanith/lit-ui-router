// Ask turbo for a task's resolved dependencies via `--dry-run=json`. The graph
// guards assert against what turbo will actually run, so package-qualified
// edges in any turbo.json count without anyone parsing JSONC or manifests.

import { stripVTControlCharacters } from 'node:util';

import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';

import { defaultCapture, type Exec } from '@tools/shared/exec.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';

// turbo scopes a run to the package it is invoked from, so every dry run here
// is anchored at the root: these guards ask about the whole graph, and a caller
// that happens to live in a package must not silently narrow the answer.
// Remote-off, as in turbo_backfill: a dry run otherwise looks up every planned
// task in the remote cache, and these guards read only the plan.
const AT_ROOT = {
  cwd: workspaceRoot,
  env: { ...process.env, TURBO_CACHE: 'local:r', TURBO_TOKEN: '' },
};

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

/** `['<pkg>', '<task>']` from a turbo task id like `@www/lit-ui-router.dev#build` or `//#lint`. */
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
  exec: Exec = defaultCapture,
): Promise<string[]> {
  const [pkg, task] = splitTaskId(taskId);
  const { stdout } = await exec(
    'turbo',
    ['run', task, `--filter=${pkg}`, '--dry-run=json'],
    AT_ROOT,
  );
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
  // turbo colors the message and wraps it at terminal width, inside a long
  // task name too, behind a `│` gutter; task names carry no whitespace
  const flat = (text: string) =>
    stripVTControlCharacters(text).replaceAll(/│|\s+/g, '');
  return flat(stderr).includes(flat(`Could not find task \`${name}\``));
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
    for (const id of Object.keys(parseTasks(text))) {
      lanes.add(id.slice(id.lastIndexOf('#') + 1));
    }
  }
  return lanes;
}

type TaskConfig = { with?: unknown; persistent?: unknown };

function parseTasks(text: string): Record<string, TaskConfig> {
  const errors: ParseError[] = [];
  // turbo.json carries comments, so JSON.parse alone won't do
  const config = parse(text, errors, { allowTrailingComma: true }) as {
    tasks?: Record<string, TaskConfig>;
  } | null;
  const [first] = errors;
  if (first) {
    throw new Error(
      `invalid turbo.json at offset ${first.offset}: ${printParseErrorCode(first.error)}`,
    );
  }
  return config?.tasks ?? {};
}

/**
 * `<path>: <task>` for every task that declares `with` but is not persistent.
 * turbo 2.11.3+ stops a `with` sidecar the moment its parent exits and does
 * not count that as a failure, so a finite parent silently cuts its sidecars
 * short. A package task inherits `persistent` from the root (`turbo.json`)
 * task of the same name.
 */
export function nonPersistentWith(
  configs: readonly { path: string; text: string }[],
): string[] {
  const parsed = configs.map(({ path, text }) => ({
    path,
    tasks: parseTasks(text),
  }));
  const root = parsed.find(({ path }) => path === 'turbo.json')?.tasks ?? {};
  const found: string[] = [];
  for (const { path, tasks } of parsed) {
    for (const [id, task] of Object.entries(tasks)) {
      if (task.with === undefined || task.with === null) continue;
      if ((task.persistent ?? root[id]?.persistent) !== true) {
        found.push(`${path}: ${id}`);
      }
    }
  }
  return found.sort();
}

/** Unqualified task names turbo plans when it runs `lanes`. */
export async function plannedLanes(
  lanes: readonly string[],
  exec: Exec = defaultCapture,
): Promise<Set<string>> {
  const { stdout } = await exec(
    'turbo',
    ['run', ...lanes, '--dry-run=json'],
    AT_ROOT,
  );
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
  exec: Exec = defaultCapture,
): Promise<string | undefined> {
  try {
    await exec('turbo', ['run', ...lanes, '--dry-run=json'], AT_ROOT);
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
  exec: Exec = defaultCapture,
  concurrency = 4,
): Promise<Map<string, PlannedTask>> {
  const planned = new Map<string, PlannedTask>();
  const queue = [...names];
  const worker = async () => {
    for (let name = queue.shift(); name; name = queue.shift()) {
      let stdout: string;
      try {
        ({ stdout } = await exec(
          'turbo',
          ['run', name, '--only', '--dry-run=json'],
          AT_ROOT,
        ));
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

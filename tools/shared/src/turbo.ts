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

// turbo colours its diagnostics even into a pipe; built rather than written as
// a literal so no escape byte sits in the source
const SGR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/** A failed run's stderr, or `''` for an error that carries none. */
function stderrOf(error: unknown): string {
  return typeof error === 'object' && error !== null && 'stderr' in error
    ? String(error.stderr)
    : '';
}

/**
 * One line of turbo diagnostics. It wraps at terminal width and gutters the
 * continuation with a vertical bar, so a message — or a task name inside one —
 * arrives split by a run of whitespace and box drawing. Both glyphs count: CI
 * gets the ASCII fallback (`|`), a UTF-8 terminal the box character (`│`).
 * Colour survives the pipe, so the escapes come off too.
 */
function flatten(stderr: string): string {
  return stderr
    .replaceAll(SGR, '')
    .replaceAll(/[│|]/g, '')
    .replaceAll(/\s+/g, ' ');
}

/**
 * A script name with no turbo task declared for it — skip, don't fail. Every
 * space goes before matching: the wrap can land inside the name itself, and a
 * task name has none to lose.
 */
function isUndeclared(name: string, error: unknown): boolean {
  const squashed = flatten(stderrOf(error)).replaceAll(' ', '');
  return squashed.includes(`Couldnotfindtask\`${name}\``);
}

/**
 * The names turbo has a task for. `--only` strips the dependency edges, so a
 * lane planned that way can fail exactly one way — no task by that name — and
 * the exit code alone classifies it. Nothing here reads turbo's prose, which
 * it writes for people: wrapped, guttered, and ASCII on CI but box drawing on
 * a UTF-8 terminal.
 */
async function declaredLanes(
  names: readonly string[],
  exec: Exec,
  concurrency = 8,
): Promise<string[]> {
  const queue = [...names];
  const declared = new Set<string>();
  const worker = async () => {
    for (let name = queue.shift(); name; name = queue.shift()) {
      try {
        await exec('turbo', ['run', name, '--only', '--dry-run=json']);
        declared.add(name);
      } catch {
        // --only cannot fail for any other reason, so this is an undeclared
        // script name: skip it rather than failing the guard
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker()),
  );
  return names.filter((name) => declared.has(name));
}

/**
 * Plans every declared lane in one dry run, so turbo validates the graph it
 * would actually build. That run deliberately omits `--only`: the flag strips
 * the dependency edges, which is what let an invalid one — `dependsOn` onto a
 * persistent task — sit unnoticed in the `e2e` lane (#695).
 */
export async function planLanes(
  names: readonly string[],
  exec: Exec = defaultExec,
): Promise<{ planned: string[]; failure?: string }> {
  const planned = await declaredLanes(names, exec);
  // nothing to validate, and the caller fails closed on an empty plan
  if (planned.length === 0) return { planned };
  try {
    await exec('turbo', ['run', ...planned, '--dry-run=json']);
    return { planned };
  } catch (error) {
    return { planned: [], failure: stderrOf(error) || String(error) };
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

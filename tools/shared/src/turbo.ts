// Ask turbo for a task's resolved dependencies via `--dry-run=json`. The graph
// guards assert against what turbo will actually run, so package-qualified
// edges in any turbo.json count without anyone parsing JSONC or manifests.

import { defaultExec, type Exec } from './exec.ts';

type DryRun = { tasks?: { taskId?: string; dependencies?: string[] }[] };

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

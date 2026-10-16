import path from 'node:path';

import * as v from 'valibot';

export const TASK_LOGS = 'turbo-task-logs';

export const RUN_SUMMARIES = 'turbo-run-summaries';

/** The group the unsuffixed artifacts belong to: the `run` job's. */
export const RUN_GROUP: number = 'run';

export const RunInfoSchema = v.object({
  databaseId: v.number(),
  workflowName: v.string(),
  displayTitle: v.string(),
  event: v.string(),
  headBranch: v.string(),
  headSha: v.string(),
  conclusion: v.string(),
  url: v.string(),
});

export type RunInfo = v.InferOutput<typeof RunInfoSchema>;

export const ArtifactSchema = v.object({
  name: v.string(),
  expired: v.boolean(),
});

export type Artifact = v.InferOutput<typeof ArtifactSchema>;

/** Where turbo writes a task's log, repo-relative; `:` is not portable in a filename. */
export const turboLogFile = (directory: string, task: string): string =>
  path.posix.join(
    directory,
    '.turbo',
    `turbo-${task.replaceAll(':', '$colon$')}.log`,
  );

export const SummarySchema = v.object({
  tasks: v.array(
    v.pipe(
      v.object({
        taskId: v.string(),
        task: v.string(),
        directory: v.string(),
        // absent for `cache: false` tasks, whose log turbo still writes
        logFile: v.optional(v.string()),
        cache: v.object({ status: v.picklist(['HIT', 'MISS']) }),
      }),
      v.transform(({ taskId, task, directory, logFile, cache }) => ({
        taskId,
        logFile: logFile ?? turboLogFile(directory, task),
        cache,
      })),
    ),
  ),
});

export type Summary = v.InferOutput<typeof SummarySchema>;

export interface Task {
  group: string;
  taskId: string;
  /** Repo-relative: `<dir>/.turbo/turbo-<task>.log`. */
  logFile: string;
  executed: boolean;
}

export type ArtifactKind = typeof TASK_LOGS | typeof RUN_SUMMARIES;

/** Kind and group of a task-log or run-summary artifact; undefined for any other artifact. */
export function parseArtifactName(
  name: string,
): { kind: ArtifactKind; group: string } | undefined {
  for (const kind of [TASK_LOGS, RUN_SUMMARIES] as const) {
    if (name === kind) return { kind, group: RUN_GROUP };

    if (name.startsWith(`${kind}-`)) {
      return { kind, group: name.slice(kind.length + 1) };
    }
  }

  return undefined;
}

export const artifactName = (kind: ArtifactKind, group: string): string =>
  group === RUN_GROUP ? kind : `${kind}-${group}`;

export interface ArtifactPlan {
  download: string[];
  expired: string[];
}

/** The task-log and run-summary artifacts to fetch, and those already gone. */
export function planArtifacts(artifacts: readonly Artifact[]): ArtifactPlan {
  const plan: ArtifactPlan = { download: [], expired: [] };

  for (const { name, expired } of artifacts) {
    if (parseArtifactName(name) === undefined) continue;

    (expired ? plan.expired : plan.download).push(name);
  }

  return plan;
}

export const taskKey = (group: string, taskId: string): string =>
  `${group} ${taskId}`;

/**
 * One entry per group and task. A job that runs turbo twice lists shared
 * tasks in both summaries; the task executed if either run missed the cache.
 */
export function mergeTasks(
  summaries: readonly { group: string; summary: Summary }[],
): Map<string, Task> {
  const tasks = new Map<string, Task>();

  for (const { group, summary } of summaries) {
    for (const { taskId, logFile, cache } of summary.tasks) {
      const key = taskKey(group, taskId);

      const executed =
        cache.status === 'MISS' || (tasks.get(key)?.executed ?? false);

      tasks.set(key, { group, taskId, logFile, executed });
    }
  }

  return tasks;
}

const groupRank = (group: string): string => (group === RUN_GROUP ? '' : group);

/** The `run` group first, then the rest by name; tasks by id within a group. */
export const compareTasks = (a: Task, b: Task): number =>
  groupRank(a.group).localeCompare(groupRank(b.group)) ||
  a.taskId.localeCompare(b.taskId);

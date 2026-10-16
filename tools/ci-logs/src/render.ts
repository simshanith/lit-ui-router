import { stripVTControlCharacters } from 'node:util';

import {
  artifactName,
  compareTasks,
  TASK_LOGS,
  taskKey,
  type RunInfo,
  type Task,
} from './summary.ts';

export interface RunSource {
  info: RunInfo;
  tasks: ReadonlyMap<string, Task>;
  /** Artifacts fetched, by name. */
  downloaded: readonly string[];
  /** Artifacts GitHub has already deleted, by name. */
  expired: readonly string[];
  /** Raw log text, or undefined when the artifact holds no such file. */
  readLog: (group: string, logFile: string) => string | undefined;
}

type LogResult = { text: string } | { note: string };

export function logOf(source: RunSource, task: Task): LogResult {
  const logs = artifactName(TASK_LOGS, task.group);

  if (!source.downloaded.includes(logs)) {
    return {
      note: source.expired.includes(logs)
        ? `${logs} expired`
        : `no ${logs} artifact`,
    };
  }

  const text = source.readLog(task.group, task.logFile);

  return text === undefined
    ? { note: `${task.logFile} absent from ${logs}` }
    : { text };
}

export const cleanLog = (text: string): string =>
  stripVTControlCharacters(text).replaceAll('\r\n', '\n').replace(/\n+$/, '');

export const countLines = (text: string): number =>
  text === '' ? 0 : text.replace(/\n$/, '').split('\n').length;

const runHeader = (label: string, info: RunInfo): string[] => [
  `${label}: run ${info.databaseId} ${info.url}`,
  `  workflow: ${info.workflowName} (${info.event})`,
  `  title: ${info.displayTitle}`,
  `  branch: ${info.headBranch} @ ${info.headSha}`,
  `  conclusion: ${info.conclusion}`,
];

const artifactLine = (source: RunSource): string =>
  `  artifacts: ${source.downloaded.length} downloaded; expired: ${
    source.expired.length > 0 ? source.expired.join(', ') : 'none'
  }`;

const logBlock = (result: LogResult): string[] =>
  'text' in result ? [cleanLog(result.text)] : [`(${result.note})`];

function baselineBlock(task: Task, baseline: RunSource): string[] {
  const run = `run ${baseline.info.databaseId}`;
  const there = baseline.tasks.get(taskKey(task.group, task.taskId));

  if (there === undefined) {
    return ['', `### baseline ${run}: absent from its run summaries`];
  }

  const how = there.executed
    ? 'executed there'
    : 'replayed there; describes the run that filled the cache';

  return [
    '',
    `### baseline ${run} ${task.group} ${task.taskId} (${how})`,
    ...logBlock(logOf(baseline, there)),
  ];
}

function executedBlock(
  task: Task,
  target: RunSource,
  baseline: RunSource | undefined,
): string[] {
  return [
    '',
    `## ${task.group} ${task.taskId}`,
    ...logBlock(logOf(target, task)),
    ...(baseline === undefined ? [] : baselineBlock(task, baseline)),
  ];
}

const logLines = (source: RunSource, tasks: Iterable<Task>): number => {
  let lines = 0;

  for (const task of tasks) {
    const result = logOf(source, task);

    if ('text' in result) lines += countLines(result.text);
  }

  return lines;
};

const replayedBlock = (task: Task, source: RunSource): string[] => [
  '',
  `## ${task.group} ${task.taskId} (replayed; describes the run that filled the cache)`,
  ...logBlock(logOf(source, task)),
];

function replayLine(task: Task, source: RunSource): string {
  const result = logOf(source, task);
  const name = `${task.group} ${task.taskId}`;

  return 'note' in result ? `${name} (${result.note})` : name;
}

const baselineTasks = (
  executed: readonly Task[],
  baseline: RunSource,
): Task[] =>
  executed.flatMap(
    (task) => baseline.tasks.get(taskKey(task.group, task.taskId)) ?? [],
  );

export interface RenderOptions {
  /** Inline replayed tasks' logs instead of listing them by name. */
  replayed?: boolean;
}

/** The whole report: header, executed logs (each beside its baseline), replays, counts. */
export function render(
  target: RunSource,
  baseline?: RunSource,
  options: RenderOptions = {},
): string {
  const tasks = [...target.tasks.values()].sort(compareTasks);
  const executed = tasks.filter((task) => task.executed);
  const replayed = tasks.filter((task) => !task.executed);

  const body = [
    `# ci-logs`,
    '',
    ...runHeader('target', target.info),
    artifactLine(target),
    ...(baseline === undefined
      ? []
      : [...runHeader('baseline', baseline.info), artifactLine(baseline)]),
    ...(tasks.length === 0
      ? ['', '(no run summaries: nothing tells executed tasks from replays)']
      : []),
    '',
    `# EXECUTED (${executed.length})`,
    ...executed.flatMap((task) => executedBlock(task, target, baseline)),
    '',
    `# REPLAYED (${replayed.length})`,
    ...(options.replayed === true
      ? replayed.flatMap((task) => replayedBlock(task, target))
      : ['', ...replayed.map((task) => replayLine(task, target))]),
  ];

  const counts = (out: number): string[] => [
    '',
    '# COUNTS',
    '',
    `executed: ${executed.length}`,
    `replayed: ${replayed.length}`,
    `task logs missing: ${tasks.filter((task) => 'note' in logOf(target, task)).length}`,
    `log lines in: ${logLines(target, tasks)}`,
    ...(baseline === undefined
      ? []
      : [
          `baseline log lines in: ${logLines(baseline, baselineTasks(executed, baseline))}`,
        ]),
    `lines out: ${out}`,
  ];

  const lines = body.join('\n').split('\n').length + counts(0).length;

  return [...body, ...counts(lines)].join('\n') + '\n';
}

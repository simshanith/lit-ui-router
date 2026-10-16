// eslint's default (stylish) formatter writes no workflow commands.

import { posix } from 'node:path';

import type { AnnotationLevel } from '@tools/shared/gha.core.ts';

import {
  type RunSummary,
  type ToolAnnotation,
  failedTasks,
  repoRelativeFile,
  stripAnsi,
} from './run-summary.core.ts';

// `  <line>:<col>  <severity>  <message>  <rule>`; a parse error has no rule.
const ROW =
  /^\s+(\d{1,7}):(\d{1,7})\s+(error|warning)\s+(.+?)(?:\s{2,}(\S+))?$/;

/** Each finding under its file header; stylish prints the header as an absolute path. */
export function parseEslintStylish(
  log: string,
  directory: string,
  root?: string,
): ToolAnnotation[] {
  const found: ToolAnnotation[] = [];
  let file: string | undefined;

  for (const rawLine of log.split('\n')) {
    const line = stripAnsi(rawLine).replace(/\r$/, '').trimEnd();

    if (posix.isAbsolute(line)) {
      file = repoRelativeFile(line, directory, root);
      continue;
    }

    const match = ROW.exec(line);

    if (match === null) {
      if (!/^\s/.test(line)) file = undefined;
      continue;
    }

    const [, lineNo = '', col = '', level, message = '', rule] = match;

    if (file === undefined || Number(lineNo) < 1 || Number(col) < 1) continue;

    const annotation: ToolAnnotation = {
      // SAFETY: ROW captures only error or warning
      level: level as AnnotationLevel,
      message,
      properties: { file, line: Number(lineNo), col: Number(col) },
    };

    if (rule !== undefined) annotation.properties.title = rule;
    found.push(annotation);
  }

  return found;
}

/** Failed tasks only: stylish-shaped text in a green log must not annotate. */
export function extractEslintDiagnostics(
  summary: RunSummary,
  logs: Map<string, string>,
  root?: string,
): ToolAnnotation[] {
  return failedTasks(summary).flatMap((task) => {
    const log = logs.get(task.taskId);

    return log === undefined
      ? []
      : parseEslintStylish(log, task.directory, root);
  });
}

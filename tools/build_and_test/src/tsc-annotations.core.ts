// tsc (and vite-plugin-checker in `vite build`) writes no workflow commands.

import type { AnnotationLevel } from '@tools/shared/gha.core.ts';

import {
  type RunSummary,
  type ToolAnnotation,
  failedTasks,
  repoRelativeFile,
  stripAnsi,
} from './run-summary.core.ts';

// Pretty and plain headers; on a TTY a vite `transforming...` can precede one.
const HEADER =
  /^(?:.*?\.\.\.)?(\S.*?)(?::(\d{1,7}):(\d{1,7}) - |\((\d{1,7}),(\d{1,7})\): )(error|warning) (TS\d+): (.*)$/;

function clean(rawLine: string): string {
  const line = stripAnsi(rawLine).replace(/\r$/, '');
  return line.slice(line.lastIndexOf('\r') + 1);
}

/** Each header plus its indented message chain; frames and footers are not headers. */
export function parseTscDiagnostics(
  log: string,
  directory: string,
  root?: string,
): ToolAnnotation[] {
  const lines = log.split('\n').map(clean);
  const found: ToolAnnotation[] = [];
  for (const [at, line] of lines.entries()) {
    const match = HEADER.exec(line);
    if (match === null) continue;
    const [, rawFile = '', line1, col1, line2, col2, level, code, head] = match;
    const file = repoRelativeFile(rawFile, directory, root);
    const lineNo = Number(line1 ?? line2);
    const col = Number(col1 ?? col2);
    if (file === undefined || lineNo < 1 || col < 1) continue;
    const chain: string[] = [];
    for (const next of lines.slice(at + 1)) {
      if (!/^\s+\S/.test(next) || HEADER.test(next)) break;
      chain.push(next.replace(/^ {2}/, '').trimEnd());
    }
    const message = [head ?? '', ...chain].join('\n').trim();
    if (message === '') continue;
    found.push({
      level: level as AnnotationLevel,
      message,
      properties: { file, line: lineNo, col, title: code },
    });
  }
  return found;
}

/** Failed tasks only: tsc-shaped text in a green log must not annotate. */
export function extractTscDiagnostics(
  summary: RunSummary,
  logs: Map<string, string>,
  root?: string,
): ToolAnnotation[] {
  return failedTasks(summary).flatMap((task) => {
    const log = logs.get(task.taskId);
    return log === undefined
      ? []
      : parseTscDiagnostics(log, task.directory, root);
  });
}

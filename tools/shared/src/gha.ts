// IO shell for GitHub Actions structure: log groups, error annotations, and
// step outputs. Outside Actions (a local `mise run`) the same calls degrade
// to plain logging, so tasks stay locally reproducible. The formatting
// decisions live in the pure, unit-tested functions in ./gha.core.ts.

import { appendFile } from 'node:fs/promises';

import {
  endGroupCommand,
  errorCommand,
  groupCommand,
  outputLine,
} from './gha.core.ts';

function onActions(): boolean {
  return process.env.GITHUB_ACTIONS === 'true';
}

/** Run `fn` inside a collapsible log group (plain heading locally). */
export async function group<T>(
  title: string,
  fn: () => Promise<T>,
): Promise<T> {
  console.log(onActions() ? groupCommand(title) : `── ${title}`);
  try {
    return await fn();
  } finally {
    // Always close the group, so a failure's own output lands OUTSIDE it —
    // visible without expanding anything.
    if (onActions()) console.log(endGroupCommand());
  }
}

/** Red run annotation on Actions; plain stderr locally. */
export function logError(message: string): void {
  console.error(onActions() ? errorCommand(message) : message);
}

/**
 * Export a step output by appending to GITHUB_OUTPUT (works from inside a
 * `mise run` because the runner-provided file path env var flows through to
 * the task's subprocess). Locally the line is printed instead, so a dry
 * local task run still shows what CI would export.
 */
export async function setOutput(name: string, value: string): Promise<void> {
  const line = outputLine(name, value);
  const file = process.env.GITHUB_OUTPUT;
  if (file !== undefined && file !== '') await appendFile(file, `${line}\n`);
  else console.log(line);
}

/** Uniform entry-point wrapper: annotate the failure and fail the task. */
export function runMain(main: () => Promise<void>): void {
  main().catch((error: unknown) => {
    logError(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

// Runs a signal CLI directly rather than through turbo: turbo collapses any
// task failure to its own exit 1, which would erase the 1-vs-2 distinction the
// check-run conclusion mappings are built on.

import { defaultExec, readExecFailure } from '@tools/shared/exec.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';

export type CliResult = {
  /** The CLI's exit code: 0 in sync, 1 drifted, 2 usage/API error. */
  exitCode: number;
  /** Combined stdout+stderr — the CLI's own report text. */
  output: string;
};

/** Run `node <cli> …args` without letting a non-zero exit escape as a rejection. */
export async function runCli(
  cli: string,
  args: readonly string[] = [],
): Promise<CliResult> {
  try {
    const { stdout, stderr } = await defaultExec('node', [cli, ...args], {
      cwd: workspaceRoot,
    });

    return { exitCode: 0, output: `${stdout}${stderr}` };
  } catch (error: unknown) {
    // execFile rejects with the child's code/stdout/stderr attached; anything
    // else (spawn failure) is an observer error too, so it lands on 2.
    const failure = readExecFailure(error);
    const exitCode = failure.code ?? 2;
    const stdout = failure.stdout ?? '';

    const stderr =
      failure.stderr ??
      (error instanceof Error ? error.message : String(error));

    return { exitCode, output: `${stdout}${stderr}` };
  }
}

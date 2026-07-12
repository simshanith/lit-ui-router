// IO shell for the engine seam: release-it always runs through pnpm's
// workspace filter from the workspace root, exactly as the workflows'
// `pnpm --filter <pkg> exec -- release-it …` lines did. Injectable
// Exec/Stream so tests assert the full pnpm argv.

import type { Exec, Stream } from './exec.ts';
import { defaultExec, defaultStream } from './exec.ts';
import { workspaceRoot } from './workspace.ts';

/** Full pnpm argv wrapping a release-it invocation for one package. */
export function pnpmReleaseItArgs(
  packageName: string,
  args: readonly string[],
): string[] {
  if (packageName.trim() === '') {
    throw new Error('packageName must be non-empty');
  }
  return ['--filter', packageName, 'exec', '--', 'release-it', ...args];
}

/** Captured-stdout run (e.g. --release-version); returns trimmed stdout. */
export async function releaseItOutput(
  packageName: string,
  args: readonly string[],
  exec: Exec = defaultExec,
): Promise<string> {
  const { stdout } = await exec('pnpm', pnpmReleaseItArgs(packageName, args), {
    cwd: workspaceRoot,
  });
  return stdout.trim();
}

/** Streamed run for the mutating invocations (tag, bump, publish). */
export function releaseItRun(
  packageName: string,
  args: readonly string[],
  stream: Stream = defaultStream,
): Promise<void> {
  return stream('pnpm', pnpmReleaseItArgs(packageName, args), {
    cwd: workspaceRoot,
  });
}

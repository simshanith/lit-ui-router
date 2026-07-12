// Shared IO helper for scripts that reproduce the publish workflow's Pack
// step. Kept out of the *.core.ts modules on purpose — those stay pure and
// unit-testable; this is the one child_process wrapper they all share.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** `pnpm pack` in `cwd`; falls back to corepack when pnpm is not on PATH. */
export async function pnpmPack(cwd: string, tarball: string): Promise<void> {
  const args = ['pack', '--out', tarball];
  try {
    await run('pnpm', args, { cwd });
  } catch (error) {
    // ENOENT means pnpm is not on PATH; any other failure is pack's own.
    if ((error as NodeJS.ErrnoException | null)?.code !== 'ENOENT') throw error;
    await run('corepack', ['pnpm', ...args], { cwd });
  }
}

// Shared IO helper for scripts that reproduce the publish workflow's Pack
// step. Kept out of the *.core.ts modules on purpose — those stay pure and
// unit-testable; this is the one child_process wrapper they all share.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** `pnpm pack` in `cwd`, trusting the mise-provisioned pnpm on PATH. */
export async function pnpmPack(cwd: string, tarball: string): Promise<void> {
  await run('pnpm', ['pack', '--out', tarball], { cwd });
}

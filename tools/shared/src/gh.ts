// A runtime `gh --version` guard: these tools also run locally, where gh may
// not be installed.

import type { Exec } from './exec.ts';
import { defaultExec } from './exec.ts';

/** Fail fast with guidance when gh is missing from PATH. */
export async function ensureGh(exec: Exec = defaultExec): Promise<void> {
  try {
    await exec('gh', ['--version']);
  } catch {
    throw new Error(
      'gh CLI not found on PATH — install GitHub CLI (https://cli.github.com) or run in CI',
    );
  }
}

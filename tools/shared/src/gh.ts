// gh CLI driver tier: 1:1 replacements for GitHub writes the workflows ran
// as bash one-liners. Argv arrays only (tests assert them via an injectable
// Exec), and a runtime `gh --version` guard because these tools also run
// locally, where gh may not be installed. Anything needing richer GitHub
// logic graduates to octokit + throttling — nothing in this pipeline does
// yet.

import type { Exec } from './exec.ts';
import { defaultExec } from './exec.ts';
import { withRetry } from './retry.ts';
import { workspaceRoot } from './workspace.ts';

/** argv for `gh pr create`, verbatim from bump-version.yml's Create PR step. */
export function prCreateArgs(base: string, head: string): string[] {
  if (base.trim() === '') throw new Error('base must be non-empty');
  if (head.trim() === '') throw new Error('head must be non-empty');
  return [
    'pr',
    'create',
    '--base',
    base,
    '--head',
    head,
    // auto-generated title and body from commit messages
    '--fill-verbose',
    // the release label exempts the PR from the semantic-pr title check
    '--label',
    'release',
  ];
}

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

/** Create the release PR; the GitHub API write gets in-tool retry. */
export async function createReleasePr(
  base: string,
  head: string,
  exec: Exec = defaultExec,
): Promise<void> {
  await ensureGh(exec);
  await withRetry(
    () => exec('gh', prCreateArgs(base, head), { cwd: workspaceRoot }),
    {
      onRetry: (error, attempt) => {
        console.error(
          `gh pr create attempt ${attempt} failed, retrying: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      },
    },
  );
}

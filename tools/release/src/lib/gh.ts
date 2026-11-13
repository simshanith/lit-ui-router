// gh CLI driver tier: 1:1 replacements for GitHub writes the workflows ran
// as bash one-liners. Argv arrays only (tests assert them via an injectable
// Exec), and a runtime `gh --version` guard because these tools also run
// locally, where gh may not be installed. Anything needing richer GitHub
// logic graduates to octokit + throttling — nothing in this pipeline does
// yet.

import type { Exec } from '@tools/shared/exec.ts';
import { defaultExec } from '@tools/shared/exec.ts';
import { ensureGh } from '@tools/shared/gh.ts';
import { withRetry } from './retry.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { messageOf } from '@tools/shared/errors.ts';

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

/**
 * Create the release PR; the GitHub API write gets in-tool retry. Resolves
 * to the PR URL gh prints — the caller surfaces it, or the run never says
 * which PR it opened.
 */
export async function createReleasePr(
  base: string,
  head: string,
  exec: Exec = defaultExec,
): Promise<string> {
  await ensureGh(exec);

  const { stdout } = await withRetry(
    () => exec('gh', prCreateArgs(base, head), { cwd: workspaceRoot }),
    {
      onRetry: (error, attempt) => {
        console.error(
          `gh pr create attempt ${attempt} failed, retrying: ${messageOf(
            error,
          )}`,
        );
      },
    },
  );

  return stdout.trim();
}

/** argv resolving a PR URL to the GraphQL node id the auto-merge mutation takes. */
export function prNodeIdArgs(prUrl: string): string[] {
  if (prUrl.trim() === '') throw new Error('prUrl must be non-empty');

  return ['pr', 'view', prUrl, '--json', 'id', '--jq', '.id'];
}

// Not `gh pr merge --auto`: gh merges at once when the PR is already
// mergeable, and this must never merge before the required checks report.
const ENABLE_AUTO_MERGE = `mutation($pullRequestId: ID!) {
  enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: SQUASH }) {
    pullRequest { autoMergeRequest { mergeMethod } }
  }
}`;

/** argv enabling squash auto-merge on a PR by node id. */
export function enableAutoMergeArgs(pullRequestId: string): string[] {
  if (pullRequestId.trim() === '') {
    throw new Error('pullRequestId must be non-empty');
  }

  return [
    'api',
    'graphql',
    '-f',
    `query=${ENABLE_AUTO_MERGE}`,
    '-f',
    `pullRequestId=${pullRequestId}`,
  ];
}

/**
 * Enable squash auto-merge on the release PR, with in-tool retry. Throws
 * when GitHub refuses, e.g. a PR that is already clean: the run fails
 * loudly with the PR open and auto-merge off, never merging it early.
 */
export async function enableReleasePrAutoMerge(
  prUrl: string,
  exec: Exec = defaultExec,
): Promise<void> {
  await ensureGh(exec);

  const run = (args: string[], label: string) =>
    withRetry(() => exec('gh', args, { cwd: workspaceRoot }), {
      onRetry: (error, attempt) => {
        console.error(
          `${label} attempt ${attempt} failed, retrying: ${messageOf(error)}`,
        );
      },
    });

  const { stdout } = await run(prNodeIdArgs(prUrl), 'gh pr view');
  const pullRequestId = stdout.trim();

  await run(enableAutoMergeArgs(pullRequestId), 'enable auto-merge');
}

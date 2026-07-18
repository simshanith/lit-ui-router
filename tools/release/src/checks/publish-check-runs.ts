#!/usr/bin/env node
// Create one published-diff check run per package on the current HEAD, from
// the summary check-published-diff.ts --json wrote. Shells out to gh itself
// (argv arrays via the shared Exec seam, no workflow-side jq) so the
// workflow stays a one-line mise step. `--dry-run` prints the payloads
// instead of calling gh. Shaping is pure and unit-tested in
// ./publish-check-runs.core.ts.

import { readFile } from 'node:fs/promises';

import type { PackageSummary } from './check-published-diff.core.ts';
import { checkRunApiArgs, toCheckRun } from './publish-check-runs.core.ts';
import { defaultExec } from '@tools/shared/exec.ts';
import { ensureGh } from '@tools/shared/gh.ts';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const summaryPath = process.argv
    .slice(2)
    .find((arg) => !arg.startsWith('--'));
  if (!summaryPath) {
    throw new Error('usage: publish-check-runs.ts <summary.json> [--dry-run]');
  }
  const parsed: unknown = JSON.parse(await readFile(summaryPath, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error(`${summaryPath} must contain a JSON array of summaries`);
  }
  const summaries = parsed as PackageSummary[];

  const payloads = summaries.map(toCheckRun);
  if (dryRun) {
    console.log(JSON.stringify(payloads, null, 2));
    return;
  }

  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) {
    throw new Error('GITHUB_REPOSITORY must be set (or pass --dry-run)');
  }
  const { stdout } = await defaultExec('git', ['rev-parse', 'HEAD']);
  const headSha = stdout.trim();
  await ensureGh();
  for (const payload of payloads) {
    await defaultExec('gh', checkRunApiArgs(repo, headSha, payload));
    console.log(
      `created check run "${payload.name}" (${payload.conclusion}) on ${headSha}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

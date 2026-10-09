#!/usr/bin/env node
// Altitude Atlas deploy signal: resolve the www/atlas head, run the read-only
// pages-deploy check against it, and report the verdict as one check run on
// that head. Non-gating — this exits 0 for every verdict, and a failure to
// resolve the head or post the run is a warning annotation. Shaping is pure
// and unit-tested in ./pages-deploy-check-runs.core.ts.

import { fileURLToPath } from 'node:url';

import { defaultExec } from '@tools/shared/exec.ts';
import { logWarning } from '@tools/shared/gha.ts';

import { ensureGh } from '../lib/gh.ts';
import { runCli } from '../lib/run-cli.ts';
import { checkRunApiArgs } from './publish-check-runs.core.ts';
import {
  branchHeadApiArgs,
  parseBranchHead,
  toPagesDeployCheckRun,
} from './pages-deploy-check-runs.core.ts';

const CLI = fileURLToPath(
  import.meta.resolve('@tools/workers-builds/pages-deploy.ts'),
);

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repo = process.env.GITHUB_REPOSITORY ?? 'simshanith/lit-ui-router';
  if (!process.env.GITHUB_REPOSITORY && !dryRun) {
    throw new Error('GITHUB_REPOSITORY must be set (or pass --dry-run)');
  }

  // A check run needs a head to sit on, so an unresolved head ends the run.
  await ensureGh();
  const { stdout } = await defaultExec('gh', branchHeadApiArgs(repo));
  const headSha = parseBranchHead(stdout);

  const result = await runCli(CLI, [headSha]);
  console.log(`pages-deploy exited ${result.exitCode}`);
  console.log(result.output);

  const payload = toPagesDeployCheckRun(result);
  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  await defaultExec('gh', checkRunApiArgs(repo, headSha, payload));
  console.log(
    `created check run "${payload.name}" (${payload.conclusion}) on ${headSha}`,
  );
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    logWarning(
      `pages-deploy check run not reported: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
}

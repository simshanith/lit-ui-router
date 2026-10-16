#!/usr/bin/env node
// Posts the pages-deploy verdict on the www/atlas head; a failure is a warning, never an exit.

import { fileURLToPath } from 'node:url';

import { defaultExec } from '@tools/shared/exec.ts';
import { appendStepSummary, logWarning } from '@tools/shared/gha.ts';

import { ensureGh } from '@tools/shared/gh.ts';
import { runCli } from '../lib/run-cli.ts';
import {
  checkRunApiArgs,
  checkRunsMarkdown,
} from './publish-check-runs.core.ts';
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

  await appendStepSummary(checkRunsMarkdown('pages-deploy', [payload]));

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));

    return;
  }

  await defaultExec('gh', checkRunApiArgs(repo, headSha, payload));
  console.log(
    `created check run "${payload.name}" (${payload.conclusion}) on ${headSha}`,
  );
}

const warn = (cause: unknown): void =>
  logWarning(
    `pages-deploy check run not reported: ${cause instanceof Error ? cause.message : String(cause)}`,
  );

if (import.meta.main) await main().catch(warn);

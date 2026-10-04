#!/usr/bin/env node
// CD-pipeline verification signal: run the read-only workers-builds-triggers
// diff against the live Cloudflare API and report its verdict as one check
// run on the current HEAD. Phase 1 of #280, non-gating — this exits 0 for
// every verdict, including the CLI's exit 2 and a missing credential, so the
// signal can never fail CI.
//
// The CLI runs through ../lib/run-cli.ts, never turbo. Shaping is pure and
// unit-tested in ./workers-builds-check-runs.core.ts.

import { fileURLToPath } from 'node:url';

import { defaultExec } from '@tools/shared/exec.ts';
import { ensureGh } from '../lib/gh.ts';
import { runCli } from '../lib/run-cli.ts';
import { logWarning } from '@tools/shared/gha.ts';

import { checkRunApiArgs } from './publish-check-runs.core.ts';
import { toWorkersBuildsCheckRun } from './workers-builds-check-runs.core.ts';

// Resolved through node so the @tools/workers-builds devDependency (declared
// for exactly this, and to pull the package into `setup --release`'s install
// closure) is what locates the CLI, not a hardcoded relative path.
const CLI = fileURLToPath(
  import.meta.resolve('@tools/workers-builds/workers-builds-triggers.ts'),
);

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repo = process.env.GITHUB_REPOSITORY ?? 'simshanith/lit-ui-router';
  if (!process.env.GITHUB_REPOSITORY && !dryRun) {
    throw new Error('GITHUB_REPOSITORY must be set (or pass --dry-run)');
  }

  const result = await runCli(CLI);
  console.log(`workers-builds-triggers exited ${result.exitCode}`);
  console.log(result.output);

  const payload = toWorkersBuildsCheckRun(result, repo);
  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  const { stdout } = await defaultExec('git', ['rev-parse', 'HEAD']);
  const headSha = stdout.trim();
  await ensureGh();
  await defaultExec('gh', checkRunApiArgs(repo, headSha, payload));
  console.log(
    `created check run "${payload.name}" (${payload.conclusion}) on ${headSha}`,
  );
}

main().catch((error: unknown) => {
  // Even the reporting path stays non-gating: a gh outage must not turn a
  // deploy-pipeline signal into a red CI run. A warning annotation surfaces
  // it on the run summary instead of a non-zero exit.
  logWarning(
    `workers-builds check run not reported: ${error instanceof Error ? error.message : String(error)}`,
  );
});

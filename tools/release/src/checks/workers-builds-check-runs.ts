#!/usr/bin/env node
// CD-pipeline verification signal: run the read-only workers-builds-triggers
// diff against the live Cloudflare API and report its verdict as one check
// run on the current HEAD. Phase 1 of #280, non-gating — this exits 0 for
// every verdict, including the CLI's exit 2 and a missing credential, so the
// signal can never fail CI.
//
// The CLI is spawned directly rather than through turbo on purpose: turbo
// collapses any task failure to its own exit 1, which would erase the 1-vs-2
// distinction the conclusion mapping is built on. Shaping is pure and
// unit-tested in ./workers-builds-check-runs.core.ts.

import { fileURLToPath } from 'node:url';

import { defaultExec } from '@tools/shared/exec.ts';
import { ensureGh } from '@tools/shared/gh.ts';
import { logWarning } from '@tools/shared/gha.ts';
import { workspaceRoot } from '@tools/shared/workspace.ts';

import { checkRunApiArgs } from './publish-check-runs.core.ts';
import {
  toWorkersBuildsCheckRun,
  type TriggerCheckResult,
} from './workers-builds-check-runs.core.ts';

// Resolved through node so the @tools/workers-builds devDependency (declared
// for exactly this, and to pull the package into `setup --release`'s install
// closure) is what locates the CLI, not a hardcoded relative path.
const CLI = fileURLToPath(
  import.meta.resolve('@tools/workers-builds/workers-builds-triggers.ts'),
);

/** Run the CLI without letting a non-zero exit escape as a rejection. */
async function runTriggerCheck(): Promise<TriggerCheckResult> {
  try {
    const { stdout, stderr } = await defaultExec('node', [CLI], {
      cwd: workspaceRoot,
    });
    return { exitCode: 0, output: `${stdout}${stderr}` };
  } catch (error: unknown) {
    // execFile rejects with the child's code/stdout/stderr attached; anything
    // else (spawn failure) is an observer error too, so it lands on 2.
    const failure = error as {
      code?: unknown;
      stdout?: unknown;
      stderr?: unknown;
    };
    const exitCode = typeof failure.code === 'number' ? failure.code : 2;
    const stdout = typeof failure.stdout === 'string' ? failure.stdout : '';
    const stderr =
      typeof failure.stderr === 'string'
        ? failure.stderr
        : error instanceof Error
          ? error.message
          : String(error);
    return { exitCode, output: `${stdout}${stderr}` };
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repo = process.env.GITHUB_REPOSITORY ?? 'simshanith/lit-ui-router';
  if (!process.env.GITHUB_REPOSITORY && !dryRun) {
    throw new Error('GITHUB_REPOSITORY must be set (or pass --dry-run)');
  }

  const result = await runTriggerCheck();
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

#!/usr/bin/env node
// Drives the whole bump-version job — one task instead of five run blocks:
//   env in: PACKAGE, INCREMENT, OTHER_INCREMENT, PR_BASE,
//           BRANCH_PREFIX_INPUT, DRY_RUN,
//           GH_TOKEN (gh pr create; release-it pushes the branch over the
//           checkout's persisted PAT credentials, not this env)
// Phases mirror the old steps, each in its own log group:
//   1. compute the bumped version (release-it --release-version, with the
//      increment argv validated by release-increment-args.core.ts)
//   2. create the release branch (skipped on dry runs, like the old `if:`)
//   3. bump: release-it commits and pushes, message from commit:changelog
//   4. create the release PR via gh (skipped on dry runs; in-tool retry)
// Every release-it argv comes from the engine seam (release-it.core.ts).

import { defaultExec, defaultStream } from './exec.ts';
import { boolEnv, requireEnv } from './env.core.ts';
import { createReleasePr } from './gh.ts';
import { group, runMain } from './gha.ts';
import { branchPrefix, commitMessageFromScript } from './release-bump.core.ts';
import { incrementArgs } from './release-increment-args.core.ts';
import {
  bumpArgs,
  parseReleaseVersion,
  releaseVersionArgs,
} from './release-it.core.ts';
import { releaseItOutput, releaseItRun } from './release-it.ts';
import { workspaceRoot } from './workspace.ts';

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE');
  const increment = requireEnv(process.env, 'INCREMENT');
  const otherIncrement = process.env.OTHER_INCREMENT ?? '';
  const prBase = requireEnv(process.env, 'PR_BASE');
  const dryRun = boolEnv(process.env, 'DRY_RUN');
  const prefix = branchPrefix(process.env.BRANCH_PREFIX_INPUT, packageName);

  const version = await group('calculate bumped version', async () => {
    const args = releaseVersionArgs(incrementArgs(increment, otherIncrement));
    const bumped = parseReleaseVersion(
      await releaseItOutput(packageName, args),
    );
    console.log(bumped);
    return bumped;
  });
  const branch = `${prefix}${version}`;

  if (!dryRun) {
    await group(`create branch ${branch}`, () =>
      defaultStream('git', ['switch', '--create', branch], {
        cwd: workspaceRoot,
      }),
    );
  }

  await group(`bump ${packageName} to ${version}`, async () => {
    const { stdout } = await defaultExec(
      'pnpm',
      ['--silent', '--filter', packageName, 'run', 'commit:changelog'],
      { cwd: workspaceRoot },
    );
    await releaseItRun(
      packageName,
      bumpArgs({
        version,
        commitMessage: commitMessageFromScript(stdout),
        dryRun,
      }),
    );
  });

  if (!dryRun) {
    await group(`create PR against ${prBase}`, () =>
      createReleasePr(prBase, branch),
    );
  }
});

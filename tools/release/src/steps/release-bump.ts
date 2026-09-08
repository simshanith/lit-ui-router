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
//   3. bump: release-it commits and pushes, message = "Release <version>" +
//      the changelog, its range pinned to the package's previous tag in
//      this lane or the repo root (#302, release-prev-tag.ts) — the same
//      pin the publish driver applies, so the PR body, the squash commit
//      and the GitHub release notes agree
//   4. create the release PR via gh (skipped on dry runs; in-tool retry)
// Every release-it argv comes from the engine seam (release-it.core.ts).

import { defaultStream } from '@tools/shared/exec.ts';
import { boolEnv, requireEnv } from '../lib/env.core.ts';
import { createReleasePr } from '../lib/gh.ts';
import { group, logNotice, logWarning, runMain } from '@tools/shared/gha.ts';
import { branchPrefix, releaseCommitMessage } from './release-bump.core.ts';
import { incrementArgs } from './release-increment-args.core.ts';
import {
  bumpArgs,
  changelogArgs,
  parseReleaseVersion,
  releaseVersionArgs,
} from './release-it.core.ts';
import { releaseItOutput, releaseItRun } from './release-it.ts';
import { changelogFrom } from './release-prev-tag.ts';
import { workspaceRoot } from '@tools/shared/workspace.ts';

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

  const commitMessage = await group('changelog', async () => {
    const from = await changelogFrom(packageName, version);
    console.log(`range start: ${from}`);
    const changelog = await releaseItOutput(
      packageName,
      changelogArgs({ packageName, from }),
    );
    const { message, warning } = releaseCommitMessage(version, changelog, from);
    if (warning !== undefined) logWarning(warning);
    console.log(message);
    return message;
  });

  await group(`bump ${packageName} to ${version}`, () =>
    releaseItRun(packageName, bumpArgs({ version, commitMessage, dryRun })),
  );

  if (!dryRun) {
    const url = await group(`create PR against ${prBase}`, () =>
      createReleasePr(prBase, branch),
    );
    logNotice(`release PR: ${url}`);
  }
});

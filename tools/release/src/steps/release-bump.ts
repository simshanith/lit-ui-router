#!/usr/bin/env node
// Drives the whole bump-version job — one task instead of five run blocks:
//   env in: PACKAGE, INCREMENT, OTHER_INCREMENT, PR_BASE,
//           BRANCH_PREFIX_INPUT, DRY_RUN, AUTO_MERGE,
//           GH_TOKEN (gh pr create and auto-merge; release-it pushes the branch over the
//           checkout's persisted PAT credentials, not this env)
// Phases mirror the old steps, each in its own log group:
//   1. compute the bumped version (release-it --release-version, with the
//      increment argv validated by release-increment-args.core.ts)
//   2. create the release branch (skipped on dry runs, like the old `if:`)
//   3. bump: capture the notes, their range pinned to the package's previous
//      tag in this lane or the repo root (#302, release-prev-tag.ts); then
//      release-it re-resolves the lockfile, runs the dependent floor gate
//      (release-dependent-floor-gate.ts), adds the notes as the version's
//      CHANGELOG.md section, and commits and pushes. The message names the
//      section and carries a Notes-Through trailer: the commit the branch was
//      cut from, which check-notes-through.ts compares the base against. A
//      prerelease writes no section and its message carries the notes
//   4. create the release PR via gh (skipped on dry runs; in-tool retry)
//   5. with AUTO_MERGE, enable squash auto-merge on it (dry runs only report
//      it); a refusal fails the run with the PR left open
// Every release-it argv comes from the engine seam (release-it.core.ts).

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import semver from 'semver';

import { defaultExec, defaultStream } from '@tools/shared/exec.ts';
import { boolEnv, requireEnv } from '../lib/env.core.ts';
import { createReleasePr, enableReleasePrAutoMerge } from '../lib/gh.ts';
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
import { changelogRange } from './release-prev-tag.ts';
import { changelogScript, packageNotes } from './release-notes-file.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';

// outside the repo: release-it refuses to start on a dirty tree
async function withNotesFile(
  changelog: string,
  run: (notesPath: string) => Promise<void>,
): Promise<void> {
  const scratch = await mkdtemp(join(tmpdir(), 'release-notes-'));
  const notesPath = join(scratch, 'notes.md');

  try {
    await writeFile(notesPath, changelog);
    await run(notesPath);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE');
  const increment = requireEnv(process.env, 'INCREMENT');
  const otherIncrement = process.env.OTHER_INCREMENT ?? '';
  const prBase = requireEnv(process.env, 'PR_BASE');
  const dryRun = boolEnv(process.env, 'DRY_RUN');
  const autoMerge = boolEnv(process.env, 'AUTO_MERGE');
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
  const stable = semver.prerelease(version) === null;
  const notes = await packageNotes(packageName);

  const notesThrough = (
    await defaultExec('git', ['rev-parse', 'HEAD'], { cwd: workspaceRoot })
  ).stdout.trim();

  if (!dryRun) {
    await group(`create branch ${branch}`, () =>
      defaultStream('git', ['switch', '--create', branch], {
        cwd: workspaceRoot,
      }),
    );
  }

  const { changelog, commitMessage } = await group('changelog', async () => {
    const { from, previousVersion } = await changelogRange(
      packageName,
      version,
    );

    console.log(`range start: ${from}`);

    const captured = await releaseItOutput(
      packageName,
      changelogArgs({ packageName, version, from, previousVersion }),
    );

    const { message, warning } = releaseCommitMessage({
      version,
      changelog: captured,
      section: stable
        ? { changelogPath: notes.changelogPath, notesThrough }
        : undefined,
      from,
    });

    if (warning !== undefined) logWarning(warning);

    if (stable) {
      console.log(
        `${notes.changelogPath} gains the ${version} section:\n\n${captured}\n`,
      );
    }

    console.log(`commit message:\n\n${message}`);

    return { changelog: captured, commitMessage: message };
  });

  await group(`bump ${packageName} to ${version}`, () =>
    withNotesFile(changelog, (notesPath) =>
      releaseItRun(
        packageName,
        bumpArgs({
          packageName,
          version,
          commitMessage,
          section: stable
            ? {
                notes: {
                  changelog: notes.changelog,
                  script: changelogScript('write-section.ts'),
                },
                notesPath,
              }
            : undefined,
          dryRun,
        }),
      ),
    ),
  );

  if (dryRun) {
    if (autoMerge) logNotice('dry run: would enable squash auto-merge');

    return;
  }

  const url = await group(`create PR against ${prBase}`, () =>
    createReleasePr(prBase, branch),
  );

  logNotice(`release PR: ${url}`);

  if (autoMerge) {
    await group('enable squash auto-merge', () =>
      enableReleasePrAutoMerge(url),
    );

    logNotice(`auto-merge enabled: ${url}`);
  }
});

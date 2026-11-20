#!/usr/bin/env node
// The publish driver — publish-npm.yml's Release version + Publish steps as
// one task:
//   env in: PACKAGE_NAME, TARBALL, DRY_RUN,
//           GITHUB_TOKEN (release-it's GitHub release; npm auth is OIDC)
//   outputs: version (the release version, for the ledger claim)
// Absorbs the old PREV_TAG/CHANGELOG_ARGS bash wiring: the release version
// comes from the engine seam, the previous tag of THIS package (or the repo
// root on a first release) pins the conventional-changelog range (#302,
// release-prev-tag.ts), and the whole publish argv is built by publishArgs.
// A stable release's GitHub release body is its CHANGELOG.md section, which
// must exist before anything publishes; a commit the notes would list that
// landed after their Notes-Through commit fails the run too (a warning on dry
// runs). A prerelease has no section, so release-it renders its body from the
// pinned range. release-it >= 20.1 handles the immutable draft→assets→publish release natively in that single
// invocation. Not retried in-tool: the engine's writes are non-idempotent
// (see retry.ts); a human re-runs the workflow after a partial failure.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import semver from 'semver';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { extractSection } from '@tools/changelog';
import { group, logWarning, runMain, setOutput } from '@tools/shared/gha.ts';

import {
  formatNotesThroughReport,
  passes,
} from '../checks/notes-through.core.ts';
import { checkNotesThrough } from '../checks/notes-through.ts';
import { boolEnv, requireEnv } from '../lib/env.core.ts';
import {
  currentReleaseVersionArgs,
  parseReleaseVersion,
  publishArgs,
  releaseNotesCommand,
} from './release-it.core.ts';
import { releaseItOutput, releaseItRun } from './release-it.ts';
import { changelogScript, packageNotes } from './release-notes-file.ts';
import { changelogRange } from './release-prev-tag.ts';

/**
 * A stable release's `github.releaseNotes` command, after proving its
 * CHANGELOG.md section exists and its Notes-Through commit is current.
 */
async function stableReleaseNotes(options: {
  packageName: string;
  releaseVersion: string;
  from: string;
  dryRun: boolean;
}): Promise<string> {
  const { packageName, releaseVersion, from, dryRun } = options;
  const notes = await packageNotes(packageName);

  await group(`release notes: ${notes.changelogPath}`, async () => {
    const body = extractSection(
      await readFile(notes.changelog, 'utf8'),
      releaseVersion,
    );

    if (body === undefined) {
      throw new Error(
        `${notes.changelogPath} has no ${releaseVersion} section; the bump writes it, and nothing regenerates it here`,
      );
    }

    console.log(body);
  });

  await group('notes cover every listed commit (Notes-Through)', () => {
    const result = checkNotesThrough({
      packageName,
      cwd: join(workspaceRoot, notes.dir),
      trailerRange: `${from}..HEAD`,
      tip: 'HEAD',
    });

    const report = formatNotesThroughReport([result]);

    if (passes(result)) console.log(report);
    else if (dryRun) logWarning(report);
    else throw new Error(report);

    return Promise.resolve();
  });

  return releaseNotesCommand({
    notes: {
      changelog: notes.changelog,
      script: changelogScript('extract.ts'),
    },
    version: releaseVersion,
  });
}

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE_NAME');
  const tarballPath = requireEnv(process.env, 'TARBALL');
  const dryRun = boolEnv(process.env, 'DRY_RUN');

  const releaseVersion = await group('release version', async () => {
    const version = parseReleaseVersion(
      await releaseItOutput(packageName, currentReleaseVersionArgs()),
    );

    console.log(version);

    return version;
  });

  const { from, previousVersion } = await group(
    'changelog range start (#302 pin)',
    async () => {
      const range = await changelogRange(packageName, releaseVersion);
      console.log(range.from);

      return range;
    },
  );

  const releaseNotes = semver.prerelease(releaseVersion)
    ? undefined
    : await stableReleaseNotes({ packageName, releaseVersion, from, dryRun });

  await group(`publish ${packageName}@${releaseVersion}`, () =>
    releaseItRun(
      packageName,
      publishArgs({
        releaseVersion,
        tarballPath,
        from,
        previousVersion,
        releaseNotes,
        dryRun,
      }),
    ),
  );

  await setOutput('version', releaseVersion);
});

#!/usr/bin/env node
// The publish driver — publish-npm.yml's Release version + Publish steps as
// one task:
//   env in: PACKAGE_NAME, TARBALL, DRY_RUN,
//           GITHUB_TOKEN (release-it's GitHub release; npm auth is OIDC)
// Absorbs the old PREV_TAG/CHANGELOG_ARGS bash wiring: the release version
// comes from the engine seam, the previous tag of THIS package pins the
// conventional-changelog range (#302, release-prev-tag.ts), and the whole
// publish argv is built by publishArgs — release-it >= 20.1 handles the
// immutable draft→assets→publish release natively in that single
// invocation. Not retried in-tool: the engine's writes are non-idempotent
// (see retry.ts); a human re-runs the workflow after a partial failure.

import { boolEnv, requireEnv } from './env.core.ts';
import { group, runMain } from './gha.ts';
import {
  currentReleaseVersionArgs,
  parseReleaseVersion,
  publishArgs,
} from './release-it.core.ts';
import { releaseItOutput, releaseItRun } from './release-it.ts';
import { prevReleaseTag } from './release-prev-tag.ts';

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

  const prevTag = await group(
    'previous release tag (#302 range pin)',
    async () => {
      const tag = await prevReleaseTag(packageName, releaseVersion);
      console.log(tag ?? '(first release — no range override)');
      return tag;
    },
  );

  await group(`publish ${packageName}@${releaseVersion}`, () =>
    releaseItRun(
      packageName,
      publishArgs({ releaseVersion, tarballPath, prevTag, dryRun }),
    ),
  );
});

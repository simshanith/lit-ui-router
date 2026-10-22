#!/usr/bin/env node
// Push one package's release tag ref — publish-gh.yml's Push tag step:
//   env in: PACKAGE, DRY_RUN
// The version is read from the package's manifest via pnpm's workspace
// resolver (the bash shelled out to `node -p require('./package.json')
// .version` for the same value). A dry run prints what it would push. A tag
// already on the remote is skipped (#674); any other push failure is fatal.
// A push (or dry run) appends a line to the job summary.
// Decisions live in ./release-tag-push.core.ts and ./release-tag-state.core.ts.

import { defaultStream } from '@tools/shared/exec.ts';
import { boolEnv, requireEnv } from '../lib/env.core.ts';
import { appendStepSummary, runMain } from '@tools/shared/gha.ts';
import { pushTagArgs, tagPushSummary } from './release-tag-push.core.ts';
import { isPushed, tagStateMessage } from './release-tag-state.core.ts';
import { resolveReleaseTagName, resolveTagState } from './release-tag-state.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE');
  const dryRun = boolEnv(process.env, 'DRY_RUN');
  const tagName = await resolveReleaseTagName(packageName);
  const state = await resolveTagState(tagName);
  const { GITHUB_REPOSITORY, GITHUB_SERVER_URL } = process.env;

  const repoUrl =
    GITHUB_REPOSITORY && GITHUB_SERVER_URL
      ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}`
      : undefined;

  if (isPushed(state)) {
    console.log(tagStateMessage(state, tagName));
    console.log(`skipping push of refs/tags/${tagName}`);

    return;
  }

  // A dry run never tagged, so it reports the push it would make and stops.
  if (dryRun) {
    console.log(`dry-run: would push refs/tags/${tagName}`);
    await appendStepSummary(tagPushSummary(tagName, true, repoUrl));

    return;
  }

  if (state === 'tag') {
    // Nothing to push: the Tag step did not leave a local tag behind.
    throw new Error(`no local tag ${tagName} to push`);
  }

  await defaultStream('git', pushTagArgs(tagName), { cwd: workspaceRoot });
  await appendStepSummary(tagPushSummary(tagName, false, repoUrl));
});

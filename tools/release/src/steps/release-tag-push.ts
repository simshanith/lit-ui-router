#!/usr/bin/env node
// Push one package's release tag ref — publish-gh.yml's Push tag step:
//   env in: PACKAGE, DRY_RUN
// The version is read from the package's manifest via pnpm's workspace
// resolver (the bash shelled out to `node -p require('./package.json')
// .version` for the same value). A dry run prints what it would push. A tag
// already on the remote is skipped (#674); any other push failure is fatal.
// Decisions live in ./release-tag-push.core.ts and ./release-tag-state.core.ts.

import { defaultStream } from '@tools/shared/exec.ts';
import { boolEnv, requireEnv } from '@tools/shared/env.core.ts';
import { runMain } from '@tools/shared/gha.ts';
import { pushTagArgs } from './release-tag-push.core.ts';
import { isPushed, tagStateMessage } from './release-tag-state.core.ts';
import { resolveReleaseTagName, resolveTagState } from './release-tag-state.ts';
import { workspaceRoot } from '@tools/shared/workspace.ts';

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE');
  const dryRun = boolEnv(process.env, 'DRY_RUN');
  const tagName = await resolveReleaseTagName(packageName);
  const state = await resolveTagState(tagName);
  if (isPushed(state)) {
    console.log(tagStateMessage(state, tagName));
    console.log(`skipping push of refs/tags/${tagName}`);
    return;
  }
  // A dry run never tagged, so it reports the push it would make and stops.
  if (dryRun) {
    console.log(`dry-run: would push refs/tags/${tagName}`);
    return;
  }
  if (state === 'tag') {
    // Nothing to push: the Tag step did not leave a local tag behind.
    throw new Error(`no local tag ${tagName} to push`);
  }
  await defaultStream('git', pushTagArgs(tagName), { cwd: workspaceRoot });
});

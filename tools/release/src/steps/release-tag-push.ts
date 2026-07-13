#!/usr/bin/env node
// Push one package's release tag ref — publish-gh.yml's Push tag step:
//   env in: PACKAGE, DRY_RUN
// The version is read from the package's manifest via pnpm's workspace
// resolver (the bash shelled out to `node -p require('./package.json')
// .version` for the same value). A dry run prints what it would push. The
// workflow keeps continue-on-error: a tag existing on the remote at a
// different commit is rejected here, matching the previous tag-exists
// behavior. Decisions live in ./release-tag-push.core.ts.

import { defaultStream } from 'shared/exec.ts';
import { boolEnv, requireEnv } from 'shared/env.core.ts';
import { runMain } from 'shared/gha.ts';
import { memberDir } from './release-package-info.core.ts';
import { pushTagArgs, releaseTagName } from './release-tag-push.core.ts';
import { loadWorkspace, workspaceRoot } from 'shared/workspace.ts';

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE');
  const dryRun = boolEnv(process.env, 'DRY_RUN');
  const { members } = await loadWorkspace(workspaceRoot);
  // memberDir doubles as membership validation before composing a ref.
  memberDir(packageName, members);
  const version =
    members.find((member) => member.name === packageName)?.manifest?.version ??
    '';
  const tagName = releaseTagName(packageName, version);
  if (dryRun) {
    console.log(`dry-run: would push refs/tags/${tagName}`);
    return;
  }
  await defaultStream('git', pushTagArgs(tagName), { cwd: workspaceRoot });
});

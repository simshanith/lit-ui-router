#!/usr/bin/env node
// Configure the github-actions[bot] git identity — the duplicated Setup Git
// user step of bump-version.yml and publish-gh.yml, now one task. env in:
// none. Guarded to Actions runners: the writes are `git config --global`,
// and a stray local `mise run //tools/release:git_user` must not clobber a
// developer's identity. argv lives in ./release-git-user.core.ts.

import { defaultExec } from '@tools/shared/exec.ts';
import { runMain } from '@tools/shared/gha.ts';
import { gitUserConfigArgs } from './release-git-user.core.ts';

runMain(async () => {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error(
      'refusing to write --global git config outside GitHub Actions',
    );
  }
  for (const args of gitUserConfigArgs()) {
    await defaultExec('git', args);
  }
});

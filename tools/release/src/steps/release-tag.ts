#!/usr/bin/env node
// Tag the current version of one package — publish-gh.yml's Tag step:
//   env in: PACKAGE, DRY_RUN
// release-it tags locally only (--git.push false): pushing main + tag
// together is release-it's rollback trap, so the tag ref is pushed
// separately by release-tag-push.ts. An existing tag is skipped up front
// (release-it errors on it, #674). argv comes from the engine seam
// (release-it.core.ts).

import { boolEnv, requireEnv } from '@tools/shared/env.core.ts';
import { group, runMain } from '@tools/shared/gha.ts';
import { tagArgs } from './release-it.core.ts';
import { releaseItRun } from './release-it.ts';
import { tagStateMessage } from './release-tag-state.core.ts';
import { resolveReleaseTagName, resolveTagState } from './release-tag-state.ts';

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE');
  const dryRun = boolEnv(process.env, 'DRY_RUN');
  const tagName = await resolveReleaseTagName(packageName);
  const state = await resolveTagState(tagName);
  if (state !== 'tag') {
    console.log(tagStateMessage(state, tagName));
    console.log(`skipping tag of ${tagName}`);
    return;
  }
  await group(`tag current version of ${packageName}`, () =>
    releaseItRun(packageName, tagArgs(dryRun)),
  );
});

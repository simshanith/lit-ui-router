#!/usr/bin/env node
// Tag the current version of one package — publish-gh.yml's Tag step:
//   env in: PACKAGE, DRY_RUN
// release-it tags locally only (--git.push false): pushing main + tag
// together is release-it's rollback trap, so the tag ref is pushed
// separately by release-tag-push.ts. publish-gh tags the CURRENT manifest
// version on every main push, so an existing tag is the common case and
// release-it errors rather than no-ops on it; the idempotent outcomes are
// classified here (#674) instead of by the workflow's continue-on-error, so
// a release-it crash still fails the step. argv comes from the engine seam
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

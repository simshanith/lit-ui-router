#!/usr/bin/env node
// Tag the current version of one package — publish-gh.yml's Tag step:
//   env in: PACKAGE, DRY_RUN
// release-it tags locally only (--git.push false): pushing main + tag
// together is release-it's rollback trap, so the tag ref is pushed
// separately by release-tag-push.ts. The workflow keeps
// continue-on-error on this step — tagging is idempotent, an existing
// tag fails here and that is fine. argv comes from the engine seam
// (release-it.core.ts).

import { boolEnv, requireEnv } from '../lib/env.core.ts';
import { group, runMain } from '../lib/gha.ts';
import { tagArgs } from './release-it.core.ts';
import { releaseItRun } from './release-it.ts';

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE');
  const dryRun = boolEnv(process.env, 'DRY_RUN');
  await group(`tag current version of ${packageName}`, () =>
    releaseItRun(packageName, tagArgs(dryRun)),
  );
});

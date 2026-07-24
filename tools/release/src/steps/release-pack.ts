#!/usr/bin/env node
// Pack the publish tarball — publish-npm.yml's Pack step as a tool:
//   env in:  PACKAGE_NAME, PACKAGE_DIR (workspace-relative)
//   outputs: tarball (absolute path, for the attest + check + publish steps)
//
// Re-bakes the DEBIT tarball from cold-built source with the shared
// packPublishTarball — deliberately NOT the `@tools/release#pack` turbo cache.
// That cache is unsigned and writable by any CI run holding TURBO_TOKEN, so its
// bytes are attested only after Reconcile (release-reconcile.ts) balances this
// cold bake against it. Same packer, same source → reproducibly identical bytes
// (check:published-diff proves the determinism); this is what gets attested and
// published, with the cache kept off the build path.

import { join } from 'node:path';

import {
  packStagingParent,
  publishTarballPath,
} from '../checks/cache-paths.ts';
import { group, runMain, setOutput } from '@tools/shared/gha.ts';
import { requireEnv } from '@tools/shared/env.core.ts';
import { packPublishTarball } from './pack-staged.ts';
import { workspaceRoot } from '@tools/shared/workspace.ts';

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE_NAME');
  const packageDir = requireEnv(process.env, 'PACKAGE_DIR');
  const tarball = publishTarballPath(packageName);

  await group(`pack ${packageName} with stripped manifest`, async () => {
    await packPublishTarball(
      packageName,
      join(workspaceRoot, packageDir),
      tarball,
      packStagingParent,
    );
  });

  console.log(tarball);
  await setOutput('tarball', tarball);
});

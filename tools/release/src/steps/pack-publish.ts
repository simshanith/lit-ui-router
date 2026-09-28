// The one publish-shape packer, shared by the CI pack task and the publish
// step. `pnpm pack` runs in the package itself, so `catalog:`/`workspace:`
// resolve against the real workspace; ./strip-manifest.pnpmfile.mjs strips the
// packed manifest in memory and the source tree is never written. Field
// decisions live in ./release-pack.core.ts.

import { join } from 'node:path';

import { defaultStream } from '@tools/shared/exec.ts';

const stripManifestPnpmfile = join(
  import.meta.dirname,
  'strip-manifest.pnpmfile.mjs',
);

/** Pack `packageDir` publish-shape into `outTarball` (an absolute path). */
export async function packPublishTarball(
  packageDir: string,
  outTarball: string,
): Promise<void> {
  // --out writes only this path (parents created, a stale file overwritten).
  await defaultStream('pnpm', ['pack', '--out', outTarball], {
    cwd: packageDir,
    env: {
      ...process.env,
      // Env, not a root pnpmfile: that would add pnpmfileChecksum to the
      // lockfile. Only the PNPM_CONFIG_ spellings are honored for pack.
      PNPM_CONFIG_PNPMFILE: stripManifestPnpmfile,
      // prepack/prepare run from the on-disk manifest, before the hook.
      PNPM_CONFIG_IGNORE_SCRIPTS: 'true',
    },
  });
}

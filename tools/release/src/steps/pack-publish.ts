// The one publish-shape packer, shared by the CI pack task and the publish
// step. `pnpm pack` runs in the package itself, so `catalog:`/`workspace:`
// resolve against the real workspace; ./strip-manifest.pnpmfile.mjs strips the
// packed manifest in memory and the source tree is never written. Field
// decisions and the tarball-pick live in ./release-pack.core.ts.

import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { defaultStream } from '@tools/shared/exec.ts';
import { pickTarball } from './release-pack.core.ts';

const stripManifestPnpmfile = join(
  import.meta.dirname,
  'strip-manifest.pnpmfile.mjs',
);

/**
 * Pack `packageDir` publish-shape into `outTarball` (an absolute path).
 * `scratchParent`/<pkg> receives the versioned tarball first; it is created if
 * absent and cleaned before and after.
 */
export async function packPublishTarball(
  packageName: string,
  packageDir: string,
  outTarball: string,
  scratchParent: string,
): Promise<void> {
  const scratch = join(scratchParent, packageName);
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });
  try {
    await defaultStream('pnpm', ['pack', '--pack-destination', scratch], {
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

    const packed = join(scratch, pickTarball(await readdir(scratch)));
    await mkdir(dirname(outTarball), { recursive: true });
    await rename(packed, outTarball);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

// The one publish-shape packer, shared by the CI pack task and the publish
// step. Produces a dev-stripped tarball WITHOUT mutating the source package:
// the package is copied into an in-workspace staging dir (so `pnpm pack`
// resolves `catalog:`/`workspace:` against the real workspace, upward), the
// COPY's manifest is stripped, and pnpm packs there. The source tree is never
// touched — no strip-in-place, no restore, so a crash can't leave a dirty
// working tree. Field decisions and the tarball-pick live in ./release-pack.core.ts.

import { cp, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { readProjectManifest } from '@pnpm/workspace.project-manifest-reader';

import { defaultStream } from '@tools/shared/exec.ts';
import { pickTarball, strippedManifest } from './release-pack.core.ts';

// Never copy these into staging: node_modules is huge and irrelevant to pack
// (scripts are stripped, so no lifecycle install is needed), and a stale
// *.tgz or nested .cache would confuse pickTarball / bloat the copy.
const STAGING_SKIP = new Set(['node_modules', '.cache']);

function keepEntry(source: string): boolean {
  const name = basename(source);
  return !STAGING_SKIP.has(name) && !name.endsWith('.tgz');
}

/**
 * Pack `packageDir` publish-shape into `outTarball` (an absolute path). Uses
 * `stagingParent`/<pkg> — which MUST be inside the workspace — as a scratch
 * copy; the parent is created if absent and the per-package staging dir is
 * cleaned before and after.
 */
export async function packPublishTarball(
  packageName: string,
  packageDir: string,
  outTarball: string,
  stagingParent: string,
): Promise<void> {
  const staging = join(stagingParent, packageName);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  try {
    await cp(packageDir, staging, {
      recursive: true,
      filter: (source) => keepEntry(source),
    });

    // Strip the COPY's manifest, not the source's. pnpm's own reader preserves
    // the file's formatting, matching what an in-place strip would have packed.
    const { manifest, writeProjectManifest } =
      await readProjectManifest(staging);
    await writeProjectManifest(strippedManifest(manifest));

    await defaultStream('pnpm', ['pack', '--pack-destination', staging], {
      cwd: staging,
    });

    const packed = join(staging, pickTarball(await readdir(staging)));
    await mkdir(dirname(outTarball), { recursive: true });
    await rename(packed, outTarball);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

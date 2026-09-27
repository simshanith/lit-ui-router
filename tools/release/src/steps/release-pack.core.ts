// Pure logic for the publish Pack step: which manifest fields are stripped
// from the packed manifest, and which file in the pack destination is THE
// tarball. The IO (pnpm pack, the beforePacking hook) lives in pack-publish.ts.

import type { ProjectManifest } from '@pnpm/types';

/**
 * Dev-only metadata that must not reach the published manifest. Read by both
 * the strip below and the packed-manifest gate (findPackedManifestViolations).
 *
 * `pnpm pack` runs with lifecycle scripts ignored, so a prepack/prepare added
 * to `scripts` would be silently skipped — build via the turbo step.
 */
export const STRIPPED_MANIFEST_FIELDS = [
  'devDependencies',
  'scripts',
] as const satisfies readonly (keyof ProjectManifest)[];

/** A copy of `manifest` without {@link STRIPPED_MANIFEST_FIELDS}. */
export function strippedManifest(manifest: ProjectManifest): ProjectManifest {
  const stripped = { ...manifest };
  for (const field of STRIPPED_MANIFEST_FIELDS) {
    delete stripped[field];
  }
  return stripped;
}

/**
 * The single packed tarball among a directory's entries — anything other than
 * exactly one is a broken pack worth naming rather than silently mishandling.
 */
export function pickTarball(entries: readonly string[]): string {
  const tarballs = entries.filter((entry) => entry.endsWith('.tgz'));
  const [tarball] = tarballs;
  if (tarball === undefined || tarballs.length > 1) {
    throw new Error(
      `expected exactly one packed .tgz, found ${tarballs.length}` +
        (tarballs.length > 0 ? `: ${tarballs.join(', ')}` : ''),
    );
  }
  return tarball;
}

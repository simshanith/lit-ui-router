// Pure logic for the publish Pack step: which manifest fields are stripped
// before packing, and which file in the package directory is THE tarball.
// The IO (manifest read/write, pnpm pack, restore) lives in release-pack.ts.

import type { ProjectManifest } from '@pnpm/types';

/**
 * Dev-only metadata that must not reach the published manifest. Read by both
 * the strip below and the packed-manifest gate (findPackedManifestViolations).
 *
 * The strip runs before `pnpm pack`, so a lifecycle hook added to `scripts`
 * (prepack/prepare) would be silently skipped — build via the turbo step.
 */
export const STRIPPED_MANIFEST_FIELDS = ['devDependencies', 'scripts'] as const;

/** A copy of `manifest` without {@link STRIPPED_MANIFEST_FIELDS}. */
export function strippedManifest(manifest: ProjectManifest): ProjectManifest {
  const stripped = { ...manifest };
  for (const field of STRIPPED_MANIFEST_FIELDS) {
    delete stripped[field];
  }
  return stripped;
}

/**
 * The single packed tarball among a directory's entries. The old
 * `realpath "$PACKAGE_DIR"/*.tgz` glob silently mangled 0 or 2+ matches
 * into a broken TARBALL value; a CI checkout has exactly one, so anything
 * else is an error worth naming.
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

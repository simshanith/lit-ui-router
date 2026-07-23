// Pure logic for the publish Pack step: which manifest fields are stripped
// before packing, and which file in the package directory is THE tarball.
// The IO (reading and writing the manifest through @pnpm/read-project-manifest,
// running pnpm pack, restoring) lives in release-pack.ts, where the
// mutate→restore invariant the workflow used to encode as bash line order is a
// try/finally.

// Type-only, so this file stays runtime-pure.
import type { ProjectManifest } from '@pnpm/types';

/**
 * Dev-only metadata that leaks private workspace names and monorepo-only
 * commands into the published manifest. None of our scripts are lifecycle
 * hooks; stripping happens before `pnpm pack`, so a future prepack/prepare
 * script would be silently skipped — build via the turbo step instead.
 *
 * The strip below removes these, and the packed-manifest gate
 * (findPackedManifestViolations) fails the tarball when any of them survive.
 * Both read this one list, so the guard cannot drift from what it guards.
 */
export const STRIPPED_MANIFEST_FIELDS = ['devDependencies', 'scripts'] as const;

/**
 * The manifest with {@link STRIPPED_MANIFEST_FIELDS} removed (what `npm pkg
 * delete devDependencies scripts` did).
 *
 * Takes and returns the parsed manifest rather than JSON text: the caller
 * writes it back through pnpm's project-manifest writer, which reproduces the
 * file's own indentation instead of imposing this function's. Copies rather
 * than mutating — the caller holds the original across the pack and restores
 * from it.
 */
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

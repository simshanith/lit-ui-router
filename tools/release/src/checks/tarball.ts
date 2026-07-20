// Shared IO helper for checks that read a packed tarball's manifest. Kept
// out of the *.core.ts modules on purpose — those stay pure and
// unit-testable; this is the one pacote wrapper both consumers share
// (check-packed-manifest.ts and check-published-diff.ts).

import pacote from 'pacote';

// pacote.manifest on a file spec returns the archive's fields verbatim
// (probe-verified against pnpm-packed and npm-published tarballs) except:
// it drops any author underscore-prefixed field (npm reserves `_` for
// internal metadata) and injects exactly these fetch-metadata keys, which
// the helper strips back out.
const PACOTE_METADATA_FIELDS = ['_id', '_integrity', '_resolved', '_from'];

/**
 * The literal package/package.json fields of a packed tarball; rejects when
 * the archive is missing/unreadable OR the manifest is not a real package
 * manifest. pacote itself rejects unparsable/null/string manifests; the
 * name/version assertion closes the remaining gap (array/empty-object
 * manifests resolve to metadata-only, which downstream absence-checks would
 * silently pass — the old `: {}` fail-open).
 */
export async function tarballManifest(
  tarball: string,
): Promise<Record<string, unknown>> {
  const manifest = (await pacote.manifest(tarball)) as unknown as Record<
    string,
    unknown
  >;
  if (
    typeof manifest.name !== 'string' ||
    typeof manifest.version !== 'string'
  ) {
    throw new Error(
      `${tarball}: package/package.json is not a package manifest (no name/version)`,
    );
  }
  return Object.fromEntries(
    Object.entries(manifest).filter(
      ([key]) => !PACOTE_METADATA_FIELDS.includes(key),
    ),
  );
}

/** Fetch a registry spec's published tarball to `dest` (cacache-cached). */
export async function fetchTarball(spec: string, dest: string): Promise<void> {
  await pacote.tarball.file(spec, dest);
}

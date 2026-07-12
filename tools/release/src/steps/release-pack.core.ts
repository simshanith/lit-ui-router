// Pure logic for the publish Pack step: which manifest fields are stripped
// before packing, and which file in the package directory is THE tarball.
// The IO (writing the stripped manifest, running pnpm pack, restoring) lives
// in release-pack.ts, where the mutate→restore invariant the workflow used
// to encode as bash line order is a try/finally.

/**
 * The manifest with devDependencies and scripts removed (what `npm pkg
 * delete devDependencies scripts` did): dev-only metadata that leaks private
 * workspace names and monorepo-only commands into the published manifest.
 * None of our scripts are lifecycle hooks; stripping happens before
 * `pnpm pack`, so a future prepack/prepare script would be silently
 * skipped — build via the turbo step instead.
 */
export function strippedManifestJson(source: string): string {
  const manifest: unknown = JSON.parse(source);
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    Array.isArray(manifest)
  ) {
    throw new Error('package.json does not contain a JSON object');
  }
  const { devDependencies, scripts, ...rest } = manifest as Record<
    string,
    unknown
  >;
  void devDependencies;
  void scripts;
  return `${JSON.stringify(rest, null, 2)}\n`;
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

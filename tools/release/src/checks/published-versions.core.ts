// Pure logic for the published-versions manifest — the file that carries the
// resolved `latest` dist-tags from resolve-published.ts (registry IO) to
// check-published-diff.ts (cached turbo task). Rendering is canonical
// (bytewise-sorted keys, fixed indentation, trailing newline) so identical
// registry state always produces identical bytes — the file is a cache key.

/** Package name → `latest` version, or null when never published. */
export type PublishedVersions = Record<string, string | null>;

/** Canonical manifest text: bytewise-sorted keys, 2-space indent, final newline. */
export function renderManifest(versions: PublishedVersions): string {
  const sorted = Object.fromEntries(
    Object.entries(versions).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

/** Parse and validate manifest text; throws on any shape drift. */
export function parseManifest(text: string): PublishedVersions {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('published-versions.json is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      'published-versions.json must be an object of package name → version',
    );
  }
  for (const [name, version] of Object.entries(parsed)) {
    if (version !== null && typeof version !== 'string') {
      throw new Error(
        `published-versions.json: "${name}" must map to a version string or null`,
      );
    }
  }
  return parsed as PublishedVersions;
}

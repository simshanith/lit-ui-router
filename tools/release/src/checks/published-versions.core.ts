// Pure logic for the published-versions manifest — the file that carries the
// resolved dist-tag maps from resolve-published.ts (registry IO) to
// check-published-diff.ts (cached turbo task). Rendering is canonical
// (bytewise-sorted keys at both levels, fixed indentation, trailing newline) so
// identical registry state always produces identical bytes — the file is a
// cache key, and the registry's own key order is nondeterministic.

/** Package name → its dist-tags (`{}` when never published). */
export type PublishedVersions = Record<string, Record<string, string>>;

function sortKeys<T>(entries: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(entries).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

/** Canonical manifest text: bytewise-sorted keys, 2-space indent, final newline. */
export function renderManifest(versions: PublishedVersions): string {
  const sorted = sortKeys(
    Object.fromEntries(
      Object.entries(versions).map(([name, tags]) => [name, sortKeys(tags)]),
    ),
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
      'published-versions.json must be an object of package name → dist-tags',
    );
  }
  for (const [name, tags] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (typeof tags !== 'object' || tags === null || Array.isArray(tags)) {
      throw new Error(
        `published-versions.json: "${name}" must map to a dist-tag object`,
      );
    }
    for (const [tag, version] of Object.entries(
      tags as Record<string, unknown>,
    )) {
      if (typeof version !== 'string') {
        throw new Error(
          `published-versions.json: "${name}" dist-tag "${tag}" must map to a version string`,
        );
      }
    }
  }
  return parsed as PublishedVersions;
}

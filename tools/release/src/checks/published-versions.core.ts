// Pure logic for the published-versions manifest — the file that carries the
// resolved dist-tag maps from resolve-published.ts (registry IO) to
// check-published-diff.ts (cached turbo task). Rendering is canonical
// (bytewise-sorted keys at both levels, fixed indentation, trailing newline) so
// identical registry state always produces identical bytes — the file is a
// cache key, and the registry's own key order is nondeterministic.

import * as v from 'valibot';

/** Package name → its dist-tags (`{}` when never published). */
export type PublishedVersions = Record<string, Record<string, string>>;

/** A JSON object of `entry` values; `v.record` alone also admits arrays. */
const objectOf = <TEntry extends v.GenericSchema>(entry: TEntry) =>
  v.pipe(
    v.unknown(),
    v.check((input) => !Array.isArray(input)),
    v.record(v.string(), entry),
  );

const PublishedVersionsSchema = objectOf(objectOf(v.string()));

function sortKeys<T>(entries: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(entries).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

/** Canonical manifest text: bytewise-sorted keys, 2-space indent, final newline. */
export function renderManifest(versions: PublishedVersions): string {
  const sorted = Object.fromEntries(
    Object.entries(sortKeys(versions)).map(([name, tags]) => [
      name,
      sortKeys(tags),
    ]),
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

  const result = v.safeParse(PublishedVersionsSchema, parsed);

  if (result.success) return result.output;

  // The first issue's path names how deep the drift sits: the root, a package, or one of its dist-tags.
  const [name, tag] = (result.issues[0].path ?? []).map((item) =>
    String(item.key),
  );

  if (name === undefined) {
    throw new Error(
      'published-versions.json must be an object of package name → dist-tags',
    );
  }

  if (tag === undefined) {
    throw new Error(
      `published-versions.json: "${name}" must map to a dist-tag object`,
    );
  }

  throw new Error(
    `published-versions.json: "${name}" dist-tag "${tag}" must map to a version string`,
  );
}

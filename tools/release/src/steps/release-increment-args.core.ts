// Pure logic for turning bump-version.yml's `increment`/`other` inputs into
// release-it argv. Replaces the workflow's inline if/else that built a flag
// string in GITHUB_ENV and later re-split it with `read -a` — a round-trip
// that word-split the free-text `other` input into arbitrary release-it
// flags. The IO (printing argv for the workflow) lives in
// release-increment-args.ts.

// Official semver.org version pattern (no leading `v`), anchored.
const SEMVER_VERSION =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

// The workflow's choice list already offers major/minor/patch, so `other`
// only ever carries what the list can't express: an exact version literal
// (the historical use — alpha prereleases like 1.0.3-alpha.0) or a semver
// pre-increment keyword. Anything else — in particular anything with
// whitespace or a leading dash — is rejected instead of word-split into argv.
const PRE_INCREMENT_KEYWORDS = new Set([
  'premajor',
  'preminor',
  'prepatch',
  'prerelease',
]);

function validatedOther(other: string): string {
  // The old word-splitting trimmed surrounding whitespace; keep that.
  const value = other.trim();
  if (SEMVER_VERSION.test(value) || PRE_INCREMENT_KEYWORDS.has(value)) {
    return value;
  }
  throw new Error(
    `invalid 'other' increment ${JSON.stringify(other)}: expected an exact ` +
      `semver version (e.g. 1.2.3-alpha.0) or one of ` +
      `premajor|preminor|prepatch|prerelease`,
  );
}

/**
 * The release-it args for a bump-version run:
 * - major/minor/patch → `--increment <value>`
 * - other → `--increment <other>` (validated custom version / pre-keyword)
 * - none → no args, unless `other` is provided — then `other` is passed as
 *   release-it's POSITIONAL increment, preserving the workflow's historical
 *   `none`+`other` behavior (equivalent to `--increment`, but pinned as-is)
 */
export function incrementArgs(increment: string, other: string): string[] {
  switch (increment) {
    case 'major':
    case 'minor':
    case 'patch':
      return ['--increment', increment];
    case 'other':
      return ['--increment', validatedOther(other)];
    case 'none':
      return other.trim() === '' ? [] : [validatedOther(other)];
    default:
      // Unreachable from the workflow (choice input), so fail loudly rather
      // than pass an unknown value through to release-it.
      throw new Error(
        `unknown increment ${JSON.stringify(increment)}: expected ` +
          `major|minor|patch|other|none`,
      );
  }
}

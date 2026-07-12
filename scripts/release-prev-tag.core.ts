// Pure logic for the previous-release-tag lookup the publish workflow uses to
// pin the conventional-changelog commit range (#302): release-it's own
// secondLatestTag is computed repo-wide, so in this monorepo the range can
// start at ANOTHER package's newer tag and come up empty. The IO (running
// `git describe`) lives in release-prev-tag.ts.

/**
 * `git describe` args selecting the nearest tag of THIS package while
 * skipping the tag being released (re-runs of a publish already have it).
 *
 * The `--match` glob is anchored by the literal `@`, so `lit-ui-router@*`
 * cannot match `lit-ui-router-mobx@…` tags. Prerelease tags match too — a
 * `pkg@1.1.0-canary.0` between releases becomes the range start, which is
 * the intended behavior: commits already summarized in a canary's notes are
 * not repeated in the next stable's.
 */
export function describeArgs(
  packageName: string,
  releaseVersion: string,
): string[] {
  if (packageName.trim() === '') {
    throw new Error('packageName must be non-empty');
  }
  if (releaseVersion.trim() === '') {
    throw new Error('releaseVersion must be non-empty');
  }
  return [
    'describe',
    '--tags',
    `--match=${packageName}@*`,
    `--exclude=${packageName}@${releaseVersion}`,
    '--abbrev=0',
  ];
}

/** The previous tag from `git describe` stdout; empty output → no override. */
export function parsePrevTag(stdout: string): string | undefined {
  const tag = stdout.trim();
  return tag === '' ? undefined : tag;
}

/**
 * Whether a failed `git describe` just means "no previous release" — no tags
 * at all, or none surviving the match/exclude filters. Anything else is a
 * genuine git error worth surfacing on stderr.
 */
export function isFirstReleaseError(stderr: string): boolean {
  return /No names found|No tags can describe|No annotated tags can describe/i.test(
    stderr,
  );
}

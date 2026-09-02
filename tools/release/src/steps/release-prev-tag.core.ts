// Pure logic for the previous-release-tag lookup the publish workflow uses to
// pin the conventional-changelog commit range (#302): release-it's own
// secondLatestTag is computed repo-wide, so in this monorepo the range can
// start at ANOTHER package's newer tag and come up empty. The IO (running
// `git tag` and `git describe`) lives in release-prev-tag.ts.

import semver from 'semver';

/**
 * `git describe` args selecting the nearest tag of THIS package while
 * skipping the tag being released (re-runs of a publish already have it).
 *
 * The `--match` glob is anchored by the literal `@`, so `lit-ui-router@*`
 * cannot match `lit-ui-router-mobx@…` tags.
 *
 * Prereleases stay in their own lane: `beta.1` ranges from `beta.0`, never
 * from an alpha or an rc, so every other channel the package has tagged
 * (`otherChannels`, from `prereleaseChannels`) is excluded. A channel's
 * first tag falls through to the last stable and rolls up the lanes before
 * it. A stable release excludes every prerelease tag, so its notes roll up
 * everything since the last stable: rcs preview feature sets, and the
 * major/minor/patch lists them all.
 */
export function describeArgs(
  packageName: string,
  releaseVersion: string,
  otherChannels: readonly string[] = [],
): string[] {
  if (packageName.trim() === '') {
    throw new Error('packageName must be non-empty');
  }
  if (releaseVersion.trim() === '') {
    throw new Error('releaseVersion must be non-empty');
  }
  const laneExcludes =
    prereleaseChannel(releaseVersion) === undefined
      ? [`--exclude=${packageName}@*-*`]
      : otherChannels.flatMap((channel) => [
          `--exclude=${packageName}@*-${channel}`,
          `--exclude=${packageName}@*-${channel}.*`,
        ]);
  return [
    'describe',
    '--tags',
    `--match=${packageName}@*`,
    `--exclude=${packageName}@${releaseVersion}`,
    ...laneExcludes,
    '--abbrev=0',
  ];
}

/** Whether the version carries a semver prerelease (`1.0.0-rc.0`). */
export function isPrerelease(version: string): boolean {
  return prereleaseChannel(version) !== undefined;
}

/**
 * The prerelease channel of a version: its first prerelease identifier, so
 * `1.0.0-rc.0` → `rc`, `1.0.0-beta` → `beta`, `1.0.0-1` → `1`. Undefined
 * for a stable version or anything semver cannot parse.
 */
export function prereleaseChannel(version: string): string | undefined {
  const [first] = semver.prerelease(version.trim()) ?? [];
  return first === undefined ? undefined : String(first);
}

/**
 * The distinct prerelease channels among a package's tags (`git tag -l
 * '<pkg>@*'` stdout), in first-seen order. Tags of other packages, and tags
 * whose version part is not semver, are ignored.
 */
export function prereleaseChannels(
  packageName: string,
  tagList: string,
): string[] {
  const prefix = `${packageName}@`;
  const channels = new Set<string>();
  for (const line of tagList.split('\n')) {
    const tag = line.trim();
    if (!tag.startsWith(prefix)) continue;
    const channel = prereleaseChannel(tag.slice(prefix.length));
    if (channel !== undefined) channels.add(channel);
  }
  return [...channels];
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

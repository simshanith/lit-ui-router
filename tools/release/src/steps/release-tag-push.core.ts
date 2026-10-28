// Pure logic for pushing a package's release tag — the tag-name composition
// and argv of publish-gh.yml's Push tag step. Only the tag REF is ever
// pushed: a stale local main can't reject the push, and an already-pushed
// tag is "Everything up-to-date". The IO (reading the manifest version,
// running git) lives in release-tag-push.ts.

/** `<package>@<version>` — the repo's release tag convention. */
export function releaseTagName(packageName: string, version: string): string {
  if (packageName.trim() === '') {
    throw new Error('packageName must be non-empty');
  }

  // The version comes from the package manifest; anything unversioned (or a
  // manifest field of the wrong shape) must not compose a half-formed ref.
  if (version.trim() === '' || /\s/.test(version)) {
    throw new Error(
      `invalid version ${JSON.stringify(version)} for ${packageName}`,
    );
  }

  return `${packageName}@${version}`;
}

/** argv pushing exactly the tag ref, verbatim from the workflow. */
export function pushTagArgs(tagName: string): string[] {
  return ['push', 'origin', `refs/tags/${tagName}`];
}

/**
 * The job-summary line for a pushed (or dry-run) tag; links the tag page
 * when the run's repository URL is known.
 */
export function tagPushSummary(
  tagName: string,
  dryRun: boolean,
  repoUrl?: string,
): string {
  const ref = `\`${tagName}\``;

  const label =
    repoUrl === undefined
      ? ref
      : `[${ref}](${repoUrl}/releases/tag/${encodeURIComponent(tagName)})`;

  return dryRun ? `🏷️ dry-run: would push ${label}\n` : `🏷️ pushed ${label}\n`;
}

// Pure logic for the bump-version driver: branch naming and the release
// commit message. The orchestration (release-it, git, gh) lives in
// release-bump.ts.

/**
 * The release branch prefix: the workflow input when provided, otherwise
 * derived as `release/{package}/v` — verbatim from bump-version.yml's
 * "Set branch prefix" step.
 */
export function branchPrefix(
  input: string | undefined,
  packageName: string,
): string {
  const trimmed = input?.trim() ?? '';
  if (trimmed !== '') return trimmed;
  if (packageName.trim() === '') {
    throw new Error('packageName must be non-empty');
  }
  return `release/${packageName}/v`;
}

/**
 * The release commit message: `Release <version>`, a blank line, then the
 * captured `release-it --changelog` output — the shape the old
 * `commit:changelog` package scripts echoed. An empty changelog still
 * yields the bare `Release <version>` (the shape #733 shipped with) plus a
 * warning for the driver to surface, since it usually means the range pin
 * is wrong rather than that nothing shipped.
 */
export function releaseCommitMessage(
  version: string,
  changelog: string,
  from?: string,
): { message: string; warning?: string } {
  if (version.trim() === '') throw new Error('version must be non-empty');
  const body = changelog.trim();
  if (body === '') {
    const range = from === undefined ? '' : ` (${from}..HEAD)`;
    return {
      message: `Release ${version}`,
      warning:
        `empty changelog for ${version}${range}: no changelog-worthy ` +
        'commits under this package since the range start; check the range pin',
    };
  }
  return { message: `Release ${version}\n\n${body}` };
}

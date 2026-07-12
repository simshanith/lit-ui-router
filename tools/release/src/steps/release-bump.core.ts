// Pure logic for the bump-version driver: branch naming and the commit
// message capture. The orchestration (release-it, git, gh) lives in
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
 * The commit message as bash `$(pnpm --silent … commit:changelog)` captured
 * it: trailing newlines stripped, everything else (including the blank line
 * between subject and changelog body) preserved.
 */
export function commitMessageFromScript(stdout: string): string {
  const message = stdout.replace(/\n+$/, '');
  if (message.trim() === '') {
    throw new Error('commit:changelog printed an empty commit message');
  }
  return message;
}

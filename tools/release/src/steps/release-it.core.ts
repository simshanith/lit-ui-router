// The engine seam: every release-it invocation the pipeline performs is
// built here, and ONLY here — no release-it flags in mise task definitions
// or workflow YAML — so swapping the engine (or one flag) is a one-module
// change. Argv values are verbatim ports of the workflows' bash lines;
// deviations are called out inline.

/** `--release-version` plus the increment argv (see release-increment-args.core.ts). */
export function releaseVersionArgs(incrementArgs: readonly string[]): string[] {
  return ['--release-version', ...incrementArgs];
}

/** `--release-version --no-increment`: the checked-out version, no bump. */
export function currentReleaseVersionArgs(): string[] {
  return ['--release-version', '--no-increment'];
}

/**
 * publish-gh.yml Tag step: tag the current version locally only.
 * `--git.push false` because pushing main + tag together is release-it's
 * rollback trap; the tag ref is pushed separately (release-tag-push.ts).
 */
export function tagArgs(dryRun: boolean): string[] {
  return [
    '--no-increment',
    '--git.tag',
    'true',
    '--git.push',
    'false',
    ...(dryRun ? ['--dry-run'] : []),
  ];
}

/**
 * bump-version.yml Bump version step: set the exact computed version,
 * commit, and push the release branch. `--dry-run` makes release-it log
 * every git/github/npm write instead of performing it.
 */
export function bumpArgs(options: {
  version: string;
  commitMessage: string;
  dryRun: boolean;
}): string[] {
  const { version, commitMessage, dryRun } = options;
  if (version.trim() === '') throw new Error('version must be non-empty');
  return [
    ...(dryRun ? ['--dry-run'] : []),
    '--increment',
    version,
    '--git.commit',
    'true',
    '--git.push',
    'true',
    '--git.commitMessage',
    commitMessage,
  ];
}

/**
 * publish-npm.yml Publish step, verbatim:
 * - `--npm.skipChecks`: OIDC trusted publishing, no token to check
 * - `--npm.publishPath`: publish the pnpm-packed (and attested) tarball; a
 *   bare `npm publish` re-packs from source and ships raw catalog:/workspace:
 *   refs npm can't resolve (broke 1.3.0–1.5.0)
 * - `--github.assets`: the explicit tarball path; release-it globs assets
 *   relative to the package dir, which stopped holding the tarball in #449
 * - `--git.tagExclude '${npm.name}@<version>'`: literal release-it template,
 *   never shell-expanded here
 * - `gitRawCommitsOpts.from=<from>`: pins the conventional-changelog range
 *   to THIS package's previous tag, or the repo root on a first release
 *   (#302, release-prev-tag.ts)
 */
export function publishArgs(options: {
  releaseVersion: string;
  tarballPath: string;
  from: string;
  dryRun: boolean;
}): string[] {
  const { releaseVersion, tarballPath, from, dryRun } = options;
  if (releaseVersion.trim() === '') {
    throw new Error('releaseVersion must be non-empty');
  }
  if (tarballPath.trim() === '') {
    throw new Error('tarballPath must be non-empty');
  }
  return [
    '--no-increment',
    '--npm.publish',
    'true',
    '--npm.skipChecks',
    'true',
    '--npm.publishPath',
    tarballPath,
    '--github.release',
    'true',
    '--github.assets',
    tarballPath,
    '--git.tagExclude',
    `\${npm.name}@${releaseVersion}`,
    changelogFromArg(from),
    ...(dryRun ? ['--dry-run'] : []),
  ];
}

/**
 * The bump driver's changelog capture — what the packages' `changelog`
 * script runs, plus the same range pin the publish argv carries. The
 * package's own tag glob keeps release-it's latest-tag context (and its
 * flat-log fallback, #423) off other packages' tags; the pin is what sets
 * the range, since that glob still matches the package's prerelease tags.
 */
export function changelogArgs(options: {
  packageName: string;
  from: string;
}): string[] {
  const { packageName, from } = options;
  if (packageName.trim() === '') {
    throw new Error('packageName must be non-empty');
  }
  return [
    '--changelog',
    `--git.tagMatch=${packageName}@[0-9]*.[0-9]*.[0-9]*`,
    changelogFromArg(from),
  ];
}

function changelogFromArg(from: string): string {
  if (from.trim() === '') throw new Error('from must be non-empty');
  return `--plugins.@release-it/conventional-changelog.gitRawCommitsOpts.from=${from}`;
}

/**
 * The version `release-it --release-version` printed. The old workflows
 * captured whole stdout into GITHUB_ENV unchecked; a multi-line or empty
 * capture became a garbage branch/tag name downstream, so this fails loudly
 * instead.
 */
export function parseReleaseVersion(stdout: string): string {
  const version = stdout.trim();
  if (version === '' || /\s/.test(version)) {
    throw new Error(
      `release-it --release-version printed ${JSON.stringify(stdout)}; expected a single version`,
    );
  }
  return version;
}

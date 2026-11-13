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

/** One shell word; release-it renders hook and notes commands as `${…}` templates first, so that sequence is refused. */
export function shellWord(value: string): string {
  if (value.includes('${')) {
    throw new Error(
      `${JSON.stringify(value)} would be read as a release-it template`,
    );
  }

  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** Where a release's notes live and the @tools/changelog CLI that reads or writes them. */
export interface NotesFile {
  /** Absolute path of the package's CHANGELOG.md. */
  changelog: string;
  /** Absolute path of the @tools/changelog CLI script. */
  script: string;
}

/** The after:bump command that adds `version`'s section, its body read from `notesPath`. */
export function writeSectionCommand(options: {
  notes: NotesFile;
  packageName: string;
  version: string;
  notesPath: string;
}): string {
  const { notes, packageName, version, notesPath } = options;

  return [
    'node',
    shellWord(notes.script),
    '--file',
    shellWord(notes.changelog),
    '--package',
    shellWord(packageName),
    '--version',
    shellWord(version),
    '--notes',
    shellWord(notesPath),
  ].join(' ');
}

/** The `github.releaseNotes` command: its stdout, `version`'s section body, becomes the GitHub release body. */
export function releaseNotesCommand(options: {
  notes: NotesFile;
  version: string;
}): string {
  const { notes, version } = options;

  return [
    'node',
    shellWord(notes.script),
    '--file',
    shellWord(notes.changelog),
    '--version',
    shellWord(version),
  ].join(' ');
}

// only --fix-lockfile unlinks a floor alias pnpm linked while the workspace sat at its version
function bumpHook(
  packageName: string,
  section: Parameters<typeof writeSectionCommand>[0] | undefined,
): string {
  const lockfile = '":(top)pnpm-lock.yaml"';

  return (
    'pnpm install --lockfile-only --fix-lockfile && ' +
    `mise run //tools/release:dependent_floor_gate --package '${packageName}' && ` +
    (section === undefined
      ? `git add ${lockfile}`
      : `${writeSectionCommand(section)} && git add ${lockfile} ${shellWord(section.notes.changelog)}`)
  );
}

/**
 * bump-version.yml Bump version step: set the exact computed version,
 * re-resolve pnpm-lock.yaml against it, fail when a dependent's floor stops
 * proving its range (release-dependent-floor-gate.ts), add a stable version's
 * CHANGELOG.md section from the captured notes (`section`; a prerelease has
 * none), commit, and push the release branch. `--dry-run` makes release-it log every git/github/npm
 * write (and the hook) instead of performing it.
 */
// release-it requires a clean tree at start, so the section is written by the hook inside the run.
export function bumpArgs(options: {
  packageName: string;
  version: string;
  commitMessage: string;
  section?: { notes: NotesFile; notesPath: string };
  dryRun: boolean;
}): string[] {
  const { packageName, version, commitMessage, section, dryRun } = options;

  if (!/^[\w@/.-]+$/.test(packageName)) {
    throw new Error(
      `packageName ${JSON.stringify(packageName)} is not a package name`,
    );
  }

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
    '--hooks.after:bump',
    bumpHook(packageName, section && { ...section, packageName, version }),
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
 * - `context.releaseVersion` / `context.previousVersion`: the same values the
 *   bump passed, so the plugin's own (unpublished) changelog stays pinned
 * - `--github.releaseNotes`: a stable release's body is the stdout of
 *   `releaseNotes`, the version's CHANGELOG.md section (releaseNotesCommand);
 *   release-it skips running it under `--dry-run`. A prerelease passes none,
 *   so its body is the pinned changelog release-it generates.
 */
export function publishArgs(options: {
  releaseVersion: string;
  tarballPath: string;
  from: string;
  previousVersion: string;
  releaseNotes?: string;
  dryRun: boolean;
}): string[] {
  const {
    releaseVersion,
    tarballPath,
    from,
    previousVersion,
    releaseNotes,
    dryRun,
  } = options;

  if (releaseVersion.trim() === '') {
    throw new Error('releaseVersion must be non-empty');
  }

  if (tarballPath.trim() === '') {
    throw new Error('tarballPath must be non-empty');
  }

  if (releaseNotes?.trim() === '') {
    throw new Error('releaseNotes must be non-empty when passed');
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
    ...(releaseNotes === undefined
      ? []
      : ['--github.releaseNotes', releaseNotes]),
    '--git.tagExclude',
    `\${npm.name}@${releaseVersion}`,
    changelogFromArg(from),
    ...notesContextArgs(releaseVersion, previousVersion),
    ...(dryRun ? ['--dry-run'] : []),
  ];
}

/**
 * The bump driver's notes capture, which becomes a stable version's
 * CHANGELOG.md section — what the packages' `changelog` script runs, plus the
 * range pin and notes context. The
 * package's own tag glob keeps release-it's latest-tag context (and its
 * flat-log fallback, #423) off other packages' tags; the pin is what sets
 * the range, since that glob still matches the package's prerelease tags.
 */
export function changelogArgs(options: {
  packageName: string;
  version: string;
  from: string;
  previousVersion: string;
}): string[] {
  const { packageName, version, from, previousVersion } = options;

  if (packageName.trim() === '') {
    throw new Error('packageName must be non-empty');
  }

  return [
    '--changelog',
    `--git.tagMatch=${packageName}@[0-9]*.[0-9]*.[0-9]*`,
    changelogFromArg(from),
    ...notesContextArgs(version, previousVersion),
  ];
}

// The writer reads both from its context (@tools/release-config notes.ts); an empty previousVersion is a first release.
function notesContextArgs(version: string, previousVersion: string): string[] {
  if (version.trim() === '') throw new Error('version must be non-empty');

  return [
    `--plugins.@release-it/conventional-changelog.context.releaseVersion=${version}`,
    `--plugins.@release-it/conventional-changelog.context.previousVersion=${previousVersion}`,
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

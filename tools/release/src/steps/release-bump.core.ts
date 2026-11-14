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

/** A release commit message, and a warning for the driver to surface. */
export interface ReleaseCommitMessage {
  message: string;
  warning?: string;
}

/** The trailer naming the commit a release's notes were generated at. */
export const NOTES_THROUGH = 'Notes-Through';

/** Where a stable release's notes went: its CHANGELOG.md section, generated at `notesThrough`. */
export interface NotesSection {
  changelogPath: string;
  notesThrough: string;
}

function messageLines(
  version: string,
  body: string,
  section: NotesSection | undefined,
): string[] {
  if (section === undefined) return body === '' ? [] : [body];

  const { changelogPath, notesThrough } = section;

  if (!/^[0-9a-f]{40}$/.test(notesThrough)) {
    throw new Error(
      `notesThrough ${JSON.stringify(notesThrough)} is not a full commit sha`,
    );
  }

  return [
    `Release notes: the ${version} section of ${changelogPath}.`,
    `${NOTES_THROUGH}: ${notesThrough}`,
  ];
}

/**
 * The release commit message, which is also the release PR's title and body.
 * A stable release's (`section` set) is `Release <version>`, a line naming the
 * CHANGELOG.md section that holds the notes, and a `Notes-Through: <sha>`
 * trailer naming the commit the notes were generated at. A prerelease has no
 * section, so its message carries the captured notes, as every release's did
 * before. An empty changelog adds a warning for the driver to surface, since
 * it usually means the range pin is wrong rather than that nothing shipped.
 */
export function releaseCommitMessage(options: {
  version: string;
  changelog: string;
  section?: NotesSection;
  from?: string;
}): ReleaseCommitMessage {
  const { version, changelog, section, from } = options;

  if (version.trim() === '') throw new Error('version must be non-empty');

  const body = changelog.trim();

  const message = [
    `Release ${version}`,
    ...messageLines(version, body, section),
  ].join('\n\n');

  if (body !== '') return { message };

  const range = from === undefined ? '' : ` (${from}..HEAD)`;

  return {
    message,
    warning:
      `empty changelog for ${version}${range}: no changelog-worthy ` +
      'commits under this package since the range start; check the range pin',
  };
}

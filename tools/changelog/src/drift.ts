// Drift between each CHANGELOG.md and the release notes GitHub published, as
// the release ledger stored them.
import semver from 'semver';

import { parseChangelog, type Section } from './changelog.ts';

/** The ledger columns the drift check reads; `gh_body` is null until a GitHub release is recorded. */
export interface PublishedNotes {
  readonly name: string;
  readonly version: string;
  readonly gh_body: string | null | undefined;
}

/** A published package and its CHANGELOG.md text, `undefined` when there is no file. */
export interface ChangelogFile {
  readonly name: string;
  readonly text: string | undefined;
}

/** `action` is drift; `info` is a section the release PR wrote ahead of its publish. */
export interface DriftFinding {
  readonly release: string;
  readonly level: 'action' | 'info';
  readonly message: string;
}

/** Whether a section body and a published body say the same, trailing whitespace aside. */
export function sameNotes(section: string, published: string): boolean {
  return section.trimEnd() === published.trimEnd();
}

const isStable = (version: string): boolean =>
  semver.valid(version) === version && semver.prerelease(version) === null;

/** Stable releases with a stored body, by version. */
function publishedOf(
  name: string,
  rows: readonly PublishedNotes[],
): Map<string, string> {
  const published = new Map<string, string>();

  for (const row of rows) {
    if (row.name !== name || !isStable(row.version)) continue;

    if (row.gh_body != null) published.set(row.version, row.gh_body);
  }

  return published;
}

/** The newest section, when it is newer than every published release: a merged release PR not yet published. */
function aheadOf(
  sections: readonly Section[],
  published: ReadonlyMap<string, string>,
): string | undefined {
  const newest = sections[0]?.version;

  if (newest === undefined || !isStable(newest)) return undefined;

  return [...published.keys()].every((version) => semver.gt(newest, version))
    ? newest
    : undefined;
}

function sectionFindings(
  name: string,
  sections: readonly Section[],
  published: ReadonlyMap<string, string>,
): DriftFinding[] {
  const ahead = aheadOf(sections, published);

  return sections.flatMap(({ version, body }): DriftFinding[] => {
    const release = `${name}@${version}`;
    const notes = published.get(version);

    if (notes !== undefined) {
      return sameNotes(body, notes)
        ? []
        : [
            {
              release,
              level: 'action',
              message: 'the section differs from the published notes',
            },
          ];
    }

    return [
      version === ahead
        ? {
            release,
            level: 'info',
            message: 'a section ahead of its GitHub release',
          }
        : {
            release,
            level: 'action',
            message: 'a section with no published GitHub release',
          },
    ];
  });
}

function packageFindings(
  file: ChangelogFile,
  rows: readonly PublishedNotes[],
): DriftFinding[] {
  const published = publishedOf(file.name, rows);
  const sections = parseChangelog(file.text ?? '').sections;
  const present = new Set(sections.map(({ version }) => version));

  const missing = [...published.keys()]
    .filter((version) => !present.has(version))
    .sort(semver.rcompare)
    .map((version): DriftFinding => ({
      release: `${file.name}@${version}`,
      level: 'action',
      message:
        file.text === undefined
          ? 'no CHANGELOG.md for a published release'
          : 'no section for a published release',
    }));

  return [...missing, ...sectionFindings(file.name, sections, published)];
}

/** Every file's drift from the ledger's stored notes, `action` first; a package with no file and no published release has none. */
export function changelogDrift(
  files: readonly ChangelogFile[],
  rows: readonly PublishedNotes[],
): DriftFinding[] {
  const findings = files.flatMap((file) => packageFindings(file, rows));

  return [
    ...findings.filter(({ level }) => level === 'action'),
    ...findings.filter(({ level }) => level === 'info'),
  ];
}

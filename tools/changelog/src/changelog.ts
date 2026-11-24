// A package's CHANGELOG.md: a fixed preamble, then one `## <version> (<date>)`
// section per stable release, newest first.
import semver from 'semver';

/** One `## ` section: its heading line without the marker, and the body under it. */
export interface Section {
  /** The heading's first token, the version the docs site anchors on. */
  readonly version: string;
  /** The heading text after `## `, version included. */
  readonly heading: string;
  /** Everything under the heading up to the next `## `, without the marker or surrounding blank lines. */
  readonly body: string;
  /** The full sha the section's notes-through marker names, when it has one. */
  readonly notesThrough?: string;
}

/** A changelog split at its `## ` headings. */
export interface Changelog {
  /** Everything before the first `## ` heading. */
  readonly preamble: string;
  readonly sections: readonly Section[];
}

const SITE_URL = 'https://lit-ui-router.dev';

/** The preamble every writer emits, so backfill and later writers agree byte for byte. */
export function preamble(packageName: string): string {
  const releases = `${SITE_URL}/releases/${encodeURIComponent(packageName)}/`;

  return [
    '# Changelog',
    '',
    `Prereleases and canaries are not listed here; see [all releases](${releases}).`,
  ].join('\n');
}

/** `## <version> (<YYYY-MM-DD>)`, without the marker; the date is the UTC day of `publishedAt`. */
export function sectionHeading(version: string, publishedAt: string): string {
  return `${version} (${new Date(publishedAt).toISOString().slice(0, 10)})`;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Calls `visit` with each line and whether it sits inside a fenced code block. */
export function eachLine(
  text: string,
  visit: (line: string, fenced: boolean) => void,
): void {
  let fence: string | undefined;

  for (const line of text.split('\n')) {
    const open = FENCE.exec(line)?.[1];

    if (fence === undefined && open !== undefined) {
      fence = open;
      visit(line, true);
    } else if (fence !== undefined) {
      visit(line, true);

      if (
        open !== undefined &&
        open.startsWith(fence.charAt(0)) &&
        open.length >= fence.length
      )
        fence = undefined;
    } else {
      visit(line, false);
    }
  }
}

/** Drops blank lines at both ends, leaving the lines between untouched. */
function trimBlankLines(text: string): string {
  return text.replace(/^(?:[ \t]*\n)+/, '').replace(/(?:\n[ \t]*)+$/, '');
}

const NOTES_THROUGH = /^<!-- notes-through: ([0-9a-f]{40}) -->[ \t]*(?:\n|$)/;

/** The line a section opens with to name the commit its notes were generated at. */
export function notesThroughMarker(sha: string): string {
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error(`${JSON.stringify(sha)} is not a full commit sha`);
  }

  return `<!-- notes-through: ${sha} -->`;
}

function toSection(heading: string, lines: readonly string[]): Section {
  const text = trimBlankLines(lines.join('\n'));
  const marker = NOTES_THROUGH.exec(text);

  const version = heading.split(/\s/, 1)[0] ?? '';

  if (marker === null) return { version, heading, body: text };

  return {
    version,
    heading,
    body: trimBlankLines(text.slice(marker[0].length)),
    notesThrough: marker[1],
  };
}

/** A section's text: its heading, then its marker and body, each block apart. */
function renderSection(section: Section): string {
  return [
    `## ${section.heading}`,
    ...(section.notesThrough === undefined
      ? []
      : [notesThroughMarker(section.notesThrough)]),
    ...(section.body === '' ? [] : [section.body]),
  ].join('\n\n');
}

/** Splits a changelog at its `## ` headings; a `## ` inside a code fence is body text. */
export function parseChangelog(text: string): Changelog {
  const preambleLines: string[] = [];
  const sections: Section[] = [];
  let current: { heading: string; lines: string[] } | undefined;

  eachLine(text.replace(/\r\n/g, '\n'), (line, fenced) => {
    if (!fenced && line.startsWith('## ')) {
      if (current) sections.push(toSection(current.heading, current.lines));

      current = { heading: line.slice(3).trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preambleLines.push(line);
    }
  });

  if (current) sections.push(toSection(current.heading, current.lines));

  return { preamble: trimBlankLines(preambleLines.join('\n')), sections };
}

/** One version's section, or `undefined` when the changelog has none. */
export function findSection(
  text: string,
  version: string,
): Section | undefined {
  return parseChangelog(text).sections.find(
    (section) => section.version === version,
  );
}

/** One version's section body without its marker, or `undefined` when the changelog has no section for it. */
export function extractSection(
  text: string,
  version: string,
): string | undefined {
  return findSection(text, version)?.body;
}

/** The heading the release tooling writes above a version's breaking changes. */
export const BREAKING_HEADING = '⚠ BREAKING CHANGES';

const BREAKING_LINE = new RegExp(
  `^ {0,3}#{1,6}[ \\t]+${BREAKING_HEADING}[ \\t]*$`,
);

/** Whether a section body carries the breaking-change heading; one inside a code fence is body text. */
export function hasBreakingChanges(body: string): boolean {
  let found = false;

  eachLine(body.replace(/\r\n/g, '\n'), (line, fenced) => {
    found ||= !fenced && BREAKING_LINE.test(line);
  });

  return found;
}

/** Newest first by semver; a heading whose first token is not a version sorts last. */
function compareSections(a: Section, b: Section): number {
  const va = semver.valid(a.version);
  const vb = semver.valid(b.version);

  if (va && vb) return semver.rcompare(va, vb);

  return Number(va === null) - Number(vb === null);
}

/** A merge's result: the changelog, and the sections it gained. */
export interface Merged {
  readonly changelog: Changelog;
  readonly added: readonly Section[];
}

/** The sections `changelog` lacks, added; a version already present is never rewritten. */
export function mergeSections(
  changelog: Changelog,
  additions: readonly Section[],
): Merged {
  const present = new Set(changelog.sections.map((section) => section.version));
  const added: Section[] = [];

  for (const section of additions) {
    if (present.has(section.version)) continue;

    present.add(section.version);
    added.push(section);
  }

  const sections = [...changelog.sections, ...added].sort(compareSections);

  return { changelog: { ...changelog, sections }, added };
}

/** The file text: the fixed preamble for `packageName`, then each section. */
export function renderChangelog(
  packageName: string,
  sections: readonly Section[],
): string {
  const blocks = [preamble(packageName), ...sections.map(renderSection)];

  return `${blocks.join('\n\n')}\n`;
}

/** The line `version`'s section goes before: the first lower version's heading, or `undefined` for the end. */
function insertionLine(text: string, version: string): number | undefined {
  let index = -1;
  let found: number | undefined;

  eachLine(text, (line, fenced) => {
    index += 1;

    if (found !== undefined || fenced || !line.startsWith('## ')) return;

    const token = line.slice(3).trim().split(/\s/, 1)[0] ?? '';

    if (token === version) {
      throw new Error(`the changelog already has a ${version} section`);
    }

    if (semver.valid(token) && semver.lt(token, version)) found = index;
  });

  return found;
}

/**
 * `text` with `version`'s section added and every other byte kept; a missing
 * file (`undefined`) becomes the fixed preamble and the section. A
 * `notesThrough` sha opens the section with its marker. Throws when `version`
 * already has a section or is not a version.
 */
export function insertSection(
  packageName: string,
  text: string | undefined,
  section: {
    readonly version: string;
    readonly date: string;
    readonly body: string;
    readonly notesThrough?: string;
  },
): string {
  const { version, date, body, notesThrough } = section;

  if (semver.valid(version) === null) {
    throw new Error(`${JSON.stringify(version)} is not a version`);
  }

  const unmarked: Section = {
    version,
    heading: sectionHeading(version, date),
    body: trimBlankLines(body.replace(/\r\n/g, '\n')),
  };

  const added: Section =
    notesThrough === undefined ? unmarked : { ...unmarked, notesThrough };

  if (text === undefined) return renderChangelog(packageName, [added]);

  const block = renderSection(added);

  const normalised = text.replace(/\r\n/g, '\n');
  const at = insertionLine(normalised, version);

  if (at === undefined)
    return `${normalised.replace(/\n*$/, '')}\n\n${block}\n`;

  const lines = normalised.split('\n');

  return [...lines.slice(0, at), block, '', ...lines.slice(at)].join('\n');
}

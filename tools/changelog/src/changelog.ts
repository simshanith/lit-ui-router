// A package's CHANGELOG.md: a fixed preamble, then one `## <version> (<date>)`
// section per stable release, newest first.
import semver from 'semver';

/** One `## ` section: its heading line without the marker, and the body under it. */
export interface Section {
  /** The heading's first token, the version the docs site anchors on. */
  readonly version: string;
  /** The heading text after `## `, version included. */
  readonly heading: string;
  /** Everything under the heading up to the next `## `, without surrounding blank lines. */
  readonly body: string;
}

/** A changelog split at its `## ` headings. */
export interface Changelog {
  /** Everything before the first `## ` heading. */
  readonly preamble: string;
  readonly sections: readonly Section[];
}

const REPOSITORY = 'https://github.com/simshanith/lit-ui-router';

/** The preamble every writer emits, so backfill and later writers agree byte for byte. */
export function preamble(packageName: string): string {
  const query = `${encodeURIComponent(packageName)}%40`;

  return [
    '# Changelog',
    '',
    `Prereleases and canaries are not listed here; see [all releases on GitHub](${REPOSITORY}/releases?q=${query}&expanded=true).`,
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

function toSection(heading: string, lines: readonly string[]): Section {
  return {
    version: heading.split(/\s/, 1)[0] ?? '',
    heading,
    body: trimBlankLines(lines.join('\n')),
  };
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

/** One version's section body, or `undefined` when the changelog has no section for it. */
export function extractSection(
  text: string,
  version: string,
): string | undefined {
  return parseChangelog(text).sections.find(
    (section) => section.version === version,
  )?.body;
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
  const blocks = [
    preamble(packageName),
    ...sections.map((section) =>
      section.body === ''
        ? `## ${section.heading}`
        : `## ${section.heading}\n\n${section.body}`,
    ),
  ];

  return `${blocks.join('\n\n')}\n`;
}

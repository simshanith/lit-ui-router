// Structural normalisation of a GitHub release body into a changelog section
// body: the words stay exactly as published.
import semver from 'semver';

import { eachLine } from './changelog.ts';

/** A structural change {@link normaliseBody} can make. */
export type Transformation =
  | 'normalise-line-endings'
  | 'strip-leading-version-heading'
  | 'demote-headings'
  | 'trim-blank-lines';

const HEADING = /^(#{1,6})[ \t]+(.*)$/;

/** The version a heading's first token names, as in `[1.2.0](…)`, `v1.2.0` or `pkg@1.2.0`. */
function headingVersion(text: string): string | null {
  const token = (text.split(/\s/, 1)[0] ?? '')
    .replace(/^\[/, '')
    .replace(/\].*$/, '')
    .replace(/^.*@/, '')
    .replace(/^v/, '');

  return semver.valid(token);
}

function firstContentLine(lines: readonly string[]): number {
  return lines.findIndex((line) => line.trim() !== '');
}

/** How a body opens: `none` for text, else the heading marker and `<version>` or `<section>`. */
export function leadingHeadingStyle(body: string): string {
  const lines = body.split('\n');
  const match = HEADING.exec(lines[firstContentLine(lines)] ?? '');

  if (!match) return 'none';

  const [, marks = '', text = ''] = match;

  return `${marks} ${headingVersion(text) === null ? '<section>' : '<version>'}`;
}

/** Each heading line's index and level, skipping fenced code. */
function headings(
  lines: readonly string[],
): { index: number; level: number }[] {
  const found: { index: number; level: number }[] = [];
  let index = 0;

  eachLine(lines.join('\n'), (line, fenced) => {
    const marks = fenced ? undefined : HEADING.exec(line)?.[1];

    if (marks) found.push({ index, level: marks.length });

    index += 1;
  });

  return found;
}

function stripLeadingVersionHeading(lines: string[]): boolean {
  const first = firstContentLine(lines);
  const text = HEADING.exec(lines[first] ?? '')?.[2];

  if (text === undefined || headingVersion(text) === null) return false;

  lines.splice(0, first + 1);

  return true;
}

/** Shifts every heading so the shallowest sits at `###`, keeping their nesting. */
function demoteHeadings(lines: string[]): boolean {
  const found = headings(lines);
  const shallowest = Math.min(...found.map(({ level }) => level));
  const shift = 3 - shallowest;

  if (found.length === 0 || shift <= 0) return false;

  for (const { index, level } of found) {
    const line = lines[index] ?? '';

    lines[index] = '#'.repeat(Math.min(level + shift, 6)) + line.slice(level);
  }

  return true;
}

/** A section body, and the transformations that produced it. */
export interface Normalised {
  readonly body: string;
  readonly applied: readonly Transformation[];
}

/** The body under a `## <version>` heading, and which transformations produced it. */
export function normaliseBody(body: string): Normalised {
  const applied: Transformation[] = [];
  const unix = body.replace(/\r\n/g, '\n');

  if (unix !== body) applied.push('normalise-line-endings');

  const lines = unix.split('\n');

  if (stripLeadingVersionHeading(lines))
    applied.push('strip-leading-version-heading');

  if (demoteHeadings(lines)) applied.push('demote-headings');

  const joined = lines.join('\n');

  const trimmed = joined
    .replace(/^(?:[ \t]*\n)+/, '')
    .replace(/(?:\n[ \t]*)+$/, '');

  if (trimmed !== joined) applied.push('trim-blank-lines');

  return { body: trimmed, applied };
}

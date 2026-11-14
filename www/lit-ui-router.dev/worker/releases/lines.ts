// A package page's minor lines, and the url parameter that shows their prereleases.
import major from 'semver/functions/major.js';
import minor from 'semver/functions/minor.js';
import * as v from 'valibot';

const PRERELEASE_VIEWS = ['hide', 'show'] as const;

export type PrereleaseView = (typeof PRERELEASE_VIEWS)[number];

export const DEFAULT_PRERELEASES: PrereleaseView = 'hide';

/** The url parameter that shows a package's prereleases and canaries beside its stable versions. */
export const PRERELEASES_PARAM = 'prereleases';

/** The view a param value names; a missing, repeated or unknown one reads as the default. */
export const PrereleasesParam = v.fallback(
  v.picklist(PRERELEASE_VIEWS),
  DEFAULT_PRERELEASES,
);

/** One `major.minor` line's versions, in the order they were given. */
export interface Line<Row> {
  name: string;
  rows: Row[];
}

/** The anchor of a line's heading; the `line-` prefix keeps it apart from the `v<version>` anchors. */
export const lineAnchor = (name: string): string => `line-${name}`;

/** `versions`, newest first, as runs of one `major.minor` each; semver order keeps each line's versions together. */
export const linesOf = <Row extends { version: string }>(
  versions: readonly Row[],
): Line<Row>[] =>
  versions.reduce<Line<Row>[]>((lines, row) => {
    const name = `${major(row.version)}.${minor(row.version)}`;
    const last = lines.at(-1);

    if (last?.name === name) last.rows.push(row);
    else lines.push({ name, rows: [row] });

    return lines;
  }, []);

// Plans a backfill: for each package, the sections its CHANGELOG.md lacks,
// built from the release ledger's stored GitHub release bodies.
import semver from 'semver';
import * as v from 'valibot';

import {
  mergeSections,
  parseChangelog,
  renderChangelog,
  type Section,
  sectionHeading,
} from './changelog.ts';
import {
  leadingHeadingStyle,
  normaliseBody,
  type Transformation,
} from './normalise.ts';

const LedgerRow = v.looseObject({
  name: v.string(),
  version: v.string(),
  gh_body: v.nullish(v.string()),
  gh_published_at: v.nullish(v.string()),
  npm_published_at: v.nullish(v.string()),
});

export type LedgerRow = v.InferOutput<typeof LedgerRow>;

/** GET /ledger's body, or the `[{ results }]` that `cf d1 query` and `wrangler d1 execute --json` print. */
const LedgerInput = v.union([
  v.pipe(
    v.looseObject({ versions: v.array(LedgerRow) }),
    v.transform(({ versions }) => versions),
  ),
  v.pipe(
    v.array(v.looseObject({ results: v.array(LedgerRow) })),
    v.transform((batches) => batches.flatMap(({ results }) => results)),
  ),
]);

/** The ledger's `versions` rows from a saved read of either path; throws on any other shape. */
export function parseLedger(text: string): LedgerRow[] {
  return v.parse(LedgerInput, JSON.parse(text));
}

/** A published package and its CHANGELOG.md text, `undefined` before the first write. */
export interface PackageFile {
  readonly name: string;
  readonly path: string;
  readonly text: string | undefined;
}

/** What the backfill does to one package's file. */
export interface PackagePlan {
  readonly name: string;
  readonly path: string;
  readonly text: string;
  readonly changed: boolean;
  readonly sections: number;
  readonly added: readonly string[];
  /** Stable releases the ledger has with no stored body, or no publish date to head it. */
  readonly missing: readonly string[];
}

export interface BackfillPlan {
  readonly packages: readonly PackagePlan[];
  /** How many added sections each transformation produced. */
  readonly transformations: Readonly<Partial<Record<Transformation, number>>>;
  /** Added sections per leading-heading style of their GitHub body. */
  readonly leadingHeadingStyles: Readonly<Record<string, number>>;
}

function isStable(version: string): boolean {
  return semver.valid(version) !== null && semver.prerelease(version) === null;
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

interface Tally {
  transformations: Partial<Record<Transformation, number>>;
  leadingHeadingStyles: Record<string, number>;
}

function planPackage(
  file: PackageFile,
  rows: readonly LedgerRow[],
  tally: Tally,
): PackagePlan {
  const existing = parseChangelog(file.text ?? '');
  const present = new Set(existing.sections.map(({ version }) => version));
  const candidates: Section[] = [];
  const missing: string[] = [];

  for (const row of rows) {
    if (row.name !== file.name || !isStable(row.version)) continue;

    if (present.has(row.version)) continue;

    const publishedAt = row.gh_published_at ?? row.npm_published_at;

    if (row.gh_body == null || publishedAt == null) {
      missing.push(row.version);
      continue;
    }

    const { body, applied } = normaliseBody(row.gh_body);

    for (const name of applied) increment(tally.transformations, name);
    increment(tally.leadingHeadingStyles, leadingHeadingStyle(row.gh_body));
    candidates.push({
      version: row.version,
      heading: sectionHeading(row.version, publishedAt),
      body,
    });
  }

  const { changelog, added } = mergeSections(existing, candidates);
  const text = renderChangelog(file.name, changelog.sections);

  return {
    name: file.name,
    path: file.path,
    text,
    changed: text !== file.text,
    sections: changelog.sections.length,
    added: added.map(({ version }) => version),
    missing: missing.sort(semver.rcompare),
  };
}

/** Each package's next CHANGELOG.md; existing sections are kept as written. */
export function planBackfill(
  files: readonly PackageFile[],
  rows: readonly LedgerRow[],
): BackfillPlan {
  const tally: Tally = { transformations: {}, leadingHeadingStyles: {} };
  const packages = files.map((file) => planPackage(file, rows, tally));

  return { packages, ...tally };
}

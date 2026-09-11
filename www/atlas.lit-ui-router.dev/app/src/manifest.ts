/** The generated index of the drawing set (www/atlas.lit-ui-router.dev/generator/emit-app.mjs). */
import { BASE } from './routes.ts';

/**
 * FORM, split into keys (www/atlas.lit-ui-router.dev/generator/labels.mjs). The title block keeps
 * the readable phrase; these are what the index and the card filter read.
 * `basis` qualifies the city subject only — what the same city is counted on.
 */
export interface SheetLabels {
  subject: string;
  projection: string;
  mode: 'interactive' | 'static';
  basis?: string;
}

/** The key order every index row, chip and card line prints in. */
export const LABEL_KEYS = ['subject', 'projection', 'mode', 'basis'] as const;
export type LabelKey = (typeof LABEL_KEYS)[number];

/** The one subject `basis` says anything about. */
export const BASIS_SUBJECT = 'city';

export interface SheetRow {
  id: string;
  num: string;
  title: string;
  sub: string;
  /** HTML — the same string the plate's figcaption prints. */
  caption: string;
  /** The gallery index's ALTITUDE wording — canonical, not the sheet's own. */
  scale: string;
  form: string;
  /** FORM's keys — emitted by the generator, never typed on a sheet. */
  labels: SheetLabels;
  /** The index's FIT VERDICT line: one editorial sentence per plate. */
  verdict: string;
  rev: string;
  file: string;
  /** The sheet's standalone page in the flat set (build.mjs's own filename). */
  standalone: string;
  interactive: boolean;
  needsCytoscape: boolean;
  plates: string[];
  refs: string[];
}

/**
 * A plate with no sheet number — the flat set publishes it inside the gallery
 * only. Kept OUT of `sheets` on purpose: the reel walk, the ascent order and
 * the server's narrowed `/sheet/:num` all read that array.
 */
export interface ExtraRow {
  id: string;
  title: string;
  sub: string;
  rev: string;
  shno: string;
  scale: string;
  verdict: string;
  labels: SheetLabels;
  file: string;
  /** Where the flat set draws it — a gallery anchor, not a page. */
  standalone: string;
  refs: string[];
}

/**
 * The gallery cover, rendered by the generator and carried verbatim so the
 * routed index and the flat one cannot drift. Every field is HTML, inserted
 * with `unsafeHTML`; `css` is the half of the flat gallery's stylesheet these
 * blocks need.
 */
export interface Cover {
  css: string;
  statBar: string;
  survey: string;
  prose: string;
  provenance: string;
  /** Sheet 7's city alone, an inline SVG cropped to its extent: the key image. */
  hero: string;
  /** The README's thesis sentence, as one line of HTML. */
  thesis: string;
  /** The README's generator notes, as one line of HTML. */
  notes: string;
}

/** One REV from a sheet's frozen sub line — an issue of the set. */
export interface IssueEntry {
  /** YYYY-MM-DD, or '' when the rev carries no date. */
  date: string;
  /** The sheet number, or 'city' for the 3D plate. */
  num: string;
  head: string;
  title: string;
  rev: string;
  /** The rev's first clause, plain text; the full text is on the sheet. */
  desc: string;
}

export interface Manifest {
  project: string;
  client: string;
  total: number;
  date: string;
  base: string;
  generatedBy: string;
  cover: Cover;
  /** Every REV across the set: dated ones latest first, then the undated. */
  issueLog: IssueEntry[];
  sheets: SheetRow[];
  /**
   * Plates whose subject is the atlas itself, not the codebase — letter-
   * prefixed ids ('A1'), deliberately OUTSIDE `sheets`. Everything that walks
   * the set in ascent order (the rail's ascent block, the ← / → walk, the
   * server's narrowed `/sheet/{num:…}` alternation is fed BOTH) reads
   * `sheets`; the appendix rides its own section after the city.
   */
  appendix: SheetRow[];
  extras: ExtraRow[];
}

/**
 * The artifact build's baked-in payload (see artifact.ts): the whole set in
 * one `<script type="application/json">`, because a published Artifact may
 * not fetch anything. Absent on the site, where the fetches below run.
 */
interface Island {
  manifest: Manifest;
  fragments: Record<string, string>;
}

let island: Island | null | undefined;

function readIsland(): Island | null {
  if (island !== undefined) return island;
  const node = typeof document === 'undefined' ? null : document.getElementById('atlas-data');
  island = node?.textContent ? (JSON.parse(node.textContent) as Island) : null;
  return island;
}

let pending: Promise<Manifest> | null = null;

/** Memoized: several states resolve `manifest`, and one fetch answers them all. */
export function loadManifest(): Promise<Manifest> {
  const baked = readIsland();
  if (baked) pending ??= Promise.resolve(baked.manifest);
  pending ??= fetch(`${BASE}manifest.json`).then((res) => {
    if (!res.ok) throw new Error(`manifest.json: ${res.status}`);
    return res.json() as Promise<Manifest>;
  });
  return pending;
}

/** The one extra, by id — `undefined` if an older manifest predates it. */
export function findExtra(manifest: Manifest, id: string): ExtraRow | undefined {
  return manifest.extras?.find((row) => row.id === id);
}

/** Seed the cache from a prerendered payload (or a test). */
export function primeManifest(manifest: Manifest): void {
  pending = Promise.resolve(manifest);
}

/** Every plate a `/sheet/:num` url can reach — the ascent, then the appendix. */
export function allSheets(manifest: Manifest): SheetRow[] {
  return [...manifest.sheets, ...(manifest.appendix ?? [])];
}

/**
 * The ascent as the rail and the index file it: the numbered sheets with the
 * 3D city seated right after 7B — it is sheet 7's third plate, so that is
 * where it belongs, not at the end of the list.
 */
export type AscentRow = { kind: 'sheet'; row: SheetRow } | { kind: 'city'; row: ExtraRow };
export function ascent(manifest: Manifest): AscentRow[] {
  const city = findExtra(manifest, 'city');
  return manifest.sheets.flatMap((row): AscentRow[] =>
    row.num === '7B' && city ? [{ kind: 'sheet', row }, { kind: 'city', row: city }] : [{ kind: 'sheet', row }],
  );
}

/** The leading article of a title. The manifest strings themselves stay frozen. */
export const ARTICLE = /^THE\s+/;

/** Rail entries drop the article (T9); every full title keeps it as `sup.art`. */
export const entryTitle = (title: string): string => title.replace(ARTICLE, '');

/** Sheet numbers are cased ('2A', '12i', 'A1'); a url may not be. */
export function findSheet(manifest: Manifest, num: string): SheetRow | undefined {
  const wanted = num.toLowerCase();
  return allSheets(manifest).find((sheet) => sheet.id === wanted);
}

/** An appendix plate is letter-first: it carries no altitude and no "OF 14". */
export const isAppendix = (num: string): boolean => /^[A-Za-z]/.test(num);

// --- the key index: FORM's keys as filterable, shareable state --------------

/**
 * The filter, as the gallery's route params carry it. Four typed keys plus
 * `kv`, the general `key=value` fallback for a combination the chips cannot
 * express. Every field is null when that key is off, which is the param
 * default declared in routes.ts — so the unfiltered index has no query string.
 */
export interface Filter {
  subject: string | null;
  projection: string | null;
  mode: string | null;
  basis: string | null;
  kv: string | null;
}

export const EMPTY_FILTER: Filter = {
  subject: null,
  projection: null,
  mode: null,
  basis: null,
  kv: null,
};

const str = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return text.length > 0 ? text : null;
};

/** Read the filter out of a transition's params; anything else is ignored. */
export function readFilter(params: Record<string, unknown> | undefined): Filter {
  if (!params) return EMPTY_FILTER;
  return {
    subject: str(params['subject']),
    projection: str(params['projection']),
    mode: str(params['mode']),
    basis: str(params['basis']),
    kv: str(params['kv']),
  };
}

/** `subject=city projection=plan` — the kv box's own little grammar. */
export function kvPairs(kv: string | null): Array<[string, string]> {
  if (!kv) return [];
  return kv
    .split(/[\s,]+/)
    .filter((token) => token.includes('='))
    .map((token): [string, string] => {
      const at = token.indexOf('=');
      return [token.slice(0, at).trim(), token.slice(at + 1).trim()];
    })
    .filter(([key, value]) => key.length > 0 && value.length > 0);
}

export const isFiltered = (filter: Filter): boolean =>
  Object.values(filter).some((value) => value !== null);

const valueOf = (labels: SheetLabels, key: string): string | undefined =>
  key === 'subject' || key === 'projection' || key === 'mode' || key === 'basis'
    ? labels[key]
    : undefined;

/** Does a plate's key set answer the filter? An unknown kv key matches nothing. */
export function matchesFilter(labels: SheetLabels, filter: Filter): boolean {
  for (const key of LABEL_KEYS) {
    const wanted = filter[key];
    if (wanted !== null && labels[key] !== wanted) return false;
  }
  for (const [key, value] of kvPairs(filter.kv)) {
    if (valueOf(labels, key) !== value) return false;
  }
  return true;
}

/** The filter with one key cleared — what a facet count is taken against. */
export const without = (filter: Filter, key: LabelKey): Filter => ({ ...filter, [key]: null });

/** Every value a key takes across the set, commonest first, with facet counts. */
export function facet(
  rows: readonly { labels: SheetLabels }[],
  key: LabelKey,
  filter: Filter,
): Array<{ value: string; count: number }> {
  const base = without(filter, key);
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row.labels[key];
    if (value === undefined) continue;
    const hit = matchesFilter(row.labels, base) ? 1 : 0;
    counts.set(value, (counts.get(value) ?? 0) + hit);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Every `key=value` the set carries — the kv box's suggestion list. */
export function kvVocabulary(rows: readonly { labels: SheetLabels }[]): string[] {
  const out = new Set<string>();
  for (const row of rows) {
    for (const key of LABEL_KEYS) {
      const value = row.labels[key];
      if (value !== undefined) out.add(`${key}=${value}`);
    }
  }
  return [...out].sort();
}

/** The query string for a filter — empty when nothing is filtered. */
export function filterQuery(filter: Filter): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) if (value !== null) params.set(key, value);
  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
}

/** Every plate the index can show: the ascent, the city, then the appendix. */
export function labelledRows(manifest: Manifest): Array<{ labels: SheetLabels }> {
  const city = findExtra(manifest, 'city');
  return [...manifest.sheets, ...(city ? [city] : []), ...(manifest.appendix ?? [])];
}

/** Either kind of row carries the two fields a fragment fetch needs. */
export function loadFragment(sheet: { id: string; file: string }): Promise<string> {
  const baked = readIsland()?.fragments[sheet.id];
  if (baked !== undefined) return Promise.resolve(baked);
  return fetch(`${BASE}${sheet.file}`).then((res) => {
    if (!res.ok) throw new Error(`${sheet.file}: ${res.status}`);
    return res.text();
  });
}

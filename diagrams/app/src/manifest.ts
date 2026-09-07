/** The generated index of the drawing set (diagrams/generator/emit-app.mjs). */
import { BASE } from './routes.ts';

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

/** Either kind of row carries the two fields a fragment fetch needs. */
export function loadFragment(sheet: { id: string; file: string }): Promise<string> {
  const baked = readIsland()?.fragments[sheet.id];
  if (baked !== undefined) return Promise.resolve(baked);
  return fetch(`${BASE}${sheet.file}`).then((res) => {
    if (!res.ok) throw new Error(`${sheet.file}: ${res.status}`);
    return res.text();
  });
}

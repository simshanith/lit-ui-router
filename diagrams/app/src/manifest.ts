/** The generated index of the drawing set (diagrams/generator/emit-app.mjs). */
import { BASE } from './routes.ts';

export interface SheetRow {
  id: string;
  num: string;
  title: string;
  sub: string;
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
  /** The README's thesis sentence, as one line of HTML. */
  thesis: string;
  /** The README's generator notes, as one line of HTML. */
  notes: string;
}

export interface Manifest {
  project: string;
  client: string;
  total: number;
  date: string;
  base: string;
  generatedBy: string;
  cover: Cover;
  sheets: SheetRow[];
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

/** Sheet numbers are cased ('2A', '12i'); a url may not be. */
export function findSheet(manifest: Manifest, num: string): SheetRow | undefined {
  const wanted = num.toLowerCase();
  return manifest.sheets.find((sheet) => sheet.id === wanted);
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

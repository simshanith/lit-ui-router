/** The generated index of the drawing set (diagrams/generator/emit-app.mjs). */
import { BASE } from './routes.ts';

export interface SheetRow {
  id: string;
  num: string;
  title: string;
  sub: string;
  caption: string;
  scale: string;
  form: string;
  rev: string;
  file: string;
  /** The sheet's standalone page in the flat set (build.mjs's own filename). */
  standalone: string;
  interactive: boolean;
  needsCytoscape: boolean;
  plates: string[];
  refs: string[];
}

export interface Manifest {
  project: string;
  client: string;
  total: number;
  date: string;
  base: string;
  generatedBy: string;
  sheets: SheetRow[];
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

/** Seed the cache from a prerendered payload (or a test). */
export function primeManifest(manifest: Manifest): void {
  pending = Promise.resolve(manifest);
}

/** Sheet numbers are cased ('2A', '12i'); a url may not be. */
export function findSheet(manifest: Manifest, num: string): SheetRow | undefined {
  const wanted = num.toLowerCase();
  return manifest.sheets.find((sheet) => sheet.id === wanted);
}

export function loadFragment(sheet: SheetRow): Promise<string> {
  const baked = readIsland()?.fragments[sheet.id];
  if (baked !== undefined) return Promise.resolve(baked);
  return fetch(`${BASE}${sheet.file}`).then((res) => {
    if (!res.ok) throw new Error(`${sheet.file}: ${res.status}`);
    return res.text();
  });
}

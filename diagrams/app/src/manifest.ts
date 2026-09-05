/** The generated index of the drawing set (diagrams/generator/emit-app.mjs). */
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

export const BASE = '/app/';

let pending: Promise<Manifest> | null = null;

/** Memoized: several states resolve `manifest`, and one fetch answers them all. */
export function loadManifest(): Promise<Manifest> {
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
  const wanted = String(num).toLowerCase();
  return manifest.sheets.find((sheet) => sheet.id === wanted);
}

export function loadFragment(sheet: SheetRow): Promise<string> {
  return fetch(`${BASE}${sheet.file}`).then((res) => {
    if (!res.ok) throw new Error(`${sheet.file}: ${res.status}`);
    return res.text();
  });
}

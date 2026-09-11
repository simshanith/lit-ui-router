/**
 * Build-time post-step for `vite build --mode artifact` (npm run build:artifact).
 *
 * `vite-plugin-singlefile` leaves one dist-artifact/index.html with every
 * script and stylesheet inlined. A claude.ai Artifact is stricter than that:
 *
 *  1. The host wraps the file in its OWN doctype/html/head/body, so the file
 *     must carry none of those tags — just `<title>`, `<style>`, markup and
 *     `<script>`. Only the first 8KB is scanned for the title, so it goes first.
 *  2. Nothing may be fetched at runtime — not even same-origin. The manifest,
 *     every generated fragment and every card picture are baked in as one JSON
 *     island that src/manifest.ts reads instead of fetching, and
 *     public/sheets/atlas.css (which the site links) is inlined as a <style>.
 *
 * Everything here is a rewrite of the emitted file; the site build never runs it.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Manifest } from './src/manifest.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'dist-artifact', 'index.html');
const PUBLIC = join(HERE, 'public');
const SHEETS = join(PUBLIC, 'sheets');

const manifest = JSON.parse(
  readFileSync(join(PUBLIC, 'manifest.json'), 'utf8'),
) as Manifest;

const fragments: Record<string, string> = {};
// `appendix` and `extras` included: A1 stands at no altitude and the 3D city
// has no sheet number, but both are fragments a route can reach.
for (const row of [...manifest.sheets, ...manifest.appendix, ...manifest.extras]) {
  fragments[row.id] = readFileSync(join(SHEETS, `${row.id}.html`), 'utf8');
}
const missing = readdirSync(SHEETS)
  .filter((name) => name.endsWith('.html'))
  .filter((name) => !(name.slice(0, -'.html'.length) in fragments));
if (missing.length > 0)
  throw new Error(`artifact: sheets not in the manifest: ${missing.join(', ')}`);

// THE CARD PICTURES (T16). On the site each card lazy-loads one WebP; here
// there is no origin to load it from, so every path a card can ask for is
// baked as a data: url and `thumbSrc()` resolves against this map instead.
const thumbs: Record<string, string> = {};
for (const row of [...manifest.sheets, ...manifest.appendix]) {
  for (const path of [row.thumb.light, row.thumb.dark]) {
    const file = join(PUBLIC, path);
    if (!existsSync(file)) throw new Error(`artifact: no card picture at public/${path}`);
    thumbs[path] = `data:image/webp;base64,${readFileSync(file).toString('base64')}`;
  }
}

const atlasCss = readFileSync(join(SHEETS, 'atlas.css'), 'utf8');

let html = readFileSync(OUT, 'utf8');

// 1 — shed the host's skeleton. Body content keeps its order, so the inlined
// module script still runs after the island below is in the document.
html = html
  .replace(/^\s*<!doctype[^>]*>\s*/i, '')
  .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, '');

// 2 — the title leads (only the first 8KB is scanned for it), and the drawing
// set's own chrome follows it, where the site's <link> to atlas.css sat.
const titleMatch = /<title>[\s\S]*?<\/title>/i.exec(html);
if (!titleMatch) throw new Error('artifact: dist-artifact/index.html has no <title>');
html = `${titleMatch[0]}\n<style>\n${atlasCss}\n</style>\n${html.replace(titleMatch[0], '')}`;

// 3 — the island. Every `<` is escaped as \u003c: valid JSON, and the only way
// a fragment's own </script> cannot close this one.
const island = JSON.stringify({ manifest, fragments, thumbs }).replaceAll('<', '\\u003c');
const ROOT = '<div id="root"></div>';
if (!html.includes(ROOT)) throw new Error('artifact: no empty <div id="root">');
html = html.replace(
  ROOT,
  `<script type="application/json" id="atlas-data">${island}</script>\n${ROOT}`,
);

if (/<(?:!doctype|\/?html|\/?head|\/?body)\b/i.test(html))
  throw new Error('artifact: a skeleton tag survived the strip');

writeFileSync(OUT, html);
const bytes = statSync(OUT).size;
console.log(
  `artifact: ${OUT} · ${bytes.toLocaleString('en-US')} bytes · ` +
    `${String(Object.keys(fragments).length)} fragments + ` +
    `${String(Object.keys(thumbs).length)} card pictures inlined`,
);

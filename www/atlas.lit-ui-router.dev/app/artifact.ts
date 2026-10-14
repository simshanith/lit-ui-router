/**
 * Build-time post-step for `vite build --mode artifact` (npm run build:artifact).
 *
 * The artifact is the condensed atlas: the gallery and the colophon, routed on
 * the hash, with every sheet, plate in the round and the issue log a link out
 * to the live site (src/router.ts, src/views.ts). `vite-plugin-singlefile`
 * leaves one dist-artifact/index.html with every script and stylesheet
 * inlined. A claude.ai Artifact is stricter than that:
 *
 *  1. The host wraps the file in its OWN doctype/html/head/body, so the file
 *     must carry none of those tags — just `<title>`, `<style>`, markup and
 *     `<script>`. Only the first 8KB is scanned for the title, so it goes first.
 *  2. Nothing may be fetched at runtime — not even same-origin. The manifest
 *     and every card picture are baked in as one JSON island that
 *     src/manifest.ts reads instead of fetching, and public/sheets/atlas.css
 *     (which the site links) is inlined as a <style>. No fragment and no model
 *     ships: the pages that draw them are on the live site.
 *
 * Everything here is a rewrite of the emitted file; the site build never runs it.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD } from './src/manifest.ts';
import type { Manifest } from './src/manifest.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'dist-artifact', 'index.html');
const PUBLIC = join(HERE, 'public');
const SHEETS = join(PUBLIC, 'sheets');
// The artifact's ceiling: the host's cap is 16 MB, and the condensed file stays well inside half of it.
const BUDGET = 8 * 1024 * 1024;

const manifest = JSON.parse(
  readFileSync(join(PUBLIC, 'manifest.json'), 'utf8'),
) as Manifest;

// THE CARD PICTURES (T16). On the site each card lazy-loads one WebP; here
// there is no origin to load it from, so every path a card can ask for is
// baked as a data: url and `thumbSrc()` resolves against this map instead.
const thumbs: Record<string, string> = {};
const bake = (path: string): void => {
  const file = join(PUBLIC, path);
  if (!existsSync(file)) throw new Error(`artifact: no picture at public/${path}`);
  thumbs[path] = `data:image/webp;base64,${readFileSync(file).toString('base64')}`;
};
for (const row of [...manifest.sheets, ...manifest.appendix, ...manifest.extras]) {
  bake(row.thumb.light);
  bake(row.thumb.dark);
}
// the colophon's figure, the equation card, resolves through the same map
bake(CARD.light);
bake(CARD.dark);

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

// 3 — the island. Every `<` is escaped as <: valid JSON, and the only way
// a caption's own markup cannot close this script.
const island = JSON.stringify({ manifest, thumbs }).replaceAll('<', '\\u003c');
const ROOT = '<div id="root"></div>';
if (!html.includes(ROOT)) throw new Error('artifact: no empty <div id="root">');
html = html.replace(
  ROOT,
  `<script type="application/json" id="atlas-data">${island}</script>\n${ROOT}`,
);

if (/<(?:!doctype|\/?html|\/?head|\/?body)\b/i.test(html))
  throw new Error('artifact: a skeleton tag survived the strip');
if (/data:model\/gltf-binary/.test(html)) throw new Error('artifact: a model was inlined');

writeFileSync(OUT, html);
const bytes = statSync(OUT).size;
if (bytes > BUDGET)
  throw new Error(`artifact: ${bytes.toLocaleString('en-US')} bytes, over the ${BUDGET.toLocaleString('en-US')}-byte budget`);
console.log(
  `artifact: ${OUT} · ${bytes.toLocaleString('en-US')} bytes · ` +
    `${String(Object.keys(thumbs).length)} pictures inlined`,
);

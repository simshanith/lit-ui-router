// EMIT-APP — the drawing set, cut into fragments a router can mount.
//
// The atlas ships as ~21 standalone HTML pages. `diagrams/app/` is the same
// set as a lit-ui-router single-page app, and this module is the seam: it
// writes one CHROME-LESS fragment per sheet plus a manifest, so nothing in
// the app is transcribed by hand. Every string here comes out of the same
// sheet objects build.mjs already renders.
//
// Written, relative to build.mjs's OUT argument (the repo's diagrams/):
//   app/public/sheets/<id>.html   one fragment per sheet
//   app/public/sheets/atlas.css   the shared sheet chrome, lifted from chrome.mjs
//   app/public/manifest.json      one row per sheet
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CSS, DATE, TOTAL, sheetSection } from './chrome.mjs';

const GEN = new URL('.', import.meta.url).pathname;

// The app is served from /app/ on the staged site; fragment hrefs are absolute
// so a prerendered page links correctly before any JS runs.
const BASE = '/app/';

// --- which generator module draws which sheet ------------------------------
// The plate list below is derived by walking these entry modules' imports, so
// a sheet that starts reading a new census plate says so without an edit here.
const MODULE = {
  '1': 'sheet1.mjs', '2': 'sheet2.mjs', '2A': 'sheet2a.mjs', '2B': 'sheet2b.mjs',
  '3': 'sheet3.mjs', '3A': 'sheet3a.mjs', '3B': 'sheet3b.mjs', '4': 'sheet4.mjs',
  '5': 'sheet5.mjs', '6': 'sheet6.mjs', '7': 'sheet7.mjs', '7A': 'sheet7a.mjs',
  '7B': 'sheet7b.mjs', '8': 'sheet8.mjs', '9': 'sheet9.mjs', '10': 'sheet10.mjs',
  '11': 'sheet11.mjs', '12': 'sheet12.mjs', '12i': 'sheet12i.mjs',
  '13': 'sheet13.mjs', '14': 'sheet14.mjs',
};

// chrome.mjs is read by every sheet (the title block dates itself off
// census-files.json); listing it 21 times would say nothing, so it is cut.
const NOT_A_PLATE_SOURCE = new Set(['chrome.mjs']);

const PLATE_RE = /\.\.\/data\/(census-[a-z0-9-]+\.json)/g;
const IMPORT_RE = /from '\.\/([a-z0-9-]+\.mjs)'/g;

function platesOf(entry) {
  if (!entry) return [];
  const seen = new Set();
  const plates = new Set();
  const walk = (file) => {
    if (seen.has(file) || NOT_A_PLATE_SOURCE.has(file)) return;
    seen.add(file);
    const src = readFileSync(join(GEN, file), 'utf8');
    for (const m of src.matchAll(PLATE_RE)) plates.add(m[1]);
    for (const m of src.matchAll(IMPORT_RE)) walk(m[1]);
  };
  walk(entry);
  return [...plates].sort();
}

// --- altitude order: 1, 2, 2A, 2B, 3, 3A, ... 12, 12i, 13, 14 --------------
export function bySheet(a, b) {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  if (na !== nb) return na - nb;
  return String(a).localeCompare(String(b));
}

// --- cross-sheet references -------------------------------------------------
// "sheet 2", "sheets 7–10", "sheets 8, 9 and 10" — the prose's own index.
const REF_RE =
  /\bsheets?\b\s+(\d+[A-Za-z]?(?:\s*(?:,|and|&|–|—|-|to)\s*\d+[A-Za-z]?)*)/gi;
const TOKEN_RE = /\d+[A-Za-z]?/g;

// A run like "7–10" is a range only when both ends are plain numbers.
function expand(run, known) {
  const tokens = run.match(TOKEN_RE) ?? [];
  const dashed = /–|—|(?<=\d)\s*-\s*(?=\d)|\bto\b/.test(run);
  const out = [];
  if (dashed && tokens.length === 2 && /^\d+$/.test(tokens[0]) && /^\d+$/.test(tokens[1])) {
    for (let n = Number(tokens[0]); n <= Number(tokens[1]); n += 1) out.push(String(n));
  } else {
    out.push(...tokens);
  }
  return out.filter((t) => known.has(t.toUpperCase()));
}

// --- the one safe way to rewrite text inside emitted HTML -------------------
// Split into tags and text, transform TEXT ONLY, and never inside a script,
// style, svg or an anchor. Attribute values are part of a tag chunk here, so
// an aria-label reading "Sheet 12" is never turned into markup.
const SKIP_INSIDE = new Set(['script', 'style', 'svg', 'a']);

function linkRefs(html, self, byUpper) {
  const parts = html.split(/(<[^>]*>)/);
  const stack = [];
  const refs = new Set();
  const out = parts.map((part) => {
    if (part.startsWith('<')) {
      const close = /^<\/([a-zA-Z][a-zA-Z0-9]*)/.exec(part);
      if (close) {
        const i = stack.lastIndexOf(close[1].toLowerCase());
        if (i !== -1) stack.splice(i);
        return part;
      }
      const open = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(part);
      if (open && !part.endsWith('/>')) stack.push(open[1].toLowerCase());
      return part;
    }
    if (!part || stack.some((t) => SKIP_INSIDE.has(t))) return part;
    return part.replace(REF_RE, (match, run) => {
      const hits = expand(run, byUpper)
        .map((t) => byUpper.get(t.toUpperCase()))
        .filter((n) => n !== self);
      if (hits.length === 0) return match;
      for (const n of hits) refs.add(n);
      // One anchor over the whole phrase, pointed at its first sheet: the
      // prose reads "sheets 7–10", not four separate links.
      return `<a class="xref" data-sheet="${hits[0]}" href="${BASE}sheet/${hits[0]}">${match}</a>`;
    });
  });
  return { html: out.join(''), refs: [...refs].sort(bySheet) };
}

// The two interactive lanes pull cytoscape off a CDN on their standalone
// pages. The app bundles it instead, so the tag is cut here and the manifest
// records the need — see diagrams/app/src/fragment.ts for why an inserted
// <script> would not have run anyway.
const CDN_SCRIPT = /\s*<script defer src="https:\/\/cdnjs\.cloudflare\.com\/[^"]*"><\/script>/g;

/**
 * @param {object} args
 * @param {Array<object>} args.sheets      the SVG sheets, in build.mjs's order
 * @param {Array<[object, () => string]>} args.interactive sheet + its own renderer
 * @param {string} args.outDir             build.mjs's OUT argument
 * @returns {number} fragments written
 */
export function emitApp({ sheets, interactive, outDir }) {
  const rows = [...sheets.map((s) => [s, null]), ...interactive].sort(([a], [b]) =>
    bySheet(a.num, b.num),
  );
  const byUpper = new Map(rows.map(([s]) => [String(s.num).toUpperCase(), String(s.num)]));

  const publicDir = join(outDir, 'app', 'public');
  const sheetsDir = join(publicDir, 'sheets');
  mkdirSync(sheetsDir, { recursive: true });
  writeFileSync(join(sheetsDir, 'atlas.css'), `${CSS}\n`);

  const manifest = rows.map(([sheet, render]) => {
    const id = String(sheet.num).toLowerCase();
    const source = render ? render() : sheetSection(sheet);
    const needsCytoscape = source.includes('cdnjs.cloudflare.com/ajax/libs/cytoscape');
    const { html, refs } = linkRefs(source.replace(CDN_SCRIPT, ''), String(sheet.num), byUpper);
    writeFileSync(join(sheetsDir, `${id}.html`), `${html.trim()}\n`);
    return {
      id,
      num: String(sheet.num),
      title: sheet.title,
      sub: sheet.sub ?? '',
      caption: sheet.caption ?? '',
      scale: sheet.scale ?? '',
      form: sheet.form ?? '',
      rev: sheet.rev ?? 'A',
      file: `sheets/${id}.html`,
      interactive: Boolean(render),
      needsCytoscape,
      plates: platesOf(MODULE[String(sheet.num)]),
      refs,
    };
  });

  writeFileSync(
    join(publicDir, 'manifest.json'),
    `${JSON.stringify(
      {
        project: 'THE ALTITUDE ATLAS',
        client: 'lit-ui-router · simshanith',
        total: TOTAL,
        date: DATE,
        base: BASE,
        generatedBy: 'diagrams/generator/emit-app.mjs',
        sheets: manifest,
      },
      null,
      2,
    )}\n`,
  );
  return manifest.length;
}

// EMIT-APP — the drawing set, cut into fragments a router can mount.
//
// The atlas ships as ~23 standalone HTML pages. `diagrams/app/` is the same
// set as a lit-ui-router single-page app, and this module is the seam: it
// writes one CHROME-LESS fragment per sheet plus a manifest, so nothing in
// the app is transcribed by hand. Every string here comes out of the same
// sheet objects build.mjs already renders — including each sheet's standalone
// filename, so the app can link back to the flat set without hand-typing.
//
// Written, relative to build.mjs's OUT argument (the repo's diagrams/):
//   app/public/sheets/<id>.html   one fragment per sheet
//   app/public/sheets/city.html   the gallery-only 3D plate, same treatment
//   app/public/sheets/atlas.css   the shared sheet chrome, lifted from chrome.mjs
//   app/public/manifest.json      one row per sheet + the `extras` rows + the cover
//   app/src/generated/city-init.js  the 3D scene as a module (three is bundled)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CSS, DATE, TOTAL, plateRatio, sheetSection } from './chrome.mjs';
import { CITY_META, cityInitModule, cityMarkup } from './city-scene.mjs';
import { cityHero } from './sheet7.mjs';
// The app's one base constant (node strips the types). Fragment hrefs are
// absolute so a prerendered page links correctly before any JS runs.
import { BASE } from '../app/src/routes.ts';

const GEN = new URL('.', import.meta.url).pathname;

// --- which generator module draws which sheet ------------------------------
// The plate list below is derived by walking these entry modules' imports, so
// a sheet that starts reading a new census plate says so without an edit here.
const MODULE = {
  '1': 'sheet1.mjs', '1i': 'sheet1i.mjs', '2': 'sheet2.mjs', '2A': 'sheet2a.mjs', '2B': 'sheet2b.mjs',
  '3': 'sheet3.mjs', '3A': 'sheet3a.mjs', '3B': 'sheet3b.mjs', '4': 'sheet4.mjs',
  '5': 'sheet5.mjs', '6': 'sheet6.mjs', '7': 'sheet7.mjs', '7A': 'sheet7a.mjs',
  '7B': 'sheet7b.mjs', '8': 'sheet8.mjs', '9': 'sheet9.mjs', '10': 'sheet10.mjs',
  '11': 'sheet11.mjs', '12': 'sheet12.mjs', '12i': 'sheet12i.mjs',
  '13': 'sheet13.mjs', '14': 'sheet14.mjs', '14i': 'pipeline-graph.mjs',
  A1: 'sheetA1.mjs',
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

// --- altitude order: 1, 1i, 2, 2A, 2B, 3, 3A, ... 12, 12i, 13, 14 ----------
export function bySheet(a, b) {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  // A letter-FIRST id is an appendix plate ('A1'): it parses to NaN and sorts
  // after every numbered one, so a cross-reference list ends with the appendix
  // rather than putting it wherever NaN happens to land.
  const xa = Number.isNaN(na), xb = Number.isNaN(nb);
  if (xa !== xb) return xa ? 1 : -1;
  if (!xa && na !== nb) return na - nb;
  return String(a).localeCompare(String(b));
}

// --- cross-sheet references -------------------------------------------------
// "sheet 2", "sheets 7–10", "sheets 8, 9 and 10" — the prose's own index.
// Appendix ids are letter-FIRST ('A1'), so the token allows a leading letter
// and the phrase allows the word "appendix". `expand()` still filters every
// token against the known ids, so a stray "sheet 99" links nothing.
const REF_RE =
  /\b(?:sheets?|appendix|appendices)\b\s+([A-Za-z]?\d+[A-Za-z]?(?:\s*(?:,|and|&|–|—|-|to)\s*[A-Za-z]?\d+[A-Za-z]?)*)/gi;
const TOKEN_RE = /[A-Za-z]?\d+[A-Za-z]?/g;

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

// --- the issue log ----------------------------------------------------------
// The sheets describe their present state only; the set's revision record is
// diagrams/HISTORY.md, and the log is parsed out of it at BUILD time so the app
// ships JSON rather than fetching the markdown. One entry per `### REV X` under
// a `## <sheet>` heading, carrying that rev's opening clause.
const HISTORY = readFileSync(new URL('../HISTORY.md', import.meta.url), 'utf8');
const untag = (html) => html.replace(/<[^>]*>/g, '');
function firstClause(desc) {
  const text = untag(desc).replace(/\s+/g, ' ').trim();
  const cuts = [' — ', '; ', ' · '].map((sep) => text.indexOf(sep, 40)).filter((i) => i !== -1 && i < 180);
  if (cuts.length > 0) return text.slice(0, Math.min(...cuts));
  if (text.length <= 180) return text;
  return `${text.slice(0, text.lastIndexOf(' ', 180))}…`;
}

/** `## Sheet 3B — THE WATCHED CITY` → `3B`; the city plate files under `city`. */
function historySheetNum(heading) {
  const sheet = /^Sheet\s+([0-9]+[A-Za-z]?|[A-Z][0-9]+)\s+—/.exec(heading);
  if (sheet) return sheet[1];
  if (/^City\b/.test(heading)) return 'city';
  return '';
}

/** The revision's own words: the resolved `sub` clause where the record gives one. */
function historyDesc(body) {
  const blocks = [];
  let current = null;
  let resolved = false;
  for (const raw of body.split('\n')) {
    const line = raw.startsWith('> ') ? raw.slice(2) : raw === '>' ? '' : null;
    if (line === null) {
      if (current) { blocks.push({ text: current.join(' ').trim(), resolved }); current = null; }
      if (/resolved\s*→/.test(raw)) resolved = true;
      continue;
    }
    if (line.startsWith('```')) continue;
    if (!current) current = [];
    current.push(line);
  }
  if (current) blocks.push({ text: current.join(' ').trim(), resolved });
  const pick = blocks.find((b) => b.resolved) ?? blocks[0];
  if (!pick) return '';
  // the rev head is printed by the log itself, so the clause drops its own prefix
  return pick.text.replace(/^REV\s+[0-9A-Z]+(?:\s+corrected)?(?:\s+\d{4}-\d{2}-\d{2})?\s*[:—-]?\s*/i, '');
}

/** Every rev the frozen record carries, as log entries — dated newest first. */
function issueLogOf(rows) {
  const byNum = new Map(rows.map((r) => [r.num.toUpperCase(), r]));
  const entries = [];
  for (const section of HISTORY.split(/^## /m).slice(1)) {
    const heading = section.slice(0, section.indexOf('\n')).trim();
    const row = byNum.get(historySheetNum(heading).toUpperCase());
    if (!row) continue;
    for (const part of section.split(/^### /m).slice(1)) {
      const head = /^REV\s+([0-9A-Z]+(?:\s+corrected)?)\s*(?:—([^\n]*))?/.exec(part);
      if (!head) continue;
      const date = /(\d{4}-\d{2}-\d{2})/.exec(head[2] ?? '');
      const desc = historyDesc(part.slice(part.indexOf('\n') + 1));
      if (!desc) continue;
      entries.push({ date: date ? date[1] : '', num: row.num, head: row.head,
        title: row.title, rev: head[1], desc: firstClause(desc) });
    }
  }
  const order = (a, b) => bySheet(a.num === 'city' ? '7B·' : a.num, b.num === 'city' ? '7B·' : b.num);
  const dated = entries.filter((e) => e.date)
    .sort((a, b) => b.date.localeCompare(a.date) || order(a, b) || b.rev.localeCompare(a.rev));
  const undated = entries.filter((e) => !e.date).sort((a, b) => order(a, b) || a.rev.localeCompare(b.rev));
  return [...dated, ...undated];
}

// The interactive lanes pull cytoscape off a CDN on their standalone
// pages. The app bundles it instead, so the tag is cut here and the manifest
// records the need — see diagrams/app/src/fragment.ts for why an inserted
// <script> would not have run anyway.
const CDN_SCRIPT = /\s*<script defer src="https:\/\/cdnjs\.cloudflare\.com\/[^"]*"><\/script>/g;

// the cover's key image, tagged with its own viewBox ratio: an inline SVG
// letterboxes under max-height, so index.html's contain cap spends itself on
// max-width instead — the same rule the plates use.
function heroPlate() {
  const svg = cityHero();
  const ar = plateRatio(svg);
  return ar ? svg.replace('<svg ', `<svg style="--plate-ar:${ar}" `) : svg;
}

/**
 * @param {object} args
 * @param {Array<object>} args.sheets      the SVG sheets, in build.mjs's order
 * @param {Array<object>} args.appendix    the appendix plates — letter-prefixed
 *        ids, OUTSIDE the ascent, emitted into `manifest.appendix`
 * @param {Array<[object, () => string]>} args.interactive sheet + its own renderer
 * @param {string} args.outDir             build.mjs's OUT argument
 * @param {(sheet: object) => string} args.fname  build.mjs's standalone filename rule
 * @param {Record<string, {scale: string, verdict: string}>} args.index the gallery
 *        index table — CANONICAL for a row's altitude wording and its fit verdict
 * @param {Record<string, string>} args.cover the cover's own rendered HTML
 * @returns {number} fragments written (sheets + extras)
 */
export function emitApp({ sheets, appendix = [], interactive, outDir, fname, index, cover }) {
  const rows = [...sheets.map((s) => [s, null]), ...interactive].sort(([a], [b]) =>
    bySheet(a.num, b.num),
  );
  const appRows = appendix.map((s) => [s, null]);
  // Cross-references resolve across BOTH sets: sheet 13's notes may point at A1,
  // and A1's notes point back at 7, 7B and 13.
  const byUpper = new Map(
    [...rows, ...appRows].map(([s]) => [String(s.num).toUpperCase(), String(s.num)]),
  );

  const publicDir = join(outDir, 'app', 'public');
  const sheetsDir = join(publicDir, 'sheets');
  mkdirSync(sheetsDir, { recursive: true });
  writeFileSync(join(sheetsDir, 'atlas.css'), `${CSS}\n`);

  const rowFor = ([sheet, render]) => {
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
      // The index's ALTITUDE wording is canonical; a sheet's own `scale` is
      // the fallback for a row the table does not carry.
      scale: index[String(sheet.num)]?.scale ?? sheet.scale ?? '',
      verdict: index[String(sheet.num)]?.verdict ?? '',
      form: sheet.form ?? '',
      rev: sheet.rev ?? 'A',
      file: `sheets/${id}.html`,
      standalone: fname(sheet),
      interactive: Boolean(render),
      needsCytoscape,
      plates: platesOf(MODULE[String(sheet.num)]),
      refs,
    };
  };
  const manifest = rows.map(rowFor);
  const appManifest = appRows.map(rowFor);

  // EXTRAS — a plate the flat set only ever published inside the gallery. It
  // has no sheet number, so it is kept OUT of `sheets`: the reel walk, the
  // ascent order and the sheet mount all read that array and must not see it.
  // Its scene is an ES module rather than an inline script: the app's
  // runScripts() cannot run a <script type="module"> it inserts, and the
  // import must be bundled, not a cdnjs url.
  const cityHtml = linkRefs(cityMarkup(), '', byUpper);
  writeFileSync(join(sheetsDir, `${CITY_META.id}.html`), `${cityHtml.html.trim()}\n`);
  const generatedDir = join(outDir, 'app', 'src', 'generated');
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(join(generatedDir, 'city-init.js'), cityInitModule());
  writeFileSync(
    join(generatedDir, 'city-init.d.ts'),
    '// GENERATED by diagrams/generator/emit-app.mjs — do not edit.\n' +
      '/** Raises the scene inside `root`; the returned function tears it down.\n' +
      ' *  Undefined when there was no scene to raise — no plate, or no WebGL. */\n' +
      'export declare function initCity(\n' +
      '  root: Element,\n' +
      '  THREE: unknown,\n' +
      '): Promise<(() => void) | undefined>;\n',
  );
  const extras = [
    {
      id: CITY_META.id,
      title: CITY_META.title,
      sub: CITY_META.sub,
      rev: CITY_META.rev,
      shno: CITY_META.head,
      file: `sheets/${CITY_META.id}.html`,
      standalone: CITY_META.standalone,
      scale: index.city?.scale ?? '',
      verdict: index.city?.verdict ?? '',
      refs: cityHtml.refs,
    },
  ];

  const issueLog = issueLogOf([
    ...manifest.map((r) => ({ num: r.num, head: `SHEET ${r.num}`, title: r.title })),
    ...appManifest.map((r) => ({ num: r.num, head: `APPENDIX ${r.num}`, title: r.title })),
    ...extras.map((r) => ({ num: r.id, head: r.shno, title: r.title })),
  ]);

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
        // The gallery cover, rendered by build.mjs and carried verbatim: the
        // stat bar, the general survey, the prose column, the colophon line,
        // the README's thesis and generator notes, and the CSS they need.
        // + the key image: sheet 7's city alone, cropped to its extent
        // the hero carries its own viewBox ratio so the cover's contain cap can be
        // spent on max-width, exactly as a plate's is (see .plate in chrome.mjs)
        cover: { ...cover, hero: heroPlate() },
        // every REV in diagrams/HISTORY.md, dated newest first, undated after
        issueLog,
        sheets: manifest,
        // The appendix rides its own array for the same reason the city rides
        // `extras`: everything that walks the set in ascent order reads
        // `sheets`, and an appendix plate stands at no altitude.
        appendix: appManifest,
        extras,
      },
      null,
      2,
    )}\n`,
  );
  return manifest.length + appManifest.length + extras.length;
}

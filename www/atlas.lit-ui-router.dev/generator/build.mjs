import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { page, sheetSection, TOTAL } from './chrome.mjs';
import { sheet1 } from './sheet1.mjs';
import { loopWalkedSection, sheet1i } from './sheet1i.mjs';
import { sheet2 } from './sheet2.mjs';
import { sheet2a } from './sheet2a.mjs';
import { sheet2b, sheet2bPage, SHEET2B_VERDICT } from './sheet2b.mjs';
import { couplingBenchSection } from './coupling-bench.mjs';
import { sheet3 } from './sheet3.mjs';
import { sheet3a, SHEET3A_VERDICT } from './sheet3a.mjs';
import { sheet3b, SHEET3B_VERDICT } from './sheet3b.mjs';
import { sheet4, SHEET4_VERDICT } from './sheet4.mjs';
import { sheet5 } from './sheet5.mjs';
import { sheet6 } from './sheet6.mjs';
import { sheet7, SHEET7_VERDICT } from './sheet7.mjs';
import { sheet7a, SURVEY_META } from './sheet7a.mjs';
import { sheet7b, SHEET7B_VERDICT } from './sheet7b.mjs';
import { sheet8, SHEET8_VERDICT, SHEET8_TIMES } from './sheet8.mjs';
import { sheet9, SHEET9_VERDICT } from './sheet9.mjs';
import { sheet10, SHEET10_VERDICT, SHEET10_CORE_SHARE, SHEET10_ROUTER_SHARE } from './sheet10.mjs';
import { sheet11, SHEET11_VERDICT } from './sheet11.mjs';
import { sheet12, PHANTOM_PCT } from './sheet12.mjs';
import { register12iSection, sheet12i } from './sheet12i.mjs';
import { sheet13, SHEET13_VERDICT } from './sheet13.mjs';
import { sheetA1 } from './sheetA1.mjs';
import { sheetA2 } from './sheetA2.mjs';
import { sheetA3, SHEETA3_VERDICT } from './sheetA3.mjs';
import { PIPELINE_VERDICT, pipelineSection, sheetA2i } from './pipeline-graph.mjs';
import { ATLAS } from './census-atlas.mjs';
import { LOOP } from './loop-walk.mjs';
import { emitApp } from './emit-app.mjs';
import { KEYS, labelsFor } from './labels.mjs';

const OUT = process.argv[2];
if (!OUT) throw new Error('usage: node build.mjs <outdir>');
mkdirSync(OUT, { recursive: true });

const sheets = [sheet1, sheet2, sheet2a, sheet3, sheet3a, sheet3b, sheet4, sheet5, sheet6, sheet7, sheet7a, sheet7b, sheet8, sheet9, sheet10, sheet11, sheet12, sheet13];
// The interactive lanes that have a standalone page of their own — the plate
// count on the cover, in the megacanvas prose and in the README derives here.
const lanes = [sheet1i, sheet2b, sheet12i];
// THE APPENDIX — plates whose subject is the atlas itself rather than the
// codebase. Letter-prefixed ids, deliberately OUTSIDE `sheets`: the ascent
// order, the megacanvas reel, the cover's plate count and the ← / → walk all
// read that array, and an appendix stands at no altitude.
const appendix = [sheetA1, sheetA2, sheetA3];
// The appendix's interactive lane: a standalone page, and a row in `manifest.appendix`.
const appendixLanes = [sheetA2i];
const PLATES = sheets.length + lanes.length;
const fname = (s) => `sheet-${s.num}-${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.html`;

// --- individual sheet files ---
for (const s of [...sheets, ...appendix]) {
  writeFileSync(join(OUT, fname(s)),
    page(s.appendix ? `${s.title} — Appendix ${s.num}` : `${s.title} — Sheet ${s.num} of ${TOTAL}`,
      sheetSection(s), { desc: s.caption }));
}

// --- the interactive plates that have a standalone page of their own ---
// Sheet 2B is a lane, not an SVG sheet, so it is written here rather than
// through sheetSection(); it also rides in the gallery, like A2i and S7·3D.
writeFileSync(join(OUT, fname(sheet2b)),
  page(`${sheet2b.title} — Sheet ${sheet2b.num} of ${TOTAL}`, sheet2bPage(), { desc: sheet2b.caption }));

// Sheet 12i is the same arrangement one altitude up: sheet 12's register plate
// as a cytoscape lane, written standalone here and mounted in the gallery below.
writeFileSync(join(OUT, fname(sheet12i)),
  page(`${sheet12i.title} — Sheet ${sheet12i.num} of ${TOTAL}`, register12iSection(), { desc: sheet12i.caption }));

// Sheet 1i is the same arrangement at the first altitude: sheet 1's circuit as
// a cytoscape lane with one navigation walked through it, standalone here and
// mounted in the gallery right after sheet 1.
writeFileSync(join(OUT, fname(sheet1i)),
  page(`${sheet1i.title} — Sheet ${sheet1i.num} of ${TOTAL}`, loopWalkedSection(), { desc: sheet1i.caption }));

// Appendix A2i is the survey office's own lane: A2's flow graph as a live
// cytoscape picture, standalone here and mounted in the gallery's appendix after A2.
writeFileSync(join(OUT, fname(sheetA2i)),
  page(`${sheetA2i.title} — Appendix ${sheetA2i.num}`, pipelineSection(), { desc: sheetA2i.caption }));

// --- megacanvas ---
const rail = `<nav class="alt-rail" aria-label="altitudes">
${sheets.map((s) => `<a href="#sheet-${s.num}"><span class="alt-n">ALT ${s.num}</span> ${s.title}</a>`).join('\n')}
</nav>`;
const megaCss = `
.mega-head { margin-block: 0 26px; margin-inline: 0; }
.mega-head h1 { font-family: var(--display); font-weight: 600; font-size: clamp(21px, 0.25rem + 3.06vw, 32px); letter-spacing: 0.16em; }
.mega-head p { font-family: var(--prose); color: var(--ink-soft); max-width: 70ch; margin-block-start: 6px; }
.alt-rail { position: sticky; inset-block-start: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 2px;
  margin-block: 0 30px; margin-inline: 0; background: var(--paper); border: 1.5px solid var(--ink); }
.alt-rail a { font-family: var(--data); font-size: 11px; letter-spacing: 0.08em; text-decoration: none;
  color: var(--ink); padding: 8px 12px; border-inline-end: 1px solid var(--line); flex: 1 1 auto; text-align: center; }
@media (hover: hover) and (pointer: fine) { .alt-rail a:hover { background: var(--paper-2); } }
.alt-rail a:active { transform: scale(0.97); }
@media (prefers-reduced-motion: no-preference) { .alt-rail a { transition: transform 160ms var(--ease-out, ease-out); } }
.alt-rail .alt-n { color: var(--accent); font-weight: 600; }
.sheet { scroll-margin-block-start: 64px; }`;
writeFileSync(join(OUT, 'megacanvas.html'), page('The Megacanvas — The Altitude Atlas', `<style>${megaCss}</style>
<header class="mega-head">
  <h1>THE MEGACANVAS</h1>
  <p>The full drawing set on one surface, in ascent order: one package, its companions, the monorepo that ships them, the family they belong to, the ecosystem that family competes in, and routing as such — plus a survey quartet: the monorepo by mass, the sample app's node_modules as a delivered city, the docs deploy as a shipped city, and the inside of one bundle after tree-shaking — then the same wire cut the other way, every published entry priced alone, and the same monorepo as its CI reads it — and finally the same city surveyed in time, every wall dated by the commit that laid it. Thirteen altitudes, ${sheets.length} plates in ascent (the A/B alternates ride beside their parents; the interactive lanes 1i, 2B and 12i stand alone); the form changes at every altitude because the truth does. The office that took every one of those measurements, drawn by its own instrument, is filed in the gallery's appendix as A2.</p>
</header>
${rail}
${sheets.map((s) => sheetSection(s)).join('\n')}`,
{ desc: `All ${sheets.length} plates of the lit-ui-router drawing set on one page, thirteen altitudes in ascent.` }));

// --- gallery / artifact ---
// THE INDEX — [num, ALTITUDE, FORM, FIT VERDICT] and, where the row is not a
// plain `#sheet-<num>` anchor, [anchor, label]. Canonical for both the
// altitude wording and the verdict line: emitApp() maps it onto every manifest
// row, so the routed cards say exactly what this table says.
const verdicts = [
  ['1', 'ONE PACKAGE', 'CLOSED LOOP', 'strong fit — the render cycle is a genuine circuit'],
  ['1i', 'ONE PACKAGE', 'INTERACTIVE CIRCUIT', `sheet 1's circuit with a pointer in it — ${LOOP.stations} stations, ${LOOP.legs} legs, and one click walked in ${LOOP.steps} steps, every step standing on the source lines the plate cites verbatim`],
  ['2', 'COMPANIONS', 'BRICK ASSEMBLY', 'exploded, then seated: every coupling is a published stud, on core or on the brick below — and the server takes none of core’s'],
  ['2A', 'COMPANIONS', 'COUPLING PLAN', 'alternate plate — the same joints at reading size, sheet 2’s two newest companions included: one hangs off the flagship, one bridges the flagship and the server across the no-DOM line'],
  ['2B', 'COMPANIONS, CONTRACTED', 'COUPLING BENCH', SHEET2B_VERDICT],
  ['3', 'MONOREPO', 'ISOMETRIC CITY', 'the yard re-massed from sloc × files — gate severity in colour: the smallest blocks stop the line; the task-manager inset reads the same plates as 3A, so the two cannot disagree'],
  ['3A', 'TWO TASK MANAGERS', 'COUPLING SCHEMATIC', SHEET3A_VERDICT],
  ['3B', 'CI TASK GRAPH', 'ISOMETRIC GRAPH CITY', SHEET3B_VERDICT],
  ['4', 'ECOSYSTEM', 'MASSED SPINE', SHEET4_VERDICT],
  ['5', 'JS ECOSYSTEM', 'POSITIONED CHART', 'no shared mechanism — position, not edges'],
  ['6', 'EVERYTHING', 'CORE SAMPLE', 'prose outranks pictures; one small column earns its place'],
  ['7', 'MONOREPO, MEASURED', 'MEASURED CITY', SHEET7_VERDICT],
  ['7A', 'MONOREPO, TESTED', 'SHADOW PLAN', `the shadow survey — the tests are the light: where a suite reaches it burns near-full — ${SURVEY_META.metered} members read under their own suites' meters at ${SURVEY_META.sha}, so the light and the census are one measurement`],
  ['7B', 'MONOREPO, RUNNING', 'WORKING CITY', SHEET7B_VERDICT],
  ['8', 'ONE CONSUMER', 'DELIVERED CITY', SHEET8_VERDICT],
  ['9', 'ONE DEPLOY', 'SHIPPED CITY', SHEET9_VERDICT],
  ['10', 'ONE BUNDLE', 'BUNDLED CITY', SHEET10_VERDICT],
  ['11', 'SEVEN PACKAGES', 'ENTRY QUARTERS', SHEET11_VERDICT],
  ['12', 'PR CI GRAPH', 'REGISTER PLATE', `the punched inventory — ${PHANTOM_PCT}% of the graph runs nothing, and the real→real edges that remain are a thin core inside a large node count`],
  ['13', 'WORKSPACE × TIME', 'WEATHERING MAP', SHEET13_VERDICT],
  ['12i', 'PR CI GRAPH', 'INTERACTIVE REGISTER', `sheet 12's punchcard with a pointer in it — the whole ci graph carried node by node, real subgraph by default, and one checkbox that floods the ${PHANTOM_PCT}% that runs nothing`],
  ['city', 'MONOREPO, IN THE ROUND', 'REAL 3D CITY IN THE ROUND', "sheet 7's city as one glTF binary in Google's model-viewer, written from the plate's own computed geometry — opaque paper walls hatched in the tier's own rake inside a girding frame, sheet 7A's test light as a second material lane, a rise from the ground as its one clip, and a camera that orbits free and turns to the four true diagonals", '/city', 'S7·3D'],
];
// The rows the routed app files and the flat set does not draw: same columns,
// read into INDEX_BY_NUM and never into the gallery's table.
const appIdx = [
  ['plant', 'THE WORKING CITY, IN THE ROUND', 'REAL 3D CITY IN THE ROUND', "sheet 7's city as one glTF binary in Google's model-viewer, each mass crowned by a working plant sized from its own census — opaque paper walls hatched in the tier's own rake inside a girding frame, sheet 7A's test light as a second material lane, and a camera that orbits free and turns to the four true diagonals", '/plant', 'S7B·3D'],
  ['bricks', 'COMPANIONS, IN THE ROUND', 'REAL 3D BRICK ASSEMBLY', "sheet 2's finished model as one glTF binary in Google's model-viewer — the same parts on the same two levels of ground, turned to the sheet's three drawn corners, with the sheet's explosion, half again as high, as a clip that lifts the stacked bricks off their seats first and drops every brick back down a dashed leader to its stud", '#bricks-scene', 'S2·3D'],
];
// THE APPENDIX INDEX — same four columns, filed under its own heading. These
// rows are NOT in the ascent: `appendixIdx` is concatenated for the lookup the
// app reads, and rendered after a section row in the cover's table.
const appendixIdx = [
  ['A1', 'THE ATLAS ITSELF', 'SPRITE STUDIES', 'meta — the research behind the building sprites, argued on one demo member in fifteen blocks: the working plant wins on cost and independence and shipped as sheet 7B, the vines are its second layer, and the ledger roof stays parked until a sheet wants per-file stories', '#sheet-A1', 'A1'],
  ['A2', 'THE CENSUS PIPELINE', 'FLOW GRAPH', `meta — the atlas measuring itself: one archive, ${ATLAS.stats.probes} probe stations, ${ATLAS.stats.plates} filed plates, and every station, plate and edge introspected from the generator at build time`, '#sheet-A2', 'A2'],
  ['A2i', 'THE CENSUS PIPELINE', 'INTERACTIVE GRAPH', PIPELINE_VERDICT, '#pipeline-graph', 'A2i'],
  ['A3', 'THE ATLAS ITSELF', 'ISOMETRIC CITY', SHEETA3_VERDICT, '#sheet-A3', 'A3'],
];
// FORM's keys under the phrase — the vocabulary's first home is this table
const keyLine = (n) => {
  const labels = labelsFor(n);
  return KEYS.filter((k) => labels[k]).map((k) => `<span class="kv"><i>${k}</i>${labels[k]}</span>`).join('');
};
const idxRow = ([n, a, f, v, anchor, label]) =>
  `<tr><td><a href="${anchor ?? `#sheet-${n}`}">${label ?? `S${n}`}</a></td><td>${a}</td><td>${f}<span class="kvs">${keyLine(n)}</span></td><td>${v}</td></tr>`;
/** The row for a sheet number — the app reads its altitude and verdict here. */
const INDEX_BY_NUM = Object.fromEntries([...verdicts, ...appIdx, ...appendixIdx].map((row) => [row[0], { scale: row[1], verdict: row[3] }]));
// The cover's own CSS, split so the routed app can reuse the half it draws.
// The stat bar, the general survey, the prose column and the colophon line
// ride the manifest as `cover.css`; .cover and .idx are gallery-only. The two
// halves are re-joined below in their original order.
const surveyCss = `.stat-bar { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1px; border: 1.5px solid var(--ink); margin-block: 22px 26px; margin-inline: 0; background: var(--ink); }
/* two ruled rows on a six-column field: the three one-line facts across the top
   at a third each, the two roster paragraphs at a half each below — nothing
   wraps to a row of its own and no cell is left half-empty */
.stat-bar > div { padding-block: 8px 10px; padding-inline: 16px; background: var(--paper-2); grid-column: span 2; }
.stat-bar > div:nth-child(n+4) { grid-column: span 3; }
@media (max-width: 760px) { .stat-bar { grid-template-columns: 1fr; } .stat-bar > div, .stat-bar > div:nth-child(n+4) { grid-column: auto; } }
.stat-bar .k { display: block; font-family: var(--data); font-size: 9.5px; letter-spacing: 0.16em; color: var(--ink-soft); margin-block-end: 3px; }
.stat-bar .v { font-family: var(--data); font-size: 14.5px; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
.survey { border: 1.5px solid var(--ink); margin-block: 0 26px; margin-inline: 0; background: var(--paper); }
.survey h2 { font-family: var(--data); font-weight: 600; font-size: 10.5px; letter-spacing: 0.2em; color: var(--ink-soft);
  padding-block: 8px 7px; padding-inline: 14px; border-block-end: 1.5px solid var(--ink); background: var(--paper-2); }
.survey-tot { display: flex; flex-wrap: wrap; gap: 0; border-block-end: 1.5px solid var(--ink); }
.survey-tot > div { padding-block: 9px 11px; padding-inline: 14px; border-inline-end: 1px solid var(--line); flex: 1 1 auto; }
.survey-tot > div:last-child { border-inline-end: none; }
.survey-tot .k { display: block; font-family: var(--data); font-size: 9.5px; letter-spacing: 0.16em;
  color: var(--ink-soft); margin-block-end: 3px; }
.survey-tot .v { font-family: var(--data); font-size: 17.5px; font-variant-numeric: tabular-nums;
  letter-spacing: 0.03em; }
.survey-tot > div:first-child .v { color: var(--accent); }
.lang { width: 100%; border-collapse: collapse; }
.lang th { font-family: var(--data); font-size: 9.5px; letter-spacing: 0.16em; color: var(--ink-soft);
  text-align: end; padding-block: 7px 6px; padding-inline: 14px; border-block-end: 1px solid var(--line); }
.lang th:first-child { text-align: start; }
.lang .vh { position: absolute; width: 1px; height: 1px; overflow: clip; clip-path: inset(50%); white-space: nowrap; }
.lang td { font-family: var(--data); font-size: 12px; letter-spacing: 0.03em; padding: 5px 14px;
  border-block-end: 1px solid var(--line); text-align: end; font-variant-numeric: tabular-nums; }
.lang td:first-child { text-align: start; letter-spacing: 0.08em; }
.lang .bar { width: 40%; padding-inline-end: 0; }
.lang .bar span { display: block; height: 7px; background: var(--accent); }
.lang tr:last-child td { border-block-end: none; }
.survey .basis { font-family: var(--data); font-size: 10px; letter-spacing: 0.06em; color: var(--ink-faint);
  padding-block: 8px 9px; padding-inline: 14px; border-block-start: 1.5px solid var(--ink); background: var(--paper-2); }
.gal-body p { font-family: var(--prose); font-size: 16px; max-width: 72ch; margin-block-end: 11px; }`;
// SOURCES is a paragraph, not a schedule; the second selector outranks the app's
// `.prose p`, so in the reading column it stays a footnote under the body
const provenanceCss = `.provenance, .prose p.provenance { font-family: var(--prose); font-size: 13.5px;
  line-height: 1.5; color: var(--ink-soft); max-width: 68ch; margin-block: 0 40px; margin-inline: 0; padding: 0 4px; }`;
const coverCss = `${surveyCss}\n${provenanceCss}`;
const galCss = `
.cover { margin-block: 0 34px; margin-inline: 0; background: var(--paper); border: 1.5px solid var(--ink);
  padding: 30px; position: relative; }
.cover::before { content: ""; position: absolute; inset: 8px; border: 1px solid var(--edge); pointer-events: none; }
.cover > * { position: relative; }
.cover h1 { font-family: var(--display); font-weight: 600; font-size: clamp(28px, 0.25rem + 4.38vw, 46px); letter-spacing: 0.16em; margin-block: 18px 4px; margin-inline: 0; }
.cover .kicker, .cover .set { font-family: var(--data); font-size: 11.5px; letter-spacing: 0.16em; color: var(--ink-soft); }
.cover .alt { display: block; margin-block-start: 6px; font-family: var(--data); font-size: 10px; letter-spacing: 0.16em; color: var(--ink-soft); }
.cover .alt a { color: var(--accent); }
${surveyCss}
.idx { width: 100%; border-collapse: collapse; border: 1.5px solid var(--ink); margin-block-start: 20px; }
.idx th { font-family: var(--data); font-size: 10px; letter-spacing: 0.16em; color: var(--ink-soft);
  text-align: start; padding: 7px 12px; border-block-end: 1.5px solid var(--ink); }
.idx td { font-family: var(--data); font-size: 12px; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; padding: 8px 12px;
  border-block-end: 1px solid var(--line); vertical-align: baseline; }
.idx td:first-child { color: var(--accent); font-weight: 600; }
.idx tr:last-child td { border-block-end: none; }
.idx .idx-sec td { font-size: 10px; letter-spacing: 0.16em; color: var(--ink-soft);
  background: var(--paper-2); border-block-start: 1.5px solid var(--ink); border-block-end: 1.5px solid var(--ink); }
.idx a { color: inherit; }
.idx .kvs { display: flex; flex-wrap: wrap; gap: 3px; margin-block-start: 5px; }
.idx .kv { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft);
  border: 1px solid var(--line); padding: 1px 5px; white-space: nowrap; }
.idx .kv i { font-style: normal; color: var(--accent); margin-inline-end: 4px; }
${provenanceCss}
.set-sec { font-family: var(--data); font-size: 11px; letter-spacing: 0.2em; font-weight: 600;
  color: var(--ink-soft); margin-block: 0 14px; margin-inline: 0; padding-block: 10px 0; padding-inline: 4px;
  border-block-start: 1.5px solid var(--ink); }
.sheet { scroll-margin-block-start: 16px; }`;

// --- general survey: every number on the cover comes from www/atlas.lit-ui-router.dev/data/census-files.json ---
// The plate is the checked-in master per-file snapshot census-scc.mjs writes at a named
// ref; the rollup below is census-overview.mjs's group-by-language query, recomputed here.
// Deliberately wider than any sheet (JSON, Markdown, config all count) and deliberately
// main, not this branch: the atlas's own drawings are a self-portrait, and appendix A3
// measures that on sheet 7's ruler from data/survey-self.json.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-files.json', import.meta.url), 'utf8'));
const byLang = new Map();
for (const r of PLATE.rows) {
  const l = byLang.get(r.lang) ?? { name: r.lang, count: 0, lines: 0, blank: 0, comment: 0, code: 0 };
  l.count += 1; l.lines += r.lines; l.blank += r.blank; l.comment += r.comment; l.code += r.code;
  byLang.set(r.lang, l);
}
const SURVEY_LANGS = [...byLang.values()].sort((a, b) => b.code - a.code || b.count - a.count);
const ssum = (k) => SURVEY_LANGS.reduce((a, r) => a + r[k], 0);
const SURVEY_TOTAL = { files: ssum('count'), tracked: PLATE.tracked, lines: ssum('lines'),
  blank: ssum('blank'), comment: ssum('comment'), code: ssum('code') };
const UNCLASSIFIED = SURVEY_TOTAL.tracked - SURVEY_TOTAL.files;
const PUBLISHED = PLATE.members.filter((m) => !m.private);
const INSTRUMENTS = PLATE.members.filter((m) => m.dir.startsWith('tools/')).length;
const SUBJECT = PUBLISHED.find((m) => m.name === 'lit-ui-router');
const COUNTED_AT = `${PLATE.ref} @ ${PLATE.sha}`;
const COUNTED_ON = PLATE.generatedAtTime.slice(0, 10);
// the flagship's publish date comes from the registry plate, never a typed day
const DOORS = JSON.parse(readFileSync(new URL('../data/census-doors.json', import.meta.url), 'utf8'));
const DOOR_N = DOORS.rows.length;
const DOOR_PKGS = new Set(DOORS.rows.map((r) => r.pkg)).size;
const NPM = JSON.parse(readFileSync(new URL('../data/census-npm.json', import.meta.url), 'utf8'));
const SHIPPED = NPM.rows.find((r) => r.name === 'lit-ui-router');
// npm's `version` is the latest TAG: main may sit on a release candidate that `rc`
// carries, so the repo's version has to be one the registry serves under SOME tag
const MAIN_TAG = SHIPPED && Object.entries(SHIPPED.tags ?? {}).find(([, v]) => v === SUBJECT?.version)?.[0];
if (!SHIPPED || !MAIN_TAG) throw new Error('build: census-files.json carries a lit-ui-router version census-npm.json serves under no dist-tag');
const MAIN_AHEAD = MAIN_TAG === 'latest' ? '' : ` · main at ${SUBJECT.version} · ${MAIN_TAG}`;
const num = (v) => v.toLocaleString('en-US');
const TOP_CODE = SURVEY_LANGS[0].code;
const survey = `<section class="survey" aria-label="general survey of the repository">
  <h2>GENERAL SURVEY — THE WHOLE TRACKED REPOSITORY, AS SHIPPED ON MAIN</h2>
  <div class="survey-tot">
    <div><span class="k">SLOC (CODE)</span><span class="v">${num(SURVEY_TOTAL.code)}</span></div>
    <div><span class="k">FILES COUNTED</span><span class="v">${num(SURVEY_TOTAL.files)}</span></div>
    <div><span class="k">LINES</span><span class="v">${num(SURVEY_TOTAL.lines)}</span></div>
    <div><span class="k">BLANKS</span><span class="v">${num(SURVEY_TOTAL.blank)}</span></div>
    <div><span class="k">COMMENTS</span><span class="v">${num(SURVEY_TOTAL.comment)}</span></div>
  </div>
  <table class="lang">
    <thead><tr><th>LANGUAGE</th><th>FILES</th><th>SLOC</th><th class="bar"><span class="vh">SLOC, AS A BAR</span></th></tr></thead>
    <tbody>${SURVEY_LANGS.map((l) => `<tr><td>${l.name}</td><td>${num(l.count)}</td><td>${num(l.code)}</td>` +
      `<td class="bar"><span style="width:${((l.code / TOP_CODE) * 100).toFixed(1)}%"></span></td></tr>`).join('')}</tbody>
  </table>
  <p class="basis">BASIS — every tracked file on ${COUNTED_AT} (${num(SURVEY_TOTAL.tracked)} paths, ${num(SURVEY_TOTAL.files)} of them a language scc can name; the other ${num(UNCLASSIFIED)} are binaries, dotfiles, and lockfiles — generated, and rightly left out) · scc 4.0.0 <code>Code</code> basis · counted ${COUNTED_ON} · every number above imported from <code>www/atlas.lit-ui-router.dev/data/census-files.json</code> · deliberately broader than the sheets' authored-source census, and deliberately main: this atlas's own branch would add a 29k-sloc self-portrait.</p>
</section>`;

const statBar = `<div class="stat-bar" role="group" aria-label="set statistics">
    <div><span class="k">REPOSITORY</span><span class="v">lit-ui-router · simshanith</span></div>
    <div><span class="k">INSTRUMENTS (tools/*)</span><span class="v">${INSTRUMENTS}</span></div>
    <div><span class="k">LATEST SHIPPED</span><span class="v">${SHIPPED.version} · ${SHIPPED.published}${MAIN_AHEAD}</span></div>
    <div><span class="k">PUBLISHABLE PACKAGES</span><span class="v">${PUBLISHED.length} · ${PUBLISHED.map((m) => `${m.name} ${m.version}`).join(' · ')}</span></div>
    <div><span class="k">SHEETS</span><span class="v">${TOTAL} altitudes · ${PLATES} plates · ${appendix.length + appendixLanes.length} in the appendix · whole plate cabinet counted at ${COUNTED_AT}</span></div>
  </div>`;

const galBody = `<div class="gal-body">
    <p>The source image — an isometric block city over a strategy-breeding harness — works because of three quiet decisions, and only one of them is the city: it maps <em>roles in a mechanism</em> rather than files; it spends its one visual scalar (height) on a true quantity; and it keeps a CONDITION field that says what is currently wrong. This set keeps those three decisions and lets everything else change with altitude.</p>
    <p>The result is an argument about form: a loop where there is a genuine cycle (sheet 1), panels where packages are too small to be cities (sheet 2), the full city where the measurement thesis is actually true (sheet 3), a massed spine where the family shares one core but the limbs never touch (sheet 4), a chart where edges would be fiction (sheet 5), and mostly prose where only a definition survives (sheet 6). Fitness peaks in the middle altitudes and collapses at both ends.</p>
    <p>Above the sixth altitude the set stops arguing about form and starts measuring. Sheets 7–10 are a survey quartet, each counting the same subject at a different boundary: what the repository holds (the monorepo by mass), what npm delivers (the sample app's <code>node_modules</code>, ${SHEET8_TIMES}× the app it serves), what the browser downloads (the docs deploy on the wire, where the prerendered prose tops the skyline and the lettering alone outweighs every routed app the site demonstrates), and who occupies the bytes after tree-shaking (the machine the router wraps is ${SHEET10_CORE_SHARE} of the bundle; the router itself, ${SHEET10_ROUTER_SHARE}). Sheet 11 cuts the same wire the other way, pricing ${DOOR_PKGS} package quarters and ${DOOR_N} doors one at a time. Sheet 12 leaves the wire and draws the monorepo as its own CI reads it, the pull-request task graph punched onto a register plate. Sheet 13 ages the city by commit date. Interactive lanes (1i, 2B and 12i) walk the plates they sit beside, and the routed set stands sheets 2 and 7 in the round. The appendix files plates whose subject is the atlas rather than the codebase: the sprite study behind the building sprites (appendix A1), and the survey office that turns the instrument on itself (appendix A2) — the census pipeline behind almost every number here, drawn as archive → probe stations → filed plates → drawings, introspected from the generator at build time, and walked live in its lane A2i. Appendix A3 turns sheet 7's ruler on the atlas itself: its drawing office, survey office, routed site and site build, massed beside the codebase they draw.</p>
  </div>`;

const cover = `<header class="cover">
  <span class="kicker">A DRAWING SET · AFTER A FORM SEEN IN THE WILD · lit-ui-router</span>
  <h1>THE ALTITUDE ATLAS</h1>
  <span class="set">SAME SUBJECT AT EVERY SCALE — THE FORM CHANGES BECAUSE THE TRUTH DOES</span>
  <span class="alt">THIS IS THE FLAT SET · THE SAME DRAWINGS ROUTED AS ONE lit-ui-router APP: <a href="/">THE ROUTED SET ↗</a></span>
  ${statBar}
  ${survey}
  ${galBody}
  <table class="idx">
    <thead><tr><th>SHEET</th><th>ALTITUDE</th><th>FORM</th><th>FIT VERDICT</th></tr></thead>
    <tbody>${verdicts.map(idxRow).join('')}<tr class="idx-sec"><td colspan="4">APPENDIX — PLATES ABOUT THE ATLAS, NOT THE CODEBASE</td></tr>${appendixIdx.map(idxRow).join('')}</tbody>
  </table>
</header>`;

const provenance = `<p class="provenance">SOURCES — module inventory & manifests read from the repo at branch www/atlas · npm dates from www/atlas.lit-ui-router.dev/data/census-npm.json, which prints its own registry-read date on sheet 4 · every plate in www/atlas.lit-ui-router.dev/data/ counted at ${COUNTED_AT} in one pass — plate 7A's test light included, metered at that ref by www/atlas.lit-ui-router.dev/generator/census-shadow.mjs · cover general survey = ${COUNTED_AT}, counted ${COUNTED_ON}, imported from www/atlas.lit-ui-router.dev/data/census-files.json · eslint-plugin-lit-ui-router is counted on every plate and drawn or scheduled on sheets 2, 4, 7, 7A, 7B, 11, 12 and 13 · sheet 5 positions are editorial. FILES — www/atlas.lit-ui-router.dev/ holds each sheet standalone, megacanvas.html, and this gallery. DRAWN BY FABLE (CLAUDE, AI) FOR SHANE DANIEL.</p>`;

writeFileSync(join(OUT, 'gallery.html'), page('The Altitude Atlas', `<style>${galCss}</style>
${cover}
${sheets.map((s) => (s.num === '2A'
  // sheet 2B is an interactive lane, not an SVG plate, so it rides in the
  // gallery beside the sheet it is the sibling of rather than at the end
  ? `${sheetSection(s)}\n<div id="sheet-2B"></div>\n${couplingBenchSection()}`
  // sheet 1i walks sheet 1, so it rides right behind it
  : s.num === 1 ? `${sheetSection(s)}\n${loopWalkedSection()}`
  : sheetSection(s))).join('\n')}
${register12iSection()}
<h2 class="set-sec" id="appendix">APPENDIX — PLATES ABOUT THE ATLAS, NOT THE CODEBASE</h2>
${appendix.map((s) => sheetSection(s)).join('\n')}
${pipelineSection()}
${provenance}`,
{ desc: 'A drawing set over thirteen altitudes: the lit-ui-router codebase and its ecosystems, each altitude in the form it earns.' }));

// --- README for the folder ---
// THESIS and GEN_NOTES are shared with the routed app's colophon: the README
// prints them as markdown, the manifest carries the same strings as HTML.
const THESIS = `Riffs on an isometric codebase-visualization form seen in the wild; the
notes on each sheet argue where that form fits and where it lies.`;
const GEN_NOTES = `Static HTML pages, written by \`node generator/build.mjs .\` from this directory. The SVG sheets need nothing;
the interactive lanes (1i, 2B, 12i and appendix A2i) load cytoscape 3.31.0 from cdnjs, which
\`generator/stage-site.mjs\` vendors for hosting. \`app/\` is the same set as a prerendered lit-ui-router
app; \`build.mjs\` emits its fragments and manifest, and the glTF binaries of its three plates in the round
(\`city\`, \`plant\`, \`bricks\`), which only the app draws, in Google's model-viewer. \`generator/check-scenes.mjs\` checks
the three models and drives the built app's 3D plates in headless Chromium. On the published site the app owns the root
(\`/\`, \`/sheet/7\`, \`/city\`) and this flat set is staged beside it under \`/set/\` as the version to
compare against; the two link to each other (the app's rail and crumbs, the gallery's cover).
Light theme is graphite-on-vellum; dark is cyanotype.
Since 2026-09-06 every label on the plates draws in the data face (DIN 2014, Barlow Semi Condensed off the kit) rather than the system monospace; mono is reserved for code.
Generated 2026-08-16 by Fable (Claude, AI).
Every plate in \`data/\` — versions, dates and all — was re-counted at ${COUNTED_AT} in one pass,
plate 7A's test light included: \`generator/census-shadow.mjs\` re-meters it at the same ref. The cover's general survey — every
tracked file on the scc 4.0.0 \`Code\` basis, ${COUNTED_AT} — is imported from
\`data/census-files.json\`, the master snapshot \`generator/census-scc.mjs\` writes;
\`generator/census-overview.mjs\` prints the same rollup on the terminal.`;
/** The same prose as one HTML paragraph: line breaks flow, \`code\` becomes <code>. */
const mdLine = (md) => md.replace(/\n/g, ' ').replace(/`([^`]+)`/g, '<code>$1</code>');

writeFileSync(join(OUT, 'README.md'), `# www/atlas.lit-ui-router.dev/ — The Altitude Atlas

A drawing set: one subject, the lit-ui-router monorepo, surveyed at every altitude. Thirteen
altitudes on ${PLATES} plates — the numbered sheets, their A/B alternates and three interactive lanes —
each in the form that altitude earns, with sheets 2 and 7 standing in the round in the routed app, and an appendix of ${appendix.length + appendixLanes.length} more about the atlas itself. Sheets 7–10 are a survey
quartet (the workspace by mass, a consumer's node_modules, a deploy on the wire, the inside of
one bundle); 11 prices every published entry alone; appendix A2 draws the census pipeline that
measured the rest, and A3 masses the atlas itself on sheet 7's ruler beside the codebase. The form riffs on an isometric codebase visualization seen in the wild; the notes on
each sheet argue where that form fits and where it lies.

| Sheet | Altitude | Form |
| --- | --- | --- |
${[...sheets, ...lanes].sort((a, b) => parseInt(a.num, 10) - parseInt(b.num, 10) || String(a.num).localeCompare(String(b.num)))
  .map((s) => `| [${s.num}](${fname(s)}) | ${s.scale} | ${s.form} |`).join('\n')}

## Appendix — plates about the atlas, not the codebase

| Plate | Subject | Form |
| --- | --- | --- |
${[...appendix, ...appendixLanes].map((s) => `| [${s.num}](${fname(s)}) | ${s.scale} | ${s.form} |`).join('\n')}

- \`megacanvas.html\` — the ${sheets.length} SVG plates on one page, ascent order.
- \`gallery.html\` — cover, index and the full set, interactive lanes included.

**Build and host.** From the repo root, in order:

\`\`\`bash
node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev  # the flat set + the app's fragments and manifest
npm --prefix www/atlas.lit-ui-router.dev/app run build               # the routed app, prerendered
npm --prefix www/atlas.lit-ui-router.dev/app run build:artifact      # the single-file build published as a claude.ai Artifact
node www/atlas.lit-ui-router.dev/generator/check-scenes.mjs www/atlas.lit-ui-router.dev  # checks the three models, drives the built app's 3D plates in headless Chromium
cd www/atlas.lit-ui-router.dev && mise exec -- node generator/stage-site.mjs   # dist/: app at /, this set at /set/, vendored libs
mise exec -- pnpm exec wrangler pages deploy dist --project-name altitude-atlas --branch www/atlas --commit-dirty=true
\`\`\`

**The card pictures.** Every card on the cover carries a 300 x 400 picture of its own
plate — \`app/public/thumbs/<id>.webp\` and \`<id>-dark.webp\`, one per theme, tracked
generated files like the fragments beside them. \`generator/thumbs.mjs\` draws them by
photographing the flat set above in headless Chromium (playwright, reached through
\`tools/embed-heights\`; the lanes' cytoscape is served from \`app/node_modules\`), and the
three 3D cards (\`city\`, \`plant\`, \`bricks\`) from the BUILT app's prerendered \`/city/\`, \`/plant/\`
and \`/bricks/\` pages, each \`<model-viewer>\` on a transparent clear, its pins hidden for the shot. The three
models, \`app/public/models/city.glb\`, \`plant.glb\` and \`bricks.glb\`, are tracked generated files
\`build.mjs\` writes beside the fragments (\`generator/city-glb.mjs\` and \`brick-glb.mjs\` on \`glb.mjs\`). \`build.mjs\` REFUSES to emit a manifest whose card has no picture, so a new
plate takes the full order:

\`\`\`bash
node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev   # writes the flat set, then stops on the missing picture
npm --prefix www/atlas.lit-ui-router.dev/app run build                             # the app the 3D cards are shot from
node www/atlas.lit-ui-router.dev/generator/thumbs.mjs www/atlas.lit-ui-router.dev  # photographs it
node www/atlas.lit-ui-router.dev/generator/build.mjs www/atlas.lit-ui-router.dev   # green
npm --prefix www/atlas.lit-ui-router.dev/app run build                             # the app with every picture
\`\`\`

The picture is the card's BACKDROP, not a strip across its head: the whole plate laid at
the card's width, top-anchored, transparent everywhere the ink is not, so the card's gradient
ground shows through it under the head window, with the opaque text panel over the rest. Where the default reads as
grey at card width, the plate gets a row in \`thumbs.mjs\`'s one \`TUNING\` table (\`zoom\` to
enlarge it into a detail, \`x\`/\`focus\` to place the card box, \`fit: 'contain'\` to letterbox
the whole drawing instead, \`crop\` to fit the drawing band alone, \`target\` for a lane's
canvas) and nothing else changes. To try a row without touching
the tracked pictures: \`thumbs.mjs <outdir> --only <ids> --out <dir> --tuning <file.json>\`.

Live at <https://atlas.lit-ui-router.dev/> — the app owns the root (\`/\`, \`/sheet/7/\`, \`/city/\`,
\`/plant/\`, \`/bricks/\`, \`/log\`) and the flat set sits beside it under \`/set/\`; the two link to each other. The SVG
sheets need nothing; the interactive lanes (1i, 2B, 12i, A2i) load cytoscape 3.31.0, which the stage step
vendors, and the app-only plates in the round (2·3D, 7·3D, 7B·3D) bundle \`@google/model-viewer\`. \`app/\` is the same set as a prerendered
lit-ui-router app (see \`app/README.md\`); \`HISTORY.md\` is the verbatim revision record, parsed
into the app's \`/log\` at build time. This file is written by \`build.mjs\`; edit the emitter, not the output.

**The cabinet.** Every figure on every plate is read from \`data/*.json\`, written by the
\`generator/census-*.mjs\` probes at one ref — currently ${COUNTED_AT} — on the scc 4.0.0
\`Code\` basis. Lookups throw on a missing row; nothing is hand-pasted. One plate stands outside the
cabinet: \`data/survey-self.json\`, which \`generator/survey-self.mjs\` measures from an archive of the
atlas's own branch for appendix A3, because main does not hold the atlas. \`INITIATIVES.md\` records
the pipeline's design and the traps of refreshing it.

**Type and theme.** Plates letter in the data face (DIN 2014 on the site's kit, Barlow Semi
Condensed off it); monospace is reserved for code. Light is graphite-on-vellum, dark is
cyanotype. Drawn by Claude (Anthropic) with the maintainer, 2026-08-16 onward.
`);

// --- app/ — the same set, cut into fragments for the lit-ui-router SPA ---
const appSheets = emitApp({
  sheets,
  appendix,
  interactive: [[sheet1i, loopWalkedSection], [sheet2b, sheet2bPage], [sheet12i, register12iSection]],
  appendixInteractive: [[sheetA2i, pipelineSection]],
  // The cover, as the gallery renders it: the app draws the same bytes rather
  // than a paraphrase, so the two indexes cannot drift.
  index: INDEX_BY_NUM,
  cover: { css: coverCss, statBar, survey, prose: galBody, provenance, thesis: mdLine(THESIS), notes: mdLine(GEN_NOTES) },
  outDir: OUT,
  fname,
});

// PLATES counts the three interactive lanes with a standalone page of their own
console.log('built', PLATES, 'sheets +', appendix.length + appendixLanes.length, 'appendix + megacanvas + gallery + README →', OUT);
console.log('emitted', appSheets, 'app fragments + manifest →', join(OUT, 'app/public'));

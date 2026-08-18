import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { page, sheetSection, TOTAL } from './chrome.mjs';
import { sheet1 } from './sheet1.mjs';
import { sheet2 } from './sheet2.mjs';
import { sheet2a } from './sheet2a.mjs';
import { sheet3 } from './sheet3.mjs';
import { sheet3a } from './sheet3a.mjs';
import { sheet3b } from './sheet3b.mjs';
import { sheet4 } from './sheet4.mjs';
import { sheet5 } from './sheet5.mjs';
import { sheet6 } from './sheet6.mjs';
import { sheet7 } from './sheet7.mjs';
import { sheet7a } from './sheet7a.mjs';
import { sheet7b } from './sheet7b.mjs';
import { sheet8 } from './sheet8.mjs';
import { sheet9 } from './sheet9.mjs';
import { sheet10 } from './sheet10.mjs';
import { sheet11 } from './sheet11.mjs';
import { sheet12 } from './sheet12.mjs';
import { sheet13 } from './sheet13.mjs';

const OUT = process.argv[2];
if (!OUT) throw new Error('usage: node build.mjs <outdir>');
mkdirSync(OUT, { recursive: true });

const sheets = [sheet1, sheet2, sheet2a, sheet3, sheet3a, sheet3b, sheet4, sheet5, sheet6, sheet7, sheet7a, sheet7b, sheet8, sheet9, sheet10, sheet11, sheet12, sheet13];
const fname = (s) => `sheet-${s.num}-${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.html`;

// --- individual sheet files ---
for (const s of sheets) {
  writeFileSync(join(OUT, fname(s)), page(`${s.title} — Sheet ${s.num} of ${TOTAL}`, sheetSection(s), { desc: s.caption }));
}

// --- megacanvas ---
const rail = `<nav class="alt-rail" aria-label="altitudes">
${sheets.map((s) => `<a href="#sheet-${s.num}"><span class="alt-n">ALT ${s.num}</span> ${s.title}</a>`).join('\n')}
</nav>`;
const megaCss = `
.mega-head { max-width: 1180px; margin: 0 auto 26px; }
.mega-head h1 { font-family: var(--mono); font-size: clamp(20px, 3.4vw, 30px); letter-spacing: 0.12em; }
.mega-head p { color: var(--ink-soft); max-width: 70ch; margin-top: 6px; }
.alt-rail { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 2px;
  max-width: 1180px; margin: 0 auto 30px; background: var(--paper); border: 1.5px solid var(--ink); }
.alt-rail a { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em; text-decoration: none;
  color: var(--ink); padding: 8px 12px; border-right: 1px solid var(--line); flex: 1 1 auto; text-align: center; }
.alt-rail a:hover { background: var(--paper-2); }
.alt-rail .alt-n { color: var(--accent); font-weight: 600; }
.sheet { scroll-margin-top: 64px; }`;
writeFileSync(join(OUT, 'megacanvas.html'), page('The Megacanvas — The Altitude Atlas', `<style>${megaCss}</style>
<header class="mega-head">
  <h1>THE MEGACANVAS</h1>
  <p>The full drawing set on one surface, in ascent order: one package, its companions, the monorepo that ships them, the family they belong to, the ecosystem that family competes in, and routing as such — plus a survey quartet: the monorepo by mass, the sample app's node_modules as a delivered city, the docs deploy as a shipped city, and the inside of one bundle after tree-shaking — then the same wire cut the other way, every published entry priced alone, and the same monorepo as its CI reads it — and finally the same city surveyed in time, every wall dated by the commit that laid it. Thirteen sheets in ascent; the form changes at every altitude because the truth does.</p>
</header>
${rail}
${sheets.map((s) => sheetSection(s)).join('\n')}`,
{ desc: 'All thirteen sheets of the lit-ui-router drawing set on one page.' }));

// --- gallery / artifact ---
const verdicts = [
  ['1', 'ONE PACKAGE', 'CLOSED LOOP', 'strong fit — the render cycle is a genuine circuit'],
  ['2', 'COMPANIONS', 'BRICK ASSEMBLY', 'exploded: every coupling is a published stud on core — and the server takes none'],
  ['2A', 'COMPANIONS', 'COUPLING PLAN', 'alternate plate — the same joints at reading size; nothing plugs anything but the wall'],
  ['3', 'MONOREPO', 'ISOMETRIC CITY', 'the yard re-massed from sloc × files — gate severity in colour: the smallest blocks stop the line'],
  ['3A', 'TWO TASK MANAGERS', 'COUPLING SCHEMATIC', 'turbo caches mise — and the loop is a DAG in a loop costume: the 7 callers and the 7 called never touch'],
  ['3B', 'CI TASK GRAPH', 'ISOMETRIC GRAPH CITY', 'footprint = watched files, height = command sloc — 124 of 158 blocks are one-line pads; the tallest tower is a 291-line test'],
  ['4', 'ECOSYSTEM', 'MASSED SPINE', 'every limb re-massed from sloc × files — one red gate: react pins core as a dependency'],
  ['5', 'JS ECOSYSTEM', 'POSITIONED CHART', 'no shared mechanism — position, not edges'],
  ['6', 'EVERYTHING', 'CORE SAMPLE', 'prose outranks pictures; one small column earns its place'],
  ['7', 'MONOREPO, MEASURED', 'MEASURED CITY', 'the census with districts and roads — tests as annexes, every edge cited: the 8-line harness stops every PR'],
  ['7A', 'MONOREPO, TESTED', 'SHADOW PLAN', 'the shadow survey — the tests are the light: where a suite reaches it burns near-full (98% of 5,539 metered lines); 2,608 sloc of instruments and 1,375 of CLI wrappers never see light'],
  ['7B', 'MONOREPO, RUNNING', 'WORKING CITY', 'the synthesis plate — rust, steam, lamps and pipes on one city: every pipe connects, the flagship runs old AND hot, and the only alarm at HEAD rings over the drawings themselves'],
  ['8', 'ONE CONSUMER', 'DELIVERED CITY', 'node_modules surveyed — 295× the app, two swaps it argued for'],
  ['9', 'ONE DEPLOY', 'SHIPPED CITY', 'the wire survey — Dickens outweighs the code'],
  ['10', 'ONE BUNDLE', 'BUNDLED CITY', 'tree-shaking’s verdict — core is 23%, the router 4.0% — one lit'],
  ['11', 'FOUR PACKAGES', 'ENTRY QUARTERS', 'the split view — fifteen doors priced alone'],
  ['12', 'PR CI GRAPH', 'REGISTER PLATE', 'the punched inventory — 68% of the graph runs nothing'],
  ['13', 'WORKSPACE × TIME', 'WEATHERING MAP', '83% of the city is summer stone — and the port\u2019s original masonry carries the hottest edges'],
];
const galCss = `
.cover { max-width: 1180px; margin: 0 auto 34px; background: var(--paper); border: 1.5px solid var(--ink);
  padding: 30px; position: relative; }
.cover::before { content: ""; position: absolute; inset: 8px; border: 1px solid var(--edge); pointer-events: none; }
.cover > * { position: relative; }
.cover h1 { font-family: var(--mono); font-size: clamp(26px, 4.6vw, 44px); letter-spacing: 0.16em; margin: 18px 0 4px; }
.cover .kicker, .cover .set { font-family: var(--mono); font-size: 11px; letter-spacing: 0.16em; color: var(--ink-soft); }
.stat-bar { display: flex; flex-wrap: wrap; gap: 0; border: 1.5px solid var(--ink); margin: 22px 0 26px; background: var(--paper-2); }
.stat-bar > div { padding: 8px 16px 10px; border-right: 1px solid var(--ink); flex: 1 1 auto; }
.stat-bar > div:last-child { border-right: none; }
.stat-bar .k { display: block; font-size: 8.5px; letter-spacing: 0.16em; color: var(--ink-soft); margin-bottom: 3px; }
.stat-bar .v { font-size: 14px; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
.gal-body p { font-size: 15.5px; max-width: 72ch; margin-bottom: 11px; }
.idx { width: 100%; border-collapse: collapse; border: 1.5px solid var(--ink); margin-top: 20px; }
.idx th { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.16em; color: var(--ink-soft);
  text-align: left; padding: 7px 12px; border-bottom: 1.5px solid var(--ink); }
.idx td { font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.04em; padding: 8px 12px;
  border-bottom: 1px solid var(--line); vertical-align: baseline; }
.idx td:first-child { color: var(--accent); font-weight: 600; }
.idx tr:last-child td { border-bottom: none; }
.idx a { color: inherit; }
.provenance { font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em; color: var(--ink-faint);
  max-width: 1180px; margin: 0 auto 40px; padding: 0 4px; }
.sheet { scroll-margin-top: 16px; }`;

const cover = `<header class="cover">
  <span class="kicker">A DRAWING SET · AFTER A FORM SEEN IN THE WILD · lit-ui-router</span>
  <h1>THE ALTITUDE ATLAS</h1>
  <span class="set">SAME SUBJECT AT EVERY SCALE — THE FORM CHANGES BECAUSE THE TRUTH DOES</span>
  <div class="stat-bar" role="group" aria-label="set statistics">
    <div><span class="k">REPOSITORY</span><span class="v">lit-ui-router · simshanith</span></div>
    <div><span class="k">PUBLISHABLE PACKAGES</span><span class="v">4</span></div>
    <div><span class="k">INSTRUMENTS (tools/*)</span><span class="v">16</span></div>
    <div><span class="k">LATEST SHIPPED</span><span class="v">1.9.0 · 2026-08-01</span></div>
    <div><span class="k">SHEETS</span><span class="v">13 · drawn 2026-08-16–17</span></div>
  </div>
  <div class="gal-body">
    <p>The source image — an isometric block city over a strategy-breeding harness — works because of three quiet decisions, and only one of them is the city: it maps <em>roles in a mechanism</em> rather than files; it spends its one visual scalar (height) on a true quantity; and it keeps a CONDITION field that says what is currently wrong. This set keeps those three decisions and lets everything else change with altitude.</p>
    <p>The result is an argument about form: a loop where there is a genuine cycle (sheet 1), panels where packages are too small to be cities (sheet 2), the full city where the measurement thesis is actually true (sheet 3), a massed spine where the family shares one core but the limbs never touch (sheet 4), a chart where edges would be fiction (sheet 5), and mostly prose where only a definition survives (sheet 6). Fitness peaks in the middle altitudes and collapses at both ends.</p>
    <p>The set has grown since its first printing. Sheet 1 is now REV C — first staged isometric at the client's ask, then given one deliberate metaphor break: the document is drawn the way Firefox's old Tilt inspector drew it, a browser window whose DOM rises as stacked plates. Sheets 7–10 are a survey quartet: what we wrote (the monorepo by mass), what npm delivered (the sample app's <code>node_modules</code>, 318× the app it serves), what the browser downloads (the docs deploy on the wire — where the demo corpora and the fonts outweigh every line of code), and who actually occupies the bytes after tree-shaking (one bundle opened up — the machine the router wraps is 23% of the wire; the router itself, 4.0%). The set has already changed its own subject twice: sheet 8's rev A drew lodash as the tallest building in the delivered city, and that drawing became a merged <code>lodash-es</code> swap — the building halved, the wire chunk cut 84%; then sheet 10's first printing drew two complete lit majors riding in every app, and that drawing became the merged single-lit + lazy api-viewer dedupe (#618). Sheets 8 and 9 now stand at REV C and sheet 10 at REV B, each remeasured after the merge it argued for; sheet 11 cuts the same wire the other way — four package quarters, fifteen doors, each priced alone. Sheet 12 leaves the wire entirely and draws the monorepo as its own CI reads it: the pull-request task graph punched onto a register plate, where two thirds of the holes turn out to be scaffolding.</p>
  </div>
  <table class="idx">
    <thead><tr><th>SHEET</th><th>ALTITUDE</th><th>FORM</th><th>FIT VERDICT</th></tr></thead>
    <tbody>${verdicts.map(([n, a, f, v]) => `<tr><td><a href="#sheet-${n}">S${n}</a></td><td>${a}</td><td>${f}</td><td>${v}</td></tr>`).join('')}</tbody>
  </table>
</header>`;

writeFileSync(join(OUT, 'gallery.html'), page('The Altitude Atlas', `<style>${galCss}</style>
${cover}
${sheets.map((s) => sheetSection(s)).join('\n')}
<p class="provenance">SOURCES — module inventory & manifests read from the repo at branch worktree-altitude-atlas · npm dates fetched 2026-08-16 · sheet 5 positions are editorial. FILES — diagrams/ holds each sheet standalone, megacanvas.html, and this gallery. DRAWN BY FABLE (CLAUDE, AI) FOR SHANE DANIEL.</p>`,
{ desc: 'A thirteen-sheet drawing set: the lit-ui-router codebase and its ecosystems, each altitude in the form it earns.' }));

// --- README for the folder ---
writeFileSync(join(OUT, 'README.md'), `# diagrams/ — The Altitude Atlas

A drawing set: one subject surveyed at every altitude, thirteen sheets (sheets 7–10 are a survey
quartet — the monorepo by mass, the sample app's node_modules, the docs deploy on the
wire, and the inside of one bundle — and sheet 11 cuts that wire the other way, pricing
every published entry alone), each in the form that altitude earns. Riffs on an isometric codebase-visualization form seen in the wild; the
notes on each sheet argue where that form fits and where it lies.

| Sheet | Altitude | Form |
| --- | --- | --- |
${sheets.map((s) => `| [${s.num}](${fname(s)}) | ${s.scale} | ${s.form} |`).join('\n')}

- \`megacanvas.html\` — all thirteen sheets on one page, ascent order.
- \`gallery.html\` — cover, index, and the full set (also published as an Artifact).

Static HTML, no build, no dependencies. Light theme is graphite-on-vellum; dark is cyanotype.
Regenerate with \`node generator/build.mjs .\` from this directory.
Generated 2026-08-16 by Fable (Claude, AI); npm dates fetched same day.
`);

console.log('built', sheets.length, 'sheets + megacanvas + gallery + README →', OUT);

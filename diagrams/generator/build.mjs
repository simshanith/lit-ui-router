import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { page, sheetSection, CSS, PROJECT } from './chrome.mjs';
import { sheet1 } from './sheet1.mjs';
import { sheet2 } from './sheet2.mjs';
import { sheet3 } from './sheet3.mjs';
import { sheet4 } from './sheet4.mjs';
import { sheet5 } from './sheet5.mjs';
import { sheet6 } from './sheet6.mjs';
import { sheet7 } from './sheet7.mjs';
import { sheet8 } from './sheet8.mjs';
import { sheet9 } from './sheet9.mjs';

const OUT = process.argv[2];
if (!OUT) throw new Error('usage: node build.mjs <outdir>');
mkdirSync(OUT, { recursive: true });

const sheets = [sheet1, sheet2, sheet3, sheet4, sheet5, sheet6, sheet7, sheet8, sheet9];
const fname = (s) => `sheet-${s.num}-${s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.html`;

// --- individual sheet files ---
for (const s of sheets) {
  writeFileSync(join(OUT, fname(s)), page(`${s.title} — Sheet ${s.num} of ${sheets.length}`, sheetSection(s), { desc: s.caption }));
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
writeFileSync(join(OUT, 'megacanvas.html'), page('The Megacanvas — Six Altitudes, Nine Sheets', `<style>${megaCss}</style>
<header class="mega-head">
  <h1>THE MEGACANVAS</h1>
  <p>The full drawing set on one surface, in ascent order: one package, its companions, the monorepo that ships them, the family they belong to, the ecosystem that family competes in, and routing as such — plus a survey trilogy: the monorepo by mass, the sample app's node_modules as a delivered city, and the docs deploy as a shipped city. Six altitudes, nine sheets; the form changes at every altitude because the truth does.</p>
</header>
${rail}
${sheets.map((s) => sheetSection(s)).join('\n')}`,
{ desc: 'All nine sheets of the lit-ui-router drawing set on one page.' }));

// --- gallery / artifact ---
const verdicts = [
  ['1', 'ONE PACKAGE', 'CLOSED LOOP', 'strong fit — the render cycle is a genuine circuit'],
  ['2', 'COMPANIONS', 'SOCKETS + PANELS', 'form breaks at 3–9 modules; keep the panel, socket the blocks'],
  ['3', 'MONOREPO', 'ISOMETRIC CITY', 'the flagship — a yard of instruments around one crate'],
  ['4', 'FAMILY', 'SPINE + RIBS', 'a city would fake adjacency; liveness is the real ink'],
  ['5', 'JS ECOSYSTEM', 'POSITIONED CHART', 'no shared mechanism — position, not edges'],
  ['6', 'EVERYTHING', 'CORE SAMPLE', 'prose outranks pictures; one small column earns its place'],
  ['7', 'MONOREPO, MEASURED', 'MEASURED CITY', 'the census — files as footprint, lines as height, tests as annexes'],
  ['8', 'ONE CONSUMER', 'DELIVERED CITY', 'node_modules surveyed — 357× the app it serves'],
  ['9', 'ONE DEPLOY', 'SHIPPED CITY', 'the wire survey — Dickens outweighs the code'],
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
  <span class="kicker">A DRAWING SET · AFTER A FORM SEEN IN THE WILD · ${PROJECT}</span>
  <h1>SIX ALTITUDES</h1>
  <span class="set">SAME SUBJECT AT EVERY SCALE — THE FORM CHANGES BECAUSE THE TRUTH DOES</span>
  <div class="stat-bar" role="group" aria-label="set statistics">
    <div><span class="k">REPOSITORY</span><span class="v">lit-ui-router · simshanith</span></div>
    <div><span class="k">PUBLISHABLE PACKAGES</span><span class="v">4</span></div>
    <div><span class="k">INSTRUMENTS (tools/*)</span><span class="v">16</span></div>
    <div><span class="k">LATEST SHIPPED</span><span class="v">1.9.0 · 2026-08-01</span></div>
    <div><span class="k">SHEETS</span><span class="v">9 · drawn 2026-08-16</span></div>
  </div>
  <div class="gal-body">
    <p>The source image — an isometric block city over a strategy-breeding harness — works because of three quiet decisions, and only one of them is the city: it maps <em>roles in a mechanism</em> rather than files; it spends its one visual scalar (height) on a true quantity; and it keeps a CONDITION field that says what is currently wrong. This set keeps those three decisions and lets everything else change with altitude.</p>
    <p>The result is an argument about form: a loop where there is a genuine cycle (sheet 1), panels where packages are too small to be cities (sheet 2), the full city where the measurement thesis is actually true (sheet 3), liveness where the facts are temporal (sheet 4), a chart where edges would be fiction (sheet 5), and mostly prose where only a definition survives (sheet 6). Fitness peaks in the middle altitudes and collapses at both ends.</p>
    <p>The set has grown since its first printing. Sheet 1 is now REV C — first staged isometric at the client's ask, then given one deliberate metaphor break: the document is drawn the way Firefox's old Tilt inspector drew it, a browser window whose DOM rises as stacked plates. Sheets 7–9 are a survey trilogy: what we wrote (the monorepo by mass), what npm delivered (the sample app's <code>node_modules</code>, 357× the app it serves), and what the browser downloads (the docs deploy on the wire — where the demo corpora and the fonts outweigh every line of code).</p>
  </div>
  <table class="idx">
    <thead><tr><th>SHEET</th><th>ALTITUDE</th><th>FORM</th><th>FIT VERDICT</th></tr></thead>
    <tbody>${verdicts.map(([n, a, f, v], i) => `<tr><td><a href="#sheet-${n}">S${n}</a></td><td>${a}</td><td>${f}</td><td>${v}</td></tr>`).join('')}</tbody>
  </table>
</header>`;

writeFileSync(join(OUT, 'gallery.html'), page('Six Altitudes', `<style>${galCss}</style>
${cover}
${sheets.map((s) => sheetSection(s)).join('\n')}
<p class="provenance">SOURCES — module inventory & manifests read from the repo at branch worktree-altitude-atlas · npm dates fetched 2026-08-16 · sheet 5 positions are editorial. FILES — diagrams/ holds each sheet standalone, megacanvas.html, and this gallery. DRAWN BY FABLE (CLAUDE, AI) FOR SHANE DANIEL.</p>`,
{ desc: 'A nine-sheet drawing set: the lit-ui-router codebase and its ecosystems, each altitude in the form it earns.' }));

// --- README for the folder ---
writeFileSync(join(OUT, 'README.md'), `# diagrams/ — Six Altitudes

A drawing set: six altitudes over the same subject, nine sheets (sheets 7–9 are a survey
trilogy — the monorepo by mass, the sample app's node_modules, the docs deploy on the
wire), each in the form that altitude earns. Riffs on an isometric codebase-visualization form seen in the wild; the
notes on each sheet argue where that form fits and where it lies.

| Sheet | Altitude | Form |
| --- | --- | --- |
${sheets.map((s) => `| [${s.num}](${fname(s)}) | ${s.scale} | ${s.form} |`).join('\n')}

- \`megacanvas.html\` — all nine sheets on one page, ascent order.
- \`gallery.html\` — cover, index, and the full set (also published as an Artifact).

Static HTML, no build, no dependencies. Light theme is graphite-on-vellum; dark is cyanotype.
Regenerate with \`node generator/build.mjs .\` from this directory.
Generated 2026-08-16 by Fable (Claude, AI); npm dates fetched same day.
`);

console.log('built', sheets.length, 'sheets + megacanvas + gallery + README →', OUT);

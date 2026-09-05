import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, isoBlock, isoPt, keyRow } from './helpers.mjs';
import { depthSort, solidFaces } from './iso-hidden.mjs';

const P = 's8';
const OX = 500, OY = 130;

// ---- census: every delivered number below comes from diagrams/data/census-nm.json ----
// The plate is the checked-in snapshot written by census-nm.mjs: the production
// closure of one app (BFS over dependencies + installed peers; pnpm auto-installs
// peers), resolved and measured inside an installed and built archive of a named
// ref rather than in a working tree. Delivered code = .js/.mjs/.cjs/.ts/.css/.html
// lines on disk; d.ts counted separately (the annex). Workspace-linked packages
// measure dist/ — their registry-delivered shape. This file holds the drawing
// order, the hand-placed districts and the prose only.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-nm.json', import.meta.url), 'utf8'));
const ROW = new Map(PLATE.rows.map((r) => [r.name, r]));
const BASIS = `measured at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)}), closure of ${PLATE.app}`;
const fmt = (v) => v.toLocaleString('en-US');

// Drawing order per district — badge numbers follow it, so it is kept by hand.
// Counts and versions are read from the plate; a name the plate does not carry
// is a build error, and a package the plate carries that no district draws is too.
const ORDER = {
  workspace: [
    'sample-app-shared', 'ui-router-server', 'lit-ui-router',
    'sample-app-routes', 'ui-router-navigation-location-plugin',
  ],
  registry: [
    'lodash-es', 'dompurify', 'hono', '@uirouter/core', 'marked', 'lit-html',
    '@uirouter/visualizer', '@oxc-project/runtime', '@lit/reactive-element', 'preact',
    'd3-hierarchy', '@uirouter/dsr', 'tslib', '@uirouter/sticky-states',
    'd3-interpolate', 'd3-color', '@lit-labs/ssr-dom-shim', 'lit-element', 'lit',
    'lit-dialog', '@api-viewer/docs', '@api-viewer/tabs', '@api-viewer/common',
    'custom-elements-manifest', '@types/marked', '@types/dompurify', '@types/trusted-types',
  ],
};

const item = (name) => {
  const r = ROW.get(name);
  if (!r) throw new Error(`sheet 8: package ${name} is missing from diagrams/data/census-nm.json`);
  // unpublished workspace members carry 0.0.0 — no version worth printing
  return { name, label: r.version === '0.0.0' ? name : `${name} ${r.version}`,
    f: r.f, l: r.l, df: r.df, dl: r.dl };
};
const DATA = {
  // The app is what the closure hangs off, so the plate does not carry a row for
  // it; its own src is hand-counted by the same ruler, for scale.
  consumer: [{ name: 'sample-app-lit-vanilla', label: 'sample-app-lit-vanilla', f: 11, l: 592, df: 0, dl: 0 }],
  workspace: ORDER.workspace.map(item),
  registry: ORDER.registry.map(item),
};
const missed = PLATE.rows.filter((r) => !ORDER.workspace.includes(r.name) && !ORDER.registry.includes(r.name));
if (missed.length) throw new Error(`sheet 8: plate carries undrawn packages — ${missed.map((r) => r.name).join(', ')}`);

const DELIVERED = PLATE.rows.length;
const TOT_L = PLATE.rows.reduce((a, r) => a + r.l, 0);
const TOT_DL = PLATE.rows.reduce((a, r) => a + r.dl, 0);
const APP_L = DATA.consumer[0].l, APP_F = DATA.consumer[0].f;
const pkg = (name) => item(name);
const times = Math.round(TOT_L / APP_L);

// Heavier city, coarser scale than sheet 7 — stated on the sheet.
const SIDE = (f) => Math.max(10, 4.5 * Math.sqrt(f));
const HT = (l) => Math.max(3, l / 250);

function pack(items, x0, y0, maxW, gap = 24) {
  const placed = [];
  let cx = x0, cy = y0, rowD = 0;
  for (const it of items) {
    const s = SIDE(it.f), sa = it.df ? SIDE(it.df) : 0;
    const w = s + (sa ? 8 + sa : 0), d = Math.max(s, sa);
    if (cx + w > x0 + maxW && cx > x0) { cx = x0; cy += rowD + gap; rowD = 0; }
    placed.push({ it, x: cx, y: cy, s, sa });
    cx += w + gap; rowD = Math.max(rowD, d);
  }
  return placed;
}

let n = 0;
const all = [];
for (const [district, x0, y0, maxW] of [
  ['registry', 170, 10, 600],
  ['workspace', 10, 500, 430],
  ['consumer', 560, 540, 200],
]) {
  const items = DATA[district].slice().sort((a, b) => SIDE(b.f) - SIDE(a.f));
  for (const pl of pack(items, x0, y0, maxW)) {
    all.push({ ...pl, n: ++n, district });
  }
}

// Every block and every d.ts annex is its own mass: a package's annex is not always
// nearer the eye than the package, and only a back-to-front pass hides rear walls.
const masses = all.flatMap(({ it, x, y, s, sa, district }) => {
  const accent = it.name === 'lit-ui-router' || district === 'consumer';
  const out = [{ x, y, w: s, d: s,
    svg: solidFaces(isoBlock(P, OX, OY, x, y, s, s, HT(it.l), { capCls: accent ? 'fa' : 'fp' })) }];
  if (sa) {
    const ax = x + s + 8, ay = y + Math.max(0, (s - sa) / 2);
    out.push({ x: ax, y: ay, w: sa, d: sa,
      svg: solidFaces(isoBlock(P, OX, OY, ax, ay, sa, sa, HT(it.dl), { edge: 'sks', capCls: 'fp2', sideFill: `url(#${P}-hd)` })) });
  }
  return out;
});
// Badges ride above the roofline; painted after the city so no wall crosses them.
const badges = all.map(({ it, x, y, s, n, district }) => {
  const accent = it.name === 'lit-ui-router' || district === 'consumer';
  const [bx, by] = isoPt(OX, OY, x + s / 2, y, HT(it.l));
  // badges that otherwise land on a roof edge or the district outline
  // 14 (dompurify's slender tower) floats high to clear hono's wall edges behind it
  const lift = n === 14 ? 84 : [12, 33].includes(n) ? 26 : [23, 29, 30, 31, 32].includes(n) ? 20 : 14;
  // 3, 5, 6 stand against a neighbour's wall; slide them clear
  const shift = n === 3 ? -16 : n === 5 ? -16 : n === 6 ? 18 : 0;
  return `<circle cx="${(bx + shift).toFixed(1)}" cy="${(by - lift).toFixed(1)}" r="9" class="${accent ? 'ska fp' : 'sk fp'}"/>
${txt((bx + shift).toFixed(1), (by - lift + 3.4).toFixed(1), String(n), 'lbls', 'middle')}`;
}).join('\n');

const bodies = depthSort(masses).map((m) => m.svg).join('\n') + '\n' + badges;

function districtOutline(x1, y1, x2, y2, label, lx, ly) {
  const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
    .map(([px, py]) => isoPt(OX, OY, px, py).map((v) => v.toFixed(1)).join(','))
    .join(' ');
  return `<polygon points="${pts}" class="skf fnone" stroke-dasharray="5 4"/>
${txt(lx, ly, label, 'lblf')}`;
}

const schedRow = ({ it, n, district }) => {
  const ws = district === 'workspace' ? ' (ws)' : district === 'consumer' ? ' (the app, src)' : '';
  const dts = it.dl ? ` · dts ${fmt(it.dl)}` : '';
  return `${n} ${it.label}${ws} — ${it.f}f ${fmt(it.l)}${dts}`;
};
const half = Math.ceil(all.length / 2);
const colA = all.slice(0, half), colB = all.slice(half);
const SY = 950;
const schedule = `<g>
<rect x="40" y="${SY}" width="1080" height="${74 + half * 17}" class="sk fp"/>
${txt(56, SY + 22, 'STRUCTURE SCHEDULE — delivered files (f) · lines of code on disk · d.ts lines', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1120" y2="${SY + 32}" class="skf"/>
${colA.map((r, i) => txt(56, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${colB.map((r, i) => txt(590, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${txt(56, SY + 58 + half * 17, `TOTAL — ${DELIVERED} delivered packages · ${fmt(TOT_L)} lines of code · ${fmt(TOT_DL)} d.ts lines · ${BASIS}`, 'lbls')}
</g>`;

// Callouts
const app = all.find((a) => a.district === 'consumer');
const [cx2, cy2] = isoPt(OX, OY, app.x + app.s + 4, app.y + app.s, 0);
const lod = all.find((a) => a.it.name === 'lodash-es');
const [lx2, ly2] = isoPt(OX, OY, lod.x, lod.y + lod.s, HT(lod.it.l) * 0.72);

const svg = `<svg viewBox="0 0 1160 ${SY + 90 + half * 17}" role="img" aria-label="The production node_modules of one sample app drawn as an isometric city: ${DELIVERED} delivered packages plus the app's own building, footprint area from delivered file counts, height from lines of code on disk, hatched annexes for type declarations. The app's own ${APP_L}-line building is dwarfed by ${fmt(TOT_L)} delivered lines — lodash-es, halved by the swap this sheet argued for, still delivers ${fmt(pkg('lodash-es').l)} lines for four imports. Rev B drew two complete copies of the lit stack; the lit 2.8.0 twins were removed by scoped overrides, and this revision recounts the smaller city. Every count is imported from the checked-in census plate. A structure schedule lists every package with exact counts.">
${defs(P)}

${districtOutline(160, 0, 760, 490, `registry-delivered — ${ORDER.registry.length} packages`, 30, 90)}
${districtOutline(0, 485, 460, 575, 'workspace-linked — built dist/', 60, 620)}
${districtOutline(545, 520, 690, 640, 'the consumer', 638, 764)}

${bodies}

${txt(cx2 + 140, cy2 + 80, `the entire application: ${APP_F} files, ${APP_L} lines`, 'lbla')}
<line x1="${(cx2 + 134).toFixed(1)}" y1="${(cy2 + 76).toFixed(1)}" x2="${cx2.toFixed(1)}" y2="${cy2.toFixed(1)}" class="skf"/>
${txt(40, 200, 'delivered for four imports:', 'lbla')}
${txt(40, 212, 'isEqual · cloneDeep · get · set', 'lbla')}
${txt(40, 226, `rev A: 45,205 lines · now ${fmt(pkg('lodash-es').l)}`, 'lbls')}
<line x1="272" y1="230" x2="${(lx2 - 6).toFixed(1)}" y2="${ly2.toFixed(1)}" class="skf" stroke-dasharray="3 3"/>

${txt(1120, 48, 'rev B drew the lit stack twice (2.8.0 · 3.3.3);', 'lbla', 'end')}
${txt(1120, 60, 'PR #618 scoped the overrides — the 2.8.0 twins', 'lbla', 'end')}
${txt(1120, 72, 'are gone: −4 buildings, −14,114 lines', 'lbla', 'end')}

${txt(1120, 26, 'SCALE — footprint area ∝ delivered files · 1 px of height ≈ 250 lines (sheet 7: ≈ 34)', 'lbls', 'end')}
${txt(1120, 90, `every number on this sheet is read from diagrams/data/census-nm.json — ${BASIS}`, 'lblf', 'end')}

${schedule}
</svg>`;

export const sheet8 = {
  num: 8, id: 'delivered',
  title: 'THE DELIVERED CITY',
  sub: `ALTITUDE 1½ — what npm actually installs for one consumer · sample-app-lit-vanilla · REV C: recounted after the lit de-duplication · 2026-08-17 · REV D 2026-08-31: hidden-line pass — opaque faces, masses painted back to front, no rear wall through a front one · every number now imported from diagrams/data/census-nm.json — ${BASIS}`,
  rev: 'D',
  scale: 'ONE CONSUMER',
  form: 'DELIVERED CITY',
  svg,
  caption: `The production dependency closure of one sample app, surveyed on disk: every delivered package as a building — footprint from file count, height from lines — with the consumer’s own ${APP_L}-line building standing in the city it summoned.`,
  notes: `
<p><strong>Method:</strong> the production closure of <code>${PLATE.app}</code> (dependencies plus installed peers — pnpm auto-installs peers, so they are genuinely on disk), resolved through the pnpm store and measured as delivered: lines of <code>.js/.ts/.css/.html</code> per package directory, source maps and prose excluded, <code>.d.ts</code> drawn separately as the hatched annex. Workspace-linked members are measured by their built <code>dist/</code> — the shape a registry install would deliver. Plenty of prior art measures this differently — bundlephobia and packagephobia weigh tarballs and install bytes, npmgraph draws the dependency graph — but this sheet measures what actually lands on disk, in files and lines, and stages it as a city with the consumer’s own building standing in it for scale. The closure is resolved and measured inside an installed and built archive of a named ref, not in a working tree, and written to the plate <code>diagrams/data/census-nm.json</code> — ${BASIS} — which every number below is read from.</p>
<p><strong>The consumer is a doormat in its own city.</strong> The app brings ${APP_L} lines of its own and receives ${fmt(TOT_L)} delivered lines of code plus ${fmt(TOT_DL)} of type declarations — ${times}× its own mass. The router this repo exists to ship, <code>lit-ui-router</code>, delivers ${fmt(pkg('lit-ui-router').l)} lines: still one of the smaller buildings on the skyline it anchors, and ${(TOT_L / pkg('lit-ui-router').l).toFixed(0)}× smaller than the city it stands in.</p>
<p><strong>The drawing changed the city — twice.</strong> Rev A drew lodash 4.18.1 as the tallest building on the skyline — 45,205 lines, 1,048 files, delivered for four imports (<code>isEqual</code>, <code>cloneDeep</code>, <code>get</code>, <code>set</code>). That finding became PR #604: the swap to <code>lodash-es</code> halved the building to ${fmt(pkg('lodash-es').l)} lines and ${pkg('lodash-es').f} files, dropping it to fourth place behind dompurify, hono, and @uirouter/core. The bundler always tree-shook the wire cost — sheet 9 charts that collapse, 25 KB → 4 KB — but the delivered city is what installs, audits, and updates, and it is 23,000 lines lighter.</p>
<p><strong>Rev C: the lit twins are gone.</strong> Rev B found the demo chrome shipping a second, complete lit — <code>lit-dialog</code> and the api-viewer panels hard-depend on lit ^2, so lit, lit-html, lit-element, and @lit/reactive-element were each delivered twice, twin pairs on the skyline. That finding became PR #618: scoped pnpm overrides (<code>@api-viewer/docs&gt;lit</code>, <code>@api-viewer/common&gt;lit</code>, <code>lit-dialog&gt;lit</code> → ^3.3.3) retire the 2.8.0-era tree. Four buildings vanished — lit 2.8.0, lit-html 2.8.0, lit-element 3.3.3, @lit/reactive-element 1.6.3: 287 files and 14,114 lines of code, plus 7,781 d.ts lines — and the city shrank from 36 delivered packages to 32, 190,122 lines to 176,022. The same PR made the api-docs panel lazy-load, which is why <code>sample-app-shared</code>'s dist grew 14 lines (3,776 → 3,790); every other surviving building measures exactly what it did in rev B. And <code>hono</code> (30,489 lines) still stands here because <code>ui-router-server</code> names it a peer: a server framework delivered into a client demo by peer auto-install.</p>
<p><strong>Note the vertical scale:</strong> 1 px ≈ 250 lines against sheet 7’s ≈ 34. Drawn at the workspace’s own scale, even the halved lodash-es would stand 653 px tall — the compression <em>is</em> the finding.</p>
<p><strong>Numbers by import, not by paste.</strong> Every count on the drawing and in this note is now read from <code>diagrams/data/census-nm.json</code>, the snapshot <code>census-nm.mjs</code> writes after installing and building the ref itself; this file holds the drawing order, the hand-placed districts and the prose only, and a package it draws that the plate does not carry — or a package the plate carries that no district draws — is a build error rather than a stale constant. The same ${DELIVERED} buildings stand: the set has not changed since the hand count, only the counts. <code>lit-ui-router</code>'s own delivered shape moved most — ${fmt(pkg('lit-ui-router').l)} lines over ${pkg('lit-ui-router').f} files against the 798 over 12 pasted here in rev C, several releases of dist ago (the plate reads ${pkg('lit-ui-router').label}) — and the rest is drift in the registry: <code>hono</code> ${pkg('hono').label} delivers ${fmt(pkg('hono').l)} where 4.13.1 delivered 30,489, <code>sample-app-shared</code>'s dist is ${fmt(pkg('sample-app-shared').l)} where it was 3,790, and <code>@oxc-project/runtime</code> advanced three minors to ${pkg('@oxc-project/runtime').label} without changing a single line it delivers. The city totals ${fmt(TOT_L)} lines against rev C's hand-counted 176,022.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'delivered code — height = lines on disk'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sks fp2"/><rect x="8" y="9" width="18" height="6" fill="url(#s8-hd)"/>', 'type declarations (d.ts) annex'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'lit-ui-router · the consumer'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'district (how it got here)'),
  ].join('\n'),
};

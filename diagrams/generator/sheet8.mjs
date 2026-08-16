import { defs } from './chrome.mjs';
import { txt, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's8';
const OX = 500, OY = 130;

// node_modules census 2026-08-16, recounted same day after the lodash-es swap
// (PR #604) merged: production closure of apps/sample-app-lit-vanilla
// (BFS over dependencies + installed peers; pnpm auto-installs peers). Delivered code =
// .js/.mjs/.cjs/.ts/.css/.html lines on disk; d.ts counted separately (the annex).
// Workspace-linked packages measure dist/ — their registry-delivered shape.
// [name, files, codeLines, dtsFiles, dtsLines]
const DATA = {
  consumer: [
    ['sample-app-lit-vanilla', 11, 597, 0, 0], // own src, for scale
  ],
  workspace: [
    ['sample-app-shared', 44, 3776, 2, 16],
    ['ui-router-server', 8, 751, 8, 485],
    ['lit-ui-router', 12, 798, 12, 1272],
    ['sample-app-routes', 3, 365, 0, 0],
    ['navigation-location-plugin', 1, 58, 1, 105],
  ],
  registry: [
    ['lodash-es 4.18.1', 644, 22193, 0, 0],
    ['dompurify 3.4.13', 12, 38544, 2, 901],
    ['hono 4.13.1', 374, 30489, 186, 8054],
    ['@uirouter/core 6.1.2', 162, 26255, 160, 15854],
    ['marked 4.3.0', 16, 11676, 0, 0],
    ['lit-html 2.8.0', 120, 9245, 60, 3856],
    ['lit-html 3.3.3', 120, 8701, 60, 4002],
    ['@uirouter/visualizer 7.2.1', 3, 6048, 1, 241],
    ['@oxc-project/runtime 0.144.0', 232, 5198, 0, 0],
    ['@lit/reactive-element 2.1.2', 58, 4084, 30, 2682],
    ['@lit/reactive-element 1.6.3', 58, 3828, 30, 2664],
    ['preact 10.4.8', 61, 3786, 11, 1832],
    ['d3-hierarchy 2.0.0', 35, 2688, 0, 0],
    ['@uirouter/dsr 1.2.0', 45, 2053, 8, 236],
    ['tslib 2.8.1', 6, 1363, 2, 499],
    ['@uirouter/sticky-states 1.5.1', 18, 1354, 4, 186],
    ['d3-interpolate 1.4.0', 28, 1219, 0, 0],
    ['d3-color 3.1.0', 8, 1211, 0, 0],
    ['@lit-labs/ssr-dom-shim 1.6.0', 7, 1178, 7, 223],
    ['lit-element 3.3.3', 30, 590, 30, 652],
    ['lit-element 4.2.2', 28, 471, 28, 616],
    ['lit 2.8.0', 79, 451, 79, 609],
    ['lit 3.3.3', 77, 436, 77, 585],
    ['lit-dialog 2.0.1', 4, 383, 2, 92],
    ['@api-viewer/docs 1.0.0-pre.10', 5, 379, 5, 49],
    ['@api-viewer/tabs 1.0.0-pre.10', 3, 317, 3, 53],
    ['@api-viewer/common 1.0.0-pre.10', 6, 234, 6, 53],
    ['custom-elements-manifest 2.1.0', 0, 0, 1, 767],
    ['@types/marked 4.3.2', 0, 0, 2, 650],
    ['@types/dompurify 2.4.0', 0, 0, 1, 135],
    ['@types/trusted-types 2.0.7', 0, 0, 2, 119],
  ],
};

// Heavier city, coarser scale than sheet 7 — stated on the sheet.
const SIDE = (f) => Math.max(10, 4.5 * Math.sqrt(f));
const HT = (l) => Math.max(3, l / 250);

function pack(items, x0, y0, maxW, gap = 24) {
  const placed = [];
  let cx = x0, cy = y0, rowD = 0;
  for (const it of items) {
    const s = SIDE(it[1]), sa = it[3] ? SIDE(it[3]) : 0;
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
  const items = DATA[district].slice().sort((a, b) => SIDE(b[1]) - SIDE(a[1]));
  for (const pl of pack(items, x0, y0, maxW)) {
    all.push({ ...pl, n: ++n, district });
  }
}

const bodies = all
  .slice()
  .sort((a, b) => (a.x + a.y + a.s) - (b.x + b.y + b.s))
  .map(({ it, x, y, s, sa, n, district }) => {
    const [name, f, l, df, dl] = it;
    const h = HT(l);
    const accent = name === 'lit-ui-router';
    const consumer = district === 'consumer';
    const src = isoBlock(P, OX, OY, x, y, s, s, h, { capCls: accent ? 'fa' : consumer ? 'fa' : 'fp' });
    const annex = sa
      ? isoBlock(P, OX, OY, x + s + 8, y + Math.max(0, (s - sa) / 2), sa, sa, HT(dl), { edge: 'sks', capCls: 'fp2', sideFill: `url(#${P}-hd)` })
      : '';
    const [bx, by] = isoPt(OX, OY, x + s / 2, y, h);
    // badges that otherwise land on a roof edge or the district outline
    const lift = [3, 6, 25, 31, 33, 34, 35, 36].includes(n) ? 20 : 14;
    // 3 stands against a later neighbour's wall; slide it clear
    const shift = n === 3 ? -16 : 0;
    return `${src}${annex}
<circle cx="${(bx + shift).toFixed(1)}" cy="${(by - lift).toFixed(1)}" r="9" class="${accent || consumer ? 'ska fp' : 'sk fp'}"/>
${txt((bx + shift).toFixed(1), (by - lift + 3.4).toFixed(1), String(n), 'lbls', 'middle')}`;
  })
  .join('\n');

function districtOutline(x1, y1, x2, y2, label, lx, ly) {
  const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
    .map(([px, py]) => isoPt(OX, OY, px, py).map((v) => v.toFixed(1)).join(','))
    .join(' ');
  return `<polygon points="${pts}" class="skf fnone" stroke-dasharray="5 4"/>
${txt(lx, ly, label, 'lblf')}`;
}

const fmt = (v) => v.toLocaleString('en-US');
const schedRow = ({ it, n, district }) => {
  const [name, f, l, df, dl] = it;
  const ws = district === 'workspace' ? ' (ws)' : district === 'consumer' ? ' (the app, src)' : '';
  const dts = dl ? ` · dts ${fmt(dl)}` : '';
  return `${n} ${name}${ws} — ${f}f ${fmt(l)}${dts}`;
};
const half = Math.ceil(all.length / 2);
const colA = all.slice(0, half), colB = all.slice(half);
const SY = 950;
const schedule = `<g>
<rect x="40" y="${SY}" width="1080" height="${52 + half * 17}" class="sk fp"/>
${txt(56, SY + 22, 'STRUCTURE SCHEDULE — delivered files (f) · lines of code on disk · d.ts lines', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1120" y2="${SY + 32}" class="skf"/>
${colA.map((r, i) => txt(56, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${colB.map((r, i) => txt(590, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
</g>`;

// Callouts
const app = all.find((a) => a.district === 'consumer');
const [cx2, cy2] = isoPt(OX, OY, app.x + app.s + 4, app.y + app.s, 0);
const lod = all.find((a) => a.it[0].startsWith('lodash'));
const [lx2, ly2] = isoPt(OX, OY, lod.x, lod.y + lod.s, HT(lod.it[2]) * 0.72);

const svg = `<svg viewBox="0 0 1160 ${SY + 90 + half * 17}" role="img" aria-label="The production node_modules of one sample app drawn as an isometric city: 36 delivered packages plus the app's own building, footprint area from delivered file counts, height from lines of code on disk, hatched annexes for type declarations. The app's own 597-line building is dwarfed by 190,122 delivered lines — lodash-es, halved by the swap this sheet argued for, still delivers 22,193 lines for four imports, and two complete copies of the lit stack are present. A structure schedule lists every package with exact counts.">
${defs(P)}

${districtOutline(160, 0, 760, 490, 'registry-delivered — 31 packages', 30, 90)}
${districtOutline(0, 485, 460, 575, 'workspace-linked — built dist/', 60, 620)}
${districtOutline(545, 520, 690, 640, 'the consumer', 700, 762)}

${bodies}

${txt(cx2 + 140, cy2 + 80, 'the entire application: 11 files, 597 lines', 'lbla')}
<line x1="${(cx2 + 134).toFixed(1)}" y1="${(cy2 + 76).toFixed(1)}" x2="${cx2.toFixed(1)}" y2="${cy2.toFixed(1)}" class="skf"/>
${txt(40, 200, 'delivered for four imports:', 'lbla')}
${txt(40, 212, 'isEqual · cloneDeep · get · set', 'lbla')}
${txt(40, 226, 'rev A: 45,205 lines · rev B: 22,193', 'lbls')}
<line x1="272" y1="230" x2="${(lx2 - 6).toFixed(1)}" y2="${ly2.toFixed(1)}" class="skf" stroke-dasharray="3 3"/>

${txt(1120, 26, 'SCALE — footprint area ∝ delivered files · 1 px of height ≈ 250 lines (sheet 7: ≈ 34)', 'lbls', 'end')}

${schedule}
</svg>`;

export const sheet8 = {
  num: 8, id: 'delivered',
  title: 'THE DELIVERED CITY',
  sub: 'ALTITUDE 1½ — what npm actually installs for one consumer · sample-app-lit-vanilla · REV B: recounted after the lodash-es swap · 2026-08-16',
  rev: 'B',
  scale: 'ONE CONSUMER',
  form: 'DELIVERED CITY',
  svg,
  caption: 'The production dependency closure of one sample app, surveyed on disk: every delivered package as a building — footprint from file count, height from lines — with the consumer’s own 597-line building standing in the city it summoned.',
  notes: `
<p><strong>Method:</strong> the production closure of <code>apps/sample-app-lit-vanilla</code> (dependencies plus installed peers — pnpm auto-installs peers, so they are genuinely on disk), resolved through the pnpm store and measured as delivered: lines of <code>.js/.ts/.css/.html</code> per package directory, source maps and prose excluded, <code>.d.ts</code> drawn separately as the hatched annex. Workspace-linked members are measured by their built <code>dist/</code> — the shape a registry install would deliver. Plenty of prior art measures this differently — bundlephobia and packagephobia weigh tarballs and install bytes, npmgraph draws the dependency graph — but this sheet measures what actually lands on disk, in files and lines, and stages it as a city with the consumer’s own building standing in it for scale.</p>
<p><strong>The consumer is a doormat in its own city.</strong> The app brings 597 lines of its own and receives 190,122 delivered lines of code plus 47,488 of type declarations — 318× its own mass. The router this repo exists to ship, <code>lit-ui-router</code>, delivers 798 lines: one of the smallest buildings on the skyline it anchors.</p>
<p><strong>The drawing changed the city.</strong> Rev A drew lodash 4.18.1 as the tallest building on the skyline — 45,205 lines, 1,048 files, delivered for four imports (<code>isEqual</code>, <code>cloneDeep</code>, <code>get</code>, <code>set</code>). That finding became PR #604: the swap to <code>lodash-es</code> halved the building to 22,193 lines and 644 files, dropping it to fourth place behind dompurify, hono, and @uirouter/core. The bundler always tree-shook the wire cost — sheet 9 charts that collapse, 25 KB → 4 KB — but the delivered city is what installs, audits, and updates, and it is 23,000 lines lighter.</p>
<p><strong>The demo chrome ships a second, complete lit.</strong> <code>lit-dialog</code> and the api-viewer panels pin the lit 2 era, so lit, lit-html, lit-element, and @lit/reactive-element are each delivered twice (2.8.0/3.3.3 side by side) — twin pairs on the skyline. And <code>hono</code> (30,489 lines) stands here because <code>ui-router-server</code> names it a peer: a server framework delivered into a client demo by peer auto-install.</p>
<p><strong>Note the vertical scale:</strong> 1 px ≈ 250 lines against sheet 7’s ≈ 34. Drawn at the workspace’s own scale, even the halved lodash-es would stand 653 px tall — the compression <em>is</em> the finding.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'delivered code — height = lines on disk'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sks fp2"/><rect x="8" y="9" width="18" height="6" fill="url(#s8-hd)"/>', 'type declarations (d.ts) annex'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'lit-ui-router · the consumer'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'district (how it got here)'),
  ].join('\n'),
};

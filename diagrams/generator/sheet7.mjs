import { defs } from './chrome.mjs';
import { txt, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's7';
const OX = 380, OY = 150;

// Census 2026-08-16: tracked source (.ts/.js/.mjs/.vue/.html/.css), dist/ excluded,
// spec = *.spec.* / *.test.* / test(s)|specs dirs / cypress. [name, files, loc, specFiles, specLoc]
const DATA = {
  packages: [
    ['lit-ui-router', 17, 2700, 15, 4278],
    ['ui-router-server', 10, 1893, 12, 2568],
    ['lit-ui-router-mobx', 7, 359, 4, 496],
    ['navigation-location-plugin', 3, 303, 7, 623],
  ],
  tools: [
    ['release', 44, 2821, 19, 2187],
    ['typedoc-plugin', 5, 1031, 0, 0],
    ['dts-backtest', 5, 747, 0, 0],
    ['build_and_test', 5, 601, 2, 437],
    ['shared', 10, 553, 5, 324],
    ['workers-builds', 2, 488, 1, 310],
    ['bundle-probe', 4, 302, 0, 0],
    ['compat-guards', 7, 300, 1, 149],
    ['oxc-emit', 3, 128, 0, 0],
    ['release-config', 1, 58, 0, 0],
    ['lit-template-lint', 1, 51, 0, 0],
    ['lit-test-env', 1, 47, 0, 0],
    ['vue-check', 1, 47, 0, 0],
    ['lcov-rebase', 2, 46, 1, 37],
    ['happy-dom', 2, 34, 1, 40],
    ['wintercg-globals', 1, 17, 0, 0],
  ],
  apps: [
    ['sample-app-shared', 43, 3408, 3, 385],
    ['sample-app-lit-mobx', 11, 662, 0, 0],
    ['sample-app-lit-vanilla', 11, 597, 0, 0],
    ['sample-app-lit-e2e', 3, 431, 7, 569],
    ['sample-app-routes', 2, 127, 1, 238],
  ],
  site: [
    ['docs', 16, 2250, 1, 232],
    ['examples', 11, 1425, 0, 0],
  ],
};

const SIDE = (f) => Math.max(16, 12 * Math.sqrt(f));
const HT = (l) => Math.max(3, l / 34);

// Pack each district's members (sorted big-first) into rows.
function pack(items, x0, y0, maxW, gap = 26) {
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
  ['packages', 25, 20, 460],
  ['site', 560, 20, 340],
  ['tools', 20, 180, 430],
  ['apps', 500, 180, 400],
]) {
  const items = DATA[district].slice().sort((a, b) => SIDE(b[1]) - SIDE(a[1]));
  for (const pl of pack(items, x0, y0, maxW)) {
    all.push({ ...pl, n: ++n, district });
  }
}

// Painter order, then draw src block + spec annex + balloon.
const bodies = all
  .slice()
  .sort((a, b) => (a.x + a.y + a.s) - (b.x + b.y + b.s))
  .map(({ it, x, y, s, sa, n }) => {
    const [name, f, l, sf, sl] = it;
    const h = HT(l);
    const src = isoBlock(P, OX, OY, x, y, s, s, h, { capCls: name === 'lit-ui-router' ? 'fa' : 'fp' });
    const annex = sa
      ? isoBlock(P, OX, OY, x + s + 8, y + Math.max(0, (s - sa) / 2), sa, sa, HT(sl), { edge: 'sks', capCls: 'fp2', sideFill: `url(#${P}-hd)` })
      : '';
    const [bx, by] = isoPt(OX, OY, x + s / 2, y, h);
    return `${src}${annex}
<circle cx="${bx.toFixed(1)}" cy="${(by - 14).toFixed(1)}" r="9" class="${name === 'lit-ui-router' ? 'ska fp' : 'sk fp'}"/>
${txt(bx.toFixed(1), (by - 10.6).toFixed(1), String(n), 'lbls', 'middle')}`;
  })
  .join('\n');

function districtOutline(x1, y1, x2, y2, label, lx, ly) {
  const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
    .map(([px, py]) => isoPt(OX, OY, px, py).map((v) => v.toFixed(1)).join(','))
    .join(' ');
  return `<polygon points="${pts}" class="skf fnone" stroke-dasharray="5 4"/>
${txt(lx, ly, label, 'lblf')}`;
}

// Schedule: two columns under the city.
const fmt = (v) => v.toLocaleString('en-US');
const schedRow = ({ it, n, district }) => {
  const [name, f, l, sf, sl] = it;
  const spec = sf ? ` · spec ${sf}f ${fmt(sl)}` : '';
  return `${n} ${district === 'site' ? '' : district + '/'}${name} — ${f}f ${fmt(l)}${spec}`;
};
const colA = all.slice(0, 14), colB = all.slice(14);
const schedule = `<g>
<rect x="40" y="700" width="1080" height="286" class="sk fp"/>
${txt(56, 722, 'STRUCTURE SCHEDULE — files (f) · lines of tracked source · spec mass', 'lbls')}
<line x1="40" y1="732" x2="1120" y2="732" class="skf"/>
${colA.map((r, i) => txt(56, 752 + i * 17, schedRow(r), 'lbls')).join('\n')}
${colB.map((r, i) => txt(590, 752 + i * 17, schedRow(r), 'lbls')).join('\n')}
</g>`;

// Headline callouts
const relBlock = all.find((a) => a.it[0] === 'release');
const [rx, ry] = isoPt(OX, OY, relBlock.x + relBlock.s / 2, relBlock.y + relBlock.s, HT(relBlock.it[2]));
const luBlock = all.find((a) => a.it[0] === 'lit-ui-router');
const [ax, ay] = isoPt(OX, OY, luBlock.x + luBlock.s + 8 + SIDE(luBlock.it[3]), luBlock.y, HT(luBlock.it[4]));

const svg = `<svg viewBox="0 0 1160 1000" role="img" aria-label="A measured isometric city of the whole lit-ui-router workspace: every workspace member drawn as a building whose footprint area is its tracked source file count and whose height is its lines of source, with hatched annexes for test mass. The tallest structure in the packages district is lit-ui-router's own test annex; the largest building on site is the release tooling. A structure schedule lists all 27 members with exact counts.">
${defs(P)}

${districtOutline(15, 10, 495, 165, 'packages/ — the product', 96, 108)}
${districtOutline(550, 10, 910, 130, 'docs/ + examples/ — the shopfront', 920, 380)}
${districtOutline(10, 170, 465, 400, 'tools/ — the scaffolding', 30, 480)}
${districtOutline(490, 170, 910, 405, 'apps/ — the proving ground', 700, 690)}

${bodies}

${txt(ax + 14, ay - 26, 'the tallest thing the product district', 'lbla')}
${txt(ax + 14, ay - 14, 'ever built is a test annex', 'lbla')}
${txt(rx + 130, ry + 40, 'largest building on site:', 'lbla')}
${txt(rx + 130, ry + 52, 'the release machinery', 'lbla')}

${txt(580, 60, 'SCALE — footprint area ∝ tracked files · 1 px of height ≈ 34 lines', 'lbls')}
</svg>`;

export const sheet7 = {
  num: 7, id: 'census',
  title: 'THE CENSUS',
  sub: 'ALTITUDE 3½ — the same city as sheet 3, surveyed by mass · 27 members · counted 2026-08-16',
  scale: 'WHOLE WORKSPACE',
  form: 'MEASURED CITY',
  svg,
  caption: 'Sheet 3 drew the monorepo by severity; this sheet surveys it by mass. Footprint area is tracked source files, height is lines, and every hatched annex is test code — drawn attached to the building it guards.',
  notes: `
<p><strong>Method:</strong> tracked source only (<code>git ls-files</code>, so <code>dist/</code> and node_modules never count), <code>.ts/.js/.mjs/.vue/.html/.css</code>; spec mass split by naming (<code>*.spec.*</code>, <code>*.test.*</code>, <code>test/</code>, <code>specs/</code>, cypress). Lines measure bulk, not value — the sheet claims proportion, nothing more.</p>
<p><strong>Every shipped building has an annex bigger than itself.</strong> lit-ui-router: 2,700 shipped lines against 4,278 of spec (1.6×). ui-router-server: 1,893 vs 2,568 (1.4×). navigation-location-plugin: 303 vs 623 (2.1×). mobx: 359 vs 496. The test budget genuinely lives where the repo says it should — in <code>packages/*</code>, not in docs.</p>
<p><strong>The largest structure on site ships nothing.</strong> <code>tools/release</code> is 2,821 lines plus a 2,187-line annex — bigger than any shipped package. Add the rest of the scaffolding and the reference's thesis lands numerically: the city is mostly measurement and machinery; the product is four modest buildings whose combined shipped mass (5,255 lines) is a fifth of the workspace.</p>
<p><strong>Reading it against sheet 3:</strong> same districts, two truths. Severity says <code>published-diff</code> towers over everything; mass says it's a shed. Both are correct — which is the argument for surveying a city twice.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'shipped source — height = lines'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sks fp2"/><rect x="8" y="9" width="18" height="6" fill="url(#s7-hd)"/>', 'spec annex — the test mass'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'the package this set is about'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'district (workspace glob)'),
  ].join('\n'),
};

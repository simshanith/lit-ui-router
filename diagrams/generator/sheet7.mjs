import { defs } from './chrome.mjs';
import { txt, arrow, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's7';
const OX = 600, OY = 96;

// ---- census: every workspace member, this repo at HEAD, counted 2026-08-16 ------
// Same basis as sheets 3 + 4 rev B — authored .ts/.tsx/.js/.jsx/.mjs under each
// member's source dir, excluding *.d.ts, *.test-d.ts, fixtures/, dist/,
// node_modules/; sloc = lines neither blank nor comment-only.  Sheet 7 differs on
// one point, deliberately: it does not throw test code away.  Every file matching
// *.{spec,test,cy}.* or living under specs/ test/ tests/ __tests__/ cypress/ is
// counted into a SECOND series and drawn as that member's annex.
// Generator: tmp/atlas/census-city.mjs

// ---- scale rule ----------------------------------------------------------------
const KS = 1.6;   // footprint SIDE = 1.6 · √sloc  (plan area ∝ sloc)
const KH = 3.0;   // block HEIGHT   = 3.0 px per authored file
const MIN = 12;   // footprint floor, so the smallest instruments stay visible
const S = (sloc) => Math.max(MIN, KS * Math.sqrt(sloc));
const H = (files) => Math.max(4, KH * files);
const AG = 10;    // gap between a src block and its annex
const fmt = (v) => v.toLocaleString('en-US');

// ---- gate severity lives in COLOUR, never in height (shared with sheet 3) -------
const TIER = {
  halt:   { edge: 'skr', cap: 'fr',  hatch: null, side: `url(#${P}-hr)`, badge: 'skr fp', num: 'lblr' },
  pr:     { edge: 'skr', cap: 'fp',  hatch: 'hr', side: `url(#${P}-hr)`, badge: 'skr fp', num: 'lblr' },
  late:   { edge: 'ska', cap: 'fp',  hatch: 'ha', side: `url(#${P}-ha)`, badge: 'ska fp', num: 'lbla' },
  report: { edge: 'skf', cap: 'fp2', hatch: null, side: `url(#${P}-hx)`, badge: 'skf fp', num: 'lbls' },
  line:   { edge: 'sk',  cap: 'fp',  hatch: null, side: `url(#${P}-hx)`, badge: 'sk fp',  num: 'lbl' },
  off:    { edge: 'sks', cap: 'fp2', hatch: null, side: `url(#${P}-hd)`, badge: 'sks fp', num: 'lbls' },
};
const TIER_TEXT = {
  halt: 'HALTS A PUBLISH', pr: 'STOPS THE PR LINE', late: 'gates a later stage',
  report: 'never gates', line: 'the material', off: 'types only — not massed',
};

// [n, name, district, tier, x, y, srcFiles, srcSloc, specFiles, specSloc, note]
const M = [
  // --- packages/ — the product -------------------------------------------------
  [1,  'lit-ui-router',            'pkg',  'line',     0,  20, 12, 1189, 14, 2879, 'the subject of this set · annex 2.4× the source'],
  [2,  'ui-router-server',         'pkg',  'line',   200,  20,  8, 1141, 12, 2174, 'the server adapter · annex 1.9×'],
  [3,  'lit-ui-router-mobx',       'pkg',  'line',   170, 130,  4,  133,  4,  380, 'the mobx companion · annex 2.9×'],
  [4,  'navigation-location-plugin','pkg', 'line',   260, 130,  1,  105,  7,  410, 'one 105-line file, seven spec files'],
  // --- apps/ — the proving ground ----------------------------------------------
  [5,  'sample-app-shared',        'app',  'line',   570,  10, 36, 2103,  3,  309, 'the routes + views every sample app mounts'],
  [6,  'sample-app-lit-vanilla',   'app',  'line',   720,  10,  8,  401,  0,    0, 'the plain-lit demo'],
  [7,  'sample-app-lit-mobx',      'app',  'line',   720,  90,  8,  440,  0,    0, 'the mobx demo'],
  [8,  'sample-app-routes',        'app',  'line',   700, 150,  2,   51,  1,  185, 'the shared route table, server-side too'],
  [9,  'sample-app-lit-e2e',       'app',  'pr',     580, 150,  1,   57,  4,  348, 'cypress · drives the docs build'],
  // --- docs/ + examples/ — the shopfront ---------------------------------------
  [10, 'docs',                     'site', 'line',   660, 340,  8,  677,  1,  181, 'vitepress + the worker that serves it'],
  [11, 'examples',                 'site', 'line',   660, 430,  7, 1117,  0,    0, 'stackblitz-ready copies, own lockfiles'],
  // --- tools/ — the instrument yard --------------------------------------------
  [12, '@tools/release',           'tool', 'halt',    20, 430, 44, 1871, 19, 1896, 'hosts published-diff — the one publish halt'],
  [13, '@tools/typedoc-plugin',    'tool', 'report', 230, 430,  5,  755,  0,    0, 'builds the API pages, gates nothing'],
  [14, '@tools/dts-backtest',      'tool', 'pr',       8, 350,  1,  291,  0,    0, 'one 291-line run.ts holds the TS 5.0 floor'],
  [15, '@tools/build_and_test',    'tool', 'report', 330, 430,  5,  427,  2,  378, 'the CI graph helper'],
  [16, '@tools/shared',            'tool', 'report',  20, 550,  9,  300,  5,  276, 'the library under the instruments'],
  [17, '@tools/workers-builds',    'tool', 'late',   220, 550,  2,  375,  1,  266, 'the docs deploy watch'],
  [18, '@tools/bundle-probe',      'tool', 'report', 330, 550,  4,  236,  0,    0, 'size probe, advisory'],
  [19, '@tools/compat-guards',     'tool', 'pr',     130, 550,  7,  189,  1,  112, 'the lit 2 / mobx 6 / peer-floor lanes'],
  [20, '@tools/oxc-emit',          'tool', 'line',   230, 350,  3,  100,  0,    0, 'both build passes, one emitter'],
  [21, '@tools/release-config',    'tool', 'line',   280, 350,  1,   39,  0,    0, 'the shared release-it config'],
  [22, '@tools/lit-template-lint', 'tool', 'report', 325, 350,  1,   21,  0,    0, 'the lit-analyzer wrapper'],
  [23, '@tools/lit-test-env',      'tool', 'pr',      85, 350,  1,   24,  0,    0, 'the browser harness every suite loads'],
  [24, '@tools/vue-check',         'tool', 'report', 370, 350,  1,   25,  0,    0, 'vue-tsc over the docs components'],
  [25, '@tools/lcov-rebase',       'tool', 'report', 415, 350,  2,   23,  1,   30, 'coverage path rewriting'],
  [26, '@tools/happy-dom',         'tool', 'pr',     125, 350,  1,    8,  1,   26, 'the node-side DOM the unit suites run in'],
  [27, '@tools/wintercg-globals',  'tool', 'off',    185, 350,  0,    0,  0,    0, 'ambient types only — nothing to mass'],
];

const geom = new Map(M.map(([n, name, dist, tier, x, y, sf, sl, pf, pl]) => {
  const s = S(sl), h = H(sf);
  const sa = pf ? S(pl) : 0, ha = pf ? H(pf) : 0;
  const ax = x + s + AG, ay = y + (s - sa) / 2;
  return [n, { n, name, dist, tier, x, y, s, h, sa, ha, ax, ay, sf, sl, pf, pl,
    x2: pf ? ax + sa : x + s, y1: pf ? Math.min(y, ay) : y, y2: pf ? Math.max(y + s, ay + sa) : y + s }];
}));
const g = (n) => geom.get(n);

const pt = (x, y, z = 0) => isoPt(OX, OY, x, y, z);
const p2 = (x, y, z = 0) => pt(x, y, z).map((v) => v.toFixed(1)).join(',');

// A member: src block massed by its own census, plus the spec annex it carries.
// Tier paints the src cap and flank; annexes are always the same test-mass material.
function member(n) {
  const b = g(n);
  const t = TIER[b.tier];
  const src = isoBlock(P, OX, OY, b.x, b.y, b.s, b.s, b.h, { capCls: t.cap, edge: t.edge, sideFill: t.side });
  const top = [p2(b.x, b.y, b.h), p2(b.x + b.s, b.y, b.h), p2(b.x + b.s, b.y + b.s, b.h), p2(b.x, b.y + b.s, b.h)].join(' ');
  const wash = t.hatch
    ? `<polygon points="${top}" fill="url(#${P}-${t.hatch})"/>\n<polygon points="${top}" class="${t.edge} fnone"/>`
    : '';
  const annex = b.sa
    ? isoBlock(P, OX, OY, b.ax, b.ay, b.sa, b.sa, b.ha, { edge: 'sks', capCls: 'fp2', sideFill: `url(#${P}-hd)` })
    : '';
  const [bx, by] = pt(b.x + b.s / 2, b.y, b.h);
  const lift = BADGE_LIFT[n] ?? 15;
  return `${src}${wash}${annex}
<circle cx="${bx.toFixed(1)}" cy="${(by - lift).toFixed(1)}" r="9" class="${t.badge}"/>
${txt(bx.toFixed(1), (by - lift + 3.4).toFixed(1), String(n), t.num, 'middle')}`;
}
// badges that would land on a neighbouring roof edge get lifted into clear air
const BADGE_LIFT = { 1: 20, 2: 30, 6: 35, 10: 28, 16: 30, 20: 26, 21: 34, 23: 34, 27: 34 };

// ---- roads ----------------------------------------------------------------------
// Routed on the iso grid and trimmed in SCREEN space at both ends.  A block's roof
// floats exactly h px above the ground point a road aims at, so clearing the
// silhouette costs h + 1.15·gap — derived from the census, never guessed.
const clr = (n, gap, annex = false) => (n == null ? gap : (annex ? g(n).ha : g(n).h) + 1.15 * gap);
function road(wps, { from = null, to = null, toAnnex = false, t0 = null, t1 = null, mk = 'ai', cls = 'sk2', dash = '' } = {}) {
  const pts = wps.map(([x, y, z = 0]) => pt(x, y, z));
  const trim = (a, b, d) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    return [a[0] + (dx / L) * d, a[1] + (dy / L) * d];
  };
  const d0 = t0 ?? clr(from, 9);
  const d1 = t1 ?? clr(to, 11.5, toAnnex);
  if (d0) pts[0] = trim(pts[0], pts[1], d0);
  if (d1) pts[pts.length - 1] = trim(pts[pts.length - 1], pts[pts.length - 2], d1);
  const d = 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' L');
  return mk ? arrow(P, d, mk, cls, dash) : `<path d="${d}" class="${cls}" ${dash ? `stroke-dasharray="${dash}"` : ''} fill="none"/>`;
}

const BUILDS = { mk: 'ai', cls: 'sk2' };
const TESTS = { mk: 'as', cls: 'sks', dash: '5 4' };
const READS = { mk: 'aa', cls: 'ska', dash: '7 4' };
const LIB = { mk: 'as', cls: 'sks', dash: '1 4' };

const roads = [
  // 1 · packages ship into the apps: sample-app-shared depends on lit-ui-router and
  //    ui-router-navigation-location-plugin; the two demos depend on lit-ui-router
  //    (+ -mobx).  turbo: build dependsOn ^build.
  road([[g(2).x2, 45], [g(5).x, 45]], { ...BUILDS, to: 5 }),
  // 2 · apps ship into the shopfront: docs depends on sample-app-lit-vanilla,
  //    -mobx and -routes (and on all four packages).  turbo: docs dependsOn ^build.
  road([[680, g(8).y2], [680, g(10).y]], { ...BUILDS, t0: 9, to: 10 }),
  // 3 · @tools/oxc-emit is a devDependency of all four packages and runs both
  //    build passes (turbo build:js / build:types); drawn to the nearest of them.
  road([[238, g(20).y], [238, 180], [268, 180], [268, g(4).y + g(4).s]], { ...BUILDS, t0: 9, to: 4 }),
  // 4 · typecheck reads BOTH series: turbo typecheck dependsOn ^build:types, and
  //    its inputs are $TURBO_DEFAULT$ — every tracked file of the package, src and
  //    specs alike.  Two stubs, one trunk, into the consumer that reads the types.
  road([[27, g(1).y + g(1).s], [27, 115]], { ...READS, from: 1, mk: null }),
  road([[108, g(1).ay + g(1).sa], [108, 115]], { ...READS, t0: clr(1, 9, true), mk: null }),
  road([[27, 115], [540, 115], [540, 345], [g(10).x, 345]], { ...READS, t0: 0, to: 10 }),
  // 5 · @tools/dts-backtest depends on all four published packages and backtests
  //    their emitted d.ts against the TS 5.0 floor (turbo: #test dependsOn ^build).
  road([[33, g(1).y + g(1).s], [33, g(14).y]], { ...TESTS, from: 1, to: 14 }),
  // 6 · the harness under the annexes: every vitest package devDepends on
  //    @tools/lit-test-env and @tools/happy-dom (turbo test inputs vitest.setup.ts).
  road([[91, g(23).y], [91, 335], [104, 335]], { ...TESTS, t0: 9, t1: 0, mk: null }),
  road([[131, g(26).y], [131, 335], [106, 335]], { ...TESTS, t0: 9, t1: 0, mk: null }),
  road([[105, 335], [105, g(1).ay + g(1).sa]], { ...TESTS, t0: 0, to: 1, toAnnex: true }),
  // 7 · the docs build is what cypress drives: sample-app-lit-e2e depends on docs;
  //    turbo e2e dependsOn ^build, ^docs.
  road([[g(10).x, 352], [606, 352], [606, g(9).y2]], { ...TESTS, t0: 9, to: 9, toAnnex: true }),
  // 8 · @tools/shared is imported by five instruments; the road to the largest.
  road([[14, 563], [-106, 563], [-106, 430], [14, 430]], { ...LIB, t0: 9, t1: 66 }),
];

// ---- districts, derived from what was actually placed ----------------------------
const DIST = [['pkg', 24], ['app', 24], ['site', 24], ['tool', 26]];
const bounds = (d) => {
  const bs = M.filter((r) => r[2] === d).map((r) => g(r[0]));
  return [Math.min(...bs.map((b) => b.x)), Math.min(...bs.map((b) => b.y1)),
    Math.max(...bs.map((b) => b.x2)), Math.max(...bs.map((b) => b.y2))];
};
const districts = DIST.map(([d, pad]) => {
  const [x1, y1, x2, y2] = bounds(d);
  const pts = [[x1 - pad, y1 - pad], [x2 + pad, y1 - pad], [x2 + pad, y2 + pad], [x1 - pad, y2 + pad]]
    .map(([px, py]) => p2(px, py)).join(' ');
  return `<polygon points="${pts}" class="skf fnone" stroke-dasharray="5 4"/>`;
}).join('\n');

// ---- bodies, painted back to front ------------------------------------------------
const bodies = M.map(([n]) => n)
  .sort((a, b) => (g(a).x + g(a).y1 + g(a).s) - (g(b).x + g(b).y1 + g(b).s))
  .map(member)
  .join('\n');

// ---- schedule -----------------------------------------------------------------------
const ART_H = 812;
const TOT_SF = M.reduce((a, r) => a + r[6], 0), TOT_SL = M.reduce((a, r) => a + r[7], 0);
const TOT_PF = M.reduce((a, r) => a + r[8], 0), TOT_PL = M.reduce((a, r) => a + r[9], 0);
const schedRow = ([n, name, , tier, , , sf, sl, pf, pl, note]) =>
  `${String(n).padStart(2, ' ')}  ${name} — ${sf ? `${sf}f · ${fmt(sl)}` : 'no source'}`
  + `${pf ? ` · annex ${pf}f · ${fmt(pl)}` : ''} · ${TIER_TEXT[tier]} · ${note}`;
const half = Math.ceil(M.length / 2);
const SY = ART_H + 16;
const schedule = `<rect x="40" y="${SY}" width="1480" height="${74 + half * 17}" class="sk fp"/>
${txt(58, SY + 22, 'STRUCTURE SCHEDULE — authored source per member · files (f) · sloc · spec annex · gate tier', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1520" y2="${SY + 32}" class="skf"/>
${M.slice(0, half).map((r, i) => txt(58, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${M.slice(half).map((r, i) => txt(800, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${txt(58, SY + 58 + half * 17, `TOTAL — 27 members, 26 massed · ${TOT_SF} authored files · ${fmt(TOT_SL)} sloc · plus ${TOT_PF} spec files · ${fmt(TOT_PL)} sloc of annex · counted 2026-08-16`, 'lbls')}`;

const svg = `<svg viewBox="0 0 1560 ${SY + 104 + half * 17}" role="img" aria-label="An isometric census city of the whole lit-ui-router workspace, drawn in four dashed districts. Every workspace member is a block massed by its own measured source — footprint side proportional to the square root of its authored lines, height three pixels per authored file — and every member that has tests carries a hatched annex beside it, massed the same way from its spec files. Upper left is the packages district, the product: lit-ui-router and ui-router-server each stand beside an annex with a larger footprint than the building it guards. To the right is the apps district, where sample-app-shared is the broadest source block on the sheet at thirty-six files and 2,103 lines. Below it sits the shopfront of docs and examples, and lower left the instrument yard of sixteen tools, dominated by the tall red release block — forty-four files and 1,871 lines, the only structure that can halt a publish. Gate severity is carried in colour, never in height: solid red halts a publish, red hatch stops the pull request line, accent hatch gates a later stage, faint blocks never gate at all. Roads run between the districts and carry real edges from the repository: solid roads where one member builds into another, dashed soft roads where tests exercise the code they cover, and an accent road that leaves both the source block and its spec annex together, because typecheck reads both. A structure schedule below lists all twenty-seven members with exact file and line counts, their annex, and their gate tier.">
${defs(P)}

<rect x="40" y="26" width="520" height="42" class="skf fnone"/>
${txt(52, 43, 'THE CENSUS CITY — WHO IS ACTUALLY HERE', 'lbls')}
${txt(52, 58, '27 workspace members · 4 districts · every road below is a real edge in the repo', 'lblf')}

${txt(1520, 34, 'SCALE — footprint side = 1.6 · √sloc (plan area ∝ sloc) · height = 3 px per authored file · mass = sloc × files', 'lbls', 'end')}
${txt(1520, 48, 'footprint floored at 12 plan units so the smallest instruments stay visible · annexes massed on the same rule from spec files', 'lblf', 'end')}
${txt(1520, 62, 'GATE SEVERITY IS COLOUR, NOT HEIGHT — tiers match sheet 3 · the tallest block on the sheet is also the only publish halt', 'lblf', 'end')}

<!-- severity ladder -->
<rect x="1090" y="104" width="430" height="146" class="skf fnone"/>
${txt(1106, 126, 'GATE SEVERITY — READ THE COLOUR, NOT THE HEIGHT', 'lbls')}
${[
  ['skr', 'fr', null, 'halts a publish — 12', 'lblr'],
  ['skr', 'fp', 'hr', 'stops the PR line — 9 · 14 · 19 · 23 · 26', 'lblr'],
  ['ska', 'fp', 'ha', 'gates a later stage — 17', 'lbla'],
  ['skf', 'fp2', null, 'never gates — 13 · 15 · 16 · 18 · 22 · 24 · 25', 'lbls'],
].map(([edge, fill, hatch, label, cls], i) => {
  const y = 150 + i * 24;
  return `<rect x="1106" y="${y}" width="34" height="14" class="${fill}"/>${hatch ? `<rect x="1106" y="${y}" width="34" height="14" fill="url(#${P}-${hatch})"/>` : ''}<rect x="1106" y="${y}" width="34" height="14" class="${edge} fnone"/>
${txt(1154, y + 11, label, cls)}`;
}).join('\n')}

${districts}
${roads.join('\n')}
${bodies}

<!-- road tags: each keys a row of the ROAD REGISTER below -->
${[['A', 884, 302], ['B', 566, 366], ['C', 462, 214], ['D', 522, 250], ['E', 902, 540], ['F', 879, 498], ['G', 62, 330]]
  .map(([k, x, y]) => txt(x, y, k, 'lbl')).join('\n')}

<!-- district lettering, off the geometry, leaders where the gap is wide -->
${txt(772, 110, 'packages/ — THE PRODUCT', 'lblb')}
${txt(772, 123, '4 published packages · 25 files · 2,568 sloc', 'lblf')}
${txt(772, 135, 'every one carries a bigger annex than itself', 'lblf')}
<line x1="766" y1="126" x2="742" y2="168" class="skf"/>

${txt(1540, 300, 'sample-app-shared — 36f · 2,103 sloc', 'lblb', 'end')}
${txt(1540, 313, 'the broadest source block on the sheet —', 'lblf', 'end')}
${txt(1540, 325, 'outbuilt only by lit-ui-router’s spec annex', 'lblf', 'end')}
<line x1="1258" y1="318" x2="1132" y2="340" class="skf"/>

${txt(1540, 380, 'apps/ — THE PROVING GROUND', 'lblb', 'end')}
${txt(1540, 393, '5 members · 55 files · 3,052 sloc', 'lblf', 'end')}
${txt(1540, 405, 'the proving ground gates nothing but e2e', 'lblf', 'end')}
<line x1="1284" y1="416" x2="1248" y2="446" class="skf"/>

${txt(1014, 656, 'docs/ + examples/ — THE SHOPFRONT', 'lblb')}
${txt(1014, 669, '2 members · 15 files · 1,794 sloc', 'lblf')}
<line x1="1008" y1="652" x2="986" y2="636" class="skf"/>

${txt(60, 560, 'tools/ — THE INSTRUMENT YARD', 'lblb')}
${txt(60, 573, '16 members · 87 files · 4,684 sloc', 'lblf')}
${txt(60, 585, 'nine of them sit on this drawing’s minimum footprint', 'lblf')}
<line x1="300" y1="552" x2="330" y2="522" class="skf"/>

<!-- callouts -->
${txt(60, 118, 'lit-ui-router — THE PACKAGE THIS SET IS ABOUT', 'lbla')}
${txt(60, 132, '12 authored files · 1,189 sloc', 'lblf')}
${txt(60, 144, 'its annex — 14 files · 2,879 sloc, 2.4× the source', 'lblf')}
${txt(60, 156, 'the biggest thing this district ever built is a test', 'lblf')}
<line x1="346" y1="126" x2="526" y2="132" class="skf"/>

${txt(20, 502, '@tools/release — 44f · 1,871 sloc', 'lblr')}
${txt(20, 515, 'the tallest block on the sheet,', 'lblf')}
${txt(20, 527, 'and the only publish halt', 'lblf')}
<line x1="160" y1="496" x2="215" y2="362" class="skf"/>

<!-- road register: every road on this sheet, and the edge in the repo it stands for -->
<rect x="40" y="646" width="700" height="162" class="skf fnone"/>
${txt(58, 666, 'ROAD REGISTER — NO ROAD IS DRAWN THAT THE REPO DOES NOT CARRY', 'lbls')}
<line x1="40" y1="674" x2="740" y2="674" class="skf"/>
${[
  ['A', 'builds into', 'packages/* → the sample apps · lit-ui-router → 3 of them, ui-router-server → routes'],
  ['B', 'builds into', '@tools/oxc-emit → all four packages · devDep of each · runs build:js + build:types'],
  ['C', 'tests exercise', '@tools/dts-backtest → the four packages · deps all four · #test dependsOn ^build'],
  ['D', 'tests exercise', '@tools/lit-test-env + @tools/happy-dom → the annex · devDep of lit-ui-router + -mobx'],
  ['E', 'tests exercise', 'sample-app-lit-e2e → docs · workspace dep · turbo e2e dependsOn ^build, ^docs'],
  ['F', 'typecheck reads', 'lit-ui-router src AND specs → docs · tsconfig include src/** · turbo dependsOn ^build:types'],
  ['G', 'library under', '@tools/shared → @tools/release · one of five importers; only this road is drawn'],
].map(([k, cls, ev], i) => {
  const y = 692 + i * 15;
  return `${txt(58, y, k, 'lbl')}${txt(78, y, cls, 'lbls')}${txt(190, y, ev, 'lblf')}`;
}).join('\n')}
${txt(58, 798, 'apps → docs is road A continued: docs depends on three sample apps and on all four packages', 'lblf')}

${schedule}
</svg>`;

export const sheet7 = {
  num: 7, id: 'census', rev: 'B',
  title: 'THE MEASURED CITY',
  sub: 'ALTITUDE 3½ — the same city as sheet 3, surveyed by mass · 27 members · 4 districts · REV B: districts, gate severity in colour, and the roads between them — counted 2026-08-16',
  scale: 'WHOLE WORKSPACE',
  form: 'MEASURED CITY',
  svg,
  caption: 'Sheet 3 drew the monorepo as a process; this sheet counts who lives in it. Rev B keeps the census — footprint ∝ √sloc, height ∝ authored files, tests drawn as annexes rather than deleted — and adds the two things a census alone cannot say: which districts these members belong to, and which roads actually run between them. Every road is a workspace dependency or a turbo task edge, never an impression.',
  notes: `
<p><strong>Method — one basis, two series.</strong> Counted from this repo's authored source at HEAD on 2026-08-16, the same basis as sheets 3 and 4: <code>.ts/.tsx/.js/.jsx/.mjs</code> under each member's source directory, excluding <code>*.d.ts</code>, <code>*.test-d.ts</code>, fixtures, <code>dist/</code> and <code>node_modules/</code>; <em>sloc</em> is lines that are neither blank nor comment-only. Sheet 3 throws test code away; this sheet does not — anything matching <code>*.{spec,test,cy}.*</code> or living under <code>specs/ test/ tests/ __tests__/ cypress/</code> is counted into a second series and drawn as that member's annex. 27 members: 182 authored files and 12,098 sloc of source, plus 76 files and 9,850 sloc of spec. The packages district reconciles exactly with sheet 3's source slab — 25 files, 2,568 lines.</p>
<p><strong>Every shipped building still has an annex bigger than itself.</strong> <code>lit-ui-router</code>: 1,189 authored lines against 2,879 of spec (2.4×). <code>ui-router-server</code>: 1,141 vs 2,174 (1.9×). <code>lit-ui-router-mobx</code>: 133 vs 380 (2.9×). <code>navigation-location-plugin</code> is one 105-line file with seven spec files over it (3.9×). The test budget lives exactly where the repo says it should — in <code>packages/*</code>, and nowhere else at that ratio.</p>
<p><strong>The roads are the new content, and every one is citable.</strong> Solid roads are build edges: <code>packages/*</code> into the sample apps, the apps into <code>docs</code>, <code>@tools/oxc-emit</code> into all four packages — each a <code>workspace:</code> dependency, each backed by turbo's <code>build</code>/<code>docs</code> tasks depending on <code>^build</code>. Dashed soft roads are the test lane: <code>@tools/dts-backtest</code> depends on all four published packages and backtests their emitted <code>d.ts</code> against the TS 5.0 floor; <code>@tools/lit-test-env</code> and <code>@tools/happy-dom</code> run up into <code>lit-ui-router</code>'s annex because they are its devDependencies and the harness its suites load; <code>sample-app-lit-e2e</code> depends on <code>docs</code>, and turbo's <code>e2e</code> depends on <code>^docs</code>, so Cypress drives the shopfront build rather than a dev server. The accent road is the one that leaves a member twice — once from the source block and once from the spec annex — because the package's <code>typecheck</code> reads both: <code>tsconfig.json</code> includes <code>src/**</code>, specs and all (only the narrower <code>typecheck:src</code> excludes them), while the <code>^build:types</code> dependency is what carries the result into the next district. One faint road remains: five instruments import <code>@tools/shared</code>; only the road to the largest is drawn, because drawing all five would turn the yard into hatching.</p>
<p><strong>Severity in colour, mass in geometry — and they disagree.</strong> The tiers are sheet 3's, applied to whole members: <code>@tools/release</code> is solid red because it hosts <code>published-diff</code>, the only structure that halts a publish; red hatch marks the five members that can stop a pull request — Cypress <code>e2e</code>, <code>dts-backtest</code>, <code>compat-guards</code>, <code>lit-test-env</code>, <code>happy-dom</code>; accent hatch marks <code>@tools/workers-builds</code>, which gates the docs deploy and nothing earlier. Here the two encodings happen to agree once, on <code>release</code>, and disagree everywhere else: the harness that can stop every pull request in the repo is 8 authored lines of <code>@tools/happy-dom</code>, sitting on the drawing's minimum footprint.</p>
<p><strong>What the districts say.</strong> The product is four modest buildings — 2,568 lines — against 4,684 in the instrument yard and 3,052 in the proving ground. The broadest source block on the sheet belongs to <code>sample-app-shared</code>, which ships to nobody and gates nothing — and the only footprint that outbuilds it anywhere on the sheet is <code>lit-ui-router</code>'s spec annex. <code>@tools/wintercg-globals</code> is drawn on the floor with no mass at all: it is ambient types, and a census that hides its empty members is not a census.</p>`,
  key: [
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp"/>', 'a member, massed — footprint ∝ √sloc, height ∝ files'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sks fp2"/><rect x="8" y="3" width="18" height="12" fill="url(#s7-hd)"/>', 'its spec annex — the test mass, same rule'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="fr"/><rect x="6" y="3" width="36" height="12" class="skr fnone"/>', 'halts a publish (@tools/release)'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#s7-hr)"/><rect x="6" y="3" width="36" height="12" class="skr fnone"/>', 'stops the PR line'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#s7-ha)"/><rect x="6" y="3" width="36" height="12" class="ska fnone"/>', 'gates a later stage (the docs deploy)'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="skf fp2"/>', 'never gates — reporters, libraries, the material'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="sk2"/>', 'builds into — a workspace dep feeding a build'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="sks" stroke-dasharray="5 4"/>', 'tests exercise — harness in, backtest out'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="ska" stroke-dasharray="7 4"/>', 'typecheck reads — from src AND annex'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="sks" stroke-dasharray="1 4"/>', 'library under the instruments'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'district (workspace glob)'),
  ].join('\n'),
};

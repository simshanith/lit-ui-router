import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, arrow, isoBlock, isoPt, keyRow } from './helpers.mjs';
import { depthSort, solidFaces } from './iso-hidden.mjs';

const P = 's7';
const OX = 600, OY = 96;

// ---- census: every number below comes from diagrams/data/census-city.json ----
// The plate is the checked-in snapshot written by census-city.mjs: authored
// .ts/.tsx/.js/.jsx/.mjs under each member's source dir, excluding *.d.ts,
// *.test-d.ts, fixtures/, dist/, node_modules/; sloc = scc's `Code` count —
// string-aware, so the interior of a template literal counts as code rather
// than as one line.  Sheet 7 differs from sheet 3 on one point, deliberately:
// it does not throw test code away.  Files matching *.{spec,test,cy}.* or
// living under specs/ test/ tests/ __tests__/ cypress/ are the SECOND series,
// drawn as that member's annex.  This file holds placement and prose only.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-city.json', import.meta.url), 'utf8'));
const ROW = new Map(PLATE.rows.map((r) => [r.member, r]));
const row = (dir) => {
  const r = ROW.get(dir);
  if (!r) throw new Error(`sheet 7: member ${dir} is missing from diagrams/data/census-city.json`);
  return r;
};
const ratio = (dir) => (row(dir).specSloc / row(dir).srcSloc).toFixed(1);
const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;

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

// [n, name, plate member dir, district, tier, x, y, note] — counts come from the plate
// exported: plate 7B draws the same city, so it imports this table rather than copying it
export const PLACED = [
  // --- packages/ — the product -------------------------------------------------
  [1,  'lit-ui-router',            'packages/lit-ui-router',             'pkg',  'line',     0,  20, `the subject of this set · annex ${ratio('packages/lit-ui-router')}× the source`],
  [2,  'ui-router-server',         'packages/ui-router-server',          'pkg',  'line',   200,  20, `the server adapter · annex ${ratio('packages/ui-router-server')}×`],
  [3,  'lit-ui-router-mobx',       'packages/lit-ui-router-mobx',        'pkg',  'line',   170, 130, `the mobx companion · annex ${ratio('packages/lit-ui-router-mobx')}×`],
  [4,  'navigation-location-plugin','packages/navigation-location-plugin','pkg', 'line',   260, 130, 'one 105-line file, seven spec files'],
  // --- apps/ — the proving ground ----------------------------------------------
  [5,  'sample-app-shared',        'apps/sample-app-shared',             'app',  'line',   570,  10, 'the routes + views every sample app mounts'],
  [6,  'sample-app-lit-vanilla',   'apps/sample-app-lit-vanilla',        'app',  'line',   720,  10, 'the plain-lit demo'],
  [7,  'sample-app-lit-mobx',      'apps/sample-app-lit-mobx',           'app',  'line',   720,  90, 'the mobx demo'],
  [8,  'sample-app-routes',        'apps/sample-app-routes',             'app',  'line',   700, 150, 'the shared route table, server-side too'],
  [9,  'sample-app-lit-e2e',       'apps/sample-app-lit-e2e',            'app',  'pr',     580, 150, 'cypress · drives the docs build'],
  // --- docs/ + examples/ — the shopfront ---------------------------------------
  [10, 'docs',                     'docs',                               'site', 'line',   660, 340, 'vitepress + the worker that serves it'],
  [11, 'examples',                 'examples',                           'site', 'line',   660, 430, 'stackblitz-ready copies, own lockfiles'],
  // --- tools/ — the instrument yard --------------------------------------------
  [12, '@tools/release',           'tools/release',                      'tool', 'halt',    20, 430, 'hosts published-diff — the one publish halt'],
  [13, '@tools/typedoc-plugin',    'tools/typedoc-plugin-lit-ui-router', 'tool', 'report', 230, 430, 'builds the API pages, gates nothing'],
  [14, '@tools/dts-backtest',      'tools/dts-backtest',                 'tool', 'pr',       8, 350, 'one 291-line run.ts holds the TS 5.0 floor'],
  [15, '@tools/build_and_test',    'tools/build_and_test',               'tool', 'report', 330, 430, 'the CI graph helper — and its error summary'],
  [16, '@tools/shared',            'tools/shared',                       'tool', 'report',  20, 550, 'the library under the instruments'],
  [17, '@tools/workers-builds',    'tools/workers-builds',               'tool', 'late',   220, 550, 'the docs deploy watch'],
  [18, '@tools/bundle-probe',      'tools/bundle-probe',                 'tool', 'report', 330, 550, 'size probe, advisory'],
  [19, '@tools/compat-guards',     'tools/compat-guards',                'tool', 'pr',     130, 550, 'the lit 2 / mobx 6 / peer-floor lanes'],
  [20, '@tools/oxc-emit',          'tools/oxc-emit',                     'tool', 'line',   230, 350, 'both build passes, one emitter'],
  [21, '@tools/release-config',    'tools/release-config',               'tool', 'line',   280, 350, 'the shared release-it config'],
  [22, '@tools/lit-template-lint', 'tools/lit-template-lint',            'tool', 'report', 325, 350, 'the lit-analyzer wrapper'],
  [23, '@tools/lit-test-env',      'tools/lit-test-env',                 'tool', 'pr',      85, 350, 'the browser harness every suite loads'],
  [24, '@tools/vue-check',         'tools/vue-check',                    'tool', 'report', 370, 350, 'vue-tsc over the docs components'],
  [25, '@tools/lcov-rebase',       'tools/lcov-rebase',                  'tool', 'report', 415, 350, 'coverage path rewriting'],
  [26, '@tools/happy-dom',         'tools/happy-dom',                    'tool', 'pr',     125, 350, 'the node-side DOM the unit suites run in'],
  [27, '@tools/wintercg-globals',  'tools/wintercg-globals',             'tool', 'off',    185, 350, 'ambient types only — nothing to mass'],
  // --- born 2026-08-31 (#639) and 2026-08-16 (#557) — first drawn at rev D ------
  [28, '@tools/lint-elements',     'tools/lint-elements',                'tool', 'pr',     380, 550, 'the shared custom-element lint lane (#655)'],
  [29, '@tools/warn-lanes',        'tools/warn-lanes',                   'tool', 'report', 430, 530, 'the warning ratchet — reports a floor, never gates'],
  [30, '@tools/eslint-ts-parser',  'tools/eslint-ts-parser',             'tool', 'report',  54, 350, 'a one-line parser shim — the smallest thing in the yard'],
  // --- the fifth published package (#676) — first drawn here --------------------
  [31, 'eslint-plugin-lit-ui-router', 'packages/eslint-plugin-lit-ui-router', 'pkg', 'line', 350, 170, `the vendored lint rules that read uiSref · annex ${ratio('packages/eslint-plugin-lit-ui-router')}×`],
];

// [n, name, district, tier, x, y, srcFiles, srcSloc, specFiles, specSloc, note]
const M = PLACED.map(([n, name, dir, dist, tier, x, y, note]) => {
  const c = row(dir);
  return [n, name, dist, tier, x, y, c.srcFiles, c.srcSloc, c.specFiles, c.specSloc, note];
});
const dsum = (d) => M.filter((r) => r[2] === d)
  .reduce((a, r) => ({ n: a.n + 1, f: a.f + r[6], sl: a.sl + r[7] }), { n: 0, f: 0, sl: 0 });
const DP = dsum('pkg'), DA = dsum('app'), DS = dsum('site'), DT = dsum('tool');
const inTier = (t) => M.filter((r) => r[3] === t).map((r) => r[0]).join(' · ');

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
// Each is its own mass — the annex is not always in front of the block it belongs to.
function srcMass(n) {
  const b = g(n);
  const t = TIER[b.tier];
  const src = solidFaces(isoBlock(P, OX, OY, b.x, b.y, b.s, b.s, b.h, { capCls: t.cap, edge: t.edge, sideFill: t.side }));
  const top = [p2(b.x, b.y, b.h), p2(b.x + b.s, b.y, b.h), p2(b.x + b.s, b.y + b.s, b.h), p2(b.x, b.y + b.s, b.h)].join(' ');
  const wash = t.hatch
    ? `<polygon points="${top}" fill="url(#${P}-${t.hatch})"/>\n<polygon points="${top}" class="${t.edge} fnone"/>`
    : '';
  return { x: b.x, y: b.y, w: b.s, d: b.s, svg: `${src}${wash}` };
}
const annexMass = (n) => {
  const b = g(n);
  return { x: b.ax, y: b.ay, w: b.sa, d: b.sa,
    svg: solidFaces(isoBlock(P, OX, OY, b.ax, b.ay, b.sa, b.sa, b.ha, { edge: 'sks', capCls: 'fp2', sideFill: `url(#${P}-hd)` })) };
};
// Badges ride above the roofline in clear air, so they are painted after the city.
function badge(n) {
  const b = g(n);
  const t = TIER[b.tier];
  const [bx, by] = pt(b.x + b.s / 2, b.y, b.h);
  const lift = BADGE_LIFT[n] ?? 15;
  return `<circle cx="${bx.toFixed(1)}" cy="${(by - lift).toFixed(1)}" r="9" class="${t.badge}"/>
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
  //    -mobx and -routes (and on the four runtime packages).  turbo: docs dependsOn ^build.
  road([[680, g(8).y2], [680, g(10).y]], { ...BUILDS, t0: 9, to: 10 }),
  // 3 · @tools/oxc-emit is a devDependency of all five packages and runs both
  //    build passes (turbo build:js / build:types); drawn to the nearest of them.
  road([[238, g(20).y], [238, 180], [268, 180], [268, g(4).y + g(4).s]], { ...BUILDS, t0: 9, to: 4 }),
  // 4 · typecheck reads BOTH series: turbo typecheck dependsOn ^build:types, and
  //    its inputs are $TURBO_DEFAULT$ — every tracked file of the package, src and
  //    specs alike.  Two stubs, one trunk, into the consumer that reads the types.
  road([[27, g(1).y + g(1).s], [27, 115]], { ...READS, from: 1, mk: null }),
  road([[108, g(1).ay + g(1).sa], [108, 115]], { ...READS, t0: clr(1, 9, true), mk: null }),
  road([[27, 115], [540, 115], [540, 345], [g(10).x, 345]], { ...READS, t0: 0, to: 10 }),
  // 5 · @tools/dts-backtest depends on the four runtime packages and backtests
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
// Order is topological on the plan-axis separation, not a distance guess: with the
// faces now opaque, a front mass hides the rear edges of everything behind it.
const bodies = depthSort(M.flatMap(([n]) => (g(n).sa ? [srcMass(n), annexMass(n)] : [srcMass(n)])))
  .map((m) => m.svg).join('\n')
  + '\n' + M.map(([n]) => badge(n)).join('\n');

// ---- schedule -----------------------------------------------------------------------
const ART_H = 812;
const TOT_SF = M.reduce((a, r) => a + r[6], 0), TOT_SL = M.reduce((a, r) => a + r[7], 0);
const TOT_PF = M.reduce((a, r) => a + r[8], 0), TOT_PL = M.reduce((a, r) => a + r[9], 0);
const schedRow = ([n, name, , tier, , , sf, sl, pf, pl, note]) =>
  `${String(n).padStart(2, ' ')}  ${name} — ${sf ? `${sf}f · ${fmt(sl)}` : 'no source'}`
  + `${pf ? ` · annex ${pf}f · ${fmt(pl)}` : ''} · ${TIER_TEXT[tier]} · ${note}`;
const MASSED = M.filter((r) => r[6]).length;
const half = Math.ceil(M.length / 2);
const SY = ART_H + 16;
const schedule = `<rect x="40" y="${SY}" width="1480" height="${74 + half * 17}" class="sk fp"/>
${txt(58, SY + 22, 'STRUCTURE SCHEDULE — authored source per member · files (f) · sloc · spec annex · gate tier', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1520" y2="${SY + 32}" class="skf"/>
${M.slice(0, half).map((r, i) => txt(58, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${M.slice(half).map((r, i) => txt(800, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${txt(58, SY + 58 + half * 17, `TOTAL — ${M.length} members, ${MASSED} massed · ${TOT_SF} authored files · ${fmt(TOT_SL)} sloc · plus ${TOT_PF} spec files · ${fmt(TOT_PL)} sloc of annex · ${BASIS} (sloc = scc Code)`, 'lbls')}`;

const svg = `<svg viewBox="0 0 1560 ${SY + 104 + half * 17}" role="img" aria-label="An isometric census city of the whole lit-ui-router workspace, drawn in four dashed districts. Every workspace member is a block massed by its own measured source — footprint side proportional to the square root of its authored lines, height three pixels per authored file — and every member that has tests carries a hatched annex beside it, massed the same way from its spec files. Upper left is the packages district, the product: lit-ui-router and ui-router-server each stand beside an annex with a larger footprint than the building it guards, and the fifth package, the eslint plugin, stands below them at the district's near corner. To the right is the apps district, where sample-app-shared is the broadest source block on the sheet at thirty-seven files and 2,211 lines. Below it sits the shopfront of docs and examples, and lower left the instrument yard of nineteen tools, dominated by the tall red release block — forty-six files and 2,067 lines, the only structure that can halt a publish. Gate severity is carried in colour, never in height: solid red halts a publish, red hatch stops the pull request line, accent hatch gates a later stage, faint blocks never gate at all. Roads run between the districts and carry real edges from the repository: solid roads where one member builds into another, dashed soft roads where tests exercise the code they cover, and an accent road that leaves both the source block and its spec annex together, because typecheck reads both. A structure schedule below lists all thirty-one members with exact file and line counts, their annex, and their gate tier.">
${defs(P)}

<rect x="40" y="26" width="520" height="42" class="skf fnone"/>
${txt(52, 43, 'THE CENSUS CITY — WHO IS ACTUALLY HERE', 'lbls')}
${txt(52, 58, `${M.length} workspace members · 4 districts · every road below is a real edge in the repo`, 'lblf')}

${txt(1520, 34, 'SCALE — footprint side = 1.6 · √sloc (plan area ∝ sloc) · height = 3 px per authored file · mass = sloc × files', 'lbls', 'end')}
${txt(1520, 48, 'footprint floored at 12 plan units so the smallest instruments stay visible · annexes massed on the same rule from spec files', 'lblf', 'end')}
${txt(1520, 62, 'GATE SEVERITY IS COLOUR, NOT HEIGHT — tiers match sheet 3 · the tallest block on the sheet is also the only publish halt', 'lblf', 'end')}
${txt(1520, 76, `every number on this sheet is read from diagrams/data/census-city.json — ${BASIS}`, 'lblf', 'end')}

<!-- severity ladder -->
<rect x="1090" y="104" width="430" height="146" class="skf fnone"/>
${txt(1106, 126, 'GATE SEVERITY — READ THE COLOUR, NOT THE HEIGHT', 'lbls')}
${[
  ['skr', 'fr', null, `halts a publish — ${inTier('halt')}`, 'lblr'],
  ['skr', 'fp', 'hr', `stops the PR line — ${inTier('pr')}`, 'lblr'],
  ['ska', 'fp', 'ha', `gates a later stage — ${inTier('late')}`, 'lbla'],
  ['skf', 'fp2', null, `never gates — ${inTier('report')}`, 'lbls'],
].map(([edge, fill, hatch, label, cls], i) => {
  const y = 150 + i * 24;
  return `<rect x="1106" y="${y}" width="34" height="14" class="${fill}"/>${hatch ? `<rect x="1106" y="${y}" width="34" height="14" fill="url(#${P}-${hatch})"/>` : ''}<rect x="1106" y="${y}" width="34" height="14" class="${edge} fnone"/>
${txt(1154, y + 11, label, cls)}`;
}).join('\n')}

${districts}
${roads.join('\n')}
${bodies}

<!-- road tags: each keys a row of the ROAD REGISTER below -->
${[['A', 900, 300], ['B', 566, 366], ['C', 470, 195], ['D', 522, 262], ['E', 902, 540], ['F', 879, 498], ['G', 62, 330]]
  .map(([k, x, y]) => txt(x, y, k, 'lbl')).join('\n')}

<!-- district lettering, off the geometry, leaders where the gap is wide -->
${txt(772, 110, 'packages/ — THE PRODUCT', 'lblb')}
${txt(772, 123, `${DP.n} published packages · ${DP.f} files · ${fmt(DP.sl)} sloc`, 'lblf')}
${txt(772, 135, 'every one carries a bigger annex than itself', 'lblf')}
<line x1="766" y1="126" x2="742" y2="168" class="skf"/>

${txt(1540, 300, `sample-app-shared — ${g(5).sf}f · ${fmt(g(5).sl)} sloc`, 'lblb', 'end')}
${txt(1540, 313, 'the broadest source block on the sheet —', 'lblf', 'end')}
${txt(1540, 325, 'outbuilt only by lit-ui-router’s spec annex', 'lblf', 'end')}
<line x1="1258" y1="318" x2="1132" y2="340" class="skf"/>

${txt(1540, 380, 'apps/ — THE PROVING GROUND', 'lblb', 'end')}
${txt(1540, 393, `${DA.n} members · ${DA.f} files · ${fmt(DA.sl)} sloc`, 'lblf', 'end')}
${txt(1540, 405, 'the proving ground gates nothing but e2e', 'lblf', 'end')}
<line x1="1284" y1="416" x2="1248" y2="446" class="skf"/>

${txt(1014, 656, 'docs/ + examples/ — THE SHOPFRONT', 'lblb')}
${txt(1014, 669, `${DS.n} members · ${DS.f} files · ${fmt(DS.sl)} sloc`, 'lblf')}
<line x1="1008" y1="652" x2="986" y2="636" class="skf"/>

${txt(60, 560, 'tools/ — THE INSTRUMENT YARD', 'lblb')}
${txt(60, 573, `${DT.n} members · ${DT.f} files · ${fmt(DT.sl)} sloc`, 'lblf')}
${txt(60, 585, 'ten of its masses sit on this drawing’s minimum footprint', 'lblf')}
<line x1="300" y1="552" x2="330" y2="522" class="skf"/>

<!-- callouts -->
${txt(60, 118, 'lit-ui-router — THE PACKAGE THIS SET IS ABOUT', 'lbla')}
${txt(60, 132, `${g(1).sf} authored files · ${fmt(g(1).sl)} sloc`, 'lblf')}
${txt(60, 144, `its annex — ${g(1).pf} files · ${fmt(g(1).pl)} sloc, ${ratio('packages/lit-ui-router')}× the source`, 'lblf')}
${txt(60, 156, 'the biggest thing this district ever built is a test', 'lblf')}
<line x1="346" y1="126" x2="526" y2="132" class="skf"/>

${txt(20, 502, `@tools/release — ${g(12).sf}f · ${fmt(g(12).sl)} sloc`, 'lblr')}
${txt(20, 515, 'the tallest block on the sheet,', 'lblf')}
${txt(20, 527, 'and the only publish halt', 'lblf')}
<line x1="160" y1="496" x2="215" y2="362" class="skf"/>

<!-- road register: every road on this sheet, and the edge in the repo it stands for -->
<rect x="40" y="646" width="700" height="162" class="skf fnone"/>
${txt(58, 666, 'ROAD REGISTER — NO ROAD IS DRAWN THAT THE REPO DOES NOT CARRY', 'lbls')}
<line x1="40" y1="674" x2="740" y2="674" class="skf"/>
${[
  ['A', 'builds into', 'packages/* → the sample apps · lit-ui-router → 3 of them, ui-router-server → routes'],
  ['B', 'builds into', '@tools/oxc-emit → all five packages · devDep of each · runs build:js + build:types'],
  ['C', 'tests exercise', '@tools/dts-backtest → four of the five · deps those four · #test dependsOn ^build'],
  ['D', 'tests exercise', '@tools/lit-test-env + @tools/happy-dom → the annex · devDep of lit-ui-router + -mobx'],
  ['E', 'tests exercise', 'sample-app-lit-e2e → docs · workspace dep · turbo e2e dependsOn ^build, ^docs'],
  ['F', 'typecheck reads', 'lit-ui-router src AND specs → docs · tsconfig include src/** · turbo dependsOn ^build:types'],
  ['G', 'library under', '@tools/shared → @tools/release · one of seven importers; only this road is drawn'],
].map(([k, cls, ev], i) => {
  const y = 692 + i * 15;
  return `${txt(58, y, k, 'lbl')}${txt(78, y, cls, 'lbls')}${txt(190, y, ev, 'lblf')}`;
}).join('\n')}
${txt(58, 798, 'apps → docs is road A continued: docs depends on three sample apps and on the four runtime packages', 'lblf')}

${schedule}
</svg>`;

export const sheet7 = {
  num: 7, id: 'census', rev: 'D',
  title: 'THE MEASURED CITY',
  sub: `ALTITUDE 3½ — the same city as sheet 3, surveyed by mass · ${M.length} members · 4 districts · REV B: districts, gate severity in colour, and the roads between them — counted 2026-08-16 · REV C 2026-08-31: hidden-line pass — the masses now carry opaque faces and are painted back to front, so no rear iso edge reads through a front wall · REV D 2026-08-31: recount — three new instruments massed (28 lint-elements, 29 warn-lanes, 30 eslint-ts-parser), and every sloc rebased on scc 4.0.0’s Code count; on one identical file set the new ruler reads about +0.9% over the old “neither blank nor comment-only” filter, and the rest of the movement is code · every number now imported from diagrams/data/census-city.json — ${BASIS}`,
  scale: 'WHOLE WORKSPACE',
  form: 'MEASURED CITY',
  svg,
  caption: 'Sheet 3 drew the monorepo as a process; this sheet counts who lives in it. Rev B keeps the census — footprint ∝ √sloc, height ∝ authored files, tests drawn as annexes rather than deleted — and adds the two things a census alone cannot say: which districts these members belong to, and which roads actually run between them. Every road is a workspace dependency or a turbo task edge, never an impression.',
  notes: `
<p><strong>Method — one basis, two series.</strong> Every count on this sheet is read at build time from the checked-in plate <code>diagrams/data/census-city.json</code>, ${BASIS}: <code>.ts/.tsx/.js/.jsx/.mjs</code> under each member's source directory, excluding <code>*.d.ts</code>, <code>*.test-d.ts</code>, fixtures, <code>dist/</code> and <code>node_modules/</code>; <em>sloc</em> is <code>scc</code>'s <code>Code</code> count — string-aware, so the interior of a template literal counts as code rather than as one line. Sheet 3 throws test code away; this sheet does not — anything matching <code>*.{spec,test,cy}.*</code> or living under <code>specs/ test/ tests/ __tests__/ cypress/</code> is counted into a second series and drawn as that member's annex. ${M.length} members: ${TOT_SF} authored files and ${fmt(TOT_SL)} sloc of source, plus ${TOT_PF} files and ${fmt(TOT_PL)} sloc of spec. The packages district is five buildings now, and it still reconciles exactly with sheet 3's source slab — ${DP.f} files, ${fmt(DP.sl)} lines — because both are queries over the same census rather than two hand counts.</p>
<p><strong>Every shipped building still has an annex bigger than itself.</strong> <code>lit-ui-router</code>: ${fmt(g(1).sl)} authored lines against ${fmt(g(1).pl)} of spec (${ratio('packages/lit-ui-router')}×). <code>ui-router-server</code>: ${fmt(g(2).sl)} vs ${fmt(g(2).pl)} (${ratio('packages/ui-router-server')}×). <code>lit-ui-router-mobx</code>: ${g(3).sl} vs ${g(3).pl} (${ratio('packages/lit-ui-router-mobx')}×). <code>eslint-plugin-lit-ui-router</code>, the newcomer: ${g(31).sl} vs ${g(31).pl} (${ratio('packages/eslint-plugin-lit-ui-router')}×). <code>navigation-location-plugin</code> is one ${g(4).sl}-line file with ${g(4).pf} spec files over it (${ratio('packages/navigation-location-plugin')}×). The test budget lives exactly where the repo says it should — in <code>packages/*</code>, and nowhere else at that ratio.</p>
<p><strong>The roads are the new content, and every one is citable.</strong> Solid roads are build edges: <code>packages/*</code> into the sample apps, the apps into <code>docs</code>, <code>@tools/oxc-emit</code> into all five packages — each a <code>workspace:</code> dependency, each backed by turbo's <code>build</code>/<code>docs</code> tasks depending on <code>^build</code>. Dashed soft roads are the test lane: <code>@tools/dts-backtest</code> depends on the four runtime packages and backtests their emitted <code>d.ts</code> against the TS 5.0 floor; <code>@tools/lit-test-env</code> and <code>@tools/happy-dom</code> run up into <code>lit-ui-router</code>'s annex because they are its devDependencies and the harness its suites load; <code>sample-app-lit-e2e</code> depends on <code>docs</code>, and turbo's <code>e2e</code> depends on <code>^docs</code>, so Cypress drives the shopfront build rather than a dev server. The accent road is the one that leaves a member twice — once from the source block and once from the spec annex — because the package's <code>typecheck</code> reads both: <code>tsconfig.json</code> includes <code>src/**</code>, specs and all (only the narrower <code>typecheck:src</code> excludes them), while the <code>^build:types</code> dependency is what carries the result into the next district. One faint road remains: seven instruments now import <code>@tools/shared</code> — <code>src/globs.ts</code> (#655) added the custom-element glob three lanes share; only the road to the largest is drawn, because drawing all five would turn the yard into hatching.</p>
<p><strong>Severity in colour, mass in geometry — and they disagree.</strong> The tiers are sheet 3's, applied to whole members: <code>@tools/release</code> is solid red because it hosts <code>published-diff</code>, the only structure that halts a publish; red hatch marks the six members that can stop a pull request — Cypress <code>e2e</code>, <code>dts-backtest</code>, <code>compat-guards</code>, <code>lit-test-env</code>, <code>happy-dom</code>, and now <code>lint-elements</code>, whose ratchet exits non-zero on a new warning; accent hatch marks <code>@tools/workers-builds</code>, which gates the docs deploy and nothing earlier. Here the two encodings happen to agree once, on <code>release</code>, and disagree everywhere else: the harness that can stop every pull request in the repo is ${g(26).sl} authored lines of <code>@tools/happy-dom</code>, sitting on the drawing's minimum footprint.</p>
<p><strong>What the districts say.</strong> The product is ${DP.n} modest buildings — ${fmt(DP.sl)} lines — against ${fmt(DT.sl)} in the instrument yard and ${fmt(DA.sl)} in the proving ground. The broadest source block on the sheet belongs to <code>sample-app-shared</code>, which ships to nobody and gates nothing — and the only footprint that outbuilds it anywhere on the sheet is <code>lit-ui-router</code>'s spec annex. <code>@tools/wintercg-globals</code> is drawn on the floor with no mass at all: it is ambient types, and a census that hides its empty members is not a census.</p>
<p><strong>REV D — two things moved at once, and the plate keeps them apart.</strong> First the <em>ruler</em>: sloc is now <code>scc</code> 4.0.0's <code>Code</code> count rather than the old "neither blank nor comment-only" filter. Measured both ways over one identical file set — sheet 3 rev B's twenty-five source directories at today's HEAD — the old counter reads 11,560 and <code>scc</code> reads 11,658, about +0.9%. So roughly a hundred lines of the growth below is the tape measure, not the building. Second the <em>city</em>: fourteen days, one release (<code>lit-ui-router@1.10.0</code>, tagged 2026-08-17) and three new instruments. №28 <code>@tools/lint-elements</code> and №29 <code>@tools/warn-lanes</code> were both born 2026-08-31 (#639); №30 <code>@tools/eslint-ts-parser</code> was born 2026-08-16 (#557) and is the "28th member, not yet on any map" that plate 7B recorded — it can be placed now, and at 1 authored line it lands on the drawing's minimum footprint, the smallest thing in the yard. The yard is where the growth is: 16 members and 4,684 sloc become ${DT.n} and ${fmt(DT.sl)}, and it stays the city's largest district by a wide margin.</p>
<p><strong>Numbers by import, not by paste.</strong> Every count above and on the drawing is read from <code>diagrams/data/census-city.json</code>, the snapshot <code>census-city.mjs</code> writes out of the master per-file census; this file now holds placement, tiers and prose only. The plate is measured at a named ref rather than at whatever a working tree happens to hold — ${BASIS} — so a number here is citable to a committed file, and a member the sheet draws but the plate does not carry is a build error rather than a stale constant. Two things followed from the swap: the fifth published package, <code>eslint-plugin-lit-ui-router</code> (#676), gets a building for the first time — ${g(31).sf} files, ${g(31).sl} lines, with a ${g(31).pf}-file annex over it — and several members moved because the basis did, most visibly <code>@tools/oxc-emit</code>, hand-kept at 3 files and 100 lines and actually ${g(20).sf} files and ${g(20).sl}.</p>`,
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

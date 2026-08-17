import { defs } from './chrome.mjs';
import { txt, keyRow } from './helpers.mjs';

const P = 's7a';

// ---- the survey: sheet 7's city, metered for test shadow on 2026-08-17 ----------
// Footprints are sheet 7 rev B's census (main checkout, counted 2026-08-16), so
// this plate reconciles building-for-building with the measured city.  Shadows
// were metered at worktree HEAD 3557c29 by running each member's OWN suite under
// a coverage meter (generator: tmp/atlas-shadow/census-shadow.mjs):
//   packages/*        — the repo's own `turbo run test:coverage` tasks, unmodified
//   node:test members — node --test --experimental-test-coverage (CLI flags only)
//   tools/happy-dom   — vitest run --coverage.enabled --coverage.provider=v8
// Two members' source moved between the census and the metering (marked † in the
// schedule): lit-ui-router 1,189→1,325 sloc (same 12 files), build_and_test
// 5f/427→7f/756 (error-summary landed).  Footprints stay on the census; extents
// are computed against the code the meter actually saw.

// ---- scale rule — sheet 7's, unchanged ------------------------------------------
const KS = 1.6, MIN = 12;
const S = (sloc) => Math.max(MIN, KS * Math.sqrt(sloc));
const AG = 10;
const fmt = (v) => v.toLocaleString('en-US');

// ---- plan → screen (plan view: the same city seen from straight above) ----------
const K = 1.15, MX = 132, MY = 128;
const X = (x) => (MX + K * x).toFixed(1);
const Y = (y) => (MY + K * y).toFixed(1);

// ---- shadow bands: darkness = line coverage of what the suite loaded ------------
// Hue + hatch together: ink bands for healthy shadow, red bands where the
// shadow itself is pale; accent for e2e light; bare outline where no meter fits.
const BAND = (line) => (line == null ? null : line >= 95 ? 'b1' : line >= 85 ? 'b2' : line >= 70 ? 'b3' : 'b4');
const BANDS = {
  b1: { fill: `url(#${P}-s1)` },  // ≥95% — near-black
  b2: { fill: `url(#${P}-s2)` },  // 85–95%
  b3: { fill: `url(#${P}-s3)` },  // 70–85% — pale, red hatch
  b4: { fill: `url(#${P}-s4)` },  // <70% — palest, sparse red
};
const CAT_BADGE = {
  m: { badge: 'sk fp', num: 'lbl' },    // metered
  e: { badge: 'ska fp', num: 'lbla' },  // e2e light only
  u: { badge: 'sks fp', num: 'lbls' },  // tests run, meter cannot attach
  n: { badge: 'skr fp', num: 'lblr' },  // untested — full sun
  z: { badge: 'sks fp2', num: 'lbls' }, // no mass
};

// [n, name, dist, cat, x, y, srcSloc(census), specSloc(census), extent%, line%, branch%, func%]
// extent = sloc of files the suite loaded / member src sloc, both at worktree HEAD.
const M = [
  // --- packages/ — the product ---------------------------------------------------
  [1,  'lit-ui-router',            'pkg', 'm',   0,  20, 1189, 2879, 94.0, 98.1, 92.4, 97.4],
  [2,  'ui-router-server',         'pkg', 'm', 200,  20, 1141, 2174, 100,  99.6, 95.6, 98.3],
  [3,  'lit-ui-router-mobx',       'pkg', 'm', 170, 130,  133,  380, 97.7, 100,  91.7, 100],
  [4,  'navigation-location-plugin','pkg','m', 260, 130,  105,  410, 100,  100,  100,  100],
  // --- apps/ — the proving ground ------------------------------------------------
  [5,  'sample-app-shared',        'app', 'u', 570,  10, 2103,  309, null, null, null, null],
  [6,  'sample-app-lit-vanilla',   'app', 'e', 720,  10,  401,    0, null, null, null, null],
  [7,  'sample-app-lit-mobx',      'app', 'e', 720,  90,  440,    0, null, null, null, null],
  [8,  'sample-app-routes',        'app', 'm', 700, 150,   51,  185, 100,  100,  100,  null],
  [9,  'sample-app-lit-e2e',       'app', 'e', 580, 150,   57,  348, null, null, null, null],
  // --- docs/ + examples/ — the shopfront ------------------------------------------
  [10, 'docs',                     'site', 'm', 660, 340,  677,  181, 7.8, 100,  100,  100],
  [11, 'examples',                 'site', 'n', 660, 430, 1117,    0, null, null, null, null],
  // --- tools/ — the instrument yard -----------------------------------------------
  [12, '@tools/release',           'tool', 'm',  20, 430, 1871, 1896, 54.1, 98.4, 96.3, 96.8],
  [13, '@tools/typedoc-plugin',    'tool', 'n', 230, 430,  755,    0, null, null, null, null],
  [14, '@tools/dts-backtest',      'tool', 'n',   8, 350,  291,    0, null, null, null, null],
  [15, '@tools/build_and_test',    'tool', 'm', 330, 430,  427,  378, 61.4, 99.8, 93.5, 97.3],
  [16, '@tools/shared',            'tool', 'm',  20, 550,  300,  276, 82.7, 83.1, 98.0, 62.5],
  [17, '@tools/workers-builds',    'tool', 'm', 220, 550,  375,  266, 58.4, 99.3, 88.5, 100],
  [18, '@tools/bundle-probe',      'tool', 'n', 330, 550,  236,    0, null, null, null, null],
  [19, '@tools/compat-guards',     'tool', 'm', 130, 550,  189,  112, 12.2, 100,  100,  100],
  [20, '@tools/oxc-emit',          'tool', 'n', 230, 350,  100,    0, null, null, null, null],
  [21, '@tools/release-config',    'tool', 'n', 280, 350,   39,    0, null, null, null, null],
  [22, '@tools/lit-template-lint', 'tool', 'n', 325, 350,   21,    0, null, null, null, null],
  [23, '@tools/lit-test-env',      'tool', 'n',  85, 350,   24,    0, null, null, null, null],
  [24, '@tools/vue-check',         'tool', 'n', 370, 350,   25,    0, null, null, null, null],
  [25, '@tools/lcov-rebase',       'tool', 'm', 415, 350,   23,   30, 26.1, 100,  100,  100],
  [26, '@tools/happy-dom',         'tool', 'm', 125, 350,    8,   26, 0,    null, null, null],
  [27, '@tools/wintercg-globals',  'tool', 'z', 185, 350,    0,    0, null, null, null, null],
];

const geom = new Map(M.map((r) => {
  const [n, name, dist, cat, x, y, sl, pl, ext] = r;
  const s = S(sl);
  const sa = pl ? S(pl) : 0;
  const ax = x + s + AG, ay = y + (s - sa) / 2;
  // shadow reach: proportional to the footprint AND to how much of the source
  // the suite loads.  e2e / unmetered shadows are drawn at nominal full reach.
  const reach = cat === 'm' ? (ext ?? 0) / 100 : (cat === 'e' || cat === 'u') ? 1 : 0;
  const d = reach > 0 ? Math.max(4, 0.55 * s * reach) : 0;
  return [n, { n, name, dist, cat, x, y, s, sa, ax, ay, d, r }];
}));
const g = (n) => geom.get(n);

// Cast shadow: sun from the NE, so shadow falls SW — away from the spec annex
// that throws it.  Hexagon off the W + S silhouette edges.
function shadowPts(b) {
  const { x, y, s, d } = b;
  return [[x, y], [x - d, y + d], [x - d, y + s + d], [x + s - d, y + s + d], [x + s, y + s], [x, y + s]]
    .map(([px, py]) => `${X(px)},${Y(py)}`).join(' ');
}

function member(n) {
  const b = g(n);
  const [, , , cat, , , , , , line] = b.r;
  let shadow = '';
  if (b.d > 0) {
    if (cat === 'm') {
      shadow = `<polygon points="${shadowPts(b)}" fill="${BANDS[BAND(line)].fill}"/>`;
    } else if (cat === 'e') {
      shadow = `<polygon points="${shadowPts(b)}" fill="url(#${P}-se)"/>\n<polygon points="${shadowPts(b)}" class="ska fnone" stroke-dasharray="5 4"/>`;
    } else if (cat === 'u') {
      shadow = `<polygon points="${shadowPts(b)}" class="sks fnone" stroke-dasharray="2 4"/>`;
    }
  }
  return shadow;
}
function footprint(n) {
  const b = g(n);
  const cat = b.cat;
  const t = CAT_BADGE[cat];
  const fp = cat === 'z'
    ? `<rect x="${X(b.x)}" y="${Y(b.y)}" width="${(K * b.s).toFixed(1)}" height="${(K * b.s).toFixed(1)}" class="sks fnone" stroke-dasharray="2 3"/>`
    : `<rect x="${X(b.x)}" y="${Y(b.y)}" width="${(K * b.s).toFixed(1)}" height="${(K * b.s).toFixed(1)}" class="sk fp"/>`;
  const annex = b.sa
    ? `<rect x="${X(b.ax)}" y="${Y(b.ay)}" width="${(K * b.sa).toFixed(1)}" height="${(K * b.sa).toFixed(1)}" class="sks fnone" stroke-dasharray="3 3"/>`
    : '';
  const lift = BADGE_LIFT[n] ?? 0, dx = BADGE_DX[n] ?? 0;
  const bx = +X(b.x + b.s / 2 + dx), by = +Y(b.y) - 11 - lift;
  return `${fp}${annex}
<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="8.5" class="${t.badge}"/>
${txt(bx.toFixed(1), (by + 3.2).toFixed(1), String(n), t.num, 'middle')}`;
}
// №8's badge would sit inside №7's cast shadow — slide it west into clear air
const BADGE_LIFT = {};
const BADGE_DX = { 8: -17 };

// ---- districts, same bounds rule as sheet 7 (over footprint + annex) ------------
const DIST = [['pkg', 24], ['app', 24], ['site', 24], ['tool', 26]];
const bounds = (d) => {
  const bs = M.filter((r) => r[2] === d).map((r) => g(r[0]));
  return [Math.min(...bs.map((b) => b.x)), Math.min(...bs.map((b) => Math.min(b.y, b.sa ? b.ay : b.y))),
    Math.max(...bs.map((b) => b.x + b.s + (b.sa ? AG + b.sa : 0))), Math.max(...bs.map((b) => Math.max(b.y + b.s, b.sa ? b.ay + b.sa : 0)))];
};
const districts = DIST.map(([d, pad]) => {
  const [x1, y1, x2, y2] = bounds(d);
  return `<rect x="${X(x1 - pad)}" y="${Y(y1 - pad)}" width="${(K * (x2 - x1 + 2 * pad)).toFixed(1)}" height="${(K * (y2 - y1 + 2 * pad)).toFixed(1)}" class="skf fnone" stroke-dasharray="5 4"/>`;
}).join('\n');

const shadows = M.map(([n]) => member(n)).join('\n');
const prints = M.map(([n]) => footprint(n)).join('\n');

// ---- schedule --------------------------------------------------------------------
const CAT_TEXT = {
  m: 'metered', e: 'e2e light only', u: 'tests run, no meter', n: 'FULL SUN — no suite', z: 'no mass',
};
// [extentFiles, extentSloc: 'lit/total' at worktree HEAD, note]
const EXTRA = {
  1:  ['8/12f', '1,245/1,325†', 'unlit: barrels + interface.ts (type decls)'],
  2:  ['8/8f', '1,141/1,141', 'whole footprint near-black'],
  3:  ['3/4f', '130/133', 'unlit: the 3-sloc index barrel'],
  4:  ['1/1f', '105/105', 'all three meters read 100'],
  5:  [null, null, '43 tests pass · no coverage provider in browser mode · e2e-lit'],
  6:  [null, null, 'lit only by the cypress rig'],
  7:  [null, null, 'lit only by the cypress rig'],
  8:  ['2/2f', '51/51', 'route table fully lit (no functions to meter)'],
  9:  [null, null, 'the rig itself — its 57 sloc are the support code'],
  10: ['1/8f', '53/677', 'worker lit · the site (624 sloc) sees only e2e light'],
  11: [null, null, 'stackblitz copies — never tested'],
  12: ['23/44f', '1,013/1,871', '21 CLI wrappers (858 sloc) in the sun'],
  13: [null, null, 'builds the API pages, tests nothing'],
  14: [null, null, 'no self-suite — it IS the packages’ d.ts test'],
  15: ['4/7f', '464/756†', '3 CLI wrappers in the sun'],
  16: ['7/9f', '248/300', 'palest: exec 35/55 · workspace 63/103'],
  17: ['1/2f', '219/375', 'trigger wrapper in the sun'],
  18: [null, null, 'size probe, advisory, untested'],
  19: ['1/7f', '23/189', 'six CI lanes never metered'],
  20: [null, null, 'both build passes ride it — untested'],
  21: [null, null, 'config only'],
  22: [null, null, 'wrapper only'],
  23: [null, null, 'harness for every vitest suite — borrowed light'],
  24: [null, null, 'wrapper only'],
  25: ['1/2f', '6/23', 'rebase.ts lit · CLI wrapper in the sun'],
  26: ['0/1f', '0/8', 'canary lights happy-dom, not append.ts'],
  27: [null, null, 'ambient types — nothing to shade'],
};
const ART_H = 866;
const SY = ART_H + 16;
const pctS = (v) => (v == null ? '—' : `${v}%`);
const schedRow = ([n, name, , cat, , , , , ext, line, br, fn]) => {
  const [ef, es, note] = EXTRA[n];
  const meat = cat === 'm'
    ? `${ef} · ${es} (${pctS(ext)}) · L ${pctS(line)} B ${pctS(br)} F ${pctS(fn)}`
    : CAT_TEXT[cat];
  return `${String(n).padStart(2, ' ')}  ${name} — ${meat} · ${note}`;
};
const half = Math.ceil(M.length / 2);
const schedule = `<rect x="40" y="${SY}" width="1480" height="${91 + half * 17}" class="sk fp"/>
${txt(58, SY + 22, 'SHADOW SCHEDULE — per member: files and sloc the suite loaded / authored · L line · B branch · F function coverage of the loaded files', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1520" y2="${SY + 32}" class="skf"/>
${M.slice(0, half).map((r, i) => txt(58, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${M.slice(half).map((r, i) => txt(800, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${txt(58, SY + 56 + half * 17, 'TOTAL — 13 members metered: 5,427 of 5,539 metered lines lit (98.0%) · branches 1,283/1,351 (95.0%) · functions 419/437 (95.9%) · extent 4,698/6,954 sloc (67.6%) · metered 2026-08-17', 'lbls')}
${txt(58, SY + 72 + half * 17, '† source moved between the census (2026-08-16, sheet 7) and the metering (worktree HEAD 3557c29): №1 1,189→1,325 sloc, №15 5f/427→7f/756 — footprints stay on the census, extents follow the meter', 'lblf')}`;

const svg = `<svg viewBox="0 0 1560 ${SY + 121 + half * 17}" role="img" aria-label="A plan view of sheet 7's census city — the same twenty-seven workspace members in the same four dashed districts, seen from straight above — with a test shadow cast south-west of every building whose own suite was run under a coverage meter. Shadow reach is how much of the member's source the suite actually loaded; shadow darkness is the line coverage of what it loaded. The packages district is almost entirely in near-black shadow: all four published packages meter between 98 and 100 percent line coverage over 97 to 100 percent of their source. In the instrument yard the shadows are dark but short: release, build_and_test, workers-builds and lcov-rebase all shade their .core.ts files near-black and leave their command-line wrapper files — one thousand three hundred seventy-five lines in all — standing in full sun. Nine members cast no shadow at all, marked with red badges: examples, the typedoc plugin, and seven other instruments. The two sample-app demos and the Cypress host are hatched in accent blue — lit only by the end-to-end rig, which no meter reads. One building, tools/happy-dom, has a suite and still casts nothing: its canary spec tests happy-dom itself, never its own eight lines. A shadow schedule below gives exact per-member figures.">
${defs(P)}
<defs>
  <pattern id="${P}-s1" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="2.6" height="2.6" fill="var(--ink)" opacity="0.34"/>
    <line x1="0" y1="0" x2="0" y2="2.6" stroke="var(--ink)" stroke-width="1.2"/>
  </pattern>
  <pattern id="${P}-s2" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="4" stroke="var(--ink)" stroke-width="1.1"/>
  </pattern>
  <pattern id="${P}-s3" width="5.5" height="5.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="5.5" height="5.5" fill="var(--red)" opacity="0.10"/>
    <line x1="0" y1="0" x2="0" y2="5.5" stroke="var(--red)" stroke-width="1.1"/>
  </pattern>
  <pattern id="${P}-s4" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="8" stroke="var(--red)" stroke-width="1"/>
  </pattern>
  <pattern id="${P}-se" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" stroke-width="1" opacity="0.55"/>
  </pattern>
</defs>

<rect x="40" y="26" width="560" height="42" class="skf fnone"/>
${txt(52, 43, 'THE SHADOW SURVEY — WHO STANDS IN TEST SHADOW, AND HOW DARK', 'lbls')}
${txt(52, 58, 'sheet 7’s city from straight above · sun from the NE · every shadow metered from the member’s own suite', 'lblf')}

${txt(1520, 34, 'SHADOW RULE — reach = 0.55 · side · (sloc the suite loaded ÷ src sloc) · darkness = line coverage of what it loaded', 'lbls', 'end')}
${txt(1520, 48, 'footprints and annexes are sheet 7’s census, unchanged · a file the suite never imports casts nothing — absence is data', 'lblf', 'end')}
${txt(1520, 62, 'e2e light (cypress) is drawn, not metered — no lcov leaves the rig · unmetered shadows at nominal full reach', 'lblf', 'end')}

<!-- darkness ladder -->
<rect x="1128" y="96" width="392" height="196" class="skf fnone"/>
${txt(1144, 118, 'DARKNESS — LINE COVERAGE OF WHAT THE SUITE LOADED', 'lbls')}
${[
  [`url(#${P}-s1)`, 'sk', '', '≥ 95% — near-black · №1 2 3 4 8 10 12 15 17 19 25'],
  [`url(#${P}-s2)`, 'sk', '', '85–95% — dark (none this survey)'],
  [`url(#${P}-s3)`, 'skr', '', '70–85% — pale · №16 only'],
  [`url(#${P}-s4)`, 'skr', '', 'below 70% — palest (none this survey)'],
  [`url(#${P}-se)`, 'ska', '5 4', 'e2e light only — cypress, unmetered · №6 7 9'],
  ['none', 'sks', '2 4', 'tests run, meter cannot attach · №5'],
].map(([fill, edge, dash, label], i) => {
  const y = 142 + i * 24;
  return `<rect x="1144" y="${y}" width="34" height="14" fill="${fill}"/><rect x="1144" y="${y}" width="34" height="14" class="${edge} fnone" ${dash ? `stroke-dasharray="${dash}"` : ''}/>
${txt(1192, y + 11, label, edge === 'skr' ? 'lblr' : edge === 'ska' ? 'lbla' : 'lbls')}`;
}).join('\n')}

${districts}
${shadows}
${prints}

<!-- district lettering + aggregates -->
${txt(140, 348, 'packages/ — THE PRODUCT', 'lblb')}
${txt(140, 360, '96.9% of district sloc in shadow · 99.3% of 2,397 metered lines lit', 'lblf')}
${txt(140, 372, 'branches 94.7% · near-black wall to wall', 'lblf')}
<line x1="150" y1="339" x2="160" y2="330" class="skf"/>

${txt(1096, 336, 'apps/ — THE PROVING GROUND', 'lblb', 'end')}
${txt(1096, 349, 'one metered member (№8, 100%) · two demos + the rig', 'lblf', 'end')}
${txt(1096, 361, 'live on e2e light alone · №5 tests pass with no meter', 'lblf', 'end')}

${txt(1146, 560, 'docs/ + examples/ — THE SHOPFRONT', 'lblb')}
${txt(1146, 573, 'the worker: 100% metered — a 53-sloc sliver of 677', 'lblf')}
${txt(1146, 585, 'examples: 1,117 sloc, never a shadow', 'lblf')}
<line x1="1140" y1="569" x2="1064" y2="560" class="skf"/>

${txt(96, 852, 'tools/ — THE INSTRUMENT YARD', 'lblb')}
${txt(96, 865, 'seven metered members: 96.7% of 2,906 lines lit — but only 56% of yard sloc is ever loaded', 'lblf')}
${txt(96, 877, 'the habit, visible from the air: every .core.ts in shadow, every CLI wrapper in the sun', 'lblf')}
<line x1="140" y1="843" x2="152" y2="828" class="skf"/>

<!-- callouts -->
${txt(620, 88, '№1 lit-ui-router — 94% reach, 98.1% dark', 'lbla')}
${txt(620, 100, 'unlit: index · pure · register · interface.ts —', 'lblf')}
${txt(620, 112, '69 of its 80 sunlit sloc are type declarations', 'lblf')}
<line x1="612" y1="119" x2="305" y2="136" class="skf"/>

${txt(1144, 312, '№5 sample-app-shared — the outline shadow:', 'lbls')}
${txt(1144, 325, '43 unit tests pass, but browser-mode vitest cannot', 'lblf')}
${txt(1144, 337, 'load a meter the repo never installed', 'lblf')}
<line x1="1138" y1="320" x2="1032" y2="270" class="skf"/>

${txt(30, 430, '№26 happy-dom — a suite, and NO shadow:', 'lblr')}
${txt(30, 442, 'its canary spec tests happy-dom’s ordering', 'lblf')}
${txt(30, 454, 'bug, never its own append.ts — 0 of 8 sloc;', 'lblf')}
${txt(30, 466, 'those 8 lines are lit inside №1’s annex', 'lblf')}
<line x1="250" y1="474" x2="272" y2="522" class="skf"/>

${txt(863, 724, '№12 @tools/release — the yard in one building:', 'lblr')}
${txt(863, 737, '23 .core.ts files at 98.4% dark; 21 CLI wrappers, 858 sloc,', 'lblf')}
${txt(863, 749, 'in full sun — the publish halt is tested at its core', 'lblf')}
${txt(863, 761, 'and bare at its process edge', 'lblf')}
<line x1="857" y1="742" x2="240" y2="700" class="skf"/>

${txt(700, 852, '№16 @tools/shared — the palest shadow drawn: 83.1% line, 62.5% function', 'lblr')}
${txt(700, 865, 'exec.ts 35/55 lines · workspace.ts 63/103 — the worst-lit thing that is lit at all', 'lblf')}
<line x1="694" y1="850" x2="166" y2="772" class="skf"/>

<!-- verdict -->
<rect x="1128" y="382" width="392" height="118" class="sk fp"/>
${txt(1144, 404, 'VERDICT', 'lblb')}
${txt(1144, 424, 'Where a shadow falls, it is near-black:', 'lbls')}
${txt(1144, 438, '98.0% of 5,539 metered lines lit, and the', 'lbls')}
${txt(1144, 452, 'product district is dark wall to wall.', 'lbls')}
${txt(1144, 466, 'The sun never touches the packages; it sits', 'lbls')}
${txt(1144, 480, 'on 2,608 sloc of instruments and 1,375 of wrappers.', 'lbls')}

${schedule}
</svg>`;

export const sheet7a = {
  num: '7A', id: 'shadow', rev: 'A',
  title: 'THE SHADOW SURVEY',
  sub: 'ALTITUDE 3½ — ALTERNATE PLATE TO SHEET 7: the measured city under its own test light · same 27 members, same footprints · shadows metered 2026-08-17 at worktree HEAD 3557c29',
  scale: 'WHOLE WORKSPACE',
  form: 'SHADOW PLAN',
  svg,
  caption: 'Sheet 7 counted who lives in the city; this plate asks which of them ever stand in test shadow. Every member’s own suite was run under a coverage meter, and its shadow drawn to two rules: reach is how much of the member’s source the suite actually loaded, darkness is the line coverage of what it loaded. The finding is a repo-wide habit visible from the air — shadows are short more often than they are pale. Where a suite reaches, it is near-black; what it never imports simply stands in the sun.',
  notes: `
<p><strong>Method — one meter per member, nothing installed, nothing left behind.</strong> Footprints, annexes and districts are sheet 7 rev B's census, unchanged, so the two plates overlay. Shadows were metered on 2026-08-17 at worktree HEAD <code>3557c29</code>: the four packages by the repo's own <code>turbo run test:coverage</code> tasks (vitest v8 for three, <code>node --test --experimental-test-coverage</code> + <code>rebase-lcov</code> for <code>ui-router-server</code>); the eight <code>node:test</code> members by the same node flags passed on the command line; <code>@tools/happy-dom</code> by <code>vitest run --coverage.enabled --coverage.provider=v8</code>. No repo file was edited. Each meter reports lines on its own basis (v8 remaps to executable lines; node counts raw lines), so darkness percentages are per-meter and never summed across meters in the drawing — only the schedule's grand total does, and says so. Extent uses the atlas sloc rule over the code the meter actually saw; two members' source moved between the census and the metering and are daggered in the schedule.</p>
<p><strong>The product is dark wall to wall — the budget lands where the house says.</strong> All four published packages meter 98.1–100% line, 91.7–100% branch, over 94–100% of their source. What little stands in the sun is entry barrels and <code>interface.ts</code> — 69 of <code>lit-ui-router</code>'s 80 unlit sloc are type declarations, which no runtime meter can light. This is the priority made visible: library coverage outranks docs coverage, and the annexes sheet 7 drew at 1.9–3.9× their buildings turn out to buy near-total shadow.</p>
<p><strong>The yard's habit: cores in shadow, wrappers in the sun.</strong> Four instruments repeat one pattern — <code>@tools/release</code> (23 <code>.core.ts</code> files at 98.4%, 21 CLI wrappers unlit), <code>build_and_test</code> (3 wrappers unlit), <code>workers-builds</code> (the 156-sloc trigger wrapper), <code>lcov-rebase</code> (the 17-sloc bin). 1,375 sloc of process-edge code is never loaded by any suite, while the logic behind it meters 96.7%. <code>compat-guards</code> is the pattern at its extreme: only <code>ranges.ts</code> is unit-lit; its six guard lanes run for real in CI, where no meter follows. And <code>@tools/happy-dom</code> is the survey's one genuine surprise, re-verified before inking: it has a suite and casts no shadow at all, because its spec is a conformance canary pointed at happy-dom upstream — its own <code>append.ts</code> is lit only inside <code>lit-ui-router</code>'s annex, as borrowed light.</p>
<p><strong>What the meter cannot say, the plate refuses to fake.</strong> The two demo apps and the Cypress host are hatched in accent, not banded: e2e light is real — the rig drives the built docs site — but no lcov leaves it, so their shadows are drawn at nominal reach and labelled unmetered. <code>sample-app-shared</code> runs 43 unit tests green, yet browser-mode vitest cannot fetch a coverage provider the repo never installed (<code>@vitest/coverage-v8</code> is no devDependency of it); its shadow is an outline. Nine members — <code>examples</code>, the typedoc plugin, and seven instruments — cast nothing because nothing tests them; two of those (<code>dts-backtest</code>, <code>lit-test-env</code>) spend their working lives inside other members' suites and are red-badged with that caveat in the schedule.</p>`,
  key: [
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp"/>', 'a member’s footprint — sheet 7’s census, plan view'),
    keyRow('<rect x="14" y="3" width="18" height="12" class="sks fnone" stroke-dasharray="3 3"/>', 'its spec annex, ghosted — the thing that throws the shadow'),
    keyRow('<rect x="6" y="3" width="36" height="12" fill="url(#s7a-s1)"/>', 'shadow ≥95% line — near-black'),
    keyRow('<rect x="6" y="3" width="36" height="12" fill="url(#s7a-s3)"/><rect x="6" y="3" width="36" height="12" class="skr fnone"/>', 'shadow 70–85% — pale, red hatch'),
    keyRow('<rect x="6" y="3" width="36" height="12" fill="url(#s7a-se)"/><rect x="6" y="3" width="36" height="12" class="ska fnone" stroke-dasharray="5 4"/>', 'e2e light only — cypress, no meter reads it'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="sks fnone" stroke-dasharray="2 4"/>', 'tests run, meter cannot attach'),
    keyRow('<circle cx="24" cy="9" r="7" class="skr fp"/><text x="24" y="12" class="lblr" text-anchor="middle" font-size="9">n</text>', 'no shadow, red badge — no suite at all'),
    keyRow('<rect x="6" y="3" width="20" height="12" class="sk fp"/><polygon points="6,3 2,7 2,19 22,19 26,15 6,15" fill="url(#s7a-s1)"/>', 'reach = share of source the suite loads · sun from NE'),
  ].join('\n'),
};

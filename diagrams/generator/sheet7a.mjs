import { defs } from './chrome.mjs';
import { txt, keyRow } from './helpers.mjs';

const P = 's7a';

// ---- the survey: sheet 7's city, metered for test light on 2026-08-17 -----------
// REV B: polarity corrected — rev A drew coverage as cast shadow, so the best-
// tested district read gloomiest.  Same data, metaphor flipped the right way up:
// the spec annex is the LAMP, covered source is LIT, shadow means UNTESTED.
// Footprints are sheet 7 rev B's census (main checkout, counted 2026-08-16), so
// this plate reconciles building-for-building with the measured city.  Light was
// metered at worktree HEAD 3557c29 by running each member's OWN suite under a
// coverage meter (generator: tmp/atlas-shadow/census-shadow.mjs):
//   packages/*        — the repo's own `turbo run test:coverage` tasks, unmodified
//   node:test members — node --test --experimental-test-coverage (CLI flags only)
//   tools/happy-dom   — vitest run --coverage.enabled --coverage.provider=v8
// Two members' source moved between the census and the metering (marked † in the
// schedule): lit-ui-router 1,189→1,325 sloc (same 12 files), build_and_test
// 5f/427→7f/756 (error-summary landed).  Footprints stay on the census; lit
// extents are computed against the code the meter actually saw.

// ---- scale rule — sheet 7's, unchanged ------------------------------------------
const KS = 1.6, MIN = 12;
const S = (sloc) => Math.max(MIN, KS * Math.sqrt(sloc));
const AG = 10;

// ---- plan → screen (plan view: the same city seen from straight above) ----------
const K = 1.15, MX = 132, MY = 128;
const X = (x) => (MX + K * x).toFixed(1);
const Y = (y) => (MY + K * y).toFixed(1);

// ---- brightness bands: how bright the lit part is = line coverage of what the
// suite loaded.  Hue + hatch together: full bright is open halo, paler light
// gains hatch — accent first, red where the light itself is failing.
const BAND = (line) => (line == null ? null : line >= 95 ? 'b1' : line >= 85 ? 'b2' : line >= 70 ? 'b3' : 'b4');
const BANDS = {
  b1: { fill: 'var(--halo)' },      // ≥95% — full bright, open glow
  b2: { fill: `url(#${P}-g2)` },    // 85–95% — bright, faint accent hatch
  b3: { fill: `url(#${P}-g3)` },    // 70–85% — pale, red hatch
  b4: { fill: `url(#${P}-g4)` },    // <70% — guttering, dense red
};
const CAT_BADGE = {
  m: { badge: 'sk fp', num: 'lbl' },    // metered
  e: { badge: 'ska fp', num: 'lbla' },  // e2e light only
  u: { badge: 'sks fp', num: 'lbls' },  // tests run, meter cannot attach
  n: { badge: 'skr fp', num: 'lblr' },  // untested — full shadow
  z: { badge: 'sks fp2', num: 'lbls' }, // no mass
};

// [n, name, dist, cat, x, y, srcSloc(census), specSloc(census), extent%, line%, branch%, func%]
// extent = sloc of files the suite loaded (now: LIT) / member src sloc, both at worktree HEAD.
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
  return [n, { n, name, dist, cat, x, y, s, sa, ax, ay, ext, r }];
}));
const g = (n) => geom.get(n);

// The lamp sits east (the annex side); its light reaches a strip of the building
// from the east face inward.  Lit width = side · (sloc the suite loads ÷ src sloc);
// the remainder of the footprint stays in shadow.
function member(n) {
  const b = g(n);
  const { cat, x, y, s, sa, ax, ay } = b;
  const line = b.r[9];
  const R = (px, py, w, h, attrs) => `<rect x="${X(px)}" y="${Y(py)}" width="${(K * w).toFixed(1)}" height="${(K * h).toFixed(1)}" ${attrs}/>`;
  const cone = sa && cat !== 'n'
    ? `<polygon points="${X(ax)},${Y(ay)} ${X(x + s)},${Y(y)} ${X(x + s)},${Y(y + s)} ${X(ax)},${Y(ay + sa)}" class="fhalo"/>`
    : '';
  if (cat === 'z') return R(x, y, s, s, 'class="sks fnone" stroke-dasharray="2 3"');
  if (cat === 'n') {
    // no lamp anywhere — the whole building stands in shadow
    return `${R(x, y, s, s, 'class="sk fp"')}${R(x, y, s, s, `fill="url(#${P}-sh)"`)}${R(x, y, s, s, 'class="sk fnone"')}`;
  }
  if (cat === 'e') {
    // real light from the cypress rig, but no meter reads it — accent wash
    return `${cone}${R(x, y, s, s, 'class="sk fp"')}${R(x, y, s, s, `fill="url(#${P}-se)"`)}
${R(x, y, s, s, 'class="ska fnone" stroke-dasharray="5 4"')}`;
  }
  if (cat === 'u') {
    // tests run but no meter attaches — an outline of light, nothing painted
    const rays = sa
      ? `<line x1="${X(ax)}" y1="${Y(ay)}" x2="${X(x + s)}" y2="${Y(y)}" class="sks" stroke-dasharray="2 4"/>
<line x1="${X(ax)}" y1="${Y(ay + sa)}" x2="${X(x + s)}" y2="${Y(y + s)}" class="sks" stroke-dasharray="2 4"/>` : '';
    return `${rays}${R(x, y, s, s, 'class="sk fp"')}`;
  }
  // metered: lit strip from the lamp side, shadow strip beyond the light's reach
  const e = (b.ext ?? 0) / 100;
  const litW = s * e, shW = s - litW;
  // happy-dom's lamp is lit but pointed elsewhere — no cone, all shadow
  const lamp = b.ext === 0 ? '' : cone;
  const lit = litW > 0 ? R(x + shW, y, litW, s, `fill="${BANDS[BAND(line) ?? 'b1'].fill}"`) : '';
  const sh = shW > 0.01 ? R(x, y, shW, s, `fill="url(#${P}-sh)"`) : '';
  const term = litW > 0 && shW > 0.01
    ? `<line x1="${X(x + shW)}" y1="${Y(y)}" x2="${X(x + shW)}" y2="${Y(y + s)}" class="skf"/>` : '';
  return `${lamp}${R(x, y, s, s, 'class="sk fp"')}${lit}${sh}${term}${R(x, y, s, s, 'class="sk fnone"')}`;
}

function furniture(n) {
  const b = g(n);
  const t = CAT_BADGE[b.cat];
  // the annex is the lamp — drawn glowing, not ghosted
  const annex = b.sa
    ? `<rect x="${X(b.ax)}" y="${Y(b.ay)}" width="${(K * b.sa).toFixed(1)}" height="${(K * b.sa).toFixed(1)}" class="sks fhalo"/>`
    : '';
  const lift = BADGE_LIFT[n] ?? 0, dx = BADGE_DX[n] ?? 0;
  const bx = +X(b.x + b.s / 2 + dx), by = +Y(b.y) - 11 - lift;
  return `${annex}
<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="8.5" class="${t.badge}"/>
${txt(bx.toFixed(1), (by + 3.2).toFixed(1), String(n), t.num, 'middle')}`;
}
const BADGE_LIFT = {};
const BADGE_DX = {};

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

const bodies = M.map(([n]) => member(n)).join('\n');
const furn = M.map(([n]) => furniture(n)).join('\n');

// ---- schedule --------------------------------------------------------------------
const CAT_TEXT = {
  m: 'metered', e: 'e2e light only', u: 'tests run, no meter', n: 'FULL SHADOW — no suite', z: 'no mass',
};
// [litFiles, litSloc: 'lit/total' at worktree HEAD, note]
const EXTRA = {
  1:  ['8/12f', '1,245/1,325†', 'in shadow: barrels + interface.ts (type decls)'],
  2:  ['8/8f', '1,141/1,141', 'whole footprint fully lit'],
  3:  ['3/4f', '130/133', 'in shadow: the 3-sloc index barrel'],
  4:  ['1/1f', '105/105', 'all three meters read 100'],
  5:  [null, null, '43 tests pass · no coverage provider in browser mode · e2e-lit'],
  6:  [null, null, 'lit only by the cypress rig'],
  7:  [null, null, 'lit only by the cypress rig'],
  8:  ['2/2f', '51/51', 'route table fully lit (no functions to meter)'],
  9:  [null, null, 'the rig itself — its 57 sloc are the support code'],
  10: ['1/8f', '53/677', 'worker lit · the site (624 sloc) sees only e2e light'],
  11: [null, null, 'stackblitz copies — never lit'],
  12: ['23/44f', '1,013/1,871', '21 CLI wrappers (858 sloc) in shadow'],
  13: [null, null, 'builds the API pages, tests nothing'],
  14: [null, null, 'no self-suite — it IS the packages’ d.ts test'],
  15: ['4/7f', '464/756†', '3 CLI wrappers in shadow'],
  16: ['7/9f', '248/300', 'palest: exec 35/55 · workspace 63/103'],
  17: ['1/2f', '219/375', 'trigger wrapper in shadow'],
  18: [null, null, 'size probe, advisory, unlit'],
  19: ['1/7f', '23/189', 'six CI lanes never metered'],
  20: [null, null, 'both build passes ride it — unlit'],
  21: [null, null, 'config only'],
  22: [null, null, 'wrapper only'],
  23: [null, null, 'harness for every vitest suite — borrowed light'],
  24: [null, null, 'wrapper only'],
  25: ['1/2f', '6/23', 'rebase.ts lit · CLI wrapper in shadow'],
  26: ['0/1f', '0/8', 'canary lights happy-dom, not append.ts'],
  27: [null, null, 'ambient types — nothing to light'],
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
${txt(58, SY + 22, 'SHADOW SCHEDULE — per member: files and sloc the suite lights / authored · L line · B branch · F function coverage of the lit files', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1520" y2="${SY + 32}" class="skf"/>
${M.slice(0, half).map((r, i) => txt(58, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${M.slice(half).map((r, i) => txt(800, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${txt(58, SY + 56 + half * 17, 'TOTAL — 13 members metered: 5,427 of 5,539 metered lines lit (98.0%) · branches 1,283/1,351 (95.0%) · functions 419/437 (95.9%) · lit extent 4,698/6,954 sloc (67.6%) · metered 2026-08-17', 'lbls')}
${txt(58, SY + 72 + half * 17, '† source moved between the census (2026-08-16, sheet 7) and the metering (worktree HEAD 3557c29): №1 1,189→1,325 sloc, №15 5f/427→7f/756 — footprints stay on the census, lit extents follow the meter', 'lblf')}`;

const svg = `<svg viewBox="0 0 1560 ${SY + 121 + half * 17}" role="img" aria-label="A plan view of sheet 7's census city — the same twenty-seven workspace members in the same four dashed districts, seen from straight above — where each member's spec annex is drawn as a lamp and the light of its own test suite falls onto the building. The lit strip of every footprint is the share of the member's source its suite actually loads, glowing from the lamp side; how bright that strip reads is the line coverage of what the suite loaded; everything the suite never imports stays in dense shadow hatch. The packages district glows wall to wall: all four published packages meter between 98 and 100 percent line coverage over 97 to 100 percent of their source. In the instrument yard the light is bright but narrow: release, build_and_test, workers-builds and lcov-rebase light their .core.ts files fully and leave their command-line wrapper files — one thousand three hundred seventy-five lines in all — in shadow. Nine members are entirely dark, marked with red badges: examples, the typedoc plugin, and seven other instruments have no suite at all. The two sample-app demos and the Cypress host carry an accent hatch — real light from the end-to-end rig, which no meter reads. One building, tools/happy-dom, has a lit lamp and still stands dark: its canary spec lights happy-dom itself, never its own eight lines. A shadow schedule below gives exact per-member figures.">
${defs(P)}
<defs>
  <!-- shadow must darken in BOTH themes: a black wash (never ink, which is light
       in cyanotype) carrying a faint ink hatch for texture -->
  <pattern id="${P}-sh" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="4" height="4" fill="rgba(0,0,0,0.38)"/>
    <line x1="0" y1="0" x2="0" y2="4" stroke="var(--ink)" stroke-width="1" opacity="0.30"/>
  </pattern>
  <pattern id="${P}-g2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="5" height="5" fill="var(--halo)"/>
    <line x1="0" y1="0" x2="0" y2="5" stroke="var(--accent)" stroke-width="1" opacity="0.45"/>
  </pattern>
  <pattern id="${P}-g3" width="5.5" height="5.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="5.5" height="5.5" fill="var(--halo)"/>
    <line x1="0" y1="0" x2="0" y2="5.5" stroke="var(--red)" stroke-width="1.1" opacity="0.7"/>
  </pattern>
  <pattern id="${P}-g4" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="3.5" stroke="var(--red)" stroke-width="1"/>
  </pattern>
  <pattern id="${P}-se" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" stroke-width="1" opacity="0.55"/>
  </pattern>
</defs>

<rect x="40" y="26" width="628" height="42" class="skf fnone"/>
${txt(52, 43, 'THE SHADOW SURVEY — WHO STANDS IN TEST LIGHT, AND WHAT STAYS DARK', 'lbls')}
${txt(52, 58, 'sheet 7’s city from straight above · every lamp is a spec annex · REV B: the light falls FROM the tests', 'lblf')}

${txt(1520, 34, 'LIGHT RULE — lit strip = side · (sloc the suite loads ÷ src sloc), from the lamp side · brightness = line coverage of what it loads', 'lbls', 'end')}
${txt(1520, 48, 'footprints and annexes are sheet 7’s census, unchanged · a file the suite never imports stays in shadow — darkness is data', 'lblf', 'end')}
${txt(1520, 62, 'e2e light (cypress) is drawn, not metered — no lcov leaves the rig · REV B flips rev A’s polarity: tests are the light', 'lblf', 'end')}

<!-- brightness ladder -->
<rect x="1128" y="96" width="392" height="214" class="skf fnone"/>
${txt(1144, 118, 'BRIGHTNESS — LINE COVERAGE OF WHAT THE SUITE LIGHTS', 'lbls')}
${[
  ['var(--halo)', 'sk', '', '≥ 95% — full bright · №1 2 3 4 8 10 12 15 17 19 25'],
  [`url(#${P}-g2)`, 'sk', '', '85–95% — bright (none this survey)'],
  [`url(#${P}-g3)`, 'skr', '', '70–85% — pale · №16 only'],
  [`url(#${P}-g4)`, 'skr', '', 'below 70% — guttering (none this survey)'],
  [`url(#${P}-se)`, 'ska', '5 4', 'e2e light — real, unmetered · №6 7 9'],
  ['none', 'sks', '2 4', 'tests run, no meter attaches · №5'],
  [`url(#${P}-sh)`, 'sk', '', 'SHADOW — source no suite ever loads'],
].map(([fill, edge, dash, label], i) => {
  const y = 138 + i * 22;
  return `<rect x="1144" y="${y}" width="34" height="14" fill="${fill}"/><rect x="1144" y="${y}" width="34" height="14" class="${edge} fnone" ${dash ? `stroke-dasharray="${dash}"` : ''}/>
${txt(1192, y + 11, label, edge === 'skr' ? 'lblr' : edge === 'ska' ? 'lbla' : 'lbls')}`;
}).join('\n')}

${districts}
${bodies}
${furn}

<!-- district lettering + aggregates -->
${txt(140, 348, 'packages/ — THE PRODUCT', 'lblb')}
${txt(140, 360, 'lit wall to wall — 96.9% of district sloc · 99.3% of 2,397 metered lines', 'lblf')}
${txt(140, 372, 'branches 94.7% · the annexes sheet 7 drew at 1.9–3.9× bought this glow', 'lblf')}
<line x1="150" y1="336" x2="160" y2="326" class="skf"/>

${txt(1096, 372, 'apps/ — THE PROVING GROUND', 'lblb', 'end')}
${txt(1096, 385, 'one metered member (№8, fully lit) · two demos + the rig', 'lblf', 'end')}
${txt(1096, 397, 'live on e2e light alone · №5 tests pass with no meter', 'lblf', 'end')}

${txt(1146, 560, 'docs/ + examples/ — THE SHOPFRONT', 'lblb')}
${txt(1146, 573, 'the worker: fully lit — a 53-sloc sliver of 677', 'lblf')}
${txt(1146, 585, 'examples: 1,117 sloc, never lit', 'lblf')}
<line x1="1140" y1="569" x2="1064" y2="560" class="skf"/>

${txt(96, 852, 'tools/ — THE INSTRUMENT YARD', 'lblb')}
${txt(96, 865, 'seven metered members: 96.7% of 2,906 lines lit — but the light reaches only 56% of yard sloc', 'lblf')}
${txt(96, 877, 'the habit, visible from the air: every .core.ts lit, every CLI wrapper left in shadow', 'lblf')}
<line x1="140" y1="840" x2="152" y2="826" class="skf"/>

<!-- callouts -->
${txt(620, 82, '№1 lit-ui-router — 94% of the footprint lit, 98.1% bright', 'lbla')}
${txt(620, 94, 'in shadow: index · pure · register · interface.ts —', 'lblf')}
${txt(620, 106, '69 of those 80 sloc are type declarations', 'lblf')}
<line x1="612" y1="110" x2="305" y2="136" class="skf"/>

${txt(1144, 322, '№5 sample-app-shared — an outline of light:', 'lbls')}
${txt(1144, 335, '43 unit tests pass, but browser-mode vitest cannot', 'lblf')}
${txt(1144, 347, 'load a meter the repo never installed', 'lblf')}
<line x1="1138" y1="330" x2="1032" y2="270" class="skf"/>

${txt(30, 430, '№26 happy-dom — a lamp, and NO light on itself:', 'lblr')}
${txt(30, 442, 'its canary spec lights happy-dom’s ordering', 'lblf')}
${txt(30, 454, 'bug, never its own append.ts — 0 of 8 sloc;', 'lblf')}
${txt(30, 466, 'those 8 lines are lit from №1’s lamp instead', 'lblf')}
<line x1="250" y1="474" x2="272" y2="522" class="skf"/>

${txt(863, 724, '№12 @tools/release — the yard in one building:', 'lblr')}
${txt(863, 737, '23 .core.ts files at 98.4% bright; 21 CLI wrappers, 858 sloc,', 'lblf')}
${txt(863, 749, 'in shadow — the publish halt is lit at its core', 'lblf')}
${txt(863, 761, 'and dark at its process edge', 'lblf')}
<line x1="857" y1="742" x2="240" y2="700" class="skf"/>

${txt(700, 852, '№16 @tools/shared — the palest light thrown: 83.1% line, 62.5% function', 'lblr')}
${txt(700, 865, 'exec.ts 35/55 lines · workspace.ts 63/103 — the worst-lit thing that is lit at all', 'lblf')}
<line x1="694" y1="850" x2="166" y2="772" class="skf"/>

<!-- verdict -->
<rect x="1128" y="382" width="392" height="118" class="sk fp"/>
${txt(1144, 404, 'VERDICT', 'lblb')}
${txt(1144, 424, 'The light reaches wall to wall in packages/:', 'lbls')}
${txt(1144, 438, '98.0% of 5,539 metered lines lit, and the', 'lbls')}
${txt(1144, 452, 'product district has no dark corner.', 'lbls')}
${txt(1144, 466, 'What never sees light: 2,608 sloc of untested', 'lbls')}
${txt(1144, 480, 'instruments and 1,375 sloc of CLI wrappers.', 'lbls')}

${schedule}
</svg>`;

export const sheet7a = {
  num: '7A', id: 'shadow', rev: 'C',
  title: 'THE SHADOW SURVEY',
  sub: 'ALTITUDE 3½ — ALTERNATE PLATE TO SHEET 7: the measured city under its own test light · same 27 members, same footprints · metered 2026-08-17 at worktree HEAD 3557c29 · REV B: polarity corrected — the tests are the light, shadow is the untested · REV C 2026-08-31: lettering pass — no district boundary is drawn through a caption',
  scale: 'WHOLE WORKSPACE',
  form: 'SHADOW PLAN',
  svg,
  caption: 'Sheet 7 counted who lives in the city; this plate asks which of them ever stand in test light. Every member’s own suite was run under a coverage meter, and its light drawn to two rules: reach is how much of the member’s source the suite actually loads, brightness is the line coverage of what it loads. What the suite never imports stays in shadow — and the finding is a repo-wide habit visible from the air: the light is bright far more often than it is wide. Where a suite reaches, it burns near-full; what it never touches is simply dark.',
  notes: `
<p><strong>REV B — the polarity is corrected, not the data.</strong> This plate's first printing drew coverage as cast shadow, so the best-tested district read gloomiest — the metaphor upside down, as the client noted: the tests are the light, and shadow should mean what shadow means. Every number below is rev A's, unchanged; only the optics flipped. The spec annex is now the lamp, covered source glows, and the nine members with no suite at all are finally the dark buildings they always were.</p>
<p><strong>Method — one meter per member, nothing installed, nothing left behind.</strong> Footprints, annexes and districts are sheet 7 rev B's census, unchanged, so the two plates overlay. Light was metered on 2026-08-17 at worktree HEAD <code>3557c29</code>: the four packages by the repo's own <code>turbo run test:coverage</code> tasks (vitest v8 for three, <code>node --test --experimental-test-coverage</code> + <code>rebase-lcov</code> for <code>ui-router-server</code>); the eight <code>node:test</code> members by the same node flags passed on the command line; <code>@tools/happy-dom</code> by <code>vitest run --coverage.enabled --coverage.provider=v8</code>. No repo file was edited. Each meter reports lines on its own basis (v8 remaps to executable lines; node counts raw lines), so brightness percentages are per-meter and never summed across meters in the drawing — only the schedule's grand total does, and says so. Lit extent uses the atlas sloc rule over the code the meter actually saw; two members' source moved between the census and the metering and are daggered in the schedule.</p>
<p><strong>The product glows wall to wall — the budget lands where the house says.</strong> All four published packages meter 98.1–100% line, 91.7–100% branch, over 94–100% of their source. What little stays dark is entry barrels and <code>interface.ts</code> — 69 of <code>lit-ui-router</code>'s 80 shadowed sloc are type declarations, which no runtime meter can light. This is the priority made visible: library coverage outranks docs coverage, and the annexes sheet 7 drew at 1.9–3.9× their buildings turn out to buy near-total light.</p>
<p><strong>The yard's habit: bright cores, dark wrappers.</strong> Four instruments repeat one pattern — <code>@tools/release</code> (23 <code>.core.ts</code> files at 98.4%, 21 CLI wrappers dark), <code>build_and_test</code> (3 wrappers dark), <code>workers-builds</code> (the 156-sloc trigger wrapper), <code>lcov-rebase</code> (the 17-sloc bin). 1,375 sloc of process-edge code is never loaded by any suite, while the logic behind it meters 96.7%. <code>compat-guards</code> is the pattern at its extreme: only <code>ranges.ts</code> is unit-lit; its six guard lanes run for real in CI, where no meter follows. And <code>@tools/happy-dom</code> is the survey's one genuine surprise, re-verified before inking: it owns a lit lamp and still stands dark, because its spec is a conformance canary pointed at happy-dom upstream — its own <code>append.ts</code> is lit only from <code>lit-ui-router</code>'s lamp, as borrowed light.</p>
<p><strong>What the meter cannot say, the plate refuses to fake.</strong> The two demo apps and the Cypress host are hatched in accent, not banded: e2e light is real — the rig drives the built docs site — but no lcov leaves it, so it is drawn as light of unknowable brightness and labelled unmetered. <code>sample-app-shared</code> runs 43 unit tests green, yet browser-mode vitest cannot fetch a coverage provider the repo never installed (<code>@vitest/coverage-v8</code> is no devDependency of it); its light is an outline. Nine members — <code>examples</code>, the typedoc plugin, and seven instruments — are dark because nothing tests them; two of those (<code>dts-backtest</code>, <code>lit-test-env</code>) spend their working lives inside other members' suites and are red-badged with that caveat in the schedule.</p>`,
  key: [
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp"/>', 'a member’s footprint — sheet 7’s census, plan view'),
    keyRow('<rect x="14" y="3" width="18" height="12" class="sks fhalo"/>', 'its spec annex — the LAMP: the light falls from the tests'),
    keyRow('<rect x="6" y="3" width="36" height="12" fill="var(--halo)"/><rect x="6" y="3" width="36" height="12" class="sk fnone"/>', 'lit ≥95% line — full bright'),
    keyRow('<rect x="6" y="3" width="36" height="12" fill="url(#s7a-g3)"/><rect x="6" y="3" width="36" height="12" class="skr fnone"/>', 'lit 70–85% — pale, red hatch'),
    keyRow('<rect x="6" y="3" width="36" height="12" fill="url(#s7a-se)"/><rect x="6" y="3" width="36" height="12" class="ska fnone" stroke-dasharray="5 4"/>', 'e2e light — real, no meter reads it'),
    keyRow('<line x1="4" y1="4" x2="44" y2="4" class="sks" stroke-dasharray="2 4"/><line x1="4" y1="14" x2="44" y2="14" class="sks" stroke-dasharray="2 4"/>', 'an outline of light — tests run, no meter attaches'),
    keyRow('<rect x="6" y="3" width="36" height="12" fill="url(#s7a-sh)"/><rect x="6" y="3" width="36" height="12" class="sk fnone"/>', 'SHADOW — source no suite ever loads'),
    keyRow('<circle cx="24" cy="9" r="7" class="skr fp"/><text x="24" y="12" class="lblr" text-anchor="middle" font-size="9">n</text>', 'fully dark, red badge — no suite at all'),
    keyRow('<rect x="4" y="3" width="24" height="12" class="sk fp"/><rect x="18" y="3" width="10" height="12" fill="var(--halo)"/><rect x="4" y="3" width="14" height="12" fill="url(#s7a-sh)"/><rect x="32" y="5" width="9" height="8" class="sks fhalo"/>', 'lit strip = share of source the suite loads · light from the lamp side'),
  ].join('\n'),
};

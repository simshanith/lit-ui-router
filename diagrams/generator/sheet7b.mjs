import { defs } from './chrome.mjs';
import { txt, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's7b';
const OX = 600, OY = 96;

// ---- plate 7B: sheet 7's city with every member drawn as a Working Plant --------
// Massing NEVER changes: footprint side = 1.6·√sloc, height = 3 px per authored
// file, placements and gate tiers exactly as sheet 7 rev B.  The sprite adds four
// independent state channels (concept 3 of the sprite studies):
//   RUST  (flank speckle, 5 steps) — member median days since last touch,
//         steps cut at the weathering census's own distribution (sheet 13):
//         0 ≤8d · R1 9–29 · R2 30–34 · R3 35–41 · R4 >180 (+ cracks) — the idle
//         histogram is empty from 60 to 180, so R4 is a gap, not a round number.
//   STEAM (0–3 puffs) — distinct non-merge commits touching the member, trailing
//         90 days (2026-05-19 → 08-17, census-steam.mjs).  Breaks at the actual
//         gaps: 0 puffs ≤2 · 1 puff 4–8 · 2 puffs 9–15 · 3 puffs ≥21.
//   LAMPS (3 module slots) — test light from plate 7A rev B's meter: lit share
//         = extent% × line% (how much source the suite loads × how bright).
//         3 lamps ≥90 · 2 ≥50 · 1 >0 · 0 none; accent lamp = real e2e light no
//         meter reads (7A cats e/u).  Gaps in the data sit at 26→53 and 69→92.
//   PIPES (connected vs dashed+drip) — `turbo run build` at HEAD: 22/22 tasks
//         green (all cache hits — a replay of green).  Every pipe connects.
//   ALERT (floating triangle) — a gate red at HEAD.  No member-owned gate is
//         red; the ONE red gate is //#lint:root, failing over diagrams/generator
//         — the atlas's own drawings.  The triangle hangs over the drafting
//         office in the alert register, not over any plant.
// DESIGN GUARD: rust must not collude with gate-tier red — gate hatch is uniform
// 45° line hatch incl. the cap; rust is a dotted SPECKLE at partial opacity on
// the flanks only, plus jagged cracks at R4.  A red-gated pristine plant and a
// rusted never-gating plant stay distinguishable.

const KS = 1.6, KH = 3.0, MIN = 12;
const S = (sloc) => Math.max(MIN, KS * Math.sqrt(sloc));
const H = (files) => Math.max(4, KH * files);
const AG = 10;

const TIER = {
  halt:   { edge: 'skr', cap: 'fr',  hatch: null, side: `url(#${P}-hr)`, badge: 'skr fp', num: 'lblr' },
  pr:     { edge: 'skr', cap: 'fp',  hatch: 'hr', side: `url(#${P}-hr)`, badge: 'skr fp', num: 'lblr' },
  late:   { edge: 'ska', cap: 'fp',  hatch: 'ha', side: `url(#${P}-ha)`, badge: 'ska fp', num: 'lbla' },
  report: { edge: 'skf', cap: 'fp2', hatch: null, side: `url(#${P}-hx)`, badge: 'skf fp', num: 'lbls' },
  line:   { edge: 'sk',  cap: 'fp',  hatch: null, side: `url(#${P}-hx)`, badge: 'sk fp',  num: 'lbl' },
  off:    { edge: 'sks', cap: 'fp2', hatch: null, side: `url(#${P}-hd)`, badge: 'sks fp', num: 'lbls' },
};

// [n, name, district, tier, x, y, srcFiles, srcSloc, specFiles, specSloc,
//  rustStep, steamCommits90d, lamps(0-3 | 'e' = accent unmetered), lampEff%]
const M = [
  [1,  'lit-ui-router',            'pkg',  'line',     0,  20, 12, 1189, 14, 2879, 2, 29, 3, 92.2],
  [2,  'ui-router-server',         'pkg',  'line',   200,  20,  8, 1141, 12, 2174, 2,  9, 3, 99.6],
  [3,  'lit-ui-router-mobx',       'pkg',  'line',   170, 130,  4,  133,  4,  380, 0,  7, 3, 97.7],
  [4,  'navigation-location-plugin','pkg', 'line',   260, 130,  1,  105,  7,  410, 0,  8, 3, 100],
  [5,  'sample-app-shared',        'app',  'line',   570,  10, 36, 2103,  3,  309, 1, 23, 'e', null],
  [6,  'sample-app-lit-vanilla',   'app',  'line',   720,  10,  8,  401,  0,    0, 3,  7, 'e', null],
  [7,  'sample-app-lit-mobx',      'app',  'line',   720,  90,  8,  440,  0,    0, 3, 10, 'e', null],
  [8,  'sample-app-routes',        'app',  'line',   700, 150,  2,   51,  1,  185, 2,  2, 3, 100],
  [9,  'sample-app-lit-e2e',       'app',  'pr',     580, 150,  1,   57,  4,  348, 0, 15, 'e', null],
  [10, 'docs',                     'site', 'line',   660, 340,  8,  677,  1,  181, 1, 21, 1, 7.8],
  [11, 'examples',                 'site', 'line',   660, 430,  7, 1117,  0,    0, 3, 12, 0, null],
  [12, '@tools/release',           'tool', 'halt',    20, 430, 44, 1871, 19, 1896, 1, 15, 2, 53.2],
  [13, '@tools/typedoc-plugin',    'tool', 'report', 230, 430,  5,  755,  0,    0, 4,  7, 0, null],
  [14, '@tools/dts-backtest',      'tool', 'pr',       8, 350,  1,  291,  0,    0, 0,  4, 0, null],
  [15, '@tools/build_and_test',    'tool', 'report', 330, 430,  5,  427,  2,  378, 1,  5, 2, 61.3],
  [16, '@tools/shared',            'tool', 'report',  20, 550,  9,  300,  5,  276, 2,  7, 2, 68.7],
  [17, '@tools/workers-builds',    'tool', 'late',   220, 550,  2,  375,  1,  266, 0,  6, 2, 58.0],
  [18, '@tools/bundle-probe',      'tool', 'report', 330, 550,  4,  236,  0,    0, 0,  4, 0, null],
  [19, '@tools/compat-guards',     'tool', 'pr',     130, 550,  7,  189,  1,  112, 0,  4, 1, 12.2],
  [20, '@tools/oxc-emit',          'tool', 'line',   230, 350,  3,  100,  0,    0, 1,  2, 0, null],
  [21, '@tools/release-config',    'tool', 'line',   280, 350,  1,   39,  0,    0, 0,  2, 0, null],
  [22, '@tools/lit-template-lint', 'tool', 'report', 325, 350,  1,   21,  0,    0, 0,  1, 0, null],
  [23, '@tools/lit-test-env',      'tool', 'pr',      85, 350,  1,   24,  0,    0, 0,  1, 0, null],
  [24, '@tools/vue-check',         'tool', 'report', 370, 350,  1,   25,  0,    0, 2,  2, 0, null],
  [25, '@tools/lcov-rebase',       'tool', 'report', 415, 350,  2,   23,  1,   30, 1,  1, 1, 26.1],
  [26, '@tools/happy-dom',         'tool', 'pr',     125, 350,  1,    8,  1,   26, 1,  1, 0, 0],
  [27, '@tools/wintercg-globals',  'tool', 'off',    185, 350,  0,    0,  0,    0, null, 0, null, null],
];
const RUST_O = [0, 0.18, 0.32, 0.5, 0.85];
const PUFFS = (c) => (c <= 2 ? 0 : c <= 8 ? 1 : c <= 15 ? 2 : 3);

const geom = new Map(M.map(([n, name, dist, tier, x, y, sf, sl, pf, pl, rust, steam, lamps, eff]) => {
  const s = S(sl), h = H(sf);
  const sa = pf ? S(pl) : 0, ha = pf ? H(pf) : 0;
  const ax = x + s + AG, ay = y + (s - sa) / 2;
  return [n, { n, name, dist, tier, x, y, s, h, sa, ha, ax, ay, sf, sl, pf, pl, rust, steam, lamps, eff,
    x2: pf ? ax + sa : x + s, y1: pf ? Math.min(y, ay) : y, y2: pf ? Math.max(y + s, ay + sa) : y + s }];
}));
const g = (n) => geom.get(n);
const pt = (x, y, z = 0) => isoPt(OX, OY, x, y, z);
const p2 = (x, y, z = 0) => pt(x, y, z).map((v) => v.toFixed(1)).join(',');

// ---- the plant sprite -------------------------------------------------------------
function plant(n) {
  const b = g(n);
  const t = TIER[b.tier];
  if (!b.sf) { // wintercg-globals: ambient types — an empty pad, no machine
    return `${isoBlock(P, OX, OY, b.x, b.y, b.s, b.s, b.h, { capCls: t.cap, edge: t.edge, sideFill: t.side })}
${badge(n)}`;
  }
  const src = isoBlock(P, OX, OY, b.x, b.y, b.s, b.s, b.h, { capCls: t.cap, edge: t.edge, sideFill: t.side });
  const top = [p2(b.x, b.y, b.h), p2(b.x + b.s, b.y, b.h), p2(b.x + b.s, b.y + b.s, b.h), p2(b.x, b.y + b.s, b.h)].join(' ');
  const wash = t.hatch
    ? `<polygon points="${top}" fill="url(#${P}-${t.hatch})"/>\n<polygon points="${top}" class="${t.edge} fnone"/>`
    : '';
  const annex = b.sa
    ? isoBlock(P, OX, OY, b.ax, b.ay, b.sa, b.sa, b.ha, { edge: 'sks', capCls: 'fp2', sideFill: `url(#${P}-hd)` })
    : '';
  // RUST — speckle at partial opacity, flanks only, never the cap (design guard)
  const rustO = RUST_O[b.rust];
  const rightF = [p2(b.x + b.s, b.y, b.h), p2(b.x + b.s, b.y + b.s, b.h), p2(b.x + b.s, b.y + b.s, 0), p2(b.x + b.s, b.y, 0)].join(' ');
  const leftF = [p2(b.x, b.y + b.s, b.h), p2(b.x + b.s, b.y + b.s, b.h), p2(b.x + b.s, b.y + b.s, 0), p2(b.x, b.y + b.s, 0)].join(' ');
  const rustSvg = rustO
    ? `<polygon points="${rightF}" fill="url(#${P}-rust)" opacity="${rustO}"/>
<polygon points="${leftF}" fill="url(#${P}-rust)" opacity="${(rustO * 0.6).toFixed(2)}"/>`
    : '';
  const cracks = b.rust === 4
    ? [[0.22, 0.6], [0.6, 0.42]].map(([f, ht]) =>
        `<path d="M${p2(b.x + b.s, b.y + b.s * f, 0)} L${p2(b.x + b.s, b.y + b.s * (f + 0.08), b.h * ht * 0.5)} L${p2(b.x + b.s, b.y + b.s * (f - 0.04), b.h * ht)}" class="skr" fill="none" opacity="0.85"/>`).join('')
    : '';
  // STEAM — vent block on the roof + 0–3 puffs
  const puffs = PUFFS(b.steam);
  const vs = Math.min(8, b.s * 0.3);
  const vent = b.s >= 20
    ? isoBlock(P, OX, OY, b.x + b.s * 0.14, b.y + b.s * 0.14, vs, vs, 5, { edge: 'sks', capCls: 'fp2', z0: b.h })
    : '';
  const [vx, vy] = b.s >= 20 ? pt(b.x + b.s * 0.14 + vs / 2, b.y + b.s * 0.14 + vs / 2, b.h + 5) : pt(b.x + b.s / 2, b.y + b.s / 2, b.h);
  const plume = Array.from({ length: puffs }, (_, k) =>
    `<ellipse cx="${(vx + 2 + k * 3.4).toFixed(1)}" cy="${(vy - 6 - k * 8.5).toFixed(1)}" rx="${(3.6 + k * 2).toFixed(1)}" ry="${(2.3 + k * 0.9).toFixed(1)}" class="${puffs === 3 ? 'ska' : 'sks'} fnone" opacity="${(0.85 - k * 0.2).toFixed(2)}"/>`).join('');
  // LAMPS — three module slots low on the front-left face
  const lampN = b.lamps === 'e' ? 1 : (b.lamps ?? 0);
  const lampCls = b.lamps === 'e' ? 'ska fa' : 'skg fg';
  const lsz = b.s < 20 ? 3.2 : 4.6;
  const lz = Math.min(6, Math.max(2, b.h * 0.35));
  const lampSvg = (b.lamps === null || b.lamps === undefined) ? '' : [0.22, 0.5, 0.78].map((f, k) => {
    const [lx, ly] = pt(b.x + b.s * f, b.y + b.s, lz);
    const on = k < lampN;
    return `<rect x="${(lx - lsz / 2).toFixed(1)}" y="${(ly - lsz / 2).toFixed(1)}" width="${lsz}" height="${lsz}" class="${on ? lampCls : 'sks fnone'}" ${on ? 'opacity="0.9"' : ''}/>`;
  }).join('');
  // PIPES — connected (build green at HEAD, 22/22): solid elbow to ground + flange
  const pz = Math.min(9, Math.max(2.5, b.h * 0.5));
  const pys = b.s < 20 ? [0.5] : [0.3, 0.62];
  const pipes = pys.map((f) => {
    const py = b.y + b.s * f;
    const a = p2(b.x + b.s, py, pz), c = p2(b.x + b.s + 12, py, pz), d = p2(b.x + b.s + 12, py, 0);
    return `<path d="M${a} L${c} L${d}" class="sks" fill="none"/>
<circle cx="${a.split(',')[0]}" cy="${a.split(',')[1]}" r="1.9" class="sks fp2"/>`;
  }).join('');
  return `${src}${wash}${rustSvg}${cracks}${annex}${vent}${plume}${lampSvg}${pipes}
${badge(n)}`;
}

function badge(n) {
  const b = g(n), t = TIER[b.tier];
  const [bx, by] = pt(b.x + b.s / 2, b.y, b.h);
  const lift = (BADGE_LIFT[n] ?? 15);
  return `<circle cx="${bx.toFixed(1)}" cy="${(by - lift).toFixed(1)}" r="9" class="${t.badge}"/>
${txt(bx.toFixed(1), (by - lift + 3.4).toFixed(1), String(n), t.num, 'middle')}`;
}
// badges lifted clear of roofs AND of their own steam plumes
const BADGE_LIFT = { 1: 46, 2: 34, 5: 40, 6: 35, 7: 52, 9: 28, 10: 44, 11: 18, 12: 26, 16: 30, 20: 26, 21: 34, 23: 34, 26: 13, 27: 34 };

// ---- districts (sheet 7's) --------------------------------------------------------
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

const bodies = M.map(([n]) => n)
  .sort((a, b) => (g(a).x + g(a).y1 + g(a).s) - (g(b).x + g(b).y1 + g(b).s))
  .map(plant)
  .join('\n');

// ---- telemetry (reading) box ------------------------------------------------------
const TB = `
<rect x="1090" y="96" width="430" height="122" class="sk fp"/>
${txt(1106, 116, 'PLANT TELEMETRY — FOUR CHANNELS, ALL INDEPENDENT', 'lbls')}
<line x1="1090" y1="124" x2="1520" y2="124" class="skf"/>
${txt(1106, 142, 'RUST (speckle) — idle: 0 ≤8d · R1 ≤29 · R2 ≤34 · R3 ≤41 · R4 >180', 'lbls')}
${txt(1106, 160, 'STEAM (puffs) — commits/90d: 0 ≤2 · 1: 4–8 · 2: 9–15 · 3: ≥21', 'lbls')}
${txt(1106, 178, 'LAMPS — 7A lit share: 3 ≥90 · 2 ≥50 · 1 >0 · accent = unmetered e2e', 'lbls')}
${txt(1106, 196, 'PIPES — turbo run build at HEAD, 22/22 green: all connected', 'lbls')}
${txt(1106, 211, 'thresholds cut at the distributions’ own gaps — see the schedule', 'lblf')}`;

// ---- alert register ---------------------------------------------------------------
const AR = `
<rect x="40" y="668" width="600" height="126" class="sk fp"/>
<polygon points="76,690 62,716 90,716" class="skr fp"/>
${txt(76, 712, '!', 'lblr', 'middle')}
${txt(108, 696, 'ALERT REGISTER — ONE ALARM AT HEAD, AND IT RINGS OFF-MAP', 'lbls')}
${txt(108, 714, 'no member-owned gate is red: build 22/22 green (verified), main CI green.', 'lblf')}
${txt(108, 728, 'the one red gate is //#lint:root — oxlint, 16 errors, every one inside', 'lblf')}
${txt(108, 742, 'diagrams/generator/: the atlas’s OWN drawings broke the lint line.', 'lblf')}
${txt(108, 756, 'the factory runs; the alarm hangs over the drafting office.', 'lbls')}
${txt(108, 776, 'verified 2026-08-17 · gh run 32074533487 · turbo run build (cached green replay)', 'lblf')}`;

// ---- schedule --------------------------------------------------------------------
const ART_H = 812;
const RUST_T = ['0', 'R1', 'R2', 'R3', 'R4'];
const schedRow = ([n, name, , , , , sf, , , , rust, steam, lamps, eff]) => {
  if (!sf) return `${String(n).padStart(2, ' ')}  ${name} — ambient types · no machine on the pad`;
  const lampS = lamps === 'e' ? 'e2e (accent)' : eff != null ? `${lamps} (${eff}%)` : `${lamps}`;
  return `${String(n).padStart(2, ' ')}  ${name} — rust ${RUST_T[rust]} · steam ${steam}c/90d = ${PUFFS(steam)} puff${PUFFS(steam) === 1 ? '' : 's'} · lamps ${lampS} · pipes OK`;
};
const half = Math.ceil(M.length / 2);
const SY = ART_H + 16;
const schedule = `<rect x="40" y="${SY}" width="1480" height="${74 + half * 17}" class="sk fp"/>
${txt(58, SY + 22, 'PLANT SCHEDULE — per member: rust step (median idle) · steam (commits trailing 90d = puffs) · lamps (lit share from plate 7A) · pipe state', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1520" y2="${SY + 32}" class="skf"/>
${M.slice(0, half).map((r, i) => txt(58, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${M.slice(half).map((r, i) => txt(800, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${txt(58, SY + 58 + half * 17, 'TOTAL — 26 plants running, 0 seized · steam 205 member-touches from 343 window commits · 12 lamps-bearing plants · a 28th member (@tools/eslint-ts-parser) has arrived since the census and is not yet on any map', 'lbls')}`;

const svg = `<svg viewBox="0 0 1560 ${SY + 104 + half * 17}" role="img" aria-label="Sheet 7's isometric census city redrawn as a working industrial plant, every workspace member a machine on the line. Massing is unchanged — footprint proportional to the square root of source lines, height three pixels per authored file, the same four dashed districts. Each machine now broadcasts its state the way a Factorio building does: red rust speckle on the flanks where a member has gone untouched, growing from clean through four steps to the typedoc plugin, whose flanks are almost fully rusted and cracked; steam puffs rising from roof vents where commits touched the member in the last ninety days, three accent puffs over lit-ui-router, sample-app-shared and docs; up to three green module lamps low on each front face showing how much of the member its own test suite lights, all three lit across the packages district, accent lamps on the sample apps whose only light is the unmetered end-to-end rig; and outlet pipes that all connect, because the build is green at head, twenty-two tasks of twenty-two. A single red alert triangle appears nowhere over the city: the alert register explains that the one red gate at head is the root lint task, failing over the atlas's own generator directory — the factory runs while the alarm rings over the drafting office. A plant schedule lists every member's channel values.">
${defs(P)}
<defs>
  <!-- rust: dotted speckle, deliberately unlike every house line hatch -->
  <pattern id="${P}-rust" width="7" height="7" patternUnits="userSpaceOnUse">
    <rect x="1" y="1.5" width="2" height="1.6" fill="var(--red)"/>
    <rect x="4.4" y="4.8" width="1.7" height="1.4" fill="var(--red)"/>
    <rect x="3.1" y="0.2" width="1.2" height="1" fill="var(--red)" opacity="0.7"/>
  </pattern>
</defs>

<rect x="40" y="26" width="520" height="42" class="skf fnone"/>
${txt(52, 43, 'THE WORKING CITY — SHEET 7’S CENSUS, RUNNING', 'lbls')}
${txt(52, 58, 'massing, districts, gates unchanged · sprite = state: rust, steam, lamps, pipes', 'lblf')}

${txt(1520, 34, 'SPRITE RULE — decoration is state, never texture: every mark on a plant is a measured channel', 'lbls', 'end')}
${txt(1520, 48, 'rust = weathering census (sheet 13) · steam = 90-day commits · lamps = plate 7A light · pipes = live turbo', 'lblf', 'end')}
${txt(1520, 62, 'massing and gate severity are sheet 7’s, unchanged — a sprite may decorate a block, never re-mass it', 'lblf', 'end')}

${TB}
${districts}
${bodies}
${AR}

<!-- district lettering -->
${txt(772, 110, 'packages/ — THE PRODUCT LINE', 'lblb')}
${txt(772, 123, 'all lamps lit (90–100% light) · 53 commits/90d', 'lblf')}
${txt(772, 135, 'rust only where the port masonry rests between chisels', 'lblf')}
<line x1="766" y1="126" x2="742" y2="168" class="skf"/>

${txt(1540, 388, 'apps/ — THE PROVING GROUND', 'lblb', 'end')}
${txt(1540, 401, '57 commits/90d · accent lamps: real e2e light,', 'lblf', 'end')}
${txt(1540, 413, 'no meter reads it · vanilla + mobx rust at R3', 'lblf', 'end')}
<line x1="1284" y1="416" x2="1248" y2="446" class="skf"/>

${txt(1014, 668, 'docs/ + examples/ — THE SHOPFRONT', 'lblb')}
${txt(1014, 681, 'docs: 3 puffs, 1 lamp — hottest steam, dimmest metered light', 'lblf')}
${txt(1014, 693, 'examples: 2 puffs, 0 lamps, R3 rust — steaming, unlit, rusting', 'lblf')}
<line x1="1008" y1="664" x2="986" y2="640" class="skf"/>

${txt(60, 560, 'tools/ — THE INSTRUMENT YARD', 'lblb')}
${txt(60, 573, '62 commits/90d across 16 machines · pipes all green', 'lblf')}
${txt(60, 585, 'the yard rusts at the edges and steams at the centre', 'lblf')}
<line x1="300" y1="552" x2="330" y2="522" class="skf"/>

<!-- callouts -->
${txt(60, 118, 'lit-ui-router — THE FLAGSHIP PLANT', 'lbla')}
${txt(60, 132, '3 puffs (29 commits/90d) · 3 lamps (92% lit) · rust R2', 'lblf')}
${txt(60, 144, 'the port’s masonry, at full steam with every lamp lit —', 'lblf')}
${txt(60, 156, 'old AND running, which one axis could never draw', 'lblf')}
<line x1="346" y1="126" x2="526" y2="132" class="skf"/>

${txt(440, 650, '@tools/typedoc-plugin — R4 + cracks, 1 puff:', 'lblr')}
${txt(440, 662, '3 of 5 files sealed 220d, index.ts still live', 'lblf')}
<line x1="448" y1="642" x2="440" y2="492" class="skf"/>

${txt(20, 620, '@tools/happy-dom — a spec annex, and 0 lamps:', 'lblr')}
${txt(20, 633, 'its canary lights happy-dom upstream, never its own 8 lines', 'lblf')}
<line x1="120" y1="608" x2="146" y2="418" class="skf"/>

${schedule}
</svg>`;

export const sheet7b = {
  num: '7B', id: 'working', rev: 'A',
  title: 'THE WORKING CITY',
  sub: 'ALTITUDE 3½ — SYNTHESIS PLATE TO SHEET 7: the census city as a working plant · weathering (13) × test light (7A) × gates (7) × live build, one sprite per member · surveyed 2026-08-17',
  scale: 'WHOLE WORKSPACE',
  form: 'WORKING CITY',
  svg,
  caption: 'Sheet 7 counted the city, sheet 13 dated its stone, plate 7A metered its test light. This plate turns the same city on: every member becomes a Working Plant sprite in the Factorio sense — a machine whose state is broadcast, not implied. Rust speckle for idleness, steam for the last ninety days of commits, module lamps for test light, pipes for the build. The channels are independent on purpose, and the city proves they must be: the flagship runs at full steam under every lamp while wearing rust, and the most-rusted machine in the yard is still quietly steaming. The one alarm at HEAD rings over no plant at all — it rings over the drawings.',
  notes: `
<p><strong>The sprite decorates; the census still governs.</strong> Every block is sheet 7 rev B's, unchanged: footprint 1.6·√sloc, height 3 px per authored file, spec annexes beside their buildings, gate severity in the same colours with the same uniform hatch including the cap. The Working Plant sprite (concept 3 of the sprite studies) adds four state channels as overlays. The design guard from the study is enforced: rust is a dotted <em>speckle</em> at partial opacity on the flanks only — never the cap, never a 45° line hatch — so a red-gated pristine plant (uniform hatch, cap included) and a rusting never-gating plant cannot be confused, in either theme.</p>
<p><strong>Every channel is measured, and every threshold comes from a distribution.</strong> RUST is the weathering census (sheet 13): median days since last touch per member, five steps cut where the idle histogram actually cuts — the top step is the 60–180-day gap nothing occupies, so R4 means genuinely sealed, and only the typedoc plugin wears it. STEAM is distinct non-merge commits touching the member in the trailing 90 days (2026-05-19 → 08-17): the counts break cleanly at 2, 8 and 15, giving 0–3 puffs; three plants steam at three puffs — <code>lit-ui-router</code> (29), <code>sample-app-shared</code> (23), <code>docs</code> (21). LAMPS compress plate 7A's meter to one number, lit share = extent × line coverage, whose values cluster below 26, between 53 and 69, and above 92 — three lamps, two, one; the accent lamp is 7A's honest category for e2e light no meter reads. PIPES are live: <code>turbo run build</code> at HEAD, 22 of 22 tasks green (all cache hits — a replay of green, stated as such), so every pipe on the sheet connects and the key says so rather than inventing a broken one.</p>
<p><strong>The channels disagree, which is the point.</strong> A single wreck-to-splendor axis would have to average these stories away: <code>lit-ui-router</code> is the oldest masonry in the city <em>and</em> its hottest steam <em>and</em> fully lamped — old and running. The typedoc plugin is the only R4 rust on the sheet, cracked flanks and all, yet still emits a puff, because <code>index.ts</code> takes commits while <code>symbols/</code> sleeps its 220 days. <code>examples</code> steams at two puffs with zero lamps and R3 rust — worked on, untested, aging — and <code>docs</code> pairs the city's third-hottest steam with its dimmest metered light (7.8% lit). <code>@tools/happy-dom</code> keeps plate 7A's strangest fact: a plant with its own spec annex and no lamp lit, because the spec is a canary pointed upstream.</p>
<p><strong>The alert channel found exactly one alarm, and it is not on the map.</strong> No member-owned gate is red at HEAD: the build is green, main's CI is green. The one red gate is <code>//#lint:root</code> — oxlint failing with 16 errors, every one of them inside <code>diagrams/generator/</code>. The atlas broke its own lint line drawing itself. The Factorio alert triangle therefore hangs in the alert register, over the drafting office, with the run id cited — drawing it over any plant would be fiction, and omitting it would be flattery.</p>
<p><strong>Housekeeping the survey turned up.</strong> A 28th workspace member, <code>@tools/eslint-ts-parser</code>, has arrived since sheet 7's census was taken and appears in turbo's build graph; it stands on no map in this set yet and is recorded in the schedule total until the census is re-taken. The steam total (205 member-touches from 343 window commits) double-counts commits that touch several members, as any per-member count must; the window commit count is given so the two are never confused.</p>`,
  key: [
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp"/>', 'a member, massed by sheet 7’s census — unchanged'),
    keyRow(`<rect x="6" y="3" width="36" height="12" class="sk fp"/><rect x="6" y="3" width="36" height="12" fill="url(#${P}-rust)" opacity="0.5"/>`, 'rust speckle (flanks only) — median idle days, 5 steps'),
    keyRow('<path d="M8,15 L12,10 L10,4" class="skr" fill="none"/><path d="M20,15 L23,11 L21,5" class="skr" fill="none"/>', 'cracks — R4 only: idle past the 180-day gap'),
    keyRow('<ellipse cx="12" cy="12" rx="4" ry="2.5" class="sks fnone"/><ellipse cx="16" cy="7" rx="6" ry="3" class="sks fnone" opacity="0.6"/>', 'steam — 0–3 puffs = commits trailing 90 days'),
    keyRow('<ellipse cx="12" cy="12" rx="4" ry="2.5" class="ska fnone"/><ellipse cx="16" cy="7" rx="6" ry="3" class="ska fnone" opacity="0.6"/>', 'accent plume — top steam band (≥21 commits)'),
    keyRow('<rect x="8" y="6" width="5" height="5" class="skg fg"/><rect x="16" y="6" width="5" height="5" class="skg fg"/><rect x="24" y="6" width="5" height="5" class="sks fnone"/>', 'module lamps — lit share of plate 7A’s test light'),
    keyRow('<rect x="8" y="6" width="5" height="5" class="ska fa"/><rect x="16" y="6" width="5" height="5" class="sks fnone"/><rect x="24" y="6" width="5" height="5" class="sks fnone"/>', 'accent lamp — e2e light, real but unmetered'),
    keyRow('<path d="M4,9 L30,9 L30,16" class="sks" fill="none"/><circle cx="4" cy="9" r="2" class="sks fp2"/>', 'pipe, connected — build green at HEAD (all 22/22 are)'),
    keyRow('<polygon points="24,2 17,15 31,15" class="skr fp"/><text x="24" y="12.5" class="lblr" text-anchor="middle">!</text>', 'alert — a red gate at HEAD (one exists: over the drawings)'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="fr"/><rect x="6" y="3" width="36" height="12" class="skr fnone"/>', 'gate severity — sheet 7’s, uniform hatch incl. cap'),
  ].join('\n'),
};

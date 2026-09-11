import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, schedTxt, isoBlock, isoPt, keyRow } from './helpers.mjs';
import { assertPlots, depthSort, plotsOf, solidFaces } from './iso-hidden.mjs';
import { PLACED } from './sheet7.mjs';

const P = 's7b';
const OX = 600, OY = 96;

// ---- plate 7B: sheet 7's city with every member drawn as a Working Plant --------
// Massing follows sheet 7, never the sprite: side = 1.6·√sloc, height = 3 px per
// file, placements and gate tiers imported from sheet 7.  The sprite adds four
// independent state channels (concept 3 of the sprite studies):
//   RUST  (flank speckle, 5 steps) — member median days since last touch, cut on
//         sheet 13's idle distribution: 0 ≤14d · R1 ≤30 · R2 ≤37 · R3 ≤58 ·
//         R4 >180 (+ cracks).  14 and 30 are histogram bucket walls, 37 is the
//         median, 58 the top of the occupied band; 61–180 is empty, so R4 marks
//         a gap rather than a round number.
//   STEAM (0–3 puffs) — distinct commits touching the member in a trailing 90-day
//         window, IMPORTED from diagrams/data/census-steam.json (window and basis
//         rendered from the plate).  Bands: 0 puffs ≤2 · 1 puff 3–8 ·
//         2 puffs 9–15 · 3 puffs ≥16.
//   LAMPS (3 module slots) — test light IMPORTED from plate 7A's own plate,
//         diagrams/data/census-shadow.json: lit share = extent% × line% (how much
//         source the suite loads × how bright).  3 lamps ≥90 · 2 ≥50 · 1 >0 ·
//         0 none; accent lamp = real e2e light no meter reads (7A cats e/u); no
//         slots at all only where there is no mass to light (7A cat z).
//   PIPES (connected vs dashed+drip) — the `turbo run build` graph, read from
//         diagrams/data/census-plate.json, last run green 2026-08-17 (all cache
//         hits — a replay of green).  Every pipe connects.
//   ALERT (floating triangle) — a gate red at HEAD.  The register is CLEAR, and
//         the struck triangle by it is the channel's legend, not an alarm.
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

// ---- the two plates this sheet reads --------------------------------------------
// Placement, district and gate tier are sheet 7's PLACED table, imported so the two
// sheets cannot drift; massing is sheet 7's plate; STEAM is census-steam.json.
// LAMPS are plate 7A's own snapshot (census-shadow.json), read here rather than
// transcribed; RUST alone is an editorial constant keyed by badge.
const CITY = JSON.parse(readFileSync(new URL('../data/census-city.json', import.meta.url), 'utf8'));
const SHADOW = JSON.parse(readFileSync(new URL('../data/census-shadow.json', import.meta.url), 'utf8'));
const PLATE = JSON.parse(readFileSync(new URL('../data/census-steam.json', import.meta.url), 'utf8'));
// PIPES: the build graph, from the same plate sheets 3/3A/12 read — never re-typed
const BUILD = JSON.parse(readFileSync(new URL('../data/census-plate.json', import.meta.url), 'utf8')).pipelines.build;
const CITY_ROW = new Map(CITY.rows.map((r) => [r.member, r]));
const STEAM_ROW = new Map(PLATE.rows.map((r) => [r.member, r.commits]));
const cityOf = (dir) => {
  const r = CITY_ROW.get(dir);
  if (!r) throw new Error(`plate 7B: member ${dir} is missing from diagrams/data/census-city.json`);
  return r;
};
const steamOf = (dir) => {
  const c = STEAM_ROW.get(dir);
  if (c === undefined) throw new Error(`plate 7B: member ${dir} is missing from diagrams/data/census-steam.json`);
  return c;
};
const WINDOW = `${PLATE.window.since}..${PLATE.window.until}`;
const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;

// RUST step per member — the one editorial channel on this sheet (sheet 13's
// weathering census).  null = no machine on the pad.
const RUST = new Map([
  [1, 3], [2, 3], [3, 1], [4, 1], [5, 3], [6, 3], [7, 3], [8, 3], [9, 1], [10, 1],
  [11, 1], [12, 3], [13, 4], [14, 1], [15, 2], [16, 2], [17, 1], [18, 1], [19, 1],
  [20, 1], [21, 1], [22, 0], [23, 1], [24, 3], [25, 2], [26, 3], [27, null],
  [28, 0], [29, 0], [30, 1], [31, 0], [32, 0],
  // born 2026-09-07/08 — nothing on these pads has had time to weather
  [33, 0], [34, 0], [35, 0],
]);
const rustOf = (n) => {
  if (!RUST.has(n)) throw new Error(`plate 7B: member ${n} has no rust step`);
  return RUST.get(n);
};
// LAMPS, derived from plate 7A's snapshot: lit share = extent × line coverage.
// A member with no mass has no slots; e2e/unmetered light burns accent.
const SHADOW_ROW = new Map(SHADOW.rows.map((r) => [r.member, r]));
const lampOf = (dir) => {
  const s = SHADOW_ROW.get(dir);
  if (!s) throw new Error(`plate 7B: member ${dir} is missing from diagrams/data/census-shadow.json`);
  if (s.cat === 'z') return [null, null];
  if (s.cat === 'e' || s.cat === 'u') return ['e', null];
  if (s.cat !== 'm') return [0, null];
  const eff = +(((s.extent ?? 0) * (s.line ?? 100)) / 100).toFixed(1);
  return [eff >= 90 ? 3 : eff >= 50 ? 2 : eff > 0 ? 1 : 0, eff];
};

// [n, name, district, tier, x, y, srcFiles, srcSloc, specFiles, specSloc,
//  rustStep, steamCommits90d, lamps, lampEff%]
const M = PLACED.map(([n, name, dir, dist, tier, x, y]) => {
  const c = cityOf(dir), rust = rustOf(n), [lamps, eff] = lampOf(dir);
  return [n, name, dist, tier, x, y, c.srcFiles, c.srcSloc, c.specFiles, c.specSloc, rust, steamOf(dir), lamps, eff];
});
const dsteam = (d) => M.filter((r) => r[2] === d).reduce((a, r) => a + r[11], 0);
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
// the working city stands on sheet 7's plots: assert them under this plate's name too
assertPlots('plate 7B', [...geom.values()].flatMap(plotsOf));
const pt = (x, y, z = 0) => isoPt(OX, OY, x, y, z);
const p2 = (x, y, z = 0) => pt(x, y, z).map((v) => v.toFixed(1)).join(',');

// ---- the plant sprite -------------------------------------------------------------
function plant(n) {
  const b = g(n);
  const t = TIER[b.tier];
  if (!b.sf) { // wintercg-globals: ambient types — an empty pad, no machine
    return solidFaces(isoBlock(P, OX, OY, b.x, b.y, b.s, b.s, b.h, { capCls: t.cap, edge: t.edge, sideFill: t.side }));
  }
  const src = solidFaces(isoBlock(P, OX, OY, b.x, b.y, b.s, b.s, b.h, { capCls: t.cap, edge: t.edge, sideFill: t.side }));
  const top = [p2(b.x, b.y, b.h), p2(b.x + b.s, b.y, b.h), p2(b.x + b.s, b.y + b.s, b.h), p2(b.x, b.y + b.s, b.h)].join(' ');
  const wash = t.hatch
    ? `<polygon points="${top}" fill="url(#${P}-${t.hatch})"/>\n<polygon points="${top}" class="${t.edge} fnone"/>`
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
    ? solidFaces(isoBlock(P, OX, OY, b.x + b.s * 0.14, b.y + b.s * 0.14, vs, vs, 5, { edge: 'sks', capCls: 'fp2', z0: b.h }))
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
  // PIPES — connected (the build graph's real tasks): elbow to ground + flange
  const pz = Math.min(9, Math.max(2.5, b.h * 0.5));
  const pys = b.s < 20 ? [0.5] : [0.3, 0.62];
  // the elbow lands inside the annex gap (AG) — a pipe never runs into the annex wall
  const preach = AG * 0.7;
  const pipes = pys.map((f) => {
    const py = b.y + b.s * f;
    const a = p2(b.x + b.s, py, pz), c = p2(b.x + b.s + preach, py, pz), d = p2(b.x + b.s + preach, py, 0);
    return `<path d="M${a} L${c} L${d}" class="sks" fill="none"/>
<circle cx="${a.split(',')[0]}" cy="${a.split(',')[1]}" r="1.9" class="sks fp2"/>`;
  }).join('');
  return `${src}${wash}${rustSvg}${cracks}${vent}${plume}${lampSvg}${pipes}`;
}

const annexOf = (n) => {
  const b = g(n);
  return solidFaces(isoBlock(P, OX, OY, b.ax, b.ay, b.sa, b.sa, b.ha, { edge: 'sks', capCls: 'fp2', sideFill: `url(#${P}-hd)` }));
};

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

// Plants and annexes are separate masses, painted back to front; badges ride last.
const bodies = depthSort(M.flatMap(([n]) => {
  const b = g(n);
  const out = [{ x: b.x, y: b.y, w: b.s, d: b.s, svg: plant(n) }];
  if (b.sa) out.push({ x: b.ax, y: b.ay, w: b.sa, d: b.sa, svg: annexOf(n) });
  return out;
})).map((m) => m.svg).join('\n')
  + '\n' + M.map(([n]) => badge(n)).join('\n');

// ---- telemetry (reading) box ------------------------------------------------------
// The rust ladder outgrew the wall it was drawn to, so the reading takes a
// continuation line and the box is re-cut to the widest line that remains
// (PIPES) and hung on the plate's right margin, clear of the packages lettering.
const TB = `
<rect x="1152" y="96" width="388" height="148" class="sk fp"/>
${txt(1168, 116, 'PLANT TELEMETRY — FOUR CHANNELS, ALL INDEPENDENT', 'lbls')}
<line x1="1152" y1="124" x2="1540" y2="124" class="skf"/>
${txt(1168, 142, 'RUST (speckle) — idle: 0 ≤14d · R1 ≤30 · R2 ≤37 ·', 'lbls')}
${txt(1180, 156, 'R3 ≤58 · R4 >180, CRACKED (SHEET 13)', 'lbls')}
${txt(1168, 174, 'STEAM (puffs) — commits/90d: 0 ≤2 · 1: 3–8 · 2: 9–15 · 3: ≥16', 'lbls')}
${txt(1168, 192, 'LAMPS — 7A lit share: 3 ≥90 · 2 ≥50 · 1 >0 · accent = unmetered e2e', 'lbls')}
${txt(1168, 210, `PIPES — turbo run build graph: ${BUILD.real} real of ${BUILD.nodes} nodes, last green 08-17`, 'lbls')}
${txt(1168, 225, `steam window ${WINDOW} — ${PLATE.ref} @ ${PLATE.sha}`, 'lblf')}`;

// ---- alert register ---------------------------------------------------------------
const AR = `
<rect x="40" y="668" width="600" height="126" class="sk fp"/>
<polygon points="76,690 62,716 90,716" class="sks fnone"/>
<line x1="58" y1="720" x2="94" y2="686" class="sks"/>
${txt(108, 696, 'ALERT REGISTER — NO GATE IS RED AT HEAD; THE CHANNEL STAYS DRAWN', 'lbls')}
${txt(108, 714, 'a triangle floats over any plant whose own gate task is failing at HEAD.', 'lblf')}
${txt(108, 728, 'the register is clear: every gate in the city exits 0, //#lint:root over the', 'lblf')}
${txt(108, 742, 'atlas’s own diagrams/generator among them, so no plant carries a triangle.', 'lblf')}
${txt(108, 756, 'the struck triangle at the left is this channel’s legend, not an alarm.', 'lbls')}
${txt(108, 776, `checked 2026-08-31 · oxlint over diagrams/generator, exit 0 · build graph ${BUILD.real} real`, 'lblf')}`;

// ---- schedule --------------------------------------------------------------------
const ART_H = 812;
const RUST_T = ['0', 'R1', 'R2', 'R3', 'R4'];
const schedRow = ([n, name, , , , , sf, , , , rust, steam, lamps, eff]) => {
  if (!sf) return [n, `${name} — ambient types · no machine on the pad`];
  const lampS = lamps === 'e' ? 'e2e (accent)' : lamps == null ? 'no mass — no slots'
    : eff != null ? `${lamps} (${eff}%)` : `${lamps}`;
  return [n, `${name} — rust ${RUST_T[rust]} · steam ${steam}c/90d = ${PUFFS(steam)} puff${PUFFS(steam) === 1 ? '' : 's'} · lamps ${lampS} · pipes OK`];
};
const RUNNING = M.filter((r) => r[6]).length;
const TOT_STEAM = M.reduce((a, r) => a + r[11], 0);
const METERED = M.filter((r) => typeof r[12] === 'number' && r[12] > 0).length;
const ACCENT = M.filter((r) => r[12] === 'e').length;
// the cover index's fit verdict, told from the plate's own channels
export const SHEET7B_VERDICT = `the synthesis plate — rust, steam, lamps and pipes on one city: ${RUNNING} plants run and every pipe connects on ${BUILD.real} green build tasks, ${METERED} carry metered lamps, and the alert register stands drawn and empty — no gate is red at HEAD`;
const half = Math.ceil(M.length / 2);
const SY = ART_H + 16;
const schedule = `<rect x="40" y="${SY}" width="1480" height="${74 + half * 17}" class="sk fp"/>
${txt(58, SY + 22, `PLANT SCHEDULE — per member: rust step (median idle) · steam (commits ${WINDOW} = puffs) · lamps (lit share from plate 7A) · pipe state`, 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1520" y2="${SY + 32}" class="skf"/>
${M.slice(0, half).map((r, i) => schedTxt(58, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${M.slice(half).map((r, i) => schedTxt(800, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${txt(58, SY + 58 + half * 17, `TOTAL — ${RUNNING} plants running, 0 seized · steam ${TOT_STEAM} member-touches from ${PLATE.windowCommits} window commits (${WINDOW}) · ${METERED} metered-lamp plants + ${ACCENT} accent · steam ${BASIS}; rust and lamps carry their own older bases`, 'lbls')}`;

const svg = `<svg viewBox="0 0 1560 ${SY + 104 + half * 17}" role="img" aria-label="Sheet 7's isometric census city redrawn as a working industrial plant, every workspace member a machine on the line. Massing is unchanged — footprint proportional to the square root of source lines, height three pixels per authored file, the same four dashed districts. Each machine broadcasts its state the way a Factorio building does: red rust speckle on the flanks where a member has gone untouched, growing from clean through four steps to the typedoc plugin, whose flanks are almost fully rusted and cracked; steam puffs rising from roof vents where commits touched the member in the last ninety days, six accent puffs over lit-ui-router, sample-app-shared, the Cypress host, docs, examples and the release tool; up to three green module lamps low on each front face showing how much of the member its own test suite lights, read straight from plate 7A's own filed snapshot, with accent lamps on the sample apps whose only light is the unmetered end-to-end rig; and outlet pipes that all connect, because the build graph's ${BUILD.real} real tasks last ran green. No alert triangle stands over the city at all: the alert register records that no gate task in the workspace is failing at HEAD, and the struck triangle beside the register is the channel's legend rather than an alarm. A plant schedule lists every member's channel values.">
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
${txt(1520, 48, `rust = weathering census (sheet 13) · steam = commits ${WINDOW}, from diagrams/data/census-steam.json · lamps = plate 7A light · pipes = live turbo`, 'lblf', 'end')}
${txt(1520, 62, 'massing and gate severity are sheet 7’s, unchanged — a sprite may decorate a block, never re-mass it', 'lblf', 'end')}

${TB}
${districts}
${bodies}
${AR}

<!-- district lettering -->
${txt(772, 110, 'packages/ — THE PRODUCT LINE', 'lblb')}
${txt(772, 123, `all metered lamps lit (90–100% light) · ${dsteam('pkg')} commits/90d`, 'lblf')}
${txt(772, 135, `the fifth package stands at R0, fully metered — ${g(31).lamps} lamps (${g(31).eff}% lit)`, 'lblf')}
<line x1="766" y1="126" x2="742" y2="168" class="skf"/>

${txt(1540, 388, 'apps/ — THE PROVING GROUND', 'lblb', 'end')}
${txt(1540, 401, `${dsteam('app')} commits/90d · accent lamps: real e2e light,`, 'lblf', 'end')}
${txt(1540, 413, 'no meter reads it · vanilla + mobx rust at R3', 'lblf', 'end')}
<line x1="1284" y1="416" x2="1248" y2="446" class="skf"/>

${txt(1014, 668, 'www/ + examples/ — THE SHOPFRONT', 'lblb')}
${txt(1014, 681, `docs: ${PUFFS(g(10).steam)} puffs (${g(10).steam}c), 1 lamp — top steam band, dimmest metered light`, 'lblf')}
${txt(1014, 693, `examples: ${PUFFS(g(11).steam)} puffs (${g(11).steam}c), 0 lamps, R1 rust — at full steam, unlit, freshly worked`, 'lblf')}
<line x1="1008" y1="664" x2="986" y2="640" class="skf"/>

${txt(60, 560, 'tools/ — THE INSTRUMENT YARD', 'lblb')}
${txt(60, 573, `${dsteam('tool')} commits/90d across ${M.filter((r) => r[2] === 'tool').length} machines · pipes all green`, 'lblf')}
${txt(60, 585, 'the yard rusts at the edges and steams at the centre', 'lblf')}
<line x1="300" y1="552" x2="330" y2="522" class="skf"/>

<!-- callouts -->
${txt(60, 118, 'lit-ui-router — THE FLAGSHIP PLANT', 'lbla')}
${txt(60, 132, `3 puffs (${g(1).steam} commits/90d) · ${g(1).lamps} lamps (${g(1).eff}% lit) · rust R3`, 'lblf')}
${txt(60, 144, 'the port’s masonry, at full steam with every lamp lit —', 'lblf')}
${txt(60, 156, 'old AND running, which one axis could never draw', 'lblf')}
<line x1="388" y1="127" x2="526" y2="132" class="skf"/>

${txt(440, 650, '@tools/typedoc-plugin — R4 + cracks, 1 puff:', 'lblr')}
${txt(440, 662, '3 of 5 files sealed 234d, index.ts still live', 'lblf')}
<line x1="448" y1="636" x2="440" y2="492" class="skf"/>

${txt(20, 620, '@tools/happy-dom — a spec annex, and 0 lamps:', 'lblr')}
${txt(20, 633, `its canary lights happy-dom upstream, never its own ${g(26).sl} lines`, 'lblf')}
<line x1="20" y1="606" x2="146" y2="418" class="skf"/>

${schedule}
</svg>`;

export const sheet7b = {
  num: '7B', id: 'working', rev: 'G',
  title: 'THE WORKING CITY',
  sub: `ALTITUDE 3½ — SYNTHESIS PLATE TO SHEET 7: the census city as a working plant · weathering (13) × test light (7A) × gates (7) × live build, one sprite per member · steam window ${WINDOW} · ${BASIS}`,
  scale: 'WHOLE WORKSPACE',
  form: 'WORKING CITY',
  svg,
  caption: 'Sheet 7 counted the city, sheet 13 dated its stone, plate 7A metered its test light. This plate turns the same city on: every member becomes a Working Plant sprite in the Factorio sense — a machine whose state is broadcast, not implied. Rust speckle for idleness, steam for the last ninety days of commits, module lamps for test light, pipes for the build. The channels are independent on purpose, and the city proves they must be: the flagship runs at full steam under every lamp while wearing rust, and the most-rusted machine in the yard is still quietly steaming. The alert channel is drawn and empty: no gate in the city is red at HEAD.',
  notes: `
<p><strong>The sprite decorates; the census governs.</strong> Every block is sheet 7's, unchanged: footprint 1.6·√sloc, height 3 px per authored file, spec annexes beside their buildings, gate severity in the same colours with the same uniform hatch including the cap. The Working Plant sprite (concept 3 of the sprite studies) adds four state channels as overlays. The design guard from the study is enforced: rust is a dotted <em>speckle</em> at partial opacity on the flanks only — never the cap, never a 45° line hatch — so a red-gated pristine plant (uniform hatch, cap included) and a rusting never-gating plant cannot be confused, in either theme.</p>
<p><strong>Every channel is measured, and every threshold comes from a distribution.</strong> RUST is sheet 13's weathering census: median days since last touch per member, five steps cut where the idle histogram cuts — 0 ≤14d · R1 ≤30 · R2 ≤37 · R3 ≤58 · R4 &gt;180. The top step spans a band nothing occupies (61–180 days), so R4 means genuinely sealed, and only the typedoc plugin wears it. STEAM is distinct commits touching the member in a trailing 90-day window, read from <code>diagrams/data/census-steam.json</code> — window ${WINDOW}, ${BASIS} — banded 0 puffs ≤2 · 1: 3–8 · 2: 9–15 · 3: ≥16. Those edges are editorial: 3, 9 and 16 are all occupied on this window, so they sit in traffic rather than in empty air. Six plants steam at three puffs: <code>lit-ui-router</code> (${g(1).steam}), <code>sample-app-shared</code> (${g(5).steam}), <code>docs</code> (${g(10).steam}), <code>@tools/release</code> (${g(12).steam}), <code>sample-app-lit-e2e</code> (${g(9).steam}) and <code>examples</code> (${g(11).steam}). LAMPS compress plate 7A's meter to one number — lit share = extent × line coverage — read from <code>diagrams/data/census-shadow.json</code>, metered at ${SHADOW.ref} @ ${SHADOW.sha}: three lamps at ${'≥'}90, two at ${'≥'}50, one above zero, and the accent lamp is 7A's honest category for light no meter reads. PIPES are the <code>turbo run build</code> graph from <code>diagrams/data/census-plate.json</code>: ${BUILD.real} real tasks in ${BUILD.nodes} nodes, last run green on 2026-08-17 (all cache hits — a replay of green, stated as such), so every pipe on the sheet connects and the key says so rather than inventing a broken one.</p>
<p><strong>The channels disagree, which is the point.</strong> A single wreck-to-splendor axis would have to average these stories away. <code>lit-ui-router</code> is the oldest masonry in the city <em>and</em> its hottest steam <em>and</em> fully lamped — old and running. The typedoc plugin is the only R4 rust on the sheet, cracked flanks and all, yet still emits a puff, because <code>index.ts</code> takes commits while <code>symbols/</code> sleeps its 234 days. <code>examples</code> steams at ${PUFFS(g(11).steam)} puffs with zero lamps and only R1 rust — worked on, untested, barely aging — while <code>docs</code> pairs the city's second-hottest steam with its dimmest metered light (${g(10).eff}% lit). And <code>@tools/happy-dom</code> keeps plate 7A's strangest fact: a plant with its own spec annex and no lamp lit, because the spec is a canary pointed upstream.</p>
<p><strong>Three channels by import, one by hand.</strong> Placements, districts and gate tiers are <em>imported</em> from sheet 7's own placement table, and the masses from <code>diagrams/data/census-city.json</code>, so the two sheets cannot drift building for building. Steam, lamps and pipes are each looked up by member directory in their own filed plate, and a member this sheet draws that a plate does not carry is a build error rather than a stale number. Rust is the exception: an editorial step per member, keyed by badge off sheet 13's weathering census and labelled as such wherever it is printed. The steam total — ${TOT_STEAM} member-touches from ${PLATE.windowCommits} window commits — double-counts commits touching several members, as any per-member count must, so the window commit count is printed beside it.</p>`,
  key: [
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp"/>', 'a member, massed by sheet 7’s census — unchanged'),
    keyRow(`<rect x="6" y="3" width="36" height="12" class="sk fp"/><rect x="6" y="3" width="36" height="12" fill="url(#${P}-rust)" opacity="0.5"/>`, 'rust speckle (flanks only) — median idle days, 5 steps'),
    keyRow('<path d="M8,15 L12,10 L10,4" class="skr" fill="none"/><path d="M20,15 L23,11 L21,5" class="skr" fill="none"/>', 'cracks — R4 only: idle past the 180-day gap'),
    keyRow('<ellipse cx="12" cy="12" rx="4" ry="2.5" class="sks fnone"/><ellipse cx="16" cy="7" rx="6" ry="3" class="sks fnone" opacity="0.6"/>', 'steam — 0–3 puffs = commits trailing 90 days'),
    keyRow('<ellipse cx="12" cy="12" rx="4" ry="2.5" class="ska fnone"/><ellipse cx="16" cy="7" rx="6" ry="3" class="ska fnone" opacity="0.6"/>', 'accent plume — top steam band (≥16 commits)'),
    keyRow('<rect x="8" y="6" width="5" height="5" class="skg fg"/><rect x="16" y="6" width="5" height="5" class="skg fg"/><rect x="24" y="6" width="5" height="5" class="sks fnone"/>', 'module lamps — lit share of plate 7A’s test light'),
    keyRow('<rect x="8" y="6" width="5" height="5" class="ska fa"/><rect x="16" y="6" width="5" height="5" class="sks fnone"/><rect x="24" y="6" width="5" height="5" class="sks fnone"/>', 'accent lamp — e2e light, real but unmetered'),
    keyRow('<path d="M4,9 L30,9 L30,16" class="sks" fill="none"/><circle cx="4" cy="9" r="2" class="sks fp2"/>', `pipe, connected — the build graph\u2019s ${BUILD.real} real tasks, last green`),
    keyRow('<polygon points="24,2 17,15 31,15" class="sks fnone"/><line x1="14" y1="17" x2="34" y2="1" class="sks"/>', 'alert, struck — the legend: no gate is red at HEAD'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="fr"/><rect x="6" y="3" width="36" height="12" class="skr fnone"/>', 'gate severity — sheet 7’s, uniform hatch incl. cap'),
  ].join('\n'),
};

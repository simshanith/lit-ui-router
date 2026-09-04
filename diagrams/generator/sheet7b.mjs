import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, isoBlock, isoPt, keyRow } from './helpers.mjs';
import { depthSort, solidFaces } from './iso-hidden.mjs';
import { PLACED } from './sheet7.mjs';

const P = 's7b';
const OX = 600, OY = 96;

// ---- plate 7B: sheet 7's city with every member drawn as a Working Plant --------
// Massing follows sheet 7, never the sprite: side = 1.6·√sloc, height = 3 px per
// file, placements and gate tiers exactly as sheet 7 rev D.  The sprite adds four
// independent state channels (concept 3 of the sprite studies):
//   RUST  (flank speckle, 5 steps) — member median days since last touch,
//         steps RE-CUT at rev C on the 2026-08-31 idle distribution (sheet 13):
//         0 ≤14d · R1 ≤30 · R2 ≤37 · R3 ≤58 · R4 >180 (+ cracks).  14 and 30 are
//         histogram bucket walls, 37 is the median, 58 is the top of the occupied
//         band; the empty gap is now 61–180, so R4 is still a gap, not a round
//         number.  A step label does NOT mean across revs what it meant before:
//         rev B's R2 (30–34d) is not rev C's R2 (31–37d).
//   STEAM (0–3 puffs) — distinct commits touching the member in a trailing 90-day
//         window, IMPORTED from diagrams/data/census-steam.json (window and basis
//         rendered from the plate).  Band edges are rev C's and stay: 0 puffs ≤2 ·
//         1 puff 3–8 · 2 puffs 9–15 · 3 puffs ≥16.
//   LAMPS (3 module slots) — test light IMPORTED from plate 7A's own plate,
//         diagrams/data/census-shadow.json (rev E — the last hand-pasted channel
//         on this sheet): lit share = extent% × line% (how much source the suite
//         loads × how bright).  3 lamps ≥90 · 2 ≥50 · 1 >0 · 0 none; accent lamp
//         = real e2e light no meter reads (7A cats e/u); no slots at all only
//         where there is no mass to light (7A cat z).
//   PIPES (connected vs dashed+drip) — the `turbo run build` graph, read from
//         diagrams/data/census-plate.json (rev B: 22 real of 103), last run green 2026-08-17 (all
//         cache hits — a replay of green).  Every pipe connects.
//   ALERT (floating triangle) — a gate red at HEAD.  Rev B carried one: //#lint:root
//         failing with 16 oxlint errors, every one inside diagrams/generator —
//         the atlas's own drawings.  Commit ffd4ef7 answered it.  At rev C the
//         register is CLEAR, and the triangle is struck rather than deleted:
//         an answered alarm is a record, not an erasure.
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
// transcribed; RUST alone is still an editorial constant keyed by badge.
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

// RUST step per member — the one editorial channel left on this sheet (sheet 13's
// weathering census, ladder re-cut at rev C).  null = no machine on the pad.
const RUST = new Map([
  [1, 3], [2, 3], [3, 1], [4, 1], [5, 3], [6, 3], [7, 3], [8, 3], [9, 1], [10, 1],
  [11, 1], [12, 3], [13, 4], [14, 1], [15, 2], [16, 2], [17, 1], [18, 1], [19, 1],
  [20, 1], [21, 1], [22, 0], [23, 1], [24, 3], [25, 2], [26, 3], [27, null],
  [28, 0], [29, 0], [30, 1], [31, 0],
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
// the longest reading (LAMPS) sets the inset — it must clear the box wall, not touch it
const TB = `
<rect x="1090" y="96" width="430" height="122" class="sk fp"/>
${txt(1098, 116, 'PLANT TELEMETRY — FOUR CHANNELS, ALL INDEPENDENT', 'lbls')}
<line x1="1090" y1="124" x2="1520" y2="124" class="skf"/>
${txt(1098, 142, 'RUST (speckle) — idle: 0 ≤14d · R1 ≤30 · R2 ≤37 · R3 ≤58 · R4 >180 (RE-CUT AT REV C)', 'lbls')}
${txt(1098, 160, 'STEAM (puffs) — commits/90d: 0 ≤2 · 1: 3–8 · 2: 9–15 · 3: ≥16', 'lbls')}
${txt(1098, 178, 'LAMPS — 7A lit share: 3 ≥90 · 2 ≥50 · 1 >0 · accent = unmetered e2e', 'lbls')}
${txt(1098, 196, `PIPES — turbo run build graph: ${BUILD.real} real of ${BUILD.nodes} nodes, last green 08-17`, 'lbls')}
${txt(1098, 211, `steam window ${WINDOW} — ${PLATE.ref} @ ${PLATE.sha}`, 'lblf')}`;

// ---- alert register ---------------------------------------------------------------
const AR = `
<rect x="40" y="668" width="600" height="126" class="sk fp"/>
<polygon points="76,690 62,716 90,716" class="sks fnone"/>
<line x1="58" y1="720" x2="94" y2="686" class="sks"/>
${txt(108, 696, 'ALERT REGISTER — THE ALARM IS ANSWERED; THE REGISTER STAYS', 'lbls')}
${txt(108, 714, 'rev B rang one alarm: //#lint:root, oxlint, 16 errors, every one inside', 'lblf')}
${txt(108, 728, 'diagrams/generator/ — the atlas’s OWN drawings broke the lint line.', 'lblf')}
${txt(108, 742, 'commit ffd4ef7 oxlint-cleaned the generator. the yard lints clean at HEAD;', 'lblf')}
${txt(108, 756, 'no gate is red, member-owned or otherwise. the triangle is struck, not erased.', 'lbls')}
${txt(108, 776, `re-run 2026-08-31 · oxlint over diagrams/generator, exit 0 · build graph ${BUILD.real} real`, 'lblf')}`;

// ---- schedule --------------------------------------------------------------------
const ART_H = 812;
const RUST_T = ['0', 'R1', 'R2', 'R3', 'R4'];
const schedRow = ([n, name, , , , , sf, , , , rust, steam, lamps, eff]) => {
  if (!sf) return `${String(n).padStart(2, ' ')}  ${name} — ambient types · no machine on the pad`;
  const lampS = lamps === 'e' ? 'e2e (accent)' : lamps == null ? 'no mass — no slots'
    : eff != null ? `${lamps} (${eff}%)` : `${lamps}`;
  return `${String(n).padStart(2, ' ')}  ${name} — rust ${RUST_T[rust]} · steam ${steam}c/90d = ${PUFFS(steam)} puff${PUFFS(steam) === 1 ? '' : 's'} · lamps ${lampS} · pipes OK`;
};
const RUNNING = M.filter((r) => r[6]).length;
const TOT_STEAM = M.reduce((a, r) => a + r[11], 0);
const METERED = M.filter((r) => typeof r[12] === 'number' && r[12] > 0).length;
const ACCENT = M.filter((r) => r[12] === 'e').length;
const half = Math.ceil(M.length / 2);
const SY = ART_H + 16;
const schedule = `<rect x="40" y="${SY}" width="1480" height="${74 + half * 17}" class="sk fp"/>
${txt(58, SY + 22, `PLANT SCHEDULE — per member: rust step (median idle) · steam (commits ${WINDOW} = puffs) · lamps (lit share from plate 7A) · pipe state`, 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1520" y2="${SY + 32}" class="skf"/>
${M.slice(0, half).map((r, i) => txt(58, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${M.slice(half).map((r, i) => txt(800, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${txt(58, SY + 58 + half * 17, `TOTAL — ${RUNNING} plants running, 0 seized · steam ${TOT_STEAM} member-touches from ${PLATE.windowCommits} window commits (${WINDOW}) · ${METERED} metered-lamp plants + ${ACCENT} accent · steam ${BASIS}; rust and lamps carry their own older bases`, 'lbls')}`;

const svg = `<svg viewBox="0 0 1560 ${SY + 104 + half * 17}" role="img" aria-label="Sheet 7's isometric census city redrawn as a working industrial plant, every workspace member a machine on the line. Massing is unchanged — footprint proportional to the square root of source lines, height three pixels per authored file, the same four dashed districts. Each machine now broadcasts its state the way a Factorio building does: red rust speckle on the flanks where a member has gone untouched, growing from clean through four re-cut steps to the typedoc plugin, whose flanks are almost fully rusted and cracked; steam puffs rising from roof vents where commits touched the member in the last ninety days, five accent puffs over lit-ui-router, sample-app-shared, the Cypress host, docs and the release tool; up to three green module lamps low on each front face showing how much of the member its own test suite lights, read straight from plate 7A's own filed snapshot, with accent lamps on the sample apps whose only light is the unmetered end-to-end rig; and outlet pipes that all connect, because the build graph's twenty-two real tasks last ran green. No alert triangle stands over the city at all: the alert register records that rev B's one red gate — the root lint task, failing over the atlas's own generator directory — was answered by a commit that cleaned the drawings, and the triangle is drawn struck through rather than deleted. A plant schedule lists every member's channel values.">
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
${txt(772, 135, `the fifth package joins at R0 and is metered now — ${g(31).lamps} lamps (${g(31).eff}% lit)`, 'lblf')}
<line x1="766" y1="126" x2="742" y2="168" class="skf"/>

${txt(1540, 388, 'apps/ — THE PROVING GROUND', 'lblb', 'end')}
${txt(1540, 401, `${dsteam('app')} commits/90d · accent lamps: real e2e light,`, 'lblf', 'end')}
${txt(1540, 413, 'no meter reads it · vanilla + mobx rust at R3', 'lblf', 'end')}
<line x1="1284" y1="416" x2="1248" y2="446" class="skf"/>

${txt(1014, 668, 'docs/ + examples/ — THE SHOPFRONT', 'lblb')}
${txt(1014, 681, `docs: ${PUFFS(g(10).steam)} puffs (${g(10).steam}c), 1 lamp — top steam band, dimmest metered light`, 'lblf')}
${txt(1014, 693, `examples: ${PUFFS(g(11).steam)} puffs (${g(11).steam}c), 0 lamps, R1 rust — steaming, unlit, freshly worked`, 'lblf')}
<line x1="1008" y1="664" x2="986" y2="640" class="skf"/>

${txt(60, 560, 'tools/ — THE INSTRUMENT YARD', 'lblb')}
${txt(60, 573, `${dsteam('tool')} commits/90d across 19 machines · pipes all green`, 'lblf')}
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
  num: '7B', id: 'working', rev: 'E',
  title: 'THE WORKING CITY',
  sub: `ALTITUDE 3½ — SYNTHESIS PLATE TO SHEET 7: the census city as a working plant · weathering (13) × test light (7A) × gates (7) × live build, one sprite per member · re-surveyed 2026-08-31 · REV B: hidden-line pass — opaque plant walls painted back to front, and the pipes now stop inside the annex gap · REV C 2026-08-31: 30 plants (three new machines), rust ladder RE-CUT on the fresh idle distribution — an R2 here is not rev B’s R2 — and rev B’s one alarm struck through: //#lint:root is answered · steam now IMPORTED from diagrams/data/census-steam.json (window ${WINDOW} · ${BASIS}) and the massing from sheet 7’s own plate, so the fifth package joins the city as №31 · REV D: whole-cabinet refresh — the PIPES channel now reads the build graph off census-plate.json (${BUILD.real} real of ${BUILD.nodes} nodes) instead of a hand-pasted 22 of 113 · REV E: the LAMPS channel is imported too — plate 7A's light is a filed snapshot now (census-shadow.json, ${SHADOW.ref} @ ${SHADOW.sha}), so rust is the last editorial channel on this sheet and №31 finally reads a lamp`,
  scale: 'WHOLE WORKSPACE',
  form: 'WORKING CITY',
  svg,
  caption: 'Sheet 7 counted the city, sheet 13 dated its stone, plate 7A metered its test light. This plate turns the same city on: every member becomes a Working Plant sprite in the Factorio sense — a machine whose state is broadcast, not implied. Rust speckle for idleness, steam for the last ninety days of commits, module lamps for test light, pipes for the build. The channels are independent on purpose, and the city proves they must be: the flagship runs at full steam under every lamp while wearing rust, and the most-rusted machine in the yard is still quietly steaming. Rev B’s one alarm rang over no plant at all — it rang over the drawings; rev C draws it struck through, because it was answered.',
  notes: `
<p><strong>The sprite decorates; the census still governs.</strong> Every block is sheet 7 rev D's, unchanged: footprint 1.6·√sloc, height 3 px per authored file, spec annexes beside their buildings, gate severity in the same colours with the same uniform hatch including the cap. The Working Plant sprite (concept 3 of the sprite studies) adds four state channels as overlays. The design guard from the study is enforced: rust is a dotted <em>speckle</em> at partial opacity on the flanks only — never the cap, never a 45° line hatch — so a red-gated pristine plant (uniform hatch, cap included) and a rusting never-gating plant cannot be confused, in either theme.</p>
<p><strong>Every channel is measured, and every threshold comes from a distribution.</strong> RUST is the weathering census (sheet 13): median days since last touch per member, five steps cut where the idle histogram actually cuts — re-cut at rev C, see below. The top step is still the empty gap nothing occupies (now 61–180 days), so R4 means genuinely sealed, and only the typedoc plugin wears it. STEAM is distinct commits touching the member in a trailing 90-day window, now read from the checked-in plate <code>diagrams/data/census-steam.json</code> — window ${WINDOW}, ${BASIS}. The band edges are rev C's and are kept: 0 puffs ≤2 · 1: 3–8 · 2: 9–15 · 3: ≥16. What no longer holds is the claim that those edges sit in empty air — 3, 9 and 16 are all occupied on this window, so the bands are stated here as editorial, not as gaps. Five plants steam at three puffs where rev B drew three: <code>lit-ui-router</code> (${g(1).steam}), <code>sample-app-shared</code> (${g(5).steam}), <code>docs</code> (${g(10).steam}), <code>@tools/release</code> (${g(12).steam}) and <code>sample-app-lit-e2e</code> (${g(9).steam}). LAMPS compress plate 7A's meter to one number, lit share = extent × line coverage — and at rev E that number is <em>read</em> from plate 7A's own snapshot, <code>diagrams/data/census-shadow.json</code>, metered at ${SHADOW.ref} @ ${SHADOW.sha}, rather than transcribed off a printed sheet: three lamps at ${'≥'}90, two at ${'≥'}50, one above zero, and the accent lamp is 7A's honest category for light no meter reads. PIPES are the <code>turbo run build</code> graph, read at rev D from <code>diagrams/data/census-plate.json</code>: ${BUILD.real} real tasks in ${BUILD.nodes} nodes, last run green on 2026-08-17 (all cache hits — a replay of green, stated as such), so every pipe on the sheet connects and the key says so rather than inventing a broken one.</p>
<p><strong>REV E — the lamps stop being a transcription, and one of them was never out.</strong> Plate 7A's light was the last figure on this sheet that still travelled by clipboard: a column of lit-share percentages typed off a printed plate whose own metering dated from 2026-08-17, while every channel around it had moved to a filed snapshot. 7A's metering is a scripted probe now, so the lamps are <em>read</em> from its plate — <code>diagrams/data/census-shadow.json</code>, ${SHADOW.ref} @ ${SHADOW.sha} — and a plant this sheet draws that the light plate does not carry is a build error rather than an empty slot. Seven plants change: №31 <code>eslint-plugin-lit-ui-router</code> reads ${g(31).lamps} lamps at ${g(31).eff}% where rev D had no slots to read at all, №29 <code>@tools/warn-lanes</code> turns out to have a meter after all and lights ${g(29).lamps} at ${g(29).eff}% rather than the accent lamp rev D gave it, №20 <code>@tools/oxc-emit</code> lights its first (${g(20).eff}%), and №1, №12, №15 and №16 all move a little now that light and mass are counted at one ref. The largest of those is the one worth naming: <code>@tools/build_and_test</code> goes from one lamp to ${g(15).lamps} at ${g(15).eff}%, because rev D's "lamp that went out" was an artefact of dividing an August meter by an end-of-month census, not a suite that stopped covering. RUST is now the only editorial constant on this sheet.</p>
<p><strong>REV D — the last hand-pasted channel, and one contradiction closed.</strong> The whole plate cabinet was re-counted at ${PLATE.ref} @ ${PLATE.sha} in one pass, which caught the PIPES channel disagreeing with the atlas about its own subject: this plate said the <code>turbo run build</code> graph was 22 real tasks in 113 nodes while <code>census-plate.json</code>, drawn by sheets 3, 3A and 12, said ${BUILD.real} in ${BUILD.nodes}. PIPES now reads that plate, so the four sheets share one graph. STEAM moved with the window — ${PLATE.windowCommits} window commits against rev C's 358 — and the band edges hold: the same five plants steam at three puffs, and nothing crossed a band. RUST and LAMPS are unchanged and stay what they have always been on this plate: editorial constants keyed by badge, rust from sheet 13's weathering census and lamps from plate 7A's 2026-08-17 metering, neither re-run here.</p>
<p><strong>The channels disagree, which is the point.</strong> A single wreck-to-splendor axis would have to average these stories away: <code>lit-ui-router</code> is the oldest masonry in the city <em>and</em> its hottest steam <em>and</em> fully lamped — old and running. The typedoc plugin is the only R4 rust on the sheet, cracked flanks and all, yet still emits a puff, because <code>index.ts</code> takes commits while <code>symbols/</code> sleeps its 234 days. <code>examples</code> steams at two puffs with zero lamps and only R1 rust — worked on, untested, and no longer aging — and <code>docs</code> pairs the city's third-hottest steam with its dimmest metered light (7.7% lit). The disagreement rev D drew sharpest here — <code>@tools/build_and_test</code> steaming while its lamp went <em>out</em> — turned out not to be one, and rev E says so: that reading divided a 2026-08-17 lit figure by a 2026-08-31 denominator, and re-metering finds the error summary lit like the rest of the cores, ${g(15).eff}% and two lamps. Work and light do move independently — <code>examples</code> and <code>docs</code> still prove it — but this particular plant was never dark. <code>@tools/happy-dom</code> keeps plate 7A's strangest fact: a plant with its own spec annex and no lamp lit, because the spec is a canary pointed upstream.</p>
<p><strong>The one alarm rev B drew has been answered — and the register keeps the record.</strong> Rev B's alert channel found exactly one red gate at HEAD: <code>//#lint:root</code>, oxlint failing with 16 errors, every one of them inside <code>diagrams/generator/</code>. The atlas had broken its own lint line drawing itself, and the triangle hung over the drafting office rather than over any plant. Commit <code>ffd4ef7</code> — "answer plate 7B's alarm: oxlint-clean the atlas generator" — fixed exactly that, and oxlint over <code>diagrams/generator</code> exits 0 at HEAD. So rev C strikes the triangle through instead of deleting it: an answered alarm is a record, and this is the third time the set has moved its own subject, after the lodash swap on sheet 8 and the lit dedupe on sheet 10.</p>
<p><strong>REV C — the ladder was re-cut, so read the labels afresh.</strong> Two more weeks of clock pushed nine members' median idle into a 42–58-day band that rev B's ladder had no step for: its steps were cut at the 2026-08-17 histogram's gaps (R3 ≤41, R4 &gt;180 because nothing sat between 60 and 180). The plate's stated method is "thresholds cut at the distributions' own gaps", so honouring the method meant new numbers rather than forcing old ones: rev C cuts at 0 ≤14 · R1 ≤30 · R2 ≤37 · R3 ≤58 · R4 &gt;180, where 14 and 30 are histogram walls, 37 is the median idle and 58 is the top of the occupied band. <strong>A step label therefore does not mean the same thing across revs — rev B's R2 is not rev C's R2</strong>, and the ladder shape is preserved (№13 remains the sole cracked R4) rather than the ladder's numbers. Three members are drawn here for the first time: <code>@tools/lint-elements</code> and <code>@tools/warn-lanes</code> (born 2026-08-31, #639) and <code>@tools/eslint-ts-parser</code> (born 2026-08-16, #557) — the "28th member on no map" rev B recorded in its own total, now placed. All three are still the cleanest machines in the yard for rust — none above R1 — though <code>lint-elements</code> has since lit its first puff (${g(28).steam} commits). The steam total (${TOT_STEAM} member-touches from ${PLATE.windowCommits} window commits) double-counts commits that touch several members, as any per-member count must; the window commit count is given so the two are never confused.</p>
<p><strong>Steam by import, and the city by sheet 7's own table.</strong> The steam channel is no longer a hand-pasted column: every count is looked up by member directory in <code>diagrams/data/census-steam.json</code> (${BASIS}), and a member this plate draws that the plate does not carry is a build error rather than a stale number. Massing follows the same rule one plate over — placements, districts and gate tiers are <em>imported</em> from sheet 7's own placement table and the counts from <code>diagrams/data/census-city.json</code>, so the two sheets cannot drift building for building. That import is what brings <code>eslint-plugin-lit-ui-router</code> onto this sheet as №31, in the packages district beside the mobx companion: ${g(31).steam} commits in the window, R0 rust (born 2026-09-01), and no lamp slots at all, because plate 7A's meter was taken on 2026-08-17 and predates it — an unmetered plant, not a dark one. The other two channels still carry their older bases: rust is sheet 13's weathering census and lamps are plate 7A's 2026-08-17 metering, both labelled as such wherever they are printed.</p>`,
  key: [
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp"/>', 'a member, massed by sheet 7’s census — unchanged'),
    keyRow(`<rect x="6" y="3" width="36" height="12" class="sk fp"/><rect x="6" y="3" width="36" height="12" fill="url(#${P}-rust)" opacity="0.5"/>`, 'rust speckle (flanks only) — median idle days, 5 steps'),
    keyRow('<path d="M8,15 L12,10 L10,4" class="skr" fill="none"/><path d="M20,15 L23,11 L21,5" class="skr" fill="none"/>', 'cracks — R4 only: idle past the 180-day gap'),
    keyRow('<ellipse cx="12" cy="12" rx="4" ry="2.5" class="sks fnone"/><ellipse cx="16" cy="7" rx="6" ry="3" class="sks fnone" opacity="0.6"/>', 'steam — 0–3 puffs = commits trailing 90 days'),
    keyRow('<ellipse cx="12" cy="12" rx="4" ry="2.5" class="ska fnone"/><ellipse cx="16" cy="7" rx="6" ry="3" class="ska fnone" opacity="0.6"/>', 'accent plume — top steam band (≥16 commits)'),
    keyRow('<rect x="8" y="6" width="5" height="5" class="skg fg"/><rect x="16" y="6" width="5" height="5" class="skg fg"/><rect x="24" y="6" width="5" height="5" class="sks fnone"/>', 'module lamps — lit share of plate 7A’s test light'),
    keyRow('<rect x="8" y="6" width="5" height="5" class="ska fa"/><rect x="16" y="6" width="5" height="5" class="sks fnone"/><rect x="24" y="6" width="5" height="5" class="sks fnone"/>', 'accent lamp — e2e light, real but unmetered'),
    keyRow('<path d="M4,9 L30,9 L30,16" class="sks" fill="none"/><circle cx="4" cy="9" r="2" class="sks fp2"/>', `pipe, connected — the build graph\u2019s ${BUILD.real} real tasks, last green`),
    keyRow('<polygon points="24,2 17,15 31,15" class="sks fnone"/><line x1="14" y1="17" x2="34" y2="1" class="sks"/>', 'alert, struck — rev B’s one red gate, answered by ffd4ef7'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="fr"/><rect x="6" y="3" width="36" height="12" class="skr fnone"/>', 'gate severity — sheet 7’s, uniform hatch incl. cap'),
  ].join('\n'),
};

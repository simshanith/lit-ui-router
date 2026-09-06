// APPENDIX A1 — THE SPRITE STUDY.
//
// META: this plate's subject is the ATLAS, not the codebase. Every other sheet
// measures lit-ui-router; this one records the design research behind the
// building sprites the set draws — the HZD × SC2K × Factorio direction pinned
// in INITIATIVES.md, worked as three concepts and one recommendation. It
// therefore carries NO census plate and NO measured number: the only figures
// on it are the demo member's massing (16 files · 1,900 sloc), which is drawn
// under the house rules — footprint 1.6·√sloc ≈ 70, height 3 px/file = 48 —
// so the studies are argued on a block the city could actually contain.
//
// The three ladders and their channel tables are re-drawn from the sprite
// studies artifact; the artifact's reference strip (six fair-use game
// screenshots) is NOT re-drawn — the atlas is hand-authored SVG with no
// images — and survives here as the citation list in the notes.
import { defs } from './chrome.mjs';
import { txt, lines, box, keyRow } from './helpers.mjs';

const P = 'sA1';

// ---- house massing for the demo member --------------------------------------
// 16 files · 1,900 sloc under the city rules: side = 1.6·√1900 = 69.7 ≈ 70 plan
// units, height = 3 px × 16 files = 48. The projection is the atlas's own
// (0.866 / 0.5), so a study block and a sheet-7 building are the same solid.
const D = 60.6, DY = 35, H = 48;
const SIDE = 70;

// Screen point, relative to the block's GROUND FRONT vertex, for a plan point
// at height z. Plan (0,0) is the back corner, (SIDE,SIDE) the front one.
const p3 = (px, py, pz) => [(px - py) * 0.866, (px + py) * 0.5 - pz - SIDE];
// A point on the right (south-east) flank: u along the ground edge, v up it.
const rf = (u, v) => [D * u, -DY * u - v];
// A point on the left (south-west) flank.
const lf = (u, v) => [-D * u, -DY * u - v];

const pts = (a) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
// THE HOUSE FILL IDIOM. Every drawing class (.sk, .skf, .sks, .skr …) declares
// `fill: none`, and a CSS declaration always beats a presentation attribute —
// so `class="sk" fill="url(#…)"` draws nothing. A filled shape is therefore two
// elements, exactly as sheet 13 stacks them: the fill, then the stroke.
const poly = (a, cls, fill = '') =>
  (fill ? `<polygon points="${pts(a)}" fill="${fill}"/>` : '')
  + (fill && !cls ? '' : `<polygon points="${pts(a)}" class="${fill ? `${cls} fnone` : cls}"/>`);
const line = (a, b, cls, extra = '') =>
  `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" class="${cls}"${extra ? ` ${extra}` : ''}/>`;
const path = (a, cls, extra = '') =>
  `<path d="M${a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')}" class="${cls}" fill="none"${extra ? ` ${extra}` : ''}/>`;
const circ = (a, r, cls, extra = '') =>
  `<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="${r}" class="${cls}"${extra ? ` ${extra}` : ''}/>`;
const ell = (a, rx, ry, cls, extra = '') =>
  `<ellipse cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" rx="${rx}" ry="${ry}" class="${cls}"${extra ? ` ${extra}` : ''}/>`;

const FACE_L = [[-D, -DY - H], [0, -H], [0, 0], [-D, -DY]];
const FACE_R = [[D, -DY - H], [0, -H], [0, 0], [D, -DY]];
const CAP = [[0, -SIDE - H], [D, -DY - H], [0, -H], [-D, -DY - H]];
// The breached parapet: a fixed 8-point template, the wreck state's one
// silhouette change — the block's MASS is untouched, only its skyline.
const CAP_BREACHED = [
  [0, -118], [60.6, -83], [27.3, -63.7], [14.5, -62.2],
  [8.5, -51.5], [-10.9, -61.1], [-27.3, -63.7], [-60.6, -83],
];

/** The honest block: two flanks and a cap. Every study draws exactly this. */
const shell = (cap = CAP, capFill = 'fp') => [
  poly(FACE_L, 'sk', 'var(--paper-2)'),
  poly(FACE_R, 'sk', `url(#${P}-hx)`),
  poly(cap, `sk ${capFill}`),
].join('\n');

const at = (x, y, body) => `<g transform="translate(${x},${y})">${body}</g>`;

// Deterministic across rebuilds: the vines are seeded polylines, never random.
const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);

// ---- STUDY 1 · THE RECLAIMED MACHINE ----------------------------------------
// Overgrowth is time. The machine underneath is the member, and it never moves.
function vine(base, climb, r) {
  const [bx, by] = base;
  const steps = 6;
  const pointsOf = [];
  for (let i = 0; i <= steps; i += 1) {
    pointsOf.push([bx + (r() - 0.5) * 9, by - (climb * i) / steps]);
  }
  const leaves = [pointsOf[2], pointsOf[4], pointsOf[6]]
    .map((pt) => circ(pt, 1.6, 'fg', 'opacity="0.7"'))
    .join('');
  return path(pointsOf, 'skg', 'opacity="0.85"') + leaves;
}

function study1(state) {
  const VINES = [16, 9, 4, 1, 0][state];
  const r = rng(1000 + state * 17);
  const breached = state === 0;
  const moss = state <= 1;
  const flag = state >= 3;
  const live = state === 4;

  const growth = [];
  for (let i = 0; i < VINES; i += 1) {
    const u = 0.14 + (0.78 * (i + 0.5)) / Math.max(VINES, 1);
    const climb = H * (state === 0 ? 0.72 + r() * 0.26 : 0.48 + r() * 0.44);
    growth.push(vine(i % 2 === 0 ? rf(u, 0) : lf(u, 0), climb, r));
  }
  return [
    live ? ell([0, 0], 72.6, 16, 'fhalo') : '',
    shell(breached ? CAP_BREACHED : CAP, breached ? 'fp2' : 'fp'),
    // the live trace lies ON the roof edge; drawn before the shell it is buried
    live ? path([[-D, -DY - H], [0, -H], [D, -DY - H]], 'ska', 'opacity="0.9"') : '',
    moss
      ? [[51.5, -77.7], [36.4, -69], [17, -57.8]]
          .slice(0, state === 0 ? 3 : 2)
          .map((pt) => ell(pt, 7, 3.2, 'fg', 'opacity="0.5"'))
          .join('')
      : '',
    growth.join('\n'),
    breached
      ? poly([[8.7, -1], [13, 5.5], [1.7, 7], [-0.9, 1.5]], 'sks', `url(#${P}-hd)`)
        + poly([[-7.8, 0.5], [-5.2, 6], [-13, 5.5]], 'sks fp2')
      : '',
    flag
      ? line([0, -112], [0, -128], 'sks') + poly([[0, -128], [0, -123], [8.7, -120.5]], 'fa')
      : '',
  ].join('\n');
}

// ---- STUDY 2 · THE LEDGER ROOF ----------------------------------------------
// The roof is the census: one tile per authored file, so the tile count and the
// block's height (3 px per file) can never disagree.
const TILE = SIDE / 4;
// A fixed scramble, so decay is read tile by tile rather than as a gradient.
const TILE_RANK = [5, 12, 0, 9, 14, 2, 7, 11, 3, 15, 6, 1, 10, 4, 13, 8];
// counts per condition [crisp, plain, cracked, dark, collapsed] — the ledger
const LEDGER = [
  [0, 1, 3, 6, 6],
  [1, 3, 5, 5, 2],
  [3, 6, 5, 2, 0],
  [8, 6, 2, 0, 0],
  [13, 3, 0, 0, 0],
];

function tiles(state) {
  const bands = [];
  LEDGER[state].forEach((n, cond) => { for (let i = 0; i < n; i += 1) bands.push(cond); });
  const out = [];
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      const cond = bands[TILE_RANK[i * 4 + j]];
      const a = i * TILE, b = j * TILE;
      const quad = [p3(a, b, H), p3(a + TILE, b, H), p3(a + TILE, b + TILE, H), p3(a, b + TILE, H)];
      const fill = [
        'var(--paper)', 'var(--paper-2)', 'var(--paper-2)',
        `url(#${P}-hd)`, 'var(--ink-soft)',
      ][cond];
      out.push(poly(quad, 'skf', fill) + (cond === 4 ? '' : ''));
      if (cond === 2) out.push(line(quad[0], quad[2], 'sks', 'stroke-dasharray="2 2"'));
      if (cond === 4) out.push(poly(quad, 'sks fnone'));
    }
  }
  return out.join('\n');
}

/** A small iso box standing ON the cap — roof furniture, in the same projection. */
function roofBox(px, py, w, h, cls = 'sk fp2') {
  const z0 = H, z1 = H + h;
  return [
    poly([p3(px, py + w, z1), p3(px + w, py + w, z1), p3(px + w, py + w, z0), p3(px, py + w, z0)], cls),
    poly([p3(px + w, py, z1), p3(px + w, py + w, z1), p3(px + w, py + w, z0), p3(px + w, py, z0)], cls),
    poly([p3(px, py, z1), p3(px + w, py, z1), p3(px + w, py + w, z1), p3(px, py + w, z1)], cls),
  ].join('');
}

function study2(state) {
  const dark = [0.3, 0.16, 0, 0, 0][state];
  const boarded = state === 0;
  const crane = state === 3;
  const prime = state === 4;
  const door = [rf(0.15, 20), rf(0.42, 20), rf(0.42, 0), rf(0.15, 0)];
  return [
    shell(),
    tiles(state),
    dark > 0
      ? `<g opacity="${dark}">${poly(FACE_L, '', 'var(--ink)')}${poly(FACE_R, '', 'var(--ink)')}${poly(CAP, '', 'var(--ink)')}</g>`
      : '',
    // the door: open on a working block, boarded on an abandoned one — drawn
    // AFTER the wash, so the boards stay legible through the darkening
    poly(door, boarded ? 'sks' : 'sk', 'var(--paper-2)'),
    boarded
      ? line(rf(0.13, 16), rf(0.44, 6), 'sks') + line(rf(0.13, 6), rf(0.44, 16), 'sks')
      : '',
    crane
      ? [
          line(p3(30, 18, H), p3(30, 18, H + 44), 'ska'),
          line(p3(30, 18, H + 44), p3(66, 18, H + 44), 'ska'),
          line(p3(58, 18, H + 44), p3(58, 18, H + 20), 'ska', 'stroke-dasharray="3 3"'),
          poly([p3(56, 16, H + 20), p3(60, 16, H + 20), p3(60, 20, H + 18)], 'fa'),
        ].join('')
      : '',
    prime
      ? [
          roofBox(8, 8, 11, 7),
          roofBox(8, 30, 11, 7),
          // water tower: four legs and a drum
          line(p3(44, 12, H), p3(44, 12, H + 20), 'sks'),
          line(p3(58, 12, H), p3(58, 12, H + 20), 'sks'),
          line(p3(44, 26, H), p3(44, 26, H + 20), 'sks'),
          line(p3(58, 26, H), p3(58, 26, H + 20), 'sks'),
          roofBox(44, 12, 14, 11).replace(/class="sk fp2"/g, 'class="sk fp"'),
          // antenna: the published entry point
          line(p3(30, 52, H), p3(30, 52, H + 26), 'ska'),
          circ(p3(30, 52, H + 26), 2.4, 'fa'),
        ].join('')
      : '',
  ].join('\n');
}

// ---- STUDY 3 · THE WORKING PLANT --------------------------------------------
// Four INDEPENDENT channels, so "old AND running" is drawable — which a single
// wreck-to-splendor axis cannot say, and which is the true state of stable code.
function study3(state) {
  const rust = [0.85, 0.6, 0.3, 0.12, 0][state];
  const puffs = [0, 0, 0, 2, 3][state];
  const lamps = [0, 0, 1, 2, 3][state];
  const connected = state >= 2;
  const alert = state === 0;
  const halo = state === 4;
  const pipe = (v) => {
    const a = rf(0.86, v);
    const b = [a[0] + 34, a[1] - 6];
    return connected
      ? line(a, b, 'sk') + circ(b, 3.2, 'sk fp')
      : line(a, b, 'sks', 'stroke-dasharray="4 3"')
        + ell([b[0], b[1] + 9], 2.4, 3.4, 'fr', 'opacity="0.65"');
  };
  const lamp = (i) => {
    const u = 0.2 + i * 0.13;
    const q = [rf(u, 12), rf(u + 0.09, 12), rf(u + 0.09, 5), rf(u, 5)];
    return poly(q, i < lamps ? 'skg' : 'skf', i < lamps ? 'var(--green)' : 'var(--paper-2)');
  };
  return [
    halo ? ell([0, 0], 72.6, 16, 'fhalo') : '',
    shell(),
    rust > 0
      ? `<g opacity="${rust}">${poly(FACE_L, '', `url(#${P}-hr)`)}${poly(FACE_R, '', `url(#${P}-hr)`)}</g>`
      : '',
    state <= 1
      ? path([rf(0.25, 4), rf(0.34, 16), rf(0.28, 26), rf(0.38, 38)], 'skr', 'opacity="0.8"')
        + path([lf(0.55, 6), lf(0.48, 18), lf(0.6, 30)], 'skr', 'opacity="0.7"')
      : '',
    // the belt stub: sheet 7's roads already give every member its conveyors
    poly([lf(0.62, 0), lf(0.86, 0), [lf(0.86, 0)[0] - 4, lf(0.86, 0)[1] + 7], [lf(0.62, 0)[0] - 4, lf(0.62, 0)[1] + 7]], connected ? 'sk fp2' : 'sks fp2'),
    connected
      ? [0.68, 0.78].map((u) => path([[lf(u, 0)[0], lf(u, 0)[1] + 1], [lf(u, 0)[0] - 3.4, lf(u, 0)[1] + 3.5], [lf(u, 0)[0], lf(u, 0)[1] + 6]], 'sks')).join('')
      : line([lf(0.66, 0)[0] - 5, lf(0.66, 0)[1] - 2], [lf(0.82, 0)[0] + 1, lf(0.82, 0)[1] + 9], 'skr'),
    pipe(14), pipe(27),
    [0, 1, 2].map(lamp).join(''),
    // the vent, and the plume that says the machine is being worked
    roofBox(44, 20, 9, 5),
    puffs > 0
      ? Array.from({ length: puffs }, (_, i) => {
          const base = p3(48.5, 24.5, H + 5);
          return ell([base[0] + i * 5, base[1] - 11 - i * 12], 5 + i * 1.8, 3.4 + i * 1.2,
            i === puffs - 1 && state === 4 ? 'ska fnone' : 'sks fnone');
        }).join('')
      : '',
    alert
      ? poly([[0, -152], [11, -134], [-11, -134]], 'skr', 'var(--paper)')
        + txt(0, -137, '!', 'lblr', 'middle')
      : '',
  ].join('\n');
}

// ---- the three studies, as data ---------------------------------------------
const STUDIES = [
  {
    n: 1,
    name: 'THE RECLAIMED MACHINE',
    lean: 'HZD-LEANING',
    line: 'overgrowth is time; the machine underneath is the member',
    draw: study1,
    ladder: ['RECLAIMED', 'OVERGROWN', 'CREEPING', 'TENDED', 'HUMMING'],
    sub: ['parapet breached · rubble', 'thinning vines · moss', 'four creepers left', 'one creeper · survey flag', 'halo + live trace + flag'],
    channels: [
      ['overgrowth coverage — vine count × climb height', 'months since the last commit touching the member · 0% at ≤1 mo → 95% at ≥24 mo'],
      ['broken parapet + rubble', 'net-deleted mass, files removed vs added over 12 mo · intact → breached below 0.6'],
      ['moss on the roof line', 'staleness crossing the district’s churn median · binary, only past state 2'],
      ['accent roof trace + ground halo', 'commits in the last 90 days — the machine still hums · top decile of the city only'],
      ['survey flag', 'touched by the most recent release · binary'],
    ],
    cost: 'CHEAP AT SPLENDOR, DEAREST AT DECAY — 8–14 short paths plus a few circles per wrecked building, near zero at splendor; +2–6 KB of raw SVG per weathered building. Vines are seeded polylines, deterministic across rebuilds; at the census floor they degrade to one or two strokes and still read as green-equals-stale.',
  },
  {
    n: 2,
    name: 'THE LEDGER ROOF',
    lean: 'SC2K-LEANING',
    line: 'the roof is a ledger — one tile per authored file, on the census that already sets the height',
    draw: study2,
    ladder: ['ABANDONED', 'DECAYING', 'AGING', 'RENOVATING', 'PRIME'],
    sub: ['12/16 tiles gone · boarded', 'dark wash · 7 tiles gone', 'no wash · 2 dark', 'crane — renovation, not ruin', 'AC · water tower · antenna'],
    channels: [
      ['roof tile condition — crisp → plain → cracked → dark → collapsed', 'per-file age since its last commit · 5 steps, quantile-bucketed per district'],
      ['whole-shell dark wash — SC2K abandonment', 'share of tiles at dark or collapsed · >50% light · >80% heavy + boarded door'],
      ['rooftop AC cubes', 'files with spec coverage in the annex · one cube per covered quartile'],
      ['water tower + antenna', 'member has a docs page · member has a published entry point · binary each, splendor only'],
      ['accent crane + scaffold hook', 'files added or renamed in the last 30 days · binary — RENOVATION, not ruin'],
    ],
    cost: 'DEAREST OF THE THREE, AND THE ONLY ONE NEEDING A NEW PROBE — tile count equals file count, so sheet 7’s city would gain a few hundred elements (+15–30 KB per city sheet) and a per-FILE age census the cabinet does not hold. A one-file tool degenerates to a single-tile roof, which still reads: the whole roof darkens when the file is old.',
  },
  {
    n: 3,
    name: 'THE WORKING PLANT',
    lean: 'FACTORIO-LEANING',
    line: 'every member is a machine; state is broadcast, never implied',
    draw: study3,
    ladder: ['SEIZED', 'RUSTING', 'IDLING', 'RUNNING', 'HUMMING'],
    sub: ['pipes dripping · belt stopped · alert', 'heavy rust · still stopped', 'clean, no plume', 'plume · two lamps', 'accent plume · three lamps · halo'],
    channels: [
      ['rust hatch density + cracks', 'age of the median line (git blame) × absence of commits · 0–85% overlay, 5 steps'],
      ['steam plume — 0–3 puffs, accent at the top', 'commits touching the member, trailing 90 days · quartiles within the city'],
      ['module lamps — 0–3 lit green', 'spec-annex coverage ratio, annex sloc / src sloc · terciles, 0 = no annex'],
      ['pipes connected vs dashed + drip', 'the build currently succeeds for this member · binary, from turbo at HEAD'],
      ['alert triangle', 'a gate this member owns is red at HEAD · binary — borrowed straight from Factorio alerts'],
    ],
    cost: 'CHEAPEST — every decoration is a fixed micro-template (pipe = two paths and a circle, lamp = one quad, plume = at most three ellipses, alert = a polygon and one glyph) positioned by the same plan-to-screen helper; +1–3 KB per building and near-zero new defs, since the red hatch and the arrow markers already exist.',
  },
];

// ---- layout -----------------------------------------------------------------
const X0 = 128, PITCH = 206;
const cx = (i) => X0 + i * PITCH;
const SX = 1054, SW = 466;      // the channel schedule column
const BT = [104, 406, 708];     // band tops
const BASE = (b) => BT[b] + 200; // the ground front vertex of that band's blocks

function band(s, b) {
  const top = BT[b];
  const base = BASE(b);
  const blocks = s.ladder.map((_, i) => at(cx(i), base, s.draw(i))).join('\n');
  const names = s.ladder.map((name, i) => txt(cx(i), top + 224, name, 'lblb', 'middle')).join('\n');
  const subs = s.sub.map((t, i) => txt(cx(i), top + 238, t, 'lblf', 'middle')).join('\n');
  const chans = s.channels.map(([what, how], i) => [
    txt(SX + 14, top + 88 + i * 27, what, 'lbl'),
    txt(SX + 14, top + 100 + i * 27, how, 'lblf'),
  ].join('\n')).join('\n');
  return `<g>
${box(60, top, 640, 40, 'skf fnone')}
${txt(76, top + 17, `STUDY ${s.n} / 3 — ${s.name}`, 'lbls')}
${txt(76, top + 31, `${s.lean} · ${s.line}`, 'lblf')}
${blocks}
${names}
${subs}
<path d="M60,${top + 258} L1012,${top + 258}" class="sks" marker-end="url(#${P}-ai)"/>
${txt(60, top + 274, 'WRECK & RUIN', 'lbls')}
${txt(1012, top + 274, 'SHINE & SPLENDOR', 'lbls', 'end')}
${box(SX, top + 50, SW, 172, 'sk fp')}
${txt(SX + 14, top + 68, `DATA → VISUAL CHANNEL — STUDY ${s.n}`, 'lbls')}
<line x1="${SX}" y1="${top + 76}" x2="${SX + SW}" y2="${top + 76}" class="skf"/>
${chans}
${lines(SX + 14, top + 240, wrap(s.cost, 74), 'lblf', 'start', 12)}
</g>`;
}

/** Soft-wrap a prose line onto the schedule column's width. */
function wrap(text, max) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line.length + word.length + 1 > max) { out.push(line); line = word; } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) out.push(line);
  return out;
}

// ---- the verdict band --------------------------------------------------------
const VERDICT = [
  ['1st', 'BUILD THE WORKING PLANT FIRST', 'Lowest path budget and ZERO new census machinery — age, churn, annex ratio and gate state are already computed for sheets 3, 7 and 8. It composes with the road grammar the city already has, and its channels are independent, so the wreck-to-splendor gauge can coexist with “old but healthy”, which this repo genuinely contains.'],
  ['2nd', 'LAYER THE VINES ON TOP', 'The purest rendering of wreck-and-ruin vs shine-and-splendor, and the most atmospheric. The vines composite cleanly over the plant sprite — HZD is literally overgrowth ON machines, so the hybrid is canon rather than a compromise.'],
  ['3rd', 'PARK THE LEDGER FOR A CLOSE-UP', 'The most informative and the only one needing a per-FILE census. Park it until a sheet wants file-level stories: it would make a superb single-district close-up plate rather than a whole-city treatment.'],
];
const VY = 1010;
const verdictBand = `<g>
${box(60, VY, 960, 172, 'sk fp')}
${txt(76, VY + 20, 'RECOMMENDATION — BUILD THE WORKING PLANT FIRST, THEN LAYER THE VINES, THEN PARK THE LEDGER', 'lbls')}
<line x1="60" y1="${VY + 28}" x2="1020" y2="${VY + 28}" class="skf"/>
${VERDICT.map(([rank, head, why], i) => {
  const y = VY + 46 + i * 46;
  return [
    txt(76, y, rank, 'lbla'),
    txt(112, y, head, 'lblb'),
    lines(112, y + 13, wrap(why, 168), 'lblf', 'start', 12),
  ].join('\n');
}).join('\n')}
${box(SX, VY, SW, 172, 'skr fnone', 0)}
${txt(SX + 14, VY + 20, 'DESIGN GUARD — RUST RED VS GATE RED', 'lblr')}
<line x1="${SX}" y1="${VY + 28}" x2="${SX + SW}" y2="${VY + 28}" class="skf"/>
${lines(SX + 14, VY + 46, wrap('The rust overlay must never collude with the gate-severity hatch sheet 7 already spends hue on. Rust rides at partial opacity on the FLANKS ONLY and its cracks are jagged; the gate hatch is uniform and includes the CAP. A reviewer must be able to say “rusting, but no gate” at a glance — and the converse, a red-gated pristine building, must stay legible too.', 72), 'lblf', 'start', 12)}
${txt(SX + 14, VY + 148, 'THREE RULES ALL THREE STUDIES OBEY', 'lbls')}
${txt(SX + 14, VY + 162, 'massing never lies · house materials only · severity stays where sheet 7 put it', 'lblf')}
</g>`;

const H_TOTAL = 1216;

const svg = `<svg viewBox="0 0 1560 ${H_TOTAL}" role="img" aria-label="An appendix plate of sprite studies: three rows of five isometric blocks each, showing one demo workspace member drawn from wreck to splendor under three competing sprite treatments. Row one, the reclaimed machine, is Horizon Zero Dawn leaning: the wrecked block has a breached parapet, rubble and green vines climbing both flanks, and each block to the right carries less vegetation until the last stands crisp with a ground halo, an accent trace along its roof edge and a survey flag. Row two, the ledger roof, is SimCity 2000 leaning: every roof is a four by four grid of tiles, one per authored file, collapsing and darkening on the left with a boarded door, clearing tile by tile to the right, with an accent construction crane on the fourth block and air-conditioner cubes, a water tower and an antenna on the last. Row three, the working plant, is Factorio leaning: the left machine is covered in red rust hatch with cracks, its outlet pipes dashed and dripping, its conveyor belt stopped and a red alert triangle floating above it; rightward the rust thins, the pipes reconnect, green module lamps light one by one and a steam plume grows from the roof vent. Beside each row a table maps every visual channel to the git measurement that would drive it, and a cost note prices the treatment across twenty-seven buildings. A recommendation panel at the foot ranks the three: build the working plant first, layer the vines second, park the ledger roof for a close-up plate; beside it a design guard states that rust red must never be confused with gate red.">
${defs(P)}

<rect x="40" y="26" width="760" height="42" class="skf fnone"/>
${txt(52, 43, 'THE SPRITE STUDY — HOW A MEMBER SHOULD BE DRAWN WHEN IT IS DRAWN AS A BUILDING', 'lbls')}
${txt(52, 58, 'META — the subject of this plate is the atlas, not the codebase · three worked directions, one recommendation', 'lblf')}

${txt(1520, 34, 'ONE DEMO MEMBER — 16 files · 1,900 sloc — drawn fifteen times · footprint 1.6·√sloc ≈ 70, height 3 px/file = 48, the house rules', 'lbls', 'end')}
${txt(1520, 48, 'HORIZON ZERO DAWN × SIMCITY 2000 × FACTORIO · the gauge is WRECK & RUIN ↔ SHINE & SPLENDOR, driven by git age × churn', 'lblf', 'end')}
${txt(1520, 62, 'NO CENSUS PLATE — this appendix measures nothing; it argues a drawing convention · SEE ALSO sheets 7, 7B and 13', 'lblf', 'end')}

${STUDIES.map((s, i) => band(s, i)).join('\n')}
${verdictBand}
</svg>`;

export const sheetA1 = {
  num: 'A1', id: 'sprites', rev: 'A',
  // Appendix chrome: no altitude, no "OF 14" — this plate is not in the ascent.
  head: 'APPENDIX A1 · META',
  // The one flag the shared chrome reads: no "OF 14", and the title block's
  // SHEET field becomes APPENDIX.
  appendix: true,
  title: 'THE SPRITE STUDY',
  sub: 'APPENDIX · META — the research behind the building sprites, drawn in the set it argues about · three concepts on one demo member, five states each · REV A 2026-09-06: rolled into the set from the standalone sprite-studies exploration; the reference strip of game screenshots is cited in the notes rather than re-drawn, because the atlas draws no images',
  scale: 'THE ATLAS ITSELF',
  form: 'SPRITE STUDIES',
  svg,
  caption: 'Every other plate in this set measures the codebase. This one measures a decision: how a workspace member should look when a sheet draws it as a building. One demo member — 16 files, 1,900 sloc, massed under the same rules sheet 7 uses — is drawn fifteen times, five states along a wreck-to-splendor gauge under three competing treatments, and each treatment is priced. The verdict has already shipped: sheet 7B is the working plant, and sheet 13 is the weathering gauge those studies were commissioned for.',
  notes: `
<p><strong>Why an appendix, and not a sheet.</strong> The set's numbered sheets are ordered by <em>altitude</em> — how far back you stand from lit-ui-router — and every one of them cites a census plate. This plate stands nowhere on that ladder, because its subject is the atlas's own drawing convention rather than the codebase: it carries no <code>diagrams/data/*.json</code> import and no measured number. Filing it as A1 rather than as sheet 15 keeps the ascent honest: fourteen altitudes, and behind them a folder of the research the drawings were made from. Its id is letter-prefixed for the same reason, so nothing that walks the set in ascent order picks it up by accident.</p>
<p><strong>The brief the studies answered.</strong> The atlas draws workspace members as measured cities — footprint 1.6·√sloc, height 3 px per authored file, gate severity in colour. That is enough to say how <em>big</em> a member is and whether it is currently failing, and nothing at all about how it is <em>doing</em>. The question was whether a general building-sprite treatment could carry the second reading on any building-shaped sheet — the measured city of sheet 7, the delivered city of sheet 8, the bundled city of sheet 10 — hybridising three inspirations that each pull a different way: Horizon's overgrown megastructures, SimCity 2000's dimetric state-tiles, Factorio's broadcast-everything industrial sprites. The weathering-specific application is a single axis, wreck &amp; ruin ↔ shine &amp; splendor, driven by git age × churn — which is exactly the pair of measurements sheet 13 had already made.</p>
<p><strong>The three rules every study obeys.</strong> <em>Massing never lies</em> — decay and splendor are overlays on the honest block, never a change to its size, so a ruin is exactly as big as its code and the same solid a census would draw. <em>House materials only</em> — the atlas palette tokens, the existing 45° hatches, the same isometric projection, hand-authored inline SVG: no images, no filters, nothing a strict content-security policy would drop. <em>Severity stays where sheet 7 put it</em> — gate tier already owns hue on cap and flank, so the weathering gauge is spent on different channels (vegetation, tile condition, rust overlay) and a red-gated pristine building and a never-gating ruin both stay legible. The demo member is massed under those rules rather than invented: 1,900 sloc gives a 70-unit footprint and 16 files give 48 px of height, so the fifteen blocks on this plate could each stand in the measured city without adjustment.</p>
<p><strong>What the studies each teach.</strong> Study 1 is the purest reading of the gauge: nature is the only thing that moves, which is what actually happens to unmaintained code — it does not shrink, it gets <em>covered</em>. Study 2 is the most informative and the strictest: the roof grid is not decoration, it is the same census that already sets the height, so the tile count and the block height cannot disagree — and SimCity's own vocabulary keeps construction and abandonment as <em>different</em> sprites rather than as two ends of one axis, which is why RENOVATING sits at the healthy end. Study 3 is the one that survives contact with the repository: rust, steam, lamps and the alert are four independent channels, so <em>old AND running</em> is drawable — and old-and-running is the true state of most stable code, which no single wreck-to-splendor axis can say.</p>
<p><strong>The verdict, and where it shipped.</strong> The recommendation was to build the working plant first, layer the vines second, and park the ledger for a close-up. That is what happened: <strong>sheet 7B, THE WORKING CITY</strong>, is the working plant drawn over the whole measured city — every pipe, plume, lamp and alarm on it is a channel from study 3's table — and <strong>sheet 13, THE WEATHERING MAP</strong>, is the age-and-churn gauge those studies were commissioned to render, drawn flat rather than sprited so the dating stays readable at city scale. The ledger roof is still parked and still wants the one probe the cabinet does not have: a per-<em>file</em> age census rather than a per-member one.</p>
<p><strong>What is not re-drawn here.</strong> The original studies carried a reference strip — six annotated screenshots from Horizon Zero Dawn, Angkor's Ta Prohm, SimCity 2000, SCURK and two Factorio Friday Facts posts — and this plate carries none of them. The atlas is hand-authored SVG on the house palette; a fair-use raster would be the only image in the set and the only thing on a plate that a content-security policy could drop. The teaching survives as citations: Guerrilla's GDC talk <em>Between Tech and Art: The Vegetation of Horizon Zero Dawn</em> (vegetation as a systematic, parameterised layer over hard geometry — the generator posture exactly, two numbers per member); Jonathan Benainous's and Miguel Martinez's HZD environment work (overgrowth rides edges and openings while the masonry keeps its silhouette; breached parapets, spalled corners, debris at the base); the SimCity 2000 documentation of construction graphics and darkened abandonment sprites, and SCURK's fixed tile size and fixed palette, which are what make a whole-city re-skin safe; and Factorio's Friday Facts <a href="https://factorio.com/blog/post/fff-355">#355</a> (remnants are a <em>designed</em> sprite, not a missing one), <a href="https://factorio.com/blog/post/fff-269">#269</a> (belts get per-rotation sprites and strict tile-edge rules, so connections never lie), <a href="https://factorio.com/blog/post/fff-228">#228</a> (silhouette first, effects second) and <a href="https://factorio.com/blog/post/fff-348">#348</a> (alert legibility across scales — which is why the alert triangle is the only floating element on study 3).</p>
<p><strong>Determinism.</strong> Study 1's vines are the only stochastic marks in the set, and they are seeded: a fixed linear-congruential stream per state, so the same plate is drawn byte-for-byte on every build. Nothing here is animated, nothing is rotated, and the fifteen blocks share one projection helper with <code>generator/helpers.mjs</code>'s <code>iso()</code>.</p>`,
  key: [
    keyRow('<polygon points="6,9 16,3 26,9 16,15" class="sk fp"/><polygon points="6,9 16,15 16,18 6,12" class="sk" fill="var(--paper-2)"/><polygon points="26,9 16,15 16,18 26,12" class="sk fp2"/>', 'the honest block — massing never lies'),
    keyRow('<path d="M10,16 L12,11 L9,7 L11,3" class="skg"/><circle cx="9" cy="7" r="1.6" class="fg"/><circle cx="12" cy="11" r="1.6" class="fg"/>', 'STUDY 1 — vine · months since last commit'),
    keyRow('<polygon points="6,9 16,3 26,9 16,15" class="skf fp"/><line x1="11" y1="6" x2="21" y2="12" class="skf"/><line x1="21" y1="6" x2="11" y2="12" class="skf"/>', 'STUDY 2 — roof ledger · one tile per file'),
    keyRow(`<rect x="6" y="4" width="30" height="11" fill="url(#${P}-hr)"/><rect x="6" y="4" width="30" height="11" class="sk fnone"/>`, 'STUDY 3 — rust hatch · age without maintenance'),
    keyRow('<ellipse cx="14" cy="12" rx="5" ry="3.4" class="sks fnone"/><ellipse cx="22" cy="6" rx="7" ry="4.6" class="ska fnone"/>', 'STUDY 3 — steam plume · trailing-90-day commits'),
    keyRow('<rect x="6" y="6" width="7" height="6" fill="var(--green)" class="skg"/><rect x="16" y="6" width="7" height="6" class="skf fp2"/><rect x="26" y="6" width="7" height="6" class="skf fp2"/>', 'STUDY 3 — module lamps · spec-annex coverage'),
    keyRow('<polygon points="16,3 26,15 6,15" class="skr fp"/>', 'STUDY 3 — alert · a gate red at HEAD'),
    keyRow('<ellipse cx="22" cy="12" rx="18" ry="4" class="fhalo"/><line x1="4" y1="12" x2="40" y2="12" class="ska"/>', 'live trace + halo · shipped in the last 90 days'),
    keyRow('<line x1="4" y1="9" x2="40" y2="9" class="sks"/><polygon points="40,9 33,6 33,12" class="fis"/>', 'the gauge — wreck & ruin → shine & splendor'),
  ].join('\n'),
};

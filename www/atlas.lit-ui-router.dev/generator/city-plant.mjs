// THE WORKING PLANT, IN THE ROUND: the sprite study's Factorio-leaning treatment
// laid onto sheet 7's computed masses as a plan of primitives.  Every count and
// size reads a field the CITY row already carries; where a choice is left (which
// roof cell a vent takes), a PRNG seeded on the member's name makes it, so the
// same cabinet always builds the same plant.  The scene turns the plan into one
// merged mesh in the browser; nothing here touches three.
//
// Plan coordinates are the plate's: x east, z = the plate's y, y up.
//   ['b', cx, y0, cz, sx, sy, sz, role]   box standing on y0
//   ['c', cx, y0, cz, r, h, role]         upright cylinder standing on y0
//   ['x', x0, cy, cz, r, len, role]       pipe running east from x0
//   ['z', cx, cy, z0, r, len, role]       pipe running south from z0
//   ['d', cx, y0, cz, r, role]            dome cap seated on y0
// Roles: m machine body, p pipe, g gantry steel, k stack band (the tier's edge
// colour), L lamp lit, u lamp dark.  Rails ride as bare line segments.

const r2 = (v) => Math.round(v * 10) / 10;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** FNV-1a over the member's name: the seed, so a plant is a function of its member. */
export function seedOf(name) {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small, well-mixed PRNG that is identical in every engine. */
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// sheet 7A's lamp ladder in three steps: the annex's lit module lamps
function litLamps(sv) {
  if (!sv || sv.cat === 'z' || sv.cat === 'n') return 0;
  if (sv.cat !== 'm' || sv.line == null) return 1;
  return sv.line >= 95 ? 3 : sv.line >= 85 ? 2 : 1;
}

// the counts, one field each: files fire stacks, sloc fills tanks, files fit vents
export const PLANT_RULES = {
  stacks: (b) => clamp(Math.ceil(b.sf / 10), 1, 4),
  tanks: (b) => (b.sl < 150 ? 0 : b.sl < 600 ? 1 : b.sl < 1800 ? 2 : 3),
  vents: (b) => clamp(Math.round(b.sf / 5), 1, 6),
  gantry: (b) => b.s >= 45,
  catwalk: (b) => b.s >= 28,
  risers: (b) => (b.h >= 60 ? 2 : b.h >= 20 ? 1 : 0),
  deckEvery: 30,
};

// ---- the stack row, up the west edge from the south-west corner ----------
// Each part reads the member through one context: k = { P, L, rnd, b, x, z, s, h, m, pr, reach }.
function stacks(k) {
  const { P, rnd, b, x, z, s, h, m, reach } = k;
  const r = clamp(0.055 * s, 1.1, 3.4);
  const stackH = clamp(0.42 * s + 6, 9, 38);
  const nS = Math.min(PLANT_RULES.stacks(b), Math.max(1, Math.floor((0.6 * s - m) / (3.4 * r))));
  const uStack = x + m + r * 1.3;
  const stackV = [];
  for (let i = 0; i < nS; i++) {
    const v = z + s - m - r * 1.3 - i * 3.4 * r;
    const hs = stackH * (1 - 0.14 * i) * (0.92 + 0.16 * rnd());
    stackV.push(v);
    P.push(['b', uStack, h, v, r * 2.6, 1.2, r * 2.6, 'm']);
    P.push(['c', uStack, h + 1.2, v, r, hs, 'm']);
    // the band sits a collar's height under the lip, in the tier's edge colour
    P.push(['c', uStack, h + 1.2 + hs * 0.78, v, r * 1.14, Math.max(0.9, hs * 0.1), 'k']);
    reach(h + 1.2 + hs);
  }
  return { r, uStack, stackV };
}

// ---- the tank farm, along the north edge from the north-east corner -------
function tanks(k) {
  const { P, rnd, b, x, z, s, h, m, reach } = k;
  const rt = clamp(0.11 * s, 2.2, 7);
  const tankRoom = Math.floor((0.6 * s - m) / (2 * rt + 0.8));
  const nT = Math.min(PLANT_RULES.tanks(b), Math.max(0, tankRoom));
  const vTank = z + m + rt;
  const tankU = [];
  for (let i = 0; i < nT; i++) {
    const u = x + s - m - rt - i * (2 * rt + 0.8);
    const ht = rt * (1.3 + 0.35 * rnd());
    tankU.push(u);
    P.push(['c', u, h, vTank, rt, ht, 'm']);
    P.push(['d', u, h + ht, vTank, rt, 'm']);
    reach(h + ht + rt * 0.5);
  }
  return { rt, vTank, tankU };
}

// ---- the header: an L of pipe on low sleepers, stacks to tanks -------------
function header(k, { r, uStack, stackV }, { rt, vTank, tankU }) {
  const { P, s, h, pr } = k;
  const yHead = h + 1.2 + pr;
  const uHead = uStack + r * 1.3 + pr + 1.2;
  const vHead = tankU.length ? vTank + rt + pr + 1.2 : Math.min(...stackV) - Math.max(3, 0.12 * s);
  const vEnd = Math.max(...stackV);
  P.push(['z', uHead, yHead, vHead, pr, Math.max(0.5, vEnd - vHead), 'p']);
  if (tankU.length) P.push(['x', uHead, yHead, vHead, pr, Math.max(0.5, tankU[0] - uHead), 'p']);
  const sleepers = (u0, v0, u1, v1) => {
    const n = Math.max(1, Math.round(Math.hypot(u1 - u0, v1 - v0) / 7));
    for (let q = 0; q <= n; q++) {
      P.push(['b', u0 + (u1 - u0) * q / n, h, v0 + (v1 - v0) * q / n, pr * 2.4, 1.2, pr * 2.4, 'g']);
    }
  };
  sleepers(uHead, vHead, uHead, vEnd);
  if (tankU.length) sleepers(uHead, vHead, tankU[0], vHead);
  // each stack and each tank drops a stub onto the header
  stackV.forEach((v) => P.push(['x', uStack, yHead, v, pr * 0.8, uHead - uStack, 'p']));
  tankU.forEach((u) => P.push(['z', u, yHead, vTank, pr * 0.8, vHead - vTank, 'p']));
  return { uHead, vHead };
}

// ---- the gantry: a portal crane along the east edge on long footprints ----
function gantryOn(k, { vHead }, tanked) {
  const { P, L, rnd, b, x, z, s, h, m, pr, reach } = k;
  const gantry = PLANT_RULES.gantry(b);
  if (gantry) {
    const g = clamp(0.2 * s, 8, 16), lw = 1.3, ug = x + s - m - 0.09 * s;
    const v0 = (tanked ? vHead + pr + 1 : z + m) + lw / 2, v1 = z + s - m - lw / 2;
    [v0, v1].forEach((v) => {
      P.push(['b', ug - 2.2, h, v, lw, g, lw, 'g']);
      P.push(['b', ug + 2.2, h, v, lw, g, lw, 'g']);
      P.push(['b', ug, h + g - 0.8, v, 5.6, 0.8, lw * 1.4, 'g']);
    });
    P.push(['b', ug, h + g, (v0 + v1) / 2, 2.2, 1.4, v1 - v0 + lw * 1.4, 'g']);
    const vt = v0 + (v1 - v0) * (0.25 + 0.5 * rnd());
    P.push(['b', ug, h + g - 1.6, vt, 3.4, 1.6, 3.2, 'm']);
    L.push(ug, h + g - 1.6, vt, ug, h + Math.max(2, g * 0.35), vt);
    reach(h + g + 1.4);
  }
  return gantry;
}

// ---- the vent field: a seeded choice of the cells left over ---------------
function vents(k, { uHead, vHead }, tanked, gantry) {
  const { P, rnd, b, x, z, s, h, m, pr, reach } = k;
  const u0f = uHead + pr + 2, u1f = x + s - m - (gantry ? 0.2 * s : 0);
  const v0f = tanked ? vHead + pr + 2 : z + m, v1f = z + s - m;
  const c = Math.max(4.5, s / 5);
  const cols = Math.floor((u1f - u0f) / c), rows = Math.floor((v1f - v0f) / c);
  const cells = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) cells.push([i, j]);
  for (let i = cells.length - 1; i > 0; i--) {
    const k = Math.floor(rnd() * (i + 1));
    [cells[i], cells[k]] = [cells[k], cells[i]];
  }
  cells.slice(0, PLANT_RULES.vents(b)).forEach(([i, j]) => {
    const w = c * (0.42 + 0.12 * rnd()), d = c * (0.42 + 0.12 * rnd()), t = c * (0.22 + 0.1 * rnd());
    const cx = u0f + (i + 0.5) * c, cz = v0f + (j + 0.5) * c;
    P.push(['b', cx, h, cz, w, t, d, 'm']);
    // a cowl on the larger units, so a vent reads as a vent and not a crate
    if (c >= 7) P.push(['c', cx, h + t, cz, Math.min(w, d) * 0.28, t * 0.45, 'g']);
    reach(h + t * 1.45);
  });
}

// ---- the catwalk: a rail around the roof edge, posts on a fixed pitch ------
function catwalk(k) {
  const { L, b, x, z, s, h } = k;
  if (PLANT_RULES.catwalk(b)) {
    const yr = h + 2.2, i0 = 0.6;
    const a = [x + i0, z + i0], bb = [x + s - i0, z + s - i0];
    const ring = [[a[0], a[1]], [bb[0], a[1]], [bb[0], bb[1]], [a[0], bb[1]]];
    ring.forEach(([u, v], k) => {
      const [u2, v2] = ring[(k + 1) % 4];
      L.push(u, yr, v, u2, yr, v2);
      const n = Math.max(1, Math.round(Math.hypot(u2 - u, v2 - v) / 8));
      for (let q = 0; q < n; q++) {
        const pu = u + (u2 - u) * q / n, pv = v + (v2 - v) * q / n;
        L.push(pu, h, pv, pu, yr, pv);
      }
    });
  }
}

// ---- the walls: risers up the east face, decks every deckEvery units -------
function walls(k) {
  const { P, L, rnd, b, x, z, s, h, pr } = k;
  const nR = PLANT_RULES.risers(b);
  for (let i = 0; i < nR; i++) {
    const v = z + s * (0.28 + 0.44 * (nR === 1 ? rnd() : i));
    const pu = x + s + pr + 0.3;
    P.push(['c', pu, 0, v, pr, h + 1.4, 'p']);
    P.push(['x', pu - Math.min(4, 0.15 * s) - pr, h + 1.4, v, pr, Math.min(4, 0.15 * s) + pr, 'p']);
  }
  const decks = h >= 40 ? Math.floor((h - 10) / PLANT_RULES.deckEvery) : 0;
  for (let k = 1; k <= decks; k++) {
    const yd = k * PLANT_RULES.deckEvery, w = 1.8, t = 0.6;
    P.push(['b', x + s / 2, yd, z - w / 2, s + 2 * w, t, w, 'g']);
    P.push(['b', x + s / 2, yd, z + s + w / 2, s + 2 * w, t, w, 'g']);
    P.push(['b', x - w / 2, yd, z + s / 2, w, t, s, 'g']);
    P.push(['b', x + s + w / 2, yd, z + s / 2, w, t, s, 'g']);
    const yr = yd + 2, o = w;
    L.push(x - o, yr, z - o, x + s + o, yr, z - o, x + s + o, yr, z - o, x + s + o, yr, z + s + o,
      x + s + o, yr, z + s + o, x - o, yr, z + s + o, x - o, yr, z + s + o, x - o, yr, z - o);
  }
}

// ---- the annex: module lamps on its roof, a pipe rack across the gap ------
function annex(k, sv) {
  const { P, b, x, z, s, h, pr } = k;
  if (b.sa) {
    const sa = b.sa, ha = b.ha, ax = b.ax, az = b.ay;
    const lit = litLamps(sv);
    const ls = clamp(0.12 * sa, 1.8, 3.4), ma = Math.max(1.4, 0.1 * sa);
    for (let i = 0; i < 3; i++) {
      const u = ax + ma + ls / 2 + i * ls * 1.6;
      if (u + ls / 2 > ax + sa - ma) break;
      P.push(['b', u, ha, az + sa - ma - ls / 2, ls, ls * 0.8, ls, i < lit ? 'L' : 'u']);
    }
    if (sa >= 18) {
      const ra = clamp(0.14 * sa, 2, 6);
      P.push(['c', ax + sa - ma - ra, ha, az + ma + ra, ra, ra * 1.1, 'm']);
      P.push(['d', ax + sa - ma - ra, ha + ra * 1.1, az + ma + ra, ra, 'm']);
    }
    const yb = Math.max(3, Math.min(h, ha) - 2), zc = z + s / 2, gap = ax - (x + s);
    [-1, 1].forEach((side) => P.push(['x', x + s, yb, zc + side * (pr + 0.6), pr, gap, 'p']));
    P.push(['b', x + s + gap / 2, 0, zc, 1.2, yb - pr, 1.2, 'g']);
    P.push(['b', x + s + gap / 2, yb - pr - 0.6, zc, 1.6, 0.6, 2 * pr + 3, 'g']);
  }
}

function plantOne(b, sv) {
  const top = { v: b.h };
  const k = {
    P: [], L: [], rnd: prng(seedOf(b.name)), b, x: b.x, z: b.y, s: b.s, h: b.h,
    m: Math.max(1.5, 0.08 * b.s), pr: clamp(0.03 * b.s, 0.55, 1.4),
    reach: (v) => { top.v = Math.max(top.v, v); },
  };
  // The number chip stands over the roof's centre, so the plant keeps to the
  // corners the iso view leaves clear of it: stacks west, tanks north-east,
  // the gantry east, vents in what is left.
  const st = stacks(k), tk = tanks(k), hd = header(k, st, tk);
  const tanked = tk.tankU.length > 0;
  const g = gantryOn(k, hd, tanked);
  vents(k, hd, tanked, g);
  catwalk(k);
  walls(k);
  annex(k, sv);
  const R = (a) => a.map((v) => (typeof v === 'number' ? r2(v) : v));
  return { top: r2(top.v), p: k.P.map(R), l: k.L.map(r2) };
}

/**
 * The plant plan for every massed member, keyed by its sheet 7 number.  `survey`
 * is sheet 7A's row by number; it only sets how many of an annex's lamps burn.
 */
export function plantPlan(rows, survey) {
  const out = {};
  for (const b of rows) {
    if (b.tier === 'off') continue;
    out[b.n] = plantOne(b, survey[b.n]);
  }
  return out;
}

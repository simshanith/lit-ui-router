// Sheet 7's census city as a glTF binary for <model-viewer>: city.glb as measured,
// plant.glb with every massed member crowned by the working plant city-plant.mjs
// plans from its row.
//
// Axes: plan x → X, plan y → Z, height → Y (up), one plan unit to one model unit,
// centred on the plan's padded bounds. Per member: `mass-<n>` (its origin at the
// footprint's ground corner, so the `rise` clip can scale it up out of the ground),
// `annex-<n>` beside it, and on plant.glb `crown-<n>` on its roof. Every mass is
// written as its TEST LIGHT slabs, each slab a cap and a wall primitive. Every
// stroke is drawn on triangles lying on its face, because model-viewer retints and
// remaps materials on meshes only: frames and seams are thin strips, while hatch,
// stripe, dash and grid are pattern tiles repeated in world units over a face or strip.
//
// Materials are unlit and baked in the vellum palette; the page recomputes every one
// from its tokens with DRESS_JS, the same function the bake runs. The second lane
// is the KHR_materials_variants variant `test-light`; a primitive that belongs to
// one lane only is mapped to the transparent `void` in the other.
import { CITY } from './sheet7.mjs';
import { SURVEY } from './sheet7a.mjs';
import { plantPlan } from './city-plant.mjs';
import { glbWriter, lin, packGlb, pngRgba } from './glb.mjs';

// Tier → the plate's own treatment: sheet 7's edge class as a stroke token, the
// hue the paper is pulled a breath towards, and the tier's label.
export const TIERS = {
  halt: { hue: 'red', f: 0.62, edge: 'red', label: 'halts a publish' },
  pr: { hue: 'red', f: 0.34, edge: 'red', label: 'stops the PR line' },
  late: { hue: 'accent', f: 0.34, edge: 'accent', label: 'gates a later stage' },
  report: { hue: 'soft', f: 0.13, edge: 'line', label: 'never gates' },
  line: { hue: 'ink', f: 0.24, edge: 'ink', label: 'the material' },
  off: { hue: 'faint', f: 0, edge: 'soft', label: 'types only — frame, no mass' },
  annex: { hue: 'accent', f: 0.16, edge: 'soft', label: 'spec annex — the test mass' },
};
// How far a tier's hue may pull the paper: the hatch carries the severity.
export const TINT = 0.22;
// chrome.mjs's pattern defs: stroke token, alpha, spacing in CSS px at the home pose,
// and the rake (+1 the neutral one, -1 the opposite severity rake); `sh` is sheet 7A's shadow stripe.
export const HATCH = {
  hx: { tok: 'line', a: 1, sp: 6, rake: 1 },
  hd: { tok: 'soft', a: 1, sp: 5, rake: 1 },
  hr: { tok: 'redHatch', a: 0.55, sp: 6, rake: -1 },
  ha: { tok: 'accent', a: 0.5, sp: 6, rake: 1 },
  sh: { tok: 'ink', a: 0.30, sp: 4, rake: 1 },
};
// helpers.mjs's isoBlock, face by face: [stone, hatch]. cap = the plate's capCls; a = the
// +x and -z walls, paper-2 under the tier's side hatch; b = the -x and +z walls, plain.
// pr and late carry sheet 7's roof wash, the cap taking the side's own hatch.
export const FACES = {
  halt: { cap: ['red', null], a: ['paper2', 'hr'], b: ['paper2', null] },
  pr: { cap: ['paper', 'hr'], a: ['paper2', 'hr'], b: ['paper2', null] },
  late: { cap: ['paper', 'ha'], a: ['paper2', 'ha'], b: ['paper2', null] },
  report: { cap: ['paper2', null], a: ['paper2', 'hx'], b: ['paper2', null] },
  line: { cap: ['paper', null], a: ['paper2', 'hx'], b: ['paper2', null] },
  off: { cap: ['paper2', null], a: ['paper2', 'hd'], b: ['paper2', null] },
  annex: { cap: ['paper2', null], a: ['paper2', 'hd'], b: ['paper2', null] },
};
// Sheet 7A's polarity: covered source is LIT, untested source is SHADOW, the annex the
// lamp. Shadow lerps toward black, never ink: ink is light in the cyanotype theme.
export const LIT = {
  b1: { hue: 'halo', f: 0.46, label: 'LIT ≥95' },
  b2: { hue: 'halo', f: 0.34, label: 'lit 85–95' },
  b3: { hue: 'red', f: 0.38, label: 'lit <85' },
  b4: { hue: 'red', f: 0.58, label: 'lit <85' },
  sh: { hue: 'black', f: 0.38, hatch: 'sh', label: 'SHADOW — never loaded' },
  e2e: { hue: 'accent', f: 0.24, label: 'e2e light (accent)' },
  bare: { hue: 'ink', f: 0.05, label: 'no meter attaches' },
  lamp: { hue: 'halo', f: 0.60, label: 'lamp = spec annex' },
};
// each district's plate pad, in plan units
export const DISTRICTS = { pkg: 24, app: 24, site: 24, tool: 26 };

/** The light theme's tokens, which the GLB bakes; `halo` is its rgba's colour. */
export const VELLUM = {
  paper: '#F1F0E7', paper2: '#E9E8DD', ink: '#2B302C', soft: '#5C6259', faint: '#9AA091', line: '#C6C8B6',
  accent: '#2E5077', red: '#A63D2F', redHatch: '#A63D2F', green: '#4C6B51', halo: '#2E5077', black: '#000000',
};

/** Model units per CSS px at the home pose: the hatch spacing and every stroke width are set in it. */
export const PX = 1.1;
export const RISE_SECONDS = 2.4;
const RISE_EACH = 0.6, CROWNS_AT = 2.0, FLAT = 0.001;
const STROKE = 1.0 * PX, HAIR = 0.8 * PX, PROUD = 0.22, HATCH_PROUD = 0.12;
const DASH = [5 * PX, 4 * PX], DISTRICT_DASH = [7 * PX, 6 * PX];
const WALL_FOOT = 0.9, CROWN_FOOT = 0.78;
const PAD = 30, GRID_STEP = 50;
export const BUDGET = { city: 200 * 1024, plant: 350 * 1024 };

// The material dress, as one function the page and the bake both run: `c` is a token
// name → linear [r, g, b], `M` the material plan, `lane` 'tier' or 'light'.
// Returns [name, linear rgb, alpha] for every material the model carries.
export const DRESS_JS = `function cityDress(c, M, lane) {
    function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    var out = [];
    var stone = { paper: c.paper, paper2: c.paper2, red: c.red };
    M.massed.forEach(function (t) {
      var spec = M.tiers[t], f = M.faces[t], pull = spec.f * M.tint;
      out.push(['cap-' + t, f.cap[0] === 'red' ? c.red : mix(stone[f.cap[0]], c[spec.hue], pull), 1]);
      out.push(['wall-' + t, mix(c.paper2, c[spec.hue], pull), 1]);
    });
    Object.keys(M.hatch).forEach(function (k) { out.push(['hatch-' + k, c[M.hatch[k].tok], M.hatch[k].a]); });
    Object.keys(M.lit).forEach(function (k) {
      var L = M.lit[k];
      out.push(['L-' + k + '-cap', mix(c.paper, c[L.hue], L.f * 0.72), 1]);
      out.push(['L-' + k + '-wall', mix(c.paper, c[L.hue], L.f), 1]);
    });
    M.frames.forEach(function (r) { out.push(['frame-' + r[0], c[lane === 'light' ? r[2] : r[1]], 1]); });
    out.push(['edge-annex', c.soft, 1], ['edge-district', c.faint, 1], ['plate', mix(c.paper2, c.faint, 0.3), 0.62],
      ['grid', c.faint, 0.3], ['void', c.paper, 0]);
    if (M.plant) {
      out.push(['plant-m', mix(c.paper2, c.soft, 0.3), 1], ['plant-p', mix(c.paper2, c.soft, 0.58), 1],
        ['plant-g', mix(c.soft, c.ink, 0.22), 1], ['lamp-on', c.green, 1], ['lamp-off', mix(c.faint, c.paper2, 0.35), 1],
        ['edge-plant', c.ink, 1]);
      M.bands.forEach(function (t) { var e = M.tiers[t].edge; out.push(['band-' + t, c[e === 'line' ? 'soft' : e], 1]); });
    }
    return out;
  }`;
// the page inlines the same source, so the bake cannot drift from the retint
const cityDress = new Function(`${DRESS_JS}\nreturn cityDress;`)();

const SURVEY_BY_N = Object.fromEntries(SURVEY.map((r) => [r.n, r]));
for (const b of CITY) if (!SURVEY_BY_N[b.n]) throw new Error(`city-glb: member ${b.n} has no row in sheet 7A's SURVEY`);

// sheet 7A's brightness ladder, its own thresholds
const band = (line) => (line == null ? 'b1' : line >= 95 ? 'b1' : line >= 85 ? 'b2' : line >= 70 ? 'b3' : 'b4');
// a member's frame stroke on the light lane: e2e glows accent, nothing to light goes faint
const lightEdge = (b, sv) => (b.tier === 'off' || sv.cat === 'z' ? 'faint' : sv.cat === 'e' ? 'accent' : 'ink');

/** The material plan DRESS_JS reads; the page's island carries the same object. */
export function materialPlan(plant) {
  return {
    tiers: TIERS, faces: FACES, hatch: HATCH, lit: LIT, tint: TINT, plant,
    massed: ['halt', 'pr', 'late', 'report', 'line', 'annex'],
    frames: CITY.map((b) => [b.n, TIERS[b.tier].edge, lightEdge(b, SURVEY_BY_N[b.n])]),
    bands: plant ? [...new Set(CITY.filter((b) => b.tier !== 'off').map((b) => b.tier))].sort() : [],
  };
}

/** The vellum tokens as linear rgb, the shape DRESS_JS takes. */
export const vellumLinear = () => Object.fromEntries(Object.entries(VELLUM).map(([k, hex]) =>
  [k, [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255))]));

// ---- the plan's frame: padded bounds, centred on the origin ----------------
const extent = (() => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of CITY) {
    minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.s);
    minZ = Math.min(minZ, b.y); maxZ = Math.max(maxZ, b.y + b.s);
    if (b.sa) {
      minX = Math.min(minX, b.ax); maxX = Math.max(maxX, b.ax + b.sa);
      minZ = Math.min(minZ, b.ay); maxZ = Math.max(maxZ, b.ay + b.sa);
    }
  }
  minX -= PAD; maxX += PAD; minZ -= PAD; maxZ += PAD;
  return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
})();
const r3 = (v) => Math.round(v * 1000) / 1000;
/** A plan point and height as model coordinates [X, Y, Z]. */
export const toModel = (x, z, y = 0) => [r3(x - extent.cx), r3(y), r3(z - extent.cz)];

// ---- soups ------------------------------------------------------------------
// A primitive under construction: its kind picks the shared index pattern, `shade` its COLOR_0.
const prim = (kind, mat, light, shaded, tiled = false) => ({ kind, mat, light, shaded, tiled, pos: [], col: [], uv: [], n: 0 });
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
};
function quad(p, a, b, c, d, shade, uv) {
  p.pos.push(...a, ...b, ...c, ...d);
  if (p.shaded) p.col.push(...shade);
  if (p.tiled) p.uv.push(...uv);
  p.n += 1;
}
// A strip of width w from a to b, laid toward `side` and lifted along `n`; `period` tiles a dash along it.
function strip(p, a, b, side, w, n, proud, period) {
  const lift = V.mul(n, proud), off = V.mul(side, w);
  const a0 = V.add(a, lift), b0 = V.add(b, lift);
  const u = period ? Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / period : 0;
  quad(p, a0, b0, V.add(b0, off), V.add(a0, off), undefined, [0, 0, u, 0, u, 1, 0, 1]);
}

// A box face as an origin, two in-face axes with their lengths and an outward normal.
// `flip` turns a rake over on the walls whose u runs to screen-left when seen from outside.
function boxFaces(x0, x1, h, d) {
  const w = x1 - x0;
  return {
    cap: { o: [x0, h, 0], u: [1, 0, 0], U: w, v: [0, 0, 1], V: d, n: [0, 1, 0], flip: 1 },
    px: { o: [x1, 0, 0], u: [0, 0, 1], U: d, v: [0, 1, 0], V: h, n: [1, 0, 0], flip: -1 },
    nx: { o: [x0, 0, 0], u: [0, 0, 1], U: d, v: [0, 1, 0], V: h, n: [-1, 0, 0], flip: 1 },
    pz: { o: [x0, 0, d], u: [1, 0, 0], U: w, v: [0, 1, 0], V: h, n: [0, 0, 1], flip: 1 },
    nz: { o: [x0, 0, 0], u: [1, 0, 0], U: w, v: [0, 1, 0], V: h, n: [0, 0, -1], flip: -1 },
  };
}
const at = (F, u, v) => V.add(F.o, V.add(V.mul(F.u, u), V.mul(F.v, v)));

// A face's border strips, each inside the face: v0 and vV run along u, u0 and uU along v.
function border(p, F, w, dash, which = ['v0', 'vV', 'u0', 'uU']) {
  const all = {
    v0: [at(F, 0, 0), at(F, F.U, 0), F.v], vV: [at(F, 0, F.V), at(F, F.U, F.V), V.mul(F.v, -1)],
    u0: [at(F, 0, 0), at(F, 0, F.V), F.u], uU: [at(F, F.U, 0), at(F, F.U, F.V), V.mul(F.u, -1)],
  };
  for (const [a, b, side] of which.map((k) => all[k])) {
    strip(p, a, b, side, w, F.n, PROUD, dash);
  }
}

// A face hatched in its own (u, v): the tile's diagonal laid as v = r u + k, `sp` apart across the rake.
function hatch(p, F, rake, sp) {
  const r = rake * F.flip, L = sp * Math.SQRT2;
  const pt = (u, v) => V.add(at(F, u, v), V.mul(F.n, HATCH_PROUD));
  const uv = (u, v) => [u / L, (r * v) / L];
  quad(p, pt(0, 0), pt(F.U, 0), pt(F.U, F.V), pt(0, F.V), undefined, [...uv(0, 0), ...uv(F.U, 0), ...uv(F.U, F.V), ...uv(0, F.V)]);
}

// The slab's cap and walls, graded top to foot; `skip` names the faces a neighbour slab hides.
// A tiled slab carries the stripe tile's UVs, laid per face as hatch() lays them.
function slab(cap, wall, x0, x1, h, d, skip) {
  const top = [1, 1, 1, 1].map(() => 255);
  const foot = Math.round(255 * WALL_FOOT);
  const W = [foot, foot, foot, 255, foot, foot, foot, 255, 255, 255, 255, 255, 255, 255, 255, 255];
  const F = boxFaces(x0, x1, h, d), L = HATCH.sh.sp * PX * Math.SQRT2;
  const uv = (f, pts) => pts.flatMap((pt) => {
    const rel = [pt[0] - f.o[0], pt[1] - f.o[1], pt[2] - f.o[2]];
    const u = rel[0] * f.u[0] + rel[1] * f.u[1] + rel[2] * f.u[2], v = rel[0] * f.v[0] + rel[1] * f.v[1] + rel[2] * f.v[2];
    return [u / L, (HATCH.sh.rake * f.flip * v) / L];
  });
  const face = (p, f, pts, shade) => quad(p, ...pts, shade, uv(f, pts));
  face(cap, F.cap, [[x0, h, 0], [x0, h, d], [x1, h, d], [x1, h, 0]], [...top, ...top, ...top, ...top]);
  face(wall, F.pz, [[x0, 0, d], [x1, 0, d], [x1, h, d], [x0, h, d]], W);
  face(wall, F.nz, [[x1, 0, 0], [x0, 0, 0], [x0, h, 0], [x1, h, 0]], W);
  if (!skip.has('px')) face(wall, F.px, [[x1, 0, d], [x1, 0, 0], [x1, h, 0], [x1, h, d]], W);
  if (!skip.has('nx')) face(wall, F.nx, [[x0, 0, 0], [x0, 0, d], [x0, h, d], [x0, h, 0]], W);
}

// ---- one member's mass: its slabs, frame, seam, hatch and stripe -----------
function massPrims(b, sv) {
  const n = b.n, s = b.s, h = b.h;
  const frame = prim('quad', `frame-${n}`, null, false);
  const out = [frame];
  const faces = boxFaces(0, s, h, s);
  const off = b.tier === 'off';
  for (const k of ['cap', 'px', 'nx', 'pz', 'nz']) border(frame, faces[k], STROKE);
  if (off) return out;

  // the split: the lit slab east, the shadow west, as sheet 7A draws it
  let slabs;
  if (sv.cat === 'm') {
    const e = Math.max(0, Math.min(100, sv.ext || 0)) / 100;
    const litW = s * e, shW = s - litW;
    slabs = [];
    if (shW > 0.01) slabs.push([0, shW, 'sh']);
    if (litW > 0.01) slabs.push([shW, s, band(sv.line)]);
  } else {
    slabs = [[0, s, { n: 'sh', e: 'e2e', u: 'bare', z: null }[sv.cat]]];
  }
  slabs.forEach(([x0, x1, k], i) => {
    // the shadow slab wears sheet 7A's stripe as its own tile, so it carries UVs
    const cap = prim('quad', `cap-${b.tier}`, k ? `L-${k}-cap` : 'void', true, k === 'sh');
    const wall = prim('quad', `wall-${b.tier}`, k ? `L-${k}-wall` : 'void', true, k === 'sh');
    const skip = new Set([...(i > 0 ? ['nx'] : []), ...(i < slabs.length - 1 ? ['px'] : [])]);
    slab(cap, wall, x0, x1, h, s, skip);
    out.push(cap, wall);
  });
  if (slabs.length > 1) {
    const x = slabs[0][1], seam = prim('quad', 'void', `frame-${n}`, false);
    const c = boxFaces(0, s, h, s);
    strip(seam, [x - STROKE / 2, h, 0], [x - STROKE / 2, h, s], [1, 0, 0], STROKE, c.cap.n, PROUD);
    strip(seam, [x - STROKE / 2, 0, s], [x - STROKE / 2, h, s], [1, 0, 0], STROKE, c.pz.n, PROUD);
    strip(seam, [x - STROKE / 2, 0, 0], [x - STROKE / 2, h, 0], [1, 0, 0], STROKE, c.nz.n, PROUD);
    out.push(seam);
  }
  out.push(...tierHatch(b.tier, faces));
  return out;
}

// The tier lane's hatch: the side hatch on the +x and -z walls, the roof wash on the cap.
function tierHatch(tier, faces) {
  const side = FACES[tier].a[1], roof = FACES[tier].cap[1];
  const byKey = new Map();
  const into = (key) => {
    if (!byKey.has(key)) byKey.set(key, prim('quad', `hatch-${key}`, 'void', false, true));
    return byKey.get(key);
  };
  if (side) for (const k of ['px', 'nz']) hatch(into(side), faces[k], HATCH[side].rake, HATCH[side].sp * PX);
  if (roof) hatch(into(roof), faces.cap, HATCH[roof].rake, HATCH[roof].sp * PX);
  return [...byKey.values()];
}

function annexPrims(b, sv) {
  // cap and walls share one stone on both lanes, so the annex is one primitive graded by COLOR_0
  const sa = b.sa, ha = b.ha, lamp = sv.cat === 'n' ? 'bare' : 'lamp';
  const faces1 = prim('quad', 'cap-annex', `L-${lamp}-cap`, true);
  slab(faces1, faces1, 0, sa, ha, sa, new Set());
  const edge = prim('quad', 'edge-annex', null, false, true);
  const faces = boxFaces(0, sa, ha, sa);
  // one dashed strip per edge: the top edges on the cap, the uprights on the z walls, the feet on their walls
  const ONE = { cap: undefined, pz: ['v0', 'u0', 'uU'], nz: ['v0', 'u0', 'uU'], px: ['v0'], nx: ['v0'] };
  for (const [k, which] of Object.entries(ONE)) border(edge, faces[k], STROKE, DASH[0] + DASH[1], which);
  return [faces1, edge, ...tierHatch('annex', faces)];
}

// ---- the ground: district plates, their dashed edges, the grid ---------------
function districtRect(d) {
  const members = CITY.filter((b) => b.dist === d);
  if (!members.length) return null;
  const pad = DISTRICTS[d];
  let x1 = Infinity, x2 = -Infinity, z1 = Infinity, z2 = -Infinity;
  for (const b of members) {
    x1 = Math.min(x1, b.x); z1 = Math.min(z1, b.sa ? Math.min(b.y, b.ay) : b.y);
    x2 = Math.max(x2, b.sa ? b.ax + b.sa : b.x + b.s);
    z2 = Math.max(z2, b.y + b.s, b.sa ? b.ay + b.sa : 0);
  }
  return [x1 - pad, z1 - pad, x2 + pad, z2 + pad].map((v, i) => v - (i % 2 ? extent.cz : extent.cx));
}
function groundPrims() {
  const grid = prim('quad', 'grid', null, false, true), plate = prim('quad', 'plate', null, false);
  const edge = prim('quad', 'edge-district', null, false, true);
  const up = [0, 1, 0];
  const span = Math.max(extent.maxX - extent.minX, extent.maxZ - extent.minZ);
  const cell = span / Math.round(span / GRID_STEP), g = span / 2 + HAIR / 2;
  const gx = (extent.minX + extent.maxX) / 2 - extent.cx, gz = (extent.minZ + extent.maxZ) / 2 - extent.cz;
  // the tile's line sits on its first row and column, so a corner of the square lands on a line
  const guv = (x, z) => [(x + span / 2) / cell, (z + span / 2) / cell];
  quad(grid, [gx - g, 0.05, gz - g], [gx - g, 0.05, gz + g], [gx + g, 0.05, gz + g], [gx + g, 0.05, gz - g], undefined,
    [...guv(-g, -g), ...guv(-g, g), ...guv(g, g), ...guv(g, -g)]);
  for (const d of Object.keys(DISTRICTS)) {
    const r = districtRect(d);
    if (!r) continue;
    const [x1, z1, x2, z2] = r;
    quad(plate, [x1, 0.3, z1], [x1, 0.3, z2], [x2, 0.3, z2], [x2, 0.3, z1]);
    const F = { o: [x1, 0, z1], u: [1, 0, 0], U: x2 - x1, v: [0, 0, 1], V: z2 - z1, n: up };
    for (const [a, b, side] of [
      [at(F, 0, 0), at(F, F.U, 0), F.v], [at(F, 0, F.V), at(F, F.U, F.V), V.mul(F.v, -1)],
      [at(F, 0, 0), at(F, 0, F.V), F.u], [at(F, F.U, 0), at(F, F.U, F.V), V.mul(F.u, -1)],
    ]) strip(edge, a, b, side, STROKE, up, 0.5, DISTRICT_DASH[0] + DISTRICT_DASH[1]);
  }
  // the grid first: the plates blend over it, in the primitives' own order
  return [grid, plate, edge];
}

// ---- pattern tiles: white, the stroke in the alpha, repeated in world units ----
const TILE = 16, GRID_TILE = 64;
function tile(size, cover) {
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    px.set([255, 255, 255, Math.round(255 * Math.max(0, Math.min(1, cover(x + 0.5, y + 0.5))))], i);
  }
  return pngRgba(size, size, px);
}
// one diagonal per tile, u - v = 0, about HAIR wide at the hatch's own spacing
const HATCH_PNG = tile(TILE, (x, y) => {
  const d = Math.abs(((((x - y) % TILE) + TILE * 1.5) % TILE) - TILE / 2) / Math.SQRT2;
  return 0.85 + 0.5 - d;
});
// a dash along u: its first 5/9 drawn, the rest left
const DASH_PNG = tile(TILE, (x) => Math.min(x, (TILE * DASH[0]) / (DASH[0] + DASH[1]) - x + 1, 1) + 0.5);
// the grid's line on the tile's first row and column
const GRID_PNG = tile(GRID_TILE, (x, y) => (x < 1 || y < 1 ? 1 : 0));
// sheet 7A's shadow stripe, multiplied into the shadow: the diagonal darkened by the stripe's alpha
const STRIPE_PNG = (() => {
  const px = new Uint8Array(TILE * TILE * 4);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const d = Math.abs(((((x - y) % TILE) + TILE * 1.5) % TILE) - TILE / 2) / Math.SQRT2;
    const k = Math.round(255 * (1 - HATCH.sh.a * Math.max(0, Math.min(1, 1.35 - d))));
    px.set([k, k, k, 255], (y * TILE + x) * 4);
  }
  return pngRgba(TILE, TILE, px);
})();
const TILED = { hatch: HATCH_PNG, dash: DASH_PNG, grid: GRID_PNG, stripe: STRIPE_PNG };
const tileOf = (name) => (/^hatch-/.test(name) ? 'hatch' : /^edge-(annex|district)$/.test(name) ? 'dash'
  : name === 'grid' ? 'grid' : /^L-sh-/.test(name) ? 'stripe' : null);

// ---- the working plant: every solid a hexahedron, merged per material ----
const ROLE = { m: 'plant-m', p: 'plant-p', g: 'plant-g', L: 'lamp-on', u: 'lamp-off' };
const sh = (v) => Math.round(255 * v);
// Every crown solid is a hexahedron: four corners at the foot, four at the head, in the
// same turn, so a box, a turned box and a frustum all share one index pattern.
function hex8(p, foot, head) {
  for (const [ring, k] of [[foot, CROWN_FOOT], [head, 1]]) for (const pt of ring) {
    p.pos.push(...pt);
    p.col.push(sh(k), sh(k), sh(k), 255);
  }
  p.n += 1;
}
const box8 = (p, x0, y0, z0, x1, y1, z1) =>
  hex8(p, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]);
// a square of circumradius r at height y, its first corner at angle a0, turning from +x to +z
const square = (cx, y, cz, r, a0) => [0, 1, 2, 3].map((k) => {
  const a = a0 + (k * Math.PI) / 2;
  return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
});
// an upright round solid as two squares turned an eighth apart: their union is an octagon
function octo(p, cx, y0, cz, r0, h, r1) {
  for (const a0 of [(5 * Math.PI) / 4, Math.PI]) hex8(p, square(cx, y0, cz, r0, a0), square(cx, y0 + h, cz, r1, a0));
}
// a pipe thinner than this is a square bar: at the plates' scale it is a few pixels across
const THIN = 1.5, BAR = 0.85;
function crownPrims(b, plan, o) {
  const byKey = new Map();
  const into = (kind, mat) => {
    const key = `${kind}:${mat}`;
    if (!byKey.has(key)) byKey.set(key, prim(kind, mat, null, kind !== 'quad'));
    return byKey.get(key);
  };
  const L = ([x, y, z]) => [x - o[0], y - o[1], z - o[2]];
  for (const q of plan.p) {
    const role = q[q.length - 1], mat = role === 'k' ? `band-${b.tier}` : ROLE[role];
    if (q[0] === 'b') {
      const [, cx, y0, cz, sx, sy, sz] = q;
      const [x0, yy, z0] = L([cx - sx / 2, y0, cz - sz / 2]);
      box8(into('box', mat), x0, yy, z0, x0 + sx, yy + sy, z0 + sz);
    } else if (q[0] === 'c') {
      const [, cx, y0, cz, r, h] = q;
      const [x, y, z] = L([cx, y0, cz]), a = r * BAR;
      if (r < THIN) box8(into('box', mat), x - a, y, z - a, x + a, y + h, z + a);
      else octo(into('box', mat), x, y, z, r, h, r);
    } else if (q[0] === 'x' || q[0] === 'z') {
      const [, u0, cy, w0, r, len] = q, a = r * BAR;
      if (r >= THIN) throw new Error(`city-glb: member ${b.n}'s plant lays a pipe of radius ${r}, past the bar's ${THIN}`);
      const [x0, y, z0] = L([u0, cy, w0]);
      if (q[0] === 'x') box8(into('box', mat), x0, y - a, z0 - a, x0 + len, y + a, z0 + a);
      else box8(into('box', mat), x0 - a, y - a, z0, x0 + a, y + a, z0 + len);
    } else if (q[0] === 'd') {
      const [, cx, y0, cz, r] = q;
      const [x, y, z] = L([cx, y0, cz]);
      octo(into('box', mat), x, y, z, r, r * 0.5, r * 0.5);
    } else throw new Error(`city-glb: member ${b.n}'s plant carries an unknown solid ${q[0]}`);
  }
  // rails as strips: a level rail lies flat, an upright faces along x, so all four diagonals read it
  const rails = into('quad', 'edge-plant');
  for (let i = 0; i < plan.l.length; i += 6) {
    const a = L(plan.l.slice(i, i + 3)), c = L(plan.l.slice(i + 3, i + 6));
    const moving = [0, 1, 2].filter((k) => Math.abs(c[k] - a[k]) > 1e-6);
    if (moving.length > 1) throw new Error(`city-glb: member ${b.n}'s plant rail ${i / 6} is not axis-aligned`);
    const upright = moving[0] === 1;
    const side = moving[0] === 2 ? [1, 0, 0] : [0, 0, 1];
    const half = V.mul(side, -HAIR / 2);
    strip(rails, V.add(a, half), V.add(c, half), side, HAIR, upright ? [1, 0, 0] : [0, 1, 0], 0);
  }
  return [...byKey.values()];
}

// ---- index patterns, shared by every primitive of a kind ---------------------
const PATTERN = {
  quad: { verts: 4, tris: [0, 1, 2, 0, 2, 3] },
  box: { verts: 8, tris: [4, 7, 6, 4, 6, 5, 3, 2, 6, 3, 6, 7, 1, 0, 4, 1, 4, 5, 2, 1, 5, 2, 5, 6, 0, 3, 7, 0, 7, 4] },
};

/** How far a pin stands over its member's top, in model units. */
export const PIN_LIFT = 14;
/** Where a member's pin stands and what its pick boxes cover, in model coordinates. */
function layoutOf(b, plan) {
  const top = plan ? plan.top : b.h;
  const e = 2;
  const boxes = [[b.x - e, -1, b.y - e, b.x + b.s + e, top + e, b.y + b.s + e]];
  if (b.sa) {
    boxes.push([b.ax - e, -1, b.ay - e, b.ax + b.sa + e, b.ha + e, b.ay + b.sa + e]);
    const z0 = Math.max(b.y, b.ay), z1 = Math.min(b.y + b.s, b.ay + b.sa);
    if (z1 > z0) boxes.push([b.x + b.s, -1, z0, b.ax, Math.min(b.h, b.ha) + e, z1]);
  }
  return {
    n: b.n,
    h: r3(b.h),
    top: r3(top),
    cap: toModel(b.x + b.s / 2, b.y + b.s / 2, top + PIN_LIFT),
    centre: toModel(b.x + b.s / 2, b.y + b.s / 2, b.h / 2),
    boxes: boxes.map(([x0, y0, z0, x1, y1, z1]) => [...toModel(x0, z0, y0), ...toModel(x1, z1, y1)]),
  };
}

/** Where the app serves the two models: app/public/models/, under the app's base. */
export const CITY_GLB = 'models/city.glb';
export const PLANT_GLB = 'models/plant.glb';

const built = new Map();
/**
 * The model and the layout the page needs beside it: pins, pick boxes, district
 * labels and the rise schedule, so the island cannot drift from the GLB.
 * @param {{ plant: boolean }} opts
 */
export function cityModel({ plant }) {
  if (!built.has(plant)) built.set(plant, writeCity(plant));
  return built.get(plant);
}

function writeCity(plant) {
  const plans = plant ? plantPlan(CITY, SURVEY_BY_N) : {};
  const M = materialPlan(plant);
  // schedule order, district by district: each member's mass rises over RISE_EACH seconds
  const ORDER = Object.keys(DISTRICTS);
  const order = [...CITY].sort((a, c) => ORDER.indexOf(a.dist) - ORDER.indexOf(c.dist));
  const LEAD_IN = 0.05, lead = CROWNS_AT - RISE_EACH - LEAD_IN;
  const riseAt = new Map(order.map((b, i) => [b.n, r3(LEAD_IN + (lead * i) / (order.length - 1))]));

  const nodes = []; // { name, translation, prims, rise: [t0, t1] | 'crown' }
  nodes.push({ name: 'ground', translation: [0, 0, 0], prims: groundPrims() });
  for (const b of CITY) {
    const sv = SURVEY_BY_N[b.n];
    const t0 = riseAt.get(b.n);
    nodes.push({ name: `mass-${b.n}`, translation: toModel(b.x, b.y), prims: massPrims(b, sv), rise: [t0, t0 + RISE_EACH] });
    if (b.sa) nodes.push({ name: `annex-${b.n}`, translation: toModel(b.ax, b.ay), prims: annexPrims(b, sv), rise: [t0, t0 + RISE_EACH] });
    if (plans[b.n]) {
      const o = [b.x + b.s / 2, b.h, b.y + b.s / 2];
      nodes.push({ name: `crown-${b.n}`, translation: toModel(o[0], o[2], o[1]), prims: crownPrims(b, plans[b.n], o), rise: 'crown' });
    }
  }

  // the dress, cut to the materials some primitive wears: a band no member reaches is left out
  const worn = new Set(nodes.flatMap((nd) => nd.prims.filter((p) => p.n > 0).flatMap((p) => [p.mat, p.light].filter(Boolean))));
  const baked = cityDress(vellumLinear(), M, 'tier');
  const missing = [...worn].filter((name) => !baked.some(([bn]) => bn === name));
  if (missing.length) throw new Error(`city-glb: no material ${missing.join(', ')}`);
  const tiles = [...new Set([...worn].map(tileOf).filter(Boolean))];
  const materials = baked.filter(([name]) => worn.has(name)).map(([name, c, a]) => ({
    name,
    pbrMetallicRoughness: {
      baseColorFactor: [...c.map((v) => +v.toFixed(5)), a],
      ...(tileOf(name) ? { baseColorTexture: { index: tiles.indexOf(tileOf(name)) } } : {}),
    },
    extensions: { KHR_materials_unlit: {} },
    ...(a < 1 || (tileOf(name) && tileOf(name) !== 'stripe') ? { alphaMode: 'BLEND' } : {}),
    ...(/^(frame|edge|hatch|grid|void)/.test(name) ? { doubleSided: true } : {}),
  }));
  const MAT = new Map(materials.map((m, i) => [m.name, i]));
  if (MAT.size !== materials.length) throw new Error('city-glb: two materials share a name');
  const matOf = (name) => MAT.get(name);

  // ---- write: positions as int16 on one strided view, scaled back by each node's own scale ----
  const Q = 64;
  const w = glbWriter();
  const most = {};
  for (const nd of nodes) for (const p of nd.prims) most[p.kind] = Math.max(most[p.kind] ?? 0, p.n);
  const patterns = {};
  for (const [kind, count] of Object.entries(most)) {
    const P = PATTERN[kind], idx = [];
    for (let i = 0; i < count; i++) for (const t of P.tris) idx.push(i * P.verts + t);
    if (count * P.verts > 65535) throw new Error(`city-glb: a ${kind} primitive outgrows 16-bit indices`);
    patterns[kind] = { view: w.view(new Uint16Array(idx), 34963), per: P.tris.length };
  }
  const live = nodes.flatMap((nd) => nd.prims.filter((p) => p.n > 0));
  // a grading that repeats one unit is read off one canonical run, as long as the longest primitive needs
  let verts = 0, shaded = 0, tiled = 0;
  const runs = new Map();
  for (const p of live) {
    p.vAt = verts; verts += p.pos.length / 3;
    if (p.tiled) { p.tAt = tiled; tiled += p.pos.length / 3; }
    if (p.shaded) {
      const unit = PATTERN[p.kind].verts * 4, first = p.col.slice(0, unit);
      const periodic = p.col.every((v, i) => v === first[i % unit]);
      p.run = periodic ? `${p.kind}:${first.join(',')}` : `${p.kind}:${p.col.join(',')}`;
      const r = runs.get(p.run) ?? { col: periodic ? first : p.col, units: 0, periodic };
      r.units = Math.max(r.units, periodic ? p.n : 1);
      runs.set(p.run, r);
    }
  }
  for (const r of runs.values()) { r.at = shaded; shaded += (r.col.length / 4) * r.units; }
  const P16 = new Int16Array(verts * 4), C8 = new Uint8Array(shaded * 4), UV = new Float32Array(tiled * 2);
  for (const r of runs.values()) for (let u = 0; u < r.units; u++) C8.set(r.col, (r.at + (u * r.col.length) / 4) * 4);
  for (const p of live) {
    const count = p.pos.length / 3;
    p.min = [Infinity, Infinity, Infinity]; p.max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) {
      const q = Math.round(p.pos[i * 3 + k] * Q);
      if (Math.abs(q) > 32767) throw new Error(`city-glb: a ${p.mat} vertex lies outside the int16 range`);
      P16[(p.vAt + i) * 4 + k] = q;
      p.min[k] = Math.min(p.min[k], q); p.max[k] = Math.max(p.max[k], q);
    }
    if (p.shaded && p.col.length !== count * 4) throw new Error(`city-glb: a ${p.mat} primitive grades ${p.col.length / 4} of ${count} vertices`);
    if (p.tiled) UV.set(p.uv, p.tAt * 2);
  }
  const tileViews = Object.fromEntries(tiles.map((t) => [t, w.view(TILED[t])]));
  const posView = w.view(P16, 34962, 8), colView = shaded ? w.view(C8, 34962) : null, uvView = w.view(UV, 34962);
  const once = new Map();
  const shared = (key, make) => {
    if (!once.has(key)) once.set(key, make());
    return once.get(key);
  };
  let triangles = 0;
  const meshes = [], gNodes = [], channels = [], samplers = [], parents = [];
  const mapping = (m) => ({ KHR_materials_variants: { mappings: [{ variants: [0], material: matOf(m) }] } });
  for (const nd of nodes) {
    const primitives = nd.prims.filter((p) => p.n > 0).map((p) => {
      const count = p.pos.length / 3;
      const attributes = { POSITION: w.over(posView, 5122, count, 'VEC3', { byteOffset: p.vAt * 8, min: p.min, max: p.max }) };
      if (p.shaded) {
        const r = runs.get(p.run);
        attributes.COLOR_0 = shared(`c${r.at}:${count}`, () => w.over(colView, 5121, count, 'VEC4', { byteOffset: r.at * 4, normalized: true }));
      }
      if (p.tiled) attributes.TEXCOORD_0 = w.over(uvView, 5126, count, 'VEC2', { byteOffset: p.tAt * 8 });
      const pat = patterns[p.kind];
      triangles += (pat.per / 3) * p.n;
      const indices = shared(`${p.kind}:${p.n}`, () => w.over(pat.view, 5123, pat.per * p.n, 'SCALAR'));
      const out = { attributes, indices, material: matOf(p.mat) };
      if (p.light && p.light !== p.mat) out.extensions = mapping(p.light);
      return out;
    });
    meshes.push({ primitives });
    parents.push(gNodes.length);
    gNodes.push({ name: nd.name, mesh: meshes.length - 1, translation: nd.translation, scale: [1 / Q, 1 / Q, 1 / Q] });
  }

  // the rise clip: each mass and annex scales up out of the ground, the crowns last;
  // keys ride two shared views, and a member's mass and annex share one sampler
  const frames = nodes.map((nd) => {
    if (!nd.rise) return null;
    if (nd.rise === 'crown') return [[0, CROWNS_AT, RISE_SECONDS], [[FLAT, FLAT, FLAT], [FLAT, FLAT, FLAT], [1, 1, 1]]];
    return [[0, ...nd.rise, RISE_SECONDS], [[1, FLAT, 1], [1, FLAT, 1], [1, 1, 1], [1, 1, 1]]];
  });
  const T = [], O = [], seen = new Map();
  const slot = (list, values) => {
    const k = `${list === T ? 't' : 'o'}${values.join(',')}`;
    if (!seen.has(k)) { seen.set(k, list.length); list.push(...values); }
    return seen.get(k);
  };
  const placed = frames.map((f) => f && [slot(T, f[0]), slot(O, f[1].flat().map((v) => v / Q)), f[0]]);
  const tView = w.view(new Float32Array(T)), oView = w.view(new Float32Array(O));
  const sampler = new Map();
  placed.forEach((f, i) => {
    if (!f) return;
    const [ti, oi, times] = f, k = `${ti}:${oi}`;
    if (!sampler.has(k)) {
      const input = shared(`t${ti}`, () => w.over(tView, 5126, times.length, 'SCALAR', { byteOffset: ti * 4, min: [times[0]], max: [times[times.length - 1]] }));
      const output = shared(`o${oi}`, () => w.over(oView, 5126, times.length, 'VEC3', { byteOffset: oi * 4 }));
      samplers.push({ input, output });
      sampler.set(k, samplers.length - 1);
    }
    channels.push({ sampler: sampler.get(k), target: { node: parents[i], path: 'scale' } });
  });
  gNodes.push({ name: plant ? 'the working city' : 'the city', children: parents });

  for (const b of CITY) {
    if (!gNodes.some((g) => g.name === `mass-${b.n}`)) throw new Error(`city-glb: member ${b.n} has no mass node`);
    if (!MAT.has(`frame-${b.n}`)) throw new Error(`city-glb: member ${b.n} has no frame`);
  }

  const bin = w.bin();
  const gltf = {
    asset: { version: '2.0', generator: 'www/atlas.lit-ui-router.dev/generator/city-glb.mjs' },
    extensionsUsed: ['KHR_materials_unlit', 'KHR_materials_variants', 'KHR_mesh_quantization'],
    extensionsRequired: ['KHR_mesh_quantization'],
    extensions: { KHR_materials_variants: { variants: [{ name: 'test-light' }] } },
    scene: 0,
    scenes: [{ name: plant ? 'the working city' : 'the city', nodes: [gNodes.length - 1] }],
    nodes: gNodes,
    meshes,
    materials,
    textures: tiles.map((_, i) => ({ sampler: 0, source: i })),
    images: tiles.map((t) => ({ bufferView: tileViews[t], mimeType: 'image/png' })),
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    accessors: w.accessors,
    bufferViews: w.bufferViews,
    buffers: [{ byteLength: bin.length }],
    animations: [{ name: 'rise', channels, samplers }],
  };
  const glb = packGlb(gltf, bin);
  const budget = BUDGET[plant ? 'plant' : 'city'];
  if (glb.length > budget) throw new Error(`city-glb: ${plant ? 'plant' : 'city'}.glb is ${glb.length} bytes, over its ${budget}-byte budget`);

  const layout = {
    // the padded plan's half extents in model units, which the home pose frames with the members' boxes
    extent: [r3((extent.maxX - extent.minX) / 2), r3((extent.maxZ - extent.minZ) / 2)],
    end: RISE_SECONDS,
    crowns: plant ? [CROWNS_AT, RISE_SECONDS] : null,
    lift: PIN_LIFT,
    members: CITY.map((b) => ({ ...layoutOf(b, plans[b.n]), rise: [riseAt.get(b.n), r3(riseAt.get(b.n) + RISE_EACH)] })),
    districts: Object.keys(DISTRICTS).map((d) => {
      const r = districtRect(d);
      if (!r) return null;
      const [x1, z1, x2, z2] = r;
      return { d, at: [r3(x1 + (x2 - x1) * 0.85), 0.5, r3(z1 + (z2 - z1) * 0.85)] };
    }).filter(Boolean),
  };
  return { glb, layout, stats: { bytes: glb.length, triangles, materials: materials.length, nodes: gNodes.length } };
}

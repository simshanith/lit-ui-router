// A dependency-free glTF 2.0 binary writer for sheet 2's seated model: every
// ground, plate and brick a flat-shaded cuboid, every stud a 24-sided cylinder
// on its part's cap, one node per part named by its id, and one clip, `assemble`,
// that drops each lifted part from its exploded height onto its seat, a dashed
// leader running from its underside down to the stud it seats on.
//
// Axes: plan x → X, plan y → Z, height → Y (up), in stud pitches (40 plan units
// = 1), centred on the origin in plan with Y = 0 at the foot of the ground.
// The parts are the shape brick-iso.mjs's `seated()` reads: {id, kind, x, y, ws,
// ds, h|courses, on, rings, named, dash}.

import { bounds, box, glbWriter, packGlb, quad, rgb, segment, soup } from './glb.mjs';

const PITCH = 40, CRS = 24, PT = 12, SH = 7, SR = 12, SEG = 24;
export const ASSEMBLE_SECONDS = 1.2;
// the sheet's lifts × SCALE, a stacked brick at least CLEAR above the brick it stands on; plate-seated bricks move in WINDOW[0], stacked ones in WINDOW[1]
const SCALE = 1.5, CLEAR = 40, KEYS = 24, WINDOW = [[0, 0.75], [0.3, 1]];

/** Each lifted part's rise above its seat in plan units at clip fraction u (0 exploded, 1 seated), and the fractions `us` the clip keys it at. */
export function assembleMotion(parts, explode) {
  const byId = new Map(parts.map((m) => [m.id, m]));
  const under = (m) => (m.on !== undefined && explode.get(m.on) ? byId.get(m.on) : undefined);
  const lift = (m) => (under(m) ? Math.max(explode.get(m.id), lift(under(m)) + CLEAR) : explode.get(m.id));
  const rise = (id, u) => {
    const m = byId.get(id);
    if (!explode.get(id)) return 0;
    const [a, b] = WINDOW[under(m) ? 1 : 0];
    // cubic ease-in toward the seat: the drop lands hard, and the explode, played backward, launches fast
    return lift(m) * SCALE * (1 - Math.min(1, Math.max(0, (u - a) / (b - a))) ** 3);
  };
  const us = [...new Set([...Array.from({ length: KEYS + 1 }, (_, i) => i / KEYS), ...WINDOW.flat()])].sort((a, b) => a - b);
  return { us, rise };
}

// the atlas light palette; glTF colour factors are linear, so each is decoded from sRGB
const HEX = { paper: '#F1F0E7', paper2: '#E9E8DD', accent: '#2E5077', red: '#A63D2F', ink: '#2B302C' };
const GHOST = 0.45;
// a hued part's flank is its cap stepped down in sRGB, the same drop paper-2 makes from paper
const FLANK = 0.8;
const shade = (hex) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * FLANK).toString(16).padStart(2, '0')).join('')}`;
const material = ([name, hex, alpha]) => ({
  name,
  pbrMetallicRoughness: { baseColorFactor: [...rgb(hex), alpha ?? 1], metallicFactor: 0, roughnessFactor: 1 },
  ...(alpha ? { alphaMode: 'BLEND', doubleSided: true } : {}),
});
const BASE = [
  ['cap', HEX.paper], ['flank', HEX.paper2], ['ring', HEX.accent], ['seat', HEX.red], ['edge', HEX.ink],
  ['ghost-cap', HEX.paper, GHOST], ['ghost-flank', HEX.paper2, GHOST], ['ghost-edge', HEX.ink, GHOST],
];
function materialsFor(parts) {
  const list = parts.filter((m) => m.hue).flatMap((m) => [[`cap-${m.id}`, m.hue], [`flank-${m.id}`, shade(m.hue)]]);
  const materials = [...BASE, ...list].map(material);
  return { materials, index: Object.fromEntries(materials.map((m, i) => [m.name, i])) };
}

const heightOf = (m) => (m.kind === 'ground' ? m.h : m.kind === 'plate' ? PT : m.courses * CRS);

/** Each part's seated plan box and z0, in plan units — the same stacking `seated()` draws. */
export function seatedBoxes(parts) {
  const byId = new Map(parts.map((m) => [m.id, m]));
  const z0Of = (m) => (m.on !== undefined ? z0Of(byId.get(m.on)) + heightOf(byId.get(m.on)) : m.z0 ?? 0);
  return parts.map((m) => ({ m, x: m.x, y: m.y, w: m.ws * PITCH, d: m.ds * PITCH, z0: z0Of(m), h: heightOf(m) }));
}

/** The model's plan centre in plan units, which the GLB puts at the origin. */
export function planCentre(parts) {
  const boxes = seatedBoxes(parts);
  const minX = Math.min(...boxes.map((b) => b.x)), maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const minY = Math.min(...boxes.map((b) => b.y)), maxY = Math.max(...boxes.map((b) => b.y + b.d));
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

/** A plan point and height as model coordinates [X, Y, Z]. */
export function toModel(parts, x, y, z) {
  const [cx, cy] = planCentre(parts);
  return [(x - cx) / PITCH, z / PITCH, (y - cy) / PITCH];
}

// Ink edges stand a hair proud of the faces, so a face never wins their depth test.
const PROUD = 0.004;
function boxEdges(e, w, h, d) {
  const o = PROUD, c = [[-o, -o], [w + o, -o], [w + o, d + o], [-o, d + o]];
  for (let i = 0; i < 4; i++) {
    const [x1, z1] = c[i], [x2, z2] = c[(i + 1) % 4];
    segment(e, [x1, -o, z1], [x2, -o, z2]);
    segment(e, [x1, h + o, z1], [x2, h + o, z2]);
    segment(e, [x1, -o, z1], [x1, h + o, z1]);
  }
}

// One stud at plan-local centre (cx, cz) standing on y0: a 24-gon cap and its side wall.
function stud(cap, side, edge, cx, cz, y0) {
  const r = SR / PITCH, t = y0 + SH / PITCH;
  const ring = Array.from({ length: SEG }, (_, k) => {
    const a = (k / SEG) * Math.PI * 2;
    return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
  });
  const base = cap.pos.length / 3;
  cap.pos.push(cx, t, cz);
  cap.nrm.push(0, 1, 0);
  cap.col.push(1, 1, 1);
  for (const [x, z] of ring) { cap.pos.push(x, t, z); cap.nrm.push(0, 1, 0); cap.col.push(1, 1, 1); }
  for (let k = 0; k < SEG; k++) cap.idx.push(base, base + 1 + ((k + 1) % SEG), base + 1 + k);
  for (let k = 0; k < SEG; k++) {
    const [x1, z1] = ring[k], [x2, z2] = ring[(k + 1) % SEG];
    quad(side, [x1, y0, z1], [x1, t, z1], [x2, t, z2], [x2, y0, z2]);
    const k2 = 1 + PROUD / r;
    segment(edge, [cx + (x1 - cx) * k2, t + PROUD, cz + (z1 - cz) * k2], [cx + (x2 - cx) * k2, t + PROUD, cz + (z2 - cz) * k2]);
  }
}

// A part's mesh, in node-local units with its plan min corner at the origin.
function partMesh(part, ghost, MAT) {
  const g = (k) => (ghost ? `ghost-${k}` : part.hue ? `${k}-${part.id}` : k);
  const prims = new Map();
  const at = (mat, lines = false) => {
    if (!prims.has(mat)) prims.set(mat, { ...soup(), lines });
    return prims.get(mat);
  };
  const w = part.ws, d = part.ds, h = heightOf(part) / PITCH;
  box(at(g('cap')), at(g('flank')), w, h, d);
  boxEdges(at(ghost ? 'ghost-edge' : 'edge', true), w, h, d);
  if (part.kind !== 'ground') {
    const rings = new Set(part.rings ?? []);
    for (let i = 0; i < part.ws; i++)
      for (let j = 0; j < part.ds; j++) {
        const key = `${i},${j}`;
        const named = part.named?.get(key);
        const capMat = named?.edge === 'skr' ? 'seat' : named || rings.has(key) ? 'ring' : g('cap');
        stud(at(capMat), at(g('flank')), at(ghost ? 'ghost-edge' : 'edge', true), i + 0.5, j + 0.5, h);
      }
  }
  return [...prims].map(([mat, s]) => ({ mat: MAT[mat], ...s }));
}

// The support's stud a leader lands on: under the part, a ringed or named stud first, then the one nearest the overlap's middle.
function leaderStud(b, under) {
  const x0 = Math.max(b.x, under.x), x1 = Math.min(b.x + b.w, under.x + under.w);
  const y0 = Math.max(b.y, under.y), y1 = Math.min(b.y + b.d, under.y + under.d);
  const marked = new Set([...(under.m.rings ?? []), ...(under.m.named?.keys() ?? [])]);
  const studs = [];
  for (let i = 0; i < under.m.ws; i++)
    for (let j = 0; j < under.m.ds; j++) {
      const sx = under.x + (i + 0.5) * PITCH, sy = under.y + (j + 0.5) * PITCH;
      if (sx > x0 && sx < x1 && sy > y0 && sy < y1)
        studs.push({ ij: [i, j], marked: marked.has(`${i},${j}`), d: Math.hypot(sx - (x0 + x1) / 2, sy - (y0 + y1) / 2) });
    }
  if (!studs.length) throw new Error(`brick-glb: ${b.m.kind}-${b.m.id} covers no stud of ${under.m.kind}-${under.m.id}`);
  studs.sort((s, t) => Number(t.marked) - Number(s.marked) || s.d - t.d);
  return studs[0].ij;
}

/**
 * The seated model as a GLB. `explode` maps a part id to the sheet's lift in plan
 * units; `assemble` drops each lifted part's node along `assembleMotion` onto its
 * seat, and scales the part's leader with its gap to the part below.
 * @returns {Buffer}
 */
export function brickGlb(parts, { explode = new Map() } = {}) {
  const [ccx, ccy] = planCentre(parts);
  const boxes = seatedBoxes(parts);
  const { accessors, bufferViews, accessor, indices: indexed, bin: packed } = glbWriter();

  const meshes = [], nodes = [], channels = [], samplers = [];
  const { materials, index } = materialsFor(parts);
  let triangles = 0;
  const motion = assembleMotion(parts, explode);
  const times = accessor(new Float32Array(motion.us.map((u) => u * ASSEMBLE_SECONDS)), 'SCALAR', 5126, undefined, { min: [0], max: [ASSEMBLE_SECONDS] });
  for (const b of boxes) {
    const part = b.m;
    const primitives = partMesh(part, Boolean(part.dash), index).map((p) => {
      const position = accessor(new Float32Array(p.pos), 'VEC3', 5126, 34962, bounds(p.pos));
      const indices = indexed(p.idx, p.pos.length / 3);
      if (p.lines) return { attributes: { POSITION: position }, indices, material: p.mat, mode: 1 };
      triangles += p.idx.length / 3;
      const normal = accessor(new Float32Array(p.nrm), 'VEC3', 5126, 34962);
      if (p.col.length !== p.pos.length) throw new Error(`brick-glb: ${part.kind}-${part.id} grades ${p.col.length / 3} of ${p.pos.length / 3} vertices`);
      const colour = accessor(new Float32Array(p.col), 'VEC3', 5126, 34962);
      return { attributes: { POSITION: position, NORMAL: normal, COLOR_0: colour }, indices, material: p.mat };
    });
    const name = `${part.kind}-${part.id}`;
    meshes.push({ name, primitives });
    const seat = [(b.x - ccx) / PITCH, b.z0 / PITCH, (b.y - ccy) / PITCH];
    nodes.push({ name, mesh: meshes.length - 1, translation: seat });
    if (explode.get(part.id)) {
      const keys = motion.us.flatMap((u) => [seat[0], seat[1] + motion.rise(part.id, u) / PITCH, seat[2]]);
      samplers.push({ input: times, output: accessor(new Float32Array(keys), 'VEC3', 5126), interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: nodes.length - 1, path: 'translation' } });
    }
  }
  for (const id of explode.keys())
    if (!boxes.some((b) => b.m.id === id)) throw new Error(`brick-glb: explode names part ${id}, which the model does not carry`);
  // a leader: a unit dashed plumb line, a dash per half stud at full lift, scaled to the gap and riding the part below
  const boxOf = new Map(boxes.map((b) => [b.m.id, b]));
  for (const [id, lift] of explode) {
    if (!lift) continue;
    const b = boxOf.get(id), under = boxOf.get(b.m.on), [i, j] = leaderStud(b, under);
    const foot = [(under.x + (i + 0.5) * PITCH - ccx) / PITCH, b.z0 / PITCH, (under.y + (j + 0.5) * PITCH - ccy) / PITCH];
    const floor = motion.us.map((u) => motion.rise(under.m.id, u) / PITCH);
    // a zero scale is singular, so a seated leader keeps a hair of length
    const gap = motion.us.map((u, k) => Math.max(motion.rise(id, u) / PITCH - floor[k], 1e-4));
    const dashes = Math.max(2, Math.round(Math.max(...gap) * 2)), p = 1 / (dashes - 0.5), e = soup();
    for (let k = 0; k < dashes; k++) segment(e, [0, k * p, 0], [0, k * p + p / 2, 0]);
    const position = accessor(new Float32Array(e.pos), 'VEC3', 5126, 34962, bounds(e.pos));
    meshes.push({ name: `leader-${id}`, primitives: [{ attributes: { POSITION: position }, indices: indexed(e.idx, e.pos.length / 3), material: index.edge, mode: 1 }] });
    nodes.push({ name: `leader-${id}`, mesh: meshes.length - 1, translation: [foot[0], foot[1] + floor.at(-1), foot[2]], scale: [1, gap.at(-1), 1] });
    samplers.push({ input: times, output: accessor(new Float32Array(gap.flatMap((g) => [1, g, 1])), 'VEC3', 5126), interpolation: 'LINEAR' });
    channels.push({ sampler: samplers.length - 1, target: { node: nodes.length - 1, path: 'scale' } });
    if (floor.some(Boolean)) {
      samplers.push({ input: times, output: accessor(new Float32Array(floor.flatMap((y) => [foot[0], foot[1] + y, foot[2]])), 'VEC3', 5126), interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: nodes.length - 1, path: 'translation' } });
    }
  }
  nodes.push({ name: 'model', children: nodes.map((_, i) => i) });

  const bin = packed();
  const gltf = {
    asset: { version: '2.0', generator: 'www/atlas.lit-ui-router.dev/generator/brick-glb.mjs' },
    scene: 0,
    scenes: [{ name: 'the brick assembly', nodes: [nodes.length - 1] }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
    animations: channels.length ? [{ name: 'assemble', channels, samplers }] : [],
  };
  const glb = packGlb(gltf, bin);
  return Object.assign(glb, { triangles });
}

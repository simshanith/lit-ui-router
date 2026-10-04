// A dependency-free glTF 2.0 binary writer for sheet 2's seated model: every
// ground, plate and brick a flat-shaded cuboid, every stud a 24-sided cylinder
// on its part's cap, one node per part named by its id, and one clip, `assemble`,
// that drops each lifted part from its exploded height onto its seat.
//
// Axes: plan x → X, plan y → Z, height → Y (up), in stud pitches (40 plan units
// = 1), centred on the origin in plan with Y = 0 at the foot of the ground.
// The parts are the shape brick-iso.mjs's `seated()` reads: {id, kind, x, y, ws,
// ds, h|courses, on, rings, named, dash}.

const PITCH = 40, CRS = 24, PT = 12, SH = 7, SR = 12, SEG = 24;
export const ASSEMBLE_SECONDS = 1.5;

// the atlas light palette; glTF colour factors are linear, so each is decoded from sRGB
const HEX = { paper: '#F1F0E7', paper2: '#E9E8DD', accent: '#2E5077', red: '#A63D2F', ink: '#2B302C' };
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (hex) => [1, 3, 5].map((i) => +lin(parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(5));
const GHOST = 0.45;
const MATERIALS = [
  ['cap', HEX.paper], ['flank', HEX.paper2], ['ring', HEX.accent], ['seat', HEX.red], ['edge', HEX.ink],
  ['ghost-cap', HEX.paper, GHOST], ['ghost-flank', HEX.paper2, GHOST], ['ghost-edge', HEX.ink, GHOST],
].map(([name, hex, alpha]) => ({
  name,
  pbrMetallicRoughness: { baseColorFactor: [...rgb(hex), alpha ?? 1], metallicFactor: 0, roughnessFactor: 1 },
  ...(alpha ? { alphaMode: 'BLEND', doubleSided: true } : {}),
}));
const MAT = Object.fromEntries(MATERIALS.map((m, i) => [m.name, i]));

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

// One primitive's triangle soup: flat-shaded, so every face carries its own vertices.
function soup() {
  return { pos: [], nrm: [], idx: [], lines: false };
}
function quad(s, a, b, c, d) {
  const u = a.map((v, i) => b[i] - v), w = a.map((v, i) => d[i] - v);
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const l = Math.hypot(...n);
  const base = s.pos.length / 3;
  for (const p of [a, b, c, d]) { s.pos.push(...p); s.nrm.push(n[0] / l, n[1] / l, n[2] / l); }
  s.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
function segment(s, a, b) {
  const base = s.pos.length / 3;
  s.pos.push(...a, ...b);
  s.idx.push(base, base + 1);
}

// A box in node-local units [0..w] × [0..h] × [0..d]: top to `top`, the rest to `side`.
// Winding is counter-clockwise seen from outside.
function box(top, side, w, h, d) {
  const P = (x, y, z) => [x, y, z];
  quad(top, P(0, h, 0), P(0, h, d), P(w, h, d), P(w, h, 0));
  quad(side, P(0, 0, 0), P(w, 0, 0), P(w, 0, d), P(0, 0, d));
  quad(side, P(0, 0, d), P(w, 0, d), P(w, h, d), P(0, h, d));
  quad(side, P(w, 0, 0), P(0, 0, 0), P(0, h, 0), P(w, h, 0));
  quad(side, P(w, 0, d), P(w, 0, 0), P(w, h, 0), P(w, h, d));
  quad(side, P(0, 0, 0), P(0, 0, d), P(0, h, d), P(0, h, 0));
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
  for (const [x, z] of ring) { cap.pos.push(x, t, z); cap.nrm.push(0, 1, 0); }
  for (let k = 0; k < SEG; k++) cap.idx.push(base, base + 1 + ((k + 1) % SEG), base + 1 + k);
  for (let k = 0; k < SEG; k++) {
    const [x1, z1] = ring[k], [x2, z2] = ring[(k + 1) % SEG];
    quad(side, [x1, y0, z1], [x1, t, z1], [x2, t, z2], [x2, y0, z2]);
    const k2 = 1 + PROUD / r;
    segment(edge, [cx + (x1 - cx) * k2, t + PROUD, cz + (z1 - cz) * k2], [cx + (x2 - cx) * k2, t + PROUD, cz + (z2 - cz) * k2]);
  }
}

// A part's mesh, in node-local units with its plan min corner at the origin.
function partMesh(part, ghost) {
  const g = (k) => (ghost ? `ghost-${k}` : k);
  const prims = new Map();
  const at = (mat, lines = false) => {
    if (!prims.has(mat)) prims.set(mat, { ...soup(), lines });
    return prims.get(mat);
  };
  const w = part.ws, d = part.ds, h = heightOf(part) / PITCH;
  box(at(g('cap')), at(g('flank')), w, h, d);
  boxEdges(at(g('edge'), true), w, h, d);
  if (part.kind !== 'ground') {
    const rings = new Set(part.rings ?? []);
    for (let i = 0; i < part.ws; i++)
      for (let j = 0; j < part.ds; j++) {
        const key = `${i},${j}`;
        const named = part.named?.get(key);
        const capMat = named?.edge === 'skr' ? 'seat' : named || rings.has(key) ? 'ring' : g('cap');
        stud(at(capMat), at(g('flank')), at(g('edge'), true), i + 0.5, j + 0.5, h);
      }
  }
  return [...prims].map(([mat, s]) => ({ mat: MAT[mat], ...s }));
}

/**
 * The seated model as a GLB. `explode` maps a part id to its lift in plan units;
 * each lifted part's node is animated by `assemble` from seated + lift to seated.
 * @returns {Buffer}
 */
export function brickGlb(parts, { explode = new Map() } = {}) {
  const [ccx, ccy] = planCentre(parts);
  const boxes = seatedBoxes(parts);
  const chunks = [];
  let offset = 0;
  const views = [], accessors = [];
  const push = (typed, target) => {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (bytes.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) });
    chunks.push(bytes, Buffer.alloc(pad));
    offset += bytes.length + pad;
    return views.length - 1;
  };
  const accessor = (typed, type, componentType, target, minmax) => {
    const count = typed.length / { SCALAR: 1, VEC3: 3 }[type];
    accessors.push({ bufferView: push(typed, target), componentType, count, type, ...minmax });
    return accessors.length - 1;
  };
  const bounds = (flat) => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < flat.length; i += 3)
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], flat[i + k]); max[k] = Math.max(max[k], flat[i + k]); }
    return { min: min.map((v) => Math.fround(v)), max: max.map((v) => Math.fround(v)) };
  };

  const meshes = [], nodes = [], channels = [], samplers = [];
  let triangles = 0;
  const times = accessor(new Float32Array([0, ASSEMBLE_SECONDS]), 'SCALAR', 5126, undefined, { min: [0], max: [ASSEMBLE_SECONDS] });
  for (const b of boxes) {
    const part = b.m;
    const primitives = partMesh(part, Boolean(part.dash)).map((p) => {
      const position = accessor(new Float32Array(p.pos), 'VEC3', 5126, 34962, bounds(p.pos));
      const big = p.pos.length / 3 > 65535;
      const indices = accessor(big ? new Uint32Array(p.idx) : new Uint16Array(p.idx), 'SCALAR', big ? 5125 : 5123, 34963);
      if (p.lines) return { attributes: { POSITION: position }, indices, material: p.mat, mode: 1 };
      triangles += p.idx.length / 3;
      const normal = accessor(new Float32Array(p.nrm), 'VEC3', 5126, 34962);
      return { attributes: { POSITION: position, NORMAL: normal }, indices, material: p.mat };
    });
    const name = `${part.kind}-${part.id}`;
    meshes.push({ name, primitives });
    const seat = [(b.x - ccx) / PITCH, b.z0 / PITCH, (b.y - ccy) / PITCH];
    nodes.push({ name, mesh: meshes.length - 1, translation: seat });
    const lift = explode.get(part.id);
    if (lift) {
      const from = [seat[0], seat[1] + lift / PITCH, seat[2]];
      samplers.push({ input: times, output: accessor(new Float32Array([...from, ...seat]), 'VEC3', 5126), interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: nodes.length - 1, path: 'translation' } });
    }
  }
  for (const id of explode.keys())
    if (!boxes.some((b) => b.m.id === id)) throw new Error(`brick-glb: explode names part ${id}, which the model does not carry`);
  nodes.push({ name: 'model', children: nodes.map((_, i) => i) });

  const bin = Buffer.concat(chunks);
  const gltf = {
    asset: { version: '2.0', generator: 'www/atlas.lit-ui-router.dev/generator/brick-glb.mjs' },
    scene: 0,
    scenes: [{ name: 'the brick assembly', nodes: [nodes.length - 1] }],
    nodes,
    meshes,
    materials: MATERIALS,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
    animations: channels.length ? [{ name: 'assemble', channels, samplers }] : [],
  };
  const json = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonPad = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPad.length + 8 + bin.length, 8);
  const chunk = (type, body) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(body.length, 0);
    h.writeUInt32LE(type, 4);
    return Buffer.concat([h, body]);
  };
  const glb = Buffer.concat([header, chunk(0x4e4f534a, jsonPad), chunk(0x004e4942, bin)]);
  return Object.assign(glb, { triangles });
}

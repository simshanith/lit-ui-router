// One glTF binary per sheet 2C build, on brick-glb.mjs's materials, studs and clip:
// the ground slab, each runtime a stack of thin plates scored per plate with studs on
// its top plate only, each brick in its hue, and one clip, `assemble`, that lifts every
// brick off its seat along assembleMotion while the plates stay put. A dashed leader
// hangs from each lifted brick to every stud it seats on, and a cord, a string with end
// studs, runs from a ringed stud on a brick's top to a ringed stud of each runtime it
// reaches but does not stand on.
//
// Axes as brick-glb.mjs: plan x → X, plan y → Z, height → Y, one unit a stud pitch,
// centred on the ground slab. A stud's mesh is written once per material set and
// placed by child nodes, so a build's studs cost a node each.

import { bounds, box, glbWriter, packGlb, quad, segment, soup } from './glb.mjs';
import { CORD_CAP, cordCurve } from './connector-iso.mjs';
import { ASSEMBLE_SECONDS, PITCH, assembleMotion, boxEdges, materialsFor, stud } from './brick-glb.mjs';

/** The budget each build's binary stays inside, asserted at build. */
export const BUILD_GLB_BUDGET = 100 * 1024;

/** A build's plan centre in plan units: its ground slab's. */
export const centreOf = (model) => [model.ground.x + model.ground.w / 2, model.ground.y + model.ground.d / 2];

/** A plan point and height as model coordinates [X, Y, Z]. */
export const atModel = (model, x, y, z) => {
  const [cx, cy] = centreOf(model);
  return [(x - cx) / PITCH, z / PITCH, (y - cy) / PITCH];
};

/** The explosion: each brick's drawn lift above its seat, keyed by brick number, and the parts assembleMotion reads. */
export const explodeOf = (model) => ({
  parts: model.bricks.map((b) => ({ id: b.n, on: b.on ?? b.seat ?? b.drops[0].on })),
  explode: new Map(model.bricks.map((b) => [b.n, b.lift])),
});

const DASH = 1 / 2;
/** A build as a GLB, with its triangle count. */
export function buildGlb(model) {
  const { accessors, bufferViews, accessor, indices: indexed, bin: packed } = glbWriter();
  const { materials, index } = materialsFor(model.bricks.map((b) => ({ id: b.n, hue: b.hue ?? undefined })));
  const meshes = [], nodes = [], roots = [], channels = [], samplers = [];
  let triangles = 0;
  const primitive = (s, mat) => {
    const position = accessor(new Float32Array(s.pos), 'VEC3', 5126, 34962, bounds(s.pos));
    const indices = indexed(s.idx, s.pos.length / 3);
    if (s.lines) return { attributes: { POSITION: position }, indices, material: index[mat], mode: 1 };
    triangles += s.idx.length / 3;
    return { attributes: { POSITION: position, NORMAL: accessor(new Float32Array(s.nrm), 'VEC3', 5126, 34962), COLOR_0: accessor(new Float32Array(s.col), 'VEC3', 5126, 34962) }, indices, material: index[mat] };
  };
  const mesh = (name, prims) => {
    meshes.push({ name, primitives: prims.filter(([s]) => s.idx.length).map(([s, mat]) => primitive(s, mat)) });
    return meshes.length - 1;
  };
  const node = (n, root = true) => {
    nodes.push(n);
    if (root) roots.push(nodes.length - 1);
    return nodes.length - 1;
  };
  const lines = () => ({ ...soup(), lines: true });
  // a cuboid in its materials, edged in ink, with `extra` line soups on it
  const cuboid = (name, w, h, d, [cap, flank, edge], extra = []) => {
    const c = soup(), f = soup(), e = lines();
    box(c, f, w, h, d);
    boxEdges(e, w, h, d);
    return mesh(name, [[c, cap], [f, flank], [e, edge], ...extra]);
  };
  // one stud's geometry, written once; a mesh per material set over the same accessors, placed by child nodes
  const one = [soup(), soup(), lines()];
  stud(...one, 0, 0, 0);
  const shared = one.map((s) => primitive(s, 'cap'));
  const studTris = one.reduce((a, s) => a + (s.lines ? 0 : s.idx.length / 3), 0);
  triangles -= studTris;
  const studs = new Map();
  const studMesh = (mats) => {
    const key = mats.join('|');
    if (!studs.has(key)) {
      meshes.push({ name: `stud-${mats.join('-')}`, primitives: shared.map((p, k) => ({ ...p, material: index[mats[k]] })) });
      studs.set(key, meshes.length - 1);
    }
    return studs.get(key);
  };
  const studNodes = (ws, ds, h, rings, mats) => {
    const ringSet = new Set(rings), kids = [];
    triangles += ws * ds * studTris;
    for (let i = 0; i < ws; i++)
      for (let j = 0; j < ds; j++)
        kids.push(node({ mesh: studMesh(ringSet.has(`${i},${j}`) ? ['ring', mats[1], mats[2]] : mats), translation: [i + 0.5, h, j + 0.5] }, false));
    return kids;
  };
  const at = (x, y, z) => atModel(model, x, y, z);

  const g = model.ground;
  node({ name: 'ground', mesh: cuboid('ground', g.w / PITCH, g.h / PITCH, g.d / PITCH, ['cap', 'flank', 'edge']), translation: at(g.x, g.y, 0) });
  for (const p of model.plates) {
    const mats = p.optional ? ['ghost-cap', 'ghost-flank', 'ghost-edge'] : ['cap', 'flank', 'edge'];
    const one = p.h / p.plates;
    if (p.full) {
      // the full plates are one body, scored at every plate, every third an ink course line
      const w = p.shape[0], d = p.shape[1], faint = lines(), course = lines();
      for (let k = 1; k < p.full; k++) {
        const y = (k * one) / PITCH, s = k % 3 ? faint : course;
        segment(s, [0, y, 0], [w, y, 0]);
        segment(s, [w, y, 0], [w, y, d]);
        segment(s, [w, y, d], [0, y, d]);
        segment(s, [0, y, d], [0, y, 0]);
      }
      node({ name: `plate-${p.letter}-body`, mesh: cuboid(`plate-${p.letter}-body`, w, (p.full * one) / PITCH, d, mats, [[faint, 'ghost-edge'], [course, mats[2]]]), translation: at(p.x, p.y, p.z0) });
    }
    const [tw, td] = p.topShape, th = one / PITCH;
    const top = node({ name: `plate-${p.letter}`, mesh: cuboid(`plate-${p.letter}`, tw, th, td, mats), translation: at(p.x + p.topOff[0] * PITCH, p.y + p.topOff[1] * PITCH, p.z0 + p.full * one) });
    nodes[top].children = studNodes(tw, td, th, p.rings, mats);
  }

  const { parts, explode } = explodeOf(model);
  const motion = assembleMotion(parts, explode);
  const times = accessor(new Float32Array(motion.us.map((u) => u * ASSEMBLE_SECONDS)), 'SCALAR', 5126, undefined, { min: [0], max: [ASSEMBLE_SECONDS] });
  const animate = (target, path, keys) => {
    samplers.push({ input: times, output: accessor(new Float32Array(keys), 'VEC3', 5126), interpolation: 'LINEAR' });
    channels.push({ sampler: samplers.length - 1, target: { node: target, path } });
  };
  const byN = new Map(model.bricks.map((b) => [b.n, b])), brickNode = new Map();
  for (const b of model.bricks) {
    const mats = b.hue ? [`cap-${b.n}`, `flank-${b.n}`, 'edge'] : ['cap', 'flank', 'edge'];
    const h = b.h / PITCH, seat = at(b.x, b.y, b.z0);
    const i = node({ name: `brick-${b.n}`, mesh: cuboid(`brick-${b.n}`, b.ws, h, b.ds, mats), translation: seat });
    nodes[i].children = studNodes(b.ws, b.ds, h, b.rings, mats);
    brickNode.set(b.n, i);
    animate(i, 'translation', motion.us.flatMap((u) => [seat[0], seat[1] + motion.rise(b.n, u) / PITCH, seat[2]]));
  }
  // a leader: a unit dashed plumb line from the stud it seats on, scaled to the gap and riding a lifted support
  for (const b of model.bricks)
    b.drops.forEach((drop, k) => {
      const under = byN.get(drop.on), foot = at(drop.x, drop.y, b.z0);
      const floor = motion.us.map((u) => (under ? motion.rise(under.n, u) / PITCH : 0));
      // a zero scale is singular, so a seated leader keeps a hair of length
      const gap = motion.us.map((u, j) => Math.max(motion.rise(b.n, u) / PITCH - floor[j], 1e-4));
      const dashes = Math.max(2, Math.round(Math.max(...gap) / DASH)), p = 1 / (dashes - 0.5), e = lines();
      for (let d = 0; d < dashes; d++) segment(e, [0, d * p, 0], [0, d * p + p / 2, 0]);
      const i = node({ name: `leader-${b.n}-${k}`, mesh: mesh(`leader-${b.n}-${k}`, [[e, 'edge']]), translation: [foot[0], foot[1] + floor.at(-1), foot[2]], scale: [1, gap.at(-1), 1] });
      animate(i, 'scale', gap.flatMap((v) => [1, v, 1]));
      if (floor.some(Boolean)) animate(i, 'translation', floor.flatMap((y) => [foot[0], foot[1] + y, foot[2]]));
    });
  // a cord's cap: a round 1×1 a plate tall in ink, written once and seated on each stud a cord ends on
  let capIndex = null;
  const capMesh = () => (capIndex ??= (() => {
    const c = soup(), r = CORD_CAP.r / PITCH, t = CORD_CAP.h / PITCH, n = 12;
    const ring = Array.from({ length: n }, (_, k) => [r * Math.cos((k / n) * Math.PI * 2), r * Math.sin((k / n) * Math.PI * 2)]);
    const base = c.pos.length / 3;
    c.pos.push(0, t, 0); c.nrm.push(0, 1, 0); c.col.push(1, 1, 1);
    for (const [x, z] of ring) { c.pos.push(x, t, z); c.nrm.push(0, 1, 0); c.col.push(1, 1, 1); }
    for (let k = 0; k < n; k++) c.idx.push(base, base + 1 + ((k + 1) % n), base + 1 + k);
    for (let k = 0; k < n; k++) {
      const [x1, z1] = ring[k], [x2, z2] = ring[(k + 1) % n];
      quad(c, [x1, 0, z1], [x1, t, z1], [x2, t, z2], [x2, 0, z2]);
    }
    return mesh('cord-cap', [[c, 'edge']]);
  })());
  // a cord: the brick's cap rides its brick, the plate's stays, and the chain along the sheet's curve hangs from the plate's
  // cap, scaled per axis so its brick end follows the lift and the chain stretches with it
  for (const c of model.cords) {
    const b = byN.get(c.n), curve = cordCurve(c.from, c.to);
    nodes[brickNode.get(c.n)].children.push(node({ name: `cord-cap-${c.n}-${c.letter}`, mesh: capMesh(), translation: [(c.from[0] - b.x) / PITCH, b.h / PITCH, (c.from[1] - b.y) / PITCH] }, false));
    node({ name: `cord-cap-${c.letter}-${c.n}`, mesh: capMesh(), translation: at(...c.to) });
    const foot = at(...curve.B), head = at(...curve.A), span0 = head.map((v, k) => v - foot[k]);
    const norm = curve.pts.map((p) => at(...p).map((v, k) => (Math.abs(span0[k]) > 1e-6 ? (v - foot[k]) / span0[k] : 0)));
    const chain = lines();
    for (let k = 1; k < norm.length; k++) segment(chain, norm[k - 1], norm[k]);
    const span = motion.us.map((u) => span0.map((v, k) => (Math.abs(v) > 1e-6 ? v : 1e-4) + (k === 1 ? motion.rise(c.n, u) / PITCH : 0)));
    const i = node({ name: `cord-${c.n}-${c.letter}`, mesh: mesh(`cord-${c.n}-${c.letter}`, [[chain, 'edge']]), translation: foot, scale: span.at(-1) });
    animate(i, 'scale', span.flat());
  }
  nodes.push({ name: 'model', children: roots });

  const bin = packed();
  const gltf = {
    asset: { version: '2.0', generator: 'www/atlas.lit-ui-router.dev/generator/builds-glb.mjs' },
    scene: 0,
    scenes: [{ name: `build ${model.numeral}, ${model.name}`, nodes: [nodes.length - 1] }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
    animations: [{ name: 'assemble', channels, samplers }],
  };
  const glb = packGlb(gltf, bin);
  if (glb.length > BUILD_GLB_BUDGET) throw new Error(`builds-glb: build ${model.numeral} is ${glb.length} bytes, over its ${BUILD_GLB_BUDGET}`);
  return Object.assign(glb, { triangles });
}

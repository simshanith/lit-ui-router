import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, keyRow, npmUrl } from './helpers.mjs';
import { brickKit, paintOrder } from './brick-iso.mjs';
import { BRICK_MODEL, BRICK_ROWS, EXPLODE, STUDS, SLOC_PER_STUD, FILES_PER_COURSE } from './sheet2.mjs';

const P = 's2c';

// ---- census: runtimes from census-peers.json, builds from census-builds.json, the family from census-bricks.json, joints from census-couplings.json ----
const PEERS = JSON.parse(readFileSync(new URL('../data/census-peers.json', import.meta.url), 'utf8'));
const BUILDS = JSON.parse(readFileSync(new URL('../data/census-builds.json', import.meta.url), 'utf8'));
const BRICKS = JSON.parse(readFileSync(new URL('../data/census-bricks.json', import.meta.url), 'utf8'));
const COUPLINGS = JSON.parse(readFileSync(new URL('../data/census-couplings.json', import.meta.url), 'utf8'));
for (const [name, plate] of [['census-builds.json', BUILDS], ['census-couplings.json', COUPLINGS], ['census-bricks.json', BRICKS]])
  if (plate.sha !== PEERS.sha) throw new Error(`sheet 2C: census-peers.json is at ${PEERS.sha} but ${name} at ${plate.sha}`);
const COUNTED = `counted at ${PEERS.ref} @ ${PEERS.sha} (${BUILDS.generatedAtTime.slice(0, 10)})`;
const fmt = (v) => v.toLocaleString('en-US');
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const Cap = (w) => w[0].toUpperCase() + w.slice(1);
const listOf = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const shapeName = ([w, d]) => `${w}×${d}`;
const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
const courseWord = (c) => plural(c, 'course');

// ---- the family: sheet 2's nine bricks at sheet 2's own mould, and the lint plugin at the census's ----
const CORE = '@uirouter/core';
const brickRow = (name) => {
  const r = BRICKS.rows.find((x) => x.name === name);
  if (!r) throw new Error(`sheet 2C: census-bricks.json has no row named ${name}`);
  return r;
};
const LINT = brickRow('eslint-plugin-lit-ui-router');
const FAMILY = [
  ...BRICK_ROWS.map((b) => ({ n: b.n, name: b.name, disp: b.disp, ver: b.ver, files: b.files, sloc: b.sloc, shape: b.shape, courses: b.courses })),
  { n: BRICK_ROWS.length + 1, name: LINT.name, disp: LINT.name, ver: LINT.version, files: LINT.files, sloc: LINT.sloc, shape: LINT.shape.split('x').map(Number), courses: LINT.courses },
];
const FAMILY_NAMES = new Set(BRICKS.rows.map((r) => r.name).filter((n) => n !== CORE));
if (FAMILY.length !== FAMILY_NAMES.size || FAMILY.some((b) => !FAMILY_NAMES.has(b.name)))
  throw new Error(`sheet 2C: the census publishes [${[...FAMILY_NAMES]}] but the family drawn is [${FAMILY.map((b) => b.name)}]`);
const FB = (n) => {
  const b = FAMILY.find((x) => x.n === n);
  if (!b) throw new Error(`sheet 2C: no family brick ${n}`);
  return b;
};
const byName = (name) => {
  const b = FAMILY.find((x) => x.name === name);
  if (!b) throw new Error(`sheet 2C: ${name} is not a family brick`);
  return b;
};
const peersOf = (name) => COUPLINGS.rows.filter((r) => r.kind === 'peer' && r.from === name).map((r) => r.to);

// ---- the runtimes: every external peer target in the couplings, never listed by hand ----
const RT_ROWS = COUPLINGS.rows.filter((r) => r.kind === 'peer' && r.to !== CORE && !FAMILY_NAMES.has(r.to));
const RT_NAMES = [...new Set(RT_ROWS.map((r) => r.to))].sort();
const PLATE_NAMES = PEERS.rows.map((r) => r.name).sort();
if (PLATE_NAMES.join() !== RT_NAMES.join())
  throw new Error(`sheet 2C: the couplings peer [${RT_NAMES}] outside the family but census-peers.json rows [${PLATE_NAMES}]`);
for (const row of PEERS.rows) {
  const mine = RT_ROWS.filter((r) => r.to === row.name);
  const froms = mine.map((r) => r.from).sort();
  if (froms.join() !== [...row.peeredBy].sort().join())
    throw new Error(`sheet 2C: ${row.name} is peered by [${froms}] in the couplings but [${row.peeredBy}] on the plate`);
  if (row.optional !== mine.every((r) => r.optional))
    throw new Error(`sheet 2C: ${row.name} optional=${row.optional} on the plate disagrees with its couplings`);
  if (!Array.isArray(row.peers)) throw new Error(`sheet 2C: ${row.name} carries no peers list`);
  // the ground rule: a runtime peers none of the family, and none of the other runtimes on this plate
  const up = row.peers.filter((p) => FAMILY_NAMES.has(p) || p === CORE);
  if (up.length) throw new Error(`sheet 2C: ${row.name} peers the family (${up}) — the stacking would run both ways`);
  const across = row.peers.filter((p) => PLATE_NAMES.includes(p));
  if (across.length) throw new Error(`sheet 2C: ${row.name} peers ${across} — one runtime would stand on another`);
  if (!(row.sloc > 0) || !row.build) throw new Error(`sheet 2C: ${row.name} carries no one-build measure`);
  if (!row.closure || !(row.closure.sloc > 0) || !Array.isArray(row.closure.packages))
    throw new Error(`sheet 2C: ${row.name} carries no closure`);
}

// ---- scale rule ------------------------------------------------------------------
// One scale: sheet 2's. A runtime is BASEPLATES at sheet 2's baseplate footprint,
// 8×6 = 48 studs, one stud per 150 sloc of its one shipped build, laid a plate at
// a time and stacked when it overflows; under 48 studs it is one plate at its own
// size, the nearest rectangle — depth √studs rounded up, width studs ÷ depth rounded up.
const BASEPLATE = [8, 6];
const BASEPLATE_STUDS = BASEPLATE[0] * BASEPLATE[1];
const PLATE_SHAPE = (studs) => {
  const d = Math.ceil(Math.sqrt(studs));
  return [Math.ceil(studs / d), d];
};
// identity is alphabetical: letters, numbers, legend and schedule never move with mass
const RUNTIMES = [...PEERS.rows].sort((a, b) => a.name.localeCompare(b.name)).map((r, i) => {
  const studs = STUDS(r.sloc);
  const stacked = studs >= BASEPLATE_STUDS;
  const full = stacked ? Math.floor(studs / BASEPLATE_STUDS) : 0, rem = studs - full * BASEPLATE_STUDS;
  const topShape = stacked ? (rem ? PLATE_SHAPE(rem) : BASEPLATE) : PLATE_SHAPE(studs);
  const shape = stacked ? BASEPLATE : topShape;
  return { n: FAMILY.length + 1 + i, letter: String.fromCharCode(65 + i), name: r.name, ver: r.version, range: r.range, optional: r.optional, published: r.published,
    files: r.files, sloc: r.sloc, build: r.build, shippedFiles: r.shippedFiles, shippedSloc: r.shippedSloc, closure: r.closure, peeredBy: r.peeredBy, studs,
    stacked, full, rem, plates: full + (rem ? 1 : 0), shape, topShape, topOff: [shape[0] - topShape[0], shape[1] - topShape[1]] };
});
for (const r of RUNTIMES) {
  if (r.plates !== Math.ceil(r.studs / BASEPLATE_STUDS)) throw new Error(`sheet 2C: ${r.name} stacks ${r.plates} plates for ${r.studs} studs`);
  if (r.stacked && r.shape !== BASEPLATE) throw new Error(`sheet 2C: ${r.name} stacks on a ${shapeName(r.shape)} footprint`);
  const held = r.full * BASEPLATE_STUDS + r.topShape[0] * r.topShape[1];
  if (held < r.studs || held - r.studs >= r.topShape[1]) throw new Error(`sheet 2C: ${r.name} holds ${held} studs on its plates for ${r.studs}`);
  if (!r.stacked && (r.plates !== 1 || r.topShape[0] * r.topShape[1] >= BASEPLATE_STUDS + r.topShape[1])) throw new Error(`sheet 2C: ${r.name} is one plate of ${shapeName(r.shape)} for ${r.studs} studs`);
}
const plateWord = (r) => (r.stacked ? `${plural(r.plates, 'plate')} · ${r.full} of ${shapeName(BASEPLATE)}${r.rem ? ` + a ${shapeName(r.topShape)}` : ''}` : `1 plate · ${shapeName(r.shape)}`);
const RT = (name) => {
  const r = RUNTIMES.find((x) => x.name === name);
  if (!r) throw new Error(`sheet 2C: no runtime ${name}`);
  return r;
};
const LETTERS = `A–${RUNTIMES.at(-1).letter}`;
const LINKABLE = new Set([...PLATE_NAMES, ...FAMILY_NAMES, CORE]);
const npmLink = (name, text = `<code>${name}</code>`) => {
  if (!LINKABLE.has(name)) throw new Error(`sheet 2C: ${name} is on no plate this sheet reads`);
  return `<a href="${npmUrl(name)}">${text}</a>`;
};

// ---- the builds: the distinct sets of family parts the consumers pin -------------------
const KIND = { 'sample-app': 'sample app', 'docs-site': 'docs site', example: 'example' };
const kindOf = (name) => {
  const c = BUILDS.consumers.find((x) => x.name === name);
  if (!c) throw new Error(`sheet 2C: no consumer ${name}`);
  if (!KIND[c.kind]) throw new Error(`sheet 2C: consumer ${name} is a ${c.kind}, which the caption has no word for`);
  return KIND[c.kind];
};
if (BUILDS.consumers.length !== BUILDS.totals.consumers || BUILDS.builds.length !== BUILDS.totals.builds)
  throw new Error('sheet 2C: census-builds.json totals disagree with its rows');
for (const b of BUILDS.builds) if (!Array.isArray(b.pinned) || !Array.isArray(b.runtimesByPeer)) throw new Error('sheet 2C: a build row carries no pinned variants');
for (const c of BUILDS.consumers) if (!Array.isArray(c.pinned)) throw new Error(`sheet 2C: consumer ${c.name} carries no pinned list`);
if (BUILDS.basis?.atlasApp !== null || !BUILDS.basis?.note) throw new Error('sheet 2C: the notes say the atlas app is off the measured tree, but basis says otherwise');
for (const [name, k] of Object.entries(BUILDS.totals.carrying)) {
  byName(name);
  const seen = BUILDS.consumers.filter((c) => c.parts.includes(name)).length;
  if (seen !== k) throw new Error(`sheet 2C: ${name} is carried by ${seen} consumers but totals.carrying says ${k}`);
}
if (Object.keys(BUILDS.totals.carrying).length !== FAMILY.length) throw new Error('sheet 2C: totals.carrying does not cover the family');
const EMPTY = BUILDS.builds.filter((b) => b.parts.length === 0);
if (EMPTY.length !== BUILDS.totals.empty) throw new Error(`sheet 2C: ${EMPTY.length} builds have no part but totals.empty is ${BUILDS.totals.empty}`);
// numbered from most consumers down, ties alphabetical by parts
// a build's parts are its pinned manifests closed over the family peers, so a model draws every family part a consumer installs
const BUILT = BUILDS.builds.filter((b) => b.parts.length).map((b) => ({ ...b, parts: [...b.parts].sort(), key: [...b.parts].sort().join(',') }))
  .sort((a, b) => b.consumers.length - a.consumers.length || a.key.localeCompare(b.key))
  .map((b, i) => ({ ...b, k: i + 1, numeral: ROMAN[i + 1], bricks: b.parts.map(byName).sort((x, y) => x.n - y.n) }));
const CARRY = (b) => BUILDS.totals.carrying[b.name];
const UNUSED_PARTS = FAMILY.filter((b) => CARRY(b) === 0);
const plateOfRow = (b) => PEERS.rows.find((r) => r.name === b.name);

// ---- the reactivity claim: no build mixes two of the reactivity runtimes ------------------
const REACTIVITY = ['effect', 'mobx', 'signal-polyfill'].map((n) => RT(n).name);
const reaches = (name, seen = new Set()) => {
  if (seen.has(name)) return seen;
  seen.add(name);
  for (const p of peersOf(name)) if (FAMILY_NAMES.has(p)) reaches(p, seen);
  return seen;
};
const reactivityOf = (build) => [...new Set(build.parts.flatMap((p) => [...reaches(p)].flatMap(peersOf).filter((t) => REACTIVITY.includes(t))))].sort();
for (const b of BUILT) if (reactivityOf(b).length > 1) throw new Error(`sheet 2C: build ${b.numeral} mixes ${reactivityOf(b)}`);
const BINDINGS = FAMILY.filter((b) => [...reaches(b.name)].flatMap(peersOf).some((t) => REACTIVITY.includes(t)));

// ---- each model: its parts on the plates they peer, from the couplings --------------------
const standsOn = (n) => {
  const m = BRICK_MODEL.find((x) => x.id === n);
  return m && typeof m.on === 'number' ? m.on : null;
};
const modelOf = (n) => BRICK_MODEL.find((m) => m.id === n);
const U = 14;
const K = U / 40;
const { CRS, SH, RY, pt, brick, block, stud } = brickKit({ U, p: P });
// a plate is a third of a course — the LEGO fact; brickKit's half-course PT is not used for runtime plates
const PLATE_H = CRS / 3;
if (3 * PLATE_H !== CRS) throw new Error('sheet 2C: three plates are one course');
// a stack of baseplates: full plates as one body scored at every plate (every third heavier — a course),
// the remainder on top at its own size, and studs on the top plate only
let STUDS_DRAWN = 0;
function stack(ox, oy, r, { x, y, z0, ring }) {
  const w = r.shape[0] * U, d = r.shape[1] * U;
  const edge = r.optional ? 'sks' : 'sk', da = r.optional ? ' stroke-dasharray="6 4"' : '';
  const dashed = (svg) => (r.optional ? svg.replaceAll(`class="${edge} fnone"`, `class="${edge} fnone"${da}`) : svg);
  const out = [];
  if (r.full) {
    out.push(dashed(block(ox, oy, x, y, w, d, z0, r.full * PLATE_H, { edge })));
    for (let k = 1; k < r.full; k++) {
      const z = z0 + k * PLATE_H;
      const a = pt(ox, oy, x, y + d, z), b = pt(ox, oy, x + w, y + d, z), c = pt(ox, oy, x + w, y, z);
      out.push(`<path d="M${a} L${b} L${c}" class="${k % 3 ? 'skf' : 'sks'} fnone"${da}/>`);
    }
  }
  const tz = z0 + r.full * PLATE_H, tx = x + r.topOff[0] * U, ty = y + r.topOff[1] * U;
  out.push(dashed(block(ox, oy, tx, ty, r.topShape[0] * U, r.topShape[1] * U, tz, PLATE_H, { edge })));
  for (let i = 0; i < r.topShape[0]; i++) for (let j = 0; j < r.topShape[1]; j++) {
    out.push(stud(ox, oy, tx + (i + 0.5) * U, ty + (j + 0.5) * U, tz + PLATE_H, ring === `${i},${j}` ? { ...RING, extra: da } : { edge, cap: 'fp2', extra: da }));
    STUDS_DRAWN++;
  }
  return out.join('\n');
}
const GROUND_H = CRS;
const LIFT = 4 * CRS;
const RING = { edge: 'ska', cap: 'fp', ring: 'ska' };
const inside = (px, py, b) => px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.d;
const SMALL = 1.5 * U;
for (const build of BUILT) {
  const names = new Set(build.parts);
  build.plates = [];
  build.bricks.forEach((b) => {
    // a part stands on the part it peers when that part is in the build, as it does on sheet 2
    const base = standsOn(b.n);
    b.on = base !== null && names.has(FB(base).name) ? base : null;
    const seats = peersOf(b.name).filter((t) => PLATE_NAMES.includes(t) && build.runtimes.includes(t));
    b.seat = b.on === null && seats.length ? RT(seats[0]) : null;
    if (b.on === null && seats.length > 1) throw new Error(`sheet 2C: build ${build.numeral}: ${b.name} could seat on ${seats} — it seats on one`);
    b.groundWhy = b.on === null && !b.seat
      ? (peersOf(b.name).some((t) => PLATE_NAMES.includes(t)) ? `${listOf(peersOf(b.name).filter((t) => PLATE_NAMES.includes(t)).map((t) => RT(t).letter))} optional, pinned by no consumer` : `peers ${CORE} only`)
      : null;
  });
  // the plates under this model: every runtime a part peers, within the build's union; each plate once
  for (const b of build.bricks) for (const t of peersOf(b.name)) {
    if (!PLATE_NAMES.includes(t) || !build.runtimes.includes(t)) continue;
    if (!build.plates.some((p) => p.rt.name === t)) build.plates.push({ rt: RT(t), seated: [], reached: [] });
    const p = build.plates.find((p) => p.rt.name === t);
    (b.seat === RT(t) ? p.seated : p.reached).push(b);
  }
  build.unpeered = build.runtimes.filter((t) => !build.plates.some((p) => p.rt.name === t));
  // layout: plates along x in part order, each with its seated bricks and the bricks standing on them; ground bricks after
  build.parts_ = new Map();
  let cx = 0, dmax = 0;
  const ordered = [...build.plates].sort((a, b) => Math.min(...a.seated.map((x) => x.n), 99) - Math.min(...b.seated.map((x) => x.n), 99));
  const placeBrick = (b, x, y, z0) => {
    const m = modelOf(b.n);
    const ws = m ? m.ws : b.shape[0], ds = m ? m.ds : b.shape[1];
    const part = { id: b.n, x, y, w: ws * U, d: ds * U, ws, ds, z0, h: b.courses * CRS, rings: m?.rings ?? [] };
    build.parts_.set(b.n, part);
    dmax = Math.max(dmax, y + part.d);
    return part;
  };
  const standers = (base) => build.bricks.filter((b) => b.on === base.n);
  const placeStanders = (base, basePart) => {
    for (const b of standers(base)) {
      const m = modelOf(b.n), m0 = modelOf(base.n);
      const part = placeBrick(b, basePart.x + (m.x - m0.x) * K, basePart.y + (m.y - m0.y) * K, basePart.z0 + basePart.h + (EXPLODE.get(b.n) - EXPLODE.get(base.n)) * K);
      if (!(part.z0 > basePart.z0 + basePart.h)) throw new Error(`sheet 2C: brick ${b.n} would sink into brick ${base.n}`);
      const ring = basePart.rings.find((k) => {
        const [i, j] = k.split(',').map(Number);
        return !basePart.taken?.has(k) && inside(basePart.x + (i + 0.5) * U, basePart.y + (j + 0.5) * U, part);
      });
      if (!ring) throw new Error(`sheet 2C: brick ${b.n} stands over no ringed stud of brick ${base.n}`);
      (basePart.taken ??= new Set()).add(ring);
      const [i, j] = ring.split(',').map(Number);
      part.drop = [basePart.x + (i + 0.5) * U, basePart.y + (j + 0.5) * U, basePart.z0 + basePart.h];
      placeStanders(b, part);
    }
  };
  for (const p of ordered) {
    const r = p.rt;
    p.x = cx; p.y = 0; p.w = r.shape[0] * U; p.d = r.shape[1] * U; p.z0 = GROUND_H; p.h = r.plates * PLATE_H;
    let ext = p.w;
    for (const b of p.seated) {
      const m = modelOf(b.n);
      const ws = m ? m.ws : b.shape[0], ds = m ? m.ds : b.shape[1], w = ws * U, d = ds * U;
      const x = w <= p.w ? p.x + p.w - w : p.x, y = d <= p.d ? p.y + p.d - d : p.y;
      const part = placeBrick(b, x, y, p.z0 + p.h + LIFT + (ws * ds > r.topShape[0] * r.topShape[1] ? CRS : 0));
      let stud = null;
      for (let i = 0; i < r.topShape[0]; i++) for (let j = 0; j < r.topShape[1]; j++) {
        const px = p.x + (r.topOff[0] + i + 0.5) * U, py = p.y + (r.topOff[1] + j + 0.5) * U;
        if (inside(px, py, part) && (!stud || i + j > stud[0] + stud[1])) stud = [i, j, px, py];
      }
      if (!stud) throw new Error(`sheet 2C: build ${build.numeral}: brick ${b.n} stands over no stud of ${r.name}`);
      p.ring = `${stud[0]},${stud[1]}`;
      part.drop = [stud[2], stud[3], p.z0 + p.h];
      ext = Math.max(ext, x + w - p.x);
      placeStanders(b, part);
      for (const s of standers(b)) ext = Math.max(ext, build.parts_.get(s.n).x + build.parts_.get(s.n).w - p.x);
    }
    if (!p.ring) p.ring = `${r.topShape[0] - 1},${r.topShape[1] - 1}`;
    const [i, j] = p.ring.split(',').map(Number);
    p.ringAt = [p.x + (r.topOff[0] + i + 0.5) * U, p.y + (r.topOff[1] + j + 0.5) * U, p.z0 + p.h];
    dmax = Math.max(dmax, p.d);
    cx += ext + SMALL;
  }
  for (const b of build.bricks.filter((b) => b.groundWhy)) {
    const part = placeBrick(b, cx, 0, GROUND_H + LIFT);
    part.drop = [cx + U / 2, U / 2, GROUND_H];
    part.onGround = true;
    cx += part.w + SMALL;
  }
  build.box = { w: cx - SMALL, d: dmax };
  // every part of the build is placed, and nothing else; and every family peer of a drawn part is drawn in the same model
  const placed = [...build.parts_.keys()].map((n) => FB(n).name).sort();
  if (placed.join() !== build.parts.join()) throw new Error(`sheet 2C: build ${build.numeral} draws [${placed}] for parts [${build.parts}]`);
  for (const b of build.bricks) for (const p of peersOf(b.name)) if (FAMILY_NAMES.has(p) && !names.has(p)) throw new Error(`sheet 2C: build ${build.numeral} draws ${b.name} without its peer ${p}`);
  for (const p of build.plates) if (![...p.seated, ...p.reached].some((b) => peersOf(b.name).includes(p.rt.name))) throw new Error(`sheet 2C: build ${build.numeral} stands on ${p.rt.name}, which no part peers`);
}
// a big plate appears once: no two builds stand on the same plate of 100 studs or more
{
  const big = BUILT.flatMap((b) => b.plates.map((p) => p.rt)).filter((r) => r.studs >= 100);
  if (new Set(big).size !== big.length) throw new Error('sheet 2C: a big plate is drawn under two builds');
}
const STOOD = new Set(BUILT.flatMap((b) => b.plates.map((p) => p.rt)));
const SPARE_PLATES = RUNTIMES.filter((r) => !STOOD.has(r));
// the ground: one row in build order. A model behind another shares its screen column, and depth
// separates only half a stud of screen per stud of plan, so a stack behind a cluster is always overlapped;
// one row keeps every model in its own column
const GAP = 3 * U;
const BACK = [], FRONT = BUILT;
let fx = 0;
for (const b of FRONT) { b.ox = fx; b.oy = 0; fx += b.box.w + GAP; }
const XMAX = fx - GAP, YMAX = Math.max(...FRONT.map((b) => b.box.d));
const GROUND = { id: 'G', x: -U, y: -U, w: XMAX + 2 * U, d: YMAX + 2 * U, z0: 0, h: GROUND_H };
const BOXES = [GROUND];
for (const b of BUILT) {
  for (const p of b.plates) BOXES.push({ id: `${b.numeral}:${p.rt.letter}`, x: b.ox + p.x, y: b.oy + p.y, w: p.w, d: p.d, z0: p.z0, h: p.h, pl: p, build: b });
  for (const part of b.parts_.values()) BOXES.push({ ...part, id: `${b.numeral}:${part.id}`, x: b.ox + part.x, y: b.oy + part.y, drop: part.drop ? [b.ox + part.drop[0], b.oy + part.drop[1], part.drop[2]] : null, brick: FB(part.id), build: b });
}

// ---- extents and origin ----------------------------------------------------------------
let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
for (const b of BOXES)
  for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.d], [b.x + b.w, b.y + b.d]])
    for (const z of [b.z0, b.z0 + b.h]) {
      const [sx2, sy2] = pt(0, 0, x, y, z);
      minx = Math.min(minx, sx2); maxx = Math.max(maxx, sx2); miny = Math.min(miny, sy2 - 40); maxy = Math.max(maxy, sy2);
    }
const LEGEND_W = 310, LEFT = 20, TOP = 58;
const OX = +(LEFT + LEGEND_W + 30 - minx).toFixed(1), OY = +(TOP + 10 - miny).toFixed(1);
const ART_BOTTOM = OY + maxy;

// ---- the drawing ----------------------------------------------------------------------------
const drop = (px, py, zFrom, zTo) => {
  const [cx, y0] = pt(OX, OY, px, py, zFrom);
  const [cx2, yTo] = pt(OX, OY, px, py, zTo + SH);
  if (Math.abs(cx - cx2) > 0.25) throw new Error('sheet 2C: a drop would lean');
  const y1 = (yTo - RY - 1).toFixed(1);
  return `<line x1="${cx}" y1="${y0}" x2="${cx}" y2="${y1}" class="ska" stroke-dasharray="6 4"/>\n<circle cx="${cx}" cy="${y1}" r="2.2" class="fa"/>`;
};
const badge = (x, y, s, cls = 'ska fp', num = 'lbla', r = 9.5) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" class="${cls}"/>${txt(x.toFixed(1), (y + 3.6).toFixed(1), String(s), num, 'middle')}`;
const leader = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="skf"/>`;
const order = paintOrder(BOXES);
const assembly = order.map((i) => {
  const b = BOXES[i];
  if (b.id === 'G') return block(OX, OY, b.x, b.y, b.w, b.d, b.z0, b.h);
  if (b.pl) return stack(OX, OY, b.pl.rt, { x: b.x, y: b.y, z0: b.z0, ring: b.pl.ring });
  const fall = b.onGround ? drop(b.drop[0], b.drop[1], b.z0, b.drop[2] - SH).split('\n')[0] : drop(b.drop[0], b.drop[1], b.z0, b.drop[2]);
  return `${fall}\n${brick(OX, OY, b.x, b.y, b.ws, b.ds, b.brick.courses, { z0: b.z0, studEdge: 'sk', ringStuds: new Set(b.rings) })}`;
}).join('\n');
// a stack draws studs on its top plate only: one footprint of studs per stack drawn
if (STUDS_DRAWN !== BOXES.filter((b) => b.pl).reduce((a, b) => a + b.pl.rt.topShape[0] * b.pl.rt.topShape[1], 0)) throw new Error(`sheet 2C: ${STUDS_DRAWN} studs drawn — a hidden plate carries studs`);

// badges: a brick's number above its far roof corner, or at its near-left roof corner when a brick stands on it;
// a plate's letter above its ringed stud. Every leader ends on one of these, so none can end on an occluded point.
const ANCHOR = new Map();
const LETTER_AT = new Map();
for (const b of BOXES) {
  if (b.brick) {
    const carries = b.build.bricks.some((x) => x.on === b.brick.n);
    const [x, y] = carries ? pt(OX, OY, b.x, b.y + b.d, b.z0 + b.h) : pt(OX, OY, b.x, b.y, b.z0 + b.h);
    ANCHOR.set(b.id, carries ? [x - 13, y - 2] : [x, y - 13]);
  }
  if (b.pl) {
    const [rx, ry] = pt(OX, OY, b.build.ox + b.pl.ringAt[0], b.build.oy + b.pl.ringAt[1], b.pl.ringAt[2]);
    const at = [rx - 16, ry - 10];
    if (at[0] + 9.5 >= rx) throw new Error('sheet 2C: a letter badge sits on its drop line');
    // the badge stays under the seated brick's underside edge, read at the badge's own x on the two lower silhouette edges
    for (const seated of b.pl.seated) {
      const part = b.build.parts_.get(seated.n);
      const [L, N, R] = [[part.x, part.y + part.d], [part.x + part.w, part.y + part.d], [part.x + part.w, part.y]].map(([x, y]) => pt(OX, OY, b.build.ox + x, b.build.oy + y, part.z0));
      const edgeY = (x) => (x < L[0] || x > R[0] ? -Infinity : x <= N[0] ? L[1] + ((x - L[0]) / (N[0] - L[0])) * (N[1] - L[1]) : N[1] + ((x - N[0]) / (R[0] - N[0])) * (R[1] - N[1]));
      for (const x of [at[0] - 9.5, at[0], at[0] + 9.5])
        if (at[1] - 9.5 <= edgeY(x) + 1) throw new Error(`sheet 2C: plate ${b.pl.rt.letter}'s badge runs into brick ${seated.n}'s underside`);
    }
    LETTER_AT.set(b.id, at);
  }
}
const badges = [
  ...[...ANCHOR].map(([id, [x, y]]) => badge(x, y, id.split(':')[1])),
  ...[...LETTER_AT].map(([id, [x, y]]) => badge(x, y, id.split(':')[1])),
].join('\n');
{
  const all = [...ANCHOR.values(), ...LETTER_AT.values()];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
    if (Math.hypot(all[i][0] - all[j][0], all[i][1] - all[j][1]) < 24) throw new Error(`sheet 2C: two badges within 24px at ${all[i]} and ${all[j]}`);
}
const endsOnBadge = (p) => {
  if (!p || ![...ANCHOR.values(), ...LETTER_AT.values()].some(([ax, ay]) => ax === p[0] && ay === p[1])) throw new Error('sheet 2C: a leader ends off every badge');
  return p;
};

// ---- captions: one per model, derived from the plate -------------------------------------
const kindsLine = (b) => {
  const by = new Map();
  for (const c of b.consumers) by.set(kindOf(c), (by.get(kindOf(c)) ?? 0) + 1);
  return listOf([...by].map(([k, n]) => (n === 1 ? `${k.startsWith('e') ? 'an' : 'a'} ${k}` : `${WORD[n]} ${k}s`)));
};
const captionLines = (b) => {
  const plates = b.plates.map((p) => p.rt.letter);
  const ground = b.bricks.filter((x) => x.groundWhy);
  return [
    [`BUILD ${b.numeral}`, 'lblb'],
    [`brick${b.bricks.length > 1 ? 's' : ''} ${b.bricks.map((x) => x.n).join(' + ')}${plates.length ? ` · plate${plates.length > 1 ? 's' : ''} ${plates.join(' + ')}` : ' · on the ground'}`, 'lbla'],
    [plural(b.consumers.length, 'consumer'), 'lblf'],
    [kindsLine(b), 'lblf'],
    ...ground.flatMap((x) => [[`brick ${x.n} on the ground:`, 'lblf'], [x.groundWhy, 'lblf']]),
    ...(b.unpeered.length ? [[`${listOf(b.unpeered.map((t) => RT(t).letter))} pinned, peered by no part here`, 'lblf']] : []),
  ];
};
const corner = (b, which) => {
  const x = b.ox + (which === 'front' ? b.box.w : 0), y = b.oy + (which === 'front' ? b.box.d : 0);
  return pt(OX, OY, which === 'front' ? x + U : x, which === 'front' ? y + U : y, 0);
};
// a back-shelf model letters beside its cluster, the first to the left and the rest to the right, in the air over the back edge;
// a front-shelf model letters in an evenly spaced slot under the ground, a leader to its own front corner
const groundFront = pt(OX, OY, GROUND.x + GROUND.w, GROUND.y + GROUND.d, 0)[1];
const groundLeft = pt(OX, OY, GROUND.x, GROUND.y + GROUND.d, 0)[0];
const firstBadge = (b) => endsOnBadge(ANCHOR.get(`${b.numeral}:${b.bricks[0].n}`));
// each caption sits under its model's front corner, clear of the box's registers, and drops a row when it would
// run into a caption already placed
const CAP_W = 172, CAP_H = 76, ROW2 = 84;
const PLACED = [];
const cut = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const placeCaption = (fx, fy) => {
  const lx = Math.max(fx, LEFT + LEGEND_W + 10 + CAP_W / 2);
  let ly = fy + 72;
  const box = () => ({ x: lx - CAP_W / 2, y: ly - 12, w: CAP_W, h: CAP_H });
  while (PLACED.some((p) => cut(box(), p))) ly += ROW2;
  PLACED.push(box());
  return [lx, ly];
};
const captions = [
  ...BACK.map((b, i) => {
    const [cx, cy] = corner(b, 'far');
    const anchor = i === 0 ? 'end' : 'start';
    const x = i === 0 ? cx - 110 : cx + 100, y = cy - 118;
    const [ax, ay] = firstBadge(b);
    const lines = captionLines(b);
    return `${leader(i === 0 ? x + 6 : x - 6, y + 12, ax + (i === 0 ? -10 : 10), ay)}\n${lines.map(([s, cls], k) => txt(x, y + k * 12, s, cls, anchor)).join('\n')}`;
  }),
  ...[...FRONT].sort((a, b) => corner(a, 'front')[0] - corner(b, 'front')[0]).map((b) => {
    const [ax, ay] = firstBadge(b);
    const [fx, fy] = corner(b, 'front');
    const [lx, ly] = placeCaption(fx, fy);
    const lines = captionLines(b);
    return `${leader(ax, ay + 10, lx, ly - 14)}\n${lines.map(([s, cls], i) => txt(lx, ly + i * 12, s, cls, 'middle')).join('\n')}`;
  }),
].join('\n');
const LABEL_RIGHT = Math.max(...PLACED.map((p) => p.x + p.w));
const SLOT_BOTTOM = Math.max(...PLACED.map((p) => p.y + p.h));
// the plates lettered once each under the ground's back-right edge would repeat the legend; the letter badges carry them

// ---- the box: the parts legend, each family part with its carrying count ----------------------------------
const mini = brickKit({ U: 10, p: P });
const miniPlate = brickKit({ U: 4, p: P });
const miniOf = (kit, ws, ds, courses, dash, flat = false) => {
  const w = ws * kit.U, d = ds * kit.U, h = flat ? courses * kit.PT : courses * kit.CRS;
  const corners = [[0, 0], [w, 0], [0, d], [w, d]].flatMap(([x, y]) => [kit.pt(0, 0, x, y, 0), kit.pt(0, 0, x, y, h + (flat ? 0 : kit.SH * 2))]);
  const mx = Math.min(...corners.map(([x]) => x)), my = Math.min(...corners.map(([, y]) => y));
  const MX = Math.max(...corners.map(([x]) => x)), MY = Math.max(...corners.map(([, y]) => y));
  const draw = flat
    ? (ox, oy) => kit.block(ox - mx, oy - my, 0, 0, w, d, 0, h, { edge: dash ? 'sks' : 'sk' })
    : (ox, oy) => kit.brick(ox - mx, oy - my, 0, 0, ws, ds, courses, { dash, edge: dash ? 'sks' : 'sk', studEdge: dash ? 'sks' : 'sk' });
  return { w: MX - mx, h: MY - my, at: draw };
};
const carriedBy = (b) => (CARRY(b) ? `carried by ${plural(CARRY(b), 'consumer')}` : 'carried by none at the cabinet’s tree');
const LEGEND = [
  { head: `THE PARTS — ${WORD[FAMILY.length]} BRICKS AT SHEET 2’S MOULD` },
  ...FAMILY.map((b) => ({ b, fig: miniOf(mini, b.shape[0], b.shape[1], b.courses, CARRY(b) ? '' : '3 2'), name: b.disp, sub: `${shapeName(b.shape)} · ${courseWord(b.courses)}`, sub2: carriedBy(b), badge: b.n, cls: CARRY(b) ? 'ska fp' : 'sks fp', num: CARRY(b) ? 'lbla' : 'lbl' })),
  { head: `THE PLATES — ${WORD[RUNTIMES.length]} RUNTIMES AT THE SAME SCALE` },
  ...RUNTIMES.map((r) => ({ b: r, fig: miniOf(miniPlate, r.shape[0], r.shape[1], r.plates, STOOD.has(r) ? (r.optional ? '3 2' : '') : '3 2', true), name: `${r.letter}  ${r.name}`, sub: plateWord(r), sub2: `${plural(r.studs, 'stud')} · ${STOOD.has(r) ? `under ${plural(BUILT.filter((b) => b.plates.some((p) => p.rt === r)).length, 'build')}` : 'under none'}`, badge: r.n, cls: 'sk fp', num: 'lbl' })),
];
let ly = TOP + 38;
const legendRows = LEGEND.map((row) => {
  if (row.head) {
    const y = ly + 14;
    ly += 30;
    return `${leader(LEFT, y - 22, LEFT + LEGEND_W, y - 22)}${txt(LEFT + 14, y, row.head, 'lbls')}`;
  }
  const rh = Math.max(40, row.fig.h + 14);
  const y = ly + rh / 2;
  ly += rh;
  const part = String(row.badge);
  return `<g id="${P}-part-${part}" data-part="${part}" data-name="${row.b.name}">
${row.fig.at(LEFT + 70, y - row.fig.h / 2)}
${badge(LEFT + 24, y, row.badge, row.cls, row.num)}
${txt(LEFT + 150, y - 8, row.name, 'lbl')}
${txt(LEFT + 150, y + 4, row.sub, 'lblf')}
${txt(LEFT + 150, y + 16, row.sub2, 'lblf')}
</g>`;
}).join('\n');
const LEGEND_H = ly - TOP + 10;
const legendBox = `<rect x="${LEFT}" y="${TOP}" width="${LEGEND_W}" height="${LEGEND_H}" class="skf fnone"/>
${txt(LEFT + 14, TOP + 22, `THE BOX — ${FAMILY.length} BRICKS, ${RUNTIMES.length} PLATES, 1 GROUND`, 'lbls')}
${legendRows}`;

// ---- not in any build: the parts no consumer carries and the plates no build stands on ------------
const NBX = LEFT, NBY = TOP + LEGEND_H + 24;
const SPARES = [...UNUSED_PARTS.map((b) => ({ fig: miniOf(mini, b.shape[0], b.shape[1], b.courses, '3 2'), badge: b.n, name: b.disp, sub: 'in the box, in no build at the cabinet’s tree' })),
  ...SPARE_PLATES.map((r) => ({ fig: miniOf(miniPlate, r.shape[0], r.shape[1], r.plates, '3 2', true), badge: r.n, name: `${r.letter}  ${r.name}`, sub: r.optional ? 'an optional peer, pinned by no consumer' : `peered by ${listOf(r.peeredBy)}, in no build` }))];
const spareBox = `<rect x="${NBX}" y="${NBY}" width="${LEGEND_W}" height="${54 + SPARES.length * 34}" class="skf fnone" stroke-dasharray="5 4"/>
${txt(NBX + 14, NBY + 22, 'NOT IN ANY BUILD — SPARE PARTS AND SPARE PLATES', 'lbls')}
${SPARES.map((s, k) => {
  const y = NBY + 48 + k * 34;
  return `${s.fig.at(NBX + 70, y - s.fig.h / 2)}${badge(NBX + 24, y, s.badge, 'sks fp', 'lbl')}${txt(NBX + 150, y - 2, s.name, 'lbl')}${txt(NBX + 150, y + 10, s.sub, 'lblf')}`;
}).join('\n')}`;
const SPARE_BOTTOM = NBY + 54 + SPARES.length * 34;

// ---- the schedules: one row per build, then one per plate ------------------------------------
const wrap = (phrases, per) => {
  const out = [];
  for (let i = 0; i < phrases.length; i += per) out.push(phrases.slice(i, i + per).join(' · '));
  return out;
};
// a build whose manifests differ: the parts one pins that another takes as a peer
const variantLines = (b) => b.pinned.filter((v) => v.length < b.parts.length).map((v) => {
  const missing = b.parts.filter((p) => !v.includes(p));
  const who = BUILDS.consumers.filter((c) => b.consumers.includes(c.name) && [...c.pinned].sort().join() === [...v].sort().join()).map((c) => c.name);
  if (!who.length) throw new Error(`sheet 2C: build ${b.numeral} lists a pinned variant no consumer declares`);
  return `      ${plural(who.length, 'manifest')} take${who.length === 1 ? 's' : ''} ${listOf(missing)} as a peer rather than pinning it: ${listOf(who)}`;
});
const BUILD_ROWS = BUILT.flatMap((b) => [
  `${b.numeral}  ${listOf(b.bricks.map((x) => `brick ${x.n} ${x.name}`))} — ${b.plates.length ? `on plate${b.plates.length > 1 ? 's' : ''} ${listOf(b.plates.map((p) => `${p.rt.letter} ${p.rt.name}`))}` : 'on the ground'}${b.bricks.filter((x) => x.groundWhy).map((x) => ` · brick ${x.n} on the ground (${x.groundWhy})`).join('')}${b.unpeered.length ? ` · ${listOf(b.unpeered)} pinned by the consumer, peered by no part here` : ''}`,
  ...wrap(b.consumers.map((c) => `${c} (${kindOf(c)})`), 5).map((s, i) => `      ${i ? '' : `${plural(b.consumers.length, 'consumer')}: `}${s}`),
  ...variantLines(b),
]);
const PLATE_ROWS = RUNTIMES.flatMap((r) => [
  `${r.letter}  ${r.name} ${r.ver} — ${r.range}${r.optional ? ' · OPTIONAL, drawn dashed' : ''} · one build (${r.build}): ${plural(r.files, 'file')} · ${fmt(r.sloc)} sloc → ${plural(r.studs, 'stud')} · ${plateWord(r)} · ships ${plural(r.shippedFiles, 'file')} · ${fmt(r.shippedSloc)} sloc · closure ${plural(r.closure.packages.length, 'package')} · ${fmt(r.closure.sloc)} sloc`,
  `      peered by ${listOf(r.peeredBy.map((n) => `brick ${byName(n).n}`))} · ${STOOD.has(r) ? `under build${BUILT.filter((b) => b.plates.some((p) => p.rt === r)).length > 1 ? 's' : ''} ${listOf(BUILT.filter((b) => b.plates.some((p) => p.rt === r)).map((b) => b.numeral))}` : 'under no build'}`,
]);
const EMPTY_ROW = EMPTY.map((e) => `—  ${listOf(e.consumers.map((c) => `${c} (${kindOf(c)})`))} pins no family part: a consumer, not a build`);
const SY = Math.max(ART_BOTTOM + 40, SLOT_BOTTOM + 30, SPARE_BOTTOM + 24);
const VW = Math.max(1400, Math.ceil(OX + maxx + 30), Math.ceil(LABEL_RIGHT + 30));
const schedLine = (y, s) => txt(LEFT + 18, y, s, 'lbls');
const schedule = `<rect x="${LEFT}" y="${SY}" width="${VW - 2 * LEFT}" height="${110 + (BUILD_ROWS.length + EMPTY_ROW.length + PLATE_ROWS.length) * 16}" class="sk fp"/>
${txt(LEFT + 18, SY + 22, `BUILD SCHEDULE — ${WORD[BUILT.length]} builds, numbered from most consumers down, ties alphabetical by parts · a build is the family parts one consumer pins, counted over ${plural(BUILDS.totals.consumers, 'consumer')}`, 'lbls')}
${leader(LEFT, SY + 32, VW - LEFT, SY + 32)}
${[...BUILD_ROWS, ...EMPTY_ROW].map((r, i) => schedLine(SY + 52 + i * 16, r)).join('\n')}
${leader(LEFT, SY + 60 + (BUILD_ROWS.length + EMPTY_ROW.length) * 16, VW - LEFT, SY + 60 + (BUILD_ROWS.length + EMPTY_ROW.length) * 16)}
${txt(LEFT + 18, SY + 80 + (BUILD_ROWS.length + EMPTY_ROW.length) * 16, 'PLATE SCHEDULE — one row per runtime · one build, the tarball it ships, its closure · every joint a peerDependency row', 'lbls')}
${PLATE_ROWS.map((r, i) => schedLine(SY + 100 + (BUILD_ROWS.length + EMPTY_ROW.length + i) * 16, r)).join('\n')}
${txt(LEFT + 18, SY + 104 + (BUILD_ROWS.length + EMPTY_ROW.length + PLATE_ROWS.length) * 16, `TOTAL — ${WORD[BUILT.length]} builds from ${plural(BUILDS.totals.consumers, 'consumer')} · ${WORD[FAMILY.length - UNUSED_PARTS.length]} of ${WORD[FAMILY.length]} parts carried · ${WORD[STOOD.size]} of ${WORD[RUNTIMES.length]} plates stood on · ${COUNTED}`, 'lbls')}`;
const VH = SY + 130 + (BUILD_ROWS.length + EMPTY_ROW.length + PLATE_ROWS.length) * 16;

// ---- the findings, derived --------------------------------------------------------------------
const FACADES = RUNTIMES.filter((r) => r.sloc * 10 < r.closure.sloc);
const LIT = RT('lit');
if (!FACADES.includes(LIT)) throw new Error('sheet 2C: the notes call lit a facade, but its one build is not a tenth of its closure');
const MOST = BUILT[0];
const LIT_BUILDS = BUILT.filter((b) => b.plates.some((p) => p.rt === LIT));
const DEV = RUNTIMES.filter((r) => r.build === 'development');
const VARIED = BUILT.filter((b) => b.pinned.length > 1);
export const SHEET2C_SCALE = `${WORD[BUILT.length].toUpperCase()} BUILDS`;

export const SHEET2C_VERDICT = `alternate builds from one box: ${WORD[BUILT.length]} builds pinned by ${plural(BUILDS.totals.consumers, 'consumer')}, none mixing two of ${listOf(REACTIVITY)}; ${listOf(UNUSED_PARTS.map((b) => b.name))} are in the box and in no build, and ${listOf(SPARE_PLATES.map((r) => r.name))} are plates no build stands on`;

const ARIA = `An exploded isometric LEGO assembly: alternate builds from one box of parts. A slab of ground carries ${WORD[BUILT.length]} small models, each the family parts one group of consumers installs together, standing on the runtime plates those parts peer, each runtime a stack of baseplates sized from one shipped build and lettered ${LETTERS} on a ringed stud: ${listOf(BUILT.map((b) => `build ${b.numeral}, ${listOf(b.bricks.map((x) => x.name))}${b.plates.length ? ` on ${listOf(b.plates.map((p) => `${p.rt.name} (${plateWord(p.rt)})`))}` : ' on the ground'}, ${plural(b.consumers.length, 'consumer')}`))}. ${listOf(RUNTIMES.filter((r) => r.optional).map((r) => r.name))} are drawn dashed as optional peers. A parts legend at the left is the box, each brick marked with the consumers carrying it, and a dashed register under it holds ${listOf([...UNUSED_PARTS.map((b) => b.name), ...SPARE_PLATES.map((r) => r.name)])}, in no build. Schedules beneath give every build its consumers and every plate its build, tarball and closure.`;

const svg = `<svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${ARIA}">
${defs(P)}

${txt(VW - 30, 16, `SCALE — one scale, sheet 2’s: a family brick is 1 stud per ${SLOC_PER_STUD} sloc and a course per ${FILES_PER_COURSE} files · a runtime is baseplates at sheet 2’s baseplate footprint, ${shapeName(BASEPLATE)} = ${BASEPLATE_STUDS} studs, 1 stud per ${SLOC_PER_STUD} sloc of one shipped build — the development build where one is shipped`, 'lbls', 'end')}
${txt(VW - 30, 30, `laid a plate at a time and stacked when it overflows, the remainder on top at its own size · under ${BASEPLATE_STUDS} studs, one plate at its own size · a ringed stud, lettered ${LETTERS}, is a plate’s one joint; a dashed plate is an optional peer · the ground is the registry, not massed`, 'lbls', 'end')}

${legendBox}
${spareBox}

${assembly}
${badges}
${captions}

${schedule}
</svg>`;

export const sheet2c = {
  num: '2C', id: 'companions-runtimes', rev: 'A',
  title: 'THE ALTERNATE BUILDS',
  sub: `ALTITUDE 2 — SIBLING PLATE, THE ECOSYSTEM: one box of ${WORD[FAMILY.length]} family bricks at sheet 2’s mould and ${WORD[RUNTIMES.length]} runtimes as stacks of baseplates sized from one shipped build at the same scale, and the ${WORD[BUILT.length]} alternate models the repository’s own consumers build from it — each model the parts one consumer pins, on the plates they peer · rows read census-builds.json and census-peers.json @ ${PEERS.sha}`,
  scale: SHEET2C_SCALE,
  form: 'BRICK ASSEMBLIES',
  svg,
  caption: `One box, ${WORD[BUILT.length]} models. The sample apps, the docs site and the examples pin ${WORD[BUILT.length]} distinct sets of family parts, and each set is drawn as the small assembly it makes on the runtime plates its parts peer: ${listOf(REACTIVITY)} share no model, ${WORD[UNUSED_PARTS.length]} brick${UNUSED_PARTS.length > 1 ? 's' : ''} stay${UNUSED_PARTS.length > 1 ? '' : 's'} in the box, and ${WORD[SPARE_PLATES.length]} plates carry nothing.`,
  notes: `
<p><strong>One box, several models.</strong> Sheet 2 draws every family brick in one assembly on ${npmLink(CORE)}. The repository's own consumers — ${plural(BUILDS.totals.consumers, 'consumer')}: the sample apps, the docs site and the examples at the cabinet's sha — pin ${WORD[BUILT.length]} distinct sets of family parts once each manifest is closed over its family peers, and this plate draws each set as the model it makes: its parts at sheet 2's mould, standing on the runtime plates those parts peer. The atlas's own app is not among them: ${BUILDS.basis.note}. Build ${MOST.numeral} is the most built, ${listOf(MOST.bricks.map((x) => npmLink(x.name)))} alone on ${listOf(MOST.plates.map((p) => npmLink(p.rt.name)))}, by ${plural(MOST.consumers.length, 'consumer')}. One consumer pins no family part at all${EMPTY.length ? ` (${listOf(EMPTY.flatMap((e) => e.consumers))})` : ''}, and is a consumer rather than a build.</p>
<p><strong>No model mixes two reactivity runtimes.</strong> ${Cap(listOf(REACTIVITY.map((n) => npmLink(n))))} are each reached by a family binding — ${listOf(BINDINGS.map((b) => npmLink(b.name)))} — and no consumer in the tree mixes two of them; the build stops if one does. The bindings are alternates in the box, the way one set's instructions show a car or a plane, not both.</p>
<p><strong>Ground and stacking follow the dependency.</strong> A family brick peers ${npmLink('lit')} or ${npmLink('effect')}, not the reverse, and no runtime on this plate peers another — both read from each row's own <code>peerDependencies</code> — so each runtime is a plate, the parts stand on them, and the plates lie on plain ground. A part stands on the part it peers when that part is in the same build, as it does on sheet 2; a part whose only runtime peers are optional and pinned by no consumer stands on the ground, and the caption says so.</p>
<p><strong>One scale.</strong> The family keeps sheet 2's mould exactly — 1 stud per ${SLOC_PER_STUD} sloc rounded up the brick shapes, a course per ${FILES_PER_COURSE} authored files. A runtime is baseplates at sheet 2's baseplate footprint, ${shapeName(BASEPLATE)} = ${BASEPLATE_STUDS} studs, one stud per ${SLOC_PER_STUD} sloc of one shipped build — the files reachable from its <code>exports</code> entries, the <code>development</code> condition where one is shipped${DEV.length ? ` (${listOf(DEV.map((r) => npmLink(r.name)))})` : ''} — laid a plate at a time and stacked when it overflows, the remainder on top at its own size, three plates to a brick course: ${listOf(RUNTIMES.filter((r) => r.stacked).map((r) => `${npmLink(r.name)} is ${plateWord(r)}`))}. Under ${BASEPLATE_STUDS} studs a runtime is one plate at its own size, the nearest rectangle: ${listOf(RUNTIMES.filter((r) => !r.stacked).map((r) => `${npmLink(r.name)} ${shapeName(r.shape)}`))}. A package's dependencies are a number in the schedule rather than area on the plate: ${listOf(FACADES.map((r) => `${npmLink(r.name)} builds ${fmt(r.sloc)} lines over a closure of ${fmt(r.closure.sloc)}`))}. Every model on lit stands on a ${shapeName(LIT.shape)}: ${WORD[LIT_BUILDS.length]} of the ${WORD[BUILT.length]} builds, and the runtime they run on is in its closure.</p>
<p><strong>What stays in the box.</strong> ${Cap(listOf(UNUSED_PARTS.map((b) => npmLink(b.name))))} ${UNUSED_PARTS.length > 1 ? 'are' : 'is'} carried by no consumer at the cabinet's tree, so no model draws ${UNUSED_PARTS.length > 1 ? 'them' : 'it'}; ${listOf(SPARE_PLATES.map((r) => npmLink(r.name)))} ${SPARE_PLATES.length > 1 ? 'are' : 'is'} ${SPARE_PLATES.length > 1 ? 'plates' : 'a plate'} no model stands on — ${listOf(SPARE_PLATES.filter((r) => r.optional).map((r) => r.name))} optional and pinned by no consumer, ${listOf(SPARE_PLATES.filter((r) => !r.optional).map((r) => r.name))} peered only by a part no consumer carries. They stand in the dashed register under the box, and the spare plates are drawn there rather than on the ground.${VARIED.length ? ` ${Cap(listOf(VARIED.map((b) => `build ${b.numeral}'s manifests differ in what they pin and what they take as a peer`)))}; the schedule says which.` : ''} Every number on this sheet is read from <code>www/atlas.lit-ui-router.dev/data/census-builds.json</code>, <code>census-peers.json</code>, <code>census-bricks.json</code> and <code>census-couplings.json</code> — ${COUNTED}.</p>`,
  key: [
    keyRow('<polygon points="4,12 16,5 30,12 30,16 16,9 4,16" class="sk fp"/><ellipse cx="10" cy="8" rx="4" ry="2.3" class="sk fp2"/><ellipse cx="24" cy="8" rx="4" ry="2.3" class="sk fp2"/>', `a family brick — sheet 2’s mould: 1 stud per ${SLOC_PER_STUD} sloc, a course per ${FILES_PER_COURSE} files`),
    keyRow('<polygon points="2,9 16,2 46,9 46,15 16,8 2,15" class="sk fp"/><path d="M2,11 L16,18 L46,11" class="skf fnone"/><path d="M2,13 L16,20 L46,13" class="skf fnone"/><ellipse cx="12" cy="7" rx="3" ry="1.7" class="sk fp2"/><ellipse cx="22" cy="5" rx="3" ry="1.7" class="sk fp2"/><ellipse cx="32" cy="7" rx="3" ry="1.7" class="sk fp2"/>', `a runtime — baseplates of ${shapeName(BASEPLATE)}, 1 stud per ${SLOC_PER_STUD} sloc of one shipped build, stacked when they overflow, the remainder on top at its own size; three plates are one brick course, ${3 * BASEPLATE_STUDS} studs; under ${BASEPLATE_STUDS} studs, one plate at its own size`),
    keyRow('<polygon points="4,13 14,8 24,13 24,16 14,11 4,16" class="sk fp"/><polygon points="26,11 32,8 44,14 44,17 32,11 26,14" class="sk fp"/>', 'a build — the family parts one consumer installs together, counted from the sample apps, the docs site and the examples at the cabinet’s sha'),
    keyRow('<ellipse cx="24" cy="9" rx="6" ry="3.5" class="ska fp"/><ellipse cx="24" cy="9" rx="11" ry="6.5" class="ska fnone"/>', `a ringed stud — the one joint a plate offers, lettered ${LETTERS}`),
    keyRow('<line x1="24" y1="2" x2="24" y2="16" class="ska" stroke-dasharray="6 4"/><circle cx="24" cy="16" r="2.2" class="fa"/>', 'drop line — the brick seats on that stud, or on the ground'),
    keyRow('<polygon points="2,11 16,4 46,11 46,14 16,7 2,14" class="sks fp" stroke-dasharray="3 2"/>', 'a dashed plate — an optional peer'),
    keyRow('<polygon points="8,12 16,7 26,12 26,15 16,10 8,15" class="sks fp" stroke-dasharray="3 2"/>', 'not in any build — a part no consumer carries, or a plate no model stands on'),
    keyRow('<polygon points="4,8 16,2 44,9 44,15 16,8 4,14" class="sk fp"/>', 'ground — the registry, not massed'),
  ].join('\n'),
};

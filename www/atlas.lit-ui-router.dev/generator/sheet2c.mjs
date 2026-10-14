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
  ...BRICK_ROWS.map((b) => ({ n: b.n, name: b.name, disp: b.disp, ver: b.ver, files: b.files, sloc: b.sloc, shape: b.shape, courses: b.courses, hue: b.hue })),
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
// the two readings of census-builds.json: the cabinet's tree, then with the atlas app; the second carries every count
// as a trailing clause and draws each build it adds as one more panel
if (!BUILDS.withAtlas || !BUILDS.basis?.atlasApp?.sha || !BUILDS.basis.atlasApp.ref || !BUILDS.basis.atlasApp.dir)
  throw new Error('sheet 2C: census-builds.json carries no withAtlas reading or no basis.atlasApp');
const ATLAS_APP = BUILDS.basis.atlasApp;
const READINGS = [{ consumers: BUILDS.consumers, builds: BUILDS.builds, totals: BUILDS.totals, clause: '', atlas: false }];
READINGS.push({ ...BUILDS.withAtlas, clause: 'with the atlas app', atlas: true });
const also = (count) => READINGS.slice(1).map((r) => ` · ${count(r)} ${r.clause}`).join('');
const KIND = { 'sample-app': 'sample app', 'docs-site': 'docs site', example: 'example', 'atlas-app': 'atlas app' };
const kindOf = (name, reading = READINGS[0]) => {
  const c = reading.consumers.find((x) => x.name === name);
  if (!c) throw new Error(`sheet 2C: no consumer ${name}`);
  if (!KIND[c.kind]) throw new Error(`sheet 2C: consumer ${name} is a ${c.kind}, which the caption has no word for`);
  return KIND[c.kind];
};
for (const R of READINGS) {
  if (R.consumers.length !== R.totals.consumers || R.builds.length !== R.totals.builds) throw new Error('sheet 2C: census-builds.json totals disagree with its rows');
  for (const b of R.builds) if (!Array.isArray(b.pinned) || !Array.isArray(b.runtimesByPeer)) throw new Error('sheet 2C: a build row carries no pinned variants');
  for (const c of R.consumers) if (!Array.isArray(c.pinned)) throw new Error(`sheet 2C: consumer ${c.name} carries no pinned list`);
  for (const [name, k] of Object.entries(R.totals.carrying)) {
    byName(name);
    const seen = R.consumers.filter((c) => c.parts.includes(name)).length;
    if (seen !== k) throw new Error(`sheet 2C: ${name} is carried by ${seen} consumers but totals.carrying says ${k}`);
  }
  if (Object.keys(R.totals.carrying).length !== FAMILY.length) throw new Error('sheet 2C: totals.carrying does not cover the family');
}
// the notes say the atlas app is off the cabinet's tree and is the second reading's one addition: one consumer of its kind
const ATLAS_CONSUMERS = READINGS[1].consumers.filter((c) => c.kind === 'atlas-app');
if (BUILDS.consumers.some((c) => c.kind === 'atlas-app') || ATLAS_CONSUMERS.length !== 1 || READINGS[1].consumers.length !== BUILDS.consumers.length + 1)
  throw new Error('sheet 2C: the second reading should add the atlas app, and only it, to the cabinet’s consumers');
const EMPTY = BUILDS.builds.filter((b) => b.parts.length === 0);
if (EMPTY.length !== BUILDS.totals.empty) throw new Error(`sheet 2C: ${EMPTY.length} builds have no part but totals.empty is ${BUILDS.totals.empty}`);
// numbered from most consumers down, ties alphabetical by parts
// a build's parts are its pinned manifests closed over the family peers, so a model draws every family part a consumer installs
const keyed = (b) => ({ ...b, parts: [...b.parts].sort(), key: [...b.parts].sort().join(',') });
const numbered = (reading, from) => (b, i) => ({ ...b, reading, k: from + i + 1, numeral: ROMAN[from + i + 1], bricks: b.parts.map(byName).sort((x, y) => x.n - y.n).map((x) => ({ ...x })) });
const BUILT = BUILDS.builds.filter((b) => b.parts.length).map(keyed)
  .sort((a, b) => b.consumers.length - a.consumers.length || a.key.localeCompare(b.key))
  .map(numbered(READINGS[0], 0));
// a later reading's builds that the cabinet's tree does not hold, numbered on from the cabinet's
const EXTRA = READINGS.slice(1).flatMap((r) => r.builds.filter((b) => b.parts.length).map(keyed).filter((b) => !BUILT.some((x) => x.key === b.key))
  .map((b) => ({ ...b, reading: r, atlas: r.atlas }))).map((b, i) => numbered(b.reading, BUILT.length)(b, i));
const MODELS = [...BUILT, ...EXTRA];
// the notes name the second reading's one added model as the atlas app's
if (EXTRA.length !== 1 || EXTRA[0].consumers.join() !== ATLAS_CONSUMERS[0].name) throw new Error(`sheet 2C: the second reading adds [${EXTRA.map((b) => b.consumers)}], not the atlas app alone`);
const ATLAS_BUILD = EXTRA[0];
for (const b of MODELS) if (new Set(b.parts).size !== b.parts.length) throw new Error(`sheet 2C: build ${b.numeral} lists a part twice`);
const CARRY = (b) => BUILDS.totals.carrying[b.name];
const UNUSED_PARTS = FAMILY.filter((b) => CARRY(b) === 0);

// ---- the reactivity claim: no build mixes two of the reactivity runtimes ------------------
const REACTIVITY = ['effect', 'mobx', 'signal-polyfill'].map((n) => RT(n).name);
const reaches = (name, seen = new Set()) => {
  if (seen.has(name)) return seen;
  seen.add(name);
  for (const p of peersOf(name)) if (FAMILY_NAMES.has(p)) reaches(p, seen);
  return seen;
};
const reactivityOf = (build) => [...new Set(build.parts.flatMap((p) => [...reaches(p)].flatMap(peersOf).filter((t) => REACTIVITY.includes(t))))].sort();
for (const b of MODELS) if (reactivityOf(b).length > 1) throw new Error(`sheet 2C: build ${b.numeral} mixes ${reactivityOf(b)}`);
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
function seatParts(build) {
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
}
// the plate's stud under a seated brick: the nearest one the brick covers
const studUnder = (p, r, part) => {
  let stud = null;
  for (let i = 0; i < r.topShape[0]; i++) for (let j = 0; j < r.topShape[1]; j++) {
    const px = p.x + (r.topOff[0] + i + 0.5) * U, py = p.y + (r.topOff[1] + j + 0.5) * U;
    if (inside(px, py, part) && (!stud || i + j > stud[0] + stud[1])) stud = [i, j, px, py];
  }
  return stud;
};
// every part of the build is placed, and nothing else; and every family peer of a drawn part is drawn in the same model
function checkModel(build) {
  const placed = [...build.parts_.keys()].map((n) => FB(n).name).sort();
  if (placed.join() !== build.parts.join()) throw new Error(`sheet 2C: build ${build.numeral} draws [${placed}] for parts [${build.parts}]`);
  for (const b of build.bricks) for (const p of peersOf(b.name)) if (FAMILY_NAMES.has(p) && !build.parts.includes(p)) throw new Error(`sheet 2C: build ${build.numeral} draws ${b.name} without its peer ${p}`);
  for (const p of build.plates) if (![...p.seated, ...p.reached].some((b) => peersOf(b.name).includes(p.rt.name))) throw new Error(`sheet 2C: build ${build.numeral} stands on ${p.rt.name}, which no part peers`);
}
function layoutBuild(build) {
  seatParts(build);
  const own = (n) => build.bricks.find((x) => x.n === n);
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
      const stud = studUnder(p, r, part);
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
  checkModel(build);
  // each model stands on its own slab of ground, a stud wider than the model all round
  build.boxes = [
    { id: `${build.numeral}:G`, ground: true, x: -U, y: -U, w: cx - SMALL + 2 * U, d: dmax + 2 * U, z0: 0, h: GROUND_H, build },
    ...build.plates.map((p) => ({ id: `${build.numeral}:${p.rt.letter}`, x: p.x, y: p.y, w: p.w, d: p.d, z0: p.z0, h: p.h, pl: p, build })),
    ...[...build.parts_.values()].map((part) => ({ ...part, id: `${build.numeral}:${part.id}`, brick: own(part.id), build })),
  ];
}
MODELS.forEach(layoutBuild);
const STOOD = new Set(BUILT.flatMap((b) => b.plates.map((p) => p.rt)));
const SPARE_PLATES = RUNTIMES.filter((r) => !STOOD.has(r));
// a plate's builds read from a reading's rows alone, so a later reading counts without a drawing; the drawn models agree
const buildsOn = (reading, r) => reading.builds.filter((b) => b.runtimes.includes(r.name) && b.parts.some((p) => peersOf(p).includes(r.name)));
const drawnOn = (r) => BUILT.filter((b) => b.plates.some((p) => p.rt === r));
for (const r of RUNTIMES) if (buildsOn(READINGS[0], r).length !== drawnOn(r).length) throw new Error(`sheet 2C: ${r.name} is under ${drawnOn(r).length} drawn builds but ${buildsOn(READINGS[0], r).length} by the rows`);

// ---- the drawing kit: drops, badges, the minis ------------------------------------------------
const drop = (ox, oy, px, py, zFrom, zTo) => {
  const [cx, y0] = pt(ox, oy, px, py, zFrom);
  const [cx2, yTo] = pt(ox, oy, px, py, zTo + SH);
  if (Math.abs(cx - cx2) > 0.25) throw new Error('sheet 2C: a drop would lean');
  const y1 = (yTo - RY - 1).toFixed(1);
  return `<line x1="${cx}" y1="${y0}" x2="${cx}" y2="${y1}" class="ska" stroke-dasharray="6 4"/>\n<circle cx="${cx}" cy="${y1}" r="2.2" class="fa"/>`;
};
const BADGE_R = 9.5;
const badge = (x, y, s, cls = 'ska fp', num = 'lbla', r = BADGE_R) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" class="${cls}"/>${txt(x.toFixed(1), (y + 3.6).toFixed(1), String(s), num, 'middle')}`;
const leader = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="skf"/>`;
const drawModel = (build, ox, oy) => paintOrder(build.boxes).map((i) => {
  const b = build.boxes[i];
  if (b.ground) return block(ox, oy, b.x, b.y, b.w, b.d, b.z0, b.h, build.atlas ? { edge: 'ska' } : {});
  if (b.pl) return stack(ox, oy, b.pl.rt, { x: b.x, y: b.y, z0: b.z0, ring: b.pl.ring });
  const fall = b.onGround ? drop(ox, oy, b.drop[0], b.drop[1], b.z0, b.drop[2] - SH).split('\n')[0] : drop(ox, oy, b.drop[0], b.drop[1], b.z0, b.drop[2]);
  return `${fall}\n${brick(ox, oy, b.x, b.y, b.ws, b.ds, b.brick.courses, { z0: b.z0, studEdge: 'sk', ringStuds: new Set(b.rings), hue: b.brick.hue })}`;
}).join('\n');
// badges: a brick's number above its far roof corner, or at its near-left roof corner when a brick stands on it;
// a plate's letter above its ringed stud, clear of its drop line and under the seated brick's underside
const badgesOf = (build, ox, oy) => build.boxes.flatMap((b) => {
  if (b.brick) {
    const carries = build.bricks.some((x) => x.on === b.brick.n);
    const [x, y] = carries ? pt(ox, oy, b.x, b.y + b.d, b.z0 + b.h) : pt(ox, oy, b.x, b.y, b.z0 + b.h);
    return [{ id: b.id, label: b.brick.n, at: carries ? [x - 13, y - 2] : [x, y - 13] }];
  }
  if (!b.pl) return [];
  const [rx, ry] = pt(ox, oy, ...b.pl.ringAt);
  const at = [rx - 16, ry - 11];
  if (at[0] + BADGE_R >= rx) throw new Error('sheet 2C: a letter badge sits on its drop line');
  // read at the badge's own x on the seated brick's two lower silhouette edges
  for (const seated of b.pl.seated) {
    const part = build.parts_.get(seated.n);
    const [L, N, R] = [[part.x, part.y + part.d], [part.x + part.w, part.y + part.d], [part.x + part.w, part.y]].map(([x, y]) => pt(ox, oy, x, y, part.z0));
    const edgeY = (x) => (x < L[0] || x > R[0] ? -Infinity : x <= N[0] ? L[1] + ((x - L[0]) / (N[0] - L[0])) * (N[1] - L[1]) : N[1] + ((x - N[0]) / (R[0] - N[0])) * (R[1] - N[1]));
    for (const x of [at[0] - BADGE_R, at[0], at[0] + BADGE_R])
      if (at[1] - BADGE_R <= edgeY(x) + 1) throw new Error(`sheet 2C: plate ${b.pl.rt.letter}'s badge runs into brick ${seated.n}'s underside`);
  }
  return [{ id: b.id, label: b.pl.rt.letter, at }];
});
// a model's screen extents at an origin: every box corner, its studs and its badges
const extentOf = (build, ox, oy) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const see = ([x, y], r = 0) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
  for (const b of build.boxes)
    for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.d], [b.x + b.w, b.y + b.d]]) {
      see(pt(ox, oy, x, y, b.z0));
      see(pt(ox, oy, x, y, b.z0 + b.h + (b.ground ? 0 : SH)), b.ground ? 0 : RY);
    }
  for (const { at } of badgesOf(build, ox, oy)) see(at, BADGE_R);
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
};
const mini = brickKit({ U: 10, p: P });
const miniPlate = brickKit({ U: 4, p: P });
const miniOf = (kit, ws, ds, courses, dash, flat = false, hue = null) => {
  const w = ws * kit.U, d = ds * kit.U, h = flat ? courses * kit.PT : courses * kit.CRS;
  const corners = [[0, 0], [w, 0], [0, d], [w, d]].flatMap(([x, y]) => [kit.pt(0, 0, x, y, 0), kit.pt(0, 0, x, y, h + (flat ? 0 : kit.SH * 2))]);
  const mx = Math.min(...corners.map(([x]) => x)), my = Math.min(...corners.map(([, y]) => y));
  const MX = Math.max(...corners.map(([x]) => x)), MY = Math.max(...corners.map(([, y]) => y));
  const draw = flat
    ? (ox, oy) => kit.block(ox - mx, oy - my, 0, 0, w, d, 0, h, { edge: dash ? 'sks' : 'sk' })
    : (ox, oy) => kit.brick(ox - mx, oy - my, 0, 0, ws, ds, courses, { dash, edge: dash ? 'sks' : 'sk', studEdge: dash ? 'sks' : 'sk', hue: dash ? null : hue });
  return { w: MX - mx, h: MY - my, at: draw };
};
const miniBrick = (b, dash = '') => miniOf(mini, b.shape[0], b.shape[1], b.courses, dash, false, b.hue);
const miniStack = (r, dash = '') => miniOf(miniPlate, r.shape[0], r.shape[1], r.plates, dash, true);

// ---- the panels: one instruction step per build, its head, its parts callout, its model on its own ground ----
const kindsLine = (b) => {
  const by = new Map();
  for (const c of b.consumers) by.set(kindOf(c, b.reading), (by.get(kindOf(c, b.reading)) ?? 0) + 1);
  return listOf([...by].map(([k, n]) => (n === 1 ? `${/^[aeiou]/.test(k) ? 'an' : 'a'} ${k}` : `${WORD[n]} ${k}s`)));
};
const headLines = (b) => [
  [`BUILD ${b.numeral}`, b.atlas ? 'lbla' : 'lblt'],
  [`${plural(b.consumers.length, 'consumer')} · ${kindsLine(b)}`, 'lblf'],
  ...b.bricks.filter((x) => x.groundWhy).map((x) => [`brick ${x.n} on the ground: ${x.groundWhy}`, 'lblf']),
  ...(b.unpeered.length ? [[`${listOf(b.unpeered.map((t) => RT(t).letter))} pinned, peered by no part here`, 'lblf']] : []),
];
// the callout: the build's parts as the box prints them, bricks then plates, each with its badge and how many the model draws
const calloutOf = (b) => [
  ...b.bricks.map((x) => ({ fig: miniBrick(x), label: x.n, count: b.boxes.filter((o) => o.brick === x).length })),
  ...[...b.plates].sort((p, q) => p.rt.letter.localeCompare(q.rt.letter)).map((p) => ({ fig: miniStack(p.rt, p.rt.optional ? '3 2' : ''), label: p.rt.letter, count: b.boxes.filter((o) => o.pl === p).length })),
];
const ITEM_W = 40, ITEM_GAP = 12, CALL_BADGE = 26, CALL_PAD = 10;
const calloutRows = (items, width) => {
  const rows = [[]];
  let x = 0;
  for (const it of items) {
    const w = Math.max(it.fig.w, ITEM_W);
    if (w > width) throw new Error(`sheet 2C: part ${it.label} is wider than its callout`);
    if (x && x + w > width) { rows.push([]); x = 0; }
    rows.at(-1).push({ ...it, x, w });
    x += w + ITEM_GAP;
  }
  let y = 0;
  const placed = rows.flatMap((row) => {
    const h = Math.max(...row.map((it) => it.fig.h));
    const out = row.map((it) => ({ ...it, base: y + h }));
    y += h + CALL_BADGE + 6;
    return out;
  });
  return { items: placed, h: y - 6, w: Math.max(...placed.map((it) => it.x + it.w)) };
};
const PAD = 14, GUT = 18, MARGIN = 8, LINE = 12;
// a panel is as wide as the cabinet's widest model; a wider model spans as many panels as it needs
const LOCAL = new Map(MODELS.map((b) => [b, extentOf(b, 0, 0)]));
const PW = Math.ceil(Math.max(...BUILT.map((b) => LOCAL.get(b).w + 2 * (PAD + MARGIN)), 300));
const spanW = (span) => span * PW + (span - 1) * GUT;
const spanOf = (b) => Math.max(1, Math.ceil((LOCAL.get(b).w + 2 * (PAD + MARGIN) + GUT) / (PW + GUT)));
const SPAN = new Map(MODELS.map((b) => [b, spanOf(b)]));
const CALLOUTS = new Map(MODELS.map((b) => [b, calloutRows(calloutOf(b), spanW(SPAN.get(b)) - 2 * PAD - 2 * CALL_PAD)]));
const HEAD_H = PAD + 13 + (Math.max(...MODELS.map((b) => headLines(b).length)) - 1) * LINE + 12;
const CALL_H = (b) => CALLOUTS.get(b).h + 2 * CALL_PAD;
const MODEL_TOP = (b) => HEAD_H + CALL_H(b) + 12;
const needH = (b) => MODEL_TOP(b) + LOCAL.get(b).h + PAD + MARGIN;
// the grid: four columns unless three leave fewer cells empty; panels fill row by row in build order, a span wrapping whole
const cellsAt = (cols) => {
  let c = 0, r = 0;
  const at = MODELS.map((b) => {
    if (c + SPAN.get(b) > cols) { c = 0; r++; }
    const cell = [c, r];
    c += SPAN.get(b);
    return cell;
  });
  return { cols, at, rows: r + 1, empty: (r + 1) * cols - MODELS.reduce((a, b) => a + SPAN.get(b), 0) };
};
const GRID = [cellsAt(4), cellsAt(3)].sort((a, b) => a.empty - b.empty || b.cols - a.cols)[0];
// each row is as tall as its tallest panel's head, callout and model; the panels in a row share it
const ROW_H = Array.from({ length: GRID.rows }, (_, r) => Math.ceil(Math.max(...MODELS.filter((_, i) => GRID.at[i][1] === r).map(needH))));
const ROW_Y = ROW_H.map((_, r) => ROW_H.slice(0, r).reduce((a, h) => a + h + GUT, 0));
const GRID_W = spanW(GRID.cols), GRID_H = ROW_Y.at(-1) + ROW_H.at(-1);

// ---- the box: the parts inventory, each family part with its carrying count ----------------------------------
const LEFT = 20, TOP = 58, LEGEND_W = 340, ROW_TEXT = 150;
const GX = LEFT + LEGEND_W + 30, GY = TOP;
const VW = Math.ceil(Math.max(1440, GX + GRID_W + LEFT));
// a later reading's count rides its own line under the cabinet's
const tail = (count) => also(count).replace(/^ · /, '');
const carriedBy = (b) => (CARRY(b) ? `carried by ${plural(CARRY(b), 'consumer')}` : 'carried by none at the cabinet’s tree');
const underBuilds = (r) => (STOOD.has(r) ? `under ${plural(drawnOn(r).length, 'build')}` : 'under none');
const BOX_GROUPS = [
  { head: `THE PARTS — ${WORD[FAMILY.length]} BRICKS AT SHEET 2’S MOULD`, items: FAMILY.map((b) => ({ id: b.n, name: b.name, fig: miniBrick(b, CARRY(b) ? '' : '3 2'), title: b.disp, subs: [`${shapeName(b.shape)} · ${courseWord(b.courses)}`, carriedBy(b), tail((r) => fmt(r.totals.carrying[b.name]))], badge: b.n, cls: CARRY(b) ? 'ska fp' : 'sks fp', num: CARRY(b) ? 'lbla' : 'lbl' })) },
  { head: `THE PLATES — ${WORD[RUNTIMES.length]} RUNTIMES AT THE SAME SCALE`, items: RUNTIMES.map((r) => ({ id: r.n, name: r.name, fig: miniStack(r, STOOD.has(r) ? (r.optional ? '3 2' : '') : '3 2'), title: `${r.letter}  ${r.name}`, subs: [plateWord(r), `${plural(r.studs, 'stud')} · ${underBuilds(r)}`, tail((g) => `under ${buildsOn(g, r).length ? fmt(buildsOn(g, r).length) : 'none'}`)], badge: r.n, cls: 'sk fp', num: 'lbl' })) },
];
const SPARE_GROUPS = [{ items: [
  ...UNUSED_PARTS.map((b) => ({ fig: miniBrick(b, '3 2'), badge: b.n, title: b.disp, subs: ['in the box, in no build at the cabinet’s tree', tail((r) => `carried by ${fmt(r.totals.carrying[b.name])}`)] })),
  ...SPARE_PLATES.map((r) => ({ fig: miniStack(r, '3 2'), badge: r.n, title: `${r.letter}  ${r.name}`, subs: [r.optional ? 'an optional peer, pinned by no consumer' : `peered by ${listOf(r.peeredBy)}, in no build`, tail((g) => (buildsOn(g, r).length ? `under ${plural(buildsOn(g, r).length, 'build')}` : 'under none'))] })),
].map((s) => ({ ...s, cls: 'sks fp', num: 'lbl' })) }];
// rows of items in `cols` columns, each row as tall as its tallest figure or lettering; a group's head rules the full width
const linesOf = (it) => [[it.title, 'lbl'], ...it.subs.filter(Boolean).map((s) => [s, 'lblf'])];
const boxGrid = (groups, x0, y0, width, cols) => {
  let y = y0;
  const out = [], colW = width / cols;
  for (const g of groups) {
    if (g.head) {
      out.push(`${leader(x0, y - 8, x0 + width, y - 8)}${txt(x0 + 14, y + 14, g.head, 'lbls')}`);
      y += 30;
    }
    for (let k = 0; k < g.items.length; k += cols) {
      const row = g.items.slice(k, k + cols);
      const rh = Math.max(...row.map((it) => Math.max(linesOf(it).length === 2 ? 34 : 12 * linesOf(it).length + 10, it.fig.h + 14)));
      row.forEach((it, c) => {
        const x = x0 + c * colW, cy = y + rh / 2, lines = linesOf(it);
        const svg = `${it.fig.at(x + 70, cy - it.fig.h / 2)}
${badge(x + 24, cy, it.badge, it.cls, it.num)}
${lines.map(([s, cls], i) => txt(x + ROW_TEXT, cy - (lines.length - 1) * 6 + 4 + i * 12, s, cls)).join('\n')}`;
        out.push(it.id ? `<g id="${P}-part-${it.id}" data-part="${it.id}" data-name="${it.name}">\n${svg}\n</g>` : svg);
      });
      y += rh;
    }
  }
  return { svg: out.join('\n'), h: y - y0 };
};
const boxAndSpares = (x, y, width) => {
  const box = boxGrid(BOX_GROUPS, x, y + 38, width, 1);
  const boxH = box.h + 48;
  const sy = y + boxH + 24;
  const spares = boxGrid(SPARE_GROUPS, x, sy + 34, width, 1);
  const spareH = spares.h + 44;
  return {
    svg: `<rect x="${x}" y="${y}" width="${width}" height="${boxH}" class="skf fnone"/>
${txt(x + 14, y + 22, `THE BOX — ${FAMILY.length} BRICKS, ${RUNTIMES.length} PLATES`, 'lbls')}
${box.svg}
<rect x="${x}" y="${sy}" width="${width}" height="${spareH}" class="skf fnone" stroke-dasharray="5 4"/>
${txt(x + 14, sy + 22, 'NOT IN ANY BUILD — SPARE PARTS AND SPARE PLATES', 'lbls')}
${spares.svg}`,
    bottom: sy + spareH,
  };
};
const BOX = boxAndSpares(LEFT, TOP, LEGEND_W);

// ---- the panels placed on the grid ------------------------------
const wrapWords = (s, chars) => s.split(' ').reduce((lines, w) => (lines.length && (lines.at(-1) + ' ' + w).length <= chars ? [...lines.slice(0, -1), `${lines.at(-1)} ${w}`] : [...lines, w]), []);
const PANELS = MODELS.map((build, i) => ({ build, x: GX + GRID.at[i][0] * (PW + GUT), y: GY + ROW_Y[GRID.at[i][1]], w: spanW(SPAN.get(build)), h: ROW_H[GRID.at[i][1]] }));
for (let i = 0; i < PANELS.length; i++) for (let j = i + 1; j < PANELS.length; j++) {
  const a = PANELS[i], b = PANELS[j];
  if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) throw new Error(`sheet 2C: panels ${i + 1} and ${j + 1} overlap`);
}
const ALL_BADGES = [];
const panelSvg = (panel) => {
  const { x, y, w: pw, h: ph, build: b } = panel;
  const ext = LOCAL.get(b), call = CALLOUTS.get(b);
  const top = y + MODEL_TOP(b), room = y + ph - PAD - MARGIN - top;
  const ox = +(x + (pw - ext.w) / 2 - ext.x0).toFixed(1), oy = +(top + (room - ext.h) / 2 - ext.y0).toFixed(1);
  // the model fits its panel under the callout, a margin clear of the frame
  const at = extentOf(b, ox, oy);
  if (at.x0 < x + MARGIN || at.x1 > x + pw - MARGIN || at.y0 < y + MODEL_TOP(b) || at.y1 > y + ph - MARGIN)
    throw new Error(`sheet 2C: build ${b.numeral}'s model runs out of its panel`);
  const cx = x + PAD + CALL_PAD, cy = y + HEAD_H + CALL_PAD;
  const callout = call.items.map((it) => {
    const ix = cx + it.x, bx = ix + 10, by = cy + it.base + 16;
    ALL_BADGES.push([bx, by]);
    return `${it.fig.at(ix + (it.w - it.fig.w) / 2, cy + it.base - it.fig.h)}
${badge(bx, by, it.label)}${txt(ix + 24, by + 4, `×${it.count}`, 'lbl')}`;
  }).join('\n');
  const marks = badgesOf(b, ox, oy);
  for (const m of marks) ALL_BADGES.push(m.at);
  return `<g id="${P}-build-${b.numeral}" data-build="${b.numeral}">
<rect x="${x}" y="${y}" width="${pw}" height="${ph}" class="${b.atlas ? 'ska' : 'skf'} fnone"${b.atlas ? ' stroke-dasharray="5 4" opacity="0.7"' : ''}/>
${headLines(b).map(([s, cls], k) => txt(x + PAD, y + PAD + 13 + k * LINE + (k ? 3 : 0), s, cls)).join('\n')}
<rect x="${x + PAD}" y="${y + HEAD_H}" width="${Math.ceil(call.w + 2 * CALL_PAD)}" height="${CALL_H(b)}" rx="4" class="skf fnone"/>
${callout}
${drawModel(b, ox, oy)}
${marks.map((m) => badge(m.at[0], m.at[1], m.label)).join('\n')}
</g>`;
};
const panels = PANELS.map(panelSvg).join('\n');
// a stack draws studs on its top plate only: one footprint of studs per stack drawn
if (STUDS_DRAWN !== MODELS.reduce((a, b) => a + b.plates.reduce((s, p) => s + p.rt.topShape[0] * p.rt.topShape[1], 0), 0)) throw new Error(`sheet 2C: ${STUDS_DRAWN} studs drawn — a hidden plate carries studs`);
for (let i = 0; i < ALL_BADGES.length; i++) for (let j = i + 1; j < ALL_BADGES.length; j++)
  if (Math.hypot(ALL_BADGES[i][0] - ALL_BADGES[j][0], ALL_BADGES[i][1] - ALL_BADGES[j][1]) < 24) throw new Error(`sheet 2C: two badges within 24px at ${ALL_BADGES[i]} and ${ALL_BADGES[j]}`);
const ART_BOTTOM = Math.max(GY + GRID_H, BOX.bottom);

// ---- the schedules: one row per build, then one per plate ------------------------------------
const wrap = (phrases, per) => {
  const out = [];
  for (let i = 0; i < phrases.length; i += per) out.push(phrases.slice(i, i + per).join(' · '));
  return out;
};
// a build whose manifests differ: the parts one pins that another takes as a peer
const variantLines = (b) => b.pinned.filter((v) => v.length < b.parts.length).map((v) => {
  const missing = b.parts.filter((p) => !v.includes(p));
  const who = b.reading.consumers.filter((c) => b.consumers.includes(c.name) && [...c.pinned].sort().join() === [...v].sort().join()).map((c) => c.name);
  if (!who.length) throw new Error(`sheet 2C: build ${b.numeral} lists a pinned variant no consumer declares`);
  return `      ${plural(who.length, 'manifest')} take${who.length === 1 ? 's' : ''} ${listOf(missing)} as a peer rather than pinning it: ${listOf(who)}`;
});
// a schedule row wraps at the sheet's width, its continuation indented
const ROW_CHARS = Math.floor((VW - 2 * LEFT - 36) / 5.4);
const BUILD_ROWS = MODELS.flatMap((b) => [
  ...wrapWords(`${b.numeral}  ${listOf(b.bricks.map((x) => `brick ${x.n} ${x.name}`))} — ${b.plates.length ? `on plate${b.plates.length > 1 ? 's' : ''} ${listOf(b.plates.map((p) => `${p.rt.letter} ${p.rt.name}`))}` : 'on the ground'}${b.bricks.filter((x) => x.groundWhy).map((x) => ` · brick ${x.n} on the ground (${x.groundWhy})`).join('')}${b.unpeered.length ? ` · ${listOf(b.unpeered)} pinned by the consumer, peered by no part here` : ''}`, ROW_CHARS).map((s, i) => (i ? `      ${s}` : s)),
  ...wrap(b.consumers.map((c) => `${c} (${kindOf(c, b.reading)})`), 5).map((s, i) => `      ${i ? '' : `${plural(b.consumers.length, 'consumer')}: `}${s}`),
  ...variantLines(b),
]);
// the drawn models a reading holds, and those standing on a plate
const modelsIn = (reading) => MODELS.filter((m) => reading.builds.some((b) => [...b.parts].sort().join(',') === m.key));
const onPlate = (reading, r) => modelsIn(reading).filter((b) => b.plates.some((p) => p.rt === r));
for (const g of READINGS) for (const r of RUNTIMES) if (onPlate(g, r).length !== buildsOn(g, r).length) throw new Error(`sheet 2C: ${r.name} is under ${onPlate(g, r).length} drawn builds of a reading but ${buildsOn(g, r).length} by its rows`);
const underPhrase = (on) => (on.length ? `under build${on.length > 1 ? 's' : ''} ${listOf(on.map((b) => b.numeral))}` : 'under no build');
const PLATE_ROWS = RUNTIMES.flatMap((r) => {
  return [
    `${r.letter}  ${r.name} ${r.ver} — ${r.range}${r.optional ? ' · OPTIONAL, drawn dashed' : ''} · one build (${r.build}): ${plural(r.files, 'file')} · ${fmt(r.sloc)} sloc → ${plural(r.studs, 'stud')} · ${plateWord(r)} · ships ${plural(r.shippedFiles, 'file')} · ${fmt(r.shippedSloc)} sloc · closure ${plural(r.closure.packages.length, 'package')} · ${fmt(r.closure.sloc)} sloc`,
    `      peered by ${listOf(r.peeredBy.map((n) => `brick ${byName(n).n}`))} · ${underPhrase(onPlate(READINGS[0], r))}${also((g) => underPhrase(onPlate(g, r)))}`,
  ];
});
const EMPTY_ROW = EMPTY.map((e) => `—  ${listOf(e.consumers.map((c) => `${c} (${kindOf(c)})`))} pins no family part: a consumer, not a build`);
const SY = ART_BOTTOM + 40;
const schedLine = (y, s) => txt(LEFT + 18, y, s, 'lbls');
const builtOf = (r) => r.builds.filter((b) => b.parts.length).length;
const schedule = `<rect x="${LEFT}" y="${SY}" width="${VW - 2 * LEFT}" height="${110 + (BUILD_ROWS.length + EMPTY_ROW.length + PLATE_ROWS.length) * 16}" class="sk fp"/>
${txt(LEFT + 18, SY + 22, `BUILD SCHEDULE — ${WORD[BUILT.length]} builds${also((r) => WORD[builtOf(r)])}, numbered from most consumers down, ties alphabetical by parts, the atlas app’s build after them · a build is the family parts one consumer pins, counted over ${plural(BUILDS.totals.consumers, 'consumer')}${also((r) => fmt(r.totals.consumers))}`, 'lbls')}
${leader(LEFT, SY + 32, VW - LEFT, SY + 32)}
${[...BUILD_ROWS, ...EMPTY_ROW].map((r, i) => schedLine(SY + 52 + i * 16, r)).join('\n')}
${leader(LEFT, SY + 60 + (BUILD_ROWS.length + EMPTY_ROW.length) * 16, VW - LEFT, SY + 60 + (BUILD_ROWS.length + EMPTY_ROW.length) * 16)}
${txt(LEFT + 18, SY + 80 + (BUILD_ROWS.length + EMPTY_ROW.length) * 16, 'PLATE SCHEDULE — one row per runtime · one build, the tarball it ships, its closure · every joint a peerDependency row', 'lbls')}
${PLATE_ROWS.map((r, i) => schedLine(SY + 100 + (BUILD_ROWS.length + EMPTY_ROW.length + i) * 16, r)).join('\n')}
${txt(LEFT + 18, SY + 104 + (BUILD_ROWS.length + EMPTY_ROW.length + PLATE_ROWS.length) * 16, `TOTAL — ${WORD[BUILT.length]} builds from ${plural(BUILDS.totals.consumers, 'consumer')}${also((r) => `${WORD[builtOf(r)]} from ${fmt(r.totals.consumers)}`)} · ${WORD[FAMILY.length - UNUSED_PARTS.length]} of ${WORD[FAMILY.length]} parts carried${also((r) => WORD[FAMILY.filter((b) => r.totals.carrying[b.name] > 0).length])} · ${WORD[STOOD.size]} of ${WORD[RUNTIMES.length]} plates stood on${also((r) => WORD[RUNTIMES.filter((x) => buildsOn(r, x).length).length])} · ${COUNTED}`, 'lbls')}`;
const VH = SY + 130 + (BUILD_ROWS.length + EMPTY_ROW.length + PLATE_ROWS.length) * 16;

// ---- the findings, derived --------------------------------------------------------------------
const FACADES = RUNTIMES.filter((r) => r.sloc * 10 < r.closure.sloc);
const LIT = RT('lit');
if (!FACADES.includes(LIT)) throw new Error('sheet 2C: the notes call lit a facade, but its one build is not a tenth of its closure');
const MOST = BUILT[0];
const LIT_BUILDS = BUILT.filter((b) => b.plates.some((p) => p.rt === LIT));
const DEV = RUNTIMES.filter((r) => r.build === 'development');
const VARIED = BUILT.filter((b) => b.pinned.length > 1);
const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
const anOrd = (n) => `${/^[aeiou]/.test(ORDINAL[n]) ? 'an' : 'a'} ${ORDINAL[n]}`;
const WITH = READINGS[1];
const IN_ATLAS = (b) => ATLAS_BUILD.parts.includes(b.name);
const UNUSED_WITH = FAMILY.filter((b) => WITH.totals.carrying[b.name] === 0);
const SPARE_WITH = SPARE_PLATES.filter((r) => buildsOn(WITH, r).length === 0);
const STOOD_BY_ATLAS = SPARE_PLATES.filter((r) => ATLAS_BUILD.plates.some((p) => p.rt === r));
const countOf = (n, word) => `${WORD[n]} ${word}${n === 1 ? '' : 's'}`;
export const SHEET2C_SCALE = `ONE BOX, ${WORD[MODELS.length].toUpperCase()} BUILDS`;

export const SHEET2C_VERDICT = `alternate builds from one box: ${WORD[BUILT.length]} builds pinned by ${plural(BUILDS.totals.consumers, 'consumer')} and ${anOrd(MODELS.length)} by the atlas’s own app on its own branch, none mixing two of ${listOf(REACTIVITY)}; ${listOf(UNUSED_PARTS.map((b) => b.name))} ${UNUSED_PARTS.length > 1 ? 'are' : 'is'} in no build at the cabinet’s tree${UNUSED_PARTS.some(IN_ATLAS) ? ` and in build ${ATLAS_BUILD.numeral} with the atlas app` : ''}, and ${listOf(SPARE_PLATES.map((r) => r.name))} are plates no build stands on at the cabinet’s tree, ${SPARE_WITH.length ? `${listOf(SPARE_WITH.map((r) => r.name))} with the atlas app too` : 'none with the atlas app'}`;

const ARIA = `An exploded isometric LEGO assembly: alternate builds from one box of parts, laid out as an instruction booklet's panels. Each of ${WORD[MODELS.length]} panels holds one small model on its own slab of ground under a callout of its parts: the family parts one group of consumers installs together, standing on the runtime plates those parts peer, each runtime a stack of baseplates sized from one shipped build and lettered ${LETTERS} on a ringed stud: ${listOf(MODELS.map((b) => `build ${b.numeral}, ${listOf(b.bricks.map((x) => x.name))}${b.plates.length ? ` on ${listOf(b.plates.map((p) => `${p.rt.name} (${plateWord(p.rt)})`))}` : ' on the ground'}, ${plural(b.consumers.length, 'consumer')}`))}. ${listOf(RUNTIMES.filter((r) => r.optional).map((r) => r.name))} are drawn dashed as optional peers. Build ${ATLAS_BUILD.numeral} is the atlas's own app, read on its own branch and drawn in an accent-edged dashed panel on accent-edged ground, spanning ${WORD[SPAN.get(ATLAS_BUILD)]} columns. A parts legend at the left is the box, each brick marked with the consumers carrying it at the cabinet's tree and with the atlas app, and a dashed register under it holds ${listOf([...UNUSED_PARTS.map((b) => b.name), ...SPARE_PLATES.map((r) => r.name)])}, in no build at the cabinet's tree. Schedules beneath give every build its consumers and every plate its build, tarball and closure.`;

const svg = `<svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${ARIA}">
${defs(P)}

${txt(VW - 30, 16, `SCALE — one scale, sheet 2’s: a family brick is 1 stud per ${SLOC_PER_STUD} sloc and a course per ${FILES_PER_COURSE} files · a runtime is baseplates at sheet 2’s baseplate footprint, ${shapeName(BASEPLATE)} = ${BASEPLATE_STUDS} studs, 1 stud per ${SLOC_PER_STUD} sloc of one shipped build — the development build where one is shipped`, 'lbls', 'end')}
${txt(VW - 30, 30, `laid a plate at a time and stacked when it overflows, the remainder on top at its own size · under ${BASEPLATE_STUDS} studs, one plate at its own size · a ringed stud, lettered ${LETTERS}, is a plate’s one joint; a dashed plate is an optional peer · the ground is the registry, not massed`, 'lbls', 'end')}

${BOX.svg}

${panels}

${schedule}
</svg>`;

export const sheet2c = {
  num: '2C', id: 'companions-runtimes', rev: 'A',
  title: 'THE ALTERNATE BUILDS',
  sub: `ALTITUDE 2 — SIBLING PLATE, THE ECOSYSTEM: one box of ${WORD[FAMILY.length]} family bricks at sheet 2’s mould and ${WORD[RUNTIMES.length]} runtimes as stacks of baseplates sized from one shipped build at the same scale, and the ${WORD[BUILT.length]} alternate models the repository’s own consumers build from it, and ${anOrd(MODELS.length)} the atlas’s own app builds on its own branch — each model the parts one consumer pins, on the plates they peer · rows read census-builds.json, both readings, and census-peers.json @ ${PEERS.sha}`,
  scale: SHEET2C_SCALE,
  form: 'BUILD INSTRUCTIONS',
  svg,
  caption: `One box, ${WORD[MODELS.length]} models. The sample apps, the docs site and the examples pin ${WORD[BUILT.length]} distinct sets of family parts, and the atlas’s own app pins ${anOrd(MODELS.length)} on its own branch; each set is drawn as the small assembly it makes on the runtime plates its parts peer, under a callout of its parts: ${listOf(REACTIVITY)} share no model, ${countOf(UNUSED_PARTS.length, 'brick')} ${UNUSED_PARTS.length === 1 ? 'stays' : 'stay'} in the box at the cabinet’s tree and ${countOf(UNUSED_WITH.length, 'brick')} with the atlas app, and ${countOf(SPARE_PLATES.length, 'plate')} ${SPARE_PLATES.length === 1 ? 'carries' : 'carry'} nothing at the cabinet’s tree and ${WORD[SPARE_WITH.length]} with the atlas app.`,
  notes: `
<p><strong>One box, several models.</strong> Sheet 2 draws every family brick in one assembly on ${npmLink(CORE)}. The repository's own consumers — ${plural(BUILDS.totals.consumers, 'consumer')}: the sample apps, the docs site and the examples at the cabinet's sha — pin ${WORD[BUILT.length]} distinct sets of family parts, each manifest closed over its family peers, and this plate draws each set as the model it makes: its parts at sheet 2's mould, standing on the runtime plates those parts peer. The ${ORDINAL[MODELS.length]} model, build ${ATLAS_BUILD.numeral}, is the atlas's own app: its manifest at <code>${ATLAS_APP.dir}</code>, read from <code>git archive ${ATLAS_APP.ref}</code> @ ${ATLAS_APP.sha}, off the cabinet's tree, and drawn accent-edged on its own branch the way sheet A4 draws the atlas deploy. Every count on this sheet reads both ways, the cabinet's tree first and “with the atlas app” after. Build ${MOST.numeral} is the most built, ${listOf(MOST.bricks.map((x) => npmLink(x.name)))} alone on ${listOf(MOST.plates.map((p) => npmLink(p.rt.name)))}, by ${plural(MOST.consumers.length, 'consumer')}. ${Cap(WORD[EMPTY.flatMap((e) => e.consumers).length])} consumer pins no family part at all${EMPTY.length ? ` (${listOf(EMPTY.flatMap((e) => e.consumers))})` : ''}, and is a consumer rather than a build.</p>
<p><strong>No model mixes two reactivity runtimes.</strong> ${Cap(listOf(REACTIVITY.map((n) => npmLink(n))))} are each reached by a family binding — ${listOf(BINDINGS.map((b) => npmLink(b.name)))} — and no consumer in either reading mixes two of them; the build stops if one does. The bindings are alternates in the box, the way one set's instructions show a car or a plane, not both.</p>
<p><strong>Ground and stacking follow the dependency.</strong> A family brick peers ${npmLink('lit')} or ${npmLink('effect')}, not the reverse, and no runtime on this plate peers another — both read from each row's own <code>peerDependencies</code> — so each runtime is a plate, the parts stand on them, and the plates lie on plain ground. A part stands on the part it peers when that part is in the same build, as it does on sheet 2; a part whose only runtime peers are optional and pinned by no consumer stands on the ground, and its panel says so.</p>
<p><strong>One scale.</strong> The family keeps sheet 2's mould exactly — 1 stud per ${SLOC_PER_STUD} sloc rounded up the brick shapes, a course per ${FILES_PER_COURSE} authored files. A runtime is baseplates at sheet 2's baseplate footprint, ${shapeName(BASEPLATE)} = ${BASEPLATE_STUDS} studs, one stud per ${SLOC_PER_STUD} sloc of one shipped build — the files reachable from its <code>exports</code> entries, the <code>development</code> condition where one is shipped${DEV.length ? ` (${listOf(DEV.map((r) => npmLink(r.name)))})` : ''} — laid a plate at a time and stacked when it overflows, the remainder on top at its own size, three plates to a brick course: ${listOf(RUNTIMES.filter((r) => r.stacked).map((r) => `${npmLink(r.name)} is ${plateWord(r)}`))}. Under ${BASEPLATE_STUDS} studs a runtime is one plate at its own size, the nearest rectangle: ${listOf(RUNTIMES.filter((r) => !r.stacked).map((r) => `${npmLink(r.name)} ${shapeName(r.shape)}`))}. A package's dependencies are a number in the schedule rather than area on the plate: ${listOf(FACADES.map((r) => `${npmLink(r.name)} builds ${fmt(r.sloc)} lines over a closure of ${fmt(r.closure.sloc)}`))}. Every model on lit stands on a ${shapeName(LIT.shape)}: ${WORD[LIT_BUILDS.length]} of the ${WORD[BUILT.length]} builds, ${WORD[MODELS.filter((b) => b.plates.some((p) => p.rt === LIT)).length]} of ${WORD[MODELS.length]} with the atlas app, and the runtime they run on is in its closure.</p>
<p><strong>What stays in the box.</strong> ${Cap(listOf(UNUSED_PARTS.map((b) => npmLink(b.name))))} ${UNUSED_PARTS.length > 1 ? 'are' : 'is'} carried by no consumer at the cabinet's tree, so no model of that reading draws ${UNUSED_PARTS.length > 1 ? 'them' : 'it'}${UNUSED_PARTS.some(IN_ATLAS) ? `; with the atlas app, ${listOf(UNUSED_PARTS.filter(IN_ATLAS).map((b) => b.name))} ${UNUSED_PARTS.filter(IN_ATLAS).length > 1 ? 'stand' : 'stands'} in build ${ATLAS_BUILD.numeral}` : ''}. ${Cap(listOf(SPARE_PLATES.map((r) => npmLink(r.name))))} ${SPARE_PLATES.length > 1 ? 'are plates' : 'is a plate'} no model stands on at the cabinet's tree — ${listOf(SPARE_PLATES.filter((r) => r.optional).map((r) => r.name))} optional and pinned by no consumer there, ${listOf(SPARE_PLATES.filter((r) => !r.optional).map((r) => r.name))} peered only by a part no consumer there carries${STOOD_BY_ATLAS.length ? `; with the atlas app, build ${ATLAS_BUILD.numeral} stands on ${listOf(STOOD_BY_ATLAS.map((r) => r.name))}, and ${SPARE_WITH.length ? `${listOf(SPARE_WITH.map((r) => r.name))} ${SPARE_WITH.length > 1 ? 'stay' : 'stays'} spare` : 'no plate stays spare'}` : ''}. They stand in the dashed register under the box, each line reading the cabinet's tree first and the atlas app after, and the spare plates are drawn there rather than on the ground.${VARIED.length ? ` ${Cap(listOf(VARIED.map((b) => `build ${b.numeral}'s manifests differ in what they pin and what they take as a peer`)))}; the schedule says which.` : ''} Every number on this sheet is read from <code>www/atlas.lit-ui-router.dev/data/census-builds.json</code>, <code>census-peers.json</code>, <code>census-bricks.json</code> and <code>census-couplings.json</code> — ${COUNTED}; the second reading adds <code>${ATLAS_APP.dir}</code> at ${ATLAS_APP.ref} @ ${ATLAS_APP.sha}.</p>`,
  key: [
    keyRow('<polygon points="4,12 16,5 30,12 30,16 16,9 4,16" class="sk fp"/><ellipse cx="10" cy="8" rx="4" ry="2.3" class="sk fp2"/><ellipse cx="24" cy="8" rx="4" ry="2.3" class="sk fp2"/>', `a family brick — sheet 2’s mould: 1 stud per ${SLOC_PER_STUD} sloc, a course per ${FILES_PER_COURSE} files`),
    keyRow('<polygon points="2,9 16,2 46,9 46,15 16,8 2,15" class="sk fp"/><path d="M2,11 L16,18 L46,11" class="skf fnone"/><path d="M2,13 L16,20 L46,13" class="skf fnone"/><ellipse cx="12" cy="7" rx="3" ry="1.7" class="sk fp2"/><ellipse cx="22" cy="5" rx="3" ry="1.7" class="sk fp2"/><ellipse cx="32" cy="7" rx="3" ry="1.7" class="sk fp2"/>', `a runtime — baseplates of ${shapeName(BASEPLATE)}, 1 stud per ${SLOC_PER_STUD} sloc of one shipped build, stacked when they overflow, the remainder on top at its own size; three plates are one brick course, ${3 * BASEPLATE_STUDS} studs; under ${BASEPLATE_STUDS} studs, one plate at its own size`),
    keyRow('<polygon points="4,13 14,8 24,13 24,16 14,11 4,16" class="sk fp"/><polygon points="26,11 32,8 44,14 44,17 32,11 26,14" class="sk fp"/>', 'a build — the family parts one consumer installs together, counted from the sample apps, the docs site and the examples at the cabinet’s sha, and from the atlas app’s own manifest on its branch'),
    keyRow('<rect x="4" y="2" width="40" height="14" class="ska fnone" stroke-dasharray="5 4" opacity="0.7"/>', 'an accent-edged panel — the atlas app’s build, on its own branch, its ground edged in accent'),
    keyRow('<ellipse cx="24" cy="9" rx="6" ry="3.5" class="ska fp"/><ellipse cx="24" cy="9" rx="11" ry="6.5" class="ska fnone"/>', `a ringed stud — the one joint a plate offers, lettered ${LETTERS}`),
    keyRow('<line x1="24" y1="2" x2="24" y2="16" class="ska" stroke-dasharray="6 4"/><circle cx="24" cy="16" r="2.2" class="fa"/>', 'drop line — the brick seats on that stud, or on the ground'),
    keyRow('<polygon points="2,11 16,4 46,11 46,14 16,7 2,14" class="sks fp" stroke-dasharray="3 2"/>', 'a dashed plate — an optional peer'),
    keyRow('<polygon points="8,12 16,7 26,12 26,15 16,10 8,15" class="sks fp" stroke-dasharray="3 2"/>', 'not in any build — a part no consumer carries, or a plate no model stands on'),
    keyRow('<polygon points="4,8 16,2 44,9 44,15 16,8 4,14" class="sk fp"/>', 'ground — the registry, not massed'),
  ].join('\n'),
};

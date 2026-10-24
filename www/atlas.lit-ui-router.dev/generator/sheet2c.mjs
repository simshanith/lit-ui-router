import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, keyRow, npmUrl } from './helpers.mjs';
import { brickKit, paintOrder } from './brick-iso.mjs';
import { cordHit, cordKit } from './connector-iso.mjs';
import { BRICK_MODEL, BRICK_ROWS, COMPILE_TIME, EXPLODE, STUDS, SLOC_PER_STUD, FILES_PER_COURSE } from './sheet2.mjs';
import { hueOf } from './brick-hues.mjs';

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

// ---- the family: sheet 2's bricks at sheet 2's own mould, and its compile-time parts at the census's ----
const CORE = '@uirouter/core';
const brickRow = (name) => {
  const r = BRICKS.rows.find((x) => x.name === name);
  if (!r) throw new Error(`sheet 2C: census-bricks.json has no row named ${name}`);
  return r;
};
const FAMILY = [
  ...BRICK_ROWS.map((b) => ({ n: b.n, name: b.name, disp: b.disp, ver: b.ver, files: b.files, sloc: b.sloc, shape: b.shape, courses: b.courses, hue: b.hue })),
  ...COMPILE_TIME.map(({ name }) => brickRow(name)).map((r, i) => ({ n: BRICK_ROWS.length + 1 + i, name: r.name, disp: r.name, ver: r.version, files: r.files, sloc: r.sloc, shape: r.shape.split('x').map(Number), courses: r.courses })),
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
const RT_ROWS = COUPLINGS.rows.filter((r) => r.kind === 'peer' && !FAMILY_NAMES.has(r.to));
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
  const up = row.peers.filter((p) => FAMILY_NAMES.has(p));
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
  return { letter: String.fromCharCode(65 + i), name: r.name, ver: r.version, range: r.range, optional: r.optional, published: r.published,
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
const LINKABLE = new Set([...PLATE_NAMES, ...FAMILY_NAMES]);
if (!PLATE_NAMES.includes(CORE)) throw new Error(`sheet 2C: census-peers.json carries no ${CORE} row — core is the baseplate of every model`);
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
const numeral = (k) => {
  if (!ROMAN[k]) throw new Error(`sheet 2C: build ${k} runs past ROMAN's ${ROMAN.at(-1)} — extend the numerals and the panel grid together`);
  return ROMAN[k];
};
const numbered = (reading, from) => (b, i) => ({ ...b, reading, k: from + i + 1, numeral: numeral(from + i + 1), bricks: b.parts.map(byName).sort((x, y) => x.n - y.n).map((x) => ({ ...x })) });
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
const CORE_ROW = PEERS.rows.find((r) => r.name === CORE);
if (CORE_ROW.optional || CORE_ROW.peers.length) throw new Error(`sheet 2C: the notes call ${CORE} a required plate that peers nothing, but its row says optional=${CORE_ROW.optional}, peers [${CORE_ROW.peers}]`);
// a build's name: the compile-time words ('typed', 'eslinted') of its compile-time parts, then the distinct words of its
// other parts by rank, 'vanilla' dropped unless no other word remains; the table's entry order is the words' rank
const BUILD_WORDS = {
  'lit-ui-router': 'vanilla', 'lit-ui-router-signals': 'signals', 'ui-router-signals': 'signals', 'lit-ui-router-effect': 'effect', 'ui-router-effect': 'effect',
  'lit-ui-router-mobx': 'mobx', 'ui-router-mobx': 'mobx', 'ui-router-navigation-location-plugin': 'nav', 'lit-ui-router-ssr': 'ssr', 'ui-router-server': 'server', 'ui-router-registry': 'typed', 'eslint-plugin-lit-ui-router': 'eslinted',
};
const WORD_RANK = [...new Set(Object.values(BUILD_WORDS))];
if (Object.values(BUILD_WORDS).some((w) => WORD_RANK.indexOf(w) < 0) || WORD_RANK.join() !== 'vanilla,signals,effect,mobx,nav,ssr,server,typed,eslinted')
  throw new Error(`sheet 2C: the build words rank [${WORD_RANK}], not vanilla, signals, effect, mobx, nav, ssr, server, typed, eslinted`);
// the compile-time parts' words rank last and lead a build's name
const PREFIX = COMPILE_TIME.map(({ name }) => BUILD_WORDS[name]);
if (PREFIX.join() !== WORD_RANK.slice(-PREFIX.length).join()) throw new Error(`sheet 2C: the compile-time words [${PREFIX}] are not the last in the rank [${WORD_RANK}]`);
for (const name of Object.keys(BUILD_WORDS)) if (!FAMILY_NAMES.has(name)) throw new Error(`sheet 2C: BUILD_WORDS names ${name}, which is not a family part`);
for (const b of FAMILY) if (!BUILD_WORDS[b.name]) throw new Error(`sheet 2C: family part ${b.name} has no word in BUILD_WORDS`);
const nameOf = (build) => {
  const all = new Set(build.bricks.map((x) => BUILD_WORDS[x.name]));
  const words = [...all].filter((w) => !PREFIX.includes(w) && w !== 'vanilla').sort((a, b) => WORD_RANK.indexOf(a) - WORD_RANK.indexOf(b));
  return [...PREFIX.filter((w) => all.has(w)), ...(words.length ? words : ['vanilla'])].join(' ');
};
// the words describe every build; the atlas app's own model is named THE ATLAS and carries its words as its description
const ATLAS_NAME = 'the atlas';
for (const b of MODELS) {
  b.words = nameOf(b);
  b.name = b.atlas ? ATLAS_NAME : b.words;
}
for (const key of ['name', 'words']) {
  const dup = MODELS.find((b, i) => MODELS.findIndex((x) => x[key] === b[key]) !== i);
  if (dup) throw new Error(`sheet 2C: two builds are ${key === 'name' ? 'named' : 'described'} ${dup[key]}`);
}
if (MODELS.filter((b) => b.name === ATLAS_NAME).length !== 1 || ATLAS_BUILD.name !== ATLAS_NAME || MODELS.some((b) => b.atlas && b !== ATLAS_BUILD))
  throw new Error(`sheet 2C: ${ATLAS_NAME} should name the atlas app's one build, and only it`);
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
const { CRS, SH, RX, RY, pt, brick, block, stud } = brickKit({ U, p: P });
const cords = cordKit({ U, pt });
// a plate is a third of a course — the LEGO fact; brickKit's half-course PT is not used for runtime plates
const PLATE_H = CRS / 3;
if (3 * PLATE_H !== CRS) throw new Error('sheet 2C: three plates are one course');
// a stack of baseplates: full plates as one body scored at every plate (every third heavier — a course),
// the remainder on top at its own size, and studs on the top plate only
let STUDS_DRAWN = 0;
function stack(ox, oy, r, { x, y, z0, rings }) {
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
    out.push(stud(ox, oy, tx + (i + 0.5) * U, ty + (j + 0.5) * U, tz + PLATE_H, rings.has(`${i},${j}`) ? { ...RING, extra: da } : { edge, cap: 'fp2', extra: da }));
    STUDS_DRAWN++;
  }
  return out.join('\n');
}
const GROUND_H = CRS;
const LIFT = 4 * CRS;
const RING = { edge: 'ska', cap: 'fp', ring: 'ska' };
const inside = (px, py, b) => px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.d;
const topFace = (ox, oy, x, y, w, d, z) => [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].map(([px, py]) => pt(ox, oy, px, py, z));
const groundTop = (build, ox, oy) => {
  const g = build.boxes.find((b) => b.ground);
  return topFace(ox, oy, g.x, g.y, g.w, g.d, g.z0 + g.h);
};
const segDist = ([px, py], [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
const pointIn = ([px, py], poly) => poly.every((a, i) => {
  const b = poly[(i + 1) % poly.length];
  return (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]) >= 0;
}) || poly.every((a, i) => {
  const b = poly[(i + 1) % poly.length];
  return (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]) <= 0;
});
// a box's screen silhouette: the convex hull of its eight projected corners, studs included above a part's top
const hull = (pts) => {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => list.reduce((h, p) => {
    while (h.length > 1 && cross(h.at(-2), h.at(-1), p) <= 0) h.pop();
    return [...h, p];
  }, []);
  return [...half(s).slice(0, -1), ...half([...s].reverse()).slice(0, -1)];
};
const silhouette = (o, ox, oy) => hull([[o.x, o.y], [o.x + o.w, o.y], [o.x, o.y + o.d], [o.x + o.w, o.y + o.d]]
  .flatMap(([x, y]) => [pt(ox, oy, x, y, o.z0), pt(ox, oy, x, y, o.z0 + o.h + (o.ground ? 0 : SH + RY))]));
const edgeGap = (c, poly) => Math.min(...poly.map((a, i) => segDist(c, a, poly[(i + 1) % poly.length])));
// a circle wholly inside a convex face, or touching it at all
const circleInside = (c, r, poly) => pointIn(c, poly) && edgeGap(c, poly) >= r;
const circleMeets = (c, r, poly) => pointIn(c, poly) || edgeGap(c, poly) < r;
// the first brick or stack a cord meets: its own brick, the bricks under it and its own plate it may pass only above or in front of,
// and every other mass it misses outright, or under `front` passes only above or in front of too, never behind or through
const cordCrossing = (t, parts, plates, front = false) => {
  const own = new Set([t.part.id, ...(t.under ?? [])]);
  const masses = [
    ...parts.map((o) => ({ id: `brick ${o.id}`, poly: silhouette(o, 0, 0), box: o, end: front || own.has(o.id) })),
    ...plates.filter((p) => p === t.p || p.rt.plates > 1).map((p) => ({ id: p.rt.letter, poly: silhouette(p, 0, 0), box: p, end: front || p === t.p })),
  ];
  return cordHit(t.curve, masses, (q) => pt(0, 0, ...q));
};
// a build stands on the runtimes its consumers declare and on every required peer its parts carry, which the installer
// adds whether or not a manifest names it; an optional peer no consumer declares stays off
const presentIn = (build, t) => build.runtimes.includes(t) || (build.runtimesByPeer.includes(t) && !RT(t).optional);
const LIT_NAME = 'lit';
const runtimePeers = (build, b) => peersOf(b.name).filter((t) => PLATE_NAMES.includes(t) && presentIn(build, t));
// sheet 2's client plate is 8 studs wide; core's own footprint takes its bricks at their places measured from the right
const SHEET2_COLS = modelOf('P1').ws;
function seatParts(build) {
  const names = new Set(build.parts);
  const byN = (n) => build.bricks.find((x) => x.n === n);
  build.bricks.forEach((b) => {
    // a part stands on the part it peers when that part is in the build, as it does on sheet 2
    const base = standsOn(b.n);
    b.on = base !== null && names.has(FB(base).name) ? base : null;
  });
  // the runtimes a brick's base already couples to: a brick on brick 1 reaches lit and core through it
  const inherited = (b) => (b.on === null ? [] : [...runtimePeers(build, byN(b.on)), ...inherited(byN(b.on))]);
  build.plates = [];
  const plateOf = (r) => {
    if (!build.plates.some((p) => p.rt === r)) build.plates.push({ rt: r, links: [], seated: [], reached: [] });
    return build.plates.find((p) => p.rt === r);
  };
  for (const b of build.bricks) {
    const present = runtimePeers(build, b);
    // a brick seats on core when it peers core, and on its one runtime when core is not among its peers
    b.seat = b.on !== null ? null : present.includes(CORE) ? RT(CORE) : present.length === 1 ? RT(present[0]) : null;
    if (b.on === null && !b.seat) throw new Error(`sheet 2C: build ${build.numeral}: ${b.name} seats on no plate`);
    // and couples to every other runtime it peers that its base does not carry: by straddling its seam or by a cord
    b.reach = present.filter((t) => t !== b.seat?.name && !inherited(b).includes(t)).map(RT);
    if (b.seat) plateOf(b.seat).links.push({ b, kind: 'seat' });
    for (const r of b.reach) plateOf(r).links.push({ b, kind: 'reach' });
  }
  build.unpeered = build.runtimes.filter((t) => !build.plates.some((p) => p.rt.name === t));
  if (!build.plates.some((p) => p.rt.name === CORE)) throw new Error(`sheet 2C: build ${build.numeral} stands on no ${CORE} plate`);
  // the sheet-2 rule: no brick seats on lit, and the flagship seats on core wherever it is a part
  if (build.bricks.some((b) => b.seat?.name === LIT_NAME)) throw new Error(`sheet 2C: build ${build.numeral} seats a brick on ${LIT_NAME}`);
  const flagship = build.bricks.find((b) => b.name === 'lit-ui-router');
  if (flagship && flagship.seat?.name !== CORE) throw new Error(`sheet 2C: build ${build.numeral} seats lit-ui-router off ${CORE}`);
}
// a seated brick's spot on its plate, in studs: the one nearest the viewer that overlaps no brick seated before it,
// a stud apart where one fits and shoulder to shoulder where none does; null when the brick is wider than the plate
const apartFrom = (taken, [ws, ds], g) => ([i, j]) => taken.every(([ti, tj, tw, td]) => i + ws + g <= ti || ti + tw + g <= i || j + ds + g <= tj || tj + td + g <= j);
const seatSpots = (p, [ws, ds], taken) => {
  const cols = p.w / U, rows = p.d / U, spots = [];
  for (let i = 0; i + ws <= cols; i++) for (let j = 0; j + ds <= rows; j++) spots.push([i, j]);
  const near = (a, b) => b[0] + b[1] - (a[0] + a[1]) || b[1] - a[1];
  const apart = spots.filter(apartFrom(taken, [ws, ds], 1)).sort(near);
  return [...apart, ...spots.filter(apartFrom(taken, [ws, ds], 0)).filter((x) => !apart.includes(x)).sort(near)];
};
const seatSpot = (p, shape, taken, skip = 0) => seatSpots(p, shape, taken)[skip] ?? null;
const footprint = (b) => {
  const m = modelOf(b.n);
  return m ? [m.ws, m.ds] : [b.shape[0], b.shape[1]];
};
// the plate's stud under a seated brick: the nearest one the brick covers
const studUnder = (p, r, part) => {
  let stud = null;
  for (let i = 0; i < r.topShape[0]; i++) for (let j = 0; j < r.topShape[1]; j++) {
    const px = p.x + (r.topOff[0] + i + 0.5) * U, py = p.y + (r.topOff[1] + j + 0.5) * U;
    if (inside(px, py, part) && (!stud || i + j > stud[0] + stud[1])) stud = [i, j, px, py];
  }
  return stud;
};
// a ring on a plate's top: the stud the brick covers, or the stud a cord ends on
const ringOn = (p, key, z) => {
  const [i, j] = key.split(',').map(Number);
  return [p.x + (p.rt.topOff[0] + i + 0.5) * U, p.y + (p.rt.topOff[1] + j + 0.5) * U, z];
};
// a plate's free top studs, nearest the brick first
const plateStuds = (p, part) => {
  const cx = part.x + part.w / 2, cy = part.y + part.d / 2, keys = [];
  for (let i = 0; i < p.rt.topShape[0]; i++) for (let j = 0; j < p.rt.topShape[1]; j++) if (!p.rings.includes(`${i},${j}`)) keys.push(`${i},${j}`);
  const dist = (k) => Math.hypot(ringOn(p, k, 0)[0] - cx, ringOn(p, k, 0)[1] - cy);
  return keys.sort((a, b) => dist(a) - dist(b));
};
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
const fail = (build, msg) => {
  throw new Error(`sheet 2C: build ${build.numeral}: ${msg}`);
};
// every part of the build is placed, and nothing else; and every family peer of a drawn part is drawn in the same model
function checkParts(build) {
  const placed = [...build.parts_.keys()].map((n) => FB(n).name).sort();
  if (placed.join() !== build.parts.join()) fail(build, `draws [${placed}] for parts [${build.parts}]`);
  for (const b of build.bricks) for (const p of peersOf(b.name)) if (FAMILY_NAMES.has(p) && !build.parts.includes(p)) fail(build, `draws ${b.name} without its peer ${p}`);
  for (const p of build.plates) if (!p.links.some(({ b }) => peersOf(b.name).includes(p.rt.name))) fail(build, `stands on ${p.rt.name}, which no part peers`);
}
// every brick seats on, straddles or is corded to every runtime it peers in the build, its base's aside; one ringed stud per
// coupled brick, as sheet 2 rings a stud per coupling
function checkCouplings(build) {
  for (const b of build.bricks) for (const r of [...(b.seat ? [b.seat] : []), ...b.reach]) {
    const link = build.plates.find((x) => x.rt === r)?.links.find((l) => l.b === b);
    if (!['seat', 'straddle', 'cord'].includes(link?.kind)) fail(build, `brick ${b.n} does not reach ${r.name}`);
  }
  for (const p of build.plates) if (p.rings.length !== p.links.length || new Set(p.rings).size !== p.rings.length) fail(build, `${p.rt.name} rings ${p.rings.length} studs for ${p.links.length} couplings`);
}
// plates meet but never overlap, every plate abuts core, and bricks seated on one level never overlap in plan
const abuts = (p, c) => p.x <= c.x + c.w && c.x <= p.x + p.w && p.y <= c.y + c.d && c.y <= p.y + p.d && (p.x === c.x + c.w || p.x + p.w === c.x || p.y === c.y + c.d || p.y + p.d === c.y);
function checkPlan(build) {
  const core = build.plates.find((p) => p.rt.name === CORE), pairs = (xs) => xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b]));
  for (const [a, b] of pairs(build.plates)) if (overlap(a, b)) fail(build, `plates ${a.rt.letter} and ${b.rt.letter} overlap`);
  for (const p of build.plates) if (p !== core && !abuts(p, core)) fail(build, `${p.rt.name} does not abut ${CORE}`);
  const floor = [...build.parts_.values()].filter((part) => !build.bricks.find((b) => b.n === part.id).on);
  for (const [a, b] of pairs(floor)) if (overlap(a, b) && a.z0 === b.z0) fail(build, `bricks ${a.id} and ${b.id} overlap`);
}
// a straddling brick stands one whole stud or more on the plate and the rest on core, both one height
function checkStraddle(build, core, p, part) {
  const onPlate = Math.min(part.x + part.w, p.x + p.w) - Math.max(part.x, p.x), onCore = Math.min(part.x + part.w, core.x + core.w) - Math.max(part.x, core.x);
  if (onPlate < U || onCore < U || onPlate + onCore !== part.w || p.h !== core.h) fail(build, `brick ${part.id} straddles ${p.rt.name} badly`);
}
// the placing kit for one model: bricks, the bricks standing on them, and seats that drop onto a ringed stud
function placer(build) {
  build.parts_ = new Map();
  build.cords = [];
  const brickAt = (b, x, y, z0) => {
    const [ws, ds] = footprint(b), m = modelOf(b.n);
    const part = { id: b.n, x, y, w: ws * U, d: ds * U, ws, ds, z0, h: b.courses * CRS, rings: m?.rings ?? [], drops: [] };
    build.parts_.set(b.n, part);
    return part;
  };
  const standers = (base) => {
    const basePart = build.parts_.get(base.n);
    for (const b of build.bricks.filter((x) => x.on === base.n)) {
      const m = modelOf(b.n), m0 = modelOf(base.n);
      const part = brickAt(b, basePart.x + (m.x - m0.x) * K, basePart.y + (m.y - m0.y) * K, basePart.z0 + basePart.h + (EXPLODE.get(b.n) - EXPLODE.get(base.n)) * K);
      if (!(part.z0 > basePart.z0 + basePart.h)) fail(build, `brick ${b.n} would sink into brick ${base.n}`);
      const ring = basePart.rings.find((k) => {
        const [i, j] = k.split(',').map(Number);
        return !basePart.taken?.has(k) && inside(basePart.x + (i + 0.5) * U, basePart.y + (j + 0.5) * U, part);
      });
      if (!ring) fail(build, `brick ${b.n} stands over no ringed stud of brick ${base.n}`);
      (basePart.taken ??= new Set()).add(ring);
      const [i, j] = ring.split(',').map(Number);
      part.drops.push([basePart.x + (i + 0.5) * U, basePart.y + (j + 0.5) * U, basePart.z0 + basePart.h]);
      standers(b);
    }
  };
  // drop a brick onto the plate's stud it covers, and ring that stud
  const seatOn = (p, link, part) => {
    const stud = studUnder(p, p.rt, part);
    if (!stud) fail(build, `brick ${part.id} stands over no stud of ${p.rt.name}`);
    p.rings.push(`${stud[0]},${stud[1]}`);
    part.drops.push([stud[2], stud[3], p.z0 + p.h]);
    p.seated.push(link.b);
  };
  return { brickAt, standers, seatOn };
}
const settle = (p) => Object.assign(p, { w: p.rt.shape[0] * U, d: p.rt.shape[1] * U, z0: GROUND_H, h: p.rt.plates * PLATE_H, rings: [] });
const clampTo = (v, hi) => Math.max(0, Math.min(hi, v));
// a core brick's spot in studs: across the right-hand seam when it straddles, at sheet 2's place measured from core's right
// edge, or packed toward the front where that collides or where sheet 2 seats the brick off its client plate
function coreSpot(build, core, b, via, taken, skip) {
  const [ws, ds] = footprint(b), m = modelOf(b.n), cols = core.w / U, rows = core.d / U, onClient = m?.on === 'P1';
  const sy = m ? clampTo(Math.round(m.y / 40), rows - ds) : 0;
  const first = via ? [cols - ws + 1, sy] : onClient ? [clampTo(Math.round(m.x / 40) - (SHEET2_COLS - cols), cols - ws), sy] : null;
  if (first && apartFrom(taken, [ws, ds], 0)(first)) return first;
  if (via) fail(build, `brick ${b.n} finds no seam to straddle`);
  return seatSpot(core, [ws, ds], taken, onClient ? 0 : skip) ?? fail(build, `brick ${b.n} finds no room on ${CORE}`);
}
// core is the baseplate; a brick on it straddles the right-hand seam onto a flat runtime plate it peers when it is two studs
// wide or more, and that plate abuts core under it
function placeCore(build, kit, core, skip) {
  const straddleOf = (b) => (core.rt.plates === 1 && footprint(b)[0] >= 2 ? b.reach.find((r) => r.plates === 1) ?? null : null);
  const taken = [];
  // the straddler first, then the bricks at sheet 2's places, then the packed ones lowest first, so a low brick takes the front
  const placedOn = (b) => modelOf(b.n)?.on === 'P1';
  for (const link of core.links.filter((l) => l.kind === 'seat').sort((a, c) => !!straddleOf(c.b) - !!straddleOf(a.b) || placedOn(c.b) - placedOn(a.b) || a.b.courses - c.b.courses || a.b.n - c.b.n)) {
    const b = link.b, via = straddleOf(b), spot = coreSpot(build, core, b, via, taken, skip);
    taken.push([spot[0], spot[1], ...footprint(b)]);
    const part = kit.brickAt(b, spot[0] * U, spot[1] * U, core.z0 + core.h + LIFT);
    kit.seatOn(core, link, part);
    if (via) {
      const p = settle(build.plates.find((x) => x.rt === via)), reach = p.links.find((l) => l.b === b);
      Object.assign(p, { x: core.w, y: part.y });
      reach.kind = 'straddle';
      kit.seatOn(p, reach, part);
      checkStraddle(build, core, p, part);
    }
    kit.standers(b);
  }
}
// a plate's places against core, never behind it: a stack taller than core along its left or right side, a flat plate along
// the front, the right beside the seam, or the left; every stud position along those sides that still touches core
function edgeSpots(core, p, [ax, ay]) {
  const sides = p.rt.plates > 1 ? [['left', ax], ['right', core.w - ax]] : [['front', core.d - ay], ['right', core.w - ax], ['left', ax + core.w]];
  const along = (len, size) => Array.from({ length: (len + size) / U - 1 }, (_, k) => (k + 1) * U - size);
  const near = ([x, y]) => Math.hypot(x + p.w / 2 - ax, y + p.d / 2 - ay);
  return sides.sort((a, c) => a[1] - c[1]).flatMap(([e]) => (e === 'front' ? along(core.w, p.w).map((x) => [x, core.d]) : along(core.d, p.d).map((y) => [e === 'left' ? -p.w : core.w, y])).sort((a, c) => near(a) - near(c)));
}
// the bricks a brick stands on, down to its seat
const underOf = (build, b) => {
  const under = [];
  for (let on = b.on; on !== null; on = build.bricks.find((x) => x.n === on).on) under.push(on);
  return under;
};
// a brick's free top studs, each with its top point: none a brick stands on, and none another cord leaves from
const topStuds = (build, part) => {
  const on = [...build.parts_.values()].filter((o) => build.bricks.find((x) => x.n === o.id)?.on === part.id), keys = [];
  for (let i = 0; i < part.ws; i++) for (let j = 0; j < part.ds; j++) {
    const x = part.x + (i + 0.5) * U, y = part.y + (j + 0.5) * U;
    if (!on.some((o) => inside(x, y, o)) && !(part.cordRings ?? []).includes(`${i},${j}`)) keys.push([`${i},${j}`, [x, y, part.z0 + part.h]]);
  }
  return keys;
};
// a cord's route: of every free stud on the brick's top and every free stud of the plate, the nearest pair whose cord runs clear
const cordRoute = (build, p, part, under, placed) => {
  const gap = (r) => Math.hypot(r.from[0] - r.to[0], r.from[1] - r.to[1], r.from[2] - r.to[2]);
  const pairs = topStuds(build, part).flatMap(([top, from]) => plateStuds(p, part).map((key) => ({ top, from, key, to: ringOn(p, key, p.z0 + p.h) }))).sort((a, b) => gap(a) - gap(b));
  // the nearest pair clear of every other mass, else the nearest that passes only in front of one
  const routed = pairs.map((r) => ({ ...r, curve: cords.curve(r.from, r.to) }));
  for (const front of [false, true]) {
    const r = routed.find((x) => !cordCrossing({ p, part, under, curve: x.curve }, [...build.parts_.values()], placed, front));
    if (r) return { ...r, front };
  }
  return null;
};
// a hovering brick's free underside studs, each with its point on the underside: the cells of a brick standing on another
// brick that stand over none of it, and none another cord hangs from
const underStuds = (build, part, b) => {
  if (b.on === null) return [];
  const base = build.parts_.get(b.on), keys = [];
  for (let i = 0; i < part.ws; i++) for (let j = 0; j < part.ds; j++) {
    const x = part.x + (i + 0.5) * U, y = part.y + (j + 0.5) * U;
    if (!inside(x, y, base) && !(part.hangRings ?? []).includes(`${i},${j}`)) keys.push([`${i},${j}`, [x, y, part.z0]]);
  }
  return keys;
};
// a hanging cord and its cap are drawn just before their brick, which hides what it stands in front of; the bricks under it they
// pass only in front of, its plate only above, and every other brick and stack they miss outright
const hangCrossing = (t, parts, plates) => {
  const under = new Set(t.under ?? []), [x, y, z] = t.curve.from, r = cords.cap.r;
  const cap = Array.from({ length: 8 }, (_, k) => [x + r * Math.cos((k * Math.PI) / 4), y + r * Math.sin((k * Math.PI) / 4), z - cords.cap.h]);
  const masses = [
    ...parts.filter((o) => o.id !== t.part.id).map((o) => ({ id: `brick ${o.id}`, poly: silhouette(o, 0, 0), box: o, end: under.has(o.id) })),
    ...plates.filter((p) => p === t.p || p.rt.plates > 1).map((p) => ({ id: p.rt.letter, poly: silhouette(p, 0, 0), box: p, end: p === t.p })),
  ];
  return cordHit({ ...t.curve, pts: [...cap, ...t.curve.pts] }, masses, (q) => pt(0, 0, ...q));
};
// a hanging route: of every free underside stud and every free stud of the plate, the nearest pair whose cord drops clear
const hangRoute = (build, p, part, b, under) => {
  const gap = (r) => Math.hypot(r.from[0] - r.to[0], r.from[1] - r.to[1], r.from[2] - r.to[2]);
  const pairs = underStuds(build, part, b).flatMap(([top, from]) => plateStuds(p, part).map((key) => ({ top, from, key, to: ringOn(p, key, p.z0 + p.h) }))).sort((a, c) => gap(a) - gap(c));
  for (const r of pairs) {
    const curve = cords.curve(r.from, r.to, { under: true });
    if (!hangCrossing({ p, part, under, curve }, [...build.parts_.values()], build.plates)) return { ...r, curve, hang: true };
  }
  return null;
};
const cordable = (build, p) => p.links.filter((l) => l.kind === 'reach' && build.parts_.has(l.b.n)).every((l) => {
  const part = build.parts_.get(l.b.n), under = underOf(build, l.b), placed = build.plates.filter((x) => x.x !== undefined);
  return !!cordRoute(build, p, part, under, placed);
});
// the place a plate takes: on the side nearest the brick that peers it, a stud clear of every placed plate where one fits
// and meeting it where none does, nearest that brick, and only where every cord to it runs clear; null when none serves
function placeOne(build, kit, core, p, anchor) {
  settle(p);
  const placed = build.plates.filter((x) => x !== p && x.x !== undefined);
  const grown = (o, g) => ({ x: o.x - g, y: o.y - g, w: o.w + 2 * g, d: o.d + 2 * g });
  const fits = (g) => ([x, y]) => {
    Object.assign(p, { x, y });
    return !placed.some((o) => overlap(grown(o, g), p)) && cordable(build, p);
  };
  const spots = edgeSpots(core, p, anchor), spot = spots.find(fits(U)) ?? spots.find(fits(0));
  if (!spot) return false;
  Object.assign(p, { x: spot[0], y: spot[1] });
  const seated = [];
  for (const link of p.links.filter((l) => l.kind === 'seat')) {
    const [ws, ds] = footprint(link.b), at = seatSpot(p, [ws, ds], seated) ?? [0, Math.max(0, p.d / U - ds)];
    seated.push([at[0], at[1], ws, ds]);
    const part = kit.brickAt(link.b, p.x + at[0] * U, p.y + at[1] * U, p.z0 + p.h + LIFT + (ws * ds > p.rt.topShape[0] * p.rt.topShape[1] ? CRS : 0));
    kit.seatOn(p, link, part);
    kit.standers(link.b);
  }
  return true;
}
const orders = (xs) => (xs.length < 2 ? [xs] : xs.flatMap((x, i) => orders([...xs.slice(0, i), ...xs.slice(i + 1)]).map((o) => [x, ...o])));
// plates that seat bricks go first, so the cords to the rest route around those bricks; the rest go nearest brick first, and
// where one finds no place every other order of them is tried before the build stops
function placeAround(build, kit, core) {
  const anchorOf = (p) => {
    const part = [...p.links].sort((a, c) => (a.b.on !== null) - (c.b.on !== null)).map((l) => build.parts_.get(l.b.n)).find(Boolean);
    return part ? [part.x + part.w / 2, part.y + part.d / 2] : [core.w / 2, 0];
  };
  const seats = (p) => p.links.some((l) => l.kind === 'seat');
  const rest = build.plates.filter((p) => p !== core && p.x === undefined).sort((a, c) => anchorOf(a)[0] - anchorOf(c)[0] || a.rt.letter.localeCompare(c.rt.letter));
  const first = rest.filter(seats), later = rest.filter((p) => !seats(p));
  for (const p of first) if (!placeOne(build, kit, core, p, anchorOf(p))) fail(build, `${p.rt.name} finds no place against ${CORE}`);
  const anchors = new Map(later.map((p) => [p, anchorOf(p)]));
  const tries = orders(later);
  if (tries.find((order) => {
    later.forEach((p) => delete p.x);
    return order.every((p) => placeOne(build, kit, core, p, anchors.get(p)));
  })) return;
  fail(build, `${listOf(later.map((p) => p.rt.name))} find no places against ${CORE} with every cord clear, in any order`);
}
// a reach no seam carries is a cord: a string with end studs to a ringed stud of the plate, hanging from a free stud of a hovering
// brick's underside where its drop clears, else leaving a free stud of the brick's top
function cordUp(build) {
  for (const p of build.plates) for (const link of p.links.filter((l) => l.kind === 'reach')) {
    const part = build.parts_.get(link.b.n), under = underOf(build, link.b);
    const hang = hangRoute(build, p, part, link.b, under);
    const route = hang ?? cordRoute(build, p, part, under, build.plates) ?? fail(build, `brick ${link.b.n} has no pair of free studs whose cord to ${p.rt.name} clears every brick and stack`);
    p.rings.push(route.key);
    if (hang) (part.hangRings ??= []).push(route.top);
    else (part.cordRings ??= []).push(route.top);
    link.kind = 'cord';
    p.reached.push(link.b);
    build.cords.push({ p, part, under, from: route.from, to: route.to, curve: route.curve, front: route.front, hang: Boolean(hang) });
  }
}
// a model's layout; a brick core packs takes its first spot from which every plate still finds a place with its cords clear
function layoutBuild(build) {
  for (let skip = 0; skip < 36; skip++) {
    try {
      return layoutOnce(build, skip);
    } catch (e) {
      if (!/find no places|finds no room/.test(e.message)) throw e;
    }
  }
  fail(build, 'no spot on core lets every cord route clear');
}
function layoutOnce(build, skip) {
  seatParts(build);
  const kit = placer(build);
  const core = settle(build.plates.find((p) => p.rt.name === CORE));
  Object.assign(core, { x: 0, y: 0 });
  placeCore(build, kit, core, skip);
  placeAround(build, kit, core);
  cordUp(build);
  for (const p of build.plates) p.ringAt = ringOn(p, p.rings[0], p.z0 + p.h);
  checkParts(build);
  checkCouplings(build);
  checkPlan(build);
  // each model stands on its own slab of ground, a stud wider than the model all round
  const all = [...build.plates, ...build.parts_.values()];
  const x0 = Math.min(...all.map((o) => o.x)), y0 = Math.min(...all.map((o) => o.y));
  const x1 = Math.max(...all.map((o) => o.x + o.w)), y1 = Math.max(...all.map((o) => o.y + o.d));
  build.boxes = [
    { id: `${build.numeral}:G`, ground: true, x: x0 - U, y: y0 - U, w: x1 - x0 + 2 * U, d: y1 - y0 + 2 * U, z0: 0, h: GROUND_H, build },
    ...build.plates.map((p) => ({ id: `${build.numeral}:${p.rt.letter}`, x: p.x, y: p.y, w: p.w, d: p.d, z0: p.z0, h: p.h, pl: p, build })),
    ...[...build.parts_.values()].map((part) => ({ ...part, id: `${build.numeral}:${part.id}`, brick: build.bricks.find((x) => x.n === part.id), build })),
  ];
}
MODELS.forEach(layoutBuild);
if (!MODELS.every((m) => m.plates.some((p) => p.rt.name === CORE))) throw new Error(`sheet 2C: a model stands on no ${CORE} plate`);
const STOOD = new Set(BUILT.flatMap((b) => b.plates.map((p) => p.rt)));
const SPARE_PLATES = RUNTIMES.filter((r) => !STOOD.has(r));
// a plate's builds read from a reading's rows alone, so a later reading counts without a drawing; the drawn models agree
const buildsOn = (reading, r) => reading.builds.filter((b) => presentIn(b, r.name) && b.parts.some((p) => peersOf(p).includes(r.name)));
const drawnOn = (r) => BUILT.filter((b) => b.plates.some((p) => p.rt === r));
for (const r of RUNTIMES) if (buildsOn(READINGS[0], r).length !== drawnOn(r).length) throw new Error(`sheet 2C: ${r.name} is under ${drawnOn(r).length} drawn builds but ${buildsOn(READINGS[0], r).length} by the rows`);

// ---- the models in the round: each layout in sheet 2's plan units (40 a stud, 24 a course), seated, with each brick's drawn lift ----
const PLAN = (v) => +((v / U) * 40).toFixed(3);
const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const modelFor = (build) => {
  const seatedZ = new Map();
  const plateAt = (x, y, z) => build.plates.find((p) => inside(x, y, p) && Math.abs(p.z0 + p.h - z) < 1e-6) ?? fail(build, `no plate top under a drop at ${x}, ${y}`);
  const zOf = (b) => {
    if (!seatedZ.has(b.n)) {
      const part = build.parts_.get(b.n), base = b.on === null ? null : build.bricks.find((x) => x.n === b.on);
      seatedZ.set(b.n, base ? zOf(base) + build.parts_.get(base.n).h : part.drops[0][2]);
    }
    return seatedZ.get(b.n);
  };
  const bricks = build.bricks.map((b) => {
    const part = build.parts_.get(b.n), z0 = zOf(b), lift = part.z0 - z0;
    if (!(lift > 0)) fail(build, `brick ${b.n} hovers at ${part.z0} but seats at ${z0}`);
    if (b.hue && b.hue !== hueOf(b.name)) fail(build, `brick ${b.n} wears ${b.hue} but brick-hues.mjs gives ${hueOf(b.name)}`);
    const drops = part.drops.map(([x, y, z]) => ({ on: b.on ?? plateAt(x, y, z).rt.letter, x: PLAN(x), y: PLAN(y) }));
    const linked = (kind) => build.plates.filter((p) => p.links.some((l) => l.b === b && l.kind === kind)).map((p) => p.rt.letter);
    return { n: b.n, name: b.name, ver: b.ver, files: b.files, sloc: b.sloc, shape: b.shape, hue: b.hue ?? null, ws: part.ws, ds: part.ds, courses: b.courses,
      x: PLAN(part.x), y: PLAN(part.y), z0: PLAN(z0), h: PLAN(part.h), lift: PLAN(lift), on: b.on, seat: b.seat?.letter ?? null,
      straddles: linked('straddle'), cords: linked('cord'), hangs: build.cords.filter((t) => t.hang && t.part.id === b.n).map((t) => t.p.rt.letter), rings: [...part.rings, ...(part.cordRings ?? [])], drops };
  });
  const plates = [...build.plates].sort((p, q) => p.rt.letter.localeCompare(q.rt.letter)).map((p) => {
    const r = p.rt, by = (kind) => p.links.filter((l) => l.kind === kind).map((l) => l.b.n);
    return { letter: r.letter, name: r.name, ver: r.ver, range: r.range, optional: r.optional, build: r.build, files: r.files, sloc: r.sloc, studs: r.studs,
      plates: r.plates, full: r.full, shape: r.shape, topShape: r.topShape, topOff: r.topOff, x: PLAN(p.x), y: PLAN(p.y), z0: PLAN(p.z0), h: PLAN(p.h),
      rings: p.rings, peeredBy: r.peeredBy.map((name) => byName(name).n), seats: by('seat'), straddled: by('straddle'), corded: by('cord') };
  });
  // a cord's two stud points, the brick's at its seat: its top, or its underside where the cord hangs
  const cordsOut = build.cords.map((t) => ({ n: t.part.id, letter: t.p.rt.letter, from: [PLAN(t.from[0]), PLAN(t.from[1]), PLAN(zOf(build.bricks.find((x) => x.n === t.part.id)) + (t.hang ? 0 : t.part.h))], to: [PLAN(t.to[0]), PLAN(t.to[1]), PLAN(t.to[2])], ...(t.hang ? { under: true } : {}) }));
  const g = build.boxes.find((o) => o.ground);
  return { numeral: build.numeral, name: build.name, words: build.words, slug: slugOf(build.name), atlas: Boolean(build.atlas), consumers: build.consumers.length, kinds: kindsLine(build),
    ground: { x: PLAN(g.x), y: PLAN(g.y), w: PLAN(g.w), d: PLAN(g.d), h: PLAN(g.h) }, bricks, plates, cords: cordsOut, unpeered: build.unpeered.map((t) => RT(t).letter) };
};

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
// the guard: every cord drawn passes no brick or stack but above or in front of it, so nothing drawn over it hides it
function checkCords(build) {
  for (const t of build.cords) {
    const hit = t.hang ? hangCrossing(t, [...build.parts_.values()], build.plates) : cordCrossing(t, [...build.parts_.values()], build.plates, true);
    if (hit) throw new Error(`sheet 2C: build ${build.numeral}: the cord from brick ${t.part.id} to ${t.p.rt.letter} meets ${hit}`);
  }
}
// the masses back to front, a hanging cord just before its brick, then the other cords over them all, which the guard keeps
// clear of every face that would hide them
const drawModel = (build, ox, oy) => [...paintOrder(build.boxes).map((i) => {
  const b = build.boxes[i];
  if (b.ground) return block(ox, oy, b.x, b.y, b.w, b.d, b.z0, b.h, build.atlas ? { edge: 'ska' } : {});
  if (b.pl) return stack(ox, oy, b.pl.rt, { x: b.x, y: b.y, z0: b.z0, rings: new Set(b.pl.rings) });
  const fall = b.drops.map(([x, y, z]) => drop(ox, oy, x, y, b.z0, z)).join('\n');
  const hung = build.cords.filter((t) => t.hang && t.part.id === b.brick.n).map((t) => cords.cord(ox, oy, null, null, { curve: t.curve }));
  return `${[...hung, fall].join('\n')}\n${brick(ox, oy, b.x, b.y, b.ws, b.ds, b.brick.courses, { z0: b.z0, studEdge: 'sk', ringStuds: new Set([...b.rings, ...(b.cordRings ?? [])]), hue: b.brick.hue })}`;
}), ...build.cords.filter((t) => !t.hang).map((t) => cords.cord(ox, oy, null, null, { curve: t.curve }))].join('\n');
// a badge keeps clear of every cord's strands and of its round plates, foot ring and all
const CAP_REACH = BADGE_R + (cords.cap.r + 4 * K) * Math.SQRT2 * 0.866 + 2;
const clearOfCords = (build, ox, oy, c) => build.cords.every((t) => t.curve.pts.every((q) => Math.hypot(pt(ox, oy, ...q)[0] - c[0], pt(ox, oy, ...q)[1] - c[1]) > BADGE_R + 4)
  && [t.curve.from, t.curve.to].every(([x, y, z], k) => {
    const zc = !k && t.hang ? z - cords.cap.h : z + cords.cap.h;
    return Math.hypot(pt(ox, oy, x, y, zc)[0] - c[0], pt(ox, oy, x, y, zc)[1] - c[1]) > CAP_REACH;
  }));
// the badge spacing every badge of a model keeps from the others
const BADGE_GAP = 24;
// badges: a brick's number above its far roof corner, or at its near-left roof corner when a brick stands on it;
// a plate's letter beside its ringed stud, placed by plateBadge
// a badge that would crowd one placed before it takes the nearest spot that keeps the gap and meets no other brick,
// searched outward a unit at a time
const brickBadges = (build, ox, oy) => build.boxes.filter((b) => b.brick).reduce((marks, b) => {
  const carries = build.bricks.some((x) => x.on === b.brick.n);
  const [x, y] = carries ? pt(ox, oy, b.x, b.y + b.d, b.z0 + b.h) : pt(ox, oy, b.x, b.y, b.z0 + b.h);
  const home = carries ? [x - 13, y - 2] : [x, y - 13];
  const others = build.boxes.filter((o) => o.brick && o !== b).map((o) => silhouette(o, ox, oy));
  const ok = (c) => marks.every((m) => Math.hypot(m.at[0] - c[0], m.at[1] - c[1]) >= BADGE_GAP) && !others.some((m) => circleMeets(c, BADGE_R + 1, m)) && clearOfCords(build, ox, oy, c);
  let at = null;
  for (let d = 0; d <= 80 && !at; d++)
    for (let k = 0; k < (d ? 24 : 1) && !at; k++) {
      const c = [+(home[0] + d * Math.cos((k * Math.PI) / 12)).toFixed(1), +(home[1] - d * Math.sin((k * Math.PI) / 12)).toFixed(1)];
      if (ok(c)) at = c;
    }
  if (!at) throw new Error(`sheet 2C: brick ${b.brick.n}'s badge in build ${build.numeral} finds no clear spot`);
  return [...marks, { id: b.id, label: b.brick.n, at }];
}, []);
// a letter badge sits wholly on its own plate's roof, wholly on its ground slab's top face clear of every other mass,
// or wholly in clear air; it never straddles a face's edge. The search starts at (−16, −11) off core's ringed stud, and
// off a runtime's ring a badge's reach further out from core's centre, so the letters spread from core's edges; the nearest
// spot wins, searched outward a unit at a time, and a spot off the start takes a leader back to the ring
const badgeHome = (build, b, ox, oy, [rx, ry]) => {
  const coreBox = build.boxes.find((o) => o.pl?.rt.name === CORE);
  if (b === coreBox) return [rx - 16, ry - 11];
  const [cx, cy] = pt(ox, oy, coreBox.x + coreBox.w / 2, coreBox.y + coreBox.d / 2, coreBox.z0 + coreBox.h);
  const out = Math.hypot(rx - cx, ry - cy) || 1;
  return [+(rx + ((rx - cx) / out) * 2 * BADGE_R).toFixed(1), +(ry + ((ry - cy) / out) * 2 * BADGE_R - 6).toFixed(1)];
};
function plateBadge(build, b, ox, oy, taken) {
  const [rx, ry] = pt(ox, oy, ...b.pl.ringAt);
  const R = BADGE_R + 1;
  // read at the badge's own x on the seated brick's two lower silhouette edges
  const underClear = (at) => b.pl.seated.every((seated) => {
    const part = build.parts_.get(seated.n);
    const [L, N, Rt] = [[part.x, part.y + part.d], [part.x + part.w, part.y + part.d], [part.x + part.w, part.y]].map(([x, y]) => pt(ox, oy, x, y, part.z0));
    const edgeY = (x) => (x < L[0] || x > Rt[0] ? -Infinity : x <= N[0] ? L[1] + ((x - L[0]) / (N[0] - L[0])) * (N[1] - L[1]) : N[1] + ((x - N[0]) / (Rt[0] - N[0])) * (Rt[1] - N[1]));
    return [at[0] - BADGE_R, at[0], at[0] + BADGE_R].every((x) => at[1] - BADGE_R > edgeY(x) + 1);
  });
  const r = b.pl.rt, roof = topFace(ox, oy, b.x + r.topOff[0] * U, b.y + r.topOff[1] * U, r.topShape[0] * U, r.topShape[1] * U, b.z0 + b.h);
  const slab = groundTop(build, ox, oy);
  const masses = build.boxes.filter((o) => !o.ground).map((o) => silhouette(o, ox, oy));
  const ground = silhouette(build.boxes.find((o) => o.ground), ox, oy);
  const onRoof = (c) => circleInside(c, R, roof);
  const others = build.boxes.filter((o) => !o.ground && o !== b).map((o) => silhouette(o, ox, oy));
  const seated = (c) => (onRoof(c) && !others.some((m) => circleMeets(c, R, m))) || (!masses.some((m) => circleMeets(c, R, m)) && (circleInside(c, R, slab) || !circleMeets(c, R, ground)));
  const clearOfDrop = (c) => (b.pl.seated.length ? Math.abs(c[0] - rx) > BADGE_R + 1 : true);
  const ok = (c) => seated(c) && underClear(c) && clearOfDrop(c) && clearOfCords(build, ox, oy, c) && taken.every(([x, y]) => Math.hypot(x - c[0], y - c[1]) >= BADGE_GAP);
  const home = badgeHome(build, b, ox, oy, [rx, ry]);
  let at = null;
  for (let d = 0; d <= 120 && !at; d++)
    for (let k = 0; k < (d ? 24 : 1) && !at; k++) {
      const c = [+(home[0] + d * Math.cos((k * Math.PI) / 12)).toFixed(1), +(home[1] + d * Math.sin((k * Math.PI) / 12)).toFixed(1)];
      if (ok(c)) at = c;
    }
  if (!at) throw new Error(`sheet 2C: plate ${r.letter}'s badge in build ${build.numeral} finds no seat within 120 units`);
  // the guard: a letter badge on no roof of its own never straddles its ground slab's top face
  if (!onRoof(at) && circleMeets(at, R, slab) && !circleInside(at, R, slab)) throw new Error(`sheet 2C: plate ${r.letter}'s badge in build ${build.numeral} straddles its ground slab's top face`);
  const ring = [rx, ry - SH], gap = Math.hypot(ring[0] - at[0], ring[1] - at[1]), halo = RX + 5.5 * K;
  const u = [(ring[0] - at[0]) / gap, (ring[1] - at[1]) / gap];
  const lead = at === home || at.join() === home.join() || gap < BADGE_R + halo + 4 ? null
    : [at[0] + u[0] * BADGE_R, at[1] + u[1] * BADGE_R, ring[0] - u[0] * halo, ring[1] - u[1] * halo].map((v) => +v.toFixed(1));
  return { id: b.id, label: r.letter, at, lead };
}
const badgesOf = (build, ox, oy) => {
  const marks = brickBadges(build, ox, oy);
  for (const b of build.boxes.filter((o) => o.pl)) marks.push(plateBadge(build, b, ox, oy, marks.map((m) => m.at)));
  return marks;
};
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
  [`BUILD ${b.numeral} · ${b.name.toUpperCase()}`, b.atlas ? 'lbla' : 'lblt'],
  [`${plural(b.consumers.length, 'consumer')} · ${kindsLine(b)}${b.atlas ? ` · ${b.words}` : ''}`, 'lblf'],
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
const spanOf = (b, cols) => Math.min(cols, Math.max(1, Math.ceil((LOCAL.get(b).w + 2 * (PAD + MARGIN) + GUT) / (PW + GUT))));
// the grid: four columns unless three leave fewer cells empty; panels fill row by row in build order, a span wrapping whole
const cellsAt = (cols) => {
  let c = 0, r = 0;
  const at = MODELS.map((b) => {
    if (c + spanOf(b, cols) > cols) { c = 0; r++; }
    const cell = [c, r];
    c += spanOf(b, cols);
    return cell;
  });
  return { cols, at, rows: r + 1, empty: (r + 1) * cols - MODELS.reduce((a, b) => a + spanOf(b, cols), 0) };
};
const GRID = [cellsAt(4), cellsAt(3)].sort((a, b) => a.empty - b.empty || b.cols - a.cols)[0];
const SPAN = new Map(MODELS.map((b) => [b, spanOf(b, GRID.cols)]));
if (MODELS.some((b) => LOCAL.get(b).w + 2 * (PAD + MARGIN) > spanW(SPAN.get(b)))) throw new Error('sheet 2C: a model is wider than the row');
const CALLOUTS = new Map(MODELS.map((b) => [b, calloutRows(calloutOf(b), spanW(SPAN.get(b)) - 2 * PAD - 2 * CALL_PAD)]));
const HEAD_H = PAD + 13 + (Math.max(...MODELS.map((b) => headLines(b).length)) - 1) * LINE + 12;
const CALL_H = (b) => CALLOUTS.get(b).h + 2 * CALL_PAD;
const MODEL_TOP = (b) => HEAD_H + CALL_H(b) + 12;
const needH = (b) => MODEL_TOP(b) + LOCAL.get(b).h + PAD + MARGIN;
// each row is as tall as its tallest panel's head, callout and model; the panels in a row share it
const ROW_H = Array.from({ length: GRID.rows }, (_, r) => Math.ceil(Math.max(...MODELS.filter((_, i) => GRID.at[i][1] === r).map(needH))));
const ROW_Y = ROW_H.map((_, r) => ROW_H.slice(0, r).reduce((a, h) => a + h + GUT, 0));
const GRID_W = spanW(GRID.cols), GRID_H = ROW_Y.at(-1) + ROW_H.at(-1);

// ---- the box: the parts inventory, each family part with its carrying count ----------------------------------
const LEFT = 20, TOP = 58, LEGEND_W = 340, ROW_TEXT = 150;
const GX = LEFT + LEGEND_W + 30, GY = TOP;
const VW = Math.ceil(Math.max(1480, GX + GRID_W + LEFT));
// a later reading's count rides its own line under the cabinet's
const tail = (count) => also(count).replace(/^ · /, '');
const carriedBy = (b) => (CARRY(b) ? `carried by ${plural(CARRY(b), 'consumer')}` : 'carried by none at the cabinet’s tree');
const underBuilds = (r) => (STOOD.has(r) ? `under ${plural(drawnOn(r).length, 'build')}` : 'under none');
const BOX_GROUPS = [
  { head: `THE PARTS — ${WORD[FAMILY.length].toUpperCase()} BRICKS AT SHEET 2’S MOULD`, items: FAMILY.map((b) => ({ id: b.n, name: b.name, fig: miniBrick(b, CARRY(b) ? '' : '3 2'), title: b.disp, subs: [`${shapeName(b.shape)} · ${courseWord(b.courses)}`, carriedBy(b), tail((r) => fmt(r.totals.carrying[b.name]))], badge: b.n, cls: CARRY(b) ? 'ska fp' : 'sks fp', num: CARRY(b) ? 'lbla' : 'lbl' })) },
  { head: `THE PLATES — ${WORD[RUNTIMES.length].toUpperCase()} RUNTIMES AT THE SAME SCALE`, items: RUNTIMES.map((r) => ({ id: r.letter, name: r.name, fig: miniStack(r, STOOD.has(r) ? (r.optional ? '3 2' : '') : '3 2'), title: r.name, subs: [plateWord(r), `${plural(r.studs, 'stud')} · ${underBuilds(r)}`, tail((g) => `under ${buildsOn(g, r).length ? fmt(buildsOn(g, r).length) : 'none'}`)], badge: r.letter, cls: 'ska fp', num: 'lbla' })) },
];
const SPARE_GROUPS = [{ items: [
  ...UNUSED_PARTS.map((b) => ({ fig: miniBrick(b, '3 2'), badge: b.n, title: b.disp, subs: ['in the box, in no build at the cabinet’s tree', tail((r) => `carried by ${fmt(r.totals.carrying[b.name])}`)] })),
  ...SPARE_PLATES.map((r) => ({ fig: miniStack(r, '3 2'), badge: r.letter, title: r.name, cls: 'ska fp', num: 'lbla', subs: [r.optional ? 'an optional peer, pinned by no consumer' : `peered by ${listOf(r.peeredBy)}, in no build`, tail((g) => (buildsOn(g, r).length ? `under ${plural(buildsOn(g, r).length, 'build')}` : 'under none'))] })),
].map((s) => ({ cls: 'sks fp', num: 'lbl', ...s })) }];
// rows of items in `cols` columns, each row as tall as its tallest figure or lettering; a group's head rules the full width
const linesOf = (it) => [[it.title, 'lbl'], ...it.subs.filter(Boolean).map((s) => [s, 'lblf'])];
const boxGrid = (groups, x0, y0, width, cols) => {
  let y = y0;
  const out = [], colW = width / cols;
  for (const g of groups) {
    if (g.head) {
      // the rule clears the figure above it, which stands down to 7 px over the row's foot
      if (y > y0) y += 6;
      out.push(`${leader(x0, y - 8, x0 + width, y - 8)}${txt(x0 + 14, y + 14, g.head, 'lbls')}`);
      y += 30;
    }
    for (let k = 0; k < g.items.length; k += cols) {
      const row = g.items.slice(k, k + cols);
      const rh = Math.max(...row.map((it) => Math.max(linesOf(it).length === 2 ? 36 : 13 * linesOf(it).length + 10, it.fig.h + 14)));
      row.forEach((it, c) => {
        const x = x0 + c * colW, cy = y + rh / 2, lines = linesOf(it);
        const svg = `${it.fig.at(x + 70, cy - it.fig.h / 2)}
${badge(x + 24, cy, it.badge, it.cls, it.num)}
${lines.map(([s, cls], i) => txt(x + ROW_TEXT, cy - (lines.length - 1) * 6.5 + 4 + i * 13, s, cls)).join('\n')}`;
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
  checkCords(b);
  const marks = badgesOf(b, ox, oy);
  for (const m of marks) ALL_BADGES.push([...m.at, `${b.numeral}:${m.label}`]);
  return `<g id="${P}-build-${b.numeral}" data-build="${b.numeral}">
<rect x="${x}" y="${y}" width="${pw}" height="${ph}" class="${b.atlas ? 'ska' : 'skf'} fnone"${b.atlas ? ' stroke-dasharray="5 4" opacity="0.7"' : ''}/>
${headLines(b).map(([s, cls], k) => txt(x + PAD, y + PAD + 13 + k * LINE + (k ? 3 : 0), s, cls)).join('\n')}
<rect x="${x + PAD}" y="${y + HEAD_H}" width="${Math.ceil(call.w + 2 * CALL_PAD)}" height="${CALL_H(b)}" rx="4" class="skf fnone"/>
${callout}
${drawModel(b, ox, oy)}
${marks.filter((m) => m.lead).map((m) => leader(...m.lead)).join('\n')}
${marks.map((m) => badge(m.at[0], m.at[1], m.label)).join('\n')}
</g>`;
};
const panels = PANELS.map(panelSvg).join('\n');
// a stack draws studs on its top plate only: one footprint of studs per stack drawn
if (STUDS_DRAWN !== MODELS.reduce((a, b) => a + b.plates.reduce((s, p) => s + p.rt.topShape[0] * p.rt.topShape[1], 0), 0)) throw new Error(`sheet 2C: ${STUDS_DRAWN} studs drawn — a hidden plate carries studs`);
for (let i = 0; i < ALL_BADGES.length; i++) for (let j = i + 1; j < ALL_BADGES.length; j++)
  if (Math.hypot(ALL_BADGES[i][0] - ALL_BADGES[j][0], ALL_BADGES[i][1] - ALL_BADGES[j][1]) < BADGE_GAP) throw new Error(`sheet 2C: two badges within ${BADGE_GAP}px at ${ALL_BADGES[i]} and ${ALL_BADGES[j]}`);
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
// the straddles and cords a model draws, for its schedule row
const couplingsOf = (b) => {
  const of = (kind) => b.plates.flatMap((p) => p.links.filter((l) => l.kind === kind).map((l) => `brick ${l.b.n} to ${p.rt.letter}`));
  const tops = b.cords.filter((t) => !t.hang).map((t) => `brick ${t.part.id} to ${t.p.rt.letter}`);
  const hangers = [...new Set(b.cords.filter((t) => t.hang).map((t) => t.part.id))].map((n) => {
    const to = b.cords.filter((t) => t.hang && t.part.id === n).map((t) => t.p.rt.letter);
    return `${to.length > 1 ? 'cords hang' : 'a cord hangs'} from brick ${n} to ${listOf(to)}`;
  });
  return `${of('straddle').length ? ` · straddles ${listOf(of('straddle'))}` : ''}${tops.length ? ` · cords ${listOf(tops)}` : ''}${hangers.map((h) => ` · ${h}`).join('')}`;
};
const BUILD_ROWS = MODELS.flatMap((b) => [
  ...wrapWords(`${b.numeral}  ${b.name.toUpperCase()}${b.atlas ? ` — ${b.words}` : ''} — ${listOf(b.bricks.map((x) => `brick ${x.n} ${x.name}`))} — on plate${b.plates.length > 1 ? 's' : ''} ${listOf(b.plates.map((p) => `${p.rt.letter} ${p.rt.name}`))}${b.unpeered.length ? ` · ${listOf(b.unpeered)} pinned by the consumer, peered by no part here` : ''}${couplingsOf(b)}`, ROW_CHARS).map((s, i) => (i ? `      ${s}` : s)),
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
// the bricks whose cords hang, by build, for the notes
const HANGERS = MODELS.flatMap((b) => [...new Set(b.cords.filter((t) => t.hang).map((t) => t.part.id))].map((n) => `brick ${n} in build ${b.numeral}`));
const countOf = (n, word) => `${WORD[n]} ${word}${n === 1 ? '' : 's'}`;
export const SHEET2C_SCALE = `ONE BOX, ${WORD[MODELS.length].toUpperCase()} BUILDS`;

export const SHEET2C_VERDICT = `alternate builds from one box: ${WORD[BUILT.length]} builds pinned by ${plural(BUILDS.totals.consumers, 'consumer')}, ${MOST.name} the most built by ${WORD[MOST.consumers.length]}, and ${anOrd(MODELS.length)}, ${ATLAS_BUILD.name}, by the atlas’s own app on its own branch, none mixing two of ${listOf(REACTIVITY)}; ${UNUSED_PARTS.length ? `${listOf(UNUSED_PARTS.map((b) => b.name))} ${UNUSED_PARTS.length > 1 ? 'are' : 'is'} in no build at the cabinet’s tree${UNUSED_PARTS.some(IN_ATLAS) ? ` and in build ${ATLAS_BUILD.numeral} with the atlas app` : ''}` : 'every part is in a build at the cabinet’s tree'}${SPARE_PLATES.length ? `, and ${listOf(SPARE_PLATES.map((r) => r.name))} ${SPARE_PLATES.length > 1 ? 'are plates' : 'is a plate'} no build stands on at the cabinet’s tree, ${SPARE_WITH.length ? `${listOf(SPARE_WITH.map((r) => r.name))} with the atlas app too` : 'none with the atlas app'}` : ''}`;

const ARIA = `An exploded isometric LEGO assembly: alternate builds from one box of parts, laid out as an instruction booklet's panels. Each of ${WORD[MODELS.length]} panels holds one small model on its own slab of ground under a callout of its parts: the family parts one group of consumers installs together, standing on the runtime plates those parts peer, each runtime a stack of baseplates sized from one shipped build and lettered ${LETTERS} on a ringed stud: ${listOf(MODELS.map((b) => `build ${b.numeral}, ${b.name}${b.atlas ? ` (${b.words})` : ''}: ${listOf(b.bricks.map((x) => x.name))} on ${listOf(b.plates.map((p) => `${p.rt.name} (${plateWord(p.rt)})`))}, ${plural(b.consumers.length, 'consumer')}`))}. ${listOf(RUNTIMES.filter((r) => r.optional).map((r) => r.name))} are drawn dashed as optional peers. Build ${ATLAS_BUILD.numeral} is the atlas's own app, read on its own branch and drawn in an accent-edged dashed panel on accent-edged ground, spanning ${WORD[SPAN.get(ATLAS_BUILD)]} columns. A parts legend at the left is the box, each brick marked with the consumers carrying it at the cabinet's tree and with the atlas app, and a dashed register under it holds ${listOf([...UNUSED_PARTS.map((b) => b.name), ...SPARE_PLATES.map((r) => r.name)])}, in no build at the cabinet's tree. Schedules beneath give every build its consumers and every plate its build, tarball and closure.`;

const svg = `<svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${ARIA}">
${defs(P)}

${txt(VW - 30, 16, `SCALE — one scale, sheet 2’s: a family brick is 1 stud per ${SLOC_PER_STUD} sloc and a course per ${FILES_PER_COURSE} files · a runtime is baseplates at sheet 2’s baseplate footprint, ${shapeName(BASEPLATE)} = ${BASEPLATE_STUDS} studs, 1 stud per ${SLOC_PER_STUD} sloc of one shipped build — the development build where one is shipped`, 'lbls', 'end')}
${txt(VW - 30, 30, `laid a plate at a time and stacked when it overflows, the remainder on top at its own size · under ${BASEPLATE_STUDS} studs, one plate at its own size · a ringed stud marks each brick coupled to a plate, the plate lettered ${LETTERS}; a dashed plate is an optional peer · the ground is the registry, not massed`, 'lbls', 'end')}

${BOX.svg}

${panels}

${schedule}
</svg>`;

export const sheet2c = {
  num: '2C', id: 'companions-runtimes', rev: 'B',
  title: 'THE ALTERNATE BUILDS',
  sub: `ALTITUDE 2 — SIBLING PLATE, THE ECOSYSTEM: one box of ${WORD[FAMILY.length]} family bricks at sheet 2’s mould and ${WORD[RUNTIMES.length]} runtimes as stacks of baseplates sized from one shipped build at the same scale, and the ${WORD[BUILT.length]} alternate models the repository’s own consumers build from it, and ${anOrd(MODELS.length)} the atlas’s own app builds on its own branch — each model the parts one consumer pins, on the plates they peer · rows read census-builds.json, both readings, and census-peers.json @ ${PEERS.sha}`,
  scale: SHEET2C_SCALE,
  form: 'BUILD INSTRUCTIONS',
  svg,
  caption: `One box, ${WORD[MODELS.length]} models. The sample apps, the docs site and the examples pin ${WORD[BUILT.length]} distinct sets of family parts, and the atlas’s own app pins ${anOrd(MODELS.length)} on its own branch; each set is drawn as the small assembly it makes on the runtime plates its parts peer, under a callout of its parts: ${listOf(REACTIVITY)} share no model, ${countOf(UNUSED_PARTS.length, 'brick')} ${UNUSED_PARTS.length === 1 ? 'stays' : 'stay'} in the box at the cabinet’s tree and ${countOf(UNUSED_WITH.length, 'brick')} with the atlas app, and ${countOf(SPARE_PLATES.length, 'plate')} ${SPARE_PLATES.length === 1 ? 'carries' : 'carry'} nothing at the cabinet’s tree and ${WORD[SPARE_WITH.length]} with the atlas app.`,
  notes: `
<p><strong>One box, several models.</strong> Sheet 2 draws every family brick in one assembly on ${npmLink(CORE)}. The repository's own consumers — ${plural(BUILDS.totals.consumers, 'consumer')}: the sample apps, the docs site and the examples at the cabinet's sha — pin ${WORD[BUILT.length]} distinct sets of family parts, each manifest closed over its family peers, and this plate draws each set as the model it makes: its parts at sheet 2's mould, standing on the runtime plates those parts peer. The ${ORDINAL[MODELS.length]} model, build ${ATLAS_BUILD.numeral}, is the atlas's own app: its manifest at <code>${ATLAS_APP.dir}</code>, read from <code>git archive ${ATLAS_APP.ref}</code> @ ${ATLAS_APP.sha}, off the cabinet's tree, and drawn accent-edged on its own branch the way sheet A4 draws the atlas deploy. Every count on this sheet reads both ways, the cabinet's tree first and “with the atlas app” after. Build ${MOST.numeral} is the most built, ${listOf(MOST.bricks.map((x) => npmLink(x.name)))} alone on ${listOf(MOST.plates.map((p) => npmLink(p.rt.name)))}, by ${plural(MOST.consumers.length, 'consumer')}. ${Cap(WORD[EMPTY.flatMap((e) => e.consumers).length])} consumer pins no family part at all${EMPTY.length ? ` (${listOf(EMPTY.flatMap((e) => e.consumers))})` : ''}, and is a consumer rather than a build.</p>
<p><strong>No model mixes two reactivity runtimes.</strong> ${Cap(listOf(REACTIVITY.map((n) => npmLink(n))))} are each reached by a family binding — ${listOf(BINDINGS.map((b) => npmLink(b.name)))} — and no consumer in either reading mixes two of them; the build stops if one does. The bindings are alternates in the box, the way one set's instructions show a car or a plane, not both.</p>
<p><strong>Ground and stacking follow the dependency.</strong> A family brick peers ${npmLink('lit')} or ${npmLink('effect')}, not the reverse, and no runtime on this plate peers another — both read from each row's own <code>peerDependencies</code> — so each runtime is a plate, the parts stand on them, and the plates lie on plain ground. ${npmLink(CORE)} is a plate like the others: ${WORD[CORE_ROW.peeredBy.length]} of the ${WORD[FAMILY.length]} family bricks peer it, and it is the baseplate of every model, laid first at the left, the way sheet 2 seats the family on it. A part stands on the part it peers when that part is in the same build, as it does on sheet 2, and the rest seat on core at sheet 2's places measured from core's right edge, packed from the back where sheet 2 seats them off its client plate; a part that peers no core seats on its one runtime (${listOf(FAMILY.filter((f) => MODELS.some((m) => m.bricks.some((b) => b.n === f.n && b.seat && b.seat.name !== CORE))).map((b) => b.name))}). Every other runtime a brick peers abuts core and the brick reaches it, unless the brick it stands on already carries it: a brick on core straddles the seam onto a flat runtime plate one stud deep, the way ${npmLink('lit-ui-router')} stands on both core and ${npmLink('lit')}, and a brick that cannot straddle, one on another brick or one beside a stack, reaches it by a cord: a string with end studs, two 1×1 round plates joined by a cord, one seated on a ringed stud of the brick's top and the other on a ringed stud of the plate, the cord leaving each plate's own stud, from the nearest pair of free studs whose cord clears every brick and stack. A brick standing on another brick hangs its cord instead from a free stud of its underside, the round plate's stud seated in the brick as on a stud, wherever that cord drops clear of every other brick and stack${HANGERS.length ? ` — ${listOf(HANGERS)}` : ''}. Nothing abuts core from behind: a stack taller than core stands at its left or right side, and a flat plate along its front, at the right beside the seam or at the left, wherever every cord to it runs clear of every brick and stack; each plate rings one stud per brick coupled to it. The atlas app's model spans the columns its width needs. A build stands on the runtimes its consumers declare and on every required peer its parts carry, which the installer adds whether or not a manifest names it; an optional peer no consumer declares stays off the model.</p>
<p><strong>One scale.</strong> The family keeps sheet 2's mould exactly — 1 stud per ${SLOC_PER_STUD} sloc rounded up the brick shapes, a course per ${FILES_PER_COURSE} authored files. A runtime is baseplates at sheet 2's baseplate footprint, ${shapeName(BASEPLATE)} = ${BASEPLATE_STUDS} studs, one stud per ${SLOC_PER_STUD} sloc of one shipped build — the files reachable from its <code>exports</code> entries, the <code>development</code> condition where one is shipped${DEV.length ? ` (${listOf(DEV.map((r) => npmLink(r.name)))})` : ''} — laid a plate at a time and stacked when it overflows, the remainder on top at its own size, three plates to a brick course: ${listOf(RUNTIMES.filter((r) => r.stacked).map((r) => `${npmLink(r.name)} is ${plateWord(r)}`))}. Under ${BASEPLATE_STUDS} studs a runtime is one plate at its own size, the nearest rectangle: ${listOf(RUNTIMES.filter((r) => !r.stacked).map((r) => `${npmLink(r.name)} ${shapeName(r.shape)}`))}. A package's dependencies are a number in the schedule rather than area on the plate: ${listOf(FACADES.map((r) => `${npmLink(r.name)} builds ${fmt(r.sloc)} lines over a closure of ${fmt(r.closure.sloc)}`))}. Every model on lit stands on a ${shapeName(LIT.shape)}: ${WORD[LIT_BUILDS.length]} of the ${WORD[BUILT.length]} builds, ${WORD[MODELS.filter((b) => b.plates.some((p) => p.rt === LIT)).length]} of ${WORD[MODELS.length]} with the atlas app, and the runtime they run on is in its closure.</p>
<p><strong>What stays in the box.</strong> ${UNUSED_PARTS.length ? `${Cap(listOf(UNUSED_PARTS.map((b) => npmLink(b.name))))} ${UNUSED_PARTS.length > 1 ? 'are' : 'is'} carried by no consumer at the cabinet's tree, so no model of that reading draws ${UNUSED_PARTS.length > 1 ? 'them' : 'it'}${UNUSED_PARTS.some(IN_ATLAS) ? `; with the atlas app, ${listOf(UNUSED_PARTS.filter(IN_ATLAS).map((b) => b.name))} ${UNUSED_PARTS.filter(IN_ATLAS).length > 1 ? 'stand' : 'stands'} in build ${ATLAS_BUILD.numeral}` : ''}.` : 'Every part in the box is carried by a consumer at the cabinet’s tree, so a model of that reading draws each one.'} ${SPARE_PLATES.length ? `${Cap(listOf(SPARE_PLATES.map((r) => npmLink(r.name))))} ${SPARE_PLATES.length > 1 ? 'are plates' : 'is a plate'} no model stands on at the cabinet's tree — ${[SPARE_PLATES.filter((r) => r.optional).length ? `${listOf(SPARE_PLATES.filter((r) => r.optional).map((r) => r.name))} optional and pinned by no consumer there` : '', SPARE_PLATES.filter((r) => !r.optional).length ? `${listOf(SPARE_PLATES.filter((r) => !r.optional).map((r) => r.name))} peered only by a part no consumer there carries` : ''].filter(Boolean).join(', ')}${STOOD_BY_ATLAS.length ? `; with the atlas app, build ${ATLAS_BUILD.numeral} stands on ${listOf(STOOD_BY_ATLAS.map((r) => r.name))}, and ${SPARE_WITH.length ? `${listOf(SPARE_WITH.map((r) => r.name))} ${SPARE_WITH.length > 1 ? 'stay' : 'stays'} spare` : 'no plate stays spare'}` : ''}.` : 'Every plate stands under a model at the cabinet’s tree.'}${UNUSED_PARTS.length + SPARE_PLATES.length ? ` They stand in the dashed register under the box, each line reading the cabinet's tree first and the atlas app after, and the spare plates are drawn there rather than on the ground.` : ''}${VARIED.length ? ` ${Cap(listOf(VARIED.map((b) => `build ${b.numeral}'s manifests differ in what they pin and what they take as a peer`)))}; the schedule says which.` : ''} Every number on this sheet is read from <code>www/atlas.lit-ui-router.dev/data/census-builds.json</code>, <code>census-peers.json</code>, <code>census-bricks.json</code> and <code>census-couplings.json</code> — ${COUNTED}; the second reading adds <code>${ATLAS_APP.dir}</code> at ${ATLAS_APP.ref} @ ${ATLAS_APP.sha}.</p>`,
  key: [
    keyRow('<polygon points="4,12 16,5 30,12 30,16 16,9 4,16" class="sk fp"/><ellipse cx="10" cy="8" rx="4" ry="2.3" class="sk fp2"/><ellipse cx="24" cy="8" rx="4" ry="2.3" class="sk fp2"/>', `a family brick — sheet 2’s mould: 1 stud per ${SLOC_PER_STUD} sloc, a course per ${FILES_PER_COURSE} files`),
    keyRow('<polygon points="2,9 16,2 46,9 46,15 16,8 2,15" class="sk fp"/><path d="M2,11 L16,18 L46,11" class="skf fnone"/><path d="M2,13 L16,20 L46,13" class="skf fnone"/><ellipse cx="12" cy="7" rx="3" ry="1.7" class="sk fp2"/><ellipse cx="22" cy="5" rx="3" ry="1.7" class="sk fp2"/><ellipse cx="32" cy="7" rx="3" ry="1.7" class="sk fp2"/>', `a runtime — baseplates of ${shapeName(BASEPLATE)}, 1 stud per ${SLOC_PER_STUD} sloc of one shipped build, stacked when they overflow, the remainder on top at its own size; three plates are one brick course, ${3 * BASEPLATE_STUDS} studs; under ${BASEPLATE_STUDS} studs, one plate at its own size`),
    keyRow('<polygon points="4,13 14,8 24,13 24,16 14,11 4,16" class="sk fp"/><polygon points="26,11 32,8 44,14 44,17 32,11 26,14" class="sk fp"/>', 'a build — the family parts one consumer installs together, counted from the sample apps, the docs site and the examples at the cabinet’s sha, and from the atlas app’s own manifest on its branch'),
    keyRow('<rect x="4" y="2" width="40" height="14" class="ska fnone" stroke-dasharray="5 4" opacity="0.7"/>', 'an accent-edged panel — the atlas app’s build, on its own branch, its ground edged in accent'),
    keyRow('<ellipse cx="24" cy="9" rx="6" ry="3.5" class="ska fp"/><ellipse cx="24" cy="9" rx="11" ry="6.5" class="ska fnone"/>', `a ringed stud — one per brick coupled to a plate, under a seated or straddling brick or under a cord's round plate, on the plate and on the brick's top; the plate lettered ${LETTERS} beside it`),
    keyRow('<line x1="24" y1="2" x2="24" y2="16" class="ska" stroke-dasharray="6 4"/><circle cx="24" cy="16" r="2.2" class="fa"/>', 'drop line — the brick seats on that stud; a brick straddling a seam drops onto both plates'),
    keyRow('<ellipse cx="9" cy="9" rx="7" ry="3.8" class="ska fnone"/><path d="M3,6 L3,9 A6,3.4 0 0 0 15,9 L15,6 Z" class="sk fp2"/><ellipse cx="9" cy="6" rx="6" ry="3.4" class="sk fp"/><path d="M6.2,4 L6.2,5.5 A2.8,1.6 0 0 0 11.8,5.5 L11.8,4 Z" class="sk fp2"/><ellipse cx="9" cy="4" rx="2.8" ry="1.6" class="sk fp2"/><ellipse cx="39" cy="12.5" rx="7" ry="3.8" class="ska fnone"/><path d="M33,9.5 L33,12.5 A6,3.4 0 0 0 45,12.5 L45,9.5 Z" class="sk fp2"/><ellipse cx="39" cy="9.5" rx="6" ry="3.4" class="sk fp"/><path d="M36.2,7.5 L36.2,9 A2.8,1.6 0 0 0 41.8,9 L41.8,7.5 Z" class="sk fp2"/><ellipse cx="39" cy="7.5" rx="2.8" ry="1.6" class="sk fp2"/><path d="M9,3.4 Q26,3.4 39,6.9 M9,4.8 Q26,4.8 39,8.3 M14,3.5 L15,5 M19,3.8 L20,5.3 M24,4.2 L25,5.7 M29,4.8 L30,6.3 M34,5.8 L35,7.3" class="sk fnone" style="stroke-width:0.7"/>', 'a string with end studs — two 1×1 round plates joined by a cord, a coupling a footprint cannot make, drawn to fit and not massed: one plate seated on a ringed stud of the brick’s top, the other on a ringed stud of the runtime’s plate, the cord leaving each one’s own stud; a cap seats on a stud or hangs from a brick’s underside'),
    keyRow('<polygon points="2,11 16,4 46,11 46,14 16,7 2,14" class="sks fp" stroke-dasharray="3 2"/>', 'a dashed plate — an optional peer'),
    keyRow('<polygon points="8,12 16,7 26,12 26,15 16,10 8,15" class="sks fp" stroke-dasharray="3 2"/>', 'not in any build — a part no consumer carries, or a plate no model stands on'),
    keyRow('<polygon points="4,8 16,2 44,9 44,15 16,8 4,14" class="sk fp"/>', 'ground — the registry, not massed'),
  ].join('\n'),
};

/** Each model in MODELS order, seated in sheet 2's plan units, for the builds in the round. */
export const BUILD_MODELS = MODELS.map(modelFor);
if (new Set(BUILD_MODELS.map((m) => m.slug)).size !== BUILD_MODELS.length) throw new Error('sheet 2C: two builds share a slug');
/** The box the builds come from, and the reading they are counted at. */
export const BUILD_BOX = { bricks: FAMILY.length, plates: RUNTIMES.length, consumers: BUILDS.totals.consumers, counted: COUNTED, atlasApp: `${ATLAS_APP.dir} at ${ATLAS_APP.ref} @ ${ATLAS_APP.sha}` };

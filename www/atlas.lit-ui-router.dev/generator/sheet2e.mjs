import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, keyRow, npmUrl } from './helpers.mjs';
import { brickKit, paintOrder } from './brick-iso.mjs';
import { cordHit, cordKit } from './connector-iso.mjs';
import { BRICK_ROWS, COURSES, FILES_PER_COURSE, SHAPE, SLOC_PER_STUD, STUDS } from './sheet2.mjs';
import { BUILD_MODELS } from './sheet2c.mjs';

const P = 's2e';

// ---- census: consumers from census-consumers.json, builds from census-builds.json, the family from census-bricks.json ----
const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const CONS = read('census-consumers.json');
const BUILDS = read('census-builds.json');
const BRICKS = read('census-bricks.json');
for (const [name, plate] of [['census-builds.json', BUILDS], ['census-bricks.json', BRICKS]])
  if (plate.sha !== CONS.sha) throw new Error(`sheet 2E: census-consumers.json is at ${CONS.sha} but ${name} at ${plate.sha}`);
if (CONS.basis.atlasApp.sha !== BUILDS.basis.atlasApp.sha) throw new Error('sheet 2E: census-consumers.json and census-builds.json read the atlas app at two shas');
const COUNTED = `counted at ${CONS.ref} @ ${CONS.sha} (${CONS.generatedAtTime.slice(0, 10)}), the atlas app at ${CONS.basis.atlasApp.ref} @ ${CONS.basis.atlasApp.sha}`;
const fmt = (v) => v.toLocaleString('en-US');
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const Cap = (w) => w[0].toUpperCase() + w.slice(1);
const listOf = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;
const shapeName = ([w, d]) => `${w}×${d}`;

// ---- the family: sheet 2's nine bricks and the lint plugin, at sheet 2's mould ----
const LINT = BRICKS.rows.find((r) => r.name === 'eslint-plugin-lit-ui-router');
if (!LINT) throw new Error('sheet 2E: census-bricks.json has no eslint-plugin-lit-ui-router row');
const FAMILY = [
  ...BRICK_ROWS.map((b) => ({ n: b.n, name: b.name, disp: b.disp, files: b.files, sloc: b.sloc, shape: b.shape, courses: b.courses, hue: b.hue })),
  { n: BRICK_ROWS.length + 1, name: LINT.name, disp: LINT.name, files: LINT.files, sloc: LINT.sloc, shape: SHAPE(STUDS(LINT.sloc)), courses: COURSES(LINT.files), hue: null },
];
if (`${FAMILY.at(-1).shape.join('x')}` !== LINT.shape || FAMILY.at(-1).courses !== LINT.courses) throw new Error('sheet 2E: the lint plugin moulds differently here than in census-bricks.json');
if (FAMILY.length !== BRICKS.rows.length - 1) throw new Error(`sheet 2E: census-bricks.json lists ${BRICKS.rows.length - 1} family parts but ${FAMILY.length} are drawn`);
const byName = (name) => FAMILY.find((b) => b.name === name) ?? (() => { throw new Error(`sheet 2E: ${name} is not a family part`); })();
const FB = (n) => FAMILY.find((b) => b.n === n);

// ---- the consumers: both readings; the second carries the atlas app ----
const KIND = { 'sample-app': ['S', 'sample app'], 'docs-site': ['D', 'docs site'], example: ['E', 'example'], 'atlas-app': ['A', 'atlas app'] };
const ROWS = CONS.withAtlas.rows;
if (ROWS.length !== CONS.withAtlas.totals.consumers || CONS.rows.length !== CONS.totals.consumers) throw new Error('sheet 2E: census-consumers.json totals disagree with its rows');
if (ROWS.length !== BUILDS.withAtlas.consumers.length) throw new Error('sheet 2E: census-consumers.json and census-builds.json survey different consumers');
const ATLAS_ROWS = ROWS.filter((r) => r.kind === 'atlas-app');
if (ATLAS_ROWS.length !== 1 || CONS.rows.some((r) => r.kind === 'atlas-app')) throw new Error('sheet 2E: the second reading should add the atlas app alone');
// build order is sheet 2C's; the consumer with no build after the cabinet's builds, the atlas app last
const keyOf = (names) => [...names].sort().join(' + ');
const MODEL_OF = new Map(BUILD_MODELS.map((m) => [keyOf(m.bricks.map((b) => b.name)), m]));
const KIND_RANK = Object.keys(KIND);
const rank = (r) => (r.kind === 'atlas-app' ? 1e3 : r.build ? BUILD_MODELS.indexOf(MODEL_OF.get(r.build)) : BUILD_MODELS.length - 0.5);
const CONSUMERS = [...ROWS].sort((a, b) => rank(a) - rank(b) || KIND_RANK.indexOf(a.kind) - KIND_RANK.indexOf(b.kind) || ROWS.indexOf(a) - ROWS.indexOf(b)).map((r, i) => {
  if (r.build && !MODEL_OF.has(r.build)) throw new Error(`sheet 2E: ${r.name}'s build ${r.build} is no model on sheet 2C`);
  if (r.build !== (r.parts.length ? keyOf(r.parts) : null)) throw new Error(`sheet 2E: ${r.name}'s build key disagrees with its parts`);
  const shape = SHAPE(STUDS(r.sloc)), courses = COURSES(r.files);
  // a consumer's shape is the plate's, or sheet 2's rule has drifted from the probe's
  if (shape.join('x') !== r.shape || courses !== r.courses || STUDS(r.sloc) !== r.studs) throw new Error(`sheet 2E: ${r.name} moulds ${shapeName(shape)} × ${courses} here but ${r.shape} × ${r.courses} on the plate`);
  const pins = r.pinned.map(byName).sort((x, y) => x.n - y.n);
  const anchor = [...pins].sort((x, y) => y.sloc - x.sloc || x.n - y.n)[0] ?? null;
  return { ...r, k: i + 1, letter: KIND[r.kind]?.[0] ?? (() => { throw new Error(`sheet 2E: ${r.name} is a ${r.kind}, which the key has no letter for`); })(), kindWord: KIND[r.kind][1],
    shape, pins, anchor, model: r.build ? MODEL_OF.get(r.build) : null, atlas: r.kind === 'atlas-app' };
});
const ATLAS_C = CONSUMERS.find((c) => c.atlas);
const BARE = CONSUMERS.filter((c) => !c.pins.length);
const pinsWord = (c) => (c.pins.length ? `pins ${c.pins.map((b) => b.n).join(' · ')}` : 'pins none');
const buildName = (c) => (c.model ? `${c.model.numeral} ${c.model.name.toUpperCase()}` : 'NO BUILD');

// ---- the drawing kit: geometry in sheet 2's plan units, 40 a stud and 24 a course, drawn at the panels' pitch ----
const U = 18;
const K = U / 40;
const kit = brickKit({ U, p: P });
const { SH, RY } = kit;
const STUD = 40, CRS = 24;
const pt = (ox, oy, x, y, z) => kit.pt(ox, oy, x * K, y * K, z * K);
const cords = cordKit({ U, pt: kit.pt });
// the strands paint over every round plate, so a cord's own end plates cannot hide it: they are left out of its hit test
const hitBy = (curve, masses, project) => cordHit({ ...curve, cap: { ...curve.cap, r: 1e-3 } }, masses, project);
const GROUND_H = CRS;
const LIFT = 3 * CRS, GAP = CRS;
const overlap = (a, b) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.d - 0.01 && b.y < a.y + a.d - 0.01;
const inside = (px, py, b) => px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.d;
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
  .flatMap(([x, y]) => [pt(ox, oy, x, y, o.z0), pt(ox, oy, x, y, o.z0 + o.h + (o.ground ? 0 : (SH + RY) / K))]));
// separating axis between two convex polygons, inflated by `pad` along every axis
const meets = (a, b, pad = 0) => {
  for (const set of [a, b])
    for (let i = 0; i < set.length; i++) {
      const p = set[i], q = set[(i + 1) % set.length], ax = -(q[1] - p[1]), ay = q[0] - p[0], len = Math.hypot(ax, ay) || 1;
      const pa = a.map(([x, y]) => (x * ax + y * ay) / len), pb = b.map(([x, y]) => (x * ax + y * ay) / len);
      if (Math.min(...pa) - Math.max(...pb) >= pad || Math.min(...pb) - Math.max(...pa) >= pad) return false;
    }
  return true;
};
const rectPoly = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const circlePoly = ([cx, cy], r) => Array.from({ length: 12 }, (_, i) => [cx + r * Math.cos((i * Math.PI) / 6), cy + r * Math.sin((i * Math.PI) / 6)]);
const studsOf = (b) => {
  const out = [];
  for (let i = 0; i < b.ws; i++) for (let j = 0; j < b.ds; j++) out.push({ key: `${i},${j}`, x: b.x + (i + 0.5) * STUD, y: b.y + (j + 0.5) * STUD });
  return out;
};
const top = (b) => b.z0 + b.h;
// a brick's studs no other brick stands over
const freeStuds = (b, all) => studsOf(b).filter((s) => !all.some((o) => o !== b && !o.ground && Math.abs(o.z0 - top(b)) < 0.01 && inside(s.x, s.y, o)));

// ---- seating: each consumer hovers over the family part it pins and drops onto a ringed stud ----
// A consumer pinning two parts whose tops are coplanar straddles them, dropping onto each; otherwise it drops onto its heaviest
// pin and reaches each other pin by a cord. It hovers at the lowest height clear of everything under its plan, and its
// stud is under no consumer seated before it, so no drop passes through a brick.
function placements(studs, ws, ds) {
  const out = [];
  for (const [w, d] of ws === ds ? [[ws, ds]] : [[ws, ds], [ds, ws]])
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
      const x = studs[0].x - (i + 0.5) * STUD, y = studs[0].y - (j + 0.5) * STUD;
      const r = { x, y, w: w * STUD, d: d * STUD, ws: w, ds: d };
      if (studs.every((s) => inside(s.x, s.y, r))) out.push(r);
    }
  return out;
}
// every order of a list, the given order first
const orders = (xs) => (xs.length < 2 ? [xs] : xs.flatMap((x, i) => orders([...xs.slice(0, i), ...xs.slice(i + 1)]).map((o) => [x, ...o])));
const stringOf = (part, b, route) => ({ part, box: route.box, b, fromKey: route.f.key, toKey: route.e.key, curve: route.curve, front: route.front, to: [route.e.x, route.e.y, top(route.box)] });
const S = (o) => ({ x: o.x * K, y: o.y * K, w: o.w * K, d: o.d * K, z0: o.z0 * K, h: o.h * K });
const massOf = (o, end) => ({ id: o.consumer ? o.consumer.name : o.ground ? 'ground' : `brick ${o.part.n}`, poly: silhouette(o, 0, 0), box: S(o), end });
const onScreen = (q) => kit.pt(0, 0, ...q);
const cordsOf = (c) => c.pins.filter((x) => x !== c.anchor).length;
const nearFirst = (p, q) => Math.hypot(...p.from.map((v, k) => v - p.to[k])) - Math.hypot(...q.from.map((v, k) => v - q.to[k]));
const sharedArea = (r, p) => Math.max(0, Math.min(r.x + r.w, p.x + p.w) - Math.max(r.x, p.x)) * Math.max(0, Math.min(r.y + r.d, p.y + p.d) - Math.max(r.y, p.y));
// the scene a panel seats into: its family, the consumers placed so far, the studs dropped onto, and the cords drawn
function seatingOf(family, { lift, levels }) {
  const st = { family, placed: [], dropTaken: new Set(), strings: [], unrouted: [], lift, levels };
  st.all = () => [...family, ...st.placed];
  st.pinBox = (c, b) => family.find((o) => o.part === b) ?? (() => { throw new Error(`sheet 2E: ${c.name} pins brick ${b.n}, which this model does not draw`); })();
  st.capped = (o) => st.strings.filter((t) => t.box === o || t.part === o);
  return st;
}
// a cord's route from the consumer's top to the pin's top over `scene`: the nearest pair of free studs whose cord misses every other
// mass outright, else passes only above or in front of them; never behind or through
function routeFor(st, part, b, scene, share = false) {
  const box = st.family.find((o) => o.part === b);
  const tops = studsOf(part).filter((s) => !st.capped(part).some((t) => t.fromKey === s.key));
  const ends = freeStuds(box, scene).filter((s) => !st.dropTaken.has(`${b.n}:${s.key}`) && (share || !st.capped(box).some((t) => t.toKey === s.key)));
  const pairs = tops.flatMap((f) => ends.map((e) => ({ f, e, from: [f.x * K, f.y * K, top(part) * K], to: [e.x * K, e.y * K, top(box) * K] }))).sort(nearFirst);
  const masses = (front) => scene.filter((o) => !o.bare || o === part).map((o) => massOf(o, front || o === part || o === box || !!o.ground));
  for (const front of [false, true]) {
    const route = pairs.map((r) => ({ ...r, curve: cords.curve(r.from, r.to), front })).find((r) => !hitBy(r.curve, masses(front), onScreen));
    if (route) return { ...route, box };
  }
  // a part with more cords to take than free studs takes the extra ones on a round plate another cord already seats
  return share ? null : routeFor(st, part, b, scene, true);
}
// a consumer that pins nothing stands on the ground beside the parts
function seatBare(st, c) {
  const g = st.family.find((o) => o.ground);
  const r = { x: g.x + STUD, y: g.y + STUD, w: c.shape[0] * STUD, d: c.shape[1] * STUD, ws: c.shape[0], ds: c.shape[1] };
  if (r.x + r.w > g.x + g.w || r.y + r.d > g.y + g.d) throw new Error(`sheet 2E: ${c.name} is wider than its ground`);
  st.placed.push({ ...r, z0: top(g), h: c.courses * CRS, consumer: c, drops: [], bare: true });
}
// the spots a consumer may take: a straddle over a free stud of two coplanar pins, else over a free stud of its heaviest pin
function candidatesOf(st, c) {
  const free = (b) => freeStuds(st.pinBox(c, b), st.all()).filter((s) => !st.dropTaken.has(`${b.n}:${s.key}`) && !st.placed.some((p) => inside(s.x, s.y, p)));
  const coplanar = c.pins.flatMap((a, i) => c.pins.slice(i + 1).map((b) => [a, b])).filter(([a, b]) => Math.abs(top(st.pinBox(c, a)) - top(st.pinBox(c, b))) < 0.01);
  let out = coplanar.flatMap(([a, b]) => free(a).flatMap((sa) => free(b).flatMap((sb) => placements([sa, sb], c.shape[0], c.shape[1]).map((r) => ({ r, seats: [[a, sa], [b, sb]], straddle: true })))));
  if (!out.length) out = free(c.anchor).flatMap((s) => placements([s], c.shape[0], c.shape[1]).map((r) => ({ r, seats: [[c.anchor, s]], straddle: false })));
  if (!out.length) throw new Error(`sheet 2E: ${c.name} finds no free stud on brick ${c.anchor.n} that no consumer covers`);
  // a corded consumer may hover higher, a course at a time, where that lets its cords and the others' run clear
  return cordsOf(c) ? [...out, ...out.flatMap((cand) => [1, 2, 3, 4].map((k) => ({ ...cand, up: k * CRS })))] : out;
}
// a spot's height: over everything under its plan; a consumer with no cord on a level of its own, a course above the one seated before it
function heightAt(st, c, cand) {
  const hover = Math.max(...st.all().filter((o) => !o.ground && overlap(o, cand.r)).map((o) => top(o) + (o.consumer ? GAP : st.lift)), 0);
  const stacked = st.levels && !cordsOf(c) ? st.placed.filter((p) => !p.bare).map((p) => top(p) + GAP) : [];
  return (cand.up ?? 0) + Math.max(hover, ...cand.seats.map(([b]) => top(st.pinBox(c, b)) + st.lift), ...stacked);
}
// a spot's score: cords that cannot route from it, cords it hides that cannot reroute, its lift, the anchor's studs it covers,
// the plan it shares with consumers seated before it, its distance from the anchor's centre
function scoreOf(st, c, cand) {
  const trial = { ...cand.r, z0: heightAt(st, c, cand), h: c.courses * CRS, consumer: c }, scene = [...st.all(), trial];
  const anchorBox = st.pinBox(c, c.anchor);
  const unroutable = c.pins.filter((x) => !cand.seats.some(([b]) => b === x)).filter((x) => !routeFor(st, trial, x, scene)).length;
  const blocks = st.strings.filter((t) => {
    if (!hitBy(t.curve, [massOf(trial, true)], onScreen)) return false;
    st.strings.splice(st.strings.indexOf(t), 1);
    const ok = routeFor(st, t.part, t.b, scene);
    st.strings.push(t);
    return !ok;
  }).length;
  const covered = freeStuds(anchorBox, st.all()).filter((s) => !st.dropTaken.has(`${c.anchor.n}:${s.key}`) && inside(s.x, s.y, cand.r)).length;
  const shared = st.placed.filter((p) => !p.bare).reduce((a, p) => a + sharedArea(cand.r, p), 0) / (STUD * STUD);
  return [unroutable, blocks, cand.up ?? 0, covered, shared, Math.hypot(cand.r.x + cand.r.w / 2 - anchorBox.x - anchorBox.w / 2, cand.r.y + cand.r.d / 2 - anchorBox.y - anchorBox.d / 2)];
}
// a cord the new consumer would hide reroutes over the scene as it stands
function rerouteRound(st, part) {
  for (const t of [...st.strings]) {
    if (t.part === part || !hitBy(t.curve, [massOf(part, true)], onScreen)) continue;
    st.strings.splice(st.strings.indexOf(t), 1);
    const route = routeFor(st, t.part, t.b, st.all());
    if (!route) { st.strings.push(t); continue; }
    t.part.rings.delete(t.fromKey);
    t.box.rings?.delete(t.toKey);
    (route.box.rings ??= new Set()).add(route.e.key);
    t.part.rings.add(route.f.key);
    st.strings.push(stringOf(t.part, t.b, route));
  }
}
// seat one consumer at its best spot, drop it onto its seats, and cord it to each other pin
function seatOne(st, c) {
  const best = candidatesOf(st, c).map((cand) => ({ cand, s: scoreOf(st, c, cand) })).sort((p, q) => p.s.reduce((d, v, k) => d || v - q.s[k], 0))[0].cand;
  const part = { ...best.r, z0: heightAt(st, c, best), h: c.courses * CRS, consumer: c, drops: [], straddle: best.straddle };
  for (const [b, s] of best.seats) {
    st.dropTaken.add(`${b.n}:${s.key}`);
    (st.pinBox(c, b).rings ??= new Set()).add(s.key);
    part.drops.push([s.x, s.y, top(st.pinBox(c, b)), b.n]);
  }
  st.placed.push(part);
  c.seatedOn = best.seats.map(([b]) => b);
  for (const b of c.pins.filter((x) => !c.seatedOn.includes(x))) {
    const route = routeFor(st, part, b, st.all());
    if (!route) { st.unrouted.push({ part, b }); continue; }
    (route.box.rings ??= new Set()).add(route.e.key);
    (part.rings ??= new Set()).add(route.f.key);
    st.strings.push(stringOf(part, b, route));
  }
  rerouteRound(st, part);
}
// every cord drawn passes every mass but above or in front of it, so nothing drawn over it hides it; one that cannot is not drawn
function dropHidden(st) {
  for (const t of [...st.strings]) {
    if (!hitBy(t.curve, st.all().filter((o) => !o.bare || o === t.part).map((o) => massOf(o, true)), onScreen)) continue;
    st.strings.splice(st.strings.indexOf(t), 1);
    st.unrouted.push({ part: t.part, b: t.b });
    if (!st.strings.some((o) => o.part === t.part && o.fromKey === t.fromKey)) t.part.rings.delete(t.fromKey);
    if (!st.strings.some((o) => o.box === t.box && o.toKey === t.toKey)) t.box.rings.delete(t.toKey);
  }
  for (const u of st.unrouted) (u.part.unrouted ??= []).push(u.b);
}
function seatConsumers(family, consumers, { lift = LIFT, levels = true, turn = 0 } = {}) {
  const st = seatingOf(family, { lift, levels });
  const order = orders([...consumers].sort((a, b) => cordsOf(a) - cordsOf(b) || b.courses - a.courses || b.shape[0] * b.shape[1] - a.shape[0] * a.shape[1] || a.k - b.k))[turn];
  if (!order) throw new Error(`sheet 2E: no seating order lets every cord of ${listOf(consumers.map((c) => c.name))} run clear`);
  for (const c of order) (c.pins.length ? seatOne : seatBare)(st, c);
  dropHidden(st);
  return { placed: st.placed, strings: st.strings, unrouted: st.unrouted };
}

// ---- the guards every panel keeps ----
const DRAWN = [];
const ringedAt = (box, x, y) => box?.rings?.has(studsOf(box).find((s) => s.x === x && s.y === y)?.key);
// each consumer at its own mould, every pin a drop, a cord, or a cord scheduled undrawn
function guardConsumers(where, placed, strings) {
  const drawn = placed.map((p) => p.consumer.k);
  if (new Set(drawn).size !== drawn.length) throw new Error(`sheet 2E: ${where}: a consumer is drawn twice`);
  for (const p of placed) {
    const c = p.consumer;
    if (![[c.shape[0], c.shape[1]], [c.shape[1], c.shape[0]]].some(([w, d]) => w === p.ws && d === p.ds) || p.h !== c.courses * CRS)
      throw new Error(`sheet 2E: ${where}: ${c.name} is drawn ${p.ws}×${p.ds} × ${p.h / CRS} but moulds ${shapeName(c.shape)} × ${c.courses}`);
    const coupled = [...p.drops.map((d) => d[3]), ...strings.filter((t) => t.part === p).map((t) => t.b.n), ...(p.unrouted ?? []).map((b) => b.n)].sort((a, b) => a - b);
    if (coupled.join() !== c.pins.map((b) => b.n).join()) throw new Error(`sheet 2E: ${where}: ${c.name} pins ${c.pins.map((b) => b.n)} but couples to ${coupled}`);
  }
}
// every drop and every cord ends on a ringed stud, and no two bricks overlap in plan on one level
function guard(where, family, placed, strings) {
  guardConsumers(where, placed, strings);
  for (const p of placed) for (const [x, y, , n] of p.drops) if (!ringedAt(family.find((o) => o.part?.n === n), x, y)) throw new Error(`sheet 2E: ${where}: ${p.consumer.name} drops onto no ringed stud`);
  for (const t of strings) if (!ringedAt(t.box, t.to[0], t.to[1])) throw new Error(`sheet 2E: ${where}: a cord ends on no ringed stud`);
  const boxes = [...family.filter((o) => !o.ground), ...placed];
  const clash = boxes.some((a, i) => boxes.slice(i + 1).some((b) => overlap(a, b) && a.z0 < top(b) - 0.01 && b.z0 < top(a) - 0.01));
  if (clash) throw new Error(`sheet 2E: ${where}: two bricks overlap in plan on one level`);
}

// ---- drawing a seated scene: family bricks and consumers back to front with their drops, the cords over them, then marks ----
const drop = (ox, oy, x, y, zFrom, zTo) => {
  const [cx, y0] = pt(ox, oy, x, y, zFrom);
  const [cx2, yTo] = pt(ox, oy, x, y, zTo);
  if (Math.abs(cx - cx2) > 0.25) throw new Error('sheet 2E: a drop would lean');
  const y1 = (yTo - SH - RY - 1).toFixed(1);
  return `<line x1="${cx}" y1="${y0}" x2="${cx}" y2="${y1}" class="ska" stroke-dasharray="6 4"/>\n<circle cx="${cx}" cy="${y1}" r="2.2" class="fa"/>`;
};
function drawScene(ox, oy, family, placed, strings) {
  const boxes = [...family, ...placed];
  return [...paintOrder(boxes).map((i) => {
    const b = boxes[i];
    if (b.ground) return kit.block(ox, oy, b.x * K, b.y * K, b.w * K, b.d * K, b.z0 * K, b.h * K, { edge: b.edge ?? 'sk' });
    if (b.plate) return kit.plate(ox, oy, b.ws, b.ds, { x: b.x * K, y: b.y * K, z0: b.z0 * K, edge: b.edge ?? 'sk', dash: b.dash ?? '', covered: (ci, cj) => boxes.some((o) => !o.ground && o !== b && Math.abs(o.z0 - top(b)) < 0.01 && inside(b.x + (ci + 0.5) * STUD, b.y + (cj + 0.5) * STUD, o)) });
    if (b.consumer) {
      const fall = b.drops.map(([x, y, z]) => drop(ox, oy, x, y, b.z0, z + SH / K)).join('\n');
      return `${fall}\n${kit.brick(ox, oy, b.x * K, b.y * K, b.ws, b.ds, b.consumer.courses, { z0: b.z0 * K, edge: b.consumer.atlas ? 'ska' : 'sk', studEdge: b.consumer.atlas ? 'ska' : 'sk', cap: 'fp', ringStuds: b.rings ?? new Set() })}`;
    }
    return kit.brick(ox, oy, b.x * K, b.y * K, b.ws, b.ds, b.part.courses, { z0: b.z0 * K, studEdge: 'sk', ringStuds: b.rings ?? new Set(), hue: b.part.hue });
  }), ...[...new Map(strings.flatMap((t) => [t.curve.from, t.curve.to]).map((P) => [P.join(), P])).values()].map((P) => cords.capSvg(ox, oy, P)),
  ...strings.map((t) => cords.strandSvg(ox, oy, t.curve))].join('\n');
}
// marks: a family brick's number in a circle, a consumer's number and kind letter in an accent tag; each in clear air
// off its own roof, 24 px from every other mark, a leader back to the roof when it lands further off
const BADGE_R = 9.5, TAG_W = 32, TAG_H = 17, MARK_GAP = 24;
const CAP_REACH = (cords.cap.r + 4 * K) * Math.SQRT2 * 0.866 + 2;
// the nearest spot to `home` that passes `ok`, searched outward a unit at a time, then three
function spiral(home, ok) {
  for (let d = 0; d <= 360; d += d < 120 ? 1 : 3)
    for (let k = 0; k < (d ? 24 : 1); k++) {
      const c = [+(home[0] + d * Math.cos((k * Math.PI) / 12)).toFixed(1), +(home[1] - d * Math.sin((k * Math.PI) / 12)).toFixed(1)];
      if (ok(c)) return c;
    }
  return null;
}
// a mark keeps clear of every cord's strands and of its round plates, foot ring and all
const clearOfCords = (ox, oy, strings, poly) => strings.every((t) => t.curve.pts.every((q) => !meets(poly, circlePoly(kit.pt(ox, oy, ...q), 4), 0))
  && [t.curve.from, t.curve.to].every(([x, y, z]) => !meets(poly, circlePoly(kit.pt(ox, oy, x, y, z + cords.cap.h), CAP_REACH), 0)));
function marksOf(ox, oy, family, placed, strings = [], taken = []) {
  const boxes = [...family.filter((o) => !o.ground), ...placed];
  const sil = new Map(boxes.map((b) => [b, silhouette(b, ox, oy)]));
  const ground = family.filter((o) => o.ground).map((g) => silhouette(g, ox, oy));
  const marks = [];
  const order = [...placed].sort((a, b) => top(b) - top(a));
  for (const b of [...order, ...family.filter((o) => o.part)]) {
    const tag = !!b.consumer;
    const roof = pt(ox, oy, b.x, b.y, top(b));
    const home = tag ? [roof[0], roof[1] - 16] : [roof[0] - 6, roof[1] - 14];
    const shape = (c) => (tag ? rectPoly(c[0] - TAG_W / 2, c[1] - TAG_H / 2, TAG_W, TAG_H) : circlePoly(c, BADGE_R + 1));
    const ok = (c) => boxes.every((o) => (!tag && o === b) || !meets(shape(c), sil.get(o), 1))
      && ground.every((g) => !meets(shape(c), g, 1))
      && [...marks.map((m) => m.at), ...taken].every((m) => Math.hypot(m[0] - c[0], m[1] - c[1]) >= MARK_GAP + (tag ? 8 : 0))
      && marks.every((m) => !meets(shape(c), m.shape, 3))
      && clearOfCords(ox, oy, strings, shape(c));
    const at = spiral(home, ok);
    if (!at) throw new Error(`sheet 2E: ${tag ? `consumer ${b.consumer.k}` : `brick ${b.part.n}`} finds no clear spot for its mark`);
    const far = Math.hypot(at[0] - roof[0], at[1] - roof[1]) > 34;
    marks.push({ b, tag, at, shape: shape(at), lead: far ? [at, roof] : null, label: tag ? `${b.consumer.k} ${b.consumer.letter}` : String(b.part.n) });
  }
  return marks;
}
const leaderTo = ([a, b]) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), u = [dx / len, dy / len];
  return `<line x1="${(a[0] + u[0] * 12).toFixed(1)}" y1="${(a[1] + u[1] * 10).toFixed(1)}" x2="${(b[0] - u[0] * 2).toFixed(1)}" y2="${(b[1] - u[1] * 2).toFixed(1)}" class="skf"/>`;
};
const markSvg = (m) => (m.tag
  ? `<rect x="${(m.at[0] - TAG_W / 2).toFixed(1)}" y="${(m.at[1] - TAG_H / 2).toFixed(1)}" width="${TAG_W}" height="${TAG_H}" rx="8.5" class="${m.b.consumer.atlas ? 'ska fp' : 'ska fp'}"${m.b.consumer.atlas ? ' stroke-width="2"' : ''}/>${txt(m.at[0].toFixed(1), (m.at[1] + 3.8).toFixed(1), m.label, 'lbla', 'middle')}`
  : `<circle cx="${m.at[0]}" cy="${m.at[1]}" r="${BADGE_R}" class="sk fp"/>${txt(m.at[0], (m.at[1] + 3.6).toFixed(1), m.label, 'lbl', 'middle')}`);
const extentOf = (ox, oy, family, placed, marks) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const see = ([x, y], r = 0) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
  for (const b of [...family, ...placed]) for (const p of silhouette(b, ox, oy)) see(p);
  for (const m of marks) for (const p of m.shape) see(p);
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
};

// ---- the box: the consumers legend, one row per consumer ----
const MU = brickKit({ U: 9, p: P });
const miniBrick = (c) => {
  const [ws, ds] = c.shape, w = ws * MU.U, d = ds * MU.U, h = c.courses * MU.CRS;
  const corners = [[0, 0], [w, 0], [0, d], [w, d]].flatMap(([x, y]) => [MU.pt(0, 0, x, y, 0), MU.pt(0, 0, x, y, h + MU.SH * 2)]);
  const mx = Math.min(...corners.map(([x]) => x)), my = Math.min(...corners.map(([, y]) => y));
  return { w: Math.max(...corners.map(([x]) => x)) - mx, h: Math.max(...corners.map(([, y]) => y)) - my,
    at: (x, y) => MU.brick(x - mx, y - my, 0, 0, ws, ds, c.courses, { edge: c.atlas ? 'ska' : 'sk', studEdge: c.atlas ? 'ska' : 'sk' }) };
};
const LEFT = 20, TOP = 58, LEGEND_W = 360;
const tagAt = (x, y, c) => `<rect x="${x - TAG_W / 2}" y="${y - TAG_H / 2}" width="${TAG_W}" height="${TAG_H}" rx="8.5" class="ska fp"${c.atlas ? ' stroke-width="2"' : ''}/>${txt(x, y + 3.8, `${c.k} ${c.letter}`, 'lbla', 'middle')}`;
function legendBox(x, y, width) {
  const out = [];
  let cy = y + 46, group = null;
  for (const c of CONSUMERS) {
    const g = buildName(c);
    if (g !== group) {
      group = g;
      out.push(`${txt(x + 14, cy + 10, c.atlas ? `${g} — ON ITS OWN BRANCH` : g, c.atlas ? 'lbla' : 'lbls')}`);
      cy += 22;
    }
    const fig = miniBrick(c), rh = Math.max(fig.h + 8, 44), mid = cy + rh / 2;
    out.push(`<g id="${P}-consumer-${c.k}" data-consumer="${c.k}" data-name="${c.name}">
${tagAt(x + 30, mid, c)}
${fig.at(x + 58 + (40 - fig.w) / 2, mid - fig.h / 2)}
${txt(x + 112, mid - 9, c.name, 'lbl')}
${txt(x + 112, mid + 4, `${c.kindWord} · ${shapeName(c.shape)} · ${plural(c.courses, 'course')}`, 'lblf')}
${txt(x + 112, mid + 16, `${pinsWord(c)}${c.anchor ? ` · on ${c.anchor.n}` : ''}`, 'lblf')}
</g>`);
    cy += rh;
  }
  const h = cy - y + 10;
  return { svg: `<rect x="${x}" y="${y}" width="${width}" height="${h}" class="skf fnone"/>
${txt(x + 14, y + 22, `THE CONSUMERS — ${WORD[CONSUMERS.length].toUpperCase()} BRICKS AT SHEET 2’S MOULD`, 'lbls')}
${out.join('\n')}`, bottom: y + h };
}

// sheet 2C's runtime plates are not drawn here, so the gaps they leave between its parts close to one stud along each axis;
// a part standing on another moves with the part under it
function closeGaps(family, parts, ax, len) {
  const rootOf = (b) => (b.on === null ? b : rootOf(parts.find((x) => x.n === b.on)));
  const spans = family.map((o) => [o[ax], o[ax] + o[len]]).sort((a, b) => a[0] - b[0]);
  const merged = spans.reduce((m, [a, b]) => (m.length && a <= m.at(-1)[1] ? [...m.slice(0, -1), [m.at(-1)[0], Math.max(m.at(-1)[1], b)]] : [...m, [a, b]]), []);
  const shiftAt = (v) => merged.slice(1).reduce((sum, [a], i) => (v >= a ? sum + Math.max(0, a - merged[i][1] - STUD) : sum), 0);
  const delta = new Map(parts.filter((b) => b.on === null).map((b) => [b.n, shiftAt(family.find((o) => o.id === b.n)[ax])]));
  for (const o of family) o[ax] -= delta.get(rootOf(parts.find((b) => b.n === o.id)).n);
}

// ---- the booklet: one panel per sheet 2C build, its family parts on a ground slab and its consumers on them ----
// a panel seats its consumers in the first order whose cords all run clear
function panelOf(model) {
  let best = null;
  for (let turn = 0; turn < 24; turn++) {
    let pn;
    try {
      pn = panelAt(model, turn);
    } catch (e) {
      if (/no seating order/.test(e.message)) break;
      throw e;
    }
    if (!best || pn.unrouted.length < best.unrouted.length) best = { pn, turn, unrouted: pn.unrouted };
    if (!pn.unrouted.length) break;
  }
  // the first order with fewest unrouted cords, seated afresh
  const pn = panelAt(model, best.turn);
  DRAWN.push(...pn.placed.map((p) => p.consumer.k));
  return pn;
}
function panelAt(model, turn) {
  const parts = model ? model.bricks : [];
  const zOf = (b) => (b.on === null ? GROUND_H : zOf(parts.find((x) => x.n === b.on)) + parts.find((x) => x.n === b.on).h);
  const family = parts.map((b) => ({ x: b.x, y: b.y, w: b.ws * STUD, d: b.ds * STUD, ws: b.ws, ds: b.ds, z0: zOf(b), h: b.courses * CRS, part: FB(b.n), id: b.n }));
  closeGaps(family, parts, 'x', 'w');
  closeGaps(family, parts, 'y', 'd');
  if (family.length) {
    const x0 = Math.min(...family.map((o) => o.x)), y0 = Math.min(...family.map((o) => o.y));
    const x1 = Math.max(...family.map((o) => o.x + o.w)), y1 = Math.max(...family.map((o) => o.y + o.d));
    family.unshift({ x: x0 - STUD, y: y0 - STUD, w: x1 - x0 + 2 * STUD, d: y1 - y0 + 2 * STUD, z0: 0, h: GROUND_H, ground: true, edge: model.atlas ? 'ska' : 'sk' });
  } else family.push({ x: 0, y: 0, w: (Math.max(...BARE.map((c) => c.shape[0])) + 2) * STUD, d: (Math.max(...BARE.map((c) => c.shape[1])) + 2) * STUD, z0: 0, h: GROUND_H, ground: true });
  const consumers = CONSUMERS.filter((c) => c.model === model);
  for (const c of consumers) delete c.seatedOn;
  const { placed, strings, unrouted } = seatConsumers(family, consumers, { turn });
  guard(model ? `build ${model.numeral}` : 'no build', family, placed, strings);
  return { model, family, placed, strings, consumers, unrouted };
}

// ---- the schedule: one row per consumer ----
// a consumer's cords as the schedule gives them: those drawn, and any pin no cord reaches clear of the masses
const cordsLine = (c) => {
  const drawn = CORDS.filter((t) => t.part.consumer === c).map((t) => t.b.n).sort((a, b) => a - b);
  const not = UNROUTED.filter((u) => u.part.consumer === c).map((u) => u.b.n).sort((a, b) => a - b);
  return `${drawn.length ? ` · cords to ${listOf(drawn.map(String))}` : ''}${not.length ? ` · no clear cord to ${listOf(not.map(String))}, so none drawn` : ''}`;
};
const wrapWords = (s, chars) => s.split(' ').reduce((ls, w) => (ls.length && (ls.at(-1) + ' ' + w).length <= chars ? [...ls.slice(0, -1), `${ls.at(-1)} ${w}`] : [...ls, ls.length ? `        ${w}` : w]), []);
const schedRaw = () => CONSUMERS.map((c) => `${String(c.k).padStart(2)} ${c.letter}  ${c.name} (${c.kindWord}) — ${c.dir}/{${c.dirs.join(',')}} · ${plural(c.files, 'file')} · ${fmt(c.sloc)} sloc → ${plural(c.studs, 'stud')} · ${shapeName(c.shape)} × ${plural(c.courses, 'course')} · ${c.pins.length ? `pins ${listOf(c.pins.map((b) => `${b.n} ${b.name}`))}` : 'pins no family part'}${cordsLine(c)} · ${c.model ? `build ${c.model.numeral} ${c.model.name.toUpperCase()}` : 'no build'}`);

// ---- the findings, derived ----
const CARRY = FAMILY.map((b) => ({ b, by: CONSUMERS.filter((c) => c.pins.includes(b)) })).sort((x, y) => y.by.length - x.by.length || x.b.n - y.b.n);
const HUB = CARRY[0];
const HEAVIEST = [...CONSUMERS].sort((a, b) => b.sloc - a.sloc)[0];
const TALLEST = [...CONSUMERS].sort((a, b) => b.courses - a.courses)[0];
const UNPINNED = CARRY.filter((x) => !x.by.length).map((x) => x.b);
const CAB = CONS.totals, ALL = CONS.withAtlas.totals;
const ON_ANCHOR = (b) => CONSUMERS.filter((c) => c.anchor === b);
// the notes name lit-ui-router the hub, and every consumer that pins it hovers over it
if (HUB.b.name !== 'lit-ui-router' || ON_ANCHOR(HUB.b).length !== HUB.by.length || HUB.by.length * 2 <= CONSUMERS.length) throw new Error(`sheet 2E: the notes call lit-ui-router the hub its ${HUB.by.length} consumers hover over, but the plate says otherwise`);
const OFF_HUB = BUILD_MODELS.filter((m) => !CONSUMERS.some((c) => c.model === m && c.anchor === HUB.b));
if (HEAVIEST !== ATLAS_C) throw new Error(`sheet 2E: the notes call the atlas app the heaviest consumer, but ${HEAVIEST.name} is`);
const kindCount = (cs) => listOf(KIND_RANK.map((k) => [k, cs.filter((c) => c.kind === k).length]).filter(([, n]) => n).map(([k, n]) => `${WORD[n]} ${KIND[k][1]}${n > 1 ? 's' : ''} (${KIND[k][0]})`));

// ---- compose the booklet ----
const SCALE_LINE = `SCALE — sheet 2’s mould for every brick: 1 stud per ${SLOC_PER_STUD} sloc rounded up to the next standard shape, a course per ${FILES_PER_COURSE} authored files · a consumer hovers over the heaviest part it pins, on a level of its own`;
const ACCENT_LINE = 'accent marks a consumer’s pin: a drop onto the part it hovers over, a cord to each other part it pins, the ringed stud at each end · consumers are drawn plain, the atlas app edged in accent';
const ALL_MARKS = [];
let ART = '', VW = 1480, ART_BOTTOM = 0, ARIA_BODY = '', CORDS = [], UNROUTED = [];
{
  const panels = [...BUILD_MODELS.map(panelOf), ...(BARE.length ? [panelOf(null)] : [])];
  CORDS = panels.flatMap((pn) => pn.strings);
  UNROUTED = panels.flatMap((pn) => pn.unrouted);
  const PAD = 14, MARGIN = 10, LINE = 12, GUT = 18;
  const heads = (pn) => {
    const m = pn.model, cs = pn.consumers;
    if (!m) return [['NO BUILD', 'lblt'], [`${plural(cs.length, 'consumer')} · ${kindCount(cs)}`, 'lblf'], ['pins no family part: on the ground', 'lblf']];
    const anchors = [...new Set(cs.map((c) => c.anchor.n))];
    return [[`BUILD ${m.numeral} · ${m.name.toUpperCase()}`, m.atlas ? 'lbla' : 'lblt'], [`${plural(cs.length, 'consumer')} · ${kindCount(cs)}`, 'lblf'],
      [`${m.atlas ? `${m.words} · ` : ''}seated on brick ${listOf(anchors)}`, 'lblf']];
  };
  const HEAD_H = PAD + 13 + 2 * LINE + 14;
  const local = panels.map((pn) => extentOf(0, 0, pn.family, pn.placed, marksOf(0, 0, pn.family, pn.placed, pn.strings)));
  const PW = Math.ceil(Math.max(250, ...local.map((e, i) => (panels[i].model?.atlas ? 0 : e.w + 2 * (PAD + MARGIN)))));
  const spanOf = (i) => Math.max(1, Math.ceil((local[i].w + 2 * (PAD + MARGIN) + GUT) / (PW + GUT)));
  const COLS = 4;
  let c0 = 0, r0 = 0;
  const cells = panels.map((_, i) => {
    if (c0 + spanOf(i) > COLS) { c0 = 0; r0++; }
    const cell = [c0, r0];
    c0 += spanOf(i);
    return cell;
  });
  const rows = r0 + 1;
  const needH = (i) => HEAD_H + local[i].h + PAD + MARGIN;
  const ROW_H = Array.from({ length: rows }, (_, r) => Math.ceil(Math.max(...panels.map((_, i) => (cells[i][1] === r ? needH(i) : 0)))));
  const ROW_Y = ROW_H.map((_, r) => ROW_H.slice(0, r).reduce((a, h) => a + h + GUT, 0));
  const GX = LEFT + LEGEND_W + 30, GY = TOP;
  VW = Math.ceil(Math.max(1480, GX + COLS * PW + (COLS - 1) * GUT + LEFT));
  const box = legendBox(LEFT, TOP, LEGEND_W);
  const taken = [];
  const svgs = panels.map((pn, i) => {
    const w = spanOf(i) * PW + (spanOf(i) - 1) * GUT, h = ROW_H[cells[i][1]];
    const x = GX + cells[i][0] * (PW + GUT), y = GY + ROW_Y[cells[i][1]];
    const room = h - HEAD_H - PAD - MARGIN, e = local[i];
    const ox = +(x + (w - e.w) / 2 - e.x0).toFixed(1), oy = +(y + HEAD_H + (room - e.h) / 2 - e.y0).toFixed(1);
    const marks = marksOf(ox, oy, pn.family, pn.placed, pn.strings);
    const at = extentOf(ox, oy, pn.family, pn.placed, marks);
    if (at.x0 < x + MARGIN - 0.5 || at.x1 > x + w - MARGIN + 0.5 || at.y0 < y + HEAD_H - 0.5 || at.y1 > y + h - MARGIN + 0.5) throw new Error(`sheet 2E: panel ${i + 1}'s model runs out of its frame`);
    for (const m of marks) taken.push(m.at);
    ALL_MARKS.push(...marks);
    const atlas = pn.model?.atlas;
    return `<g id="${P}-build-${pn.model?.numeral ?? 'none'}" data-build="${pn.model?.numeral ?? ''}">
<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${atlas ? 'ska' : 'skf'} fnone"${atlas ? ' stroke-dasharray="5 4" opacity="0.7"' : ''}/>
${heads(pn).map(([s, cls], k) => txt(x + PAD, y + PAD + 13 + k * LINE + (k ? 3 : 0), s, cls)).join('\n')}
${drawScene(ox, oy, pn.family, pn.placed, pn.strings)}
${marks.filter((m) => m.lead).map((m) => leaderTo(m.lead)).join('\n')}
${marks.map(markSvg).join('\n')}
</g>`;
  });
  ART = `${box.svg}\n${svgs.join('\n')}`;
  ART_BOTTOM = Math.max(box.bottom, GY + ROW_Y.at(-1) + ROW_H.at(-1));
  ARIA_BODY = `An instruction booklet of ${WORD[panels.length]} panels: each of sheet 2C's ${WORD[BUILD_MODELS.length]} builds, its family bricks in their hues on a slab of ground, with that build's consumers as plain bricks hovering above, each dropping a dashed accent line onto a ringed stud of the part it pins and reaching each other part it pins by a cord where one runs clear, a 1×1 round plate seated on a ringed stud at either end, and a last panel for the consumer that pins no family part.`;
}
// every consumer is drawn, once
if (DRAWN.length !== CONSUMERS.length || new Set(DRAWN).size !== CONSUMERS.length) throw new Error(`sheet 2E: ${DRAWN.length} consumer bricks drawn for ${CONSUMERS.length} consumers`);
// every mark keeps its gap from every other on the sheet
for (let i = 0; i < ALL_MARKS.length; i++) for (let j = i + 1; j < ALL_MARKS.length; j++)
  if (Math.hypot(ALL_MARKS[i].at[0] - ALL_MARKS[j].at[0], ALL_MARKS[i].at[1] - ALL_MARKS[j].at[1]) < MARK_GAP) throw new Error(`sheet 2E: two marks within ${MARK_GAP}px at ${ALL_MARKS[i].at} and ${ALL_MARKS[j].at}`);

const SCHED_ROWS = schedRaw().flatMap((r) => wrapWords(r, Math.floor((VW - 2 * LEFT - 36) / 5.6)));
const SY = ART_BOTTOM + 40;
const schedule = `<rect x="${LEFT}" y="${SY}" width="${VW - 2 * LEFT}" height="${80 + SCHED_ROWS.length * 16}" class="sk fp"/>
${txt(LEFT + 18, SY + 22, `CONSUMER SCHEDULE — one row per consumer, numbered by sheet 2C’s build order, the atlas app last · authored files and sloc by the city ruler, specs aside · S sample app · D docs site · E example · A atlas app`, 'lbls')}
<line x1="${LEFT}" y1="${SY + 32}" x2="${VW - LEFT}" y2="${SY + 32}" class="skf"/>
${SCHED_ROWS.map((r, i) => txt(LEFT + 18, SY + 52 + i * 16, r, 'lbls')).join('\n')}
${txt(LEFT + 18, SY + 60 + SCHED_ROWS.length * 16, `TOTAL — ${plural(CAB.consumers, 'consumer')} · ${plural(CAB.files, 'authored file')} · ${fmt(CAB.sloc)} sloc · ${plural(CAB.studs, 'stud')} · ${fmt(ALL.consumers)} · ${fmt(ALL.files)} · ${fmt(ALL.sloc)} · ${fmt(ALL.studs)} with the atlas app · ${COUNTED}`, 'lbls')}`;
const VH = SY + 90 + SCHED_ROWS.length * 16;

// a part that takes two cords on one round plate
const SHARED_CAPS = [...new Map(CORDS.filter((t, i) => CORDS.findIndex((o) => o.box === t.box && o.toKey === t.toKey) !== i).map((t) => [t.b.n, t.b])).values()];
export const SHEET2E_CORDS = { drawn: CORDS.length, unrouted: UNROUTED.map((u) => `${u.part.consumer.name} → brick ${u.b.n}`) };
export const SHEET2E_SCALE = `${WORD[CONSUMERS.length].toUpperCase()} CONSUMERS`;
export const SHEET2E_VERDICT = `the consumers as bricks: ${WORD[CONSUMERS.length]} consumers, ${WORD[CAB.consumers]} in the cabinet’s tree and the atlas app on its own branch; ${WORD[HUB.by.length]} pin brick ${HUB.b.n}, ${HUB.b.name}, and ${listOf(BARE.map((c) => c.name))} pins none; the atlas app is the heaviest at ${plural(HEAVIEST.studs, 'stud')}, ${TALLEST.name} the tallest at ${plural(TALLEST.courses, 'course')}`;
const ARIA = `An exploded isometric LEGO drawing of the repository's consumers as bricks. ${ARIA_BODY} A box at the left lists the ${WORD[CONSUMERS.length]} consumers by number and kind letter, and a schedule below gives each one's files, sloc, pins and build.`;

const svg = `<svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${ARIA}">
${defs(P)}
${txt(VW - 30, 16, SCALE_LINE, 'lbls', 'end')}
${txt(VW - 30, 30, ACCENT_LINE, 'lblf', 'end')}
${ART}
${schedule}
</svg>`;

export const sheet2e = {
  num: '2E', id: 'companions-consumers', rev: 'A',
  title: 'THE CONSUMER BUILDS',
  sub: `ALTITUDE 2 — SIBLING PLATE, THE CONSUMERS: the ${WORD[CAB.consumers]} consumers in the cabinet’s tree and the atlas’s own app as bricks at sheet 2’s mould, each seated on the family parts it pins · rows read census-consumers.json, both readings, @ ${CONS.sha}`,
  scale: SHEET2E_SCALE,
  form: 'BUILD INSTRUCTIONS',
  svg,
  caption: `The repository's own consumers drawn as bricks on the family they pin. ${Cap(WORD[HUB.by.length])} of ${WORD[CONSUMERS.length]} pin ${HUB.b.name}, brick ${HUB.b.n}; ${listOf(BARE.map((c) => c.name))} pins no family part; the atlas app, on its own branch, is the heaviest at ${plural(HEAVIEST.studs, 'stud')}.`,
  notes: `
<p><strong>Up from the family.</strong> Sheet 2 seats the family on <code>@uirouter/core</code>; sheet 2C goes down to the runtimes the family peers. This plate goes up: the sample apps, the docs site, the embedded examples and the atlas's own app, each massed at sheet 2's mould from its authored source — the city ruler's files under its <code>src/</code> (the docs site's <code>.vitepress/</code>, <code>worker/</code> and <code>src/</code>), specs aside — and seated on the parts its manifest pins.</p>
<p><strong>One hub.</strong> ${Cap(WORD[HUB.by.length])} of the ${WORD[CONSUMERS.length]} consumers pin ${npmLink(HUB.b.name)}, and every one of them hovers over it, since it is the heaviest part each pins: the builds split the ${WORD[HUB.by.length]} into their panels, and every build but ${listOf(OFF_HUB.map((m) => m.name.toUpperCase()))} stands its consumers on brick ${HUB.b.n}. Of the other parts, ${listOf(CARRY.filter((x) => x.by.length && x !== HUB).map((x) => `${x.b.name} is pinned by ${WORD[x.by.length]}`))}${UNPINNED.length ? `, and ${listOf(UNPINNED.map((b) => b.name))} by none` : ''}.</p>
<p><strong>Cords.</strong> A consumer seats on the heaviest part it pins and reaches each other part by a string with end studs, a 1×1 round plate seated on a ringed stud at either end and a cord between. The sheet draws ${plural(CORDS.length, 'cord')}${UNROUTED.length ? `; ${WORD[UNROUTED.length]} ${UNROUTED.length === 1 ? 'pin finds' : 'pins find'} no cord that passes every mass above or in front of it — ${listOf(UNROUTED.map((u) => `${u.part.consumer.name} to brick ${u.b.n}`))} — and the schedule lists ${UNROUTED.length === 1 ? 'it' : 'them'} undrawn` : ''}.${SHARED_CAPS.length ? ` ${Cap(listOf(SHARED_CAPS.map((x) => `brick ${x.n}`)))} ${SHARED_CAPS.length === 1 ? 'has' : 'have'} fewer free studs than cords to take, so two cords share one round plate there.` : ''}</p>
<p><strong>The examples are thin.</strong> An embedded example is a file or two under <code>examples/&lt;key&gt;/src/</code>, so most mould a single course; ${TALLEST.name}, at ${plural(TALLEST.files, 'file')}, stands ${plural(TALLEST.courses, 'course')} tall.</p>`,
  key: [
    keyRow('<polygon points="4,12 16,5 30,12 30,16 16,9 4,16" class="sk fp"/><ellipse cx="10" cy="8" rx="4" ry="2.3" class="sk fp2"/><ellipse cx="24" cy="8" rx="4" ry="2.3" class="sk fp2"/>', `a consumer brick, drawn plain — 1 stud per ${SLOC_PER_STUD} sloc, a course per ${FILES_PER_COURSE} authored files`),
    keyRow('<polygon points="4,12 16,5 30,12 30,16 16,9 4,16" class="ska fp"/>', 'the atlas app’s brick, edged in accent — on its own branch'),
    keyRow(`<rect x="8" y="1" width="32" height="17" rx="8.5" class="ska fp"/><text x="24" y="13" class="lbla" text-anchor="middle">7 E</text>`, 'a consumer’s tag — its number and kind: S sample app, D docs site, E example, A atlas app'),
    keyRow('<circle cx="24" cy="9" r="8" class="sk fp"/><text x="24" y="12.5" class="lbl" text-anchor="middle">1</text>', 'a family brick in its sheet 2 hue, numbered as on sheet 2'),
    keyRow('<ellipse cx="24" cy="9" rx="6" ry="3.5" class="ska fp"/><ellipse cx="24" cy="9" rx="11" ry="6.5" class="ska fnone"/>', 'a ringed stud — a consumer’s pin: under its drop, or under a cord’s round plate at either end'),
    keyRow('<line x1="24" y1="2" x2="24" y2="16" class="ska" stroke-dasharray="6 4"/><circle cx="24" cy="16" r="2.2" class="fa"/>', 'drop — the consumer hovers over the heaviest part it pins'),
    keyRow('<ellipse cx="9" cy="9" rx="7" ry="3.8" class="ska fnone"/><path d="M3,6 L3,9 A6,3.4 0 0 0 15,9 L15,6 Z" class="sk fp2"/><ellipse cx="9" cy="6" rx="6" ry="3.4" class="sk fp"/><path d="M6.2,4 L6.2,5.5 A2.8,1.6 0 0 0 11.8,5.5 L11.8,4 Z" class="sk fp2"/><ellipse cx="9" cy="4" rx="2.8" ry="1.6" class="sk fp2"/><ellipse cx="39" cy="12.5" rx="7" ry="3.8" class="ska fnone"/><path d="M33,9.5 L33,12.5 A6,3.4 0 0 0 45,12.5 L45,9.5 Z" class="sk fp2"/><ellipse cx="39" cy="9.5" rx="6" ry="3.4" class="sk fp"/><path d="M36.2,7.5 L36.2,9 A2.8,1.6 0 0 0 41.8,9 L41.8,7.5 Z" class="sk fp2"/><ellipse cx="39" cy="7.5" rx="2.8" ry="1.6" class="sk fp2"/><path d="M9,3.4 Q26,3.4 39,6.9 M9,4.8 Q26,4.8 39,8.3 M14,3.5 L15,5 M19,3.8 L20,5.3 M24,4.2 L25,5.7 M29,4.8 L30,6.3 M34,5.8 L35,7.3" class="sk fnone" style="stroke-width:0.7"/>', 'a string with end studs — two 1×1 round plates joined by a cord, a coupling a footprint cannot make, drawn to fit and not massed: one plate seated on a ringed stud of the consumer’s top, the other on a ringed stud of each other part it pins, the cord leaving each one’s own stud'),
    keyRow('<polygon points="4,8 16,2 44,9 44,15 16,8 4,14" class="sk fp"/>', 'ground — not massed'),
  ].join('\n'),
};
function npmLink(name) {
  byName(name);
  return `<a href="${npmUrl(name)}"><code>${name}</code></a>`;
}

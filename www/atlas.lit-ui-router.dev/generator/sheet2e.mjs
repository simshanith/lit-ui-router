import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, keyRow, npmUrl } from './helpers.mjs';
import { brickKit, paintOrder } from './brick-iso.mjs';
import { BRICK_MODEL, BRICK_ROWS, COURSES, FILES_PER_COURSE, SHAPE, SLOC_PER_STUD, STUDS } from './sheet2.mjs';
import { BUILD_MODELS } from './sheet2c.mjs';
import { seatedBoxes } from './brick-glb.mjs';

const P = 's2e';
// a sketch in two cuts: a one assembly on sheet 2's model, b the booklet on sheet 2C's builds
const CUT = process.env.ATLAS_2E_CUT || 'b';
if (!['a', 'b'].includes(CUT)) throw new Error(`sheet 2E: ATLAS_2E_CUT is ${CUT}; one of a, b`);

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

// ---- the drawing kit: geometry in sheet 2's plan units, 40 a stud and 24 a course, drawn at a cut's pitch ----
const U = CUT === 'a' ? 26 : 18;
const K = U / 40;
const kit = brickKit({ U, p: P });
const { SH, RX, RY } = kit;
const STUD = 40, CRS = 24;
const pt = (ox, oy, x, y, z) => kit.pt(ox, oy, x * K, y * K, z * K);
const GROUND_H = CRS;
const LIFT = 3 * CRS, GAP = CRS;
const RING = { edge: 'ska', cap: 'fp', ring: 'ska' };
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
// pin and ties to a ringed stud on each other pin. It hovers at the lowest height clear of everything under its plan, and its
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
function seatConsumers(family, consumers, { lift = LIFT, levels = true } = {}) {
  const placed = [], dropTaken = new Set(), ties = [];
  const all = () => [...family, ...placed];
  const hoverOver = (r) => Math.max(...all().filter((o) => !o.ground && overlap(o, r)).map((o) => top(o) + (o.consumer ? GAP : lift)), 0);
  const order = [...consumers].sort((a, b) => b.shape[0] * b.shape[1] - a.shape[0] * a.shape[1] || b.courses - a.courses || a.k - b.k);
  for (const c of order) {
    const h = c.courses * CRS;
    if (!c.pins.length) {
      // a consumer that pins nothing stands on the ground beside the parts
      const g = family.find((o) => o.ground);
      const r = { x: g.x + STUD, y: g.y + STUD, w: c.shape[0] * STUD, d: c.shape[1] * STUD, ws: c.shape[0], ds: c.shape[1] };
      if (r.x + r.w > g.x + g.w || r.y + r.d > g.y + g.d) throw new Error(`sheet 2E: ${c.name} is wider than its ground`);
      placed.push({ ...r, z0: top(g), h, consumer: c, drops: [], bare: true });
      continue;
    }
    const pinBox = (b) => family.find((o) => o.part === b) ?? (() => { throw new Error(`sheet 2E: ${c.name} pins brick ${b.n}, which this model does not draw`); })();
    const free = (b) => freeStuds(pinBox(b), all()).filter((s) => !dropTaken.has(`${b.n}:${s.key}`) && !placed.some((p) => inside(s.x, s.y, p)));
    // a straddle: two pins at one height, a footprint over a free stud of each
    const coplanar = c.pins.flatMap((a, i) => c.pins.slice(i + 1).map((b) => [a, b])).filter(([a, b]) => Math.abs(top(pinBox(a)) - top(pinBox(b))) < 0.01);
    const candidates = [];
    for (const [a, b] of coplanar)
      for (const sa of free(a)) for (const sb of free(b))
        for (const r of placements([sa, sb], c.shape[0], c.shape[1])) candidates.push({ r, seats: [[a, sa], [b, sb]], straddle: true });
    if (!candidates.length)
      for (const s of free(c.anchor)) for (const r of placements([s], c.shape[0], c.shape[1])) candidates.push({ r, seats: [[c.anchor, s]], straddle: false });
    if (!candidates.length) throw new Error(`sheet 2E: ${c.name} finds no free stud on brick ${c.anchor.n} that no consumer covers`);
    const anchorBox = pinBox(c.anchor);
    const remaining = (r) => freeStuds(anchorBox, all()).filter((s) => !dropTaken.has(`${c.anchor.n}:${s.key}`) && inside(s.x, s.y, r)).length;
    const cx = anchorBox.x + anchorBox.w / 2, cy = anchorBox.y + anchorBox.d / 2;
    const shared = (r) => placed.filter((p) => !p.bare).reduce((a, p) => a + Math.max(0, Math.min(r.x + r.w, p.x + p.w) - Math.max(r.x, p.x)) * Math.max(0, Math.min(r.y + r.d, p.y + p.d) - Math.max(r.y, p.y)), 0) / (STUD * STUD);
    const score = ({ r }) => [remaining(r), shared(r), Math.hypot(r.x + r.w / 2 - cx, r.y + r.d / 2 - cy)];
    const best = candidates.map((cand) => ({ cand, s: score(cand) })).sort((p, q) => p.s[0] - q.s[0] || p.s[1] - q.s[1] || p.s[2] - q.s[2])[0].cand;
    // each consumer on a level of its own, a course above the one seated before it
    const below = placed.filter((p) => !p.bare);
    const z0 = Math.max(hoverOver(best.r), ...best.seats.map(([b]) => top(pinBox(b)) + lift), ...(levels ? below.map((p) => top(p) + GAP) : []));
    const part = { ...best.r, z0, h, consumer: c, drops: [], straddle: best.straddle };
    for (const [b, s] of best.seats) {
      dropTaken.add(`${b.n}:${s.key}`);
      (pinBox(b).rings ??= new Set()).add(s.key);
      part.drops.push([s.x, s.y, top(pinBox(b)), b.n]);
    }
    placed.push(part);
    c.seatedOn = best.seats.map(([b]) => b);
  }
  // each other pin is a tie, from the corner of the consumer's underside nearest a free stud of that pin
  for (const part of placed) {
    const c = part.consumer;
    for (const b of c.pins.filter((x) => !(c.seatedOn ?? []).includes(x))) {
      const box = family.find((o) => o.part === b);
      const near = (s) => Math.hypot(s.x - (part.x + part.w / 2), s.y - (part.y + part.d / 2));
      const studs = freeStuds(box, all()).filter((s) => !dropTaken.has(`${b.n}:${s.key}`)).sort((p, q) => near(p) - near(q));
      if (!studs.length) throw new Error(`sheet 2E: brick ${b.n} has no free stud for ${c.name}'s tie`);
      const s = studs[0];
      (box.rings ??= new Set()).add(s.key);
      const corner = [[part.x, part.y], [part.x + part.w, part.y], [part.x, part.y + part.d], [part.x + part.w, part.y + part.d]]
        .sort((p, q) => Math.hypot(p[0] - s.x, p[1] - s.y) - Math.hypot(q[0] - s.x, q[1] - s.y))[0];
      ties.push({ part, box, b, from: [...corner, part.z0], to: [s.x, s.y, top(box)] });
    }
  }
  return { placed, ties };
}

// ---- the guards every cut keeps ----
const DRAWN = [];
function guard(where, family, placed, ties) {
  const drawn = placed.map((p) => p.consumer.k).sort((a, b) => a - b);
  if (new Set(drawn).size !== drawn.length) throw new Error(`sheet 2E: ${where}: a consumer is drawn twice`);
  for (const p of placed) {
    const c = p.consumer;
    if (![[c.shape[0], c.shape[1]], [c.shape[1], c.shape[0]]].some(([w, d]) => w === p.ws && d === p.ds) || p.h !== c.courses * CRS)
      throw new Error(`sheet 2E: ${where}: ${c.name} is drawn ${p.ws}×${p.ds} × ${p.h / CRS} but moulds ${shapeName(c.shape)} × ${c.courses}`);
    const coupled = [...p.drops.map((d) => d[3]), ...ties.filter((t) => t.part === p).map((t) => t.b.n)].sort((a, b) => a - b);
    if (coupled.join() !== c.pins.map((b) => b.n).join()) throw new Error(`sheet 2E: ${where}: ${c.name} pins ${c.pins.map((b) => b.n)} but couples to ${coupled}`);
  }
  for (const p of placed) for (const [x, y, , n] of p.drops) {
    const box = family.find((o) => o.part?.n === n);
    if (!box?.rings?.has(studsOf(box).find((st) => st.x === x && st.y === y)?.key)) throw new Error(`sheet 2E: ${where}: ${p.consumer.name} drops onto no ringed stud`);
  }
  DRAWN.push(...placed.map((p) => p.consumer.k));
  for (const t of ties) if (!t.box.rings?.has(studsOf(t.box).find((s) => s.x === t.to[0] && s.y === t.to[1])?.key)) throw new Error(`sheet 2E: ${where}: a tie ends on no ringed stud`);
  const boxes = [...family.filter((o) => !o.ground), ...placed];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (overlap(a, b) && a.z0 < top(b) - 0.01 && b.z0 < top(a) - 0.01) throw new Error(`sheet 2E: ${where}: two bricks overlap in plan on one level`);
  }
}

// ---- drawing a seated scene: family bricks, consumers, drops, ties, then marks ----
const drop = (ox, oy, x, y, zFrom, zTo) => {
  const [cx, y0] = pt(ox, oy, x, y, zFrom);
  const [cx2, yTo] = pt(ox, oy, x, y, zTo);
  if (Math.abs(cx - cx2) > 0.25) throw new Error('sheet 2E: a drop would lean');
  const y1 = (yTo - SH - RY - 1).toFixed(1);
  return `<line x1="${cx}" y1="${y0}" x2="${cx}" y2="${y1}" class="ska" stroke-dasharray="6 4"/>\n<circle cx="${cx}" cy="${y1}" r="2.2" class="fa"/>`;
};
const tieLine = (ox, oy, t) => {
  const [x1, y1] = pt(ox, oy, ...t.from), [x2, y2] = pt(ox, oy, t.to[0], t.to[1], t.to[2] + SH / K);
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ska" stroke-dasharray="6 4"/>`;
};
function drawScene(ox, oy, family, placed, ties) {
  const boxes = [...family, ...placed];
  return paintOrder(boxes).map((i) => {
    const b = boxes[i];
    if (b.ground) return kit.block(ox, oy, b.x * K, b.y * K, b.w * K, b.d * K, b.z0 * K, b.h * K, { edge: b.edge ?? 'sk' });
    if (b.plate) return kit.plate(ox, oy, b.ws, b.ds, { x: b.x * K, y: b.y * K, z0: b.z0 * K, edge: b.edge ?? 'sk', dash: b.dash ?? '', covered: (ci, cj) => boxes.some((o) => !o.ground && o !== b && Math.abs(o.z0 - top(b)) < 0.01 && inside(b.x + (ci + 0.5) * STUD, b.y + (cj + 0.5) * STUD, o)) });
    if (b.consumer) {
      const fall = b.drops.map(([x, y, z]) => drop(ox, oy, x, y, b.z0, z + SH / K)).join('\n');
      return `${fall}\n${kit.brick(ox, oy, b.x * K, b.y * K, b.ws, b.ds, b.consumer.courses, { z0: b.z0 * K, edge: b.consumer.atlas ? 'ska' : 'sk', studEdge: b.consumer.atlas ? 'ska' : 'sk', cap: 'fp' })}`;
    }
    const tied = ties.filter((t) => t.box === b).map((t) => tieLine(ox, oy, t)).join('\n');
    return `${kit.brick(ox, oy, b.x * K, b.y * K, b.ws, b.ds, b.part.courses, { z0: b.z0 * K, studEdge: 'sk', ringStuds: b.rings ?? new Set(), hue: b.part.hue })}${tied ? `\n${tied}` : ''}`;
  }).join('\n');
}
// marks: a family brick's number in a circle, a consumer's number and kind letter in an accent tag; each in clear air
// off its own roof, 24 px from every other mark, a leader back to the roof when it lands further off
const BADGE_R = 9.5, TAG_W = 32, TAG_H = 17, MARK_GAP = 24;
function marksOf(ox, oy, family, placed, taken = []) {
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
      && marks.every((m) => !meets(shape(c), m.shape, 3));
    let at = null;
    for (let d = 0; d <= 360 && !at; d += d < 120 ? 1 : 3)
      for (let k = 0; k < (d ? 24 : 1) && !at; k++) {
        const c = [+(home[0] + d * Math.cos((k * Math.PI) / 12)).toFixed(1), +(home[1] - d * Math.sin((k * Math.PI) / 12)).toFixed(1)];
        if (ok(c)) at = c;
      }
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

// ---- cut a: one assembly, sheet 2's seated model with the lint plugin and every consumer seated on it ----
function cutA() {
  const seated = seatedBoxes(BRICK_MODEL);
  const family = seated.map((s) => {
    const m = s.m;
    if (m.kind === 'ground') return { x: s.x, y: s.y, w: s.w, d: s.d, z0: s.z0, h: s.h, ground: true, id: m.id };
    if (m.kind === 'plate') return { x: s.x, y: s.y, w: s.w, d: s.d, z0: s.z0, h: s.h, plate: true, ws: m.ws, ds: m.ds, dash: m.dash, edge: m.edge, id: m.id };
    return { x: s.x, y: s.y, w: s.w, d: s.d, ws: m.ws, ds: m.ds, z0: s.z0, h: s.h, part: FB(m.id), id: m.id };
  });
  // the lint plugin, which takes no stud on any router plate, on a ground of its own in front of the browser ground
  const g1 = family.find((o) => o.id === 'G1'), lint = FB(FAMILY.length);
  const [lw, ld] = [lint.shape[1], lint.shape[0]];
  const g3 = { x: g1.x, y: g1.y + g1.d + 2 * STUD, w: (lw + 1) * STUD, d: (ld + 1) * STUD, z0: 0, h: GROUND_H, ground: true, id: 'G3' };
  family.push(g3, { x: g3.x + STUD / 2, y: g3.y + STUD / 2, w: lw * STUD, d: ld * STUD, ws: lw, ds: ld, z0: GROUND_H, h: lint.courses * CRS, part: lint, id: lint.n });
  // a consumer that pins nothing stands on a ground of its own beside the lint plugin's
  const bare = BARE.map((c, i) => {
    const g = { x: g3.x + g3.w + 2 * STUD + i * 4 * STUD, y: g3.y, w: (c.shape[0] + 1) * STUD, d: (c.shape[1] + 1) * STUD, z0: 0, h: GROUND_H, ground: true, id: `G${4 + i}` };
    family.push(g);
    return { x: g.x + STUD / 2, y: g.y + STUD / 2, w: c.shape[0] * STUD, d: c.shape[1] * STUD, ws: c.shape[0], ds: c.shape[1], z0: GROUND_H, h: c.courses * CRS, consumer: c, drops: [], bare: true };
  });
  const { placed, ties } = deckConsumers(family, CONSUMERS.filter((c) => c.pins.length));
  placed.push(...bare);
  guard('cut a', family, placed, ties);
  return { family, placed, ties };
}
// the deck: one level above the whole assembly, every consumer on it in its build's cluster, a row of bricks a stud apart;
// each cluster takes the free spot nearest the studs its consumers pin, and every pin is a tie to a ringed stud
function deckConsumers(family, consumers) {
  const bricks = family.filter((o) => o.part);
  const deckZ = Math.max(...bricks.map(top)) + 12 * CRS;
  const pinBox = (b) => bricks.find((o) => o.part === b);
  const clusters = [];
  for (const c of consumers) {
    const key = c.model?.numeral ?? '';
    const cl = clusters.find((x) => x.key === key) ?? (clusters.push({ key, model: c.model, cs: [] }), clusters.at(-1));
    cl.cs.push(c);
  }
  for (const cl of clusters) {
    let x = 0;
    cl.parts = cl.cs.map((c) => {
      const [ws, ds] = [Math.min(...c.shape), Math.max(...c.shape)];
      const r = { dx: x, ws, ds, w: ws * STUD, d: ds * STUD, c };
      x += r.w + STUD;
      return r;
    });
    cl.w = x - STUD;
    cl.d = Math.max(...cl.parts.map((p) => p.d));
    const pins = cl.cs.flatMap((c) => c.pins.map(pinBox));
    cl.target = [pins.reduce((a, b) => a + b.x + b.w / 2, 0) / pins.length, pins.reduce((a, b) => a + b.y + b.d / 2, 0) / pins.length];
  }
  const taken = [];
  for (const cl of [...clusters].sort((a, b) => b.w * b.d - a.w * a.d || a.key.localeCompare(b.key))) {
    let best = null;
    for (let gx = -16; gx <= 20; gx++) for (let gy = -16; gy <= 20; gy++) {
      const r = { x: gx * STUD, y: gy * STUD, w: cl.w, d: cl.d };
      if (taken.some((t) => overlap({ x: t.x - 3 * STUD, y: t.y - 3 * STUD, w: t.w + 6 * STUD, d: t.d + 6 * STUD }, r))) continue;
      const dist = Math.hypot(r.x + r.w / 2 - cl.target[0], r.y + r.d / 2 - cl.target[1]);
      if (!best || dist < best.dist) best = { r, dist };
    }
    Object.assign(cl, best.r);
    taken.push(best.r);
  }
  const placed = clusters.flatMap((cl) => cl.parts.map((p) => ({ x: cl.x + p.dx, y: cl.y, w: p.w, d: p.d, ws: p.ws, ds: p.ds, z0: deckZ, h: p.c.courses * CRS, consumer: p.c, drops: [], cluster: cl })));
  const ties = [];
  for (const part of placed) {
    part.consumer.seatedOn = [];
    for (const b of part.consumer.pins) {
      const box = pinBox(b);
      const near = (s) => Math.hypot(s.x - (part.x + part.w / 2), s.y - (part.y + part.d / 2));
      const s = freeStuds(box, [...family, ...placed]).sort((p, q) => near(p) - near(q))[0];
      if (!s) throw new Error(`sheet 2E: brick ${b.n} has no free stud for ${part.consumer.name}'s tie`);
      (box.rings ??= new Set()).add(s.key);
      const corner = [[part.x, part.y], [part.x + part.w, part.y], [part.x, part.y + part.d], [part.x + part.w, part.y + part.d]]
        .sort((p, q) => Math.hypot(p[0] - s.x, p[1] - s.y) - Math.hypot(q[0] - s.x, q[1] - s.y))[0];
      ties.push({ part, box, b, from: [...corner, part.z0], to: [s.x, s.y, top(box)] });
    }
  }
  return { placed, ties, clusters };
}

// ---- cut b: the booklet, one panel per sheet 2C build, its family parts on a ground slab and its consumers on them ----
function panelOf(model) {
  const parts = model ? model.bricks : [];
  const zOf = (b) => (b.on === null ? GROUND_H : zOf(parts.find((x) => x.n === b.on)) + parts.find((x) => x.n === b.on).h);
  const family = parts.map((b) => ({ x: b.x, y: b.y, w: b.ws * STUD, d: b.ds * STUD, ws: b.ws, ds: b.ds, z0: zOf(b), h: b.courses * CRS, part: FB(b.n), id: b.n }));
  if (family.length) {
    const x0 = Math.min(...family.map((o) => o.x)), y0 = Math.min(...family.map((o) => o.y));
    const x1 = Math.max(...family.map((o) => o.x + o.w)), y1 = Math.max(...family.map((o) => o.y + o.d));
    family.unshift({ x: x0 - STUD, y: y0 - STUD, w: x1 - x0 + 2 * STUD, d: y1 - y0 + 2 * STUD, z0: 0, h: GROUND_H, ground: true, edge: model.atlas ? 'ska' : 'sk' });
  } else family.push({ x: 0, y: 0, w: (Math.max(...BARE.map((c) => c.shape[0])) + 2) * STUD, d: (Math.max(...BARE.map((c) => c.shape[1])) + 2) * STUD, z0: 0, h: GROUND_H, ground: true });
  const consumers = CONSUMERS.filter((c) => c.model === model);
  const { placed, ties } = seatConsumers(family, consumers);
  guard(model ? `build ${model.numeral}` : 'no build', family, placed, ties);
  return { model, family, placed, ties, consumers };
}

// ---- the schedule: one row per consumer ----
const wrapWords = (s, chars) => s.split(' ').reduce((ls, w) => (ls.length && (ls.at(-1) + ' ' + w).length <= chars ? [...ls.slice(0, -1), `${ls.at(-1)} ${w}`] : [...ls, ls.length ? `        ${w}` : w]), []);
const SCHED_ROWS_RAW = CONSUMERS.map((c) => `${String(c.k).padStart(2)} ${c.letter}  ${c.name} (${c.kindWord}) — ${c.dir}/{${c.dirs.join(',')}} · ${plural(c.files, 'file')} · ${fmt(c.sloc)} sloc → ${plural(c.studs, 'stud')} · ${shapeName(c.shape)} × ${plural(c.courses, 'course')} · ${c.pins.length ? `pins ${listOf(c.pins.map((b) => `${b.n} ${b.name}`))}` : 'pins no family part'} · ${c.model ? `build ${c.model.numeral} ${c.model.name.toUpperCase()}` : 'no build'}`);

// ---- the findings, derived ----
const CARRY = FAMILY.map((b) => ({ b, by: CONSUMERS.filter((c) => c.pins.includes(b)) })).sort((x, y) => y.by.length - x.by.length || x.b.n - y.b.n);
const HUB = CARRY[0];
const HEAVIEST = [...CONSUMERS].sort((a, b) => b.sloc - a.sloc)[0];
const TALLEST = [...CONSUMERS].sort((a, b) => b.courses - a.courses)[0];
const UNPINNED = CARRY.filter((x) => !x.by.length).map((x) => x.b);
const CAB = CONS.totals, ALL = CONS.withAtlas.totals;
const ON_ANCHOR = (b) => CONSUMERS.filter((c) => c.anchor === b);
if (HEAVIEST !== ATLAS_C) throw new Error(`sheet 2E: the notes call the atlas app the heaviest consumer, but ${HEAVIEST.name} is`);
const kindCount = (cs) => listOf(KIND_RANK.map((k) => [k, cs.filter((c) => c.kind === k).length]).filter(([, n]) => n).map(([k, n]) => `${WORD[n]} ${KIND[k][1]}${n > 1 ? 's' : ''} (${KIND[k][0]})`));

// ---- compose the cut ----
const SCALE_LINE = `SCALE — sheet 2’s mould for every brick: 1 stud per ${SLOC_PER_STUD} sloc rounded up to the next standard shape, a course per ${FILES_PER_COURSE} authored files · ${CUT === 'a' ? 'the consumers hover on one deck above the assembly, in their builds' : 'a consumer hovers over the heaviest part it pins, on a level of its own'}`;
const ACCENT_LINE = CUT === 'a'
  ? 'accent marks a consumer’s pin: a tie from its underside to a ringed stud on each family part it pins · consumers are drawn plain, the atlas app edged in accent'
  : 'accent marks a consumer’s pin: a drop onto the part it hovers over, a tie to each other part it pins, the ringed stud at each end · consumers are drawn plain, the atlas app edged in accent';
let ART = '', VW = 1480, ART_BOTTOM = 0, FORM = '', ARIA_BODY = '', ALL_MARKS = [];
if (CUT === 'a') {
  const { family, placed, ties } = cutA();
  // each cluster's build lettered in clear air off its back corner, clear of every mass and mark
  const clusterLabels = (ox, oy, marks) => {
    const clusters = [...new Set(placed.map((p) => p.cluster).filter(Boolean))];
    const sils = [...family, ...placed].map((b) => silhouette(b, ox, oy));
    const out = [];
    for (const cl of clusters) {
      const s = cl.model.atlas ? `${cl.model.numeral} THE ATLAS — ON ITS OWN BRANCH` : `${cl.model.numeral} ${cl.model.name.toUpperCase()}`;
      const tw = s.length * 6.6, hi = Math.max(...placed.filter((p) => p.cluster === cl).map(top));
      const [hx, hy] = pt(ox, oy, cl.x, cl.y, hi);
      const boxAt = (c) => rectPoly(c[0], c[1] - 10, tw, 13);
      const own = placed.filter((p) => p.cluster === cl).map((b) => silhouette(b, ox, oy));
      const others = placed.filter((p) => p.cluster && p.cluster !== cl).map((b) => silhouette(b, ox, oy));
      const gapTo = (c, list) => Math.min(...list.flatMap((m) => m.map(([px, py]) => Math.hypot(px - c[0] - tw / 2, py - c[1] + 4))));
      const ok = (c) => sils.every((m) => !meets(boxAt(c), m, 3)) && marks.every((m) => !meets(boxAt(c), m.shape, 4)) && out.every((o) => !meets(boxAt(c), o.shape, 6))
        && gapTo(c, own) + 20 < gapTo(c, others);
      let at = null;
      for (let d = 0; d <= 400 && !at; d += 2)
        for (let k = 0; k < (d ? 24 : 1) && !at; k++) {
          const c = [+(hx - tw / 2 + d * Math.cos((k * Math.PI) / 12)).toFixed(1), +(hy - 34 - d * Math.sin((k * Math.PI) / 12)).toFixed(1)];
          if (ok(c)) at = c;
        }
      if (!at) throw new Error(`sheet 2E: build ${cl.model.numeral}'s lettering finds no clear air`);
      out.push({ s, at, shape: boxAt(at), atlas: cl.model.atlas });
    }
    return out;
  };
  const probe = marksOf(0, 0, family, placed);
  const ext = extentOf(0, 0, family, placed, [...probe, ...clusterLabels(0, 0, probe)]);
  const GX = LEFT + LEGEND_W + 40;
  VW = Math.ceil(Math.max(1480, GX + ext.w + 40));
  const ox = +(GX - ext.x0).toFixed(1), oy = +(TOP + 40 - ext.y0).toFixed(1);
  const marks = marksOf(ox, oy, family, placed);
  ALL_MARKS = marks;
  const labels = clusterLabels(ox, oy, marks);
  const box = legendBox(LEFT, TOP, LEGEND_W);
  ART = `${box.svg}
${drawScene(ox, oy, family, placed, ties)}
${labels.map((l) => txt(l.at[0], l.at[1], l.s, l.atlas ? 'lbla' : 'lblb')).join('\n')}
${marks.filter((m) => m.lead).map((m) => leaderTo(m.lead)).join('\n')}
${marks.map(markSvg).join('\n')}`;
  ART_BOTTOM = Math.max(box.bottom, TOP + 40 + ext.h + 20);
  FORM = 'BRICK ASSEMBLY';
  ARIA_BODY = `Sheet 2's seated assembly — the @uirouter/core baseplate on the browser ground, the server plate on its shelf, ${WORD[BRICK_ROWS.length]} family bricks in their hues — with the lint plugin on a ground of its own in front, and high above it ${WORD[CONSUMERS.length - BARE.length]} plain consumer bricks hovering on one deck in clusters lettered by build, each tied by a dashed accent line to a ringed stud on every family part it pins, the ties converging on brick ${HUB.b.n}; ${listOf(BARE.map((c) => c.name))}, which pins no family part, stands on a ground of its own.`;
} else {
  const panels = [...BUILD_MODELS.map(panelOf), ...(BARE.length ? [panelOf(null)] : [])];
  const PAD = 14, MARGIN = 10, LINE = 12, GUT = 18;
  const heads = (pn) => {
    const m = pn.model, cs = pn.consumers;
    if (!m) return [['NO BUILD', 'lblt'], [`${plural(cs.length, 'consumer')} · ${kindCount(cs)}`, 'lblf'], ['pins no family part: on the ground', 'lblf']];
    const anchors = [...new Set(cs.map((c) => c.anchor.n))];
    return [[`BUILD ${m.numeral} · ${m.name.toUpperCase()}`, m.atlas ? 'lbla' : 'lblt'], [`${plural(cs.length, 'consumer')} · ${kindCount(cs)}`, 'lblf'],
      [`${m.atlas ? `${m.words} · ` : ''}seated on brick ${listOf(anchors)}`, 'lblf']];
  };
  const HEAD_H = PAD + 13 + 2 * LINE + 14;
  const local = panels.map((pn) => extentOf(0, 0, pn.family, pn.placed, marksOf(0, 0, pn.family, pn.placed)));
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
    const marks = marksOf(ox, oy, pn.family, pn.placed);
    const at = extentOf(ox, oy, pn.family, pn.placed, marks);
    if (at.x0 < x + MARGIN - 0.5 || at.x1 > x + w - MARGIN + 0.5 || at.y0 < y + HEAD_H - 0.5 || at.y1 > y + h - MARGIN + 0.5) throw new Error(`sheet 2E: panel ${i + 1}'s model runs out of its frame`);
    for (const m of marks) taken.push(m.at);
    ALL_MARKS.push(...marks);
    const atlas = pn.model?.atlas;
    return `<g id="${P}-build-${pn.model?.numeral ?? 'none'}" data-build="${pn.model?.numeral ?? ''}">
<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${atlas ? 'ska' : 'skf'} fnone"${atlas ? ' stroke-dasharray="5 4" opacity="0.7"' : ''}/>
${heads(pn).map(([s, cls], k) => txt(x + PAD, y + PAD + 13 + k * LINE + (k ? 3 : 0), s, cls)).join('\n')}
${drawScene(ox, oy, pn.family, pn.placed, pn.ties)}
${marks.filter((m) => m.lead).map((m) => leaderTo(m.lead)).join('\n')}
${marks.map(markSvg).join('\n')}
</g>`;
  });
  ART = `${box.svg}\n${svgs.join('\n')}`;
  ART_BOTTOM = Math.max(box.bottom, GY + ROW_Y.at(-1) + ROW_H.at(-1));
  FORM = 'BUILD INSTRUCTIONS';
  ARIA_BODY = `An instruction booklet of ${WORD[panels.length]} panels: each of sheet 2C's ${WORD[BUILD_MODELS.length]} builds, its family bricks in their hues on a slab of ground, with that build's consumers as plain bricks hovering above, each dropping a dashed accent line onto a ringed stud of the part it pins and tying to a ringed stud on each other part it pins, and a last panel for the consumer that pins no family part.`;
}
// every consumer is drawn, once
if (DRAWN.length !== CONSUMERS.length || new Set(DRAWN).size !== CONSUMERS.length) throw new Error(`sheet 2E: ${DRAWN.length} consumer bricks drawn for ${CONSUMERS.length} consumers`);
// every mark keeps its gap from every other in the cut
for (let i = 0; i < ALL_MARKS.length; i++) for (let j = i + 1; j < ALL_MARKS.length; j++)
  if (Math.hypot(ALL_MARKS[i].at[0] - ALL_MARKS[j].at[0], ALL_MARKS[i].at[1] - ALL_MARKS[j].at[1]) < MARK_GAP) throw new Error(`sheet 2E: two marks within ${MARK_GAP}px at ${ALL_MARKS[i].at} and ${ALL_MARKS[j].at}`);

const SCHED_ROWS = SCHED_ROWS_RAW.flatMap((r) => wrapWords(r, Math.floor((VW - 2 * LEFT - 36) / 5.6)));
const SY = ART_BOTTOM + 40;
const schedule = `<rect x="${LEFT}" y="${SY}" width="${VW - 2 * LEFT}" height="${80 + SCHED_ROWS.length * 16}" class="sk fp"/>
${txt(LEFT + 18, SY + 22, `CONSUMER SCHEDULE — one row per consumer, numbered by sheet 2C’s build order, the atlas app last · authored files and sloc by the city ruler, specs aside · S sample app · D docs site · E example · A atlas app`, 'lbls')}
<line x1="${LEFT}" y1="${SY + 32}" x2="${VW - LEFT}" y2="${SY + 32}" class="skf"/>
${SCHED_ROWS.map((r, i) => txt(LEFT + 18, SY + 52 + i * 16, r, 'lbls')).join('\n')}
${txt(LEFT + 18, SY + 60 + SCHED_ROWS.length * 16, `TOTAL — ${plural(CAB.consumers, 'consumer')} · ${plural(CAB.files, 'authored file')} · ${fmt(CAB.sloc)} sloc · ${plural(CAB.studs, 'stud')} · ${fmt(ALL.consumers)} · ${fmt(ALL.files)} · ${fmt(ALL.sloc)} · ${fmt(ALL.studs)} with the atlas app · ${COUNTED}`, 'lbls')}`;
const VH = SY + 90 + SCHED_ROWS.length * 16;

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
  scale: `${WORD[CONSUMERS.length].toUpperCase()} CONSUMERS`,
  form: FORM,
  svg,
  caption: `The repository's own consumers drawn as bricks on the family they pin. ${Cap(WORD[HUB.by.length])} of ${WORD[CONSUMERS.length]} pin ${HUB.b.name}, brick ${HUB.b.n}; ${listOf(BARE.map((c) => c.name))} pins no family part; the atlas app, on its own branch, is the heaviest at ${plural(HEAVIEST.studs, 'stud')}.`,
  notes: `
<p><strong>Up from the family.</strong> Sheet 2 seats the family on <code>@uirouter/core</code>; sheet 2C goes down to the runtimes the family peers. This plate goes up: the sample apps, the docs site, the embedded examples and the atlas's own app, each massed at sheet 2's mould from its authored source — the city ruler's files under its <code>src/</code> (the docs site's <code>.vitepress/</code>, <code>worker/</code> and <code>src/</code>), specs aside — and seated on the parts its manifest pins.</p>
<p><strong>One hub.</strong> ${Cap(WORD[HUB.by.length])} consumers pin ${npmLink(HUB.b.name)}${CUT === 'a' ? `, so ${WORD[HUB.by.length]} ties end on its free studs` : `, and ${WORD[ON_ANCHOR(HUB.b).length]} of them hover over it, since it is the heaviest part each pins`}; ${listOf(CARRY.filter((x) => x.by.length && x !== HUB).map((x) => `${x.b.name} is pinned by ${WORD[x.by.length]}`))}${UNPINNED.length ? `, and ${listOf(UNPINNED.map((b) => b.name))} by none` : ''}.</p>
<p><strong>The examples are thin.</strong> An embedded example is a file or two under <code>examples/&lt;key&gt;/src/</code>, so most mould a single course; ${TALLEST.name}, at ${plural(TALLEST.files, 'file')}, stands ${plural(TALLEST.courses, 'course')} tall.</p>`,
  key: [
    keyRow('<polygon points="4,12 16,5 30,12 30,16 16,9 4,16" class="sk fp"/><ellipse cx="10" cy="8" rx="4" ry="2.3" class="sk fp2"/><ellipse cx="24" cy="8" rx="4" ry="2.3" class="sk fp2"/>', `a consumer brick, drawn plain — 1 stud per ${SLOC_PER_STUD} sloc, a course per ${FILES_PER_COURSE} authored files`),
    keyRow('<polygon points="4,12 16,5 30,12 30,16 16,9 4,16" class="ska fp"/>', 'the atlas app’s brick, edged in accent — on its own branch'),
    keyRow(`<rect x="8" y="1" width="32" height="17" rx="8.5" class="ska fp"/><text x="24" y="13" class="lbla" text-anchor="middle">7 E</text>`, 'a consumer’s tag — its number and kind: S sample app, D docs site, E example, A atlas app'),
    keyRow('<circle cx="24" cy="9" r="8" class="sk fp"/><text x="24" y="12.5" class="lbl" text-anchor="middle">1</text>', 'a family brick in its sheet 2 hue, numbered as on sheet 2'),
    keyRow('<ellipse cx="24" cy="9" rx="6" ry="3.5" class="ska fp"/><ellipse cx="24" cy="9" rx="11" ry="6.5" class="ska fnone"/>', 'a ringed stud — a consumer’s pin on that part'),
    ...(CUT === 'a' ? [] : [keyRow('<line x1="24" y1="2" x2="24" y2="16" class="ska" stroke-dasharray="6 4"/><circle cx="24" cy="16" r="2.2" class="fa"/>', 'drop — the consumer hovers over the heaviest part it pins')]),
    keyRow('<line x1="6" y1="3" x2="40" y2="15" class="ska" stroke-dasharray="6 4"/><ellipse cx="40" cy="15" rx="5" ry="2.8" class="ska fnone"/>', CUT === 'a' ? 'tie — from the consumer’s underside to each part it pins' : 'tie — to each other part it pins'),
    keyRow('<polygon points="4,8 16,2 44,9 44,15 16,8 4,14" class="sk fp"/>', 'ground — not massed'),
  ].join('\n'),
};
function npmLink(name) {
  byName(name);
  return `<a href="${npmUrl(name)}"><code>${name}</code></a>`;
}

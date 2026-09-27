import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, lines, isoPt, keyRow } from './helpers.mjs';

const P = 's2';

// ---- census: every number below comes from www/atlas.lit-ui-router.dev/data/census-bricks.json -----
// Same basis and the same plate as sheets 3 and 4: .ts/.tsx/.js/.mjs under each
// package's src/, excluding *.d.ts, *.{spec,test}.*, specs/ and typedoc stubs.
// sloc = scc `Code`.  Rows: {name, version, files, sloc, studs, shape, courses}.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-bricks.json', import.meta.url), 'utf8'));
const row = (name) => {
  const r = PLATE.rows.find((x) => x.name === name);
  if (!r) throw new Error(`census-bricks.json: no row named ${name}`);
  return r;
};
const COUNTED = `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;
const CORE_ROW = row('@uirouter/core');
const CORE = [CORE_ROW.name, CORE_ROW.version, CORE_ROW.files, CORE_ROW.sloc];
// the one published package that is not a brick: a lint plugin, scheduled but NOT drawn
const LINT = row('eslint-plugin-lit-ui-router');
// census-couplings.json supplies the peer ranges the schedule quotes
const COUPLINGS = JSON.parse(readFileSync(new URL('../data/census-couplings.json', import.meta.url), 'utf8'));
const peerRange = (from, to) => {
  const r = COUPLINGS.rows.find((x) => x.from === from && x.to === to && x.kind === 'peer');
  if (!r) throw new Error(`census-couplings.json: no peer row ${from} → ${to}`);
  return r.range;
};

// ---- quantization rule ----------------------------------------------------------
// A brick is not drawn to a continuous scale.  Its PLAN is a whole number of studs
// — one stud per 150 sloc, rounded up, then rounded up again to the next standard
// brick shape (1×1, 1×2, 2×2, 2×3, 2×4) — and its HEIGHT is one course per three
// authored files, rounded up.  The baseplate is not massed: a plate is ground.
const STUDS = (sloc) => Math.max(1, Math.ceil(sloc / 150));
const SHAPE = (n) => (n <= 1 ? [1, 1] : n <= 2 ? [1, 2] : n <= 4 ? [2, 2] : n <= 6 ? [2, 3] : [2, 4]);
const COURSES = (files) => Math.max(1, Math.ceil(files / 3));
const fmt = (v) => v.toLocaleString('en-US');
const shapeName = ([w, d]) => `${w}×${d}`;

// the runtime companions this assembly seats, in drawing order — every published
// package on the plate but the lint plugin, which takes no router stud
const BRICKS = [
  { n: 1, name: 'lit-ui-router' },
  { n: 2, name: 'ui-router-navigation-location-plugin', disp: 'navigation-location-plugin' },
  { n: 3, name: 'lit-ui-router-mobx' },
  { n: 4, name: 'ui-router-server' },
  { n: 5, name: 'lit-ui-router-effect' },
  { n: 6, name: 'lit-ui-router-ssr' },
].map((b) => {
  const r = row(b.name);
  const shape = SHAPE(STUDS(r.sloc)), courses = COURSES(r.files);
  // the quantization is this sheet's; the census moulds the same brick or the rule has drifted
  if (`${shape[0]}x${shape[1]}` !== r.shape || courses !== r.courses)
    throw new Error(`sheet2: ${b.name} moulds ${shapeName(shape)} × ${courses} here but ${r.shape} × ${r.courses} in census-bricks.json`);
  return { disp: b.name, ...b, ver: r.version, files: r.files, sloc: r.sloc, shape, courses };
});
// the family is every census row but the baseplate; each member is a brick or the lint plugin
const FAMILY = PLATE.rows.filter((r) => r.name !== CORE_ROW.name);
if (FAMILY.length !== BRICKS.length + 1)
  throw new Error(`sheet2: ${FAMILY.length} published packages but ${BRICKS.length} bricks + the lint plugin — seat or schedule the newcomer`);
const B = (n) => BRICKS.find((b) => b.n === n);

// ---- iso brick geometry ----------------------------------------------------------
const U = 40;        // stud pitch, plan units
const CRS = 24;      // one brick course, plan units of height
const PT = 12;       // baseplate thickness
const SH = 7;        // stud height
const SR = 12;       // stud radius, plan units
// A plan circle projects to an AXIS-ALIGNED ellipse under this iso: rx = r·√2·0.866,
// ry = r·√2·0.5.  So a stud is one ellipse plus a swept side wall — no rotation.
const RX = +(SR * Math.SQRT2 * 0.866).toFixed(2);
const RY = +(SR * Math.SQRT2 * 0.5).toFixed(2);

const pt = (ox, oy, x, y, z = 0) => isoPt(ox, oy, x, y, z).map((v) => +v.toFixed(1));
const p2 = (ox, oy, x, y, z = 0) => pt(ox, oy, x, y, z).join(',');

// A face must be drawn OPAQUE, and a `fill` presentation attribute cannot do it:
// every stroke class in chrome.mjs declares `fill: none`, and a class outranks a
// presentation attribute — so the fill has to be restated inline. A patterned face
// needs stone under it as well, because the hatch tile has no ground of its own.
// (Same fault iso-hidden.mjs fixes for isoBlock; these builders are sheet 2's own.)
const face = (pts, cls, fill, { under = null, extra = '' } = {}) =>
  (under ? `<polygon points="${pts}" stroke="none" style="fill:${under}"/>\n` : '')
  + `<polygon points="${pts}" class="${cls}"${extra} style="fill:${fill}"/>`;

// One stud: an iso cylinder — swept side wall under an ellipse cap.
function stud(ox, oy, x, y, z, { edge = 'sks', cap = 'fp2', ring = null } = {}) {
  const [cx, cy] = pt(ox, oy, x, y, z + SH);
  const by = +(cy + SH).toFixed(1);
  const halo = ring
    ? `<ellipse cx="${cx}" cy="${cy}" rx="${(RX + 5.5).toFixed(1)}" ry="${(RY + 3.2).toFixed(1)}" class="${ring} fnone"/>`
    : '';
  return `<path d="M${cx - RX},${cy} L${cx - RX},${by} A${RX},${RY} 0 0 0 ${cx + RX},${by} L${cx + RX},${cy} Z" class="${edge}" style="fill:var(--paper-2)"/>
<ellipse cx="${cx}" cy="${cy}" rx="${RX}" ry="${RY}" class="${edge} ${cap}"/>${halo}`;
}

// One brick body: three faces, course seams scored on both visible flanks, studs on
// the cap.  z0 > 0 leaves it hovering — this is an exploded view, nothing is seated.
function brick(ox, oy, x, y, ws, ds, courses, { z0 = 0, edge = 'sk', cap = 'fp', side, studCap = 'fp2', studEdge, ringStuds = new Set() } = {}) {
  const w = ws * U, d = ds * U, h = courses * CRS, t = z0 + h;
  const q = (px, py, pz) => p2(ox, oy, px, py, pz);
  const top = [q(x, y, t), q(x + w, y, t), q(x + w, y + d, t), q(x, y + d, t)].join(' ');
  const left = [q(x, y + d, t), q(x + w, y + d, t), q(x + w, y + d, z0), q(x, y + d, z0)].join(' ');
  const right = [q(x + w, y, t), q(x + w, y + d, t), q(x + w, y + d, z0), q(x + w, y, z0)].join(' ');
  const seams = [];
  for (let k = 1; k < courses; k++) {
    const z = z0 + k * CRS;
    const a = pt(ox, oy, x, y + d, z), b = pt(ox, oy, x + w, y + d, z), c = pt(ox, oy, x + w, y, z);
    seams.push(`<path d="M${a} L${b} L${c}" class="skf fnone"/>`);
  }
  const studs = [];
  for (let i = 0; i < ws; i++)
    for (let j = 0; j < ds; j++)
      studs.push(stud(ox, oy, x + (i + 0.5) * U, y + (j + 0.5) * U, t, ringStuds.has(`${i},${j}`) ? { edge: 'ska', cap: 'fp', ring: 'ska' } : { edge: studEdge ?? edge, cap: studCap }));
  return `${face(left, edge, 'var(--paper-2)')}
${face(right, edge, side ?? `url(#${P}-hx)`, { under: 'var(--paper)' })}
<polygon points="${top}" class="${edge} ${cap}"/>
${seams.join('\n')}
${studs.join('\n')}`;
}

// A baseplate: a thin slab carrying its full stud grid.
function plate(ox, oy, cols, rows, { edge = 'sk', dash = '', named = new Map() } = {}) {
  const w = cols * U, d = rows * U;
  const q = (px, py, pz) => p2(ox, oy, px, py, pz);
  const top = [q(0, 0, PT), q(w, 0, PT), q(w, d, PT), q(0, d, PT)].join(' ');
  const left = [q(0, d, PT), q(w, d, PT), q(w, d, 0), q(0, d, 0)].join(' ');
  const right = [q(w, 0, PT), q(w, d, PT), q(w, d, 0), q(w, 0, 0)].join(' ');
  const da = dash ? ` stroke-dasharray="${dash}"` : '';
  const studs = [];
  // Painter's order over the plate: back rows first.
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const k = named.get(`${i},${j}`);
      studs.push(stud(ox, oy, (i + 0.5) * U, (j + 0.5) * U, PT, k ?? {}));
    }
  return `${face(left, edge, 'var(--paper-2)', { extra: da })}
${face(right, edge, `url(#${P}-hx)`, { under: 'var(--paper)', extra: da })}
<polygon points="${top}" class="${edge} fp"${da}/>
${studs.join('\n')}`;
}

// A drop line: the exploded-view fall from a brick's underside onto the stud it
// seats on.  Vertical in screen space, because z is the screen's vertical axis.
const drop = (ox, oy, x, y, zFrom, zTo) => dropOnto(ox, oy, x, y, zFrom, ox, oy, x, y, zTo);
// The same fall onto a stud of another assembly: it has to land in the column it
// leaves from, or the line would lean.
function dropOnto(ox, oy, x, y, zFrom, ox2, oy2, x2, y2, zTo) {
  const [cx, y0] = pt(ox, oy, x, y, zFrom);
  const [cx2, yTo] = pt(ox2, oy2, x2, y2, zTo + SH);
  if (Math.abs(cx - cx2) > 0.25) throw new Error(`sheet2: a drop leaves x ${cx} and lands at x ${cx2} — it would lean`);
  const y1 = yTo - RY - 1;
  return `<line x1="${cx}" y1="${y0}" x2="${cx}" y2="${y1.toFixed(1)}" class="ska" stroke-dasharray="6 4"/>
<circle cx="${cx}" cy="${y1.toFixed(1)}" r="2.2" class="fa"/>`;
}

const badge = (x, y, n, cls = 'sk fp', num = 'lbl') =>
  `<circle cx="${x}" cy="${y}" r="9.5" class="${cls}"/>${txt(x, y + 3.6, String(n), num, 'middle')}`;

const leader = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="skf"/>`;

// ---- the couplings: which brick seats on which, through what -------------------------
// Every brick-to-brick joint in the set, [from, onto, the lower brick's stud]. Each one
// is a peerDependency in census-couplings.json, and no other brick peers another brick.
const COUPLES = [
  [3, 1, 'F'],   // lit-ui-router-mobx     → UIRouterLitElement.seekRouter(host)
  [5, 1, 'F'],   // lit-ui-router-effect   → UIRouterLitElement.seekRouter(host)
  [6, 1, 'G'],   // lit-ui-router-ssr      → lit-ui-router/context, and UiView itself
  [6, 4, 'H'],   // lit-ui-router-ssr      → createServerRouter()
];
{
  const names = new Set(BRICKS.map((b) => b.name));
  const peers = COUPLINGS.rows.filter((r) => r.kind === 'peer' && names.has(r.from) && names.has(r.to)).map((r) => `${r.from} → ${r.to}`).sort();
  const drawn = COUPLES.map(([a, b]) => `${B(a).name} → ${B(b).name}`).sort();
  if (peers.join('|') !== drawn.join('|'))
    throw new Error(`sheet2: brick-to-brick peers are [${peers.join(', ')}] but the drawing seats [${drawn.join(', ')}]`);
}
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const listOf = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const ONTO = (n) => COUPLES.filter(([, b]) => b === n).map(([a]) => a);         // who seats on brick n
const ON1 = ONTO(1), ON4 = ONTO(4);
const BRIDGE = COUPLES.map(([a]) => a).find((a, i, all) => all.indexOf(a) !== i);  // the one brick with two seats
if (BRIDGE !== 6) throw new Error('sheet2: the bridge is drawn as brick 6 — re-letter it');
const BRICK_JOINTS = COUPLES.map(([a, b]) => `${a} → ${b}`);

// ---- the client assembly ----------------------------------------------------------
// Brick 1 lies long side to the rail, over its far four seats, so the rail stays in
// view and the three bricks that seat on it stand over the plate's right corner —
// where the prerender bridge can reach across to the second plate.
const OX = 440, OY = 420;                 // @uirouter/core baseplate, 8 x 6 studs
const RING = { edge: 'ska', cap: 'fp', ring: 'ska' };
const NAMED = new Map([
  // the plugin rail — the whole back row is router.plugin(); two seats are taken
  ...Array.from({ length: 8 }, (_, i) => [`${i},0`, RING]),
  ['0,0', { edge: 'skr', cap: 'fp', ring: 'skr' }],   // the LOCATION SEAT — exactly one
  ['1,5', RING],   // D  urlService
  ['3,5', RING],   // C  transitionService
  ['7,3', RING],   // E  globals
  ['7,1', RING],   // B  stateRegistry
]);

// [plan x, plan y, hover z] of each brick; plan and courses come from the census.
// Heights step so no brick hides another's drop line: the bridge lowest, over brick
// 1's far end; brick 5 just clear of brick 1's front edge; brick 3 over both.
const LIT = [160, 0, 96];      // 1 — its drop is the one at the back-right seat, clear of its own face
const NAV = [0, 0, 80];        // 2 — over the LOCATION SEAT
const MBX = [240, 0, 432];     // 3 — highest: clear of the bridge's cap where it stands behind it
const EFF = [160, 40, 330];    // 5 — overhangs brick 1's front edge by one stud
const SSR = [280, -40, 340];   // 6 — its near end over brick 1, its far end over brick 4
const litTop = LIT[2] + B(1).courses * CRS;

const clientPlate = plate(OX, OY, 8, 6, { named: NAMED });

// brick 1 drawn long side to the rail: 4 studs along x, 2 deep
const litBrick = brick(OX, OY, LIT[0], LIT[1], B(1).shape[1], B(1).shape[0], B(1).courses,
  { z0: LIT[2], studEdge: 'sk', ringStuds: new Set(['0,1', '2,1', '3,0']) });   // F (5), F (3), G (6)

const plateDrops = [
  drop(OX, OY, 300, 20, LIT[2], PT),                // 1 -> stud A, seat 7 — its back-right stud, the one in view
  drop(OX, OY, 20, 20, NAV[2], PT),                 // 2 -> stud A, the LOCATION SEAT
].join('\n');
const capDrops = [
  drop(OX, OY, 260, 60, MBX[2], litTop),            // 3 -> F on brick 1
  drop(OX, OY, 180, 60, EFF[2], litTop),            // 5 -> F on brick 1
  drop(OX, OY, 300, 20, SSR[2], litTop),            // 6 -> G on brick 1
].join('\n');

// ---- the second plate: ui-router-server ---------------------------------------------
// Placed so brick 6's far end stands over brick 4's front-left stud: the plate's
// origin is solved from that one screen column.
const SSR_REACH = [380, -20];             // the point under brick 6 that falls onto brick 4
const B4_SEAT = [20, 140];                // brick 4's stud (0,3) — H
const OX2 = +(pt(OX, OY, ...SSR_REACH)[0] - pt(0, 0, ...B4_SEAT)[0]).toFixed(1);
const OY2 = OY + 20;                      // a headless core, 4 x 4 studs, optional
const SRV_NAMED = new Map([
  ['1,0', RING],
  ['1,2', RING],
]);
const srvZ0 = 100, srvTop = srvZ0 + B(4).courses * CRS;
const serverIsland = `${plate(OX2, OY2, 4, 4, { edge: 'sks', dash: '6 4', named: SRV_NAMED })}
${drop(OX2, OY2, 60, 20, srvZ0, PT)}
${drop(OX2, OY2, 60, 100, srvZ0, PT)}
${brick(OX2, OY2, 0, 0, B(4).shape[0], B(4).shape[1], B(4).courses, { z0: srvZ0, studEdge: 'sk', ringStuds: new Set(['0,3']) })}`;

// painted back to front: the plate and its drops, brick 1 and the drops onto its cap,
// brick 2, brick 5, the second plate and brick 4, the bridge's fall onto it, the
// bridge, and brick 3 over everything
const assembly = `${clientPlate}
${plateDrops}
${litBrick}
${capDrops}
${brick(OX, OY, NAV[0], NAV[1], B(2).shape[0], B(2).shape[1], B(2).courses, { z0: NAV[2] })}
${brick(OX, OY, EFF[0], EFF[1], B(5).shape[0], B(5).shape[1], B(5).courses, { z0: EFF[2] })}
${serverIsland}
${dropOnto(OX, OY, ...SSR_REACH, SSR[2], OX2, OY2, ...B4_SEAT, srvTop)}
${brick(OX, OY, SSR[0], SSR[1], B(6).shape[1], B(6).shape[0], B(6).courses, { z0: SSR[2] })}
${brick(OX, OY, MBX[0], MBX[1], B(3).shape[0], B(3).shape[1], B(3).courses, { z0: MBX[2] })}`;

// ---- parts callout (LEGO manual language, drafting-set lettering) --------------------
const MU = 10, MC = 7, MRX = 3.7, MRY = 2.1, MSH = 2.4;
function miniBrick(ox, oy, ws, ds, courses, dash = '') {
  const w = ws * MU, d = ds * MU, h = courses * MC;
  const q = (px, py, pz) => {
    const [sx, sy] = isoPt(ox, oy, px, py, pz);
    return `${sx.toFixed(1)},${sy.toFixed(1)}`;
  };
  const da = dash ? ` stroke-dasharray="${dash}"` : '';
  const cls = dash ? 'sks' : 'sk';
  return `${face([q(0, d, h), q(w, d, h), q(w, d, 0), q(0, d, 0)].join(' '), cls, 'var(--paper-2)', { extra: da })}
${face([q(w, 0, h), q(w, d, h), q(w, d, 0), q(w, 0, 0)].join(' '), cls, `url(#${P}-hx)`, { under: 'var(--paper)', extra: da })}
<polygon points="${[q(0, 0, h), q(w, 0, h), q(w, d, h), q(0, d, h)].join(' ')}" class="${cls} fp"${da}/>
${Array.from({ length: ws * ds }, (_, k) => {
  const [sx, sy] = isoPt(ox, oy, (Math.floor(k / ds) + 0.5) * MU, ((k % ds) + 0.5) * MU, h + MSH);
  return `<path d="M${(sx - MRX).toFixed(1)},${sy.toFixed(1)} v${MSH} a${MRX},${MRY} 0 0 0 ${2 * MRX},0 v${-MSH} Z" class="${cls} fp2"${da}/>
<ellipse cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" rx="${MRX}" ry="${MRY}" class="${cls} fp2"${da}/>`;
}).join('\n')}`;
}

// [brick, row y] — shape and courses come from the brick itself
const PARTS = [[1, 108], [2, 152], [3, 190], [4, 236], [5, 282], [6, 326]];
if (PARTS.length !== BRICKS.length) throw new Error('sheet2: the parts callout lists a row per brick');
const partsBox = `<rect x="30" y="34" width="246" height="${PARTS.at(-1)[1] + 32 - 34}" class="skf fnone"/>
${txt(44, 56, `PARTS — ${BRICKS.length} BRICKS, 2 PLATES`, 'lbls')}
${leader(30, 64, 276, 64)}
${PARTS.map(([n, oy]) => {
  const b = B(n);
  return `${miniBrick(92, oy, b.shape[0], b.shape[1], b.courses)}
${badge(48, oy - 4, n)}
${txt(120, oy - 6, b.disp, 'lbl')}
${txt(120, oy + 6, `x1 · ${shapeName(b.shape)} · ${b.courses} course${b.courses > 1 ? 's' : ''}`, 'lblf')}`;
}).join('\n')}`;

// ---- spare parts: the same stud, not in this set --------------------------------------
const SPARE = ['@uirouter/visualizer 7.2.1', '@uirouter/sticky-states 1.5.1', '@uirouter/dsr 1.2.0', '@uirouter/rx 1.0.0'];
const SPY = 624;
const spareBox = `<rect x="30" y="${SPY}" width="286" height="142" class="skf fnone" stroke-dasharray="5 4"/>
${txt(44, SPY + 22, 'SPARE PARTS — STUD A, NOT IN THIS SET', 'lbls')}
${[70, 130, 190, 250].map((x) => miniBrick(x, SPY + 52, 1, 1, 1, '3 2')).join('\n')}
${lines(44, SPY + 82, SPARE, 'lblf', 'start', 12)}
${txt(44, SPY + 134, 'all four queue on stud A — sheet 4', 'lblf')}`;

// ---- stud schedule: the published surface each brick seats on ------------------------
const STUDROWS = [
  ['A', 'router.plugin(factory)'],
  ['', 'the whole back rail — one method, eight seats, two taken here'],
  ['', 'brick 1 registers servicesPlugin; brick 2 takes the LOCATION SEAT'],
  ['', 'the red ring: a router holds exactly ONE location plugin, so'],
  ['', 'brick 2 SWAPS core’s pushStateLocation rather than adding to it'],
  ['B', 'stateRegistry.decorator(…)'],
  ['', 'brick 1 — decorator(‘views’, litViewsBuilder) is the whole Lit graft'],
  ['C', 'transitionService.onSuccess()'],
  ['', 'bricks 3 and 5 — one hook per router each, attach() / routeRef()'],
  ['D', 'urlService.listen() / .sync() / .rules'],
  ['', 'brick 1 starts the client; brick 4 replays rules on its own plate'],
  ['E', 'globals.current / .params'],
  ['', 'bricks 3 and 5 read them into observables — neither writes them'],
  ['-', 'ON THE BRICKS — seams a brick publishes for the ones above it'],
  ['F', 'UIRouterLitElement.seekRouter(host)'],
  ['', `brick 1’s ui-router-context event — bricks ${listOf(COUPLES.filter(([, , s]) => s === 'F').map(([a]) => a))} seat here`],
  ['G', 'lit-ui-router/context — context-request'],
  ['', 'brick 1’s provideRouter · withRouterSync · getScopedRouter,'],
  ['', 'requestContext · provideContext — brick 6 seats here'],
  ['H', 'createServerRouter({ mounts }).resolve(path)'],
  ['', 'brick 4’s verdict table — brick 6 prerenders through it'],
];
const STX = 980, STW = 390, STY = 44;
// the brick seams sit under a rule of their own, a half row below core's
const STUD_Y = STUDROWS.reduce((ys, [k], i) => [...ys, (i ? ys[i - 1] + 14 : STY + 48) + (k === '-' ? 8 : 0)], []);
const studBox = `<rect x="${STX}" y="${STY}" width="${STW}" height="${STUD_Y.at(-1) + 12 - STY}" class="skf fnone"/>
${txt(STX + 14, STY + 22, 'STUD SCHEDULE — the published surface each brick seats on', 'lbls')}
${leader(STX, STY + 30, STX + STW, STY + 30)}
${STUDROWS.map(([k, s], i) => {
  const y = STUD_Y[i];
  if (k === '-') return `${leader(STX + 14, y - 13, STX + STW - 14, y - 13)}${txt(STX + 32, y, s, 'lblf')}`;
  return k ? `${txt(STX + 14, y, k, 'lbla')}${txt(STX + 32, y, s, 'lbl')}` : txt(STX + 32, y, s, 'lblf');
}).join('\n')}`;

// ---- lettering ---------------------------------------------------------------------------
// the four client bricks' blocks stand at the tower's left, right-aligned against it,
// each badge between its block and its mass; the bridge and brick 4 letter at the right
const stats = (b) => `${b.files}f · ${fmt(b.sloc)} sloc · ${shapeName(b.shape)} · ${b.courses} course${b.courses > 1 ? 's' : ''}`;
const lettering = `
${badge(562, 60, 3, 'ska fp', 'lbla')}
${txt(546, 64, `${B(3).name} ${B(3).ver}`, 'lblb', 'end')}
${txt(546, 76, stats(B(3)), 'lblf', 'end')}
${txt(546, 88, 'SEATS ON BRICK 1 — F · seekRouter()', 'lbla', 'end')}
${txt(546, 100, 'STUDS C · E on the plate below', 'lbla', 'end')}

${badge(466, 150, 5, 'ska fp', 'lbla')}
${txt(450, 154, `${B(5).name} ${B(5).ver}`, 'lblb', 'end')}
${txt(450, 166, stats(B(5)), 'lblf', 'end')}
${txt(450, 178, 'SEATS ON BRICK 1 — F', 'lbla', 'end')}
${txt(450, 190, 'seekRouter() · STUDS C · E', 'lbla', 'end')}

${badge(490, 268, 1, 'ska fp', 'lbla')}
${txt(466, 240, `${B(1).name} ${B(1).ver}`, 'lblb', 'end')}
${txt(466, 252, stats(B(1)), 'lblf', 'end')}
${txt(466, 264, 'STUDS A · B · D', 'lbla', 'end')}
${txt(466, 276, 'extends UIRouter · carries F · G', 'lbla', 'end')}

${badge(394, 372, 2, 'ska fp', 'lbla')}
${txt(380, 389, 'ui-router-navigation-', 'lblb', 'end')}
${txt(380, 402, `location-plugin ${B(2).ver}`, 'lblb', 'end')}
${txt(380, 414, stats(B(2)), 'lblf', 'end')}
${txt(380, 426, 'STUD A — the LOCATION SEAT', 'lblr', 'end')}
${txt(380, 438, 'a swap, never an addition', 'lblr', 'end')}

${badge(744, 118, 6, 'ska fp', 'lbla')}
${txt(696, 54, `${B(6).name} ${B(6).ver}`, 'lblb')}
${txt(696, 66, stats(B(6)), 'lblf')}
${txt(696, 78, 'SEATS ON BRICK 1 — G · context-request', 'lbla')}
${txt(696, 90, 'AND ON BRICK 4 — H · createServerRouter()', 'lbla')}
${txt(696, 102, 'the bridge — a drop line onto each assembly', 'lblf')}

${badge(974, 404, 4, 'ska fp', 'lbla')}
${txt(990, 408, `${B(4).name} ${B(4).ver}`, 'lblb')}
${txt(990, 420, stats(B(4)), 'lblf')}
${txt(990, 432, 'STUDS A′ · D′ — on a plate of its own', 'lbla')}
${txt(990, 444, 'carries H — createServerRouter()', 'lbla')}

<!-- the plate itself -->
${txt(40, 466, `${CORE[0]} ${CORE[1]} — THE BASEPLATE`, 'lblb')}
${txt(40, 478, `${CORE[2]} files · ${fmt(CORE[3])} sloc · not massed`, 'lblf')}
${txt(40, 490, 'a plate is ground: every brick peers it,', 'lblf')}
${txt(40, 502, 'and no brick may replace it', 'lblf')}
${leader(236, 484, 330, 524)}

<!-- named studs, labelled off the plate -->
${txt(40, 528, 'A   router.plugin(factory)', 'lbla')}
${txt(40, 540, 'one method, not eight slots:', 'lblf')}
${txt(40, 552, 'bricks queue on it', 'lblf')}
${leader(206, 526, 505, 466)}

${txt(340, 740, 'D   urlService', 'lbla')}
${txt(340, 752, '.listen() · .sync() · .rules — brick 1', 'lblf')}
${txt(340, 764, 'starts and syncs the client router', 'lblf')}
${leader(346, 730, 303, 552)}

${txt(540, 740, 'C   transitionService', 'lbla')}
${txt(540, 752, '.onSuccess({}, …) — one hook per router', 'lblf')}
${txt(540, 764, 'from each of bricks 3 and 5', 'lblf')}
${leader(546, 730, 372, 592)}

${txt(760, 740, 'E   globals', 'lbla')}
${txt(760, 752, '.current · .params · the last transition', 'lblf')}
${txt(760, 764, 'bricks 3 and 5 mirror them, never write', 'lblf')}
${leader(766, 730, 581, 632)}

${txt(780, 686, 'B   stateRegistry', 'lbla')}
${txt(780, 698, '.decorator(‘views’, litViewsBuilder)', 'lblf')}
${txt(780, 710, 'the one graft that renders Lit', 'lblf')}
${leader(776, 682, 650, 592)}

<!-- the absent coupling -->
<line x1="682.5" y1="588" x2="786.4" y2="528" class="skf" stroke-dasharray="5 4"/>
<circle cx="734.4" cy="558" r="9" class="skr fp"/>
<line x1="728" y1="564.4" x2="740.8" y2="551.6" class="skr"/>
${txt(920, 646, 'ui-router-server takes NO stud on this plate —', 'lblr')}
${txt(920, 658, '@uirouter/core is an OPTIONAL peer for it', 'lblr')}

${txt(1044, 496, 'THE SECOND PLATE — the same core, headless', 'lbls')}
${txt(1044, 508, 'peerDependenciesMeta marks core optional;', 'lblf')}
${txt(1044, 520, 'simulate.ts does new UIRouter() + plugin(', 'lblf')}
${txt(1044, 532, 'servicesPlugin) + plugin(memoryLocationPlugin),', 'lblf')}
${txt(1044, 544, 'reached only through a lazy import — so the', 'lblf')}
${txt(1044, 556, 'default ‘matcher’ tier, the one brick 6 drives', 'lblf')}
${txt(1044, 568, 'by default, ships with no plate at all', 'lblf')}

${txt(700, 800, `bricks ${listOf(ON1)} seat on brick 1 and ${listOf(ON4)} on brick 4 too — every brick-to-brick joint is a seam the lower brick publishes`, 'lbla', 'middle')}`;

// ---- structure schedule ------------------------------------------------------------------
const ART_H = 814;
const row5 = B(5), row6 = B(6);
const SCHED = [
  [
    ` 0  ${CORE[0]} ${CORE[1]} — THE BASEPLATE · ${CORE[2]}f · ${fmt(CORE[3])} sloc · NOT MASSED (a plate is ground) · studs A–E are its published API`,
    `    every brick on this sheet declares it as a peerDependency; the only bricks that declare another brick are ${listOf(BRICK_JOINTS)}`,
  ],
  [
    ` 1  ${B(1).name} ${B(1).ver} · ${stats(B(1))} · studs A · B · D · carries F · G`,
    '    class UIRouterLit extends UIRouter — moulded, not snapped; everything lit-specific enters through published seams:',
    '    this.plugin(servicesPlugin) · this.stateRegistry.decorator(‘views’, litViewsBuilder) · urlService.listen()/sync() · viewService._pluginapi._viewConfigFactory(‘lit’, …) (internal)   [src/core.ts]',
    '    and publishes two of its own: F UIRouterLitElement.seekRouter(host), the ui-router-context event; G lit-ui-router/context, the context-request protocol   [src/ui-router.ts, src/context.ts]',
  ],
  [
    ` 2  ${B(2).name} ${B(2).ver} · ${stats(B(2))} · stud A (LOCATION SEAT)`,
    '    navigationLocationPlugin = locationPluginFactory(‘vanilla.navigationLocation’, true, NavigationLocationService, BrowserLocationConfig)',
    '    a router holds exactly one location plugin, so this brick SWAPS core’s pushStateLocation; it peers core only — it has never heard of Lit   [src/index.ts]',
  ],
  [
    ` 3  ${B(3).name} ${B(3).ver} · ${stats(B(3))} · seats on brick 1 (F) · studs C · E`,
    '    RouterStore.attach() → router.transitionService.onSuccess({}, update); update() reads globals.current/.params/.successfulTransitions',
    '    RouterReactionController → UIRouterLitElement.seekRouter(host), the ui-router-context event — stud F on brick 1   [src/router-store.ts, src/router-reaction-controller.ts]',
  ],
  [
    ` 4  ${B(4).name} ${B(4).ver} · ${stats(B(4))} · NO STUD on this plate · carries H`,
    '    peerDependenciesMeta: { ‘@uirouter/core’: { optional: true } } — the ‘matcher’ tier is dependency-free pattern matching',
    '    the ‘simulate’ tier reaches a plate of its own behind a lazy import(): new UIRouter() + plugin(servicesPlugin) + plugin(memoryLocationPlugin)   [src/index.ts, src/simulate.ts]',
  ],
  [
    ` 5  ${row5.name} ${row5.ver} · ${stats(row5)} · seats on brick 1 (F) · studs C · E`,
    '    routeRef(router) → router.transitionService.onSuccess({}, …), one SubscriptionRef per router; snapshotRoute() reads globals.current/.params/.successfulTransitions   [src/route-ref.ts]',
    `    RouterRefController → UIRouterLitElement.seekRouter(host), the stud brick 3 takes; RefController forks one Effect fiber per connected host · peers effect ${peerRange(row5.name, 'effect')}   [src/router-ref-controller.ts, src/ref-controller.ts]`,
  ],
  [
    ` 6  ${row6.name} ${row6.ver} · ${stats(row6)} · seats on brick 1 (G) AND on brick 4 (H) — the one part with a drop line onto each plate’s assembly`,
    '    prerender() → createServerRouter({ mounts }).resolve(path) per path · provideRouter(root, router) + withRouterSync(router, …) around @lit-labs/ssr render()   [src/prerender.ts]',
    '    UiViewRenderer → getScopedRouter() + router.viewService.registerUIView(); withServedRender(UiView) extends brick 1’s view, which wakes on requestContext(adoptUiViewContext)   [src/ui-view-renderer.ts, src/served-view.ts, src/register.ts]',
    `    client half: hydrateRoot() → provideContext(container, adoptUiViewContext, adopt) + hydrate(); uiViewSlot() marks each view’s hole · peers @lit-labs/ssr ${peerRange(row6.name, '@lit-labs/ssr')} and ssr-client ${peerRange(row6.name, '@lit-labs/ssr-client')} — a render table, not a router plate   [src/client.ts]`,
  ],
  [
    ` 7  ${LINT.name} ${LINT.version} · ${LINT.files}f · ${fmt(LINT.sloc)} sloc · NOT A BRICK — no stud on any router plate`,
    `    a lint package: it plugs into ESLint/oxlint hosts, never into @uirouter/core — the one published part of ${WORD[FAMILY.length]} that lives on a different table`,
  ],
];
const ROWS = SCHED.flat();
const TOT_F = BRICKS.reduce((a, b) => a + b.files, 0);
const TOT_L = BRICKS.reduce((a, b) => a + b.sloc, 0);
const SY = ART_H + 16;
const schedule = `<rect x="40" y="${SY}" width="1320" height="${74 + ROWS.length * 17}" class="sk fp"/>
${txt(58, SY + 22, 'STRUCTURE SCHEDULE — one row per brick · quantized plan · courses · the exact coupling, with its source', 'lbls')}
${leader(40, SY + 32, 1360, SY + 32)}
${ROWS.map((r, i) => txt(58, SY + 52 + i * 17, r, 'lbls')).join('\n')}
${txt(58, SY + 60 + ROWS.length * 17, `TOTAL — ${BRICKS.length} bricks drawn · ${TOT_F} authored files · ${fmt(TOT_L)} sloc, standing on one ${CORE[2]}-file, ${fmt(CORE[3])}-line baseplate · ${COUNTED}, same basis as sheets 3 and 4`, 'lbls')}`;

// ---- the massing finding, derived --------------------------------------------------------
const TILES = BRICKS.filter((b) => b.shape[0] * b.shape[1] <= 2).sort((a, b) => a.sloc - b.sloc);
const BIG = BRICKS.filter((b) => shapeName(b.shape) === '2×4').map((b) => b.n);
if (BIG.join() !== '1,4' || shapeName(B(6).shape) !== '2×3' || TILES.map((b) => b.n).join() !== '2,3,5')
  throw new Error(`sheet2: the massing note names 1 and 4 as the 2×4s, 6 as the 2×3 and 2, 3, 5 as the tiles — re-word it (2×4s ${BIG}, tiles ${TILES.map((b) => b.n)})`);
const tileShapes = (() => {
  const by = new Map();
  for (const b of TILES) by.set(shapeName(b.shape), (by.get(shapeName(b.shape)) ?? 0) + 1);
  return listOf([...by].map(([s, k]) => (k === 1 ? `a ${s}` : `${WORD[k]} ${s}s`)));
})();

const svg = `<svg viewBox="0 0 1400 ${SY + 110 + ROWS.length * 17}" role="img" aria-label="An exploded isometric LEGO assembly. A large flat baseplate lettered @uirouter/core carries a grid of studs; its whole back row is ringed in the accent colour and labelled A, router.plugin — the plugin rail. ${WORD[BRICKS.length][0].toUpperCase() + WORD[BRICKS.length].slice(1)} bricks hover above it, none of them seated, each with a dashed accent drop line falling onto the exact stud it takes. Brick 1, lit-ui-router, is a two-by-four ${B(1).courses} courses tall, laid long side to the rail over its far seats, and drops onto the rail; brick 2, the navigation location plugin, is a one-by-one one course tall and drops onto the rail's first stud, ringed in red — the location seat, of which a router has exactly one, so this brick swaps core's own location plugin rather than adding to it. Three bricks drop onto ringed studs on top of brick 1 instead of onto the plate, stepped in height so no brick hides another's fall: brick 5, lit-ui-router-effect, and brick 3, lit-ui-router-mobx, both one-by-twos two courses tall, take the seam lettered F, seekRouter, and reach the plate's named studs C transitionService and E globals for the hook they register and the values they read; brick 6, lit-ui-router-ssr, a two-by-three three courses tall, takes the seam lettered G, the context-request protocol, and is a bridge — its far end hangs over a second, smaller baseplate drawn entirely in dashed line at the right, where a second drop line falls onto a ringed stud lettered H on brick 4, ui-router-server, createServerRouter. A dashed tie between the two plates is crossed out with a red circle and slash — the server takes no stud on the client plate, because @uirouter/core is an optional peer for it and its default matcher tier never loads a plate at all. Named studs along the front of the plate are lettered below it, and a stud schedule at the upper right explains all eight seams. A parts callout at the upper left lists the ${WORD[BRICKS.length]} bricks with their shapes, and a dashed spare-parts box at the lower left shows four ghost one-by-one bricks — visualizer, sticky-states, dsr and rx — that would register through the very same stud A. A structure schedule beneath the drawing gives every brick its file count, line count, quantized shape and the exact API call it couples through.">
${defs(P)}

${txt(1370, 16, 'SCALE — plan = whole studs (1 stud per 150 sloc, rounded up to the next standard brick shape) · height = one course per 3 authored files · the baseplate is not massed', 'lbls', 'end')}
${txt(1370, 30, 'COUPLING IS THE SUBJECT — accent marks a published extension point; the bricks themselves are drawn plain', 'lblf', 'end')}

${partsBox}
${spareBox}
${studBox}

${assembly}
${lettering}

${schedule}
</svg>`;

export const sheet2 = {
  num: 2, id: 'companions', rev: 'E',
  title: 'THE BRICK ASSEMBLY',
  sub: `ALTITUDE 2 — one baseplate, ${WORD[BRICKS.length]} bricks, ${TOT_F} authored files · an exploded LEGO assembly with every coupling named to the API call that makes it, brick and stud faces drawn opaque so nothing reads through a mass in front of it · REV E 2026-09-27: all ${WORD[BRICKS.length]} runtime companions stand on the plate — brick 1 lies long side to the rail’s far seats, bricks ${listOf(ON1)} step up over its cap, and brick ${BRIDGE} bridges to brick 4, whose plate comes in beside the client plate so one brick can reach both · source ${COUNTED}`,
  scale: `${WORD[BRICKS.length].toUpperCase()} PACKAGES`,
  form: 'BRICK ASSEMBLY',
  svg,
  caption: `Every companion drawn here enters through a published stud — on @uirouter/core, or on a brick that publishes one of its own. Drawn exploded, the sheet answers the only question that matters about a plugin architecture: pull any brick off and what breaks? Only what stands on it — ${WORD[ON1.length]} bricks seat on lit-ui-router, one of them on the server too — and the plate’s studs stay where they are.`,
  notes: `
<p><strong>Why bricks.</strong> The mechanism these packages share is a <em>standardised coupling</em>: each companion attaches through a published extension point — on <code>@uirouter/core</code>, or on a brick below it that publishes one — and any brick nothing stands on can be left in the box without disturbing the rest. That is a stud, and a stud is worth drawing. So this is an exploded isometric — the LEGO instruction manual's own idiom — with a numbered part per package, a drop line onto the exact stud it takes, and a parts callout. Nothing is drawn seated, because a seated assembly hides the undersides, and the undersides are the argument.</p>
<p><strong>The plate is core, not this package.</strong> Sheet 4's finding decides it: every limb in the family declares <code>@uirouter/core</code> as a peer. <code>lit-ui-router</code> is therefore brick 1, not the ground — and the drawing is honest about the one place the metaphor strains: <code>class UIRouterLit extends UIRouter</code> is moulded onto the plate, not snapped to it. What the drawing then shows is that the graft is thin anyway. Everything Lit-specific arrives through two published seams — <code>this.plugin(servicesPlugin)</code> and <code>this.stateRegistry.decorator('views', litViewsBuilder)</code> — plus <code>urlService.listen()/sync()</code> to start the thing. Three calls, and one internal seam — <code>viewService._pluginapi._viewConfigFactory('lit', …)</code> — that core does not publish. That is the whole renderer coupling.</p>
<p><strong>One stud is a seat, not a socket.</strong> <code>router.plugin()</code> is the back rail: a single method that anything may queue on, which is why the spare-parts box is drawn at all — <code>@uirouter/visualizer</code>, <code>sticky-states</code>, <code>dsr</code> and <code>rx</code> all register through it and none of them knows this repo exists. One seat on that rail is ringed red, because it behaves differently: a router holds <em>exactly one</em> location plugin, so <code>ui-router-navigation-location-plugin</code> is a <em>swap</em> for core's <code>pushStateLocation</code>, never an addition. That package peers <code>@uirouter/core</code> and nothing else — it has never heard of Lit, and would work identically under the React or Angular adapters.</p>
<p><strong>Brick 1 publishes two studs of its own, and ${WORD[ON1.length]} bricks take them.</strong> <code>lit-ui-router-mobx</code> and <code>lit-ui-router-effect</code> both seat through <code>UIRouterLitElement.seekRouter(host)</code> — stud F, a bubbling <code>ui-router-context</code> event, published precisely as the dependency-injection primitive for external reactivity systems — and then reach the plate directly, each with one <code>transitionService.onSuccess({}, …)</code> hook per router whose handler reads <code>globals.current</code>, <code>globals.params</code> and the last successful transition: into MobX observables through <code>RouterStore.attach()</code>, into one Effect <code>SubscriptionRef</code> through <code>routeRef()</code>. Both observe; neither writes router state. ${fmt(B(3).sloc)} and ${fmt(B(5).sloc)} lines, one stud on the brick below and two on the plate. <code>lit-ui-router-ssr</code> takes the other, stud G: <code>lit-ui-router/context</code>, the community <code>context-request</code> protocol spoken without <code>@lit/context</code>. <code>prerender()</code> provides the router on the render root with <code>provideRouter()</code> and scopes each render with <code>withRouterSync()</code>, its <code>UiViewRenderer</code> reads that scope with <code>getScopedRouter()</code>, and on the client the served view it defines — <code>withServedRender(UiView)</code>, brick 1's own view class extended — wakes on <code>requestContext(adoptUiViewContext)</code>, which <code>hydrateRoot()</code> answers with <code>provideContext()</code>.</p>
<p><strong>The fourth brick has no stud on the client plate, and that is the design.</strong> <code>ui-router-server</code> declares <code>@uirouter/core</code> as an <em>optional</em> peer (<code>peerDependenciesMeta</code>); its default <code>'matcher'</code> tier is dependency-free pattern matching and never loads core, and its <code>'simulate'</code> tier reaches a plate of its own behind a lazy <code>import()</code> — <code>new UIRouter()</code> with <code>servicesPlugin</code> and <code>memoryLocationPlugin</code>, built fresh per resolution because core mutates registrations. Drawing it over a dashed second plate is the only truthful placement: it is the same mould, a different assembly, and the tie back to the client plate is crossed out. It does carry a stud of its own, H — <code>createServerRouter({ mounts })</code>, whose <code>resolve(path)</code> returns a verdict.</p>
<p><strong>Brick ${BRIDGE} is the bridge.</strong> <code>lit-ui-router-ssr</code> peers <code>lit-ui-router</code> ${peerRange(row6.name, 'lit-ui-router')} <em>and</em> <code>ui-router-server</code> ${peerRange(row6.name, 'ui-router-server')}, and it is the one part in the family that takes a drop line onto each of this sheet's two assemblies: G on brick 1, H on brick 4. <code>prerender()</code> compiles the mount table with <code>createServerRouter()</code>, asks it for a verdict per path, and turns shell verdicts into pages, redirects into host rules and the <code>otherwise</code> projection into the 404 document. It never reaches the second plate's studs itself — that plate is ui-router-server's to load or not. Its other two peers, <code>@lit-labs/ssr</code> ${peerRange(row6.name, '@lit-labs/ssr')} and <code>@lit-labs/ssr-client</code> ${peerRange(row6.name, '@lit-labs/ssr-client')}, are a render table, not a router plate, so they take no stud here.</p>
<p><strong>Massing, quantized.</strong> Continuous mass would have made these bricks unbuildable shapes, so the census is rounded to LEGO: <em>plan</em> is one stud per 150 sloc rounded up to the next standard shape (1×1, 1×2, 2×2, 2×3, 2×4), <em>height</em> is one course per three authored files. The result is legible and it is a finding — the two bricks that carry a renderer and a server are 2×4s, and the prerender bridge between them a 2×3; the ${WORD[TILES.length]} that plug the router into something are ${tileShapes} tile${TILES.length > 1 ? 's' : ''}, ${listOf(TILES.map((b) => fmt(b.sloc)))} lines. A companion that needed to be a 2×4 would be <code>lit-ui-router</code>'s problem to absorb, not a package. The baseplate is deliberately <em>not</em> massed: ${CORE[2]} files and ${fmt(CORE[3])} lines of core is ground, and ground has no height.</p>
<p><strong>${WORD[FAMILY.length][0].toUpperCase() + WORD[FAMILY.length].slice(1)} published packages; ${WORD[BRICKS.length]} bricks in this assembly.</strong> Every runtime companion is drawn. The ${['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][FAMILY.length]} package, <code>eslint-plugin-lit-ui-router</code> ${LINT.version} (${LINT.files} files, ${fmt(LINT.sloc)} sloc), is not a brick at all: it takes no stud on any router plate, because it couples to ESLint and oxlint, not to <code>@uirouter/core</code>. Every number on this sheet is read from <code>www/atlas.lit-ui-router.dev/data/census-bricks.json</code> — ${COUNTED}.</p>`,
  key: [
    keyRow('<polygon points="4,12 16,5 30,12 30,16 16,9 4,16" class="sk fp"/><ellipse cx="10" cy="8" rx="4" ry="2.3" class="sk fp2"/><ellipse cx="24" cy="8" rx="4" ry="2.3" class="sk fp2"/>', 'a published package — plan ∝ quantized sloc, courses ∝ files'),
    keyRow('<ellipse cx="24" cy="9" rx="6" ry="3.5" class="ska fp"/><ellipse cx="24" cy="9" rx="11" ry="6.5" class="ska fnone"/>', 'a stud — a published extension point, on core or on a brick'),
    keyRow('<ellipse cx="24" cy="9" rx="6" ry="3.5" class="skr fp"/><ellipse cx="24" cy="9" rx="11" ry="6.5" class="skr fnone"/>', 'the location seat — exactly one per router, so it swaps'),
    keyRow('<line x1="24" y1="2" x2="24" y2="16" class="ska" stroke-dasharray="6 4"/><circle cx="24" cy="16" r="2.2" class="fa"/>', 'drop line — the brick falls onto that stud'),
    keyRow('<rect x="4" y="4" width="40" height="11" class="sks fnone" stroke-dasharray="6 4"/>', 'a second plate — optional peer, reached by lazy import'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="skf" stroke-dasharray="5 4"/><circle cx="23" cy="9" r="6" class="skr fp"/><line x1="19" y1="13" x2="27" y2="5" class="skr"/>', 'no coupling — the server takes no stud on this plate'),
    keyRow('<polygon points="8,12 16,7 26,12 26,15 16,10 8,15" class="sks fp" stroke-dasharray="3 2"/>', 'spare part — same stud, not in this set (sheet 4)'),
  ].join('\n'),
};

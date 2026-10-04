import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, lines, isoPt, keyRow } from './helpers.mjs';
import { brickKit, seated } from './brick-iso.mjs';
import { seatedBoxes } from './brick-glb.mjs';

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
const SRV_NODE = JSON.parse(readFileSync(new URL('../../../packages/ui-router-server/package.json', import.meta.url), 'utf8')).engines.node;
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
  { n: 1, name: 'lit-ui-router', hue: '#D8A33A' },
  { n: 2, name: 'ui-router-navigation-location-plugin', disp: 'navigation-location-plugin', hue: '#5B8E4B' },
  { n: 3, name: 'lit-ui-router-mobx', hue: '#D26E2C' },
  { n: 4, name: 'ui-router-server', hue: '#3E8A8B' },
  { n: 5, name: 'lit-ui-router-effect', hue: '#7B5B9F' },
  { n: 6, name: 'lit-ui-router-ssr', hue: '#4C86C6' },
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

// ---- iso brick geometry: the kit at this sheet's pitch --------------------------------
// A plan circle projects to an AXIS-ALIGNED ellipse under this iso, so a stud is one
// ellipse plus a swept side wall; z0 > 0 leaves a brick hovering, which is the exploded view.
const { U, CRS, PT, SH, RY, pt, p2, face, brick, plate } = brickKit({ U: 40, p: P });

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
const OX = 440, OY = 468;                 // @uirouter/core baseplate, 8 x 6 studs
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
// Brick 1 hovers six courses: its underside clears the plate's back edge by two
// courses on screen, or the tower reads as standing on the ground behind the plate.
const LIT = [160, 0, 144];     // 1 — its drop is the one at the back-right seat, clear of its own face
const NAV = [0, 0, 128];       // 2 — over the LOCATION SEAT
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
const SPY = 672;
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
<!-- lifted 3 px when ssr's brick grew to four courses (#1010, #1020) -->
${txt(696, 51, `${B(6).name} ${B(6).ver}`, 'lblb')}
${txt(696, 63, stats(B(6)), 'lblf')}
${txt(696, 75, 'SEATS ON BRICK 1 — G · context-request', 'lbla')}
${txt(696, 87, 'AND ON BRICK 4 — H · createServerRouter()', 'lbla')}
${txt(696, 99, 'the bridge — a drop line onto each assembly', 'lblf')}

${badge(974, 452, 4, 'ska fp', 'lbla')}
${txt(990, 456, `${B(4).name} ${B(4).ver}`, 'lblb')}
${txt(990, 468, stats(B(4)), 'lblf')}
${txt(990, 480, 'STUDS A′ · D′ — on a plate of its own', 'lbla')}
${txt(990, 492, 'carries H — createServerRouter()', 'lbla')}

<!-- the plate itself -->
${txt(40, 514, `${CORE[0]} ${CORE[1]} — THE BASEPLATE`, 'lblb')}
${txt(40, 526, `${CORE[2]} files · ${fmt(CORE[3])} sloc · not massed`, 'lblf')}
${txt(40, 538, 'a plate is ground: every brick peers it,', 'lblf')}
${txt(40, 550, 'and no brick may replace it', 'lblf')}
${leader(236, 532, 330, 572)}

<!-- named studs, labelled off the plate -->
${txt(40, 576, 'A   router.plugin(factory)', 'lbla')}
${txt(40, 588, 'one method, not eight slots:', 'lblf')}
${txt(40, 600, 'bricks queue on it', 'lblf')}
${leader(206, 574, 505, 514)}

${txt(340, 788, 'D   urlService', 'lbla')}
${txt(340, 800, '.listen() · .sync() · .rules — brick 1', 'lblf')}
${txt(340, 812, 'starts and syncs the client router', 'lblf')}
${leader(346, 778, 303, 600)}

${txt(540, 788, 'C   transitionService', 'lbla')}
${txt(540, 800, '.onSuccess({}, …) — one hook per router', 'lblf')}
${txt(540, 812, 'from each of bricks 3 and 5', 'lblf')}
${leader(546, 778, 372, 640)}

${txt(760, 788, 'E   globals', 'lbla')}
${txt(760, 800, '.current · .params · the last transition', 'lblf')}
${txt(760, 812, 'bricks 3 and 5 mirror them, never write', 'lblf')}
${leader(766, 778, 581, 680)}

${txt(780, 734, 'B   stateRegistry', 'lbla')}
${txt(780, 746, '.decorator(‘views’, litViewsBuilder)', 'lblf')}
${txt(780, 758, 'the one graft that renders Lit', 'lblf')}
${leader(776, 730, 650, 640)}

<!-- the absent coupling -->
<line x1="682.5" y1="636" x2="786.4" y2="576" class="skf" stroke-dasharray="5 4"/>
<circle cx="734.4" cy="606" r="9" class="skr fp"/>
<line x1="728" y1="612.4" x2="740.8" y2="599.6" class="skr"/>
${txt(920, 694, 'ui-router-server takes NO stud on this plate —', 'lblr')}
${txt(920, 706, '@uirouter/core is an OPTIONAL peer for it', 'lblr')}

${txt(1044, 544, 'THE SECOND PLATE — the same core, headless', 'lbls')}
${txt(1044, 556, 'peerDependenciesMeta marks core optional;', 'lblf')}
${txt(1044, 568, 'simulate.ts does new UIRouter() + plugin(', 'lblf')}
${txt(1044, 580, 'servicesPlugin) + plugin(memoryLocationPlugin),', 'lblf')}
${txt(1044, 592, 'reached only through a lazy import — so the', 'lblf')}
${txt(1044, 604, 'default ‘matcher’ tier, the one brick 6 drives', 'lblf')}
${txt(1044, 616, 'by default, ships with no plate at all', 'lblf')}

${txt(700, 848, `bricks ${listOf(ON1)} seat on brick 1 and ${listOf(ON4)} on brick 4 too — every brick-to-brick joint is a seam the lower brick publishes`, 'lbla', 'middle')}`;


// ---- the finished model: the same parts, seated ----------------------------------------
// The landscape has two levels: browser ground under the client plate, and a server
// shelf under the headless plate. Brick 6 seats on brick 1's cap AND on brick 4's, so
// the shelf stands exactly as many courses up as the caps need to meet, and the plate's
// origin is the one plan point that puts stud H under the bridge.
const P2 = [SSR_REACH[0] - B4_SEAT[0], SSR_REACH[1] - B4_SEAT[1]];
const P2_UP = B(1).courses - B(4).courses;
if (P2_UP < 1) throw new Error('sheet2: brick 4’s cap would stand above brick 1’s — the bridge cannot seat on both');
const GROUND = CRS;   // the browser ground, one course of landscape under the client plate
const MODEL = [
  { id: 'G1', kind: 'ground', x: -20, y: -20, ws: 9, ds: 7, h: GROUND },
  { id: 'P1', kind: 'plate', x: 0, y: 0, ws: 8, ds: 6, on: 'G1', named: NAMED },
  { id: 1, kind: 'brick', x: LIT[0], y: LIT[1], ws: B(1).shape[1], ds: B(1).shape[0], courses: B(1).courses, hue: B(1).hue, on: 'P1', rings: ['0,1', '2,1', '3,0'] },
  { id: 2, kind: 'brick', x: NAV[0], y: NAV[1], ws: B(2).shape[0], ds: B(2).shape[1], courses: B(2).courses, hue: B(2).hue, on: 'P1' },
  { id: 3, kind: 'brick', x: MBX[0], y: MBX[1], ws: B(3).shape[0], ds: B(3).shape[1], courses: B(3).courses, hue: B(3).hue, on: 1 },
  { id: 5, kind: 'brick', x: EFF[0], y: EFF[1], ws: B(5).shape[0], ds: B(5).shape[1], courses: B(5).courses, hue: B(5).hue, on: 1 },
  { id: 'G2', kind: 'ground', x: P2[0] - 20, y: P2[1] - 20, ws: 5, ds: 5, h: GROUND + P2_UP * CRS },
  { id: 'P2', kind: 'plate', x: P2[0], y: P2[1], ws: 4, ds: 4, on: 'G2', dash: '6 4', edge: 'sks', named: SRV_NAMED },
  { id: 4, kind: 'brick', x: P2[0], y: P2[1], ws: B(4).shape[0], ds: B(4).shape[1], courses: B(4).courses, hue: B(4).hue, on: 'P2', rings: ['0,3'] },
  { id: 6, kind: 'brick', x: SSR[0], y: SSR[1], ws: B(6).shape[1], ds: B(6).shape[0], courses: B(6).courses, hue: B(6).hue, on: 1 },
];
// The model in the round reads the same parts, and its explosion is this sheet's own:
// each brick lifts from its seat to its exploded hover, both measured from its plate.
export const BRICK_MODEL = MODEL;
export const BRICK_ROWS = BRICKS;
export const BRICK_COUPLES = COUPLES;
const HOVER = new Map([[1, LIT[2]], [2, NAV[2]], [3, MBX[2]], [4, srvZ0], [5, EFF[2]], [6, SSR[2]]]);
const SEATED = new Map(seatedBoxes(MODEL).map((b) => [b.m.id, b]));
const plateOf = (m) => (m.kind === 'plate' ? m : plateOf(MODEL.find((o) => o.id === m.on)));
export const EXPLODE = new Map([...HOVER].map(([n, z]) => {
  const b = SEATED.get(n), lift = z - (b.z0 - SEATED.get(plateOf(b.m).id).z0);
  if (!(lift > 0)) throw new Error(`sheet2: brick ${n} hovers at ${z} but seats at ${b.z0} — the explosion would sink it`);
  return [n, lift];
}));
const pick = (ids) => MODEL.filter((m) => ids.includes(m.id));
const STEPS = [
  [pick(['G1', 'P1', 1, 2]), ['STEP 1 — brick 1 takes the rail,', 'brick 2 the location seat']],
  [pick(['G1', 'P1', 1, 2, 3, 5]), [`STEP 2 — bricks ${listOf(ON1.filter((n) => n !== BRIDGE))} seat on`, 'brick 1’s cap, stud F']],
  [MODEL, [`STEP 3 — brick ${BRIDGE} seats on G and on H:`, 'the bridge spans the no-DOM line']],
].map(([parts, cap]) => ({ fig: seated(parts, { U: 14, p: P }), cap }));
// the whole from two more corners: the opposite one, and the server side (turn 1), where
// the dashed plate and brick 4 stand in front and the bridge lands on them
const WHOLES = [
  [2, [`THE WHOLE, FROM THE OPPOSITE CORNER — brick ${BRIDGE} is the bridge; the free rail seats stay ringed`]],
  [1, ['THE WHOLE, FROM THE SERVER SIDE — the optional peer in place: the headless plate, dashed,', `on its shelf under brick 4, and brick ${BRIDGE} seated on H`]],
].map(([turn, cap]) => ({ fig: seated(MODEL, { U: 22, turn, p: P }), cap }));
const BAND_Y = 862;
const ROW1_TOP = BAND_Y + 44;
const ROW1_BOTTOM = ROW1_TOP + Math.max(...STEPS.map((s) => s.fig.h));
let sx = 40;
const steps = STEPS.map(({ fig, cap }) => {
  const g = `${fig.at(sx, ROW1_BOTTOM - fig.h)}\n${lines(sx + 8, ROW1_BOTTOM + 16, cap, 'lblf', 'start', 12)}`;
  sx += Math.max(fig.w, 236) + 24;   // a slot holds its caption
  return g;
}).join('\n');
const ROW2_TOP = ROW1_BOTTOM + 60;
const ROW2_BOTTOM = ROW2_TOP + Math.max(...WHOLES.map((w) => w.fig.h));
const wholes = WHOLES.map(({ fig, cap }, i) => {
  const x = i ? 1360 - fig.w : 40;
  return `${fig.at(x, ROW2_BOTTOM - fig.h)}\n${lines(i ? 1352 : 48, ROW2_BOTTOM + 16, cap, 'lblf', i ? 'end' : 'start', 12)}`;
}).join('\n');
// the two grounds, lettered between the wholes
const GX = 700;
const grounds = `${txt(GX, ROW2_TOP + 60, 'TWO LEVELS OF GROUND', 'lbls', 'middle')}
${txt(GX, ROW2_TOP + 80, 'the browser — the DOM, one course of', 'lblf', 'middle')}
${txt(GX, ROW2_TOP + 92, 'ground under the client plate', 'lblf', 'middle')}
${txt(GX, ROW2_TOP + 112, `the server shelf — a request runtime with no DOM (node ${SRV_NODE};`, 'lblf', 'middle')}
${txt(GX, ROW2_TOP + 124, 'Connect, Vite, fetch and Hono adapters), standing', 'lblf', 'middle')}
${txt(GX, ROW2_TOP + 136, `${WORD[P2_UP]} courses higher, because brick 4’s cap must meet`, 'lblf', 'middle')}
${txt(GX, ROW2_TOP + 148, `brick 1’s for brick ${BRIDGE} to seat on both`, 'lblf', 'middle')}
${txt(GX, ROW2_TOP + 168, 'the headless plate is dashed on its shelf: an optional', 'lblf', 'middle')}
${txt(GX, ROW2_TOP + 180, 'peer, reached by lazy import — the ground is real', 'lblf', 'middle')}`;
const finishedBand = `${txt(40, BAND_Y + 22, 'THE FINISHED MODEL — the same parts seated in a landscape of two levels: three steps at the drawing’s own corner, then the whole from two more', 'lbls')}
${leader(40, BAND_Y + 30, 1360, BAND_Y + 30)}
${steps}
${wholes}
${grounds}`;

// ---- structure schedule ------------------------------------------------------------------
const ART_H = ROW2_BOTTOM + 56;
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
if (BIG.join() !== '1,4,6' || TILES.map((b) => b.n).join() !== '2,3,5')
  throw new Error(`sheet2: the massing note names 1, 4 and 6 as the 2×4s and 2, 3, 5 as the tiles — re-word it (2×4s ${BIG}, tiles ${TILES.map((b) => b.n)})`);
const tileShapes = (() => {
  const by = new Map();
  for (const b of TILES) by.set(shapeName(b.shape), (by.get(shapeName(b.shape)) ?? 0) + 1);
  return listOf([...by].map(([s, k]) => (k === 1 ? `a ${s}` : `${WORD[k]} ${s}s`)));
})();

const svg = `<svg viewBox="0 0 1400 ${SY + 110 + ROWS.length * 17}" role="img" aria-label="An exploded isometric LEGO assembly. A large flat baseplate lettered @uirouter/core carries a grid of studs; its whole back row is ringed in the accent colour and labelled A, router.plugin — the plugin rail. ${WORD[BRICKS.length][0].toUpperCase() + WORD[BRICKS.length].slice(1)} bricks hover above it, none of them seated, each with a dashed accent drop line falling onto the exact stud it takes. Brick 1, lit-ui-router, is a two-by-four ${B(1).courses} courses tall, laid long side to the rail over its far seats, and drops onto the rail; brick 2, the navigation location plugin, is a one-by-one one course tall and drops onto the rail's first stud, ringed in red — the location seat, of which a router has exactly one, so this brick swaps core's own location plugin rather than adding to it. Three bricks drop onto ringed studs on top of brick 1 instead of onto the plate, stepped in height so no brick hides another's fall: brick 5, lit-ui-router-effect, and brick 3, lit-ui-router-mobx, both one-by-twos two courses tall, take the seam lettered F, seekRouter, and reach the plate's named studs C transitionService and E globals for the hook they register and the values they read; brick 6, lit-ui-router-ssr, a two-by-three three courses tall, takes the seam lettered G, the context-request protocol, and is a bridge — its far end hangs over a second, smaller baseplate drawn entirely in dashed line at the right, where a second drop line falls onto a ringed stud lettered H on brick 4, ui-router-server, createServerRouter. A dashed tie between the two plates is crossed out with a red circle and slash — the server takes no stud on the client plate, because @uirouter/core is an optional peer for it and its default matcher tier never loads a plate at all. Named studs along the front of the plate are lettered below it, and a stud schedule at the upper right explains all eight seams. A parts callout at the upper left lists the ${WORD[BRICKS.length]} bricks with their shapes, and a dashed spare-parts box at the lower left shows four ghost one-by-one bricks — visualizer, sticky-states, dsr and rx — that would register through the very same stud A. Beneath the exploded view the same parts are drawn seated: three small steps at the same corner — brick 1 and brick 2 on the plate, bricks 3 and 5 on brick 1's cap, then brick 6 bridging to brick 4 — and the finished model from two more corners, the opposite one and the server side. The seated model stands on a landscape of two levels: a low slab of browser ground under the client plate, and a raised shelf of server ground under the dashed second plate, four courses higher so that brick 6 reads as a bridge from the tall brick across to brick 4, spanning the no-DOM line. A structure schedule beneath the drawing gives every brick its file count, line count, quantized shape and the exact API call it couples through.">
${defs(P)}

${txt(1370, 16, 'SCALE — plan = whole studs (1 stud per 150 sloc, rounded up to the next standard brick shape) · height = one course per 3 authored files · the baseplate is not massed', 'lbls', 'end')}
${txt(1370, 30, 'COUPLING IS THE SUBJECT — accent marks a published extension point; the bricks themselves are drawn plain', 'lblf', 'end')}

${partsBox}
${spareBox}
${studBox}

${assembly}
${lettering}
${finishedBand}

${schedule}
</svg>`;

export const sheet2 = {
  num: 2, id: 'companions', rev: 'F',
  title: 'THE BRICK ASSEMBLY',
  sub: `ALTITUDE 2 — one baseplate, ${WORD[BRICKS.length]} bricks, ${TOT_F} authored files · an exploded LEGO assembly with every coupling named to the API call that makes it, brick and stud faces drawn opaque so nothing reads through a mass in front of it · REV F 2026-10-04: the finished model joins the exploded view — the same parts seated in three steps at the drawing’s own corner, then the whole from two more corners, in a landscape of two levels — browser ground under the client plate, a server shelf under the headless plate — so the bridge spans the no-DOM line · source ${COUNTED}`,
  scale: `${WORD[BRICKS.length].toUpperCase()} PACKAGES`,
  form: 'BRICK ASSEMBLY',
  svg,
  caption: `Every companion drawn here enters through a published stud — on @uirouter/core, or on a brick that publishes one of its own. Drawn exploded, the sheet answers the only question that matters about a plugin architecture: pull any brick off and what breaks? Only what stands on it — ${WORD[ON1.length]} bricks seat on lit-ui-router, one of them on the server too — and the plate’s studs stay where they are.`,
  notes: `
<p><strong>Why bricks.</strong> The mechanism these packages share is a <em>standardised coupling</em>: each companion attaches through a published extension point — on <code>@uirouter/core</code>, or on a brick below it that publishes one — and any brick nothing stands on can be left in the box without disturbing the rest. That is a stud, and a stud is worth drawing. So this is an exploded isometric — the LEGO instruction manual's own idiom — with a numbered part per package, a drop line onto the exact stud it takes, and a parts callout. The exploded view seats nothing, because a seated assembly hides the undersides, and the undersides are the argument; the finished model under it is drawn seated for the other half of the reading — the shape the parts make — in three steps at the drawing's own corner and then whole from two more, on a landscape of two levels: browser ground under the client plate, and a server shelf under the headless one.</p>
<p><strong>The plate is core, not this package.</strong> Sheet 4's finding decides it: every limb in the family declares <code>@uirouter/core</code> as a peer. <code>lit-ui-router</code> is therefore brick 1, not the ground — and the drawing is honest about the one place the metaphor strains: <code>class UIRouterLit extends UIRouter</code> is moulded onto the plate, not snapped to it. What the drawing then shows is that the graft is thin anyway. Everything Lit-specific arrives through two published seams — <code>this.plugin(servicesPlugin)</code> and <code>this.stateRegistry.decorator('views', litViewsBuilder)</code> — plus <code>urlService.listen()/sync()</code> to start the thing. Three calls, and one internal seam — <code>viewService._pluginapi._viewConfigFactory('lit', …)</code> — that core does not publish. That is the whole renderer coupling.</p>
<p><strong>One stud is a seat, not a socket.</strong> <code>router.plugin()</code> is the back rail: a single method that anything may queue on, which is why the spare-parts box is drawn at all — <code>@uirouter/visualizer</code>, <code>sticky-states</code>, <code>dsr</code> and <code>rx</code> all register through it and none of them knows this repo exists. One seat on that rail is ringed red, because it behaves differently: a router holds <em>exactly one</em> location plugin, so <code>ui-router-navigation-location-plugin</code> is a <em>swap</em> for core's <code>pushStateLocation</code>, never an addition. That package peers <code>@uirouter/core</code> and nothing else — it has never heard of Lit, and would work identically under the React or Angular adapters.</p>
<p><strong>Brick 1 publishes two studs of its own, and ${WORD[ON1.length]} bricks take them.</strong> <code>lit-ui-router-mobx</code> and <code>lit-ui-router-effect</code> both seat through <code>UIRouterLitElement.seekRouter(host)</code> — stud F, a bubbling <code>ui-router-context</code> event, published precisely as the dependency-injection primitive for external reactivity systems — and then reach the plate directly, each with one <code>transitionService.onSuccess({}, …)</code> hook per router whose handler reads <code>globals.current</code>, <code>globals.params</code> and the last successful transition: into MobX observables through <code>RouterStore.attach()</code>, into one Effect <code>SubscriptionRef</code> through <code>routeRef()</code>. Both observe; neither writes router state. ${fmt(B(3).sloc)} and ${fmt(B(5).sloc)} lines, one stud on the brick below and two on the plate. <code>lit-ui-router-ssr</code> takes the other, stud G: <code>lit-ui-router/context</code>, the community <code>context-request</code> protocol spoken without <code>@lit/context</code>. <code>prerender()</code> provides the router on the render root with <code>provideRouter()</code> and scopes each render with <code>withRouterSync()</code>, its <code>UiViewRenderer</code> reads that scope with <code>getScopedRouter()</code>, and on the client the served view it defines — <code>withServedRender(UiView)</code>, brick 1's own view class extended — wakes on <code>requestContext(adoptUiViewContext)</code>, which <code>hydrateRoot()</code> answers with <code>provideContext()</code>.</p>
<p><strong>The fourth brick has no stud on the client plate, and that is the design.</strong> <code>ui-router-server</code> declares <code>@uirouter/core</code> as an <em>optional</em> peer (<code>peerDependenciesMeta</code>); its default <code>'matcher'</code> tier is dependency-free pattern matching and never loads core, and its <code>'simulate'</code> tier reaches a plate of its own behind a lazy <code>import()</code> — <code>new UIRouter()</code> with <code>servicesPlugin</code> and <code>memoryLocationPlugin</code>, built fresh per resolution because core mutates registrations. Drawing it over a dashed second plate is the only truthful placement: it is the same mould, a different assembly, and the tie back to the client plate is crossed out. Seated, that plate stands on a shelf of its own: server ground, a request runtime with no DOM (node ${SRV_NODE}; Connect, Vite, fetch and Hono adapters), drawn ${WORD[P2_UP]} courses above the browser ground because brick ${BRIDGE} must meet brick 4's cap at the height of brick 1's. The plate on it is dashed — an optional peer, reached by lazy import — and the ground is not. It does carry a stud of its own, H — <code>createServerRouter({ mounts })</code>, whose <code>resolve(path)</code> returns a verdict.</p>
<p><strong>Brick ${BRIDGE} is the bridge.</strong> <code>lit-ui-router-ssr</code> peers <code>lit-ui-router</code> ${peerRange(row6.name, 'lit-ui-router')} <em>and</em> <code>ui-router-server</code> ${peerRange(row6.name, 'ui-router-server')}, and it is the one part in the family that takes a drop line onto each of this sheet's two assemblies: G on brick 1, H on brick 4. <code>prerender()</code> compiles the mount table with <code>createServerRouter()</code>, asks it for a verdict per path, and turns shell verdicts into pages, redirects into host rules and the <code>otherwise</code> projection into the 404 document. It never reaches the second plate's studs itself — that plate is ui-router-server's to load or not. Its other two peers, <code>@lit-labs/ssr</code> ${peerRange(row6.name, '@lit-labs/ssr')} and <code>@lit-labs/ssr-client</code> ${peerRange(row6.name, '@lit-labs/ssr-client')}, are a render table, not a router plate, so they take no stud here.</p>
<p><strong>Massing, quantized.</strong> Continuous mass would have made these bricks unbuildable shapes, so the census is rounded to LEGO: <em>plan</em> is one stud per 150 sloc rounded up to the next standard shape (1×1, 1×2, 2×2, 2×3, 2×4), <em>height</em> is one course per three authored files. The result is legible and it is a finding — the ${WORD[BIG.length]} bricks that carry a renderer, a server and the prerender bridge between them are all 2×4s; the ${WORD[TILES.length]} that plug the router into something are ${tileShapes} tile${TILES.length > 1 ? 's' : ''}, ${listOf(TILES.map((b) => fmt(b.sloc)))} lines. A plug that needed to be a 2×4 would be <code>lit-ui-router</code>'s problem to absorb, not a package. The baseplate is deliberately <em>not</em> massed: ${CORE[2]} files and ${fmt(CORE[3])} lines of core is ground, and ground has no height.</p>
<p><strong>${WORD[FAMILY.length][0].toUpperCase() + WORD[FAMILY.length].slice(1)} published packages; ${WORD[BRICKS.length]} bricks in this assembly.</strong> Every runtime companion is drawn. The ${['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][FAMILY.length]} package, <code>eslint-plugin-lit-ui-router</code> ${LINT.version} (${LINT.files} files, ${fmt(LINT.sloc)} sloc), is not a brick at all: it takes no stud on any router plate, because it couples to ESLint and oxlint, not to <code>@uirouter/core</code>. Every number on this sheet is read from <code>www/atlas.lit-ui-router.dev/data/census-bricks.json</code> — ${COUNTED}.</p>`,
  key: [
    keyRow('<polygon points="4,12 16,5 30,12 30,16 16,9 4,16" class="sk fp"/><ellipse cx="10" cy="8" rx="4" ry="2.3" class="sk fp2"/><ellipse cx="24" cy="8" rx="4" ry="2.3" class="sk fp2"/>', 'a published package — plan ∝ quantized sloc, courses ∝ files'),
    keyRow('<ellipse cx="24" cy="9" rx="6" ry="3.5" class="ska fp"/><ellipse cx="24" cy="9" rx="11" ry="6.5" class="ska fnone"/>', 'a stud — a published extension point, on core or on a brick'),
    keyRow('<ellipse cx="24" cy="9" rx="6" ry="3.5" class="skr fp"/><ellipse cx="24" cy="9" rx="11" ry="6.5" class="skr fnone"/>', 'the location seat — exactly one per router, so it swaps'),
    keyRow('<line x1="24" y1="2" x2="24" y2="16" class="ska" stroke-dasharray="6 4"/><circle cx="24" cy="16" r="2.2" class="fa"/>', 'drop line — the brick falls onto that stud'),
    keyRow('<rect x="4" y="4" width="40" height="11" class="sks fnone" stroke-dasharray="6 4"/>', 'a second plate — optional peer, reached by lazy import'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="skf" stroke-dasharray="5 4"/><circle cx="23" cy="9" r="6" class="skr fp"/><line x1="19" y1="13" x2="27" y2="5" class="skr"/>', 'no coupling — the server takes no stud on this plate'),
    keyRow('<polygon points="8,12 16,7 26,12 26,15 16,10 8,15" class="sks fp" stroke-dasharray="3 2"/>', 'spare part — same stud, not in this set (sheet 4)'),
    keyRow('<polygon points="4,8 16,2 44,9 44,15 16,8 4,14" class="sk fp"/>', 'ground — the browser, and a server shelf above the no-DOM line'),
  ].join('\n'),
};

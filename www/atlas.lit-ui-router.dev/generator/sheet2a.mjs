import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, keyRow, npmUrl, schedule, face, leader, dimH, dimV, rad, nb } from './helpers.mjs';
import { COMPILE_TIME } from './sheet2.mjs';
import { PITCH, CRS, PT, SH, SR, SEG } from './brick-glb.mjs';
import { brickKit } from './brick-iso.mjs';
import { CORD_CAP, capTop, cordKit } from './connector-iso.mjs';

const P = 's2a';

// ---- census: authored source read from www/atlas.lit-ui-router.dev/data/census-bricks.json --------
// Same basis as sheets 2/3/4: .ts/.tsx/.js/.mjs under src/, excl. *.d.ts,
// *.{spec,test}.*, specs/ and typedoc stubs.  sloc = scc Code lines.
const B = JSON.parse(readFileSync(new URL('../data/census-bricks.json', import.meta.url), 'utf8'));
const brick = (name) => {
  const r = B.rows.find((r) => r.name === name);
  if (!r) throw new Error(`census-bricks.json: no row for ${name}`);
  return [r.name, r.version, r.files, r.sloc];
};
const CORE = brick('@uirouter/core');
const LIT = brick('lit-ui-router');
const NAV = brick('ui-router-navigation-location-plugin');
const MBX = brick('lit-ui-router-mobx');
const SRV = brick('ui-router-server');
const EFF = brick('lit-ui-router-effect');
const SSR = brick('lit-ui-router-ssr');
const SIG = brick('lit-ui-router-signals');
const USG = brick('ui-router-signals');
const UEF = brick('ui-router-effect');
const UMX = brick('ui-router-mobx');
const fmt = (v) => v.toLocaleString('en-US');
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const Cap = (w) => w[0].toUpperCase() + w.slice(1);
// every block drawn here; the plate holds every census row but the wall and sheet 2's compile-time parts
const DRAWN = [LIT, NAV, MBX, SRV, EFF, SSR, SIG, UEF, USG, UMX];
{
  const plate = B.rows.map((r) => r.name).filter((n) => n !== CORE[0] && !COMPILE_TIME.some((c) => c.name === n)).sort();
  const drawn = DRAWN.map(([n]) => n).sort();
  if (plate.join() !== drawn.join()) throw new Error(`sheet 2A: census-bricks.json carries [${plate}] but the plan draws [${drawn}] — place the newcomer`);
}
// the two smallest companions on the plate, by their census moulds
const SMALLEST = DRAWN.map(([name]) => B.rows.find((r) => r.name === name)).sort((a, b) => a.sloc - b.sloc).slice(0, 2).map((r) => r.shape.replace('x', '×'));
const SMALL_SHAPES = SMALLEST[0] === SMALLEST[1] ? `both ${SMALLEST[0]}` : `${SMALLEST[0]} and ${SMALLEST[1]}`;

// census-couplings.json supplies every range lettered on a companion-to-companion joint
const COUPLINGS = JSON.parse(readFileSync(new URL('../data/census-couplings.json', import.meta.url), 'utf8'));
const peerRange = (from, to) => {
  const r = COUPLINGS.rows.find((x) => x.from === from && x.to === to && x.kind === 'peer');
  if (!r) throw new Error(`census-couplings.json: no peer row ${from} → ${to}`);
  return r.range;
};
const EFF_LIT = peerRange('lit-ui-router-effect', 'lit-ui-router');
const EFF_UEF = peerRange('lit-ui-router-effect', 'ui-router-effect');
const SSR_LIT = peerRange('lit-ui-router-ssr', 'lit-ui-router');
const SSR_SRV = peerRange('lit-ui-router-ssr', 'ui-router-server');
const SIG_LIT = peerRange('lit-ui-router-signals', 'lit-ui-router');
const SIG_USG = peerRange('lit-ui-router-signals', 'ui-router-signals');
const MBX_LIT = peerRange('lit-ui-router-mobx', 'lit-ui-router'), MBX_UMX = peerRange('lit-ui-router-mobx', 'ui-router-mobx');
// the companion-to-companion joints, every peer row with both ends on this plate
const ON_PLATE = new Set(DRAWN.map(([n]) => n));
const CC = COUPLINGS.rows.filter((r) => r.kind === 'peer' && ON_PLATE.has(r.from) && ON_PLATE.has(r.to));
const CC_FROM = [...new Set(CC.map((r) => r.from))];
const CC_SPAN = CC_FROM.filter((f) => CC.filter((r) => r.from === f).length > 1);
if (CC.length !== 8 || CC_SPAN.join() !== 'lit-ui-router-effect,lit-ui-router-mobx,lit-ui-router-signals,lit-ui-router-ssr')
  throw new Error(`sheet 2A: the drawing letters eight companion-to-companion joints and four two-armed companions (effect, mobx, signals, ssr); the census peers ${CC.length}: ${CC.map((r) => `${r.from} → ${r.to}`).join(', ')}`);
// the renderer-free blocks: a joint lands on them, and they peer nothing on the plate
const AGN = DRAWN.map(([n]) => n).filter((n) => n !== SRV[0] && n !== LIT[0] && CC.some((r) => r.to === n) && !CC.some((r) => r.from === n));
if (AGN.join() !== 'ui-router-effect,ui-router-signals,ui-router-mobx') throw new Error(`sheet 2A: the plan hangs ui-router-effect, ui-router-signals and ui-router-mobx off their Lit bindings, but the plate's renderer-free peers are [${AGN}]`);
// the cover index's fit verdict, told from the joints the plan draws
export const SHEET2A_VERDICT = `alternate plate — the same joints at reading size: ${WORD[CC.length]} companion-to-companion joints from ${WORD[CC_FROM.length]} companions, ${WORD[CC_SPAN.length]} of them two-armed, and ssr's arm bridges the flagship and the server across the no-DOM line`;
// a block's registry page, the name checked against the plate first
const npmLink = (name, text = `<code>${name}</code>`) => `<a href="${npmUrl(brick(name)[0])}">${text}</a>`;
// the homes the notes name off the plate: core's plugins, the protocol, the manifest field
const HOME = {
  visualizer: npmUrl('@uirouter/visualizer'),
  sticky: npmUrl('@uirouter/sticky-states'),
  dsr: npmUrl('@uirouter/dsr'),
  rx: npmUrl('@uirouter/rx'),
  protocol: 'https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md',
  peerMeta: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-json#peerdependenciesmeta',
};

// ---- shallow extrusion ----------------------------------------------------------
// Blocks get just enough depth to read as solids (constant DX/DY — depth carries no
// data); every coupling is drawn at reading size, disengaged, so both mating faces show.
const DX = 16, DY = 9;

function slab(x, y, w, h, { edge = 'sk', side = `url(#${P}-hx)`, front = 'fp', dash = '' } = {}) {
  const da = dash ? ` stroke-dasharray="${dash}"` : '';
  const top = `${x},${y} ${x + w},${y} ${x + w + DX},${y - DY} ${x + DX},${y - DY}`;
  const right = `${x + w},${y} ${x + w + DX},${y - DY} ${x + w + DX},${y + h - DY} ${x + w},${y + h}`;
  return `<polygon points="${top}" fill="var(--paper-2)"/>
<polygon points="${top}" class="${edge} fnone"${da}/>
<polygon points="${right}" fill="var(--paper)"/>
<polygon points="${right}" fill="${side}"/>
<polygon points="${right}" class="${edge} fnone"${da}/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${edge} ${front}"${da}/>`;
}

// ---- coupling geometry: the subject of the plate --------------------------------
const WX = 480;            // the socket wall — core's right front edge

// A published stud: protrudes right from the wall, lettered on the face.
const stud = (cy, letter) => `<rect x="${WX}" y="${cy - 9}" width="30" height="18" rx="7" class="ska fp"/>
<circle cx="462" cy="${cy}" r="10" class="ska fp"/>${txt(462, cy + 3.6, letter, 'lbla', 'middle')}`;

// A companion plug: C-mouth (jaw 8, opening 22, depth 20) + arm back to its block.
// Drawn 18px short of seated; the dashed centreline is the engagement.
const plug = (cy, bx, cls = 'ska') => `<line x1="512" y1="${cy}" x2="526" y2="${cy}" class="${cls}" stroke-dasharray="3 3"/>
<path d="M556,${cy - 19} h-28 v8 h20 v22 h-20 v8 h28 z" class="${cls} fp2"/>
<rect x="556" y="${cy - 8}" width="${bx - 556}" height="16" class="${cls} fp2"/>`;

// Coupling label, ON the connection: bold call above the arm, gloss beneath it.
const cpl = (cy, l1, l2, c1 = 'lbla', c2 = 'lblf') => `${txt(562, cy - 27, l1, c1)}
${txt(562, cy - 15, l2, c2)}`;

// A face note just left of the stud's letter badge.
const fnote = (cy, s, cls = 'lblf', xe = 446) => txt(xe, cy + 3, s, cls, 'end');

const badge = (x, y, n) => `<circle cx="${x}" cy="${y}" r="9.5" class="ska fp"/>${txt(x, y + 3.6, String(n), 'lbla', 'middle')}`;

// ---- stud rows on the wall (top to bottom) ---------------------------------------
const B_Y = 175, D_Y = 240, A1_Y = 325, RED_Y = 395, C_Y = 490, E_Y = 550;
// block 10 stands in the C/E plug run, its left face clear of the C call's lettering
const UMX_B = [810, 462, 110, 96], MBX_B = [990, 460, 136, 120], MBX_JOINT_Y = 520;

const wallCouplings = `
<!-- B · stateRegistry — brick 1 -->
${stud(B_Y, 'B')}${plug(B_Y, 820)}
${cpl(B_Y, 'stateRegistry.decorator(‘views’,', 'litViewsBuilder) — the render graft')}
${fnote(B_Y, 'the views builder — the whole Lit graft')}

<!-- D · urlService — brick 1 -->
${stud(D_Y, 'D')}${plug(D_Y, 820)}
${cpl(D_Y, 'urlService.listen() · .sync()', 'the client router starts here')}
${fnote(D_Y, 'brick 1 starts & syncs the client')}

<!-- A · the rail; seat 1 taken by brick 1 -->
<line x1="445" y1="290" x2="445" y2="420" class="ska"/>
<line x1="441" y1="290" x2="449" y2="290" class="ska"/>
<line x1="441" y1="420" x2="449" y2="420" class="ska"/>
${txt(436, 297, 'A · router.plugin( ) — THE RAIL', 'lbla', 'end')}
${txt(436, 309, 'one method, any number of seats', 'lblf', 'end')}
${txt(436, 352, 'free seats queue here: visualizer ·', 'lblf', 'end')}
${txt(436, 364, 'sticky-states · dsr · rx (sheet 4)', 'lblf', 'end')}
<rect x="${WX}" y="${A1_Y - 9}" width="30" height="18" rx="7" class="ska fp"/>
${plug(A1_Y, 820)}
${cpl(A1_Y, 'router.plugin(servicesPlugin)', 'seat 1 of rail A')}

<!-- the LOCATION SEAT: a keyed recess, not a stud — one per router, so a SWAP -->
<path d="M480,${RED_Y - 11} h-16 v22 h16" class="skr fp2"/>
<line x1="482" y1="${RED_Y}" x2="498" y2="${RED_Y}" class="skr" stroke-dasharray="3 3"/>
<rect x="500" y="${RED_Y - 9}" width="48" height="18" rx="5" class="skr fp"/>
<rect x="514" y="${RED_Y - 14}" width="12" height="5" class="skr fp"/>
<rect x="548" y="${RED_Y - 8}" width="232" height="16" class="skr fp2"/>
${cpl(RED_Y, 'THE LOCATION SEAT — one per router:', 'the Navigation API swaps core’s OUT', 'lblr', 'lblr')}
${txt(436, RED_Y - 4, 'exactly ONE location plugin per router', 'lblr', 'end')}
<path d="M466,412 C458,422 452,426 444,430" class="skr" stroke-dasharray="4 3" marker-end="url(#${P}-ar)"/>
<rect x="390" y="432" width="48" height="18" rx="5" class="skr fnone" stroke-dasharray="4 3"/>
${txt(384, 444, 'pushStateLocation — swapped OUT', 'lblr', 'end')}

<!-- C · transitionService — block 10 -->
${stud(C_Y, 'C')}${plug(C_Y, UMX_B[0])}
${cpl(C_Y, 'transitionService.onSuccess({}, update)', 'one hook per router')}
${fnote(C_Y, 'memoised by RouterStore.for()')}

<!-- E · globals — block 10 -->
${stud(E_Y, 'E')}${plug(E_Y, UMX_B[0])}
${cpl(E_Y, 'globals.current · .params', 'observed — never written')}
${fnote(E_Y, 'mirrored, never written')}`;

// ---- the blocks -------------------------------------------------------------------
// Front-face area roughly proportional to sloc (~35 px² per line); the two smallest
// companions are clamped up to a legible minimum.  Depth is constant and inert.
const coreBlock = `${slab(120, 120, 360, 520)}
${txt(140, 150, `${CORE[0]} ${CORE[1]} — THE SOCKET WALL`, 'lblb')}
${txt(140, 164, `${CORE[2]}f · ${fmt(CORE[3])} sloc — peered by all, replaced by none`, 'lblf')}`;

const litBlock = `${slab(820, 140, 290, 200)}
${badge(806, 128, 1)}
${txt(832, 166, `${LIT[0]} ${LIT[1]}`, 'lblb')}
${txt(832, 180, `${LIT[2]}f · ${fmt(LIT[3])} sloc`, 'lblf')}
${txt(832, 194, 'class UIRouterLit extends UIRouter —', 'lblf')}
${txt(832, 208, 'moulded onto the wall, not snapped', 'lblf')}
${txt(832, 226, 'PLUGS  B · D · A(seat 1)', 'lbla')}
${txt(1036, 330, 'its own stud ↓', 'lblf', 'end')}
<rect x="1041" y="340" width="18" height="30" rx="6" class="ska fp"/>`;

const navBlock = `${slab(780, 355, 156, 90)}
${badge(766, 347, 2)}
${txt(792, 381, 'ui-router-navigation-', 'lblb')}
${txt(792, 395, `location-plugin ${NAV[1]}`, 'lblb')}
${txt(792, 409, `${NAV[2]}f · ${fmt(NAV[3])} sloc · core only —`, 'lblf')}
${txt(792, 421, 'it has never heard of Lit', 'lblf')}
${txt(792, 437, 'PLUG  THE LOCATION SEAT', 'lblr')}`;

// The brick-to-brick seat: lit's stud points down, mobx's socket opens up.
const mbxBlock = `<line x1="1050" y1="372" x2="1050" y2="438" class="ska" stroke-dasharray="4 3"/>
${slab(...MBX_B)}
<path d="M${1050 - 19},460 v-20 h8 v12 h22 v-12 h8 v20 z" class="ska fp2"/>
${badge(966, 470, 3)}
${txt(1002, 498, `${MBX[0]}`, 'lblb')}
${txt(1002, 512, `${MBX[1]} · ${MBX[2]}f · ${fmt(MBX[3])} sloc`, 'lblf')}
${txt(1002, 528, 'PLUGS  blocks 1 · 10', 'lbla')}
${txt(1002, 542, 'no hook of its own', 'lblf')}
${txt(996, 600, `peers block 10 ${MBX_UMX}`, 'lbla')}
${txt(1075, 398, 'seekRouter(host)', 'lbla')}
${txt(1075, 410, 'the ui-router-context event', 'lblf')}
${txt(1075, 422, 'the seat under block 1', 'lblf')}`;

// A joint off a COMPANION's face: the same stud-gap-mouth idiom as the wall, at 0.8 scale.
const jointStud = (x, cy) => `<rect x="${x}" y="${cy - 9}" width="30" height="18" rx="7" class="ska fp"/>
<line x1="${x + 32}" y1="${cy}" x2="${x + 46}" y2="${cy}" class="ska" stroke-dasharray="3 3"/>`;
const jointMouth = (x, cy) => `<path d="M${x},${cy - 16} h-22 v7 h15 v18 h-15 v7 h22 z" class="ska fp2"/>`;

// The three right-face arms are nested L's: the highest stud's arm turns down farthest out.
const VW = 1620;
const SSR_Y = 175, EFF_Y = 270, SIG_Y = 324;
// parallel rails keep RAIL_MIN apart, 12 screen px at the 1107 px measure
const SIG_COL = 1236, EFF_COL = 1440, SSR_COL = 1556, RAIL_MIN = Math.ceil((12 * VW) / 1107);
// each Lit binding stands over the renderer-free block it plugs: [x, y, w, h]
const SIG_B = [1160, 446, 140, 74], USG_B = [1160, 600, 140, 74];
const EFF_B = [1356, 446, 140, 74], UEF_B = [1356, 600, 158, 74];
const SSR_B = [1316, 775, 280, 120], SRV_B = [300, 775, 290, 140];
const armL = (cy, col, bottom) => `<rect x="1178" y="${cy - 8}" width="${col + 16 - 1178}" height="16" class="ska fp2"/>
<rect x="${col}" y="${cy - 8}" width="16" height="${bottom - cy + 8}" class="ska fp2"/>`;
// A stud on a block's top face, plugged from the underside of the block above it.
const upJoint = (cx, bot, top) => `<path d="M${cx - 19},${bot} v20 h8 v-12 h22 v12 h8 v-20 z" class="ska fp2"/>
<line x1="${cx}" y1="${bot + 22}" x2="${cx}" y2="${top - 36}" class="ska" stroke-dasharray="4 3"/>
<rect x="${cx - 9}" y="${top - 34}" width="18" height="30" rx="6" class="ska fp"/>`;
const block = ([x, y, w, h], n, lines) => `${slab(x, y, w, h)}
${badge(x - 14, y - 8, n)}
${lines.map(([s, cls], i) => txt(x + 12, y + 22 + i * 14 + (i > 1 ? 2 : 0), s, cls)).join('\n')}`;
// arms and columns may touch only the blocks they join
{
  const env = ([x, y, w, h]) => [x, y - DY, x + w + DX, y + h];
  const MASS = { 1: [820, 140, 290, 200], 2: [780, 355, 156, 90], 3: MBX_B, 4: SRV_B, 5: EFF_B, 6: SSR_B, 7: SIG_B, 8: UEF_B, 9: USG_B, 10: UMX_B };
  const ARMS = [
    ['ssr arm', [1178, SSR_Y - 8, SSR_COL + 16 - 1178, 16], [1, 6]], ['ssr column', [SSR_COL, SSR_Y - 8, 16, SSR_B[1] - SSR_Y + 8], [1, 6]],
    ['effect arm', [1178, EFF_Y - 8, EFF_COL + 16 - 1178, 16], [1, 5]], ['effect column', [EFF_COL, EFF_Y - 8, 16, EFF_B[1] - EFF_Y + 8], [1, 5]],
    ['signals arm', [1178, SIG_Y - 8, SIG_COL + 16 - 1178, 16], [1, 7]], ['signals column', [SIG_COL, SIG_Y - 8, 16, SIG_B[1] - SIG_Y + 8], [1, 7]],
    ['mobx joint', [UMX_B[0] + UMX_B[2], MBX_JOINT_Y - 9, MBX_B[0] - UMX_B[0] - UMX_B[2], 18], [3, 10]],
    ...[['ssr', SSR_Y, 6], ['effect', EFF_Y, 5], ['signals', SIG_Y, 7]].map(([name, cy, n]) => [`${name} mouth`, [1156, cy - 16, 22, 32], [1, n]]),
  ];
  const cut = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 0 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 0;
  const box = ([x, y, w, h]) => [x, y, x + w, y + h];
  const clear = ([x, y, w, h]) => [x - RAIL_MIN, y - RAIL_MIN, x + w + RAIL_MIN, y + h + RAIL_MIN];
  for (const [name, r, ends] of ARMS) {
    for (const [n, m] of Object.entries(MASS)) if (!ends.includes(+n) && cut(clear(r), env(m))) throw new Error(`sheet 2A: the ${name} runs within ${RAIL_MIN} of block ${n}`);
    for (const [other, o, oends] of ARMS) if (oends.join() !== ends.join() && cut(clear(r), box(o))) throw new Error(`sheet 2A: the ${name} runs within ${RAIL_MIN} of the ${other}`);
  }
}

// brick 6 — the bridge: the highest arm, down the right of the sheet across the no-DOM line
const ssrBridge = `${jointStud(1110, SSR_Y)}${jointMouth(1178, SSR_Y)}
${armL(SSR_Y, SSR_COL, SSR_B[1])}
${txt(1184, SSR_Y - 14, `peers lit-ui-router ${SSR_LIT}`, 'lbla')}
${txt(SSR_COL - 8, 740, 'the bridge crosses the line', 'lbla', 'end')}`;

const ssrBlock = `${slab(...SSR_B)}
${badge(SSR_B[0] - 14, SSR_B[1] - 8, 6)}
${txt(SSR_B[0] + 12, 801, `${SSR[0]} ${SSR[1]}`, 'lblb')}
${txt(SSR_B[0] + 12, 815, `${SSR[2]}f · ${fmt(SSR[3])} sloc`, 'lblf')}
${txt(SSR_B[0] + 12, 831, 'PLUGS  BOTH — the flagship and the server', 'lbla')}
${txt(SSR_B[0] + 12, 845, 'the one part that reaches across', 'lblf')}
${txt(SSR_B[0] + 12, 857, 'the no-DOM line', 'lblf')}`;

// blocks 5 and 8 — the effect binding, the middle arm, over the renderer-free ref it plugs
const effPair = `${jointStud(1110, EFF_Y)}${jointMouth(1178, EFF_Y)}
${armL(EFF_Y, EFF_COL, EFF_B[1])}
${txt(1184, EFF_Y - 14, `peers lit-ui-router ${EFF_LIT}`, 'lbla')}
${block(EFF_B, 5, [[EFF[0], 'lblb'], [`${EFF[1]} · ${EFF[2]}f · ${fmt(EFF[3])} sloc`, 'lblf'], ['PLUGS  blocks 1 · 8', 'lbla'], ['no hook of its own', 'lblf']])}
${upJoint(EFF_B[0] + 24, EFF_B[1] + EFF_B[3], UEF_B[1])}
${txt(EFF_B[0] + 50, EFF_B[1] + EFF_B[3] + 38, `peers block 8 ${EFF_UEF}`, 'lbla')}
${block(UEF_B, 8, [[UEF[0], 'lblb'], [`${UEF[1]} · ${UEF[2]}f · ${fmt(UEF[3])} sloc`, 'lblf'], ['TAPS  C · E', 'lbla'], ['routeRef( ) · snapshotRoute( )', 'lblf']])}`;

// blocks 7 and 9 — the signals binding, the lowest arm, over the renderer-free signals it plugs
const sigPair = `${jointStud(1110, SIG_Y)}${jointMouth(1178, SIG_Y)}
${armL(SIG_Y, SIG_COL, SIG_B[1])}
${txt(SIG_COL - 8, SIG_Y + 28, 'peers lit-ui-router', 'lbla', 'end')}
${txt(SIG_COL - 8, SIG_Y + 40, `${SIG_LIT} · seekRouter( )`, 'lblf', 'end')}
${block(SIG_B, 7, [[SIG[0], 'lblb'], [`${SIG[1]} · ${SIG[2]}f · ${fmt(SIG[3])} sloc`, 'lblf'], ['PLUGS  blocks 1 · 9', 'lbla'], ['no hook of its own', 'lblf']])}
${upJoint(SIG_B[0] + 24, SIG_B[1] + SIG_B[3], USG_B[1])}
${txt(SIG_B[0] + 50, SIG_B[1] + SIG_B[3] + 38, `peers block 9 ${SIG_USG}`, 'lbla')}
${block(USG_B, 9, [[USG[0], 'lblb'], [`${USG[1]} · ${USG[2]}f · ${fmt(USG[3])} sloc`, 'lblf'], ['TAPS  C · E', 'lbla'], ['RouterSignals.for( )', 'lblf']])}`;

// blocks 8 and 9 take the studs block 10 plugs: a dashed tap back to the E plug, the outer block's run under the inner
const tapEnd = (x) => `<circle cx="${x}" cy="562" r="2.2" class="fa"/>`;
const taps = `<path d="M${USG_B[0]},${USG_B[1] + 40} H790 V562" class="ska fnone" stroke-dasharray="4 3"/>${tapEnd(790)}
<path d="M${UEF_B[0] + 110},${UEF_B[1] + UEF_B[3]} V${UEF_B[1] + UEF_B[3] + 18} H${USG_B[0] - 10} V${USG_B[1] + 52} H775 V562" class="ska fnone" stroke-dasharray="4 3"/>${tapEnd(775)}
${txt(765, 600, 'taps C · E — as block 10 does', 'lblf', 'end')}`;

// block 10 — the renderer-free store on the C/E plugs, its face stud peered by block 3
const umxPair = `${block(UMX_B, 10, [[UMX[0], 'lblb'], [`${UMX[1]} · ${UMX[2]}f · ${fmt(UMX[3])} sloc`, 'lblf'], ['PLUGS  C · E', 'lbla'], ['RouterStore.for( )', 'lblf']])}
${jointStud(UMX_B[0] + UMX_B[2], MBX_JOINT_Y)}${jointMouth(MBX_B[0], MBX_JOINT_Y)}`;

// the server's own face carries the bridge's second stud
const srvJoint = `${jointStud(590, 790)}${jointMouth(660, 790)}
<rect x="660" y="782" width="${SSR_B[0] - 660}" height="16" class="ska fp2"/>
${txt(666, 772, `peers ui-router-server ${SSR_SRV}`, 'lbla')}`;

// ---- context: the browser and DOM slabs, held faint -------------------------------------
const context = `${slab(120, 48, 360, 44, { edge: 'skf', side: 'var(--paper)' })}
${txt(132, 68, 'BROWSER URL / HISTORY', 'lblb')}
${txt(132, 82, 'whoever holds the LOCATION SEAT speaks to it', 'lblf')}
<path d="M300,94 V116" class="sks" marker-end="url(#${P}-as)"/>
${slab(120, 668, 360, 44, { edge: 'skf', side: 'var(--paper)' })}
${txt(132, 688, 'DOM', 'lblb')}
${txt(132, 702, 'the rendered <ui-view> tree', 'lblf')}
<path d="M300,642 V664" class="sks" marker-end="url(#${P}-as)"/>`;

// ---- server lane: the coupling that is not there -----------------------------------
const serverLane = `<line x1="100" y1="746" x2="${SSR_COL + 60}" y2="746" class="skf" stroke-dasharray="8 5"/>
${txt(120, 738, 'no DOM below this line', 'lblf')}
${slab(300, 775, 290, 140)}
${badge(284, 762, 4)}
${txt(312, 801, `${SRV[0]} ${SRV[1]}`, 'lblb')}
${txt(312, 815, `${SRV[2]}f · ${fmt(SRV[3])} sloc`, 'lblf')}
${txt(312, 829, 'adapters: connect · fetch · hono · vite', 'lblf')}
${txt(312, 843, 'tiers: ‘matcher’ (dep-free) · ‘simulate’', 'lblf')}
<rect x="130" y="805" width="140" height="60" class="skf fp"/>
${txt(142, 830, 'REQUEST', 'lblb')}
${txt(142, 846, 'GET /people/32', 'lbls')}
<path d="M272,835 H296" class="sk" marker-end="url(#${P}-ai)"/>
<rect x="640" y="805" width="160" height="60" class="skf fp"/>
${txt(652, 830, 'DECISION', 'lblb')}
${txt(652, 846, '302 · render · pass', 'lbls')}
<path d="M610,835 H636" class="sk" marker-end="url(#${P}-ai)"/>
<path d="M497,628 C560,665 585,700 572,768" class="sks fnone" stroke-dasharray="5 4"/>
<circle cx="566" cy="700" r="10" class="skr fp"/>
<line x1="559.5" y1="706.5" x2="572.5" y2="693.5" class="skr"/>
${txt(600, 690, 'NO COUPLING — core is an OPTIONAL peer for the server', 'lblr')}
${txt(600, 703, 'the default ‘matcher’ tier is dependency-free and never loads the wall', 'lblf')}
${txt(600, 716, '‘simulate’ lazy-imports walls of its own — a prewarmed pool per mount, its config replayed', 'lblf')}
${txt(300, 940, 'peerDependenciesMeta: { ‘@uirouter/core’: { optional: true } } — the tie is drawn only to be crossed out', 'lblr')}`;

// ---- the mould: one 2×2 brick in third-angle, every dimension a code in THE MOULD ----------
// the values are brick-glb's and connector-iso's identifiers, so a changed mould moves the drawing and its schedule together
const ISO_RX = +(SR * Math.SQRT2 * Math.cos(Math.PI / 6)).toFixed(2), ISO_RY = +(SR * Math.SQRT2 * Math.sin(Math.PI / 6)).toFixed(2);
const MOULD_ROWS = [
  ['P1', 'pitch — stud centre to stud centre', PITCH, 'plan units'],
  ['C1', 'course — one brick high', CRS, 'plan units'],
  ['P2', 'plate — one baseplate high', PT, 'plan units'],
  ['S1', 'stud height', SH, 'plan units'],
  ['R1', 'stud radius', SR, 'plan units'],
  ['N1', 'stud segments — the round as the model sweeps it', SEG, 'sides'],
  ['K1', 'cord cap height', CORD_CAP.h, 'plan units'],
  ['K2', 'cord cap radius', CORD_CAP.r, 'plan units'],
  ['W1', '2×2 brick side = 2·P1', 2 * PITCH, 'plan units'],
  ['E1', 'edge to stud centre = P1 ÷ 2', PITCH / 2, 'plan units'],
  ['D1', 'stud diameter = 2·R1', 2 * SR, 'plan units'],
  ['H1', 'stud top above the foot = C1 + S1', CRS + SH, 'plan units'],
  ['K3', 'cap top above its seat = K1 + S1', capTop(CORD_CAP), 'plan units'],
  ['I1', 'iso stud ellipse, half-width = R1·√2·cos 30°', ISO_RX, 'plan units'],
  ['I2', 'iso stud ellipse, half-height = R1·√2·sin 30°', ISO_RY, 'plan units'],
];
// the mould's own numbers, before the formulas built on them
const MOULD_BASE = MOULD_ROWS.filter(([, v]) => !v.includes('='));
{
  const kit = brickKit({ U: PITCH, p: P }), cap = cordKit({ U: PITCH, pt: kit.pt });
  const drawn = { P1: kit.U, C1: kit.CRS, P2: kit.PT, S1: kit.SH, K1: cap.cap.h, K2: cap.cap.r, K3: cap.top, I1: kit.RX, I2: kit.RY, R1: cap.cap.stud.r };
  for (const [code, name, value] of MOULD_ROWS)
    if (code in drawn && drawn[code] !== value) throw new Error(`sheet 2A: THE MOULD schedules ${code} (${name}) at ${value}, but the drawn geometry reads ${drawn[code]}`);
  if (cap.cap.stud.h !== SH) throw new Error(`sheet 2A: the cord cap's stud is ${cap.cap.stud.h} high, the brick's ${SH}; the cap detail letters both S1`);
  if (MOULD_BASE.length !== 8) throw new Error(`sheet 2A: THE MOULD carries ${MOULD_BASE.length} base values; the notes count six brick numbers and two cap numbers`);
}
export const MOULD = schedule('THE MOULD', ['Code', 'Variable', 'Value', 'Unit'], MOULD_ROWS, `${MOULD_ROWS.length} codes · read from generator/brick-glb.mjs and generator/connector-iso.mjs`);

// drawn at 2:1 in plan units, under the plan; the views keep third-angle order — top over front, right beside front
const MS = 2, VH = 1366;
const m = { p1: PITCH * MS, c1: CRS * MS, p2: PT * MS, s1: SH * MS, r1: SR * MS, k1: CORD_CAP.h * MS, k2: CORD_CAP.r * MS };
const MW = 2 * m.p1;
const PY = 990, TX = 520, TY = PY + 40;
const FY = TY + MW + 44, FB = FY + m.s1, FF = FB + m.c1;
const RV = TX + MW + 64, SX = RV + MW + 90, CX = SX + MW + 130, TITLE_Y = FF + 50;
const centre = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="skf" stroke-dasharray="10 3 2 3"/>`;
const studXs = (x0) => [0, 1].map((i) => x0 + (i + 0.5) * m.p1);
// a brick in elevation: the body one course high, its two studs standing on it
const elevation = (x0) => `<rect x="${x0}" y="${FB}" width="${MW}" height="${m.c1}" class="sk fp"/>
${studXs(x0).map((cx) => `<rect x="${cx - m.r1}" y="${FY}" width="${2 * m.r1}" height="${m.s1}" class="sk fp2"/>`).join('\n')}`;
const viewTitle = (cx, y, s) => txt(cx, y, s, 'lbls', 'middle');

const topView = `${txt(120, PY + 10, 'THE MOULD — ONE 2×2 BRICK, ONE COURSE, THIRD-ANGLE', 'lblb')}
${txt(120, PY + 24, 'every code is a row in THE MOULD under the plate', 'lblf')}
<rect x="${TX}" y="${TY}" width="${MW}" height="${MW}" class="sk fp"/>
${studXs(TX).map((cx) => centre(cx, TY - 8, cx, TY + MW + 8)).join('\n')}
${centre(TX - 8, TY + 1.5 * m.p1, TX + MW + 8, TY + 1.5 * m.p1)}
${[0, 1].flatMap((j) => studXs(TX).map((cx) => `<circle cx="${cx}" cy="${TY + (j + 0.5) * m.p1}" r="${m.r1}" class="sk fp2"/>`)).join('\n')}
<line x1="${TX - 16}" y1="${TY + m.p1 / 2}" x2="${TX + MW + 16}" y2="${TY + m.p1 / 2}" class="ska" stroke-dasharray="14 4 3 4"/>
${[TX - 16, TX + MW + 16].map((x) => `<line x1="${x}" y1="${TY + m.p1 / 2}" x2="${x}" y2="${TY + m.p1 / 2 - 14}" class="sks" marker-end="url(#${P}-as)"/>${txt(x, TY + m.p1 / 2 - 20, 'A', 'lblb', 'middle')}`).join('\n')}
${dimH(P, TX, TX + m.p1, TY - 18, TY, null, 'P1')}${dimH(P, TX + m.p1, TX + MW, TY - 18, null, TY, 'P1')}
${dimV(P, TY, TY + MW, TX - 36, TX, TX, 'W1')}
${rad(TX + 1.5 * m.p1 + m.r1, TY + 1.5 * m.p1 - m.r1, m.r1, 'tr', 'R1', 26)}
${nb(TX + MW + 18, TY + MW - 8, 4)}
${viewTitle(TX + MW / 2, TY + MW + 22, 'TOP · SCALE 2:1 · plan units')}`;

const frontView = `${elevation(TX)}
${dimV(P, FY, FB, TX - 18, TX + m.p1 / 2 - m.r1, null, 'S1', { side: 'l' })}${dimV(P, FB, FF, TX - 18, null, TX, 'C1', { side: 'l' })}
${dimV(P, FY, FF, TX - 52, TX + m.p1 / 2 - m.r1, TX, 'H1')}
${nb(TX + MW + 16, (FB + FF) / 2, 1)}
${viewTitle(TX + MW / 2, TITLE_Y, 'FRONT · SCALE 2:1 · plan units')}`;

const rightView = `${elevation(RV)}
<rect x="${RV}" y="${FF}" width="${MW}" height="${m.p2}" class="skf fnone" stroke-dasharray="8 4"/>
${dimV(P, FF, FF + m.p2, RV + MW + 18, RV + MW, RV + MW, 'P2', { side: 'r' })}
${nb(RV - 16, FF + m.p2 / 2, 5)}
${viewTitle(RV + MW / 2, TITLE_Y, 'RIGHT · SCALE 2:1 · plan units')}`;

// the cut runs through the near row of studs: body and studs are one solid, hatched
const cut = [[SX, FF], [SX, FB], ...studXs(SX).flatMap((cx) => [[cx - m.r1, FB], [cx - m.r1, FY], [cx + m.r1, FY], [cx + m.r1, FB]]), [SX + MW, FB], [SX + MW, FF]].map((q) => q.join(',')).join(' ');
const [sc0, sc1] = studXs(SX);
const sectionView = `${face(cut, 'sk', `url(#${P}-hd)`)}
${studXs(SX).map((cx) => centre(cx, FY - 8, cx, FF + 24)).join('\n')}
${dimH(P, sc0 - m.r1, sc0 + m.r1, FY - 14, FY, FY, 'D1')}
${dimH(P, SX, sc0, FF + 18, FF, null, 'E1', { below: true })}${dimH(P, sc0, sc1, FF + 18, null, null, 'P1', { below: true })}${dimH(P, sc1, SX + MW, FF + 18, null, FF, 'E1', { below: true })}
${nb(SX + MW + 16, (FB + FF) / 2, 3)}${nb(SX + MW + 16, FF + 18, 2)}
${viewTitle(SX + MW / 2, TITLE_Y, 'SECTION A–A · SCALE 2:1 · plan units')}`;

// the cap stands on a phantom stud of the brick below it
const CT = FY - m.k1, CS = CT - m.s1;
const capDetail = `<line x1="${CX - 64}" y1="${FB}" x2="${CX + 64}" y2="${FB}" class="skf" stroke-dasharray="8 4"/>
<rect x="${CX - m.r1}" y="${FY}" width="${2 * m.r1}" height="${m.s1}" class="skf fnone" stroke-dasharray="8 4"/>
<rect x="${CX - m.k2}" y="${CT}" width="${2 * m.k2}" height="${m.k1}" class="sk fp"/>
<rect x="${CX - m.r1}" y="${CS}" width="${2 * m.r1}" height="${m.s1}" class="sk fp2"/>
${centre(CX, CS - 26, CX, FB + 8)}
${dimH(P, CX, CX + m.k2, CS - 16, null, CT, 'K2')}
${dimV(P, CS, CT, CX + m.k2 + 20, CX + m.r1, null, 'S1', { side: 'r' })}${dimV(P, CT, FY, CX + m.k2 + 20, null, CX + m.k2, 'K1', { side: 'r' })}
${dimV(P, CS, FY, CX + m.k2 + 62, CX + m.r1, CX + m.k2, 'K3')}
${nb(CX - m.k2 - 18, CT + m.k1 / 2, 6)}
${viewTitle(CX, TITLE_Y, 'CORD CAP · SCALE 2:1 · plan units')}`;

const MOULD_NOTES = [
  [1, 'a brick is P1 a stud each way on plan, C1 a course high'],
  [2, 'studs stand on pitch centres, E1 in from every edge'],
  [3, 'brick and studs are one casting; the cut is hatched'],
  [4, 'a stud is round on plan; the model sweeps it in N1 sides'],
  [5, 'the baseplate under the right view is drawn phantom'],
  [6, 'a cord cap is a round 1×1 plate seated on a stud,'],
  [0, 'its own stud the brick’s: R1 round, S1 high'],
];
const mouldNotes = MOULD_NOTES.map(([n, s], i) => `${n ? nb(126, PY + 54 + i * 18 - 3.5, n) : ''}${txt(142, PY + 54 + i * 18, s, 'lblf')}`).join('\n');

const mouldPanel = `<line x1="100" y1="${PY - 28}" x2="${VW - 24}" y2="${PY - 28}" class="skf"/>
${topView}
${mouldNotes}
${frontView}
${rightView}
${sectionView}
${capDetail}`;

const svg = `<svg viewBox="0 0 ${VW} ${VH}" role="img" aria-label="A coupling plan in shallow three-quarter view, the alternate plate to sheet 2's exploded brick assembly. A tall shallow block at the left, lettered @uirouter/core — the socket wall, carries six connection points down its right edge, each drawn at reading size: lettered studs B, D, C and E protrude from the wall; an accent rail marked A, router.plugin, spans the middle of the edge with one stud on it; and one keyed recess ringed in red is the location seat. The companion blocks sit to the right, drawn just short of seated, each with C-shaped plug mouths reaching toward their studs across a small dashed engagement gap, the exact API call lettered on every connection. Block 1, lit-ui-router, holds three plugs — stateRegistry.decorator, urlService.listen and sync, and seat 1 of the plugin rail — and carries one downward stud of its own. Block 2, the navigation location plugin, holds a single red keyed plug approaching the location seat, while a dashed ghost plug labelled pushStateLocation exits the seat below: a router holds exactly one location plugin, so this coupling is a swap, never an addition. Block 3, lit-ui-router-mobx, opens an upward socket under block 1's stud — seekRouter, the ui-router-context event, the seat under block 1 — and peers a stud on the right face of block 10, ui-router-mobx ${MBX_UMX}, which plugs studs C and E, transitions observed and globals mirrored into MobX observables, never written. Faint slabs above and below the wall mark the browser and the DOM, and below a dashed no-DOM line block 4, ui-router-server, sits in a request-to-decision lane with a dashed tie back up to the wall crossed out in red: core is an optional peer, its matcher tier never loads the wall, and its simulate tier lazily builds a pool of walls of its own per mount. Three arms leave studs on block 1's right face as nested L's, the highest turning down farthest out. Block 6, lit-ui-router-ssr, takes the highest: its arm runs down the right of the sheet, crosses the no-DOM line and meets a second stud on block 4's right face — the only part in the family that declares both the flagship ${SSR_LIT} and the server ${SSR_SRV}, so the only one whose drawing spans both halves of the plate. Block 5, lit-ui-router-effect, takes the middle stud, ${EFF_LIT}, and block 7, lit-ui-router-signals, the lowest, ${SIG_LIT}; each arm turns down onto its block, and each block's underside opens onto a stud on top of the renderer-free block below it — block 8, ui-router-effect ${EFF_UEF}, under block 5, and block 9, ui-router-signals ${SIG_USG}, under block 7. Blocks 8, 9 and 10 peer core and nothing in this repo; block 10 holds the C and E plugs, and a dashed tap runs from blocks 8 and 9 back to its E plug. Below the plan, a panel titled THE MOULD draws one 2×2 brick in third-angle projection — top, front and right views and a hatched section A–A through a row of studs — beside a detail of the cord cap, every dimension lettered by a code the mould schedule under the plate gives.">
${defs(P)}

${txt(VW - 30, 16, `SCALE — front-face area ≈ 35 px² per sloc (census-bricks.json @ ${B.sha}) · the two smallest companions (${SMALL_SHAPES}) are held to a legible minimum · depth is constant and carries no data`, 'lbls', 'end')}

${context}
${coreBlock}
${wallCouplings}
${litBlock}
${navBlock}
${mbxBlock}
${serverLane}
${srvJoint}
${ssrBridge}
${ssrBlock}
${effPair}
${sigPair}
${umxPair}
${taps}
${mouldPanel}
</svg>`;

export const sheet2a = {
  num: '2A', id: 'companions-couplings', rev: 'J',
  title: 'THE COUPLING PLAN',
  sub: `ALTITUDE 2 — ALTERNATE PLATE: the ${WORD[DRAWN.length]} companions sheet 2 schedules, laid out for reading — core central as a socket wall, companions at its right, the server below the no-DOM line — with every coupling drawn disengaged and lettered to its API call · rows read census-bricks.json @ ${B.sha}`,
  scale: `${WORD[DRAWN.length].toUpperCase()} PACKAGES`,
  form: 'COUPLING PLAN',
  svg,
  schedules: [MOULD],
  caption: `The brick assembly, uncoupled and brought down to one elevation: core as a socket wall, companions as shallow blocks drawn just short of seated, and each of the six connection points on the wall — five published studs and one keyed red seat — large enough to letter its API call on the joint itself. ${Cap(WORD[CC.length])} more joints are companion-to-companion, and one of those spans both halves of the plate.`,
  notes: `
<p><strong>This plate is the legibility companion to sheet 2.</strong> The exploded assembly (sheet 2, THE BRICK ASSEMBLY) shows the whole stack and where every brick falls; this plate isolates the couplings and draws each one at reading size. The arrangement answers to reading rather than to assembly — core central, companions at its right, the server in a request lane below the no-DOM line — and the packages are shallow solids, so the recovered space goes entirely to the joints.</p>
<p><strong>Every joint is drawn disengaged.</strong> A seated plug hides both mating faces, so nothing here is seated: each stud on the wall stops 18px short of its plug’s mouth, the dashed centreline is the engagement, and the call that makes the coupling — <code>stateRegistry.decorator('views', litViewsBuilder)</code>, <code>urlService.listen()/.sync()</code>, <code>router.plugin(servicesPlugin)</code>, <code>transitionService.onSuccess({}, update)</code>, <code>globals.current/.params</code> — is lettered on the connection itself, not in a schedule at the edge of the sheet.</p>
<p><strong>One connection point is a seat, not a stud, and it is drawn as a keyed recess.</strong> A router holds exactly <em>one</em> location plugin, so ${npmLink('ui-router-navigation-location-plugin')} does not add to the wall — it <em>swaps</em>: its keyed red plug approaches the LOCATION SEAT while a dashed ghost plug, core’s own <code>pushStateLocation</code>, leaves it. The rail above behaves the opposite way: <code>router.plugin()</code> is one method with any number of seats, which is where <a href="${HOME.visualizer}"><code>visualizer</code></a>, <a href="${HOME.sticky}"><code>sticky-states</code></a>, <a href="${HOME.dsr}"><code>dsr</code></a> and <a href="${HOME.rx}"><code>rx</code></a> would queue (sheet 4).</p>
<p><strong>The seat under the flagship gets its own axis.</strong> ${npmLink('lit-ui-router-mobx')} takes it: its upward socket waits under a stud on <code>lit-ui-router</code>’s underside — <code>seekRouter(host)</code>, the bubbling <code>ui-router-context</code> event it falls back to when no <a href="${HOME.protocol}"><code>context-request</code></a> provider answers — and it holds no hook of its own: it takes <code>RouterStore.for()</code> from ${npmLink('ui-router-mobx')} ${MBX_UMX} (block 10) through a stud on that block's face, and reacts to the store, never a write.</p>
<p><strong>${Cap(WORD[CC.length])} joints never touch the wall, and one of them spans the sheet.</strong> They come from ${WORD[CC_FROM.length]} companions, and ${WORD[CC_SPAN.length]} of those reach two blocks. <code>lit-ui-router-mobx</code> reaches two: the seat under block 1, ${MBX_LIT}, and a stud on block 10's face, ${MBX_UMX}. The other three leave studs on block 1's right face as nested L's, the highest arm turning down farthest out, so no arm crosses another. ${npmLink('lit-ui-router-ssr')} (block 6, ${SSR[2]} files, ${fmt(SSR[3])} sloc) takes the highest: it peers ${npmLink('lit-ui-router')} ${SSR_LIT} <em>and</em> ${npmLink('ui-router-server')} ${SSR_SRV}, so its arm runs down the right edge of the plate, crosses the no-DOM line, and meets a second stud on block 4's face below it. Nothing else here crosses; a package that prerenders Lit for a server router is exactly the thing that would. ${npmLink('lit-ui-router-effect')} (block 5, ${EFF[2]} files, ${fmt(EFF[3])} sloc) takes the middle stud, ${EFF_LIT}, and plugs a stud on top of ${npmLink('ui-router-effect')} ${EFF_UEF}, whose <code>routeRef()</code> and <code>snapshotRoute()</code> it re-exports and binds to a Lit host. ${npmLink('lit-ui-router-signals')} (block 7, ${SIG[2]} files, ${fmt(SIG[3])} sloc) takes the lowest, ${SIG_LIT}, and plugs a stud on top of ${npmLink('ui-router-signals')} ${SIG_USG}, whose <code>RouterSignals.for()</code> and <code>watchSelection()</code> it binds to a Lit host. Each binding stands over the block it plugs and holds no hook of its own.</p>
<p><strong>${Cap(WORD[AGN.length])} blocks tap the wall and plug no companion.</strong> <code>ui-router-effect</code> (block 8, ${fmt(UEF[3])} sloc), <code>ui-router-signals</code> (block 9, ${fmt(USG[3])} sloc) and ${npmLink('ui-router-mobx')} (block 10, ${fmt(UMX[3])} sloc) peer <code>@uirouter/core</code> and nothing in this repo: each holds one <code>onSuccess</code> hook on stud C and reads <code>globals</code> on stud E, into an Effect <code>SubscriptionRef</code>, a <code>Signal.State</code> or MobX observables. Block 10 holds the C and E plugs, and a dashed tap runs from blocks 8 and 9 back to its E plug, because those are the studs block 10 plugs: one stud, a hook per consumer. Each carries a stud for its Lit binding — blocks 8 and 9 on the top face, block 10 on its right face, beside block 3 — and the binding plugs it. Sheet 2 seats all ${WORD[AGN.length]} on the plate; this plan seats nothing, so it draws their joints.</p>
<p><strong>The missing coupling is drawn only to be crossed out.</strong> <code>ui-router-server</code> takes no stud: ${npmLink('@uirouter/core')} is an <em>optional</em> peer (<a href="${HOME.peerMeta}"><code>peerDependenciesMeta</code></a>), its default <code>'matcher'</code> tier is dependency-free, and its <code>'simulate'</code> tier lazily imports a wall of its own. Blocks are sized roughly by mass — front-face area ≈ 35 px² per sloc, from <code>census-bricks.json</code> counted at ${B.ref} @ ${B.sha}, which puts <code>lit-ui-router</code> at ${fmt(LIT[3])} sloc — with the two smallest companions (${SMALL_SHAPES}) clamped up to a legible minimum, because at true scale they would be postage stamps, and their smallness is already sheet 2’s finding.</p>
<p><strong>The mould.</strong> Every brick on sheets 2, 2C, 2E and 2F, in the models in the round and in the panel under this plan is cast from six numbers — P1 pitch, C1 course, P2 plate, S1 stud height, R1 stud radius and N1 segments — which live once, as exports of <code>generator/brick-glb.mjs</code>; the cord cap adds two, K1 and K2, in <code>generator/connector-iso.mjs</code>. The panel draws one 2×2 brick from them at 2:1 in third-angle projection, the top over the front and the right beside it, with section A–A cut through a row of studs and the cap on a stud of its own. THE MOULD under the plate reads the same identifiers the drawing does, its derived rows written as formulas, and the sheet throws when a scheduled value and the kit that draws the bricks disagree.</p>`,
  key: [
    keyRow('<rect x="2" y="5" width="20" height="8" rx="3" class="ska fp"/>', 'a published stud on the wall — core’s extension surface, lettered A–E'),
    keyRow('<rect x="2" y="5" width="14" height="8" rx="3" class="ska fp"/><line x1="18" y1="9" x2="26" y2="9" class="ska" stroke-dasharray="3 3"/><path d="M46,2 h-14 v4 h8 v6 h-8 v4 h14 z" class="ska fp2"/>', 'a companion’s plug, drawn just short of seated — both mating faces read'),
    keyRow('<path d="M10,4 h-8 v10 h8" class="skr fp2"/><line x1="12" y1="9" x2="18" y2="9" class="skr" stroke-dasharray="3 3"/><rect x="20" y="5" width="18" height="8" rx="3" class="skr fp"/><rect x="25" y="2" width="7" height="3" class="skr fp"/>', 'the LOCATION SEAT — keyed, one per router: the plug swaps core’s own out'),
    keyRow('<rect x="20" y="1" width="8" height="8" rx="2" class="ska fp"/><path d="M14,17 v-6 h4 v3 h12 v-3 h4 v6 z" class="ska fp2"/>', 'the seat under block 1 — seekRouter( ), the one stud on a block’s underside'),
    keyRow('<line x1="24" y1="16" x2="24" y2="3" class="ska" stroke-dasharray="4 3"/><circle cx="24" cy="3" r="2.2" class="fa"/>', 'a tap — a block that takes a stud another block’s plug is drawn on'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="sks" stroke-dasharray="5 4"/><circle cx="23" cy="9" r="6" class="skr fp"/><line x1="19" y1="13" x2="27" y2="5" class="skr"/>', 'no coupling — the server’s core peer is optional; it never plugs this wall'),
    keyRow('<rect x="4" y="4" width="40" height="11" class="skf fp"/>', 'context, not massed — browser, DOM, the request lane'),
    keyRow(`<rect x="4" y="3" width="40" height="12" fill="var(--paper-2)"/><rect x="4" y="3" width="40" height="12" fill="url(#${P}-hd)"/><rect x="4" y="3" width="40" height="12" class="sk fnone"/>`, 'the cut solid — section A–A through a row of studs, brick and studs one casting'),
    keyRow(`<line x1="6" y1="12" x2="42" y2="12" class="sks" marker-start="url(#${P}-as)" marker-end="url(#${P}-as)"/><line x1="6" y1="4" x2="6" y2="16" class="skf"/><line x1="42" y1="4" x2="42" y2="16" class="skf"/>`, 'a dimension — lettered by its code, the code a row in THE MOULD'),
    keyRow('<line x1="2" y1="9" x2="46" y2="9" class="ska" stroke-dasharray="14 4 3 4"/>', 'the cutting plane A–A, seen in the direction of its arrows'),
  ].join('\n'),
};

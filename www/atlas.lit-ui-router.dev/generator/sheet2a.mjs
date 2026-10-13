import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, keyRow, npmUrl } from './helpers.mjs';

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
const fmt = (v) => v.toLocaleString('en-US');
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const Cap = (w) => w[0].toUpperCase() + w.slice(1);
// every block drawn here; the plate holds every census row but the wall and the lint plugin
const DRAWN = [LIT, NAV, MBX, SRV, EFF, SSR, SIG, UEF, USG];
{
  const plate = B.rows.map((r) => r.name).filter((n) => n !== CORE[0] && n !== 'eslint-plugin-lit-ui-router').sort();
  const drawn = DRAWN.map(([n]) => n).sort();
  if (plate.join() !== drawn.join()) throw new Error(`sheet 2A: census-bricks.json carries [${plate}] but the plan draws [${drawn}] — place the newcomer`);
}
// the two smallest companions on the plate, by their census moulds
const SMALLEST = DRAWN.map(([name]) => B.rows.find((r) => r.name === name)).sort((a, b) => a.sloc - b.sloc).slice(0, 2).map((r) => r.shape.replace('x', '×'));
const SMALL_SHAPES = SMALLEST[0] === SMALLEST[1] ? `both ${SMALLEST[0]}` : `${SMALLEST[0]} and ${SMALLEST[1]}`;

// census-couplings.json supplies the peer ranges lettered on the two joints that
// are companion-to-companion rather than companion-to-wall.
const COUPLINGS = JSON.parse(readFileSync(new URL('../data/census-couplings.json', import.meta.url), 'utf8'));
const peerRange = (from, to) => {
  const r = COUPLINGS.rows.find((x) => x.from === from && x.to === to && x.kind === 'peer');
  if (!r) throw new Error(`census-couplings.json: no peer row ${from} → ${to}`);
  return r.range;
};
const EFF_LIT = peerRange('lit-ui-router-effect', 'lit-ui-router');
const SSR_LIT = peerRange('lit-ui-router-ssr', 'lit-ui-router');
const SSR_SRV = peerRange('lit-ui-router-ssr', 'ui-router-server');
const SIG_LIT = peerRange('lit-ui-router-signals', 'lit-ui-router');
const SIG_USG = peerRange('lit-ui-router-signals', 'ui-router-signals');
// the companion-to-companion joints, every peer row with both ends on this plate
const ON_PLATE = new Set(DRAWN.map(([n]) => n));
const CC = COUPLINGS.rows.filter((r) => r.kind === 'peer' && ON_PLATE.has(r.from) && ON_PLATE.has(r.to));
const CC_FROM = [...new Set(CC.map((r) => r.from))];
const CC_SPAN = CC_FROM.filter((f) => CC.filter((r) => r.from === f).length > 1);
if (CC.length !== 6 || CC_SPAN.join() !== 'lit-ui-router-signals,lit-ui-router-ssr')
  throw new Error(`sheet 2A: the drawing letters six companion-to-companion joints and two two-armed companions (signals, ssr); the census peers ${CC.length}: ${CC.map((r) => `${r.from} → ${r.to}`).join(', ')}`);
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

<!-- C · transitionService — brick 3 -->
${stud(C_Y, 'C')}${plug(C_Y, 990)}
${cpl(C_Y, 'transitionService.onSuccess({}, update)', 'one hook per router')}
${fnote(C_Y, 'memoised by RouterStore.for()')}

<!-- E · globals — brick 3 -->
${stud(E_Y, 'E')}${plug(E_Y, 990)}
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
${slab(990, 460, 136, 120)}
<path d="M${1050 - 19},460 v-20 h8 v12 h22 v-12 h8 v20 z" class="ska fp2"/>
${badge(966, 470, 3)}
${txt(1002, 498, `${MBX[0]}`, 'lblb')}
${txt(1002, 512, `${MBX[1]} · ${MBX[2]}f · ${fmt(MBX[3])} sloc`, 'lblf')}
${txt(1002, 528, 'PLUGS  C · E', 'lbla')}
${txt(1002, 542, '+ the seat above', 'lblf')}
${txt(1075, 398, 'seekRouter(host)', 'lbla')}
${txt(1075, 410, 'the ui-router-context event', 'lblf')}
${txt(1075, 422, 'the seat under block 1', 'lblf')}`;

// A joint off a COMPANION's face: the same stud-gap-mouth idiom as the wall, at 0.8 scale.
const jointStud = (x, cy) => `<rect x="${x}" y="${cy - 9}" width="30" height="18" rx="7" class="ska fp"/>
<line x1="${x + 32}" y1="${cy}" x2="${x + 46}" y2="${cy}" class="ska" stroke-dasharray="3 3"/>`;
const jointMouth = (x, cy) => `<path d="M${x},${cy - 16} h-22 v7 h15 v18 h-15 v7 h22 z" class="ska fp2"/>`;

// brick 5 — the second reactivity layer, plugged into the flagship's right face
const effBlock = `${jointStud(1110, 175)}${jointMouth(1180, 175)}
${slab(1180, 120, 170, 112)}
${badge(1166, 112, 5)}
${txt(1192, 148, `${EFF[0]}`, 'lblb')}
${txt(1192, 162, `${EFF[1]} · ${EFF[2]}f · ${fmt(EFF[3])} sloc`, 'lblf')}
${txt(1192, 180, 'PLUG  the flagship', 'lbla')}
${txt(1192, 194, 'peers lit-ui-router', 'lblf')}
${txt(1192, 206, `${EFF_LIT} — like block 3`, 'lblf')}`;

// brick 6 — the bridge: one arm to the flagship above the no-DOM line, one to the
// server below it.  The L is the finding, so it is drawn as one continuous arm.
const ssrBridge = `${jointStud(1110, 290)}${jointMouth(1178, 290)}
<rect x="1178" y="282" width="188" height="16" class="ska fp2"/>
<rect x="1350" y="282" width="16" height="493" class="ska fp2"/>
${txt(1184, 276, `peers lit-ui-router ${SSR_LIT}`, 'lbla')}
${txt(1342, 740, 'the bridge crosses the line', 'lbla', 'end')}`;

const ssrBlock = `${slab(1100, 775, 280, 120)}
${badge(1086, 767, 6)}
${txt(1112, 801, `${SSR[0]} ${SSR[1]}`, 'lblb')}
${txt(1112, 815, `${SSR[2]}f · ${fmt(SSR[3])} sloc`, 'lblf')}
${txt(1112, 831, 'PLUGS  BOTH — the flagship and the server', 'lbla')}
${txt(1112, 845, 'the one part that reaches across', 'lblf')}
${txt(1112, 857, 'the no-DOM line', 'lblf')}`;

// block 7 — two arms: one to the flagship's right face, one to block 9's stud
const sigBlock = `${jointStud(1110, 324)}${jointMouth(1178, 324)}
<rect x="1178" y="316" width="128" height="16" class="ska fp2"/>
<rect x="1290" y="316" width="16" height="176" class="ska fp2"/>
${txt(1284, 352, 'peers lit-ui-router', 'lbla', 'end')}
${txt(1284, 364, `${SIG_LIT} · seekRouter( )`, 'lblf', 'end')}
${slab(1184, 500, 146, 84)}
${badge(1170, 492, 7)}
${txt(1196, 524, `${SIG[0]}`, 'lblb')}
${txt(1196, 538, `${SIG[1]} · ${SIG[2]}f · ${fmt(SIG[3])} sloc`, 'lblf')}
${txt(1196, 554, 'PLUGS  blocks 1 · 9', 'lbla')}
${txt(1196, 568, 'no hook of its own', 'lblf')}
${jointStud(950, 631)}${jointMouth(1020, 631)}
<rect x="1020" y="623" width="236" height="16" class="ska fp2"/>
<rect x="1240" y="584" width="16" height="55" class="ska fp2"/>
${txt(1026, 654, `peers ui-router-signals ${SIG_USG}`, 'lbla')}
${txt(1026, 666, 'RouterSignals.for( ) · watchSelection( )', 'lblf')}`;

// blocks 8 and 9 — the agnostic pair, core only: a dashed tap up to the studs block 3 plugs
const tap = (x, y0) => `<line x1="${x}" y1="${y0}" x2="${x}" y2="562" class="ska" stroke-dasharray="4 3"/>
<circle cx="${x}" cy="562" r="2.2" class="fa"/>`;
const agnostic = `${tap(660, 587)}${tap(860, 587)}
${txt(668, 575, 'taps C · E — as block 3 does', 'lblf')}
${slab(600, 596, 150, 70)}
${badge(586, 588, 8)}
${txt(612, 618, `${UEF[0]}`, 'lblb')}
${txt(612, 632, `${UEF[1]} · ${UEF[2]}f · ${fmt(UEF[3])} sloc`, 'lblf')}
${txt(612, 648, 'PLUGS  C · E — no Lit', 'lbla')}
${slab(800, 596, 150, 70)}
${badge(786, 588, 9)}
${txt(812, 618, `${USG[0]}`, 'lblb')}
${txt(812, 632, `${USG[1]} · ${USG[2]}f · ${fmt(USG[3])} sloc`, 'lblf')}
${txt(812, 648, 'PLUGS  C · E — its stud →', 'lbla')}`;

// the server's own face carries the bridge's second stud
const srvJoint = `${jointStud(590, 790)}${jointMouth(660, 790)}
<rect x="660" y="782" width="440" height="16" class="ska fp2"/>
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
const serverLane = `<line x1="100" y1="746" x2="1300" y2="746" class="skf" stroke-dasharray="8 5"/>
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
${txt(600, 716, '‘simulate’ lazy-imports a wall of its own — new UIRouter() per resolution', 'lblf')}
${txt(300, 940, 'peerDependenciesMeta: { ‘@uirouter/core’: { optional: true } } — the tie is drawn only to be crossed out', 'lblr')}`;

const svg = `<svg viewBox="0 0 1400 960" role="img" aria-label="A coupling plan in shallow three-quarter view, the alternate plate to sheet 2's exploded brick assembly. A tall shallow block at the left, lettered @uirouter/core — the socket wall, carries six connection points down its right edge, each drawn at reading size: lettered studs B, D, C and E protrude from the wall; an accent rail marked A, router.plugin, spans the middle of the edge with one stud on it; and one keyed recess ringed in red is the location seat. The companion blocks sit to the right, drawn just short of seated, each with C-shaped plug mouths reaching toward their studs across a small dashed engagement gap, the exact API call lettered on every connection. Block 1, lit-ui-router, holds three plugs — stateRegistry.decorator, urlService.listen and sync, and seat 1 of the plugin rail — and carries one downward stud of its own. Block 2, the navigation location plugin, holds a single red keyed plug approaching the location seat, while a dashed ghost plug labelled pushStateLocation exits the seat below: a router holds exactly one location plugin, so this coupling is a swap, never an addition. Block 3, lit-ui-router-mobx, opens an upward socket under block 1's stud — seekRouter, the ui-router-context event, the seat under block 1 — and plugs studs C and E, transitions observed and globals mirrored, never written. Faint slabs above and below the wall mark the browser and the DOM, and below a dashed no-DOM line block 4, ui-router-server, sits in a request-to-decision lane with a dashed tie back up to the wall crossed out in red: core is an optional peer, its matcher tier never loads the wall, and its simulate tier lazily builds a wall of its own. Block 5, lit-ui-router-effect, hangs off a stud on block 1's right face — it peers the flagship ${EFF_LIT}, the same kind of joint block 3 takes. Block 6, lit-ui-router-ssr, is drawn as a single L-shaped arm: one stud on block 1's right face above, one on block 4's right face below, and a run down the right of the sheet that crosses the no-DOM line — the only part in the family that declares both the flagship ${SSR_LIT} and the server ${SSR_SRV}, so the only one whose drawing spans both halves of the plate. Block 7, lit-ui-router-signals, has two arms that stay above the line: one to a third stud on block 1's right face, ${SIG_LIT}, and one to a stud on the right face of block 9, ui-router-signals ${SIG_USG}. Blocks 8 and 9, ui-router-effect and ui-router-signals, stand under the wall's C and E plugs with a dashed tap up to them: they peer core and nothing in this repo.">
${defs(P)}

${txt(1370, 16, `SCALE — front-face area ≈ 35 px² per sloc (census-bricks.json @ ${B.sha}) · the two smallest companions (${SMALL_SHAPES}) are held to a legible minimum · depth is constant and carries no data`, 'lbls', 'end')}
${txt(1370, 30, 'THE COUPLINGS ARE THE SUBJECT — every plug drawn just short of seated · sheet 2 shows this same assembly exploded', 'lblf', 'end')}

${context}
${coreBlock}
${wallCouplings}
${litBlock}
${navBlock}
${mbxBlock}
${effBlock}
${serverLane}
${srvJoint}
${ssrBridge}
${ssrBlock}
${sigBlock}
${agnostic}
</svg>`;

export const sheet2a = {
  num: '2A', id: 'companions-couplings', rev: 'F',
  title: 'THE COUPLING PLAN',
  sub: `ALTITUDE 2 — ALTERNATE PLATE: the ${WORD[DRAWN.length]} companions sheet 2 schedules, laid out for reading — core central as a socket wall, companions at its right, the server below the no-DOM line — with every coupling drawn disengaged and lettered to its API call · rows read census-bricks.json @ ${B.sha}`,
  scale: `${WORD[DRAWN.length].toUpperCase()} PACKAGES`,
  form: 'COUPLING PLAN',
  svg,
  caption: `The brick assembly, uncoupled and brought down to one elevation: core as a socket wall, companions as shallow blocks drawn just short of seated, and each of the six connection points on the wall — five published studs and one keyed red seat — large enough to letter its API call on the joint itself. ${Cap(WORD[CC.length])} more joints are companion-to-companion, and one of those spans both halves of the plate.`,
  notes: `
<p><strong>This plate is the legibility companion to sheet 2.</strong> The exploded assembly (sheet 2, THE BRICK ASSEMBLY) shows the whole stack and where every brick falls; this plate isolates the couplings and draws each one at reading size. The arrangement answers to reading rather than to assembly — core central, companions at its right, the server in a request lane below the no-DOM line — and the packages are shallow solids, so the recovered space goes entirely to the joints.</p>
<p><strong>Every joint is drawn disengaged.</strong> A seated plug hides both mating faces, so nothing here is seated: each stud on the wall stops 18px short of its plug’s mouth, the dashed centreline is the engagement, and the call that makes the coupling — <code>stateRegistry.decorator('views', litViewsBuilder)</code>, <code>urlService.listen()/.sync()</code>, <code>router.plugin(servicesPlugin)</code>, <code>transitionService.onSuccess({}, update)</code>, <code>globals.current/.params</code> — is lettered on the connection itself, not in a schedule at the edge of the sheet.</p>
<p><strong>One connection point is a seat, not a stud, and it is drawn as a keyed recess.</strong> A router holds exactly <em>one</em> location plugin, so ${npmLink('ui-router-navigation-location-plugin')} does not add to the wall — it <em>swaps</em>: its keyed red plug approaches the LOCATION SEAT while a dashed ghost plug, core’s own <code>pushStateLocation</code>, leaves it. The rail above behaves the opposite way: <code>router.plugin()</code> is one method with any number of seats, which is where <a href="${HOME.visualizer}"><code>visualizer</code></a>, <a href="${HOME.sticky}"><code>sticky-states</code></a>, <a href="${HOME.dsr}"><code>dsr</code></a> and <a href="${HOME.rx}"><code>rx</code></a> would queue (sheet 4).</p>
<p><strong>The seat under the flagship gets its own axis.</strong> ${npmLink('lit-ui-router-mobx')} takes it: its upward socket waits under a stud on <code>lit-ui-router</code>’s underside — <code>seekRouter(host)</code>, the bubbling <code>ui-router-context</code> event it falls back to when no <a href="${HOME.protocol}"><code>context-request</code></a> provider answers — and everything else it does is read-only against the wall: one memoised <code>onSuccess</code> hook on stud C, observations of <code>globals</code> on stud E, never a write.</p>
<p><strong>${Cap(WORD[CC.length])} joints never touch the wall, and one of them spans the sheet.</strong> They come from ${WORD[CC_FROM.length]} companions, and ${WORD[CC_SPAN.length]} of those reach two blocks. <code>lit-ui-router-mobx</code> was the first (block 3, the seat under block 1). ${npmLink('lit-ui-router-effect')} (block 5, ${EFF[2]} files, ${fmt(EFF[3])} sloc) takes the same kind of joint from block 1's right face: it peers ${npmLink('lit-ui-router')} ${EFF_LIT}. ${npmLink('lit-ui-router-ssr')} (block 6, ${SSR[2]} files, ${fmt(SSR[3])} sloc) is the one that had to change the drawing's shape: it peers <code>lit-ui-router</code> ${SSR_LIT} <em>and</em> ${npmLink('ui-router-server')} ${SSR_SRV}, so its arm leaves block 1 above the no-DOM line, runs down the right edge of the plate, crosses that line, and meets a second stud on block 4's face below it. Nothing else here crosses; a package that prerenders Lit for a server router is exactly the thing that would. ${npmLink('lit-ui-router-signals')} (block 7, ${SIG[2]} files, ${fmt(SIG[3])} sloc) is the other companion with two arms, and both stay above the line: one to a third stud on block 1's right face, ${SIG_LIT}, and one to a stud on ${npmLink('ui-router-signals')} ${SIG_USG}, whose <code>RouterSignals.for()</code> and <code>watchSelection()</code> it binds to a Lit host.</p>
<p><strong>Two blocks plug the wall and no companion.</strong> ${npmLink('ui-router-effect')} (block 8, ${fmt(UEF[3])} sloc) and <code>ui-router-signals</code> (block 9, ${fmt(USG[3])} sloc) peer <code>@uirouter/core</code> and nothing in this repo: each holds one <code>onSuccess</code> hook on stud C and reads <code>globals</code> on stud E, into an Effect <code>SubscriptionRef</code> or a <code>Signal.State</code>. They stand under the wall's C and E plugs with a dashed tap up to them, because those are the studs block 3 plugs: one stud, a hook per consumer. Sheet 2 seats block 8 on stud C and schedules block 9 without drawing it — its seat is on the plate, while block 7, which peers it, stands on the flagship's cap; this plan seats nothing, so it draws block 9's joint.</p>
<p><strong>The missing coupling is drawn only to be crossed out.</strong> <code>ui-router-server</code> takes no stud: ${npmLink('@uirouter/core')} is an <em>optional</em> peer (<a href="${HOME.peerMeta}"><code>peerDependenciesMeta</code></a>), its default <code>'matcher'</code> tier is dependency-free, and its <code>'simulate'</code> tier lazily imports a wall of its own. Blocks are sized roughly by mass — front-face area ≈ 35 px² per sloc, from <code>census-bricks.json</code> counted at ${B.ref} @ ${B.sha}, which puts <code>lit-ui-router</code> at ${fmt(LIT[3])} sloc — with the two smallest companions (${SMALL_SHAPES}) clamped up to a legible minimum, because at true scale they would be postage stamps, and their smallness is already sheet 2’s finding.</p>`,
  key: [
    keyRow('<rect x="2" y="5" width="20" height="8" rx="3" class="ska fp"/>', 'a published stud on the wall — core’s extension surface, lettered A–E'),
    keyRow('<rect x="2" y="5" width="14" height="8" rx="3" class="ska fp"/><line x1="18" y1="9" x2="26" y2="9" class="ska" stroke-dasharray="3 3"/><path d="M46,2 h-14 v4 h8 v6 h-8 v4 h14 z" class="ska fp2"/>', 'a companion’s plug, drawn just short of seated — both mating faces read'),
    keyRow('<path d="M10,4 h-8 v10 h8" class="skr fp2"/><line x1="12" y1="9" x2="18" y2="9" class="skr" stroke-dasharray="3 3"/><rect x="20" y="5" width="18" height="8" rx="3" class="skr fp"/><rect x="25" y="2" width="7" height="3" class="skr fp"/>', 'the LOCATION SEAT — keyed, one per router: the plug swaps core’s own out'),
    keyRow('<rect x="20" y="1" width="8" height="8" rx="2" class="ska fp"/><path d="M14,17 v-6 h4 v3 h12 v-3 h4 v6 z" class="ska fp2"/>', 'the seat under block 1 — seekRouter( ), the one stud on a block’s underside'),
    keyRow('<line x1="24" y1="16" x2="24" y2="3" class="ska" stroke-dasharray="4 3"/><circle cx="24" cy="3" r="2.2" class="fa"/>', 'a tap — a block that takes a stud another block’s plug is drawn on'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="sks" stroke-dasharray="5 4"/><circle cx="23" cy="9" r="6" class="skr fp"/><line x1="19" y1="13" x2="27" y2="5" class="skr"/>', 'no coupling — the server’s core peer is optional; it never plugs this wall'),
    keyRow('<rect x="4" y="4" width="40" height="11" class="skf fp"/>', 'context, not massed — browser, DOM, the request lane'),
  ].join('\n'),
};

import { defs } from './chrome.mjs';
import { txt, keyRow } from './helpers.mjs';

const P = 's2a';

// ---- census: authored source, counted 2026-08-17 via census-bricks.mjs ---------
// Same basis as sheets 2/3/4: .ts/.tsx/.js/.mjs under src/, excl. *.d.ts,
// *.{spec,test}.*, specs/ and typedoc stubs.  sloc = non-blank, non-comment lines.
const CORE = ['@uirouter/core', '6.1.2', 80, 5272];
const LIT = ['lit-ui-router', '1.9.0', 12, 1325];
const NAV = ['ui-router-navigation-location-plugin', '0.3.0', 1, 105];
const MBX = ['lit-ui-router-mobx', '0.5.0', 4, 133];
const SRV = ['ui-router-server', '0.1.1', 8, 1141];
const fmt = (v) => v.toLocaleString('en-US');

// ---- shallow extrusion ----------------------------------------------------------
// Rev A of sheet 2 was a flat elevation; rev B a full exploded LEGO stack.  This
// plate splits the difference: rev A's arrangement, blocks given just enough depth
// to read as solids (constant DX/DY — depth carries no data), and every coupling
// drawn at reading size, disengaged, so both mating faces show.
const DX = 16, DY = 9;

function slab(x, y, w, h, { edge = 'sk', side = `url(#${P}-hx)`, front = 'fp', dash = '' } = {}) {
  const da = dash ? ` stroke-dasharray="${dash}"` : '';
  const top = `${x},${y} ${x + w},${y} ${x + w + DX},${y - DY} ${x + DX},${y - DY}`;
  const right = `${x + w},${y} ${x + w + DX},${y - DY} ${x + w + DX},${y + h - DY} ${x + w},${y + h}`;
  return `<polygon points="${top}" class="${edge}"${da} fill="var(--paper-2)"/>
<polygon points="${right}" fill="var(--paper)" stroke="none"/>
<polygon points="${right}" class="${edge}"${da} fill="${side}"/>
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
// Front-face area roughly proportional to sloc (~35 px² per line); the two 1×1
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

const navBlock = `${slab(780, 355, 180, 90)}
${badge(766, 347, 2)}
${txt(792, 381, 'ui-router-navigation-', 'lblb')}
${txt(792, 395, `location-plugin ${NAV[1]}`, 'lblb')}
${txt(792, 409, `${NAV[2]}f · ${fmt(NAV[3])} sloc · core only —`, 'lblf')}
${txt(792, 421, 'it has never heard of Lit', 'lblf')}
${txt(792, 437, 'PLUG  THE LOCATION SEAT', 'lblr')}`;

// The brick-to-brick seat: lit's stud points down, mobx's socket opens up.
const mbxBlock = `<line x1="1050" y1="372" x2="1050" y2="438" class="ska" stroke-dasharray="4 3"/>
${slab(990, 460, 160, 120)}
<path d="M${1050 - 19},460 v-20 h8 v12 h22 v-12 h8 v20 z" class="ska fp2"/>
${badge(966, 470, 3)}
${txt(1002, 498, `${MBX[0]}`, 'lblb')}
${txt(1002, 512, `${MBX[1]} · ${MBX[2]}f · ${fmt(MBX[3])} sloc`, 'lblf')}
${txt(1002, 528, 'PLUGS  C · E', 'lbla')}
${txt(1002, 542, '+ the seat above', 'lblf')}
${txt(1075, 398, 'seekRouter(host)', 'lbla')}
${txt(1075, 410, 'the ui-router-context event', 'lblf')}
${txt(1075, 422, 'the ONE brick-to-brick seat', 'lblf')}`;

// ---- context: the stack rev A drew, held faint -------------------------------------
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

const svg = `<svg viewBox="0 0 1400 960" role="img" aria-label="A coupling plan in shallow three-quarter view, the alternate plate to sheet 2's exploded brick assembly. A tall shallow block at the left, lettered @uirouter/core — the socket wall, carries six connection points down its right edge, each drawn at reading size: lettered studs B, D, C and E protrude from the wall; an accent rail marked A, router.plugin, spans the middle of the edge with one stud on it; and one keyed recess ringed in red is the location seat. Three companion blocks sit to the right, drawn just short of seated, each with C-shaped plug mouths reaching toward their studs across a small dashed engagement gap, the exact API call lettered on every connection. Block 1, lit-ui-router, holds three plugs — stateRegistry.decorator, urlService.listen and sync, and seat 1 of the plugin rail — and carries one downward stud of its own. Block 2, the navigation location plugin, holds a single red keyed plug approaching the location seat, while a dashed ghost plug labelled pushStateLocation exits the seat below: a router holds exactly one location plugin, so this coupling is a swap, never an addition. Block 3, lit-ui-router-mobx, opens an upward socket under block 1's stud — seekRouter, the ui-router-context event, the one brick-to-brick seat — and plugs studs C and E, transitions observed and globals mirrored, never written. Faint slabs above and below the wall mark the browser and the DOM, and below a dashed no-DOM line block 4, ui-router-server, sits in a request-to-decision lane with a dashed tie back up to the wall crossed out in red: core is an optional peer, its matcher tier never loads the wall, and its simulate tier lazily builds a wall of its own.">
${defs(P)}

${txt(1370, 16, 'SCALE — front-face area ≈ 35 px² per sloc (census-bricks.mjs, recounted 2026-08-17) · the two 1×1 companions are held to a legible minimum · depth is constant and carries no data', 'lbls', 'end')}
${txt(1370, 30, 'THE COUPLINGS ARE THE SUBJECT — every plug drawn just short of seated · sheet 2 shows this same assembly exploded', 'lblf', 'end')}

${context}
${coreBlock}
${wallCouplings}
${litBlock}
${navBlock}
${mbxBlock}
${serverLane}
</svg>`;

export const sheet2a = {
  num: '2A', id: 'companions-couplings', rev: 'A',
  title: 'THE COUPLING PLAN',
  sub: 'ALTITUDE 2 — ALTERNATE PLATE: the same four companions as sheet 2, rev A’s arrangement, every coupling drawn to read · counted 2026-08-17',
  scale: 'FOUR PACKAGES',
  form: 'COUPLING PLAN',
  svg,
  caption: 'The brick assembly, uncoupled and brought back to rev A’s elevation: core as a socket wall, companions as shallow blocks drawn just short of seated, and each of the six connection points — five published studs and one keyed red seat — large enough to letter its API call on the joint itself.',
  notes: `
<p><strong>This plate is the legibility companion to sheet 2.</strong> The exploded assembly (sheet 2, THE BRICK ASSEMBLY) shows the whole stack and where every brick falls; this plate isolates the couplings and draws each one at reading size. It deliberately returns to rev A’s spatial arrangement — core central, companions at its right, the server in a request lane below the no-DOM line — but renders the packages as shallow solids and spends the recovered space entirely on the joints.</p>
<p><strong>Every joint is drawn disengaged.</strong> A seated plug hides both mating faces, so nothing here is seated: each stud on the wall stops 18px short of its plug’s mouth, the dashed centreline is the engagement, and the call that makes the coupling — <code>stateRegistry.decorator('views', litViewsBuilder)</code>, <code>urlService.listen()/.sync()</code>, <code>router.plugin(servicesPlugin)</code>, <code>transitionService.onSuccess({}, update)</code>, <code>globals.current/.params</code> — is lettered on the connection itself, not in a schedule at the edge of the sheet.</p>
<p><strong>One connection point is a seat, not a stud, and it is drawn as a keyed recess.</strong> A router holds exactly <em>one</em> location plugin, so <code>ui-router-navigation-location-plugin</code> does not add to the wall — it <em>swaps</em>: its keyed red plug approaches the LOCATION SEAT while a dashed ghost plug, core’s own <code>pushStateLocation</code>, leaves it. The rail above behaves the opposite way: <code>router.plugin()</code> is one method with any number of seats, which is where <code>visualizer</code>, <code>sticky-states</code>, <code>dsr</code> and <code>rx</code> would queue (sheet 4).</p>
<p><strong>The one brick-to-brick coupling gets its own axis.</strong> <code>lit-ui-router-mobx</code> is the only companion that touches another companion: its upward socket waits under a stud on <code>lit-ui-router</code>’s underside — <code>seekRouter(host)</code>, the bubbling <code>ui-router-context</code> event — and everything else it does is read-only against the wall: one memoised <code>onSuccess</code> hook on stud C, observations of <code>globals</code> on stud E, never a write.</p>
<p><strong>The missing coupling is drawn only to be crossed out.</strong> <code>ui-router-server</code> takes no stud: <code>@uirouter/core</code> is an <em>optional</em> peer (<code>peerDependenciesMeta</code>), its default <code>'matcher'</code> tier is dependency-free, and its <code>'simulate'</code> tier lazily imports a wall of its own. Blocks are sized roughly by mass — front-face area ≈ 35 px² per sloc, from <code>census-bricks.mjs</code> recounted 2026-08-17 (the recount moved <code>lit-ui-router</code> to 1,325 sloc; sheet 2 printed the 08-16 figure) — with the two 1×1 companions clamped up to a legible minimum, because at true scale they would be postage stamps, and their smallness is already sheet 2’s finding.</p>`,
  key: [
    keyRow('<rect x="2" y="5" width="20" height="8" rx="3" class="ska fp"/>', 'a published stud on the wall — core’s extension surface, lettered A–E'),
    keyRow('<rect x="2" y="5" width="14" height="8" rx="3" class="ska fp"/><line x1="18" y1="9" x2="26" y2="9" class="ska" stroke-dasharray="3 3"/><path d="M46,2 h-14 v4 h8 v6 h-8 v4 h14 z" class="ska fp2"/>', 'a companion’s plug, drawn just short of seated — both mating faces read'),
    keyRow('<path d="M10,4 h-8 v10 h8" class="skr fp2"/><line x1="12" y1="9" x2="18" y2="9" class="skr" stroke-dasharray="3 3"/><rect x="20" y="5" width="18" height="8" rx="3" class="skr fp"/><rect x="25" y="2" width="7" height="3" class="skr fp"/>', 'the LOCATION SEAT — keyed, one per router: the plug swaps core’s own out'),
    keyRow('<rect x="20" y="1" width="8" height="8" rx="2" class="ska fp"/><path d="M14,17 v-6 h4 v3 h12 v-3 h4 v6 z" class="ska fp2"/>', 'the brick-to-brick seat — seekRouter( ), the only companion-to-companion joint'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="sks" stroke-dasharray="5 4"/><circle cx="23" cy="9" r="6" class="skr fp"/><line x1="19" y1="13" x2="27" y2="5" class="skr"/>', 'no coupling — the server’s core peer is optional; it never plugs this wall'),
    keyRow('<rect x="4" y="4" width="40" height="11" class="skf fp"/>', 'context, not massed — browser, DOM, the request lane'),
  ].join('\n'),
};

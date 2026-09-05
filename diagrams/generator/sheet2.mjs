import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, lines, isoPt, keyRow } from './helpers.mjs';

const P = 's2';

// ---- census: every number below comes from diagrams/data/census-bricks.json -----
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
// the fifth published package: a lint plugin, scheduled but NOT drawn — no stud here
const LINT = row('eslint-plugin-lit-ui-router');

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

// the four runtime companions, in drawing order — the lint plugin is not one of them
const BRICKS = [
  { n: 1, name: 'lit-ui-router' },
  { n: 2, name: 'ui-router-navigation-location-plugin', disp: 'navigation-location-plugin' },
  { n: 3, name: 'lit-ui-router-mobx' },
  { n: 4, name: 'ui-router-server' },
].map((b) => {
  const r = row(b.name);
  return { disp: b.name, ...b, ver: r.version, files: r.files, sloc: r.sloc, shape: SHAPE(STUDS(r.sloc)), courses: COURSES(r.files) };
});
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

// One stud: an iso cylinder — swept side wall under an ellipse cap.
function stud(ox, oy, x, y, z, { edge = 'sks', cap = 'fp2', ring = null } = {}) {
  const [cx, cy] = pt(ox, oy, x, y, z + SH);
  const by = +(cy + SH).toFixed(1);
  const halo = ring
    ? `<ellipse cx="${cx}" cy="${cy}" rx="${(RX + 5.5).toFixed(1)}" ry="${(RY + 3.2).toFixed(1)}" class="${ring} fnone"/>`
    : '';
  return `<path d="M${cx - RX},${cy} L${cx - RX},${by} A${RX},${RY} 0 0 0 ${cx + RX},${by} L${cx + RX},${cy} Z" class="${edge}" fill="var(--paper-2)"/>
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
  return `<polygon points="${left}" class="${edge}" fill="var(--paper-2)"/>
<polygon points="${right}" fill="var(--paper)" stroke="none"/>
<polygon points="${right}" class="${edge}" fill="${side ?? `url(#${P}-hx)`}"/>
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
  return `<polygon points="${left}" class="${edge}"${da} fill="var(--paper-2)"/>
<polygon points="${right}" fill="var(--paper)" stroke="none"/>
<polygon points="${right}" class="${edge}"${da} fill="url(#${P}-hx)"/>
<polygon points="${top}" class="${edge} fp"${da}/>
${studs.join('\n')}`;
}

// A drop line: the exploded-view fall from a brick's underside onto the stud it
// seats on.  Vertical in screen space, because z is the screen's vertical axis.
const drop = (ox, oy, x, y, zFrom, zTo) => {
  const [cx, y0] = pt(ox, oy, x, y, zFrom);
  const y1 = pt(ox, oy, x, y, zTo + SH)[1] - RY - 1;
  return `<line x1="${cx}" y1="${y0}" x2="${cx}" y2="${y1.toFixed(1)}" class="ska" stroke-dasharray="6 4"/>
<circle cx="${cx}" cy="${y1.toFixed(1)}" r="2.2" class="fa"/>`;
};

const badge = (x, y, n, cls = 'sk fp', num = 'lbl') =>
  `<circle cx="${x}" cy="${y}" r="9.5" class="${cls}"/>${txt(x, y + 3.6, String(n), num, 'middle')}`;

const leader = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="skf"/>`;

// ---- the client assembly ----------------------------------------------------------
const OX = 470, OY = 320;                 // @uirouter/core baseplate, 8 x 6 studs
const NAMED = new Map([
  // the plugin rail — the whole back row is router.plugin(); two seats are taken
  ...Array.from({ length: 8 }, (_, i) => [`${i},0`, { edge: 'ska', cap: 'fp', ring: 'ska' }]),
  ['4,0', { edge: 'skr', cap: 'fp', ring: 'skr' }],   // the LOCATION SEAT — exactly one
  ['1,5', { edge: 'ska', cap: 'fp', ring: 'ska' }],   // D  urlService        (331.4, 441)
  ['3,5', { edge: 'ska', cap: 'fp', ring: 'ska' }],   // C  transitionService (400.7, 481)
  ['7,3', { edge: 'ska', cap: 'fp', ring: 'ska' }],   // E  globals           (608.6, 521)
  ['7,1', { edge: 'ska', cap: 'fp', ring: 'ska' }],   // B  stateRegistry     (677.8, 481)
]);

const litZ0 = 96, litTop = litZ0 + B(1).courses * CRS;                 // courses from the census
const navZ0 = 140;                                                     // 1 course
const mbxZ0 = 252;                                                     // on top of brick 1

const clientPlate = plate(OX, OY, 8, 6, { named: NAMED });

const drops = [
  drop(OX, OY, 60, 20, litZ0, PT),                    // 1 -> stud A, seat i=1
  drop(OX, OY, 180, 20, navZ0, PT),                   // 2 -> stud A, the LOCATION SEAT
  drop(OX, OY, 20, 140, mbxZ0, litTop),               // 3 -> a stud on brick 1
].join('\n');

// painted back to front: brick 1, then 3 (above and in front of it), then 2
const clientBricks = [
  // brick 1 carries a stud of its own: the seat brick 3 takes (seekRouter)
  brick(OX, OY, 0, 0, 2, 4, B(1).courses, { z0: litZ0, studEdge: 'sk', ringStuds: new Set(['0,3']) }),
  brick(OX, OY, 0, 120, 2, 1, B(3).courses, { z0: mbxZ0 }),          // 1x2, laid across brick 1's back row
  brick(OX, OY, 160, 0, 1, 1, B(2).courses, { z0: navZ0 }),
].join('\n');

// ---- the second plate: ui-router-server ---------------------------------------------
const OX2 = 1130, OY2 = 490;              // a headless core, 4 x 4 studs, optional
const SRV_NAMED = new Map([
  ['1,0', { edge: 'ska', cap: 'fp', ring: 'ska' }],
  ['1,2', { edge: 'ska', cap: 'fp', ring: 'ska' }],
]);
const srvZ0 = 110;
const serverIsland = `${plate(OX2, OY2, 4, 4, { edge: 'sks', dash: '6 4', named: SRV_NAMED })}
${drop(OX2, OY2, 60, 20, srvZ0, PT)}
${drop(OX2, OY2, 60, 100, srvZ0, PT)}
${brick(OX2, OY2, 40, 0, 2, 4, B(4).courses, { z0: srvZ0 })}`;

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
  return `<polygon points="${[q(0, d, h), q(w, d, h), q(w, d, 0), q(0, d, 0)].join(' ')}" class="${cls}"${da} fill="var(--paper-2)"/>
<polygon points="${[q(w, 0, h), q(w, d, h), q(w, d, 0), q(w, 0, 0)].join(' ')}" class="${cls}"${da} fill="url(#${P}-hx)"/>
<polygon points="${[q(0, 0, h), q(w, 0, h), q(w, d, h), q(0, d, h)].join(' ')}" class="${cls} fp"${da}/>
${Array.from({ length: ws * ds }, (_, k) => {
  const [sx, sy] = isoPt(ox, oy, (Math.floor(k / ds) + 0.5) * MU, ((k % ds) + 0.5) * MU, h + MSH);
  return `<path d="M${(sx - MRX).toFixed(1)},${sy.toFixed(1)} v${MSH} a${MRX},${MRY} 0 0 0 ${2 * MRX},0 v${-MSH} Z" class="${cls} fp2"${da}/>
<ellipse cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" rx="${MRX}" ry="${MRY}" class="${cls} fp2"${da}/>`;
}).join('\n')}`;
}

// [brick, row y] — shape and courses come from the brick itself
const PARTS = [[1, 108], [2, 152], [3, 190], [4, 236]];
const partsBox = `<rect x="30" y="34" width="286" height="244" class="skf fnone"/>
${txt(44, 56, 'PARTS — 4 BRICKS, 1 PLATE', 'lbls')}
${leader(30, 64, 316, 64)}
${PARTS.map(([n, oy]) => {
  const b = B(n);
  return `${miniBrick(92, oy, b.shape[0], b.shape[1], b.courses)}
${badge(48, oy - 4, n)}
${txt(120, oy - 6, b.disp, 'lbl')}
${txt(120, oy + 6, `x1 · ${shapeName(b.shape)} · ${b.courses} course${b.courses > 1 ? 's' : ''}`, 'lblf')}`;
}).join('\n')}`;

// ---- spare parts: the same stud, not in this set --------------------------------------
const SPARE = ['@uirouter/visualizer 7.2.1', '@uirouter/sticky-states 1.5.1', '@uirouter/dsr 1.2.0', '@uirouter/rx 1.0.0'];
const spareBox = `<rect x="30" y="460" width="286" height="142" class="skf fnone" stroke-dasharray="5 4"/>
${txt(44, 482, 'SPARE PARTS — STUD A, NOT IN THIS SET', 'lbls')}
${[70, 130, 190, 250].map((x) => miniBrick(x, 512, 1, 1, 1, '3 2')).join('\n')}
${lines(44, 542, SPARE, 'lblf', 'start', 12)}
${txt(44, 594, 'all four queue on stud A — sheet 4', 'lblf')}`;

// ---- stud schedule: core's published extension surface ---------------------------------
const STUDROWS = [
  ['A', 'router.plugin(factory)'],
  ['', 'the whole back rail — one method, eight seats, two taken here'],
  ['', 'brick 1 registers servicesPlugin; brick 2 takes the LOCATION SEAT'],
  ['', 'the red ring: a router holds exactly ONE location plugin, so brick 2'],
  ['', 'SWAPS core’s pushStateLocation rather than adding to it'],
  ['B', 'stateRegistry.decorator(…)'],
  ['', 'brick 1 — decorator(‘views’, litViewsBuilder) is the whole Lit graft'],
  ['C', 'transitionService.onSuccess()'],
  ['', 'brick 3 — one hook per router, via RouterStore.attach()'],
  ['D', 'urlService.listen() / .sync() / .rules'],
  ['', 'brick 1 starts the client; brick 4 replays rules on its own plate'],
  ['E', 'globals.current / .params'],
  ['', 'brick 3 reads them into observables — it never writes router state'],
];
const studBox = `<rect x="880" y="44" width="490" height="238" class="skf fnone"/>
${txt(894, 66, 'STUD SCHEDULE — @uirouter/core’s published surface', 'lbls')}
${leader(880, 74, 1370, 74)}
${STUDROWS.map(([k, s], i) => {
  const y = 92 + i * 14;
  return k ? `${txt(894, y, k, 'lbla')}${txt(912, y, s, 'lbl')}` : txt(912, y, s, 'lblf');
}).join('\n')}`;

// ---- lettering ---------------------------------------------------------------------------
const lettering = `
${badge(470, 108, 1, 'ska fp', 'lbla')}
${txt(492, 102, `${B(1).name} ${B(1).ver}`, 'lblb')}
${txt(492, 114, `${B(1).files}f · ${fmt(B(1).sloc)} sloc · ${shapeName(B(1).shape)} · ${B(1).courses} courses`, 'lblf')}
${txt(492, 126, 'STUDS  A · B · D — and it extends UIRouter', 'lbla')}

${badge(608.6, 216, 2, 'ska fp', 'lbla')}
${txt(660, 190, 'ui-router-navigation-', 'lblb')}
${txt(660, 202, `location-plugin ${B(2).ver}`, 'lblb')}
${txt(660, 214, `${B(2).files}f · ${fmt(B(2).sloc)} sloc · ${shapeName(B(2).shape)} · ${B(2).courses} course`, 'lblf')}
${txt(660, 226, 'STUD  A — the LOCATION SEAT', 'lblr')}
${txt(660, 238, 'a swap, never an addition', 'lblr')}

${badge(366.1, 60, 3, 'ska fp', 'lbla')}
${txt(388, 42, `${B(3).name} ${B(3).ver}`, 'lblb')}
${txt(388, 54, `${B(3).files}f · ${fmt(B(3).sloc)} sloc · ${shapeName(B(3).shape)} · ${B(3).courses} courses`, 'lblf')}
${txt(388, 66, 'SEATS ON BRICK 1 — seekRouter()', 'lbla')}
${txt(388, 78, 'STUDS  C · E on the plate below', 'lbla')}

${badge(1164.6, 308, 4, 'ska fp', 'lbla')}
${txt(1140, 302, `${B(4).name} ${B(4).ver}`, 'lblb', 'end')}
${txt(1140, 314, `${B(4).files}f · ${fmt(B(4).sloc)} sloc · ${shapeName(B(4).shape)} · ${B(4).courses} courses`, 'lblf', 'end')}
${txt(1140, 326, 'STUDS  A′ · D′ — on a plate of its own', 'lbla', 'end')}

<!-- the plate itself -->
${txt(40, 320, `${CORE[0]} ${CORE[1]} — THE BASEPLATE`, 'lblb')}
${txt(40, 332, `${CORE[2]} files · ${fmt(CORE[3])} sloc · not massed`, 'lblf')}
${txt(40, 344, 'a plate is ground: every brick peers it,', 'lblf')}
${txt(40, 356, 'and no brick may replace it', 'lblf')}
${leader(278, 338, 348, 412)}

<!-- named studs, labelled off the plate -->
${txt(60, 640, 'D   urlService', 'lbla')}
${txt(60, 652, '.listen() · .sync() · .rules — brick 1', 'lblf')}
${txt(60, 664, 'starts and syncs the client router', 'lblf')}
${leader(315, 636, 334, 452)}

${txt(60, 692, 'C   transitionService', 'lbla')}
${txt(60, 704, '.onSuccess({}, update) — one hook per', 'lblf')}
${txt(60, 716, 'router, memoised by RouterStore.for()', 'lblf')}
${leader(315, 688, 403, 492)}

${txt(760, 452, 'B   stateRegistry', 'lbla')}
${txt(760, 464, '.decorator(‘views’, litViewsBuilder)', 'lblf')}
${txt(760, 476, 'the one graft that renders Lit', 'lblf')}
${leader(755, 462, 697, 477)}

${txt(760, 570, 'E   globals', 'lbla')}
${txt(760, 582, '.current · .params · the last transition', 'lblf')}
${txt(760, 594, 'brick 3 mirrors them, never writes', 'lblf')}
${leader(755, 580, 626, 527)}

${txt(760, 352, 'A   router.plugin(factory)', 'lbla')}
${txt(760, 364, 'the rail is one method, not eight slots:', 'lblf')}
${txt(760, 376, 'bricks queue on it, never on each other', 'lblf')}
${leader(756, 367, 695, 430)}

<!-- the absent coupling -->
<line x1="729.8" y1="468" x2="991.4" y2="558" class="skf" stroke-dasharray="5 4"/>
<circle cx="860.6" cy="513" r="9" class="skr fp"/>
<line x1="854.2" y1="519.4" x2="867" y2="506.6" class="skr"/>
${txt(860, 626, 'ui-router-server takes NO stud on this plate —', 'lblr', 'middle')}
${txt(860, 638, '@uirouter/core is an OPTIONAL peer for it', 'lblr', 'middle')}

${txt(968, 668, 'THE SECOND PLATE — the same core, headless', 'lbls')}
${txt(968, 680, 'peerDependenciesMeta marks core optional; simulate.ts does', 'lblf')}
${txt(968, 692, 'new UIRouter() + plugin(servicesPlugin) + plugin(memoryLocationPlugin),', 'lblf')}
${txt(968, 704, 'reached only through a lazy import — so the default ‘matcher’', 'lblf')}
${txt(968, 716, 'tier ships with no plate at all, and never loads one', 'lblf')}

${txt(700, 752, 'no brick touches another brick — except 3, and even that seats on a published seam', 'lbla', 'middle')}`;

// ---- structure schedule ------------------------------------------------------------------
const ART_H = 766;
const SCHED = [
  [
    ` 0  ${CORE[0]} ${CORE[1]} — THE BASEPLATE · ${CORE[2]}f · ${fmt(CORE[3])} sloc · NOT MASSED (a plate is ground) · studs A–E are its published API`,
    '    every brick on this sheet declares it as a peerDependency; none of them declares another brick, except 3 → 1',
  ],
  [
    ` 1  ${B(1).name} ${B(1).ver} · ${B(1).files}f · ${fmt(B(1).sloc)} sloc · ${shapeName(B(1).shape)} · ${B(1).courses} courses · studs A · B · D`,
    '    class UIRouterLit extends UIRouter — moulded, not snapped; everything lit-specific enters through published seams:',
    '    this.plugin(servicesPlugin) · this.stateRegistry.decorator(‘views’, litViewsBuilder) · urlService.listen()/sync() · viewService._pluginapi._viewConfigFactory(‘lit’, …) (internal)   [src/core.ts]',
  ],
  [
    ` 2  ${B(2).name} ${B(2).ver} · ${B(2).files}f · ${fmt(B(2).sloc)} sloc · ${shapeName(B(2).shape)} · ${B(2).courses} course · stud A (LOCATION SEAT)`,
    '    navigationLocationPlugin = locationPluginFactory(‘vanilla.navigationLocation’, true, NavigationLocationService, BrowserLocationConfig)',
    '    a router holds exactly one location plugin, so this brick SWAPS core’s pushStateLocation; it peers core only — it has never heard of Lit   [src/index.ts]',
  ],
  [
    ` 3  ${B(3).name} ${B(3).ver} · ${B(3).files}f · ${fmt(B(3).sloc)} sloc · ${shapeName(B(3).shape)} · ${B(3).courses} courses · seats on brick 1 · studs C · E`,
    '    RouterStore.attach() → router.transitionService.onSuccess({}, update); update() reads globals.current/.params/.successfulTransitions',
    '    RouterReactionController → UIRouterLitElement.seekRouter(host), the ui-router-context event — the one brick-to-brick coupling in the set   [src/router-store.ts, src/router-reaction-controller.ts]',
  ],
  [
    ` 4  ${B(4).name} ${B(4).ver} · ${B(4).files}f · ${fmt(B(4).sloc)} sloc · ${shapeName(B(4).shape)} · ${B(4).courses} courses · NO STUD on this plate`,
    '    peerDependenciesMeta: { ‘@uirouter/core’: { optional: true } } — the ‘matcher’ tier is dependency-free pattern matching',
    '    the ‘simulate’ tier reaches a plate of its own behind a lazy import(): new UIRouter() + plugin(servicesPlugin) + plugin(memoryLocationPlugin)   [src/index.ts, src/simulate.ts]',
  ],
  [
    ` 5  ${LINT.name} ${LINT.version} · ${LINT.files}f · ${fmt(LINT.sloc)} sloc · NOT DRAWN — no stud on any router plate`,
    '    a lint package: it plugs into ESLint/oxlint hosts, never into @uirouter/core — the set’s fifth published part lives on a different table',
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
${txt(58, SY + 60 + ROWS.length * 17, `TOTAL — 4 bricks · ${TOT_F} authored files · ${fmt(TOT_L)} sloc, standing on one ${CORE[2]}-file, ${fmt(CORE[3])}-line baseplate · ${COUNTED}, same basis as sheets 3 and 4`, 'lbls')}`;

const svg = `<svg viewBox="0 0 1400 ${SY + 110 + ROWS.length * 17}" role="img" aria-label="An exploded isometric LEGO assembly. A large flat baseplate lettered @uirouter/core carries a grid of studs; its whole back row is ringed in the accent colour and labelled A, router.plugin — the plugin rail. Four bricks hover above the plate, none of them seated, each with a dashed accent drop line falling onto the exact stud it takes. Brick 1, lit-ui-router, is a two-by-four ${B(1).courses} courses tall and drops onto the rail; brick 2, the navigation location plugin, is a one-by-one one course tall and drops onto a single stud ringed in red, the location seat, of which a router has exactly one — so this brick swaps core's own location plugin rather than adding to it. Brick 3, lit-ui-router-mobx, is a one-by-two two courses tall and is the only brick that does not drop onto the plate at all: its drop line lands on a stud on top of brick 1, and two further named studs on the plate, C transitionService and E globals, carry the hook it registers and the values it reads. Four more named studs along the front of the plate are lettered and explained in a stud schedule at the upper right. At the right of the sheet a second, smaller baseplate is drawn entirely in dashed line: brick 4, ui-router-server, hovers over it, and a dashed tie between the two plates is crossed out with a red circle and slash — the server takes no stud on the client plate, because @uirouter/core is an optional peer for it and its default matcher tier never loads a plate at all. A parts callout at the upper left lists the four bricks with their shapes, and a dashed spare-parts box below it shows four ghost one-by-one bricks — visualizer, sticky-states, dsr and rx — that would register through the very same stud A. A structure schedule beneath the drawing gives every brick its file count, line count, quantized shape and the exact API call it couples through.">
${defs(P)}

${txt(1370, 16, 'SCALE — plan = whole studs (1 stud per 150 sloc, rounded up to the next standard brick shape) · height = one course per 3 authored files · the baseplate is not massed', 'lbls', 'end')}
${txt(1370, 30, 'COUPLING IS THE SUBJECT — accent marks a published extension point; the bricks themselves are drawn plain', 'lblf', 'end')}

${partsBox}
${spareBox}
${studBox}

${clientPlate}
${drops}
${clientBricks}

${serverIsland}
${lettering}

${schedule}
</svg>`;

export const sheet2 = {
  num: 2, id: 'companions', rev: 'B',
  title: 'THE BRICK ASSEMBLY',
  sub: `ALTITUDE 2 — one baseplate, four bricks, ${TOT_F} authored files · REV B: the companions redrawn as an exploded LEGO assembly, every coupling named to its API call, source ${COUNTED}`,
  scale: 'FOUR PACKAGES',
  form: 'BRICK ASSEMBLY',
  svg,
  caption: 'Every companion enters through a published stud on @uirouter/core, and no two of them touch. Drawn exploded, the sheet answers the only question that matters about a plugin architecture: pull any brick off and what breaks? Nothing — the studs stay where they are.',
  notes: `
<p><strong>Why bricks.</strong> Rev A drew these packages as sockets and panels and conceded the form broke. The mechanism they actually share is a <em>standardised coupling</em>: each companion attaches to <code>@uirouter/core</code> through a published extension point, none of them attaches to another, and any one can be left in the box without disturbing the rest. That is a stud, and a stud is worth drawing. So this is an exploded isometric — the LEGO instruction manual's own idiom — with a numbered part per package, a drop line onto the exact stud it takes, and a parts callout. Nothing is drawn seated, because a seated assembly hides the undersides, and the undersides are the argument.</p>
<p><strong>The plate is core, not this package.</strong> Sheet 4's finding decides it: every limb in the family declares <code>@uirouter/core</code> as a peer and touches nothing else. <code>lit-ui-router</code> is therefore brick 1, not the ground — and the drawing is honest about the one place the metaphor strains: <code>class UIRouterLit extends UIRouter</code> is moulded onto the plate, not snapped to it. What the drawing then shows is that the graft is thin anyway. Everything Lit-specific arrives through two published seams — <code>this.plugin(servicesPlugin)</code> and <code>this.stateRegistry.decorator('views', litViewsBuilder)</code> — plus <code>urlService.listen()/sync()</code> to start the thing. Three calls, and one internal seam — <code>viewService._pluginapi._viewConfigFactory('lit', …)</code> — that core does not publish. That is the whole renderer coupling.</p>
<p><strong>One stud is a seat, not a socket.</strong> <code>router.plugin()</code> is the back rail: a single method that anything may queue on, which is why the spare-parts box is drawn at all — <code>@uirouter/visualizer</code>, <code>sticky-states</code>, <code>dsr</code> and <code>rx</code> all register through it and none of them knows this repo exists. One seat on that rail is ringed red, because it behaves differently: a router holds <em>exactly one</em> location plugin, so <code>ui-router-navigation-location-plugin</code> is a <em>swap</em> for core's <code>pushStateLocation</code>, never an addition. That package peers <code>@uirouter/core</code> and nothing else — it has never heard of Lit, and would work identically under the React or Angular adapters.</p>
<p><strong>Brick 3 is the only brick-to-brick coupling in the set, and it is a small one.</strong> <code>lit-ui-router-mobx</code> seats on brick 1 through <code>UIRouterLitElement.seekRouter(host)</code> — a bubbling <code>ui-router-context</code> event, published precisely as the dependency-injection primitive for external reactivity systems — and then reaches the plate directly: one <code>transitionService.onSuccess({}, update)</code> hook, memoised one-per-router by <code>RouterStore.for()</code>, whose <code>update()</code> reads <code>globals.current</code>, <code>globals.params</code> and the last successful transition into MobX observables. It observes; it never writes router state. ${fmt(B(3).sloc)} lines, one stud on the brick above and two on the plate below.</p>
<p><strong>The fourth brick has no stud here at all, and that is the design.</strong> <code>ui-router-server</code> declares <code>@uirouter/core</code> as an <em>optional</em> peer (<code>peerDependenciesMeta</code>); its default <code>'matcher'</code> tier is dependency-free pattern matching and never loads core, and its <code>'simulate'</code> tier reaches a plate of its own behind a lazy <code>import()</code> — <code>new UIRouter()</code> with <code>servicesPlugin</code> and <code>memoryLocationPlugin</code>, built fresh per resolution because core mutates registrations. Drawing it over a dashed second plate is the only truthful placement: it is the same mould, a different assembly, and the tie back to the client plate is crossed out.</p>
<p><strong>Massing, quantized.</strong> Continuous mass would have made these bricks unbuildable shapes, so the census is rounded to LEGO: <em>plan</em> is one stud per 150 sloc rounded up to the next standard shape (1×1, 1×2, 2×2, 2×3, 2×4), <em>height</em> is one course per three authored files. The result is legible and it is a finding — the two bricks that carry a renderer and a server are 2×4s; the two that plug the router into something are a 1×1 and a 1×2 tile, ${fmt(B(2).sloc)} and ${fmt(B(3).sloc)} lines. A companion that needed to be a 2×4 would be <code>lit-ui-router</code>'s problem to absorb, not a package. The baseplate is deliberately <em>not</em> massed: ${CORE[2]} files and ${fmt(CORE[3])} lines of core is ground, and ground has no height.</p>
<p><strong>The fifth published package is not a brick.</strong> <code>eslint-plugin-lit-ui-router</code> ${LINT.version} (${LINT.files} files, ${fmt(LINT.sloc)} sloc) ships from this repo alongside the four drawn here, but it takes no stud on any router plate: it couples to ESLint and oxlint, not to <code>@uirouter/core</code>, so it is scheduled as row 5 and left off the drawing. Every number on this sheet is read from <code>diagrams/data/census-bricks.json</code> — ${COUNTED}.</p>`,
  key: [
    keyRow('<polygon points="4,12 16,5 30,12 30,16 16,9 4,16" class="sk fp"/><ellipse cx="10" cy="8" rx="4" ry="2.3" class="sk fp2"/><ellipse cx="24" cy="8" rx="4" ry="2.3" class="sk fp2"/>', 'a published package — plan ∝ quantized sloc, courses ∝ files'),
    keyRow('<ellipse cx="24" cy="9" rx="6" ry="3.5" class="ska fp"/><ellipse cx="24" cy="9" rx="11" ry="6.5" class="ska fnone"/>', 'a stud — a published extension point on @uirouter/core'),
    keyRow('<ellipse cx="24" cy="9" rx="6" ry="3.5" class="skr fp"/><ellipse cx="24" cy="9" rx="11" ry="6.5" class="skr fnone"/>', 'the location seat — exactly one per router, so it swaps'),
    keyRow('<line x1="24" y1="2" x2="24" y2="16" class="ska" stroke-dasharray="6 4"/><circle cx="24" cy="16" r="2.2" class="fa"/>', 'drop line — the brick falls onto that stud'),
    keyRow('<rect x="4" y="4" width="40" height="11" class="sks fnone" stroke-dasharray="6 4"/>', 'a second plate — optional peer, reached by lazy import'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="skf" stroke-dasharray="5 4"/><circle cx="23" cy="9" r="6" class="skr fp"/><line x1="19" y1="13" x2="27" y2="5" class="skr"/>', 'no coupling — the server takes no stud on this plate'),
    keyRow('<polygon points="8,12 16,7 26,12 26,15 16,10 8,15" class="sks fp" stroke-dasharray="3 2"/>', 'spare part — same stud, not in this set (sheet 4)'),
  ].join('\n'),
};

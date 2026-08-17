import { defs } from './chrome.mjs';
import { txt, lines, box, arrow, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's1';
const OX = 300, OY = 120;

const pt = (x, y, z = 0) => isoPt(OX, OY, x, y, z);
// A loop leg routed as a road on the iso grid: plan-space waypoints along the
// two iso axes, projected, then trimmed in screen space so both ends float
// free of the walls they connect.
const road = (wps, mk = 'ai', cls = 'sk2', dash = '', t0 = 7, t1 = 9) => {
  const pts = wps.map(([x, y, z = 0]) => pt(x, y, z));
  const trim = (a, b, d) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    return [a[0] + (dx / L) * d, a[1] + (dy / L) * d];
  };
  pts[0] = trim(pts[0], pts[1], t0);
  pts[pts.length - 1] = trim(pts[pts.length - 1], pts[pts.length - 2], t1);
  const d = 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' L');
  return arrow(P, d, mk, cls, dash);
};

// Thin floating plate (Tilt-style DOM layer): no mast, unlike isoBlock.
const plate = (x, y, w, d, z, h = 3, edge = 'sk', cap = 'fp', sideFill = 'var(--paper-2)') => {
  const p4 = (px, py, pz) => pt(px, py, pz).map((v) => v.toFixed(1)).join(',');
  const t = z + h;
  const top = [p4(x, y, t), p4(x + w, y, t), p4(x + w, y + d, t), p4(x, y + d, t)].join(' ');
  const left = [p4(x, y + d, t), p4(x + w, y + d, t), p4(x + w, y + d, z), p4(x, y + d, z)].join(' ');
  const right = [p4(x + w, y, t), p4(x + w, y + d, t), p4(x + w, y + d, z), p4(x + w, y, z)].join(' ');
  return `<g><polygon points="${left}" class="${edge}" fill="${sideFill}"/>
<polygon points="${right}" class="${edge}" fill="${sideFill}"/>
<polygon points="${top}" class="${edge} ${cap}"/></g>`;
};

// Scene blocks, painter-ordered back to front. Spread wide — labels get their own air.
const scene = [
  // LOCATION gatehouse
  isoBlock(P, OX, OY, 20, 60, 90, 60, 28),
  // CORE plant (tallest — the machine)
  isoBlock(P, OX, OY, 260, 0, 115, 80, 56),
  // uiSrefActive watchtower (elevated overlay, above the whole stack)
  isoBlock(P, OX, OY, 10, 240, 55, 40, 18, { z0: 104 }),
  // TransitionController skybridge (elevated instrument)
  isoBlock(P, OX, OY, 470, -45, 65, 38, 16, { z0: 60 }),
  // TRANSITION hall with three bays
  isoBlock(P, OX, OY, 460, 40, 150, 60, 34),
  // THE DOCUMENT — the metaphor break: a browser window whose DOM rises as plates
  plate(80, 245, 340, 135, 0, 4),
  // DOM layers rising from the window — exaggerated gaps, Tilt-style exploded view
  plate(100, 268, 300, 100, 22),
  plate(125, 283, 250, 72, 44),
  plate(150, 296, 200, 48, 66, 3, 'sk', 'fp2'),
  // sibling content on the top layer (scenery)
  plate(265, 300, 55, 22, 88, 3, 'skf', 'fnone', 'none'),
  plate(250, 326, 62, 16, 88, 3, 'skf', 'fnone', 'none'),
  // the <a data-uisref> element — top of the stack
  plate(170, 304, 64, 26, 88, 4),
  // ui-view parent + child stacked on its roof (containment)
  isoBlock(P, OX, OY, 700, 120, 95, 70, 30),
  isoBlock(P, OX, OY, 718, 138, 48, 36, 22, { z0: 30 }),
  // LIT RENDER
  isoBlock(P, OX, OY, 640, 300, 105, 60, 26),
].join('\n');

// Hall bay ridges on the roof
const ridges = [50, 100].map((o) => {
  const [x1, y1] = pt(460 + o, 40, 34);
  const [x2, y2] = pt(460 + o, 100, 34);
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="skf"/>`;
}).join('\n');

// Loop legs, routed as roads on the iso grid: every turn is along an iso axis.
// End trims are measured against the SILHOUETTE (roofs overhang their walls in
// projection, and roads draw under the scene), not the plan face they aim at.
const legs = [
  road([[110, 70], [260, 70]], 'ai', 'sk2', '', 7, 21),
  road([[375, 60], [460, 60]], 'ai', 'sk2', '', 7, 45),
  road([[600, 100], [600, 148], [700, 148]], 'ai', 'sk2', '', 7, 41),
  road([[722, 190], [722, 300]], 'ai', 'sk2', '', 7, 35),
  road([[640, 332], [420, 332]], 'ai', 'sk2', '', 7, 18),
];

// Click return: an elevated accent arc from the link plate back into location's flank
// flares right of the plate stack and the leg-1 road, then settles onto LOCATION's roof
const clickArc = arrow(P, 'M239.4,294 C 330,270 325,165 300,180', 'aa', 'ska');

// Bubbling: uiSrefTarget rises from the link plate to the watchtower above the stack
const [bx, by] = pt(170, 330, 92);
const bubbleArc = arrow(P, `M${bx.toFixed(1)},${(by - 3).toFixed(1)} C 146,240 130,212 118,194`, 'as', 'sks', '4 3');

// Skybridge tap into a hall bay
const tap = arrow(P, `M758,326 L735,366`, 'as', 'sks', '4 3');

const svg = `<svg viewBox="-150 0 1300 790" role="img" aria-label="The lit-ui-router render loop drawn as a spread-out isometric scene, client-side only: a location gatehouse feeds the core matching plant, a transition hall with hook bays, a ui-view building with its child view stacked on its roof, and a Lit render hall that commits onto the document. The loop itself runs as roads on the isometric grid — each leg turns along the grid axes rather than cutting across it, and every arrowhead stops short of the wall it points at — which alone breaks the city metaphor: it is drawn as a browser window whose DOM rises as stacked translucent plates, Firefox-Tilt style, with the uiSref link as the topmost plate. A click on that plate flies back to location as an elevated arc; uiSrefTarget events rise past the plates to a watchtower; a TransitionController skybridge taps the hall from above. Five entry doors line the bottom edge.">
${defs(P)}

${legs.join('\n')}
${scene}
${ridges}
${clickArc}
${bubbleArc}
${tap}

<!-- station lettering: every label in its own pocket of air -->
${txt(278, 110, 'LOCATION', 'lblb', 'middle')}
${txt(278, 123, 'history · hash · Navigation API', 'lblf', 'middle')}
${txt(525, 158, '@uirouter/core', 'lblb', 'middle')}
${txt(525, 171, 'state registry · match · go()', 'lblf', 'middle')}
${txt(555, 474, 'TRANSITION HALL', 'lblb', 'middle')}
${txt(555, 488, 'onBefore | onStart · resolve | onSuccess', 'lblf', 'middle')}
${txt(760, 236, 'TransitionController', 'lblb', 'middle')}
${txt(760, 249, 'ReactiveController skybridge', 'lblf', 'middle')}
${txt(786, 358, 'registers hooks', 'lblf', 'start')}
${txt(806, 424, `<ui-view name='detail'>`, 'lbls', 'start')}
${txt(896, 552, '<ui-view>', 'lblb', 'start')}
${txt(633, 690, 'LIT RENDER', 'lblb', 'middle')}
${txt(633, 703, 'RoutedLitTemplate · html\`\`', 'lblf', 'middle')}
${txt(95, 100, 'uiSrefActive', 'lblb', 'middle')}
${txt(95, 112, 'perch — toggles .active below', 'lblf', 'middle')}
${txt(26, 290, 'uiSrefTarget', 'lblf', 'start')}
${txt(26, 301, 'bubbles up', 'lblf', 'start')}
${txt(334, 322, 'scenery — your content', 'lblf', 'start')}
<line x1="330" y1="325" x2="302" y2="330" class="skf"/>
${txt(170, 538, 'THE DOCUMENT — a browser window at /people', 'lbls', 'middle')}
${txt(170, 552, 'its DOM rising in plates: body → shell → <ui-view> → <a>', 'lblf', 'middle')}

<!-- WINDOW DETAIL inset — the flat window the plates explode out of -->
<line x1="205" y1="574" x2="240" y2="560" class="skf"/>
<rect x="60" y="576" width="220" height="86" class="sk fp"/>
<rect x="60" y="576" width="220" height="22" class="sk fp2"/>
<circle cx="71" cy="587" r="2.4" class="fis"/>
<circle cx="80" cy="587" r="2.4" class="fis"/>
<circle cx="89" cy="587" r="2.4" class="fis"/>
<rect x="98" y="579" width="176" height="16" class="skf fp"/>
${txt(104, 590.5, 'lit-ui-router.dev/people/32', 'lblf', 'start')}
<line x1="72" y1="612" x2="252" y2="612" class="skf"/>
<line x1="72" y1="626" x2="196" y2="626" class="skf"/>
<rect x="72" y="637" width="64" height="12" class="ska fnone"/>
${txt(142, 646.5, '← the link, in situ', 'lblf', 'start')}
${txt(60, 674, 'DETAIL — the same window, flat', 'lbls', 'start')}

<!-- leg lettering: horizontal, in open pockets, leaders where the gap is wide -->
${txt(355, 272, 'popstate / navigate', 'lbls', 'middle')}
${txt(560, 398, 'match → run', 'lbls', 'middle')}
<line x1="575" y1="390" x2="596" y2="360" class="skf"/>
${txt(700, 540, 'viewconfigs activate', 'lbls', 'end')}
<line x1="704" y1="536" x2="722" y2="513" class="skf"/>
${txt(652, 551, 'state.component / template', 'lbls', 'end')}
<line x1="658" y1="556" x2="713" y2="596" class="skf"/>
${txt(452, 592, 'directives commit', 'lbls', 'middle')}
<line x1="492" y1="585" x2="510" y2="572" class="skf"/>

<!-- the link + click note, off the stack with a leader to the link plate -->
${txt(-140, 404, '<a href=/people/32>', 'lbl', 'start')}
${txt(-140, 417, 'uiSref(…) element part', 'lbla', 'start')}
${txt(-140, 438, 'click →', 'lbla', 'start')}
${txt(-140, 451, 'stateService.go()', 'lbla', 'start')}
${txt(-140, 464, '→ pushState', 'lbla', 'start')}
<line x1="-4" y1="396" x2="169" y2="292" class="skf"/>

<!-- five doors -->
<line x1="-140" y1="720" x2="1140" y2="720" class="skf"/>
${txt(-140, 738, 'FIVE DOORS INTO THE SAME MACHINE', 'lbls')}
${[
  ['.', 'registers everything', true],
  ['./pure', 'no side effects', false],
  ['./register', 'all elements', true],
  ['./ui-router.register', 'one element', true],
  ['./ui-view.register', 'one element', true],
].map(([name, sub, se], i) => {
  const x = 190 + i * 152;
  return `${box(x, 726, 144, 30, se ? 'sk fp2' : 'ska fp')}
${txt(x + 8, 739, name, se ? 'lbls' : 'lbla')}
${txt(x + 8, 751, sub, 'lblf')}`;
}).join('\n')}
</svg>`;

export const sheet1 = {
  num: 1, id: 'package', rev: 'D',
  title: 'THE RENDER LOOP',
  sub: 'ALTITUDE 1 — lit-ui-router 1.9.0 · the client circuit · REV D: the loop routed on the iso grid',
  scale: 'ONE PACKAGE',
  form: 'ISO CIRCUIT',
  svg,
  caption: 'Rev D puts the loop on the ground: every leg is a road that turns along the iso axes and stops short of the wall it points at. The city still breaks its metaphor once, on purpose: the document is not a building — it is a browser window whose DOM rises in plates. The core matches, the hall runs its hook bays, Lit commits onto a layer, and a click on the topmost plate flies back to location.',
  notes: `
<p><strong>Why redraw a 2D loop in 3D:</strong> the cycle itself is flat, but the third axis is free to carry the relations flat arrows kept fumbling. Containment: the child <code>&lt;ui-view&gt;</code> literally stands on its parent's roof — nesting is stacking, not a box-in-a-box. Propagation: <code>uiSrefTarget</code> events <em>rise</em> past the document's plates to the <code>uiSrefActive</code> perch, which is how link tracking works — no registry, just bubbling. Instrumentation: <code>TransitionController</code> is a skybridge that taps the hall without standing on the route.</p>
<p><strong>The document breaks the metaphor on purpose.</strong> Every other station is a building; the document is drawn the way Firefox's old Tilt inspector drew it — a browser window whose DOM rises as stacked plates by depth, window → body → app shell → <code>&lt;ui-view&gt;</code> content → the <code>&lt;a&gt;</code> element on top. It is the one structure on this sheet that really is layered, so it alone earns the literal treatment.</p>
<p><strong>Service discovery is still DOM events.</strong> A nested view finds its parent with a composed context CustomEvent; every <code>uiSref</code> announces its <code>targetState</code> upward. The document tree is the dependency graph — which is exactly why the drawing can stand everything in one window.</p>
<p><strong>The five doors are one seam.</strong> The bare entry registers custom elements as a side effect; <code>./pure</code> is the same API with registration torn off. <code>sideEffects</code> in the manifest names exactly the four register files.</p>`,
  key: [
    keyRow('<line x1="2" y1="9" x2="40" y2="9" class="sk2"/>', 'the render loop (roads on the iso grid)'),
    keyRow('<line x1="2" y1="14" x2="40" y2="4" class="ska"/>', 'the click flying back to location'),
    keyRow('<line x1="2" y1="14" x2="40" y2="4" class="sks" stroke-dasharray="4 3"/>', 'events rising / hook taps'),
    keyRow('<polygon points="8,13 22,8 36,13 22,18" class="sk fp"/><polygon points="8,7 22,2 36,7 22,12" class="sk fp2"/>', 'plates = DOM depth (window → link)'),
    keyRow('<rect x="10" y="2" width="24" height="8" class="sk fp"/><line x1="34" y1="10" x2="34" y2="16" class="sks" stroke-dasharray="2 3"/>', 'elevated = overlay, not on the route'),
    keyRow('<polygon points="8,12 22,6 36,12 22,18" class="skf fnone"/>', 'faint plate = scenery (your content)'),
  ].join('\n'),
};

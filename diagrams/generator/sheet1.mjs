import { defs } from './chrome.mjs';
import { txt, lines, box, arrow, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's1';
const OX = 300, OY = 118;

const pt = (x, y, z = 0) => isoPt(OX, OY, x, y, z);
const ga = (a, b, mk = 'ai', cls = 'sk2', dash = '') => {
  const [x1, y1] = pt(a[0], a[1], a[2] ?? 0);
  const [x2, y2] = pt(b[0], b[1], b[2] ?? 0);
  return arrow(P, `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`, mk, cls, dash);
};

// Scene blocks, painter-ordered back to front.
const scene = [
  // LOCATION gatehouse
  isoBlock(P, OX, OY, 40, 40, 90, 60, 28),
  // CORE plant (tallest — the machine)
  isoBlock(P, OX, OY, 205, 15, 115, 80, 56),
  // THE DOCUMENT floor
  isoBlock(P, OX, OY, 60, 205, 400, 140, 6),
  // uiSrefActive watchtower (elevated overlay)
  isoBlock(P, OX, OY, 30, 235, 55, 40, 18, { z0: 46 }),
  // <a> kiosk on the floor
  isoBlock(P, OX, OY, 105, 245, 85, 45, 16, { z0: 6 }),
  // ghost content on the floor (scenery)
  isoBlock(P, OX, OY, 240, 245, 60, 40, 10, { z0: 6, edge: 'skf' }),
  isoBlock(P, OX, OY, 320, 300, 70, 40, 8, { z0: 6, edge: 'skf' }),
  // TransitionController skybridge (elevated instrument)
  isoBlock(P, OX, OY, 430, -25, 65, 38, 16, { z0: 54 }),
  // TRANSITION hall with three bays
  isoBlock(P, OX, OY, 385, 30, 150, 60, 34),
  // ui-view parent + child stacked on its roof (containment)
  isoBlock(P, OX, OY, 600, 60, 95, 70, 30),
  isoBlock(P, OX, OY, 618, 78, 48, 36, 22, { z0: 30 }),
  // LIT RENDER
  isoBlock(P, OX, OY, 585, 215, 105, 60, 26),
].join('\n');

// Hall bay ridges on the roof
const ridges = [50, 100].map((o) => {
  const [x1, y1] = pt(385 + o, 30, 34);
  const [x2, y2] = pt(385 + o, 90, 34);
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="skf"/>`;
}).join('\n');

// Loop legs (ground)
const legs = [
  ga([132, 72], [202, 60]),
  ga([322, 58], [383, 60]),
  ga([537, 62], [598, 82]),
  ga([652, 132], [640, 212]),
  ga([583, 250], [464, 254]),
];

// Click return: an elevated accent arc from the link back to location
const [kx, ky] = pt(148, 268, 22);
const [lx2, ly2] = pt(88, 74, 28);
const clickArc = arrow(P, `M${kx.toFixed(1)},${ky.toFixed(1)} C 120,236 140,166 ${lx2.toFixed(1)},${(ly2 + 6).toFixed(1)}`, 'aa', 'ska');

// Bubbling: uiSrefTarget rises from the link to the watchtower
const [bx, by] = pt(170, 250, 22);
const [tx2, ty2] = pt(70, 262, 64);
const bubbleArc = arrow(P, `M${bx.toFixed(1)},${(by - 4).toFixed(1)} C ${bx - 20},${by - 52} ${tx2 + 40},${ty2 - 26} ${(tx2 + 8).toFixed(1)},${(ty2 + 2).toFixed(1)}`, 'as', 'sks', '4 3');

// Skybridge tap into the hall roof
const [sbx, sby] = pt(455, 8, 54);
const [hx2, hy2] = pt(465, 48, 34);
const tap = arrow(P, `M${sbx.toFixed(1)},${sby.toFixed(1)} L${hx2.toFixed(1)},${hy2.toFixed(1)}`, 'as', 'sks', '4 3');

const lbl = (x, y, z, s, cls = 'lblb', anchor = 'middle', dy = -8) => {
  const [sx, sy] = pt(x, y, z);
  return txt(sx.toFixed(1), (sy + dy).toFixed(1), s, cls, anchor);
};

const svg = `<svg viewBox="0 0 1150 660" role="img" aria-label="The lit-ui-router render loop drawn as an isometric scene, client-side only: a location gatehouse feeds the core matching plant, a transition hall with three hook bays, a ui-view building with its child view stacked on its roof, and a Lit render hall that commits down onto the document floor — where a click on a uiSref link flies back to location as an elevated arc. A watchtower catches rising uiSrefTarget events, and a TransitionController skybridge taps the hall from above. Five entry doors line the bottom edge.">
${defs(P)}

${legs.join('\n')}
${scene}
${ridges}
${clickArc}
${bubbleArc}
${tap}

<!-- station lettering -->
${lbl(85, 40, 28, 'LOCATION')}
${lbl(85, 40, 28, 'history · hash · Navigation API', 'lblf', 'middle', 6)}
${lbl(262, 15, 56, '@uirouter/core')}
${lbl(262, 15, 56, 'state registry · match · go()', 'lblf', 'middle', 6)}
${lbl(460, 30, 34, 'TRANSITION HALL')}
${lbl(460, 30, 34, 'onBefore | onStart · resolve | onSuccess', 'lblf', 'middle', 6)}
${lbl(647, 60, 30, '<ui-view>')}
${lbl(642, 78, 52, `<ui-view name='detail'>`, 'lbls', 'middle', -6)}
${lbl(637, 215, 26, 'LIT RENDER')}
${lbl(637, 215, 26, 'RoutedLitTemplate · html``', 'lblf', 'middle', 6)}
${lbl(147, 245, 22, '<a href=/people/32>', 'lbl', 'middle', -6)}
${lbl(147, 245, 22, 'uiSref(…) element part', 'lbla', 'middle', 6)}
${lbl(57, 235, 64, 'uiSrefActive', 'lblb', 'middle', -6)}
${lbl(57, 235, 64, 'perch — toggles .active below', 'lblf', 'middle', 6)}
${lbl(462, -25, 70, 'TransitionController', 'lblb', 'middle', -6)}
${lbl(462, -25, 70, 'ReactiveController skybridge', 'lblf', 'middle', 6)}
${lbl(290, 345, 0, 'THE DOCUMENT — the only stage this circuit needs', 'lbls', 'middle', 16)}
${lbl(270, 245, 16, 'rendered content', 'lblf', 'middle', 24)}

<!-- leg lettering -->
${lbl(165, 40, 0, 'popstate / navigate', 'lbls', 'middle', -4)}
${lbl(352, 36, 0, 'match → run', 'lbls', 'middle', -4)}
${lbl(575, 46, 0, 'viewconfigs activate', 'lbls', 'middle', -12)}
${lbl(668, 175, 0, 'state.component / template', 'lbls', 'start', 0)}
${lbl(520, 262, 0, 'directives commit', 'lbls', 'middle', 14)}
${txt(96, 210, 'click →', 'lbla')}
${txt(96, 223, 'stateService.go()', 'lbla')}
${txt(96, 236, '→ pushState', 'lbla')}
${txt(214, 236, 'uiSrefTarget', 'lblf')}
${txt(214, 247, 'bubbles up', 'lblf')}
${txt(716, 200, 'registers hooks', 'lblf')}

<!-- five doors -->
<line x1="40" y1="576" x2="1110" y2="576" class="skf"/>
${txt(40, 594, 'FIVE DOORS INTO THE SAME MACHINE', 'lbls')}
${[
  ['.', 'registers everything', true],
  ['./pure', 'no side effects', false],
  ['./register', 'all elements', true],
  ['./ui-router.register', 'one element', true],
  ['./ui-view.register', 'one element', true],
].map(([name, sub, se], i) => {
  const x = 330 + i * 152;
  return `${box(x, 582, 144, 30, se ? 'sk fp2' : 'ska fp')}
${txt(x + 8, 595, name, se ? 'lbls' : 'lbla')}
${txt(x + 8, 607, sub, 'lblf')}`;
}).join('\n')}
</svg>`;

export const sheet1 = {
  num: 1, id: 'package', rev: 'B',
  title: 'THE RENDER LOOP',
  sub: 'ALTITUDE 1 — lit-ui-router 1.9.0 · the client circuit · REV B: drawn isometric, browser-only',
  scale: 'ONE PACKAGE',
  form: 'ISO CIRCUIT',
  svg,
  caption: 'Rev B stages the same loop as a scene: a URL enters the gatehouse, the core matches, the hall runs its hook bays, views stack, Lit commits onto the document floor — and a click flies back to location to start the next revolution.',
  notes: `
<p><strong>Why redraw a 2D loop in 3D:</strong> the cycle itself is flat, but the third axis is free to carry the relations flat arrows kept fumbling. Containment: the child <code>&lt;ui-view&gt;</code> literally stands on its parent's roof — nesting is stacking, not a box-in-a-box. Propagation: <code>uiSrefTarget</code> events <em>rise</em> off the document floor to the <code>uiSrefActive</code> perch, which is how link tracking works — no registry, just bubbling. Instrumentation: <code>TransitionController</code> is a skybridge that taps the hall without standing on the route.</p>
<p><strong>Client-only by charter.</strong> Rev A carried a red server-side caveat; Rev B drops it. This circuit's stage is the document, full stop — the server story belongs to <code>ui-router-server</code> on sheet 2, where the same state tree answers requests with no floor at all.</p>
<p><strong>Service discovery is still DOM events.</strong> A nested view finds its parent with a composed context CustomEvent; every <code>uiSref</code> announces its <code>targetState</code> upward. The document tree is the dependency graph — which is exactly why the drawing can stand everything on one floor.</p>
<p><strong>The five doors are one seam.</strong> The bare entry registers custom elements as a side effect; <code>./pure</code> is the same API with registration torn off. <code>sideEffects</code> in the manifest names exactly the four register files.</p>`,
  key: [
    keyRow('<line x1="2" y1="9" x2="40" y2="9" class="sk2"/>', 'the render loop (ground legs)'),
    keyRow('<line x1="2" y1="14" x2="40" y2="4" class="ska"/>', 'the click flying back to location'),
    keyRow('<line x1="2" y1="14" x2="40" y2="4" class="sks" stroke-dasharray="4 3"/>', 'events rising / hook taps'),
    keyRow('<rect x="10" y="2" width="24" height="8" class="sk fp"/><line x1="34" y1="10" x2="34" y2="16" class="sks" stroke-dasharray="2 3"/>', 'elevated = overlay, not on the route'),
    keyRow('<rect x="10" y="5" width="24" height="10" class="skf fnone"/>', 'ghost = scenery (your app)'),
  ].join('\n'),
};

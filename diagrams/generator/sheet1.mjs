import { defs } from './chrome.mjs';
import { txt, lines, box, arrow, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's1';
const OX = 300, OY = 120;

const pt = (x, y, z = 0) => isoPt(OX, OY, x, y, z);
const ga = (a, b, mk = 'ai', cls = 'sk2', dash = '') => {
  const [x1, y1] = pt(a[0], a[1], a[2] ?? 0);
  const [x2, y2] = pt(b[0], b[1], b[2] ?? 0);
  return arrow(P, `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`, mk, cls, dash);
};

// Scene blocks, painter-ordered back to front. Spread wide — labels get their own air.
const scene = [
  // LOCATION gatehouse
  isoBlock(P, OX, OY, 20, 60, 90, 60, 28),
  // CORE plant (tallest — the machine)
  isoBlock(P, OX, OY, 260, 0, 115, 80, 56),
  // uiSrefActive watchtower (elevated overlay)
  isoBlock(P, OX, OY, 10, 240, 55, 40, 18, { z0: 50 }),
  // TransitionController skybridge (elevated instrument)
  isoBlock(P, OX, OY, 470, -45, 65, 38, 16, { z0: 60 }),
  // TRANSITION hall with three bays
  isoBlock(P, OX, OY, 460, 40, 150, 60, 34),
  // THE DOCUMENT floor
  isoBlock(P, OX, OY, 80, 240, 340, 140, 6),
  // <a> kiosk on the floor
  isoBlock(P, OX, OY, 150, 260, 85, 45, 16, { z0: 6 }),
  // ghost content on the floor (scenery)
  isoBlock(P, OX, OY, 350, 290, 55, 35, 10, { z0: 6, edge: 'skf' }),
  isoBlock(P, OX, OY, 320, 355, 60, 35, 8, { z0: 6, edge: 'skf' }),
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

// Loop legs (ground)
const legs = [
  ga([115, 90], [255, 45]),
  ga([380, 60], [455, 60]),
  ga([615, 105], [695, 125]),
  ga([745, 195], [710, 290]),
  ga([635, 335], [400, 320]),
];

// Click return: an elevated accent arc from the kiosk's right corner back into location's flank
const [kx, ky] = pt(235, 260, 22);
const clickArc = arrow(P, `M${kx.toFixed(1)},${(ky - 4).toFixed(1)} C 335,325 350,240 312,206`, 'aa', 'ska');

// Bubbling: uiSrefTarget rises from the link to the watchtower roof
const [bx, by] = pt(150, 260, 22);
const bubbleArc = arrow(P, `M${bx.toFixed(1)},${(by - 4).toFixed(1)} C 170,260 130,235 112,210`, 'as', 'sks', '4 3');

// Skybridge tap into a hall bay
const tap = arrow(P, `M762,320 L722,388`, 'as', 'sks', '4 3');

const svg = `<svg viewBox="0 0 1150 790" role="img" aria-label="The lit-ui-router render loop drawn as a spread-out isometric scene, client-side only: a location gatehouse feeds the core matching plant, a transition hall with hook bays, a ui-view building with its child view stacked on its roof, and a Lit render hall that commits down onto the document floor — where a click on a uiSref link flies back to location as an elevated arc. A watchtower catches rising uiSrefTarget events, and a TransitionController skybridge taps the hall from above. Five entry doors line the bottom edge.">
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
${txt(605, 474, 'TRANSITION HALL', 'lblb', 'middle')}
${txt(605, 488, 'onBefore | onStart · resolve | onSuccess', 'lblf', 'middle')}
${txt(760, 236, 'TransitionController', 'lblb', 'middle')}
${txt(760, 249, 'ReactiveController skybridge', 'lblf', 'middle')}
${txt(786, 358, 'registers hooks', 'lblf', 'start')}
${txt(806, 424, `<ui-view name='detail'>`, 'lbls', 'start')}
${txt(896, 552, '<ui-view>', 'lblb', 'start')}
${txt(633, 690, 'LIT RENDER', 'lblb', 'middle')}
${txt(633, 703, 'RoutedLitTemplate · html\`\`', 'lblf', 'middle')}
${txt(107, 156, 'uiSrefActive', 'lblb', 'middle')}
${txt(107, 168, 'perch — toggles .active below', 'lblf', 'middle')}
${txt(185, 262, 'uiSrefTarget', 'lblf', 'start')}
${txt(185, 273, 'bubbles up', 'lblf', 'start')}
${txt(290, 428, 'rendered content', 'lblf', 'middle')}
${txt(170, 538, 'THE DOCUMENT — the only stage this circuit needs', 'lbls', 'middle')}

<!-- leg lettering -->
${txt(392, 300, 'popstate / navigate', 'lbls', 'middle')}
${txt(560, 398, 'match → run', 'lbls', 'middle')}
${txt(735, 522, 'viewconfigs activate', 'lbls', 'end')}
${txt(802, 626, 'state.component / template', 'lbls', 'start')}
${txt(470, 562, 'directives commit', 'lbls', 'middle')}

<!-- the link + click note, off the floor with a leader to the kiosk -->
<rect x="24" y="393" width="180" height="82" class="fp"/>
${txt(30, 404, '<a href=/people/32>', 'lbl', 'start')}
${txt(30, 417, 'uiSref(…) element part', 'lbla', 'start')}
${txt(30, 438, 'click →', 'lbla', 'start')}
${txt(30, 451, 'stateService.go()', 'lbla', 'start')}
${txt(30, 464, '→ pushState', 'lbla', 'start')}
<line x1="198" y1="410" x2="232" y2="392" class="skf"/>

<!-- five doors -->
<line x1="40" y1="720" x2="1110" y2="720" class="skf"/>
${txt(40, 738, 'FIVE DOORS INTO THE SAME MACHINE', 'lbls')}
${[
  ['.', 'registers everything', true],
  ['./pure', 'no side effects', false],
  ['./register', 'all elements', true],
  ['./ui-router.register', 'one element', true],
  ['./ui-view.register', 'one element', true],
].map(([name, sub, se], i) => {
  const x = 330 + i * 152;
  return `${box(x, 726, 144, 30, se ? 'sk fp2' : 'ska fp')}
${txt(x + 8, 739, name, se ? 'lbls' : 'lbla')}
${txt(x + 8, 751, sub, 'lblf')}`;
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

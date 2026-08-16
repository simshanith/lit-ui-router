import { defs } from './chrome.mjs';
import { txt, lines, box, arrow, keyRow } from './helpers.mjs';

const P = 's1';

const svg = `<svg viewBox="0 0 1000 660" role="img" aria-label="The lit-ui-router render loop: location to core to transition to ui-view to lit templates to DOM, and back to location through uiSref clicks. The uiSref-to-DOM segment is marked as absent under server-side rendering.">
${defs(P)}

<!-- loop stations -->
${box(40, 60, 190, 78)}
${txt(52, 82, 'LOCATION', 'lblb')}
${lines(52, 100, ['history · hash ·', 'Navigation API'], 'lbls')}
${txt(52, 130, 'url: /people/32', 'lblf')}

${box(330, 40, 230, 98)}
${txt(342, 62, '@uirouter/core', 'lblb')}
${lines(342, 80, ['state registry · url rules', 'transitionService', 'stateService · globals'], 'lbls')}

${box(680, 60, 220, 108)}
${txt(692, 82, 'TRANSITION', 'lblb')}
${lines(692, 100, ['onBefore → onStart →', 'resolve · onEnter →', 'onSuccess / onError'], 'lbls')}

<!-- nested ui-view tree -->
${box(690, 300, 230, 140)}
${txt(702, 322, '<ui-view>', 'lblb')}
${txt(702, 338, 'custom element', 'lbls')}
${box(706, 350, 198, 76, 'sks fp2')}
${txt(716, 370, `<ui-view name='detail'>`, 'lbl')}
${lines(716, 388, ['parent found via composed', 'context CustomEvent'], 'lbls')}

${box(420, 480, 230, 84)}
${txt(432, 502, 'LIT RENDER', 'lblb')}
${lines(432, 520, ['RoutedLitTemplate · html``', 'directives commit to parts'], 'lbls')}

${box(70, 460, 240, 118)}
${txt(82, 482, 'DOM', 'lblb')}
${box(86, 494, 208, 44, 'sks fp2')}
${txt(96, 512, '<a href=/people/32>', 'lbl')}
${txt(96, 528, 'uiSref(…) element part', 'lbla')}
${txt(82, 566, 'href + targetState set on host', 'lbls')}

<!-- loop edges, clockwise -->
${arrow(P, 'M230,99 H322', 'ai', 'sk2')}
${txt(276, 90, 'popstate / navigate', 'lbls', 'middle')}
${arrow(P, 'M560,89 H672', 'ai', 'sk2')}
${txt(616, 80, 'match → run', 'lbls', 'middle')}
${arrow(P, 'M790,168 V292', 'ai', 'sk2')}
${lines(800, 216, ['resolves done,', 'viewconfigs', 'activate'], 'lbls')}
${arrow(P, 'M690,420 L658,478', 'ai', 'sk2')}
${lines(560, 444, ['state.component /', 'template'], 'lbls')}
${arrow(P, 'M420,522 H318', 'ai', 'sk2')}
${txt(368, 512, 'commit', 'lbls', 'middle')}
${arrow(P, 'M120,460 C110,300 116,220 130,146', 'aa', 'ska')}
${lines(30, 290, ['click →', 'stateService', '.go() →', 'pushState'], 'lbls')}

<!-- sidecar: TransitionController -->
${box(430, 200, 190, 62, 'sks fp')}
${txt(442, 220, 'TransitionController', 'lblb')}
${lines(442, 236, ['ReactiveController over', 'the hook registry'], 'lbls')}
${arrow(P, 'M620,228 C650,224 660,200 676,172', 'as', 'sks', '4 3')}
${txt(648, 200, 'registers hooks', 'lblf')}

<!-- sidecar: uiSrefActive -->
${box(150, 330, 200, 62, 'sks fp')}
${txt(162, 350, 'uiSrefActive', 'lblb')}
${lines(162, 366, ['toggles class when a linked', 'state is active'], 'lbls')}
${arrow(P, 'M210,460 V394', 'as', 'sks', '4 3')}
${txt(220, 430, 'uiSrefTarget bubbles ↑', 'lblf')}
${arrow(P, 'M350,352 C420,340 480,300 520,146', 'as', 'sks', '4 3')}
${txt(452, 290, 'observes globals.current', 'lblf')}

<!-- SSR-dead seam -->
<rect x="60" y="448" width="600" height="128" rx="6" class="skr fnone" stroke-dasharray="7 4"/>
<rect x="60" y="448" width="600" height="128" rx="6" fill="url(#${P}-hr)" opacity="0.35"/>
${txt(80, 600, 'DIES ON THE SERVER — @lit-labs/ssr skips element parts: uiSref renders no href in SSR output (#564)', 'lblr')}

<!-- five doors -->
<line x1="40" y1="616" x2="960" y2="616" class="skf"/>
${txt(40, 634, 'FIVE DOORS INTO THE SAME MACHINE', 'lbls')}
${[
  ['.', 'registers everything', true],
  ['./pure', 'no side effects', false],
  ['./register', 'all elements', true],
  ['./ui-router.register', 'one element', true],
  ['./ui-view.register', 'one element', true],
].map(([name, sub, se], i) => {
  const x = 290 + i * 142;
  return `${box(x, 622, 134, 30, se ? 'sk fp2' : 'ska fp')}
${txt(x + 8, 635, name, se ? 'lbls' : 'lbla')}
${txt(x + 8, 647, sub, 'lblf')}`;
}).join('\n')}
</svg>`;

export const sheet1 = {
  num: 1, id: 'package',
  title: 'THE RENDER LOOP',
  sub: 'ALTITUDE 1 — lit-ui-router 1.9.0 · 10 shipped modules · peers: lit + @uirouter/core',
  scale: 'ONE PACKAGE',
  form: 'CLOSED LOOP',
  svg,
  caption: 'One full revolution: a URL change is matched by @uirouter/core, run as a guarded transition, activated into the <ui-view> tree, rendered by Lit, and committed to the DOM — where a uiSref click starts the next revolution.',
  notes: `
<p><strong>The package is a circuit, not a component library.</strong> Every arrow on the main ring is mandatory; remove one and navigation stops. The two sidecars — <code>TransitionController</code> and <code>uiSrefActive</code> — tap the ring without being on it.</p>
<p><strong>Service discovery is DOM events.</strong> There is no registry: a nested <code>&lt;ui-view&gt;</code> finds its parent with a composed context CustomEvent, and <code>uiSrefActive</code> learns which links exist because every <code>uiSref</code> announces its <code>targetState</code> in a bubbling <code>uiSrefTarget</code> event. The document tree is the dependency graph.</p>
<p><strong>The five doors are one seam.</strong> The bare entry registers custom elements as a side effect; <code>./pure</code> is the same API with the registration torn off, for consumers who own their tag names. <code>sideEffects</code> in the manifest names exactly the four register files — the bundler sees the same seam the reader does.</p>
<p><strong>The red region is the honest defect.</strong> Under <code>@lit-labs/ssr</code>, element-part directives never run, so server output has links without <code>href</code>s until hydration (#564). The loop closes only in a browser.</p>`,
  key: [
    keyRow('<line x1="2" y1="9" x2="40" y2="9" class="sk2" marker-end=""/>', 'the render loop (data flow)'),
    keyRow('<line x1="2" y1="9" x2="40" y2="9" class="ska"/>', 'user navigation (uiSref click)'),
    keyRow('<line x1="2" y1="9" x2="40" y2="9" class="sks" stroke-dasharray="4 3"/>', 'event listening / hook taps'),
    keyRow('<rect x="2" y="2" width="40" height="14" class="skr fnone" stroke-dasharray="4 3"/>', 'absent under SSR'),
    keyRow('<rect x="2" y="2" width="40" height="14" class="sk fp2"/>', 'side-effectful entry'),
  ].join('\n'),
};

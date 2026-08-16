import { defs } from './chrome.mjs';
import { txt, lines, box, arrow, keyRow } from './helpers.mjs';

const P = 's2';

// Client stack slots
const stack = [
  ['BROWSER URL / HISTORY', null, 70, 44],
  ['LOCATION SERVICES', 'socket — default: pushState services', 134, 56],
  ['@uirouter/core', 'the state tree', 210, 60],
  ['LIT LAYER', '<ui-router> · <ui-view> · uiSref', 286, 56],
  ['DOM', null, 362, 44],
];

const svg = `<svg viewBox="-60 0 1060 660" role="img" aria-label="Three companion packages plugged into the lit-ui-router client stack and a parallel server lane: the Navigation API location plugin swaps into the location slot, the MobX package observes core state read-only, and ui-router-server runs the same core state tree against requests with no renderer.">
${defs(P)}

${txt(80, 52, 'CLIENT', 'lblt')}
${stack.map(([name, sub, y, h]) => `
${box(80, y, 250, h, name === 'LOCATION SERVICES' || name === '@uirouter/core' ? 'sk fp' : 'sk fp')}
${name === 'LOCATION SERVICES' ? `<rect x="88" y="${y + 26}" width="234" height="22" class="sks fnone" stroke-dasharray="4 3"/>` : ''}
${name === '@uirouter/core' ? `<rect x="88" y="${y + 38}" width="234" height="18" fill="url(#${P}-ha)"/>` : ''}
${txt(92, y + 18, name, 'lblb')}
${sub ? txt(92, y + (name === 'LOCATION SERVICES' ? 42 : (name === '@uirouter/core' ? 32 : 36)), sub, 'lbls') : ''}`).join('\n')}
${[114, 190, 270, 342].map((y) => arrow(P, `M205,${y} V${y + 18}`, 'ai', 'sk')).join('\n')}

<!-- socket notches on the stack edge -->
<path d="M330,150 h10 v24 h-10" class="sk fnone"/>
<path d="M330,226 h10 v24 h-10" class="sk fnone"/>

<!-- companion: navigation-location-plugin -->
${box(470, 80, 300, 128, 'sk fp')}
${txt(482, 100, 'ui-router-navigation-location-plugin', 'lblb')}
${txt(482, 114, '0.3.0', 'lbls')}
${lines(482, 136, [
  'WHAT  swaps the location slot for the',
  '      Navigation API (navigate/intercept)',
  'HOW   one module: LocationServices +',
  '      LocationConfig against navigation',
], 'lbls', 'start', 13)}
${txt(482, 196, 'CONDITION  pre-1.0; rides the Navigation API', 'lblr')}
${arrow(P, 'M470,166 H344', 'aa', 'ska')}
${txt(408, 156, 'plugs in', 'lbla', 'middle')}

<!-- companion: lit-ui-router-mobx -->
${box(470, 250, 300, 166, 'sk fp')}
${txt(482, 270, 'lit-ui-router-mobx', 'lblb')}
${txt(482, 284, '0.5.0', 'lbls')}
${lines(482, 306, [
  'WHAT  an observable RouterStore over',
  '      router state, for MobX apps',
  'HOW   reaction-based ReactiveControllers:',
  '      store change → requestUpdate()',
], 'lbls', 'start', 13)}
${lines(482, 360, ['CONDITION  pre-1.0; peer floor ^1.7.0', 'held by hand'], 'lblr')}
${txt(482, 404, 'OBSERVES — NEVER OWNS', 'lblf')}
${arrow(P, 'M470,300 C420,296 380,270 344,244', 'as', 'sks', '4 3')}
${txt(388, 262, 'reads globals', 'lblf')}
${arrow(P, 'M470,340 C420,336 380,326 344,316', 'aa', 'ska')}
${txt(462, 358, 'wakes hosts', 'lbla', 'end')}

<!-- server lane -->
<line x1="60" y1="446" x2="940" y2="446" class="skf" stroke-dasharray="8 5"/>
${txt(80, 438, 'no DOM below this line', 'lblf')}
${txt(80, 486, 'SERVER', 'lblt')}
${box(80, 508, 150, 52)}
${txt(92, 528, 'REQUEST', 'lblb')}
${txt(92, 544, 'GET /people/32', 'lbls')}
${arrow(P, 'M230,534 H300', 'ai', 'sk2')}
${box(300, 496, 330, 112, 'sk fp')}
${txt(312, 516, 'ui-router-server', 'lblb')}
${txt(618, 516, '0.1.1', 'lbls', 'end')}
${lines(312, 534, ['adapters: connect · fetch · hono · vite', 'redirects · simulate · url-matcher'], 'lbls')}
${txt(318, 574, 'same core state tree', 'lbl')}
<rect x="312" y="580" width="200" height="20" fill="url(#${P}-ha)"/>
${arrow(P, 'M630,534 H700', 'ai', 'sk2')}
${box(700, 508, 220, 52, 'sk fp')}
${txt(712, 528, 'DECISION', 'lblb')}
${txt(712, 544, '302 redirect · render · pass', 'lbls')}
${txt(80, 632, 'CONDITION  0.1.1 — the 1.0 gate is short: land #565, flip the version', 'lblr')}

<!-- equivalence tie -->
${arrow(P, 'M312,590 C240,596 120,600 60,560 C10,500 0,360 76,252', 'as', 'sks', '4 3')}
${txt(206, 470, 'same registry above & below — one renders, one decides', 'lblf')}
</svg>`;

export const sheet2 = {
  num: 2, id: 'companions',
  title: 'COMPANION SOCKETS',
  sub: 'ALTITUDE 2 — three packages, 17 shipped modules between them, one rule each',
  scale: 'THREE PACKAGES',
  form: 'SOCKETS + PANELS',
  svg,
  caption: 'Too small to be cities: each companion is one block with one socket. The location plugin swaps a slot, the MobX store taps a wire read-only, and the server adapter re-hosts the same state tree where there is no DOM at all.',
  notes: `
<p><strong>At this altitude the reference form breaks.</strong> Five, three, and nine modules respectively — an isometric city of four blocks is a worse paragraph. What survives from the reference is its <em>panel</em>: WHAT / HOW / CONDITION, stated on the drawing, including the unflattering parts.</p>
<p><strong>Each companion obeys one verb.</strong> <code>ui-router-navigation-location-plugin</code> <em>replaces</em> (the location slot, nothing else). <code>lit-ui-router-mobx</code> <em>observes</em> (core globals in, <code>requestUpdate()</code> out; it never writes router state). <code>ui-router-server</code> <em>re-hosts</em> (the same registry answering requests instead of rendering views). A companion that needed two verbs would be lit-ui-router's problem to absorb, not a package.</p>
<p><strong>The dashed tie is the design claim:</strong> client and server share one state registry. What differs is the host — above the line the answer is a rendered <code>&lt;ui-view&gt;</code> tree; below it, a status code.</p>`,
  key: [
    keyRow('<line x1="2" y1="9" x2="40" y2="9" class="ska"/>', 'plugs into / drives the stack'),
    keyRow('<line x1="2" y1="9" x2="40" y2="9" class="sks" stroke-dasharray="4 3"/>', 'reads without owning'),
    keyRow(`<rect x="2" y="2" width="40" height="14" fill="url(#s2-ha)"/>`, 'the shared state tree'),
    keyRow('<line x1="2" y1="9" x2="40" y2="9" class="skf" stroke-dasharray="8 5"/>', 'the DOM boundary'),
  ].join('\n'),
};

import { defs } from './chrome.mjs';
import { txt, lines, box, arrow, keyRow } from './helpers.mjs';

const P = 's4';

// [x, title, version, date, status] — status: active | wave | dormant
const adapters = [
  [175, '@uirouter/angularjs', '1.1.2', '2025-12-31', 'wave'],
  [355, '@uirouter/angular', '21.0.0', '2026-01-04', 'active'],
  [535, '@uirouter/react', '1.0.8', '2025-12-31', 'wave'],
  [715, 'lit-ui-router', '1.9.0', '2026-08-01', 'this'],
];
const plugins = [
  [175, '@uirouter/visualizer', '7.2.1', '2020-09', 'dormant'],
  [355, '@uirouter/rx', '1.0.0', '~2020', 'dormant'],
  [535, '@uirouter/sticky-states', '1.5.1', '2019-10', 'dormant'],
  [715, '@uirouter/dsr', '1.2.0', '2019-12', 'dormant'],
];
const companions = [
  ['…-mobx', '0.5.0'],
  ['…-nav-location-plugin', '0.3.0'],
  ['ui-router-server', '0.1.1'],
];

function rib(x, yBox, up, [_, name, ver, date, status]) {
  const boxCls = status === 'dormant' ? 'sks fnone' : status === 'this' ? 'ska fp' : 'sk fp';
  const dash = status === 'dormant' ? 'stroke-dasharray="5 4"' : '';
  const nameCls = status === 'dormant' ? 'lbls' : status === 'this' ? 'lbla' : 'lblb';
  const stem = up
    ? `<line x1="${x}" y1="${yBox + 62}" x2="${x}" y2="300" class="${status === 'this' ? 'ska' : status === 'dormant' ? 'skf' : 'sk'}" ${status === 'dormant' ? 'stroke-dasharray="5 4"' : ''}/>`
    : `<line x1="${x}" y1="336" x2="${x}" y2="${yBox}" class="skf" stroke-dasharray="5 4"/>`;
  return `${stem}
${status === 'this' ? `<rect x="${x - 96}" y="${yBox - 8}" width="192" height="78" rx="8" class="fhalo"/>` : ''}
<rect x="${x - 88}" y="${yBox}" width="176" height="62" class="${boxCls}" ${dash}/>
${txt(x, yBox + 20, name, nameCls, 'middle')}
${txt(x, yBox + 37, `v${ver}`, status === 'dormant' ? 'lblf' : 'lbl', 'middle')}
${txt(x, yBox + 52, `last publish ${date}`, 'lblf', 'middle')}`;
}

const svg = `<svg viewBox="0 0 1000 620" role="img" aria-label="The ui-router family drawn as a spine: @uirouter/core as the backbone, four framework adapters as ribs above it and four dormant plugins below, with publish dates encoding liveness. A bracket marks the synchronized New Year's maintenance wave of December 31, 2025, and lit-ui-router is highlighted as the fastest-moving adapter, with its own three companion packages.">
${defs(P)}

<!-- bands -->
${txt(52, 96, 'ADAPTERS — one per renderer', 'lbls')}
${txt(52, 420, 'PLUGINS & INSTRUMENTS', 'lbls')}

<!-- spine -->
<rect x="105" y="300" width="790" height="36" class="sk2 fp2"/>
<rect x="105" y="300" width="790" height="36" fill="url(#${P}-hx)" opacity="0.5"/>
${txt(500, 322, '@uirouter/core 6.1.2 — the framework-agnostic state machine', 'lblb', 'middle')}
${txt(500, 352, 'states · registry · transitions · url rules — every limb shares this one spine', 'lblf', 'middle')}

${adapters.map((a) => rib(a[0], 130, true, ['', ...a.slice(1)])).join('\n')}
${plugins.map((a) => rib(a[0], 440, false, ['', ...a.slice(1)])).join('\n')}

<!-- the New Year's wave bracket -->
<path d="M87,112 h-16 v96 h16" class="ska fnone"/>
<path d="M87,292 h-16 v52 h16" class="ska fnone"/>
${lines(20, 224, ['THE NEW', "YEAR'S WAVE"], 'lbla', 'start', 13)}
${lines(20, 252, ['2025-12-31:', 'core, angularjs,', 'react + angular', 'patched in 26 h'], 'lblf', 'start', 11)}

<!-- lit-ui-router companions -->
${companions.map(([name, ver], i) => {
  const y = 128 + i * 34;
  return `<line x1="803" y1="${y + 12}" x2="818" y2="${y + 12}" class="ska" stroke-dasharray="3 3"/>
<rect x="820" y="${y}" width="170" height="26" class="sks fp"/>
${txt(828, y + 17, `${name} ${ver}`, 'lblf')}`;
}).join('\n')}
${txt(913, 108, 'companions (sheet 2)', 'lblf', 'middle')}

<!-- cadence annotation -->
${arrow(P, 'M715,208 V292', 'aa', 'ska')}
${lines(730, 250, ['fastest-moving limb:', '4 releases Jul–Aug 2026'], 'lblf')}

<!-- dormancy note -->
${txt(500, 560, 'no @uirouter/vue was ever published — the vue seat in the family is empty', 'lblf', 'middle')}
</svg>`;

export const sheet4 = {
  num: 4, id: 'family',
  title: 'THE FAMILY SPINE',
  sub: 'ALTITUDE 4 — one core, four living adapters, four dormant instruments · dates from the npm registry, 2026-08-16',
  scale: 'UI-ROUTER ECOSYSTEM',
  form: 'SPINE + RIBS',
  svg,
  caption: 'Not a loop and not a city: a spine. Every limb shares @uirouter/core and none of the limbs talk to each other — so the honest drawing is radial, and the honest ink is liveness, taken from real publish dates.',
  notes: `
<p><strong>An isometric city would lie here.</strong> Adjacent blocks imply interaction, and the adapters have none — each rib touches only the spine. What matters at this altitude is temporal, so the encoding is liveness: solid ink for living limbs, dashed fade for dormant ones, the date printed on every box.</p>
<p><strong>The registry corrected my priors.</strong> Fetched fresh for this sheet: the whole family was patched in a synchronized wave on 2025-12-31 — core 6.1.2, angularjs 1.1.2, react 1.0.8, angular 17.0.1 — with angular 21.0.0 following four days later. This family is in maintenance, not abandonment. The instruments below the spine are the dormant part: visualizer, rx, sticky-states, dsr — quiet five to six years.</p>
<p><strong>The newest limb moves fastest.</strong> lit-ui-router shipped four releases in July–August 2026 against the family's one wave per year — and it is the only limb growing limbs of its own (sheet 2's companions).</p>`,
  key: [
    keyRow('<rect x="2" y="3" width="40" height="13" class="sk fp"/>', 'living — publishes within the year'),
    keyRow('<rect x="2" y="3" width="40" height="13" class="sks fnone" stroke-dasharray="5 4"/>', 'dormant — quiet 5+ years'),
    keyRow('<rect x="2" y="3" width="40" height="13" class="ska fp"/>', 'this repo'),
    keyRow('<line x1="2" y1="9" x2="40" y2="9" class="sk"/>', 'depends on the spine (only)'),
  ].join('\n'),
};

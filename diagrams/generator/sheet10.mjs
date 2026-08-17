import { defs } from './chrome.mjs';
import { txt, box, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's10';
const OX = 480, OY = 210;

// Module census of the sample-app-lit-vanilla production build, 2026-08-16:
// a generateBundle hook on the real vite build (chunk hashes identical to the
// shipped dist), modules grouped by package. rendered = post-tree-shake source
// bytes the bundler kept; gz = each module scaled by its chunk's minify+gzip
// ratios — the wire share. Whole bundle: 654,726 kept → 385,793 emitted →
// 124,449 gz. Reconciles with sheet 9's vanilla district to the byte.
// [name, renderedBytes, estGzBytes, district, opaque?]
const DATA = [
  ['@uirouter/core', 173091, 28846, 'machine'],
  ['lit 3.3.3', 31370, 7313, 'machine'],
  ['lit 2.8.0', 26516, 5181, 'machine'],
  ['lit-ui-router', 23885, 4552, 'machine'],
  ['router plugins', 18589, 3589, 'machine'],
  ['runtime helpers', 5769, 1931, 'machine'],
  ['@uirouter/visualizer', 119391, 24714, 'chrome', true],
  ['marked', 59455, 11480, 'chrome'],
  ['dompurify', 59100, 11412, 'chrome'],
  ['@api-viewer ×3', 23767, 4589, 'chrome'],
  ['lit-dialog', 2795, 642, 'chrome'],
  ['sample-app-shared', 49065, 10938, 'app'],
  ['lodash-es', 53202, 7505, 'app'],
  ['app own src', 9936, 2433, 'app'],
];

const SIDE = (r) => Math.max(14, 0.28 * Math.sqrt(r));
const HT = (gz) => Math.max(6, gz / 150);

// Manual plan, districts by role, tall buildings in back. [name → x, y]
const PLAN = {
  '@uirouter/core': [30, 15],
  'lit 3.3.3': [190, 20],
  'lit 2.8.0': [255, 30],
  'lit-ui-router': [195, 105],
  'router plugins': [268, 115],
  'runtime helpers': [332, 132],
  '@uirouter/visualizer': [435, 10],
  'marked': [560, 15],
  'dompurify': [630, 100],
  '@api-viewer ×3': [445, 130],
  'lit-dialog': [518, 155],
  'sample-app-shared': [170, 285],
  'lodash-es': [255, 300],
  'app own src': [352, 330],
};

const all = DATA.map((it, i) => {
  const [name, r, gz, district, opaque] = it;
  const [x, y] = PLAN[name];
  return { it, name, r, gz, district, opaque, x, y, s: SIDE(r), h: HT(gz), n: i + 1 };
});

const bodies = all
  .slice()
  .sort((a, b) => (a.x + a.y + a.s) - (b.x + b.y + b.s))
  .map(({ name, x, y, s, h, opaque, n }) => {
    const accent = name === 'lit-ui-router';
    const blk = isoBlock(P, OX, OY, x, y, s, s, h, { capCls: accent ? 'fa' : opaque ? 'fp2' : 'fp' });
    const [bx, by] = isoPt(OX, OY, x + s / 2, y, h);
    return `${blk}
<circle cx="${bx.toFixed(1)}" cy="${(by - 14).toFixed(1)}" r="9" class="${accent ? 'ska fp' : 'sk fp'}"/>
${txt(bx.toFixed(1), (by - 10.6).toFixed(1), String(n), 'lbls', 'middle')}`;
  })
  .join('\n');

function groupOutline(x1, y1, x2, y2, label, lx, ly, anchor = 'start') {
  const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
    .map(([px, py]) => isoPt(OX, OY, px, py).map((v) => v.toFixed(1)).join(','))
    .join(' ');
  return `<polygon points="${pts}" class="skf fnone" stroke-dasharray="5 4"/>
${txt(lx, ly, label, 'lblf', anchor)}`;
}

const KB = (b) => `${(b / 1024).toFixed(1)} KB`;
const TOPS = {
  '@uirouter/core': 'transition.js 12.2 KB kept',
  'lit 3.3.3': 'lit-html 9.6 KB kept',
  'lit 2.8.0': 'rides in with the docs viewer',
  'lit-ui-router': 'ui-sref-active 7.2 KB kept',
  'router plugins': 'dsr · sticky-states · nav-location',
  'runtime helpers': 'oxc · vite · tslib — 0.4% tax',
  '@uirouter/visualizer': 'ships prebundled, opaque',
  'marked': 'one file, whole',
  'dompurify': 'one file, whole',
  '@api-viewer ×3': 'docs · tabs · common',
  'lit-dialog': 'pins the lit 2 era',
  'sample-app-shared': 'FeatureFlagsPanel 4.7 KB kept',
  'lodash-es': "_baseClone graph — isEqual's family",
  'app own src': 'incl. sample-app-routes 185 b',
};
const half = Math.ceil(all.length / 2);
const SY = 810;
const schedule = `<g>
<rect x="40" y="${SY}" width="1080" height="${52 + half * 17}" class="sk fp"/>
${txt(56, SY + 22, 'STRUCTURE SCHEDULE — source bytes the bundler kept · gzipped wire share · note', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1120" y2="${SY + 32}" class="skf"/>
${all.slice(0, half).map((r, i) => txt(56, SY + 52 + i * 17, `${r.n} ${r.name} — kept ${KB(r.r)} → ${KB(r.gz)} wire · ${TOPS[r.name]}`, 'lbls')).join('\n')}
${all.slice(half).map((r, i) => txt(590, SY + 52 + i * 17, `${r.n} ${r.name} — kept ${KB(r.r)} → ${KB(r.gz)} wire · ${TOPS[r.name]}`, 'lbls')).join('\n')}
</g>`;

const DY = 700;
const doors = `<g>
${txt(40, DY - 8, 'THE FIVE DOORS, PRICED — the codecov bundle-analysis series, computed locally (min+gz, deps external)', 'lbls')}
${[
  ['.', '4,953 gz', false],
  ['./pure', '4,864 gz', false],
  ['./register', '2,288 gz', true],
  ['./ui-router.register', '1,070 gz', true],
  ['./ui-view.register', '2,268 gz', true],
].map(([name, price, se], i) => {
  const x = 40 + i * 152;
  return `${box(x, DY, 144, 30, se ? 'sk fp2' : 'ska fp')}
${txt(x + 8, DY + 13, name, se ? 'lbls' : 'lbla')}
${txt(x + 8, DY + 25, price, 'lblf')}`;
}).join('\n')}
${txt(816, DY + 13, 'door "." prices at 4,953 gz — and this app pulls 4,552:', 'lbls')}
${txt(816, DY + 25, 'the probe and the city agree', 'lbls')}
</g>`;

const svg = `<svg viewBox="0 0 1160 ${SY + 90 + half * 17}" role="img" aria-label="The inside of one shipped app bundle drawn as an isometric city of fourteen buildings in three districts: footprint from post-tree-shake source bytes kept, height from gzipped wire share. The routing machine district is dominated by @uirouter/core at 28.8 KB while lit-ui-router itself is a small accent building at 4.6 KB; the demo-chrome district — visualizer, marked, dompurify, api-viewer — outweighs the machine; the app district holds the shared demo code and the 7.5 KB lodash-es remainder. A priced strip of the five entry doors and a structure schedule give exact counts.">
${defs(P)}

${groupOutline(20, 0, 395, 200, 'the routing machine', 150, 330)}
${groupOutline(420, 0, 712, 212, 'the demo chrome', 872, 220)}
${groupOutline(150, 270, 430, 412, 'the app itself', 336, 660)}

${bodies}

${txt(60, 56, 'the machine the skin wraps: core 28.8 KB gz (26%) —', 'lbla')}
${txt(60, 68, 'lit-ui-router itself is 4.6 KB (3.7%)', 'lbla')}
${txt(1120, 240, "two lit majors on the wire — sheet 8's twin", 'lbla', 'end')}
${txt(1120, 252, 'pairs survive bundling: 5.2 KB of déjà vu', 'lbla', 'end')}
${txt(1150, 336, 'marked + dompurify: 22.9 KB', 'lbla', 'end')}
${txt(1150, 348, 'gz to render API markdown —', 'lbla', 'end')}
${txt(1150, 360, '5× the router they document', 'lbla', 'end')}
${txt(30, 440, 'what the swap left: lodash-es 7.5 KB —', 'lbla')}
${txt(30, 452, 'the true cost of four imports', 'lbla')}
<line x1="318" y1="443" x2="418" y2="456" class="skf"/>

${txt(1120, 26, 'SCALE — footprint area ∝ source kept · 1 px of height ≈ 150 gz bytes', 'lbls', 'end')}

${doors}
${schedule}
</svg>`;

export const sheet10 = {
  num: 10, id: 'bundled',
  title: 'THE BUNDLED CITY',
  sub: 'ALTITUDE 2⅞ — inside the wire: what the bundler kept · sample-app-lit-vanilla, one bundle · counted 2026-08-16',
  scale: 'ONE BUNDLE',
  form: 'BUNDLED CITY',
  svg,
  caption: 'One shipped bundle opened up: every package that survived tree-shaking as a building — footprint from source kept, height from gzipped wire share — and the machine the router wraps, the chrome that demos it, and the app that uses it stand as three districts summing to 124.4 KB.',
  notes: `
<p><strong>Method:</strong> a <code>generateBundle</code> census on the real production vite build of <code>sample-app-lit-vanilla</code> — output chunk hashes identical to the deployed <code>dist</code>, so this is the deploy itself, not a reconstruction. Every rendered module is attributed to its package; footprint is post-tree-shake source kept, height is each module scaled by its own chunk's minify and gzip ratios — the honest wire share. Beside it, the repo's own codecov bundle-analysis probe (<code>tools/bundle-probe</code>, the <code>&lt;pkg&gt;-&lt;label&gt;-esm</code> series CI uploads) is recomputed locally to price each exported entry. This closes the survey as a quartet: what we wrote (7), what npm delivered (8), what the wire carries (9) — and now who actually occupies those bytes. Sheet 11 is this sheet's split view: the same probe cut by published package, every entry priced alone.</p>
<p><strong>The library is a skin over the machine.</strong> The biggest building in the bundle is not the router package — it is <code>@uirouter/core</code> at 28.8 KB gz, 26% of the wire. <code>lit-ui-router</code> itself is the small accent building: 4.6 KB, 3.7%. The two measurements agree to within 9%: the codecov door prices the bare <code>.</code> entry at 4,953 gz, and the app's census pulls 4,552 of it.</p>
<p><strong>The demo chrome outweighs the thing it demos.</strong> The visualizer ships as a 24.7 KB prebundled file — opaque to tree-shaking, take-it-or-leave-it — and <code>marked</code> + <code>dompurify</code> add 22.9 KB so <code>@api-viewer</code> can render component API markdown: five times the router they document. The docs-viewer stack also drags in a second, complete lit — sheet 8's twin pairs survive bundling as 5.2 KB of wire déjà vu, the one redundancy tree-shaking cannot reach because it is a version split, not dead code.</p>
<p><strong>The lodash-es aftermath, measured.</strong> 7.5 KB gz remains from four import sites — <code>isEqual</code>'s 89-module <code>_base*</code> family is its own 4.2 KB chunk, with <code>cloneDeep</code>/<code>get</code>/<code>set</code> adding 3.3 KB more. Tree-shaking is working; this is what four imports truly cost, and the swap's −84% (sheet 9) came from shedding everything else.</p>
<p><strong>The runtime tax is near-zero.</strong> All bundler machinery — oxc decorator helpers, vite's preload helper and polyfill, a stray <code>tslib</code> — totals 1.9 KB, 0.4% of the kept source. No duplicated-helper problem: exactly one oxc helper module ships.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'package group — height = gz wire share'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'lit-ui-router — the subject'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp2"/>', 'ships prebundled — opaque to tree-shaking'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'district (role in the bundle)'),
  ].join('\n'),
};

import { defs } from './chrome.mjs';
import { txt, box, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's10';
const OX = 480, OY = 210;

// Module census of the sample-app-lit-vanilla production build, recounted
// 2026-08-17 after the single-lit + lazy api-viewer merge (PR #618): a
// generateBundle hook on the real vite build (chunk hashes identical to the
// shipped dist), modules grouped by package. rendered = post-tree-shake source
// bytes the bundler kept; gz = each module scaled by its chunk's minify+gzip
// ratios — the wire share. Whole bundle: 630,184 kept → 370,696 emitted →
// 119,906 gz (rev A: 654,726 → 385,793 → 124,449). Still reconciles with
// sheet 9's vanilla district to the byte: 119,906 − 24,714 (visualizer)
// + 1,364 (css) = 96,556.
// [name, renderedBytes, estGzBytes, district, opaque?]
const DATA = [
  ['@uirouter/core', 173091, 27107, 'machine'],
  ['lit 3.3.3', 31595, 8645, 'machine'],
  ['lit-ui-router', 25413, 4772, 'machine'],
  ['router plugins', 18589, 4040, 'machine'],
  ['runtime helpers', 4564, 1280, 'machine'],
  ['@uirouter/visualizer', 119391, 24714, 'chrome', true],
  ['marked', 59455, 11424, 'chrome'],
  ['dompurify', 59100, 11356, 'chrome'],
  ['@api-viewer ×3', 23791, 4571, 'chrome'],
  ['lit-dialog', 2795, 645, 'chrome'],
  ['sample-app-shared', 49262, 11379, 'app'],
  ['lodash-es', 53202, 7508, 'app'],
  ['app own src', 9936, 2463, 'app'],
];

const SIDE = (r) => Math.max(14, 0.28 * Math.sqrt(r));
const HT = (gz) => Math.max(6, gz / 150);

// Manual plan, districts by role, tall buildings in back. [name → x, y]
const PLAN = {
  '@uirouter/core': [30, 15],
  'lit 3.3.3': [215, 22],
  'lit-ui-router': [195, 105],
  'router plugins': [276, 124],
  'runtime helpers': [332, 132],
  '@uirouter/visualizer': [435, 10],
  'marked': [560, 15],
  'dompurify': [630, 100],
  '@api-viewer ×3': [452, 138],
  'lit-dialog': [518, 155],
  'sample-app-shared': [180, 310],
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
  'lit 3.3.3': 'the only lit — rev A shipped two',
  'lit-ui-router': 'ui-sref-active 8.8 KB kept',
  'router plugins': 'dsr · sticky-states · nav-location',
  'runtime helpers': 'oxc · vite · tslib — 0.7% tax',
  '@uirouter/visualizer': 'ships prebundled, opaque',
  'marked': 'one file, whole — now lazy',
  'dompurify': 'one file, whole — now lazy',
  '@api-viewer ×3': 'docs · tabs · common',
  'lit-dialog': 'freed of its lit 2 pin',
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
  ['.', '5,308 gz', false],
  ['./pure', '5,223 gz', false],
  ['./register', '2,288 gz', true],
  ['./ui-router.register', '1,070 gz', true],
  ['./ui-view.register', '2,268 gz', true],
].map(([name, price, se], i) => {
  const x = 40 + i * 152;
  return `${box(x, DY, 144, 30, se ? 'sk fp2' : 'ska fp')}
${txt(x + 8, DY + 13, name, se ? 'lbls' : 'lbla')}
${txt(x + 8, DY + 25, price, 'lblf')}`;
}).join('\n')}
${txt(816, DY + 13, 'door "." prices at 5,308 gz — and this app pulls 4,772:', 'lbls')}
${txt(816, DY + 25, 'the probe and the city still agree (both grew with #590)', 'lbls')}
</g>`;

const svg = `<svg viewBox="0 0 1160 ${SY + 90 + half * 17}" role="img" aria-label="The inside of one shipped app bundle drawn as an isometric city of thirteen buildings in three districts: footprint from post-tree-shake source bytes kept, height from gzipped wire share. The routing machine district is dominated by @uirouter/core at 27.1 KB while lit-ui-router itself is a small accent building at 4.8 KB; a single lit 3.3.3 stands where the previous revision drew two lit majors; the demo-chrome district — visualizer, marked, dompurify, api-viewer, now largely deferred to a lazy chunk — outweighs the machine; the app district holds the shared demo code and the 7.5 KB lodash-es remainder. A priced strip of the five entry doors and a structure schedule give exact counts.">
${defs(P)}

${groupOutline(20, 0, 395, 200, 'the routing machine', 150, 330)}
${groupOutline(420, 0, 712, 212, 'the demo chrome', 872, 220)}
${groupOutline(150, 270, 430, 412, 'the app itself', 336, 660)}

${bodies}

${txt(60, 56, 'the machine the skin wraps: core 27.1 KB gz (23%) —', 'lbla')}
${txt(60, 68, 'lit-ui-router itself is 4.8 KB (4.0%)', 'lbla')}
${txt(1120, 240, 'REV B: one lit major, 8.6 KB — rev A shipped two,', 'lbla', 'end')}
${txt(1120, 252, '12.5 KB; the 5.2 KB of déjà vu is gone (#618)', 'lbla', 'end')}
${txt(1150, 336, 'marked + dompurify: 22.8 KB', 'lbla', 'end')}
${txt(1150, 348, 'gz — 5× the router they', 'lbla', 'end')}
${txt(1150, 360, 'document, now parked in a', 'lbla', 'end')}
${txt(1150, 372, 'lazy api-docs chunk', 'lbla', 'end')}
${txt(60, 585, 'what the swap left: lodash-es 7.5 KB —', 'lbla')}
${txt(60, 597, 'the true cost of four imports, unmoved', 'lbla')}
<line x1="352" y1="578" x2="378" y2="518" class="skf"/>

${txt(1120, 26, 'SCALE — footprint area ∝ source kept · 1 px of height ≈ 150 gz bytes', 'lbls', 'end')}

${doors}
${schedule}
</svg>`;

export const sheet10 = {
  num: 10, id: 'bundled', rev: 'B',
  title: 'THE BUNDLED CITY',
  sub: 'ALTITUDE 2⅞ — inside the wire: what the bundler kept · sample-app-lit-vanilla, one bundle · REV B: recounted after the single-lit merge · 2026-08-17',
  scale: 'ONE BUNDLE',
  form: 'BUNDLED CITY',
  svg,
  caption: 'One shipped bundle opened up: every package that survived tree-shaking as a building — footprint from source kept, height from gzipped wire share — and the machine the router wraps, the chrome that demos it, and the app that uses it stand as three districts summing to 119.9 KB, with a single lit where the first printing drew two.',
  notes: `
<p><strong>Method:</strong> a <code>generateBundle</code> census on the real production vite build of <code>sample-app-lit-vanilla</code> — output chunk hashes identical to the deployed <code>dist</code>, so this is the deploy itself, not a reconstruction. Every rendered module is attributed to its package; footprint is post-tree-shake source kept, height is each module scaled by its own chunk's minify and gzip ratios — the honest wire share. Beside it, the repo's own codecov bundle-analysis probe (<code>tools/bundle-probe</code>, the <code>&lt;pkg&gt;-&lt;label&gt;-esm</code> series CI uploads) is recomputed locally to price each exported entry. This closes the survey as a quartet: what we wrote (7), what npm delivered (8), what the wire carries (9) — and now who actually occupies those bytes. Sheet 11 is this sheet's split view: the same probe cut by published package, every entry priced alone. REV B re-runs the identical census after the single-lit + lazy api-viewer merge (PR #618): 630,184 kept → 370,696 emitted → 119,906 gz, against rev A's 654,726 → 385,793 → 124,449.</p>
<p><strong>The library is a skin over the machine.</strong> The biggest building in the bundle is not the router package — it is <code>@uirouter/core</code> at 27.1 KB gz, 23% of the wire. <code>lit-ui-router</code> itself is the small accent building: 4.8 KB, 4.0% — both figures a notch up from rev A (4.6 KB) because #590's <code>assignHref</code> landed between prints, not because of the dedupe. The two measurements still agree to within 10%: the codecov door prices the bare <code>.</code> entry at 5,308 gz (rev A 4,953 — same #590 growth), and the app's census pulls 4,772 of it.</p>
<p><strong>The déjà vu is gone.</strong> Rev A's one redundancy tree-shaking could not reach — a second, complete lit 2.8.0 riding in with the docs-viewer stack, 5.2 KB of wire déjà vu — was a version split, so it took a dependency edit, not a bundler: PR #618 scopes a pnpm override (<code>^3.3.3</code>, a floor, not a pin) to <code>@api-viewer/*</code> and <code>lit-dialog</code>, and the census now counts one lit: 8.6 KB gz where two majors cost 12.5. The intentional <code>lit-2</code> compat alias in <code>packages/*</code> is untouched — it is a test lane, and it never shipped.</p>
<p><strong>Occupancy barely moved; arrival did.</strong> The same PR defers the api-viewer panel behind its feature flag, so marked, dompurify and <code>@api-viewer</code> — 27 KB gz of demo chrome — now ride a lazy <code>api-docs</code> chunk and the eager main chunk drops 34 → 7 KB gz. This sheet's census is deliberately blind to that: it counts who occupies the bundle, and the occupants are the same tenants in new rooms. The −4.5 KB on this sheet is the dedupe; the lazy split's win is drawn on sheet 9, where the critical path lives.</p>
<p><strong>The lodash-es aftermath did not move.</strong> 7.5 KB gz, byte-for-byte the rev A figure (7,508 vs 7,505) — <code>isEqual</code>'s <code>_base*</code> family still its own 4.2 KB chunk. Tree-shaking is working; this is what four imports truly cost.</p>
<p><strong>The runtime tax is near-zero.</strong> All bundler machinery — oxc decorator helpers, vite's preload helper and polyfill, a stray <code>tslib</code> — totals 4.6 KB kept, 1.3 KB gz, 0.7% of the kept source. No duplicated-helper problem: exactly one oxc helper module ships.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'package group — height = gz wire share'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'lit-ui-router — the subject'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp2"/>', 'ships prebundled — opaque to tree-shaking'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'district (role in the bundle)'),
  ].join('\n'),
};

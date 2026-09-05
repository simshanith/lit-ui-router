import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, box, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's10';
const OX = 480, OY = 210;

// ---- census: every byte on this sheet comes from diagrams/data/census-bundle.json ----
// The plate is the checked-in snapshot census-bundle.mjs writes: the REAL vite
// production build of one consumer app, run inside a materialized + installed
// archive of the measured ref, with a generateBundle hook reading every chunk.
// rendered = post-tree-shake source bytes the bundler kept; estGz = each module
// scaled through its own chunk's minify and gzip ratios — the wire share.
// Door prices come from the same-ref probe plate, census-doors.json; the
// reconciliation against sheet 9 reads census-shipped.json.  This file holds
// placement, districts and prose only.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-bundle.json', import.meta.url), 'utf8'));
const DOORS = JSON.parse(readFileSync(new URL('../data/census-doors.json', import.meta.url), 'utf8'));
const SHIPPED = JSON.parse(readFileSync(new URL('../data/census-shipped.json', import.meta.url), 'utf8'));

const row = (group) => {
  const r = PLATE.rows.find((x) => x.group === group);
  if (!r) throw new Error(`census-bundle.json: no row for group ${group}`);
  return r;
};
const door = (name) => {
  const d = DOORS.rows.find((x) => x.pkg === 'lit-ui-router' && x.door === name);
  if (!d) throw new Error(`census-doors.json: no lit-ui-router door ${name}`);
  return d;
};
const district9 = (name) => {
  const d = SHIPPED.rows.find((x) => x.district === name);
  if (!d) throw new Error(`census-shipped.json: no district ${name}`);
  return d;
};

const T = PLATE.totals;
const BASIS = `${PLATE.app} · counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0, 10)})`;
const fmt = (v) => v.toLocaleString('en-US');
// sub-kilobyte rows read as bytes — the route table is 59 of them
const KB = (b) => (b < 1024 ? `${b} b` : `${(b / 1024).toFixed(1)} KB`);
const pct = (b) => `${((b / T.gz) * 100).toFixed(1)}%`;

// Reconciliation with sheet 9: that sheet's vanilla district is measured on the
// deployed files, this one on the chunks inside them — the gap is the emitted
// asset that is not a chunk, so a module census cannot see it.
const VAN = district9('app: vanilla');
const RESID = VAN.gz - T.gz;
const RESID_FILES = VAN.files - T.chunks;

// EDITORIAL: which district a plate group stands in, and which one ships
// prebundled (opaque to tree-shaking).  [plate group, district, opaque?]
const PLACED = [
  ['@uirouter/core', 'machine'],
  ['lit', 'machine'],
  ['lit-ui-router', 'machine'],
  ['router plugins', 'machine'],
  ['runtime helpers', 'machine'],
  ['@uirouter/visualizer', 'chrome', true],
  ['marked', 'chrome'],
  ['dompurify', 'chrome'],
  ['@api-viewer', 'chrome'],
  ['lit-dialog', 'chrome'],
  ['sample-app-shared', 'app'],
  ['lodash-es', 'app'],
  ['app own src', 'app'],
  ['sample-app-routes', 'app'],
];

const SIDE = (r) => Math.max(14, 0.28 * Math.sqrt(r));
const HT = (gz) => Math.max(6, gz / 150);

// Manual plan, districts by role, tall buildings in back. [group → x, y]
const PLAN = {
  '@uirouter/core': [30, 15],
  'lit': [215, 22],
  'lit-ui-router': [195, 105],
  'router plugins': [276, 124],
  'runtime helpers': [332, 132],
  '@uirouter/visualizer': [435, 10],
  'marked': [560, 15],
  'dompurify': [630, 100],
  '@api-viewer': [452, 138],
  'lit-dialog': [518, 155],
  'sample-app-shared': [180, 310],
  'lodash-es': [255, 300],
  'app own src': [352, 330],
  'sample-app-routes': [345, 385],
};

const all = PLACED.map(([name, district, opaque], i) => {
  const p = row(name);
  const [x, y] = PLAN[name];
  return { name, district, opaque, x, y, r: p.rendered, gz: p.estGz, mods: p.modules, s: SIDE(p.rendered), h: HT(p.estGz), n: i + 1 };
});
const G = (name) => all.find((b) => b.name === name);

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

// Qualitative only — every number in a schedule row is read from the plate.
const TOPS = {
  '@uirouter/core': 'the state machine: transition · url · state services',
  'lit': 'one lit major — rev A shipped two',
  'lit-ui-router': 'the subject — directives and ui-view',
  'router plugins': 'dsr · sticky-states · nav-location',
  'runtime helpers': 'oxc · vite · tslib — the bundler tax',
  '@uirouter/visualizer': 'ships prebundled, opaque',
  'marked': 'one file, whole — now lazy',
  'dompurify': 'one file, whole — now lazy',
  '@api-viewer': 'docs · tabs · common',
  'lit-dialog': 'freed of its lit 2 pin',
  'sample-app-shared': 'the demo the three apps share',
  'lodash-es': "_baseClone graph — isEqual's family",
  'app own src': 'the vanilla shell and its views',
  'sample-app-routes': 'the shared route table, its own group now',
};
const half = Math.ceil(all.length / 2);
const SY = 810;
const line = (r) => `${r.n} ${r.name} — kept ${KB(r.r)} → ${KB(r.gz)} wire · ×${r.mods} · ${TOPS[r.name]}`;
const schedule = `<g>
<rect x="40" y="${SY}" width="1080" height="${52 + (half + 1) * 17}" class="sk fp"/>
${txt(56, SY + 22, 'STRUCTURE SCHEDULE — source bytes the bundler kept · gzipped wire share · modules · note', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1120" y2="${SY + 32}" class="skf"/>
${all.slice(0, half).map((r, i) => txt(56, SY + 52 + i * 17, line(r), 'lbls')).join('\n')}
${all.slice(half).map((r, i) => txt(590, SY + 52 + i * 17, line(r), 'lbls')).join('\n')}
${txt(56, SY + 52 + half * 17, `TOTAL — ${all.length} groups in ${T.chunks} chunks · ${fmt(T.kept)} kept → ${fmt(T.emitted)} emitted → ${fmt(T.gz)} gz · ${BASIS}`, 'lbls')}
</g>`;

const DY = 700;
const DOOR_STRIP = ['.', './pure', './register', './ui-router.register', './ui-view.register'];
const doors = `<g>
${txt(40, DY - 8, 'THE FIVE DOORS, PRICED — the codecov bundle-analysis series, from the same-ref probe plate (min+gz, deps external)', 'lbls')}
${DOOR_STRIP.map((name, i) => {
  const d = door(name);
  const se = name.includes('register');
  const x = 40 + i * 152;
  return `${box(x, DY, 144, 30, se ? 'sk fp2' : 'ska fp')}
${txt(x + 8, DY + 13, name, se ? 'lbls' : 'lbla')}
${txt(x + 8, DY + 25, `${fmt(d.gz)} gz`, 'lblf')}`;
}).join('\n')}
${txt(816, DY + 13, `door "." prices at ${fmt(door('.').gz)} gz — and this app pulls ${fmt(G('lit-ui-router').gz)}:`, 'lbls')}
${txt(816, DY + 25, `the app leaves ${Math.round((1 - G('lit-ui-router').gz / door('.').gz) * 100)}% of the door on the shelf`, 'lbls')}
</g>`;

const CHROME_GZ = G('marked').gz + G('dompurify').gz;
const svg = `<svg viewBox="0 0 1160 ${SY + 107 + half * 17}" role="img" aria-label="The inside of one shipped app bundle drawn as an isometric city of fourteen buildings in three districts: footprint from post-tree-shake source bytes kept, height from gzipped wire share. The routing machine district is dominated by @uirouter/core at ${KB(G('@uirouter/core').gz)} while lit-ui-router itself is a small accent building at ${KB(G('lit-ui-router').gz)}; a single lit stands where an earlier revision drew two lit majors; the demo-chrome district — visualizer, marked, dompurify, api-viewer, now largely deferred to a lazy chunk — outweighs the machine; the app district holds the shared demo code, the ${KB(G('lodash-es').gz)} lodash-es remainder, the app's own source and, new in this revision, a tiny building for the shared route table. A priced strip of the five entry doors and a structure schedule give exact counts.">
${defs(P)}

${groupOutline(20, 0, 395, 200, 'the routing machine', 150, 330)}
${groupOutline(420, 0, 712, 212, 'the demo chrome', 872, 220)}
${groupOutline(150, 270, 430, 412, 'the app itself', 336, 660)}

${bodies}

${txt(60, 56, `the machine the skin wraps: core ${KB(G('@uirouter/core').gz)} gz (${pct(G('@uirouter/core').gz)}) —`, 'lbla')}
${txt(60, 68, `lit-ui-router itself is ${KB(G('lit-ui-router').gz)} (${pct(G('lit-ui-router').gz)})`, 'lbla')}
${txt(1120, 240, `REV C: one lit major, ${KB(G('lit').gz)} — rev A shipped two,`, 'lbla', 'end')}
${txt(1120, 252, '12.5 KB; the déjà vu is gone (#618)', 'lbla', 'end')}
${txt(1150, 336, `marked + dompurify: ${KB(CHROME_GZ)}`, 'lbla', 'end')}
${txt(1150, 348, 'gz — 5× the router they', 'lbla', 'end')}
${txt(1150, 360, 'document, now parked in a', 'lbla', 'end')}
${txt(1150, 372, 'lazy api-docs chunk', 'lbla', 'end')}
${txt(60, 585, `what the swap left: lodash-es ${KB(G('lodash-es').gz)} —`, 'lbla')}
${txt(60, 597, `the true cost of four imports, ${G('lodash-es').mods} modules unmoved`, 'lbla')}
<line x1="352" y1="578" x2="378" y2="518" class="skf"/>

${txt(1120, 26, 'SCALE — footprint area ∝ source kept · 1 px of height ≈ 150 gz bytes', 'lbls', 'end')}
${txt(1120, 40, BASIS, 'lblf', 'end')}

${doors}
${schedule}
</svg>`;

export const sheet10 = {
  num: 10, id: 'bundled', rev: 'C',
  title: 'THE BUNDLED CITY',
  sub: `ALTITUDE 2⅞ — inside the wire: what the bundler kept · ${PLATE.app}, one bundle · REV C: every byte now read from the census-bundle plate — ${BASIS}`,
  scale: 'ONE BUNDLE',
  form: 'BUNDLED CITY',
  svg,
  caption: `One shipped bundle opened up: every package that survived tree-shaking as a building — footprint from source kept, height from gzipped wire share — and the machine the router wraps, the chrome that demos it, and the app that uses it stand as three districts summing to ${KB(T.gz)}, with a single lit where the first printing drew two.`,
  notes: `
<p><strong>Method:</strong> a <code>generateBundle</code> census on a real production vite build of <code>${PLATE.app}</code>, run inside a materialized, installed archive of the measured ref rather than the working tree — ${BASIS}. Every rendered module is attributed to its package by an explicit grouping table whose misses land in a loud <code>other</code> row (this print: none). Footprint is post-tree-shake source kept; height is <em>${PLATE.method}</em> — the honest wire share. Beside it, the repo's own codecov bundle-analysis probe (<code>tools/bundle-probe</code>, the <code>&lt;pkg&gt;-&lt;label&gt;-esm</code> series CI uploads) prices each exported entry at the same ref, read here from <code>diagrams/data/census-doors.json</code>. This closes the survey as a quartet: what we wrote (7), what npm delivered (8), what the wire carries (9) — and now who actually occupies those bytes. Sheet 11 is this sheet's split view: the same probe cut by published package, every entry priced alone. Whole bundle: ${fmt(T.kept)} kept → ${fmt(T.emitted)} emitted → ${fmt(T.gz)} gz in ${T.chunks} chunks.</p>
<p><strong>REV C — the numbers by import.</strong> The sheet no longer carries a hand-pasted census: every footprint, height, schedule row and door price is read at build time from the checked-in plates, and a group the drawing places but the plate does not carry is a build error rather than a stale constant. Two things the constants had smoothed over show up immediately. The plate names <code>lit</code> and <code>@api-viewer</code> as groups, so the old display labels that baked in a version number and a package count are gone — the module count each group actually contributes (×${G('lit').mods} and ×${G('@api-viewer').mods}) is printed instead, because that is a measured fact and the label was not. And <code>sample-app-routes</code>, which the previous print folded into the app's own source as a parenthesis, is a group of its own: ${fmt(G('sample-app-routes').r)} bytes kept, ${fmt(G('sample-app-routes').gz)} on the wire, one module — the smallest building on the map, and the shared route table three apps import.</p>
<p><strong>Reconciliation with sheet 9, honestly.</strong> The two sheets no longer meet at an identity, and the old header's byte-exact subtraction was a casualty of a rules change: on sheet 9 a chunk counts where it is <em>first claimed</em>, and <code>ui-router-visualizer.esm</code> is now first claimed by <code>app: vanilla</code>, so it sits inside that district rather than beside it. Straight from the two plates: sheet 9's vanilla district is ${fmt(VAN.gz)} gz over ${VAN.files} files; this bundle is ${fmt(T.gz)} gz over ${T.chunks} chunks; the residual is ${fmt(RESID)} gz over ${RESID_FILES} file. That file is the one emitted <em>asset</em> in the app's output that is not a chunk — the api-viewer custom-elements manifest, JSON the module census structurally cannot see, since it walks <code>bundle</code> entries of type <code>chunk</code>. The app's stylesheet is not in the gap: sheet 9's pattern table files <code>.css</code> under <em>site css</em> before the app districts are reached. So: ${fmt(T.gz)} + ${fmt(RESID)} = ${fmt(VAN.gz)}, and the named residual is a manifest, not a rounding error.</p>
<p><strong>The library is a skin over the machine.</strong> The biggest building in the bundle is not the router package — it is <code>@uirouter/core</code> at ${KB(G('@uirouter/core').gz)} gz, ${pct(G('@uirouter/core').gz)} of the wire, ${G('@uirouter/core').mods} modules. <code>lit-ui-router</code> itself is the small accent building: ${KB(G('lit-ui-router').gz)}, ${pct(G('lit-ui-router').gz)}, ${G('lit-ui-router').mods} modules. The two independent measurements still reconcile: the codecov door prices the bare <code>.</code> entry at ${fmt(door('.').gz)} gz with deps external, and this app's census pulls ${fmt(G('lit-ui-router').gz)} of it — the ${Math.round((1 - G('lit-ui-router').gz / door('.').gz) * 100)}% difference is what the app's own imports leave on the shelf.</p>
<p><strong>The déjà vu is gone.</strong> Rev A's one redundancy tree-shaking could not reach — a second, complete lit 2.8.0 riding in with the docs-viewer stack, 5.2 KB of wire déjà vu — was a version split, so it took a dependency edit, not a bundler: PR #618 scopes a pnpm override (<code>^3.3.3</code>, a floor, not a pin) to <code>@api-viewer/*</code> and <code>lit-dialog</code>, and the census now counts one lit: ${KB(G('lit').gz)} gz across ${G('lit').mods} modules where two majors cost 12.5 KB. The intentional <code>lit-2</code> compat alias in <code>packages/*</code> is untouched — it is a test lane, and it never shipped.</p>
<p><strong>Occupancy barely moved; arrival did.</strong> The same PR defers the api-viewer panel behind its feature flag, so marked, dompurify and <code>@api-viewer</code> — ${KB(CHROME_GZ + G('@api-viewer').gz)} gz of demo chrome — now ride a lazy <code>api-docs</code> chunk and the eager main chunk drops. This sheet's census is deliberately blind to that: it counts who occupies the bundle, and the occupants are the same tenants in new rooms. The lazy split's win is drawn on sheet 9, where the critical path lives.</p>
<p><strong>The lodash-es aftermath did not move.</strong> ${KB(G('lodash-es').gz)} gz from ${G('lodash-es').mods} modules and ${KB(G('lodash-es').r)} of kept source — <code>isEqual</code>'s <code>_base*</code> family, still the largest module count in the bundle and still its own chunk. Tree-shaking is working; this is what four imports truly cost.</p>
<p><strong>The runtime tax is near-zero.</strong> All bundler machinery — oxc decorator helpers, vite's preload helper and polyfill, a stray <code>tslib</code> — totals ${KB(G('runtime helpers').r)} kept, ${KB(G('runtime helpers').gz)} gz, ${((G('runtime helpers').r / T.kept) * 100).toFixed(1)}% of the kept source, in ${G('runtime helpers').mods} modules. No duplicated-helper problem.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'package group — height = gz wire share'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'lit-ui-router — the subject'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp2"/>', 'ships prebundled — opaque to tree-shaking'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'district (role in the bundle)'),
  ].join('\n'),
};

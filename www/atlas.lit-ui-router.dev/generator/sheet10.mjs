import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, box, isoBlock, isoPt, keyRow } from './helpers.mjs';
import { assertPlots } from './iso-hidden.mjs';

const P = 's10';
const OX = 480, OY = 210;

// ---- census: every byte on this sheet comes from www/atlas.lit-ui-router.dev/data/census-bundle.json ----
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
// hand PLAN, data-driven sides: the plan may not ship overlapped
assertPlots('sheet 10', all.map(({ n, name, x, y, s }) => ({ n, name, part: 'block', x, y, w: s, d: s })));

// the cover index's fit verdict, told from the plate's own wire shares
export const SHEET10_VERDICT = `tree-shaking’s verdict — core is ${pct(G('@uirouter/core').gz)}, the router ${pct(G('lit-ui-router').gz)} — one lit`;

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
  'lit': 'one lit major, no second copy',
  'lit-ui-router': 'the subject — directives and ui-view',
  'router plugins': 'dsr · sticky-states · nav-location',
  'runtime helpers': 'oxc · vite · tslib — the bundler tax',
  '@uirouter/visualizer': 'ships prebundled, opaque',
  'marked': 'one file, whole — lazy chunk',
  'dompurify': 'one file, whole — lazy chunk',
  '@api-viewer': 'docs · tabs · common',
  'lit-dialog': 'the demo dialog, on the shared lit',
  'sample-app-shared': 'the demo the three apps share',
  'lodash-es': "_baseClone graph — isEqual's family",
  'app own src': 'the vanilla shell and its views',
  'sample-app-routes': 'the shared route table three apps import',
};
const half = Math.ceil(all.length / 2);
const SY = 810;
const line = (r) => `${r.n} ${r.name} — kept ${KB(r.r)} → ${KB(r.gz)} wire · ×${r.mods} · ${TOPS[r.name]}`;
const schedule = `<g>
<rect x="40" y="${SY}" width="1110" height="${52 + (half + 1) * 17}" class="sk fp"/>
${txt(56, SY + 22, 'STRUCTURE SCHEDULE — source bytes the bundler kept · gzipped wire share · modules · note', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1150" y2="${SY + 32}" class="skf"/>
${all.slice(0, half).map((r, i) => txt(56, SY + 52 + i * 17, line(r), 'lbls')).join('\n')}
${all.slice(half).map((r, i) => txt(636, SY + 52 + i * 17, line(r), 'lbls')).join('\n')}
${txt(56, SY + 52 + half * 17, `TOTAL — ${all.length} groups in ${T.chunks} chunks · ${fmt(T.kept)} kept → ${fmt(T.emitted)} emitted → ${fmt(T.gz)} gz · ${BASIS}`, 'lbls')}
</g>`;

const DY = 700;
const DOOR_STRIP = ['.', './pure', './register', './ui-router.register', './ui-view.register'];
const doors = `<g>
${txt(40, DY - 8, 'THE FIVE DOORS, PRICED — the codecov bundle-analysis series, from the same-ref probe plate (min+gz, deps external)', 'lbls')}
${DOOR_STRIP.map((name, i) => {
  const d = door(name);
  const se = name.includes('register');
  const x = 40 + i * 132;
  return `${box(x, DY, 116, 30, se ? 'sk fp2' : 'ska fp')}
${txt(x + 8, DY + 13, name, se ? 'lbls' : 'lbla')}
${txt(x + 8, DY + 25, `${fmt(d.gz)} gz`, 'lblf')}`;
}).join('\n')}
${txt(724, DY + 13, `door "." prices at ${fmt(door('.').gz)} gz — and this app pulls ${fmt(G('lit-ui-router').gz)}:`, 'lbls')}
${txt(724, DY + 25, `the app leaves ${Math.round((1 - G('lit-ui-router').gz / door('.').gz) * 100)}% of the door on the shelf`, 'lbls')}
</g>`;

const CHROME_GZ = G('marked').gz + G('dompurify').gz;
const svg = `<svg viewBox="0 0 1160 ${SY + 107 + half * 17}" role="img" aria-label="The inside of one shipped app bundle drawn as an isometric city of fourteen buildings in three districts: footprint from post-tree-shake source bytes kept, height from gzipped wire share. The routing machine district is dominated by @uirouter/core at ${KB(G('@uirouter/core').gz)} while lit-ui-router itself is a small accent building at ${KB(G('lit-ui-router').gz)}; a single lit major stands, with no second copy; the demo-chrome district — visualizer, marked, dompurify, api-viewer, largely deferred to a lazy chunk — outweighs the machine; the app district holds the shared demo code, the ${KB(G('lodash-es').gz)} lodash-es remainder, the app's own source and a tiny building for the shared route table. A priced strip of the five entry doors and a structure schedule give exact counts.">
${defs(P)}

${groupOutline(20, 0, 395, 200, 'the routing machine', 150, 330)}
${groupOutline(420, 0, 712, 212, 'the demo chrome', 872, 220)}
${groupOutline(150, 270, 430, 412, 'the app itself', 336, 660)}

${bodies}

${txt(60, 56, `the machine the skin wraps: core ${KB(G('@uirouter/core').gz)} gz (${pct(G('@uirouter/core').gz)}) —`, 'lbla')}
${txt(60, 68, `lit-ui-router itself is ${KB(G('lit-ui-router').gz)} (${pct(G('lit-ui-router').gz)})`, 'lbla')}
${txt(1150, 240, `one lit major here: ${KB(G('lit').gz)} across ${G('lit').mods} modules —`, 'lbla', 'end')}
${txt(1150, 252, 'no second copy rides in with the chrome', 'lbla', 'end')}
${txt(1150, 336, `marked + dompurify: ${KB(CHROME_GZ)}`, 'lbla', 'end')}
${txt(1150, 348, 'gz — 5× the router they', 'lbla', 'end')}
${txt(1150, 360, 'document, now parked in a', 'lbla', 'end')}
${txt(1150, 372, 'lazy api-docs chunk', 'lbla', 'end')}
${txt(60, 585, `what the swap left: lodash-es ${KB(G('lodash-es').gz)} —`, 'lbla')}
${txt(60, 597, `the true cost of four imports, ${G('lodash-es').mods} modules unmoved`, 'lbla')}
<line x1="352" y1="578" x2="378" y2="518" class="skf"/>

${txt(1150, 26, 'SCALE — footprint area ∝ source kept · 1 px of height ≈ 150 gz bytes', 'lbls', 'end')}
${txt(1150, 40, BASIS, 'lblf', 'end')}

${doors}
${schedule}
</svg>`;

export const sheet10 = {
  num: 10, id: 'bundled', rev: 'E',
  title: 'THE BUNDLED CITY',
  sub: `ALTITUDE 2⅞ — inside the wire: what the bundler kept · one production bundle: ${all.length} package groups in ${T.chunks} chunks, ${fmt(T.gz)} gz, footprint from source kept and height from wire share — ${BASIS}`,
  scale: 'ONE BUNDLE',
  form: 'BUNDLED CITY',
  svg,
  caption: `One shipped bundle opened up: every package that survived tree-shaking as a building — footprint from source kept, height from gzipped wire share — and the machine the router wraps, the chrome that demos it, and the app that uses it stand as three districts summing to ${KB(T.gz)}.`,
  notes: `
<p><strong>Method:</strong> a <code>generateBundle</code> census on a real production vite build of <code>${PLATE.app}</code>, run inside a materialized, installed archive of the measured ref rather than the working tree — ${BASIS}. Every rendered module is attributed to its package by an explicit grouping table whose misses land in a loud <code>other</code> row (this print: none), and every footprint, height, schedule row and door price is read from the checked-in plates at build time — a group the drawing places that the plate does not carry is a build error, not a stale constant. Footprint is post-tree-shake source kept; height is <em>${PLATE.method}</em> — the honest wire share. Beside it, the repo's own codecov bundle-analysis probe (<code>tools/bundle-probe</code>, the <code>&lt;pkg&gt;-&lt;label&gt;-esm</code> series CI uploads) prices each exported entry at the same ref, read here from <code>www/atlas.lit-ui-router.dev/data/census-doors.json</code>. This closes the survey as a quartet: the source (7), what npm delivers (8), what the wire carries (9) — and here, who occupies those bytes. Sheet 11 is this sheet's split view: the same probe cut by published package, every entry priced alone. Whole bundle: ${fmt(T.kept)} kept → ${fmt(T.emitted)} emitted → ${fmt(T.gz)} gz in ${T.chunks} chunks.</p>
<p><strong>Reconciliation with sheet 9.</strong> The two sheets do not meet at an identity, and the reason is a rule: on sheet 9 a chunk counts where it is <em>first claimed</em>, so <code>ui-router-visualizer.esm</code> sits inside <code>app: vanilla</code> rather than beside it. Straight from the two plates: sheet 9's vanilla district is ${fmt(VAN.gz)} gz over ${VAN.files} files; this bundle is ${fmt(T.gz)} gz over ${T.chunks} chunks; the residual is ${fmt(RESID)} gz over ${RESID_FILES} file. That file is the one emitted <em>asset</em> in the app's output that is not a chunk — the api-viewer custom-elements manifest, JSON a module census structurally cannot see, since it walks <code>bundle</code> entries of type <code>chunk</code>. The app's stylesheet is not in the gap: sheet 9's pattern table files <code>.css</code> under <em>site css</em> before the app districts are reached. So ${fmt(T.gz)} + ${fmt(RESID)} = ${fmt(VAN.gz)}, and the named residual is a manifest, not a rounding error.</p>
<p><strong>The library is a skin over the machine.</strong> The biggest building in the bundle is not the router package — it is <code>@uirouter/core</code> at ${KB(G('@uirouter/core').gz)} gz, ${pct(G('@uirouter/core').gz)} of the wire, ${G('@uirouter/core').mods} modules. <code>lit-ui-router</code> itself is the small accent building: ${KB(G('lit-ui-router').gz)}, ${pct(G('lit-ui-router').gz)}, ${G('lit-ui-router').mods} modules. The two independent measurements reconcile: the codecov door prices the bare <code>.</code> entry at ${fmt(door('.').gz)} gz with deps external, and this app's census pulls ${fmt(G('lit-ui-router').gz)} of it — the ${Math.round((1 - G('lit-ui-router').gz / door('.').gz) * 100)}% difference is what the app's own imports leave on the shelf.</p>
<p><strong>The chrome outweighs the machine.</strong> marked, dompurify and <code>@api-viewer</code> total ${KB(CHROME_GZ + G('@api-viewer').gz)} gz — more than the routing machine they document — and the prebundled <code>@uirouter/visualizer</code> adds ${KB(G('@uirouter/visualizer').gz)} on its own, opaque to tree-shaking because it arrives already bundled. None of it is on the eager path: the panel renders behind a feature flag and rides a lazy <code>api-docs</code> chunk. This census counts who occupies the bundle, not when they arrive; sheet 9 draws the critical path. One lit major serves all of it — ${KB(G('lit').gz)} gz across ${G('lit').mods} modules, no second copy riding in with the docs-viewer stack, because a scoped pnpm override (<code>^3.3.3</code>, a floor, not a pin) holds <code>@api-viewer/*</code> and <code>lit-dialog</code> to it.</p>
<p><strong>The app's own district is the small one.</strong> <code>lodash-es</code> is ${KB(G('lodash-es').gz)} gz from ${G('lodash-es').mods} modules and ${KB(G('lodash-es').r)} of kept source — <code>isEqual</code>'s <code>_base*</code> family, the largest module count in the bundle and its own chunk, which is what four imports truly cost once tree-shaking has done its work. Beside it, the app's own source is ${KB(G('app own src').gz)} and <code>sample-app-routes</code> — the route table three apps import — is ${fmt(G('sample-app-routes').r)} bytes kept, ${fmt(G('sample-app-routes').gz)} on the wire, one module: the smallest building on the map.</p>
<p><strong>The runtime tax is near-zero.</strong> All bundler machinery — oxc decorator helpers, vite's preload helper and polyfill, a stray <code>tslib</code> — totals ${KB(G('runtime helpers').r)} kept, ${KB(G('runtime helpers').gz)} gz, ${((G('runtime helpers').r / T.kept) * 100).toFixed(1)}% of the kept source, in ${G('runtime helpers').mods} modules. No duplicated-helper problem.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'package group — height = gz wire share'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'lit-ui-router — the subject'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp2"/>', 'ships prebundled — opaque to tree-shaking'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'district (role in the bundle)'),
  ].join('\n'),
};

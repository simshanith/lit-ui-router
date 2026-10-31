import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, lines, isoBlock, isoPt, keyRow, npmUrl, schedule, leader } from './helpers.mjs';
import { assertPlots, depthSort, solidFaces } from './iso-hidden.mjs';

const P = 's9';

// the homes the notes name: the plate, the site and its pages, the typeface, the packages and tools the deploy carries
const REPO = 'https://github.com/simshanith/lit-ui-router';
const HOME = {
  plate: `${REPO}/blob/www/atlas/www/atlas.lit-ui-router.dev/data/census-shipped.json`,
  site: 'https://lit-ui-router.dev',
  siteDir: `${REPO}/tree/main/www/lit-ui-router.dev`,
  sampleApp: 'https://lit-ui-router.dev/sample-app',
  example: (name) => `https://lit-ui-router.dev/examples/${name}/`,
  inter: 'https://rsms.me/inter/',
  visualizer: npmUrl('@uirouter/visualizer'),
  apiViewer: 'https://github.com/open-wc/api-viewer-element',
  litDialog: npmUrl('lit-dialog'),
  overrides: 'https://pnpm.io/settings#overrides',
  manifest: 'https://custom-elements-manifest.open-wc.org',
  modelViewer: 'https://modelviewer.dev',
};
// the origin keeps the tallest cap and its badge 24 px inside the frame's top; the frame guard below holds every district there
const OX = 480, OY = 716;
const VB_W = 1160;
// callout pitch: an 11 px lbla line's box is 13.1 px tall, so 12 px stacks touch
const CP = 14;

// ---- census: every count comes from www/atlas.lit-ui-router.dev/data/census-shipped.json --------
// The plate is the checked-in snapshot census-shipped.mjs writes: docs/dist
// built inside a materialized, INSTALLED archive of the ref, then measured file
// by file — height is gzip level 9, the honest wire measure, since the CDN
// serves compressed.  Districts come from the probe's pattern table plus a
// reachability walk, and a chunk shipped once but loaded by several apps counts
// where it is FIRST claimed (vanilla → mobx → effect → hash → signals) — the CDN ships it once, so
// does this.  Orphans are whatever the walk never reaches; this plate finds
// none.  Placement, scale and prose stay editorial and live here.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-shipped.json', import.meta.url), 'utf8'));
const BASIS = `measured at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0, 10)}) · ${PLATE.wasGeneratedBy}`;
const row = (district) => {
  const r = PLATE.rows.find((x) => x.district === district);
  if (!r) throw new Error(`census-shipped.json: no district named ${district}`);
  return r;
};

export const SIDE = (f) => Math.max(18, 10 * Math.sqrt(f));
export const HT = (gz) => Math.max(8, gz / 4300);

// Manual plan, grouped by role, tall districts in back. [name → x, y]
const PLAN = {
  'examples': [150, 30],
  'images': [30, 120],
  'static data': [175, 140],
  // the site, re-laid at the 85e0ce5c refresh: the html tower at the back, the Markdown mirror east of it, the chunks in front
  'html pages': [324, 2],
  // the mirror north off 20 at the b499e2a5 refresh, when its 304 pages reached the chunks' lot
  'markdown pages': [524, 4],
  'page chunks': [282, 204],
  // the small towers in a row between the mirror and the apps' outline
  'inter fonts': [560, 204],
  'vp framework': [610, 204],
  'diagrams': [660, 204],
  'site css': [710, 204],
  'app: vanilla': [560, 300],
  'app: hash': [575, 398],
  'app: mobx': [655, 345],
  // the fourth shell, /app-effect (#721) — the lot east of vanilla, inside the group
  'app: effect': [660, 295],
  // the fifth shell, /app-signals: between vanilla and mobx, north of hash, inside the group
  'app: signals': [612, 360],
};

// The demo corpora are not shipped; their footprint is drawn as a vacant lot so
// the plan shows the gap. Files size the outline, as for every other district.
const LOT = { name: 'demo corpora', x: 60, y: 10, files: 15, gz: 899000 };

// The role outlines, in drawing order; appendix A4 sums the deploy by these roles, so a district no role claims is a build error.
export const ROLES = [
  { name: 'demo payload', role: 'demo payload — media · data', box: [20, 0, 230, 200], label: [40, OY - 55, 'start'],
    districts: ['examples', 'images', 'static data'] },
  { name: 'the documentation site', role: 'the documentation site', box: [275, 0, 745, 285], label: [985, OY + 60, 'start'],
    districts: ['html pages', 'markdown pages', 'inter fonts', 'vp framework', 'page chunks', 'diagrams', 'site css'] },
  { name: 'the routed apps', role: 'the routed apps', box: [540, 290, 720, 450], label: [526, OY + 515, 'end'],
    districts: ['app: vanilla', 'app: hash', 'app: mobx', 'app: effect', 'app: signals'] },
];

// Plate order is drawing order; a district with no plan slot is a build error.
const all = PLATE.rows.map((r, i) => {
  const at = PLAN[r.district];
  if (!at) throw new Error(`sheet 9: district ${r.district} has no PLAN placement`);
  const [x, y] = at;
  return { name: r.district, f: r.files, gz: r.gz, top: r.top, x, y, s: SIDE(r.files), h: HT(r.gz), n: i + 1 };
});

for (const { role, districts } of ROLES) for (const d of districts) {
  if (!PLATE.rows.some((r) => r.district === d)) throw new Error(`sheet 9: role ${role} names district ${d}, which is not on the plate`);
}
for (const { district } of PLATE.rows) {
  const claims = ROLES.filter((g) => g.districts.includes(district)).length;
  if (claims !== 1) throw new Error(`sheet 9: district ${district} is claimed by ${claims} roles, not one`);
}

// hand PLAN, data-driven sides: the plan may not ship overlapped
assertPlots('sheet 9', all.map(({ n, name, x, y, s }) => ({ n, name, part: 'block', x, y, w: s, d: s })));

// Back to front, with solid walls: a tenant behind a taller one is hidden, not traced.
const masses = all.map(({ name, x, y, s, h }) => ({ x, y, w: s, d: s,
  svg: solidFaces(isoBlock(P, OX, OY, x, y, s, s, h, { capCls: name.startsWith('app:') ? 'fa' : 'fp' })) }));

const badges = all.map(({ name, x, y, s, h, n }) => {
  const app = name.startsWith('app:');
  const [bx, by] = isoPt(OX, OY, x + s / 2, y, h);
  return `<circle cx="${bx.toFixed(1)}" cy="${(by - 14).toFixed(1)}" r="9" class="${app ? 'ska fp' : 'sk fp'}"/>
${txt(bx.toFixed(1), (by - 10.6).toFixed(1), String(n), 'lbls', 'middle')}`;
}).join('\n');

const bodies = depthSort(masses).map((m) => m.svg).join('\n') + '\n' + badges;

// the role outlines' near corners are the plate's lowest points
const VB_H = Math.ceil(Math.max(...ROLES.map(({ box: [, , x2, y2] }) => isoPt(OX, OY, x2, y2)[1]))) + 20;
// every cap corner and badge stays inside the frame: a grown district cannot ship cut off
for (const { name, x, y, s, h } of all) {
  const [bx, by] = isoPt(OX, OY, x + s / 2, y, h);
  const pts = [
    ...[[x, y], [x + s, y], [x + s, y + s], [x, y + s]].map(([px, py]) => ['cap', ...isoPt(OX, OY, px, py, h)]),
    ['badge', bx - 9, by - 14], ['badge', bx + 9, by - 14], ['badge', bx, by - 23], ['badge', bx, by - 5],
  ];
  for (const [part, px, py] of pts) {
    if (px < 0 || py < 0 || px > VB_W || py > VB_H) throw new Error(`sheet9: the ${part} of ${name} stands outside the ${VB_W} × ${VB_H} frame at ${px.toFixed(1)},${py.toFixed(1)} — move OY or its PLAN slot`);
  }
}

const lotOutline = ({ x, y, files }) => {
  const s = SIDE(files);
  const pts = [[x, y], [x + s, y], [x + s, y + s], [x, y + s]]
    .map(([px, py]) => isoPt(OX, OY, px, py).map((v) => v.toFixed(1)).join(','))
    .join(' ');
  return `<polygon points="${pts}" fill="url(#${P}-hd)" opacity="0.35"/>
<polygon points="${pts}" class="sks fnone" stroke-dasharray="4 3"/>`;
};

function groupOutline(x1, y1, x2, y2, label, lx, ly, anchor = 'start') {
  const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
    .map(([px, py]) => isoPt(OX, OY, px, py).map((v) => v.toFixed(1)).join(','))
    .join(' ');
  return `<polygon points="${pts}" class="skf fnone" stroke-dasharray="5 4"/>
${txt(lx, ly, label, 'lblf', anchor)}`;
}

// the vacant lot stands inside the demo payload's outline, so it is drawn right after it
const outlines = ROLES.map(({ box, role, label }, i) =>
  groupOutline(...box, role, ...label) + (i === 0 ? `\n${lotOutline(LOT)}` : '')).join('\n');

const KB = (gz) => `${(gz / 1024).toFixed(gz < 100000 ? 1 : 0)} KB`;
const MB = (b) => `${(b / 1048576).toFixed(1)} MB`;
const fmt = (v) => v.toLocaleString('en-US');
// vite hashes: an 8-char mixed-case segment, dot- or dash-joined, before the extension
const tenant = (p) => p.split('/').pop().replace(
  /([.-])([A-Za-z0-9_-]{8})(?=(\.lean)?\.[a-z0-9]+$)/,
  (m, _sep, h) => (/[A-Z]/.test(h) && /[a-z]/.test(h) ? '' : m));

const APPS = all.filter((r) => r.name.startsWith('app:')).reduce((s, r) => s + r.gz, 0);
const APP_PCT = ((APPS / PLATE.totals.gzBytes) * 100).toFixed(1);
const APP_N = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][all.filter((r) => r.name.startsWith('app:')).length];
if (!APP_N) throw new Error('sheet 9: no number word for the routed apps — extend the list');
const INTER = row('inter fonts'), PAGES = row('html pages'), MIRROR = row('markdown pages'), DIAGRAMS = row('diagrams');
const EXAMPLES = row('examples'), VANILLA = row('app: vanilla'), HASH = row('app: hash');
// the examples' lead is read off the plate: the example that carries it and the chunk's unhashed name
const LEAD = EXAMPLES.top;
const LEAD_EXAMPLE = LEAD.name.match(/^examples\/([^/]+)\//)?.[1];
if (!LEAD_EXAMPLE) throw new Error(`sheet9: the examples district's largest tenant ${LEAD.name} is not under examples/<name>/`);
const LEAD_CHUNK = tenant(LEAD.name).replace(/\.js$/, '');
if (LEAD_CHUNK !== 'model-viewer') throw new Error(`sheet9: the notes say a model-viewer chunk leads the examples, and the plate's lead is ${LEAD_CHUNK}`);
if (!LEAD_EXAMPLE.startsWith('hellogalaxy')) throw new Error(`sheet9: the notes say a galaxy leads the examples, and the plate's lead belongs to ${LEAD_EXAMPLE}`);
const SMALL_APPS = VANILLA.gz + row('app: mobx').gz + HASH.gz;
if (LEAD.gz <= SMALL_APPS) throw new Error(`sheet9: the notes say the ${LEAD_CHUNK} chunk outweighs vanilla, mobx and hash combined, and the plate reads ${LEAD.gz} against ${SMALL_APPS}`);
// The top of the skyline is a race, and the order changes between refs — so the
// ranking is read off the plate rather than typed. RANKED is every district by
// gz, tallest first; nothing below names a district's position by hand.
const RANKED = [...all].sort((a, b) => b.gz - a.gz);
const rank = (name) => {
  const i = RANKED.findIndex((r) => r.name === name);
  if (i < 0) throw new Error(`sheet 9: no district named ${name} to rank`);
  return i + 1;
};
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const INTER_RANK = rank('inter fonts');
const TALLER_THAN_INTER = RANKED.slice(0, INTER_RANK - 1).map((r) => r.name);
if (TALLER_THAN_INTER.join() !== [PAGES.district, EXAMPLES.district].join()) throw new Error(`sheet 9: the notes say only the prose and the examples outrank the lettering, and the plate ranks [${TALLER_THAN_INTER}] above it`);
const RUNNER_GAP = RANKED[0].gz - RANKED[1].gz;
if (RANKED[0].name !== PAGES.district) throw new Error(`sheet 9: the notes say the prose is the tallest district, and the plate ranks ${RANKED[0].name} first`);
// the cover index's fit verdict, told from the plate's own ranking
export const SHEET9_VERDICT = `the wire survey — the deploy's tallest district is ${RANKED[0].name} at ${KB(RANKED[0].gz)}, and the lettering alone outweighs every routed app the site exists to demonstrate (${KB(INTER.gz)} against ${KB(APPS)})`;

// the apps callout lands mid-height on the effect app's +x face, the app nearest its lettering
const EFFECT = all.find((r) => r.name === 'app: effect');
const EFFECT_FACE = isoPt(OX, OY, EFFECT.x + EFFECT.s, EFFECT.y + EFFECT.s / 2, EFFECT.h / 2);

const SCHEDULE = schedule(
  'STRUCTURE SCHEDULE — files · gzipped wire bytes · largest tenant',
  ['#', 'district', 'files', 'gzipped', 'largest tenant', 'tenant gzipped'],
  all.map((r) => [r.n, r.name, r.f, KB(r.gz), tenant(r.top.name), KB(r.top.gz)]),
  `TOTAL — ${all.length} districts · ${fmt(PLATE.totals.files)} files · ${fmt(PLATE.totals.rawBytes)} raw bytes · ${fmt(PLATE.totals.gzBytes)} gzipped · 0 orphans · ${BASIS}`,
);

const svg = `<svg viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-label="The production docs-site deploy drawn as an isometric city of ${all.length} districts: footprint area from file counts, height from gzipped bytes on the wire. The three tallest towers are ${RANKED.slice(0, 3).map((r) => r.name).join(', ')}. A vacant lot at the plan's edge is the demo corpora's footprint, which the deploy does not carry. The ${APP_N} routed sample apps are small accent buildings totalling ${APP_PCT} percent of the deploy. There is no ghost block: the census walks backtick-quoted asset URLs too, and this deploy carries no unreachable files at all. A schedule below the drawing lists every district with exact counts and its largest tenant.">
${defs(P)}

${outlines}

${bodies}

${lines(150, OY - 85, [`a vacant lot — ${LOT.files} files, ${KB(LOT.gz)} of Dickens,`, 'Beowulf and an RFC the site does not ship'], 'lbla', 'start', CP)}
${leader(442, OY - 85 + CP, 502, OY + 43)}
${lines(1120, OY + 510, [`all ${APP_N} apps: ${KB(APPS)} —`, `${APP_PCT}% of the deploy they exist to demonstrate`], 'lbla', 'end', CP)}
${leader(972, OY + 506, ...EFFECT_FACE)}

<!-- one short line at the frame's top-right corner, east of the html-pages cap -->
${txt(1120, 26, 'SCALE — 1 px of height ≈ 4.2 KB gzipped', 'lbls', 'end')}
</svg>`;

export const sheet9 = {
  num: 9, id: 'shipped', rev: 'I',
  title: 'THE SHIPPED CITY',
  sub: `ALTITUDE 2¾ — what the browser downloads · lit-ui-router.dev, one deploy · ${fmt(PLATE.totals.files)} files in ${all.length} districts, ${MB(PLATE.totals.gzBytes)} on the wire, footprint from file count and height from gzipped bytes — ${BASIS}`,
  scale: 'ONE DEPLOY',
  form: 'SHIPPED CITY',
  svg,
  schedule: SCHEDULE,
  caption: `The production docs deploy surveyed on the wire: ${fmt(PLATE.totals.files)} files, ${MB(PLATE.totals.gzBytes)} gzipped, drawn as ${all.length} districts — the tallest towers are prerendered prose and font files, the routed apps are ${KB(APPS)} of accent buildings in their own city, and there is no ghost block: the deploy carries no unreachable files at all.`,
  notes: `
<p><strong>Method:</strong> every number on this sheet is read at build time from the checked-in plate <a href="${HOME.plate}"><code>www/atlas.lit-ui-router.dev/data/census-shipped.json</code></a> — ${BASIS}. The probe builds <code><a href="${HOME.siteDir}">www/lit-ui-router.dev</a>/dist</code> inside a materialized, installed archive of the ref, never the working tree, and measures it file by file: height is gzip level 9 of each file, the honest wire measure, since the CDN serves compressed. Footprint is file count, as on sheets 7 and 8. A reachability walk — every HTML shell and hashed chunk, following static asset references — sorts the assets into districts, and a shared chunk counts where it is first claimed (vanilla → mobx → effect → hash → signals), because the CDN ships it once. This sheet extends the survey a step further: sheet 7 measures the source, sheet 8 what npm delivers, this sheet what one deploy actually ships — ${fmt(PLATE.totals.files)} files, ${MB(PLATE.totals.rawBytes)} on disk, ${MB(PLATE.totals.gzBytes)} on the wire. Sheet 10 goes one level in again and opens the bundle itself.</p>
<p><strong>The tallest building is the prose.</strong> The skyline is <a href="${HOME.site}">the site</a>'s ${PAGES.files} prerendered HTML pages at ${KB(PAGES.gz)}, with <code>${RANKED[1].name}</code> ${fmt(RUNNER_GAP)} bytes behind at ${KB(RANKED[1].gz)} — the prose outweighs the runner-up ${(PAGES.gz / RANKED[1].gz).toFixed(1)} to 1. <a href="${HOME.inter}">Inter</a>'s ${INTER.files} <code>woff2</code> faces stand ${ORD[INTER_RANK - 1]} at ${KB(INTER.gz)}: on the wire, this documentation site is still mostly prose and typography, and the one script district that outranks the lettering is the examples, led by a single galaxy. The prose ships twice: beside the HTML stands its Markdown mirror, ${MIRROR.files} files at ${KB(MIRROR.gz)} — a plain-text copy of every page plus <code>llms.txt</code> and <code>llms-full.txt</code>, the site's text for language models — and the ${DIAGRAMS.files} diagrams the pages inline also stand alone as public <code>.svg</code> files, ${KB(DIAGRAMS.gz)}. A vacant lot at the plan's edge is the demo corpora's footprint, which the deploy does not carry.</p>
<p><strong>The product is a guest in its own city.</strong> The ${APP_N} routed <a href="${HOME.sampleApp}">sample apps</a> — the thing the site exists to demonstrate — total ${KB(APPS)} gzipped, ${APP_PCT}% of the deploy. First claim seats <a href="${HOME.visualizer}"><code>visualizer.esm</code></a> and the <a href="${HOME.manifest}">custom-elements manifest</a> in <code>app: vanilla</code>, which is why that district reads ${VANILLA.files} files and ${KB(VANILLA.gz)} while the hash app's whole district is ${HASH.files} files and ${KB(HASH.gz)}. Two rules shape those numbers rather than the CDN: a <a href="${HOME.overrides}">scoped override</a> holds the <a href="${HOME.apiViewer}"><code>@api-viewer</code></a>/<a href="${HOME.litDialog}"><code>lit-dialog</code></a> stack to one lit major, so identical lit chunks hash identically <em>across</em> apps and part of mobx's download is chunks vanilla already ships; and the api-viewer docs panel, which renders only behind a feature flag, arrives in a lazy <code>api-docs</code> chunk rather than the eager main one. Same bytes on the CDN, fewer on the critical path.</p>
<p><strong>There is no ghost district.</strong> The reachability walk follows the backtick-quoted asset URLs the app chunks build by hand, so the api-viewer custom-elements manifest is reachable after all, and the orphan list on this plate is <em>empty</em> — no hatched block stands here. Read that as a statement about the instrument as much as the deploy: an orphan count is only as good as the walk that produces it, and earlier walks over an accumulated local <code>dist/</code> reported orphans that were stale build output, not shipped weight. This census builds clean, into a materialized archive of the ref, and counts what a browser can reach.</p>
<p><strong>One example outweighs the router.</strong> The examples district — ${EXAMPLES.files} files, ${KB(EXAMPLES.gz)} — is led by the <a href="${HOME.example(LEAD_EXAMPLE)}"><code>${LEAD_EXAMPLE}</code></a> example's <a href="${HOME.modelViewer}"><code>${LEAD_CHUNK}</code></a> chunk at ${KB(LEAD.gz)} on its own, heavier than the vanilla, mobx and hash apps combined, delivered so one tutorial page can spin a galaxy.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'site district — height = gzipped bytes'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'a routed sample app'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'group (role in the deploy)'),
    keyRow(`<rect x="8" y="3" width="18" height="12" fill="url(#${P}-hd)" opacity="0.35"/><rect x="8" y="3" width="18" height="12" class="sks fnone" stroke-dasharray="4 3"/>`, 'a vacant lot — a footprint the deploy does not fill'),
  ].join('\n'),
};

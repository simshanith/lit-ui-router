import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, isoBlock, isoPt, keyRow } from './helpers.mjs';
import { depthSort, solidFaces } from './iso-hidden.mjs';

const P = 's9';
const OX = 480, OY = 205;

// ---- census: every count comes from diagrams/data/census-shipped.json --------
// The plate is the checked-in snapshot census-shipped.mjs writes: docs/dist
// built inside a materialized, INSTALLED archive of the ref, then measured file
// by file — height is gzip level 9, the honest wire measure, since the CDN
// serves compressed.  Districts come from the probe's pattern table plus a
// reachability walk, and a chunk shipped once but loaded by several apps counts
// where it is FIRST claimed (vanilla → mobx → hash) — the CDN ships it once, so
// does this.  Orphans are whatever the walk never reaches; this plate finds
// none.  Placement, scale and prose stay editorial and live here.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-shipped.json', import.meta.url), 'utf8'));
const BASIS = `measured at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0, 10)}) · ${PLATE.wasGeneratedBy}`;
const row = (district) => {
  const r = PLATE.rows.find((x) => x.district === district);
  if (!r) throw new Error(`census-shipped.json: no district named ${district}`);
  return r;
};

const SIDE = (f) => Math.max(18, 10 * Math.sqrt(f));
const HT = (gz) => Math.max(8, gz / 4300);

// Manual plan, grouped by role, tall districts in back. [name → x, y]
const PLAN = {
  'examples': [150, 30],
  'images': [30, 120],
  'static data': [175, 140],
  'inter fonts': [330, 10],
  'html pages': [430, 20],
  'vp framework': [600, 30],
  'page chunks': [330, 160],
  'site css': [545, 200],
  'app: vanilla': [560, 300],
  'app: hash': [575, 398],
  'app: mobx': [655, 345],
};

// REV G: the corpora district left the deploy with #716. Its lot stays on the
// plan as a vacant footprint at rev F's side, so the skyline change is drawn.
const LOT = { name: 'demo corpora', x: 60, y: 10, files: 15, gz: 899000 };

// Plate order is drawing order; a district with no plan slot is a build error.
const all = PLATE.rows.map((r, i) => {
  const at = PLAN[r.district];
  if (!at) throw new Error(`sheet 9: district ${r.district} has no PLAN placement`);
  const [x, y] = at;
  return { name: r.district, f: r.files, gz: r.gz, top: r.top, x, y, s: SIDE(r.files), h: HT(r.gz), n: i + 1 };
});

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

const KB = (gz) => `${(gz / 1024).toFixed(gz < 100000 ? 1 : 0)} KB`;
const MB = (b) => `${(b / 1048576).toFixed(1)} MB`;
const fmt = (v) => v.toLocaleString('en-US');
// vite hashes: an 8-char mixed-case segment, dot- or dash-joined, before the extension
const tenant = (p) => p.split('/').pop().replace(
  /([.-])([A-Za-z0-9_-]{8})(?=(\.lean)?\.[a-z0-9]+$)/,
  (m, _sep, h) => (/[A-Z]/.test(h) && /[a-z]/.test(h) ? '' : m));

const APPS = all.filter((r) => r.name.startsWith('app:')).reduce((s, r) => s + r.gz, 0);
const APP_PCT = ((APPS / PLATE.totals.gzBytes) * 100).toFixed(1);
const INTER = row('inter fonts'), PAGES = row('html pages');
const EXAMPLES = row('examples'), VANILLA = row('app: vanilla'), HASH = row('app: hash');
const LETTER_GAP = Math.abs(INTER.gz - PAGES.gz);
// at rev F the HTML district passed the fonts — the label has to know which way
const PAGES_LEAD = PAGES.gz > INTER.gz;

const half = Math.ceil(all.length / 2);
const SY = 790;
const line = (r) => `${r.n} ${r.name} — ${r.f}f ${KB(r.gz)} · ${tenant(r.top.name)} ${KB(r.top.gz)}`;
const schedule = `<g>
<rect x="40" y="${SY}" width="1080" height="${70 + half * 17}" class="sk fp"/>
${txt(56, SY + 22, 'STRUCTURE SCHEDULE — files · gzipped wire bytes · largest tenant', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1120" y2="${SY + 32}" class="skf"/>
${all.slice(0, half).map((r, i) => txt(56, SY + 52 + i * 17, line(r), 'lbls')).join('\n')}
${all.slice(half).map((r, i) => txt(590, SY + 52 + i * 17, line(r), 'lbls')).join('\n')}
${txt(56, SY + 58 + half * 17, `TOTAL — ${all.length} districts · ${fmt(PLATE.totals.files)} files · ${fmt(PLATE.totals.rawBytes)} raw bytes · ${fmt(PLATE.totals.gzBytes)} gzipped · 0 orphans · ${BASIS}`, 'lbls')}
</g>`;

const svg = `<svg viewBox="0 0 1160 ${SY + 108 + half * 17}" role="img" aria-label="The production docs-site deploy drawn as an isometric city of ${all.length} districts: footprint area from file counts, height from gzipped bytes on the wire. The tallest towers are the prerendered HTML pages and the Inter font files, not code; the demo text corpora that stood tallest until rev F left the deploy, and their lot is drawn vacant. The three routed sample apps are small accent buildings totalling ${APP_PCT} percent of the deploy. There is no ghost block: the scripted census walks backtick-quoted asset URLs too, and a clean deploy ships no unreachable files at all. A structure schedule lists every district with exact counts and its largest tenant.">
${defs(P)}

${groupOutline(20, 0, 230, 200, 'demo payload — media · data', 40, 150)}
${lotOutline(LOT)}
${groupOutline(320, 0, 700, 260, 'the documentation site', 866, 200)}
${groupOutline(540, 290, 720, 450, 'the routed apps', 540, 700, 'end')}

${bodies}

${txt(150, 120, `the corpora's lot — ${LOT.files} files, ${KB(LOT.gz)} of Dickens,`, 'lbla')}
${txt(150, 132, 'Beowulf and an RFC — struck from the deploy at #716', 'lbla')}
<line x1="442" y1="132" x2="502" y2="248" class="skf"/>
${txt(1120, 96, `${KB(INTER.gz)} of Inter — the lettering still`, 'lbla', 'end')}
${txt(1120, 108, `outweighs every script — and the HTML ${PAGES_LEAD ? 'just passed it' : 'is closing'}`, 'lbla', 'end')}
${txt(1120, 715, `all three apps: ${KB(APPS)} —`, 'lbla', 'end')}
${txt(1120, 727, `${APP_PCT}% of the deploy (rev C read 4.5%, pre-attribution)`, 'lbla', 'end')}
<line x1="937" y1="711" x2="878" y2="689" class="skf"/>
${txt(110, 558, 'no ghost district stands here any more:', 'lbla')}
${txt(110, 570, 'the walk follows backtick-quoted asset URLs now,', 'lbla')}
${txt(110, 582, 'and a clean deploy ships ZERO unreachable files', 'lbla')}
${txt(110, 614, 'REV C (#618): one lit major, and api-viewer waits', 'lbla')}
${txt(110, 626, 'in a lazy api-docs chunk — every main shrinks', 'lbla')}
${txt(110, 638, '34 → 7 KB, and mobx now rides chunks vanilla', 'lbla')}
${txt(110, 650, 'already ships', 'lbla')}
${txt(110, 674, 'REV E: every district read from the census plate —', 'lbla')}
${txt(110, 686, 'first claim now seats the visualizer in app: vanilla', 'lbla')}
${txt(110, 710, `REV G: the tallest tower left town — ${KB(LOT.gz)} of corpora`, 'lbla')}
${txt(110, 722, 'gone with #716, and the skyline is prose, then type', 'lbla')}

${txt(1120, 26, 'SCALE — footprint area ∝ files · 1 px of height ≈ 4.2 KB gzipped', 'lbls', 'end')}

${schedule}
</svg>`;

export const sheet9 = {
  num: 9, id: 'shipped', rev: 'G',
  title: 'THE SHIPPED CITY',
  sub: `ALTITUDE 2¾ — what the browser downloads · lit-ui-router.dev, one deploy · ${fmt(PLATE.totals.files)} files, ${MB(PLATE.totals.gzBytes)} on the wire · REV D: hidden-line pass — opaque tenant walls painted back to front · REV E 2026-09-03: every count now imported from diagrams/data/census-shipped.json — the ghost district is struck from the drawing · REV F: whole-cabinet refresh — the HTML pages overtook Inter, measured at origin/main @ b2338d0 (2026-09-04) · REV G 2026-09-07: re-surveyed after #716 dropped the sample app's markov seed pipeline — the corpora district (15 files, 899 KB, the tallest tower since rev A) left the deploy with three static data files, so ${all.length} districts stand and the HTML pages are the skyline; the corpora's lot is drawn vacant — ${BASIS}`,
  scale: 'ONE DEPLOY',
  form: 'SHIPPED CITY',
  svg,
  caption: `The production docs deploy surveyed on the wire: ${fmt(PLATE.totals.files)} files, ${MB(PLATE.totals.gzBytes)} gzipped, drawn as ${all.length} districts — the tallest towers are now prerendered prose and font files — the sample novels left the deploy at rev G, and their lot is drawn vacant — the routed apps are ${KB(APPS)} of accent buildings in their own city, and the ghost block is gone: a clean deploy ships no unreachable files at all.`,
  notes: `
<p><strong>Method:</strong> every number on this sheet is read at build time from the checked-in plate <code>diagrams/data/census-shipped.json</code> — ${BASIS}. The probe builds <code>www/lit-ui-router.dev/dist</code> inside a materialized, installed archive of the ref, never the working tree, and measures it file by file: height is gzip level 9 of each file, the honest wire measure, since the CDN serves compressed. Footprint is file count, as on sheets 7 and 8. A reachability walk — every HTML shell and hashed chunk, following static asset references — sorts the assets into districts, and a shared chunk counts where it is first claimed (vanilla → mobx → hash), because the CDN ships it once. This sheet extends the survey a step further: sheet 7 measured what we wrote, sheet 8 what npm delivered, this sheet what one deploy actually ships — ${fmt(PLATE.totals.files)} files, ${MB(PLATE.totals.rawBytes)} on disk, ${MB(PLATE.totals.gzBytes)} on the wire. Sheet 10 goes one level in again and opens the bundle itself.</p>
<p><strong>The tallest building is the prose.</strong> For five revisions the skyline belonged to the demo corpora — novels, Beowulf, an RFC, pre-gzipped <code>.txt.gz</code> so compression couldn't help further. They are gone (see REV G), and the city's tallest district is now the site's ${PAGES.files} prerendered HTML pages at ${KB(PAGES.gz)}, with Inter's ${INTER.files} <code>woff2</code> faces ${PAGES_LEAD ? `${fmt(LETTER_GAP)} bytes behind` : `${fmt(LETTER_GAP)} bytes ahead`} at ${KB(INTER.gz)}. Code still doesn't crack the top two: on the wire, this documentation site is mostly prose and typography, and the first script district — the examples, led by one galaxy — stands third at ${KB(EXAMPLES.gz)}.</p>
<p><strong>The product is a guest in its own city.</strong> The three routed sample apps — the thing the site exists to demonstrate — total ${KB(APPS)} gzipped, ${APP_PCT}% of the deploy. The rise from rev C's 173 KB / 4.5% is mostly bookkeeping: that survey counted the visualizer chunk with the page chunks, and on the scripted census, first claim seats <code>visualizer.esm</code> (and the custom-elements manifest) in <code>app: vanilla</code>, which is why that district reads ${VANILLA.files} files and ${KB(VANILLA.gz)}. The bytes on the CDN did not move. What did move at rev C stands: PR #618 scoped an override so the <code>@api-viewer</code>/<code>lit-dialog</code> stack shares one lit 3.3.3, and identical lit chunks now hash identically <em>across</em> apps, so part of mobx's download is chunks vanilla already shipped.</p>
<p><strong>The panel that waited its turn.</strong> The api-viewer docs panel — marked, dompurify, three <code>@api-viewer</code> packages — only renders behind a feature flag, but rev B's apps carried it in the eager main chunk anyway. It now arrives as a lazy <code>api-docs</code> chunk, and every app's main chunk drops 34 → 7 KB gz: the hash app's whole district is ${HASH.files} files and ${KB(HASH.gz)}. Same bytes on the CDN, different bytes on the critical path.</p>
<p><strong>The ghost district was the instrument, twice.</strong> Rev A reported twelve orphan files, 138 KB of dead weight in every deploy — but that survey read an accumulated local <code>dist/</code>, where parallel app builds pile up stale hashes. Rev C rebuilt from a clean checkout and reported exactly one unreachable file, a 1.7 KB custom-elements manifest, and the drawing made a rule of it: a clean tree ships exactly one. That rule was also an artifact. The scripted probe's reachability walk follows the backtick-quoted asset URLs the app chunks build by hand, and the manifest is reachable after all: the orphan list on this plate is <em>empty</em>. The hatched ghost block is struck from the drawing, and the caution survives it in stronger form — twice now, the orphans were a property of the instrument, not of the deploy.</p>
<p><strong>REV F — the whole cabinet, one ref, and a district changed places.</strong> Every plate in <code>diagrams/data/</code> was re-counted at origin/main @ b2338d0 in one pass, and this deploy moved where the shopfront grew: 593 files against rev E's 586, the same 12 districts, still no orphans, 4.0 MB on the wire — 126,991 gzipped bytes more than rev E, on a four-megabyte deploy. The examples district took most of it (four more files, the lint-eslint example landing); the three documentation districts — html pages, page chunks and the VitePress framework — each gained a percent or two as the guides grew, and that was enough to settle the closest race on the sheet. The HTML pages have overtaken Inter: 883,505 gz against 866,700, a 16,805-byte lead where rev E had the fonts ahead by 504. The reading stands as it did, only sharper — the two tallest things this documentation site ships are prose and typography, and the corpora still tower over both.</p>
<p><strong>REV G — the tallest tower left town.</strong> PR #716 dropped the sample app's markov seed pipeline, and with it the fifteen pre-gzipped corpora that had been this city's tallest district since rev A: 899 KB of Dickens, Beowulf, Flatland and an RFC, plus three of the static data files that fed them. Re-surveyed at ${PLATE.ref} @ ${PLATE.sha}, the deploy is ${fmt(PLATE.totals.files)} files against rev F's 593 and ${MB(PLATE.totals.gzBytes)} on the wire against 4.0 — ${fmt(4164505 - PLATE.totals.gzBytes)} gzipped bytes lighter, ${((1 - PLATE.totals.gzBytes / 4164505) * 100).toFixed(0)}% of the deploy, on a change that touched no page and no script. Nothing else moved: Inter is identical to the byte, the HTML pages gained ${fmt(PAGES.gz - 883505)}. The corpora's lot stays on the plan, drawn vacant beside the images, because a skyline that loses its landmark should show where it stood. The routed apps' share rises to ${APP_PCT}% without a byte of theirs changing — the same arithmetic that made rev C's 4.5% a bookkeeping number cuts the other way when the city shrinks around them.</p>
<p><strong>One example outweighs the router.</strong> The examples district (${EXAMPLES.files} files, ${KB(EXAMPLES.gz)}, and two examples wider than rev C — the design-system-links tutorial and the lint-eslint example) is led by the hellogalaxy demo's <code>model-viewer</code> chunk at ${KB(EXAMPLES.top.gz)} on its own — heavier than all three sample apps combined, delivered so one tutorial page can spin a galaxy.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'site district — height = gzipped bytes'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'a routed sample app'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'group (role in the deploy)'),
    keyRow(`<rect x="8" y="3" width="18" height="12" fill="url(#${P}-hd)" opacity="0.35"/><rect x="8" y="3" width="18" height="12" class="sks fnone" stroke-dasharray="4 3"/>`, 'a vacant lot — a district that left the deploy'),
  ].join('\n'),
};

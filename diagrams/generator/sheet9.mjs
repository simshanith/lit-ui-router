import { defs } from './chrome.mjs';
import { txt, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's9';
const OX = 480, OY = 205;

// docs/dist clean-checkout build, remeasured 2026-08-17 after the single-lit +
// lazy api-viewer merge (PR #618): 575 files, 14,582,088 raw bytes, 3,894,271
// gzipped (level 9) — the wire proxy (rev B: 566f / 3,940,287 gz). Reachability
// BFS marks orphans; a clean tree has exactly one. Shared-pool attribution as
// before: a chunk shipped once but loaded by several apps counts where it is
// first claimed (vanilla → mobx → hash) — the CDN ships it once, so does this.
// [name, files, gzBytes, ghost?]
const DATA = [
  ['demo corpora', 15, 899000],
  ['inter fonts', 16, 866700],
  ['html pages', 132, 832758],
  ['examples', 9, 451396],
  ['page chunks', 252, 275015],
  ['vp framework', 10, 170276],
  ['images', 98, 127073],
  ['app: vanilla', 17, 96556],
  ['app: mobx', 9, 66194],
  ['static data', 7, 51884],
  ['site css', 5, 41719],
  ['app: hash', 4, 13994],
  ['orphans', 1, 1706, true],
];

const SIDE = (f) => Math.max(18, 10 * Math.sqrt(f));
const HT = (gz) => Math.max(8, gz / 4300);

// Manual plan, grouped by role, tall districts in back. [name → x, y]
const PLAN = {
  'demo corpora': [60, 10],
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
  'orphans': [120, 330, true],
};

const all = DATA.map((it, i) => {
  const [name, f, gz, ghost] = it;
  const [x, y] = PLAN[name];
  return { it, name, f, gz, ghost, x, y, s: SIDE(f), h: HT(gz), n: i + 1 };
});

const bodies = all
  .slice()
  .sort((a, b) => (a.x + a.y + a.s) - (b.x + b.y + b.s))
  .map(({ name, x, y, s, h, ghost, n }) => {
    const app = name.startsWith('app:');
    const blk = ghost
      ? isoBlock(P, OX, OY, x, y, s, s, h, { edge: 'skf', capCls: 'fnone', sideFill: `url(#${P}-hd)` })
      : isoBlock(P, OX, OY, x, y, s, s, h, { capCls: app ? 'fa' : 'fp' });
    const [bx, by] = isoPt(OX, OY, x + s / 2, y, h);
    return `${blk}
<circle cx="${bx.toFixed(1)}" cy="${(by - 14).toFixed(1)}" r="9" class="${app ? 'ska fp' : 'sk fp'}"/>
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

const KB = (gz) => `${(gz / 1024).toFixed(gz < 100000 ? 1 : 0)} KB`;
const TOPS = {
  'demo corpora': 'two-cities.txt.gz 294 KB',
  'inter fonts': 'italic-latin-ext.woff2 137 KB',
  'html pages': 'server-route-matching 34 KB',
  'examples': 'model-viewer chunk 275 KB',
  'page chunks': 'visualizer.esm 24 KB',
  'vp framework': 'localSearchIndex 62 KB',
  'orphans': 'custom-elements manifest 1.7 KB',
  'images': 'lit-ui-router.png 67 KB',
  'app: vanilla': 'dist 29 KB · lazy api-docs 27 KB',
  'app: mobx': 'dist 29 KB · shares 41 KB w/ vanilla',
  'static data': 'messages.json 47 KB',
  'app: hash': 'main 7 KB — the rest is shared',
  'site css': 'style.css 20 KB',
};
const half = Math.ceil(all.length / 2);
const SY = 790;
const schedule = `<g>
<rect x="40" y="${SY}" width="1080" height="${52 + half * 17}" class="sk fp"/>
${txt(56, SY + 22, 'STRUCTURE SCHEDULE — files · gzipped wire bytes · largest tenant', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1120" y2="${SY + 32}" class="skf"/>
${all.slice(0, half).map((r, i) => txt(56, SY + 52 + i * 17, `${r.n} ${r.name} — ${r.f}f ${KB(r.gz)} · ${TOPS[r.name]}`, 'lbls')).join('\n')}
${all.slice(half).map((r, i) => txt(590, SY + 52 + i * 17, `${r.n} ${r.name} — ${r.f}f ${KB(r.gz)} · ${TOPS[r.name]}`, 'lbls')).join('\n')}
</g>`;

const svg = `<svg viewBox="0 0 1160 ${SY + 90 + half * 17}" role="img" aria-label="The production docs-site deploy drawn as an isometric city of thirteen districts: footprint area from file counts, height from gzipped bytes on the wire. The tallest towers are the demo text corpora and the Inter font files, not code; the three routed sample apps are small accent buildings, shrunk in this revision to 173 KB from 249 by deduplicating lit to one major and deferring the api-viewer panel to a lazy chunk; a tiny hatched ghost block marks the single unreferenced file a clean deploy ships. A structure schedule lists every district with exact counts.">
${defs(P)}

${groupOutline(20, 0, 230, 200, 'demo payload — corpora · media · data', 40, 150)}
${groupOutline(320, 0, 700, 260, 'the documentation site', 866, 200)}
${groupOutline(540, 290, 720, 450, 'the routed apps', 540, 700, 'end')}

${bodies}

${txt(150, 60, 'A Tale of Two Cities alone: 294 KB —', 'lbla')}
${txt(150, 72, 'the tallest tenant on the skyline is Dickens', 'lbla')}
${txt(890, 96, '867 KB of Inter — the lettering', 'lbla')}
${txt(890, 108, 'outweighs every script on the site', 'lbla')}
${txt(1120, 715, 'all three apps: 173 KB —', 'lbla', 'end')}
${txt(1120, 727, '4.5% of the deploy (rev B: 6.3%)', 'lbla', 'end')}
<line x1="937" y1="711" x2="878" y2="689" class="skf"/>
${txt(110, 570, 'rev A drew 138 KB of orphans here —', 'lbla')}
${txt(110, 582, 'a clean build ships one file, 1.7 KB', 'lbla')}
${txt(110, 614, 'REV C (#618): one lit major, and api-viewer waits', 'lbla')}
${txt(110, 626, 'in a lazy api-docs chunk — every main shrinks', 'lbla')}
${txt(110, 638, '34 → 7 KB, and 41 KB of mobx now rides', 'lbla')}
${txt(110, 650, 'chunks vanilla already ships', 'lbla')}

${txt(1120, 26, 'SCALE — footprint area ∝ files · 1 px of height ≈ 4.2 KB gzipped', 'lbls', 'end')}

${schedule}
</svg>`;

export const sheet9 = {
  num: 9, id: 'shipped', rev: 'C',
  title: 'THE SHIPPED CITY',
  sub: 'ALTITUDE 2¾ — what the browser downloads · lit-ui-router.dev, one deploy · REV C: remeasured after the single-lit + lazy api-viewer merge · 2026-08-17',
  scale: 'ONE DEPLOY',
  form: 'SHIPPED CITY',
  svg,
  caption: 'The production docs deploy surveyed on the wire: 575 files, 3.7 MB gzipped, drawn as thirteen districts — the tallest towers are still sample novels and font files, and the routed apps, re-cut in this revision to one lit major and a lazy api-viewer chunk, shrink to 173 KB of accent buildings in their own city.',
  notes: `
<p><strong>Method:</strong> a fresh <code>docs/dist</code> build measured file by file; height is gzip level 9 of each file — the honest wire measure, since the CDN serves compressed. Footprint is file count, as on sheets 7 and 8. A reachability walk (every HTML shell and hashed chunk, following static asset references) sorts the assets into districts. This sheet extends the survey a step further: sheet 7 measured what we wrote, sheet 8 what npm delivered, this sheet what one deploy actually ships — 575 files, 14.6 MB on disk, 3.7 MB on the wire. Sheet 10 goes one level in again and opens the bundle itself. REV B remeasured after the lodash-es swap (PR #604); REV C remeasures after the single-lit + lazy api-viewer merge (PR #618), same clean-checkout basis.</p>
<p><strong>The tallest building is Dickens.</strong> The demo corpora — novels, Beowulf, an RFC, pre-gzipped <code>.txt.gz</code> so compression can't help further — are the city's tallest district at 899 KB, with Inter's sixteen <code>woff2</code> faces one notch behind at 867 KB. Code doesn't crack the top two: on the wire, this documentation site is mostly sample text and typography.</p>
<p><strong>The product is a guest in its own city.</strong> The three routed sample apps — the thing the site exists to demonstrate — total 173 KB gzipped, 4.5% of the deploy (rev B: 249 KB, 6.3%). The lodash story closed at rev B (−84% on the wire chunk); this revision closes two more: the drawing's own sheet 10 showed two complete lit majors riding in every app, and PR #618 scoped an override so the <code>@api-viewer</code>/<code>lit-dialog</code> stack shares the one lit 3.3.3 — with a bonus the drawing didn't predict: identical lit chunks now hash identically <em>across</em> apps, so 41 KB of mobx's download is chunks vanilla already shipped, and the CDN ships them once.</p>
<p><strong>The panel that waited its turn.</strong> The api-viewer docs panel — marked, dompurify, three <code>@api-viewer</code> packages — only renders behind a feature flag, but rev B's apps carried it in the eager main chunk anyway. It now arrives as a lazy <code>api-docs</code> chunk (27 KB gz), and every app's main chunk drops 34 → 7 KB gz: the hash app's whole district falls from 41 to 14 KB. Same bytes on the CDN, different bytes on the critical path.</p>
<p><strong>The ghost district was scaffolding dust.</strong> Rev A reported twelve orphan files, 138 KB of dead weight in every deploy — but that survey read an accumulated local <code>dist/</code>, where parallel app builds pile up stale hashes. A clean-checkout rebuild, the shape the CDN actually deploys, ships exactly one unreferenced file: a 1.7 KB custom-elements manifest. The tiny hatched slab stays as the correction, and as a caution about the instrument: survey the dist you actually ship.</p>
<p><strong>One example outweighs the router.</strong> The hellogalaxy demo's <code>model-viewer</code> chunk is 275 KB gzipped on its own — heavier than all three sample apps combined, delivered so one tutorial page can spin a galaxy.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'site district — height = gzipped bytes'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'a routed sample app'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="skf fnone"/><rect x="8" y="3" width="18" height="12" fill="url(#s9-hd)"/>', 'orphan — shipped, unreachable'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'group (role in the deploy)'),
  ].join('\n'),
};

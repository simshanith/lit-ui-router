import { defs } from './chrome.mjs';
import { txt, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's9';
const OX = 480, OY = 205;

// docs/dist clean-checkout build, remeasured 2026-08-16 after the lodash-es swap
// (PR #604): 566 files, 14,526,419 raw bytes, 3,940,287 gzipped (level 9) — the
// wire proxy. Reachability BFS marks orphans; a clean tree has exactly one.
// [name, files, gzBytes, ghost?]
const DATA = [
  ['demo corpora', 15, 899000],
  ['inter fonts', 16, 866700],
  ['html pages', 130, 814176],
  ['examples', 9, 451396],
  ['page chunks', 248, 269214],
  ['vp framework', 10, 168660],
  ['images', 98, 127073],
  ['app: mobx', 9, 105723],
  ['app: vanilla', 14, 101099],
  ['static data', 7, 51884],
  ['app: hash', 4, 41970],
  ['site css', 5, 41686],
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
  'app: hash': [550, 390],
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
  'vp framework': 'localSearchIndex 60 KB',
  'orphans': 'custom-elements manifest 1.7 KB',
  'images': 'lit-ui-router.png 67 KB',
  'app: vanilla': 'directive 35 KB · isEqual 4 KB',
  'app: mobx': 'main 34 KB',
  'static data': 'messages.json 47 KB',
  'app: hash': 'main 34 KB',
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

const svg = `<svg viewBox="0 0 1160 ${SY + 90 + half * 17}" role="img" aria-label="The production docs-site deploy drawn as an isometric city of thirteen districts: footprint area from file counts, height from gzipped bytes on the wire. The tallest towers are the demo text corpora and the Inter font files, not code; the three routed sample apps are small accent buildings; a tiny hatched ghost block marks the single unreferenced file a clean deploy ships. A structure schedule lists every district with exact counts.">
${defs(P)}

${groupOutline(20, 0, 230, 200, 'demo payload — corpora · media · data', 40, 150)}
${groupOutline(320, 0, 700, 260, 'the documentation site', 866, 200)}
${groupOutline(540, 290, 720, 450, 'the routed apps', 540, 700, 'end')}

${bodies}

${txt(150, 60, 'A Tale of Two Cities alone: 294 KB —', 'lbla')}
${txt(150, 72, 'the tallest tenant on the skyline is Dickens', 'lbla')}
${txt(890, 96, '867 KB of Inter — the lettering', 'lbla')}
${txt(890, 108, 'outweighs every script on the site', 'lbla')}
${txt(1120, 715, 'all three apps: 249 KB —', 'lbla', 'end')}
${txt(1120, 727, '6.3% of their own docs site', 'lbla', 'end')}
<line x1="937" y1="711" x2="878" y2="689" class="skf"/>
${txt(110, 570, 'rev A drew 138 KB of orphans here —', 'lbla')}
${txt(110, 582, 'a clean build ships one file, 1.7 KB', 'lbla')}

${txt(1120, 26, 'SCALE — footprint area ∝ files · 1 px of height ≈ 4.2 KB gzipped', 'lbls', 'end')}

${schedule}
</svg>`;

export const sheet9 = {
  num: 9, id: 'shipped', rev: 'B',
  title: 'THE SHIPPED CITY',
  sub: 'ALTITUDE 2¾ — what the browser downloads · lit-ui-router.dev, one deploy · REV B: remeasured after the lodash-es swap · 2026-08-16',
  scale: 'ONE DEPLOY',
  form: 'SHIPPED CITY',
  svg,
  caption: 'The production docs deploy surveyed on the wire: 566 files, 3.8 MB gzipped, drawn as thirteen districts — and the tallest towers are sample novels and font files, with the routed apps themselves standing as small accent buildings in their own city.',
  notes: `
<p><strong>Method:</strong> a fresh <code>docs/dist</code> build measured file by file; height is gzip level 9 of each file — the honest wire measure, since the CDN serves compressed. Footprint is file count, as on sheets 7 and 8. A reachability walk (every HTML shell and hashed chunk, following static asset references) sorts the assets into districts. This sheet extends the survey a step further: sheet 7 measured what we wrote, sheet 8 what npm delivered, this sheet what one deploy actually ships — 566 files, 14.5 MB on disk, 3.8 MB on the wire. Sheet 10 goes one level in again and opens the bundle itself. REV B is a clean-checkout remeasure after the lodash-es swap (PR #604) merged.</p>
<p><strong>The tallest building is Dickens.</strong> The demo corpora — novels, Beowulf, an RFC, pre-gzipped <code>.txt.gz</code> so compression can't help further — are the city's tallest district at 899 KB, with Inter's sixteen <code>woff2</code> faces one notch behind at 867 KB. Code doesn't crack the top two: on the wire, this documentation site is mostly sample text and typography.</p>
<p><strong>The product is a guest in its own city.</strong> The three routed sample apps — the thing the site exists to demonstrate — total 249 KB gzipped, 6.3% of the deploy. The lodash story closed between printings: rev A drew a 25 KB lodash chunk inside the vanilla app, sheet 8's giant tree-shaken to what four imports cost the wire; the swap to lodash-es collapsed it to a 4 KB <code>isEqual</code> chunk — −84% — and the whole district dropped 15%.</p>
<p><strong>The ghost district was scaffolding dust.</strong> Rev A reported twelve orphan files, 138 KB of dead weight in every deploy — but that survey read an accumulated local <code>dist/</code>, where parallel app builds pile up stale hashes. A clean-checkout rebuild, the shape the CDN actually deploys, ships exactly one unreferenced file: a 1.7 KB custom-elements manifest. The tiny hatched slab stays as the correction, and as a caution about the instrument: survey the dist you actually ship.</p>
<p><strong>One example outweighs the router.</strong> The hellogalaxy demo's <code>model-viewer</code> chunk is 275 KB gzipped on its own — heavier than all three sample apps combined, delivered so one tutorial page can spin a galaxy.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'site district — height = gzipped bytes'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'a routed sample app'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="skf fnone"/><rect x="8" y="3" width="18" height="12" fill="url(#s9-hd)"/>', 'orphan — shipped, unreachable'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'group (role in the deploy)'),
  ].join('\n'),
};

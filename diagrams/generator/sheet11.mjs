import { defs } from './chrome.mjs';
import { txt, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's11';
const OX = 480, OY = 195;

// Per-entry bundle probe, 2026-08-16: every exported entry of every publishable
// package bundled alone with rolldown — minified, declared deps + peers external —
// the price a consumer pays at that door, and exactly the <pkg>-<label>-esm series
// the repo uploads to codecov. Footprint ∝ √min bytes, height = gz bytes.
// [package, door, minBytes, gzBytes]
const DATA = [
  ['lit-ui-router', '.', 15604, 4953],
  ['lit-ui-router', './pure', 15204, 4864],
  ['lit-ui-router', './register', 6603, 2288],
  ['lit-ui-router', './ui-router.register', 2336, 1070],
  ['lit-ui-router', './ui-view.register', 6400, 2268],
  ['lit-ui-router-mobx', '.', 1624, 650],
  ['ui-router-navigation-location-plugin', '.', 1309, 670],
  ['ui-router-server', '.', 12123, 4965],
  ['ui-router-server', './redirects', 8781, 3597],
  ['ui-router-server', './url-matcher', 6645, 2838],
  ['ui-router-server', './hono', 2928, 1536],
  ['ui-router-server', './fetch', 2858, 1510],
  ['ui-router-server', './vite', 2844, 1519],
  ['ui-router-server', './connect', 2717, 1464],
  ['ui-router-server', './simulate', 431, 283],
];

const SIDE = (m) => Math.max(12, 0.35 * Math.sqrt(m));
const HT = (gz) => Math.max(6, gz / 40);

// Manual plan: one quarter per package, tall doors in back. [pkg + door → x, y]
const PLAN = {
  'lit-ui-router|.': [30, 15],
  'lit-ui-router|./pure': [95, 45],
  'lit-ui-router|./register': [185, 60],
  'lit-ui-router|./ui-router.register': [252, 92],
  'lit-ui-router|./ui-view.register': [180, 140],
  'lit-ui-router-mobx|.': [155, 310],
  'ui-router-navigation-location-plugin|.': [390, 310],
  'ui-router-server|.': [425, 15],
  'ui-router-server|./redirects': [495, 40],
  'ui-router-server|./url-matcher': [565, 70],
  'ui-router-server|./hono': [640, 95],
  'ui-router-server|./fetch': [445, 120],
  'ui-router-server|./vite': [510, 140],
  'ui-router-server|./connect': [575, 160],
  'ui-router-server|./simulate': [645, 180],
};

const all = DATA.map((it, i) => {
  const [pkg, door, m, gz] = it;
  const [x, y] = PLAN[`${pkg}|${door}`];
  return { it, pkg, door, m, gz, x, y, s: SIDE(m), h: HT(gz), n: i + 1 };
});

const bodies = all
  .slice()
  .sort((a, b) => (a.x + a.y + a.s) - (b.x + b.y + b.s))
  .map(({ pkg, x, y, s, h, n }) => {
    const accent = pkg === 'lit-ui-router';
    const blk = isoBlock(P, OX, OY, x, y, s, s, h, { capCls: accent ? 'fa' : 'fp' });
    const [bx, by] = isoPt(OX, OY, x + s / 2, y, h);
    return `${blk}
<circle cx="${bx.toFixed(1)}" cy="${(by - 14).toFixed(1)}" r="9" class="${accent ? 'ska fp' : 'sk fp'}"/>
${txt(bx.toFixed(1), (by - 10.6).toFixed(1), String(n), 'lbls', 'middle')}`;
  })
  .join('\n');

function quarter(x1, y1, x2, y2, label, lx, ly, anchor = 'start') {
  const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
    .map(([px, py]) => isoPt(OX, OY, px, py).map((v) => v.toFixed(1)).join(','))
    .join(' ');
  return `<polygon points="${pts}" class="skf fnone" stroke-dasharray="5 4"/>
${txt(lx, ly, label, 'lblf', anchor)}`;
}

const fmt = (v) => v.toLocaleString('en-US');
const NOTE = {
  'lit-ui-router|.': 'the flagship door',
  'lit-ui-router|./pure': '89 gz cheaper — registration off',
  'lit-ui-router|./register': 'the umbrella — shared core once',
  'lit-ui-router|./ui-router.register': 'one element',
  'lit-ui-router|./ui-view.register': 'one element',
  'lit-ui-router-mobx|.': 'the whole mobx layer',
  'ui-router-navigation-location-plugin|.': 'the whole plugin',
  'ui-router-server|.': '12 bytes from the flagship',
  'ui-router-server|./redirects': 'redirect machinery',
  'ui-router-server|./url-matcher': 'standalone matcher',
  'ui-router-server|./hono': 'adapter',
  'ui-router-server|./fetch': 'adapter',
  'ui-router-server|./vite': 'adapter',
  'ui-router-server|./connect': 'adapter',
  'ui-router-server|./simulate': 'test double — 283 b',
};
const half = Math.ceil(all.length / 2);
const SY = 740;
const schedule = `<g>
<rect x="40" y="${SY}" width="1080" height="${52 + half * 17}" class="sk fp"/>
${txt(56, SY + 22, 'STRUCTURE SCHEDULE — minified bytes → gzipped bytes, deps external · note', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1120" y2="${SY + 32}" class="skf"/>
${all.slice(0, half).map((r, i) => txt(56, SY + 52 + i * 17, `${r.n} ${r.pkg} ${r.door} — ${fmt(r.m)} → ${fmt(r.gz)} gz · ${NOTE[`${r.pkg}|${r.door}`]}`, 'lbls')).join('\n')}
${all.slice(half).map((r, i) => txt(590, SY + 52 + i * 17, `${r.n} ${r.pkg} ${r.door} — ${fmt(r.m)} → ${fmt(r.gz)} gz · ${NOTE[`${r.pkg}|${r.door}`]}`, 'lbls')).join('\n')}
</g>`;

const svg = `<svg viewBox="0 0 1160 ${SY + 90 + half * 17}" role="img" aria-label="Every exported entry of the four publishable packages drawn as an isometric city split into four package quarters: fifteen door-buildings, footprint from minified bytes, height from gzipped bytes with dependencies external. The lit-ui-router quarter shows twin flagship towers for the bare and pure entries plus three register doors; the ui-router-server quarter is an eight-door storefront whose index tower prices within 12 bytes of lit-ui-router's; the mobx and navigation-location plugins stand alone as small one-door quarters. A structure schedule lists every entry with exact byte counts.">
${defs(P)}

${quarter(20, 0, 330, 200, 'lit-ui-router — five doors', 36, 426)}
${quarter(410, 0, 730, 210, 'ui-router-server — eight doors', 1150, 430, 'end')}
${quarter(120, 290, 260, 380, 'lit-ui-router-mobx', 255, 545)}
${quarter(350, 290, 500, 380, 'navigation-location-plugin', 590, 660)}

${bodies}

${txt(150, 96, '«.» and «./pure»: 89 bytes gz apart —', 'lbla')}
${txt(150, 108, 'the price of registration', 'lbla')}
<line x1="368" y1="102" x2="452" y2="128" class="skf"/>
${txt(1120, 108, 'the two flagship doors price within', 'lbla', 'end')}
${txt(1120, 120, '12 bytes of each other: 4,953 · 4,965', 'lbla', 'end')}
${txt(40, 340, 'the one-element doors sum to 3,338 gz —', 'lbls')}
${txt(40, 352, '«./register» ships the shared core once, at 2,288', 'lbls')}
${txt(1120, 695, 'four adapters within 72 bytes of one', 'lbla', 'end')}
${txt(1120, 707, 'another — thin skins on one server core', 'lbla', 'end')}
${txt(100, 665, 'the one-door packages: 650 gz · 670 gz — plugins price like footnotes', 'lbls')}

${txt(1120, 26, 'SCALE — footprint area ∝ minified bytes · 1 px of height ≈ 40 gz bytes', 'lbls', 'end')}

${schedule}
</svg>`;

export const sheet11 = {
  num: 11, id: 'entries',
  title: 'THE ENTRY QUARTERS',
  sub: 'ALTITUDE 2⅞ — the same wire, cut by published package · every exported entry priced alone · counted 2026-08-16',
  scale: 'FOUR PACKAGES',
  form: 'ENTRY QUARTERS',
  svg,
  caption: 'The split view to sheet 10’s unified city: every exported entry of every publishable package bundled alone and priced — four package quarters, fifteen doors, the codecov bundle-analysis series drawn as skylines.',
  notes: `
<p><strong>Method:</strong> the same probe as sheet 10's doors strip, run to completion: every exported entry of the four publishable packages bundled alone with rolldown — minified, declared dependencies and peers external — which is the price a consumer's bundler pays at that door, and byte-for-byte the <code>&lt;pkg&gt;-&lt;label&gt;-esm</code> series CI uploads to codecov. Footprint is minified bytes, height gzipped. Sheet 10 is the unified view — one real app's bundle with all of these mixed by the bundler; this sheet cuts the same machinery by published package and entry point. The quarters don't sum and shouldn't: doors overlap (<code>./pure</code> is <code>.</code> minus registration), which is exactly what the split view exists to show.</p>
<p><strong>The twin towers are one building with two doors.</strong> <code>.</code> and <code>./pure</code> differ by 89 gzipped bytes — the whole cost of custom-element registration. The register economics run the other way: the two one-element doors sum to 3,338 gz while the umbrella <code>./register</code> is 2,288, because each element door carries the shared element core with it. Take the umbrella or one element door; taking two per-element doors ships the core twice.</p>
<p><strong>The server is a storefront, not a tower.</strong> Eight doors: an index that prices within 12 bytes of lit-ui-router's flagship (4,965 vs 4,953 — coincidence, but a tidy one), redirect and matcher wings, and four framework adapters — hono, fetch, vite, connect — packed within 72 bytes of one another: thin skins over one core. <code>./simulate</code>, the test double, is 283 bytes.</p>
<p><strong>Plugins price like footnotes.</strong> The entire mobx reactivity layer enters at 650 gz and the navigation-location plugin at 670 — each cheaper than the gap between <code>./register</code> and its two element doors. The expensive thing in this family is never the adapter; it is the state machine they all defer to, and that machine (sheet 10's 28.8 KB <code>@uirouter/core</code>) is external here by design.</p>
<p><strong>Why both views exist.</strong> The split view is the seller's ledger — what each door costs at the threshold. The unified view is the buyer's receipt — what one app's bundler actually made of them (it paid 4,552 of the flagship's 4,953). Codecov tracks the ledger per commit; sheet 10 audits the receipt.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'exported entry — height = gz, deps external'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'a lit-ui-router door'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'quarter = one published package'),
  ].join('\n'),
};

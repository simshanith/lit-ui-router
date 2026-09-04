import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's11';
const OX = 480, OY = 195;

// ---- census: every byte on this sheet comes from diagrams/data/census-doors.json ----
// The plate is the checked-in snapshot census-doors.mjs writes: every exported
// entry of every publishable package bundled ALONE with rolldown — minified,
// declared deps + peers external — the price a consumer pays at that door, and
// exactly the <pkg>-<label>-esm series the repo uploads to codecov.
// Sheet 10's plate supplies the one buyer's-receipt figure quoted in the notes.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-doors.json', import.meta.url), 'utf8'));
const BUNDLE = JSON.parse(readFileSync(new URL('../data/census-bundle.json', import.meta.url), 'utf8'));
const door = (pkg, name) => {
  const d = PLATE.rows.find((x) => x.pkg === pkg && x.door === name);
  if (!d) throw new Error(`census-doors.json: no ${pkg} door ${name}`);
  return d;
};
const group = (name) => {
  const g = BUNDLE.rows.find((x) => x.group === name);
  if (!g) throw new Error(`census-bundle.json: no row for group ${name}`);
  return g;
};
const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.commitDate.slice(0, 10)})`;
const DOOR_N = PLATE.rows.length;
const PKG_N = new Set(PLATE.rows.map((r) => r.pkg)).size;

// Footprint ∝ √min bytes, height = gz bytes.
const SIDE = (m) => Math.max(12, 0.35 * Math.sqrt(m));
const HT = (gz) => Math.max(6, gz / 40);

// Manual drawing order — quarter by quarter, tall doors in back; the lint plugin
// graduated after rev B, so it takes 16 and leaves rev B's numbering intact.
const ORDER = [
  ['lit-ui-router', '.'],
  ['lit-ui-router', './pure'],
  ['lit-ui-router', './register'],
  ['lit-ui-router', './ui-router.register'],
  ['lit-ui-router', './ui-view.register'],
  ['lit-ui-router-mobx', '.'],
  ['ui-router-navigation-location-plugin', '.'],
  ['ui-router-server', '.'],
  ['ui-router-server', './redirects'],
  ['ui-router-server', './matcher'],
  ['ui-router-server', './hono'],
  ['ui-router-server', './fetch'],
  ['ui-router-server', './vite'],
  ['ui-router-server', './connect'],
  ['ui-router-server', './simulate'],
  ['eslint-plugin-lit-ui-router', '.'],
];
// A door the plate carries but the drawing does not place is a build error.
if (ORDER.length !== DOOR_N) {
  throw new Error(`census-doors.json carries ${DOOR_N} doors; sheet 11 places ${ORDER.length}`);
}

// Manual plan: one quarter per package, tall doors in back. [pkg + door → x, y]
const PLAN = {
  'lit-ui-router|.': [30, 15],
  'lit-ui-router|./pure': [95, 45],
  'lit-ui-router|./register': [185, 60],
  'lit-ui-router|./ui-router.register': [252, 92],
  'lit-ui-router|./ui-view.register': [180, 140],
  'lit-ui-router-mobx|.': [155, 310],
  'ui-router-navigation-location-plugin|.': [460, 370],
  'ui-router-server|.': [425, 15],
  'ui-router-server|./redirects': [495, 40],
  'ui-router-server|./matcher': [565, 70],
  'ui-router-server|./hono': [640, 95],
  'ui-router-server|./fetch': [445, 120],
  'ui-router-server|./vite': [510, 140],
  'ui-router-server|./connect': [575, 160],
  'ui-router-server|./simulate': [645, 180],
  'eslint-plugin-lit-ui-router|.': [330, 285],
};

const all = ORDER.map(([pkg, name], i) => {
  const d = door(pkg, name);
  const [x, y] = PLAN[`${pkg}|${name}`];
  return { pkg, door: name, m: d.min, gz: d.gz, x, y, s: SIDE(d.min), h: HT(d.gz), n: i + 1 };
});
const at = (pkg, name) => all.find((r) => r.pkg === pkg && r.door === name);

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

// ---- the readings the callouts and prose quote, all derived from the plate ----
const FLAG = at('lit-ui-router', '.');
const PURE = at('lit-ui-router', './pure');
const UMB = at('lit-ui-router', './register');
const EL1 = at('lit-ui-router', './ui-router.register');
const EL2 = at('lit-ui-router', './ui-view.register');
const SRV = at('ui-router-server', '.');
const SIM = at('ui-router-server', './simulate');
const MOBX = at('lit-ui-router-mobx', '.');
const NAV = at('ui-router-navigation-location-plugin', '.');
const LINT = at('eslint-plugin-lit-ui-router', '.');
const REG_COST = FLAG.gz - PURE.gz;
const LINT_SHARE = Math.round((LINT.gz / FLAG.gz) * 100);
const ELEM_SUM = EL1.gz + EL2.gz;
const SRV_GAP = FLAG.gz - SRV.gz;
const ADAPTERS = ['./hono', './fetch', './vite', './connect'].map((d) => at('ui-router-server', d));
const ADAPTER_SPREAD = Math.max(...ADAPTERS.map((a) => a.gz)) - Math.min(...ADAPTERS.map((a) => a.gz));
const RECEIPT = group('lit-ui-router').estGz;

const NOTE = {
  'lit-ui-router|.': 'the flagship door',
  'lit-ui-router|./pure': `${REG_COST} gz cheaper — registration off`,
  'lit-ui-router|./register': 'the umbrella — shared core once',
  'lit-ui-router|./ui-router.register': 'one element',
  'lit-ui-router|./ui-view.register': 'one element',
  'lit-ui-router-mobx|.': 'the whole mobx layer',
  'ui-router-navigation-location-plugin|.': 'the whole plugin',
  'ui-router-server|.': `${SRV_GAP} gz shy of the flagship`,
  'ui-router-server|./redirects': 'redirect machinery',
  'ui-router-server|./matcher': 'standalone matcher',
  'ui-router-server|./hono': 'adapter',
  'ui-router-server|./fetch': 'adapter',
  'ui-router-server|./vite': 'adapter',
  'ui-router-server|./connect': 'adapter',
  'ui-router-server|./simulate': `test double — ${SIM.gz} b`,
  'eslint-plugin-lit-ui-router|.': 'the lint plugin — editor-side, never shipped',
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

const svg = `<svg viewBox="0 0 1160 ${SY + 90 + half * 17}" role="img" aria-label="Every exported entry of the five publishable packages drawn as an isometric city split into five package quarters: ${DOOR_N} door-buildings, footprint from minified bytes, height from gzipped bytes with dependencies external. The lit-ui-router quarter shows twin flagship towers for the bare and pure entries plus three register doors; the ui-router-server quarter is an eight-door storefront whose index tower prices ${SRV_GAP} gzipped bytes under lit-ui-router's; the mobx and navigation-location plugins stand alone as small one-door quarters; and a new one-door quarter in the lower middle holds eslint-plugin-lit-ui-router, the fifth published package, whose single door is the only one on the sheet no browser ever loads. A structure schedule lists every entry with exact byte counts.">
${defs(P)}

${quarter(20, 0, 330, 200, 'lit-ui-router — five doors', 36, 426)}
${quarter(410, 0, 730, 210, 'ui-router-server — eight doors', 1150, 430, 'end')}
${quarter(120, 290, 260, 380, 'lit-ui-router-mobx', 240, 478, 'end')}
${quarter(290, 240, 400, 320, 'eslint-plugin-lit-ui-router', 450, 528, 'end')}
${quarter(420, 350, 570, 440, 'navigation-location-plugin', 700, 672)}

${bodies}

${txt(150, 96, `«.» and «./pure»: ${REG_COST} bytes gz apart —`, 'lbla')}
${txt(150, 108, 'the price of registration', 'lbla')}
<line x1="368" y1="102" x2="452" y2="128" class="skf"/>
${txt(1120, 108, `the two flagship doors: ${fmt(FLAG.gz)} · ${fmt(SRV.gz)} —`, 'lbla', 'end')}
${txt(1120, 120, `the client door leads the server by ${fmt(SRV_GAP)}`, 'lbla', 'end')}
${txt(40, 340, `the one-element doors sum to ${fmt(ELEM_SUM)} gz —`, 'lbls')}
${txt(40, 352, `«./register» ships the shared core once, at ${fmt(UMB.gz)}`, 'lbls')}
${txt(250, 560, `the fifth package's one door: ${fmt(LINT.gz)} gz —`, 'lbls')}
${txt(250, 572, 'the only door here no browser ever opens', 'lbls')}
${txt(1120, 695, `four adapters within ${ADAPTER_SPREAD} bytes of one`, 'lbla', 'end')}
${txt(1120, 707, 'another — thin skins on one server core', 'lbla', 'end')}
${txt(100, 665, `the two runtime plugins: ${fmt(MOBX.gz)} gz · ${fmt(NAV.gz)} gz — they price like footnotes`, 'lbls')}

${txt(1120, 26, 'SCALE — footprint area ∝ minified bytes · 1 px of height ≈ 40 gz bytes', 'lbls', 'end')}
${txt(1120, 40, `PROBE — ${PLATE.used}`, 'lblf', 'end')}

${schedule}
</svg>`;

export const sheet11 = {
  num: 11, id: 'entries', rev: 'D',
  title: 'THE ENTRY QUARTERS',
  sub: `ALTITUDE 2⅞ — the same wire, cut by published package · every exported entry priced alone · ${DOOR_N} doors, ${PKG_N} packages · REV C: every byte now read from diagrams/data/census-doors.json · REV D: whole-cabinet re-probe — 15 of ${DOOR_N} doors byte-identical, the lint plugin's alone up 1,917 → ${fmt(LINT.gz)} gz on #689's three new rules — ${BASIS}`,
  scale: 'FIVE PACKAGES',
  form: 'ENTRY QUARTERS',
  svg,
  caption: `The split view to sheet 10’s unified city: every exported entry of every publishable package bundled alone and priced — ${PKG_N} package quarters, ${DOOR_N} doors, the codecov bundle-analysis series drawn as skylines.`,
  notes: `
<p><strong>Method:</strong> the same probe as sheet 10's doors strip, run to completion: every exported entry of the ${PKG_N} publishable packages bundled alone with rolldown — minified, declared dependencies and peers external — which is the price a consumer's bundler pays at that door, and byte-for-byte the <code>&lt;pkg&gt;-&lt;label&gt;-esm</code> series CI uploads to codecov. Footprint is minified bytes, height gzipped. Every number is read at build time from the checked-in plate <code>diagrams/data/census-doors.json</code> — ${BASIS}, probed as <code>${PLATE.used}</code> — and a door the plate carries that the drawing does not place is a build error, not a stale constant. Sheet 10 is the unified view — one real app's bundle with all of these mixed by the bundler; this sheet cuts the same machinery by published package and entry point. The quarters don't sum and shouldn't: doors overlap (<code>./pure</code> is <code>.</code> minus registration), which is exactly what the split view exists to show.</p>
<p><strong>The twin towers are one building with two doors.</strong> <code>.</code> and <code>./pure</code> differ by ${REG_COST} gzipped bytes — the whole cost of custom-element registration. The register economics run the other way: the two one-element doors sum to ${fmt(ELEM_SUM)} gz while the umbrella <code>./register</code> is ${fmt(UMB.gz)}, because each element door carries the shared element core with it. Take the umbrella or one element door; taking two per-element doors ships the core twice.</p>
<p><strong>The server is a storefront, not a tower.</strong> Eight doors: an index at ${fmt(SRV.gz)} gz — rev A caught it within 12 bytes of lit-ui-router's flagship, a coincidence #590 promptly broke and the summer has widened to ${fmt(SRV_GAP)} — redirect and matcher wings, and four framework adapters — hono, fetch, vite, connect — packed within ${ADAPTER_SPREAD} bytes of one another: thin skins over one core. <code>./simulate</code>, the test double, is ${SIM.gz} bytes. All eight of these doors reprobe byte-identical against rev B.</p>
<p><strong>Plugins price like footnotes.</strong> The entire mobx reactivity layer enters at ${fmt(MOBX.gz)} gz and the navigation-location plugin at ${fmt(NAV.gz)} — each cheaper than the gap between <code>./register</code> and its two element doors. The expensive thing in this family is never the adapter; it is the state machine they all defer to, and that machine (sheet 10's <code>@uirouter/core</code>) is external here by design.</p>
<p><strong>The sixteenth door is not a door a browser opens.</strong> <code>eslint-plugin-lit-ui-router</code> (#676) is the family's fifth published package and the first non-runtime one, so its quarter is drawn but its number means something different: ${fmt(LINT.m)} minified, ${fmt(LINT.gz)} gz is what a <em>lint host</em> loads, once, at author time. It is priced here because the probe prices every published entry without exception — the honest thing for a ledger — and it is worth knowing that the plugin costs ${LINT_SHARE}% of the flagship to a tool that already has Node's whole module graph resident. Nothing in it ever reaches a bundle: it peers ESLint and oxlint, never <code>@uirouter/core</code> (sheet 2 leaves it off the plate for the same reason).</p>
<p><strong>Why both views exist.</strong> The split view is the seller's ledger — what each door costs at the threshold. The unified view is the buyer's receipt — what one app's bundler actually made of them (it paid ${fmt(RECEIPT)} of the flagship's ${fmt(FLAG.gz)}). Codecov tracks the ledger per commit; sheet 10 audits the receipt.</p>
<p><strong>Rev C — the numbers by import, and a fifth quarter.</strong> The sheet no longer carries a hand-pasted probe: it reads the plate, keyed by package and door, and throws on a miss. Reprobing at ${PLATE.ref} @ ${PLATE.sha} moves two things. The <em>city</em>: sixteen doors rather than fifteen, with the lint plugin taking a new one-door quarter in the lower middle — the navigation-location quarter slid down and right to give it air, so the three one-door quarters now read as a row along the bottom. The <em>client</em>: only <code>lit-ui-router</code> moved. Four of its doors — the flagship, <code>./pure</code>, <code>./register</code> and <code>./ui-view.register</code> — each grew about 5% as main advanced past rev B's ref, while the other eleven doors, <code>./ui-router.register</code> plus both runtime plugins plus all eight server doors, reprobe byte-identical. The registration premium held its shape through that growth: ${REG_COST} gz, against rev B's 85. Rev B's own findings stand — #590's two flagship jumps, and the door name corrected from <code>./url-matcher</code> to <code>./matcher</code>.</p>
<p><strong>Rev D — one door moved, and it is the one no browser opens.</strong> The whole plate cabinet was re-probed at ${PLATE.ref} @ ${PLATE.sha} in one pass. Fifteen of the ${DOOR_N} doors come back byte-identical — every <code>lit-ui-router</code> door, both runtime plugins and all eight server doors price exactly as they did at rev C, so the registration premium, the umbrella economics and the adapter spread are unchanged figures, not re-rounded ones. The single mover is <code>eslint-plugin-lit-ui-router</code>, which #689 gave three more rules — <code>sref-assign-href</code>, <code>sref-active-aria-current</code> and <code>directive-position</code> — taking its one door from 4,559 / 1,917 to ${fmt(LINT.m)} / ${fmt(LINT.gz)} gz, two thirds heavier in a single release. That moves the comparison rev C drew with it: the plugin was about a third of the flagship's weight and is now ${LINT_SHARE}% of it. Its quarter is drawn to the same scale as the rest, so the sixteenth tower simply grew.</p>`,
  key: [
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fp"/>', 'exported entry — height = gz, deps external'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sk fa"/>', 'a lit-ui-router door'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', `quarter = one published package · ${DOOR_N} doors, ${PKG_N} packages`),
  ].join('\n'),
};

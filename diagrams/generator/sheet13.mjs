import { defs } from './chrome.mjs';
import { txt, keyRow } from './helpers.mjs';

const P = 's13';

// ---- census: file age × churn from git history, this repo at HEAD 2026-08-17 ----
// Universe = sheet 7's: authored .ts/.tsx/.js/.jsx/.mjs under each member's source
// dir, excluding *.d.ts, *.test-d.ts, fixtures/, dist/, node_modules/; src and
// spec split by the same rule.  Per file: first-commit date, last-touch date,
// touch count — from ONE `git log -M --name-status` pass over all 483 commits,
// walked newest→oldest with rename chains followed backwards (equivalent to
// --follow; spot-verified against it).  Merge commits list no files under the
// default log, so touches = non-merge commits — the standard convention.
// Generator: census-weather.mjs (this directory).
//
// The history is not continuous.  Source files were born or touched in only 4 of
// the repo's 14 calendar months; commits exist in 5 (2025-07: 42 · 2026-01: 103 ·
// 2026-06: 3 · 2026-07: 224 · 2026-08: 111).  So the age bands are not round
// numbers — they are the three construction campaigns the distribution actually
// shows, separated by empty months:
//   SEASON I   THE PORT      born 2025-07       26 files
//   SEASON II  WINTER WORKS  born 2026-01       18 files
//   SEASON III THE SUMMER    born 2026-07-04 →  220 files (83% of the city)
// Churn tiers, from the per-block touches-per-file distribution (clean gap
// between 4.6 and 6.0; per-file median is 2): HOT ≥ 6 · COLD < 2.
// Sealed = idle > 180 days (the idle histogram is empty from 60 to 180 days;
// 6 files sit beyond the gap, all Season II).

// ---- geometry: sheet 7 rev B's plan footprints, flattened -----------------------
// Same placements, same side = 1.6·√sloc rule (sloc as counted for sheet 7 rev B,
// 2026-08-16 — reused as pure geometry so the two sheets reconcile by eye).
// Weathering counts below are 2026-08-17 at HEAD: 264 files vs sheet 7's 258 —
// six spec files were born in between, and the schedule says which members grew.
const KS = 1.6, MIN = 12, K = 1.6, OX = 46, OY = 110;
const S = (sloc) => Math.max(MIN, KS * Math.sqrt(sloc));
const AG = 10;
const X = (x) => OX + K * x, Y = (y) => OY + K * y;

// [n, name, dist, x, y, srcSloc, specSloc,
//  src:{n, seasons[I,II,III], t}, spec or null,
//  born, medIdle, hot 'file×n', sealed]
const D = [
  [1, 'lit-ui-router', 'pkg', 0, 20, 1189, 2879, [12, [7, 0, 5], 85], [15, [1, 5, 9], 62], '2025-07-21', 30, 'ui-sref.ts×15', 0],
  [2, 'ui-router-server', 'pkg', 200, 20, 1141, 2174, [8, [0, 0, 8], 23], [12, [0, 0, 12], 22], '2026-07-14', 30, 'index.ts×4', 0],
  [3, 'lit-ui-router-mobx', 'pkg', 170, 130, 133, 380, [4, [0, 0, 4], 12], [4, [0, 0, 4], 10], '2026-07-04', 8, 'reaction-controller.ts×4', 0],
  [4, 'navigation-location-plugin', 'pkg', 260, 130, 105, 410, [1, [0, 1, 0], 10], [7, [0, 1, 6], 10], '2026-01-11', 8, 'index.ts×10', 0],
  [5, 'sample-app-shared', 'app', 570, 10, 2103, 309, [36, [8, 0, 28], 167], [3, [0, 0, 3], 3], '2025-07-21', 29, 'router.config.ts×14', 0],
  [6, 'sample-app-lit-vanilla', 'app', 720, 10, 401, 0, [8, [6, 0, 2], 48], null, '2025-07-21', 38, 'Compose.ts×10', 0],
  [7, 'sample-app-lit-mobx', 'app', 720, 90, 440, 0, [8, [0, 0, 8], 32], null, '2026-07-04', 38, 'Compose.ts×6', 0],
  [8, 'sample-app-routes', 'app', 700, 150, 51, 185, [2, [0, 0, 2], 3], [1, [0, 0, 1], 2], '2026-07-14', 33, 'routes.ts×2', 0],
  [9, 'sample-app-lit-e2e', 'app', 580, 150, 57, 348, [1, [1, 0, 0], 7], [6, [1, 0, 5], 23], '2025-07-21', 1, 'sample_app.cy.js×8', 0],
  [10, 'docs', 'site', 660, 340, 677, 181, [8, [2, 1, 5], 57], [1, [0, 0, 1], 1], '2025-07-23', 29, 'config.ts×24', 0],
  [11, 'examples', 'site', 660, 430, 1117, 0, [7, [0, 6, 1], 32], null, '2026-01-01', 41, 'hellosolarsystem/main.ts×11', 3],
  [12, '@tools/release', 'tool', 20, 430, 1871, 1896, [44, [0, 0, 44], 83], [19, [0, 0, 19], 32], '2026-07-06', 29, 'check-pack.ts×9', 0],
  [13, '@tools/typedoc-plugin', 'tool', 230, 430, 755, 0, [5, [0, 4, 1], 15], null, '2026-01-09', 220, 'index.ts×8', 3],
  [14, '@tools/dts-backtest', 'tool', 8, 350, 291, 0, [1, [0, 0, 1], 6], null, '2026-07-06', 3, 'run.ts×6', 0],
  [15, '@tools/build_and_test', 'tool', 330, 430, 427, 378, [7, [0, 0, 7], 16], [3, [0, 0, 3], 6], '2026-07-07', 23, 'upload-bundle-stats.ts×4', 0],
  [16, '@tools/shared', 'tool', 20, 550, 300, 276, [9, [0, 0, 9], 20], [5, [0, 0, 5], 6], '2026-07-06', 34, 'workspace.ts×9', 0],
  [17, '@tools/workers-builds', 'tool', 220, 550, 375, 266, [2, [0, 0, 2], 6], [1, [0, 0, 1], 5], '2026-07-11', 3, 'wb-triggers.test.ts×5', 0],
  [18, '@tools/bundle-probe', 'tool', 330, 550, 236, 0, [4, [0, 0, 4], 9], null, '2026-07-18', 8, 'upload-entry-bundles.ts×4', 0],
  [19, '@tools/compat-guards', 'tool', 130, 550, 189, 112, [7, [0, 0, 7], 9], [1, [0, 0, 1], 1], '2026-08-09', 8, 'catalog.ts×2', 0],
  [20, '@tools/oxc-emit', 'tool', 230, 350, 100, 0, [3, [0, 0, 3], 6], null, '2026-07-17', 16, 'emit-dts.ts×2', 0],
  [21, '@tools/release-config', 'tool', 280, 350, 39, 0, [1, [0, 0, 1], 2], null, '2026-07-31', 8, 'release-it.js×2', 0],
  [22, '@tools/lit-template-lint', 'tool', 325, 350, 21, 0, [1, [0, 0, 1], 1], null, '2026-08-11', 6, 'lint-templates.ts×1', 0],
  [23, '@tools/lit-test-env', 'tool', 85, 350, 24, 0, [1, [0, 0, 1], 1], null, '2026-08-09', 8, 'setup.ts×1', 0],
  [24, '@tools/vue-check', 'tool', 370, 350, 25, 0, [1, [0, 0, 1], 3], null, '2026-07-09', 34, 'bin.ts×3', 0],
  [25, '@tools/lcov-rebase', 'tool', 415, 350, 23, 30, [2, [0, 0, 2], 2], [1, [0, 0, 1], 1], '2026-07-29', 19, 'rebase-lcov.ts×1', 0],
  [26, '@tools/happy-dom', 'tool', 125, 350, 8, 26, [1, [0, 0, 1], 1], [1, [0, 0, 1], 1], '2026-07-19', 29, 'append.ts×1', 0],
  [27, '@tools/wintercg-globals', 'tool', 185, 350, 0, 0, null, null, '—', 0, '—', 0],
];
const fmt = (v) => v.toLocaleString('en-US');

// ---- weather rendering ----------------------------------------------------------
// Age lives in the FILL as strata (oldest at the bottom, like masonry courses):
//   Season I = dense ink hatch · II = accent hatch · III = plain paper.
// Churn intensity lives on the EDGE + a tick gauge under the block:
//   HOT (≥6 t/f) = red edge, tall red ticks · COLD (<2) = faint edge, short faint
//   ticks · else ink.  Hue and weight move together so both themes read.
const tier = (t, n) => (t / n >= 6 ? 'hot' : t / n < 2 ? 'cold' : 'mid');
const EDGE = { hot: 'skr', mid: 'sk', cold: 'skf' };
const SFILL = [`url(#${P}-w1)`, `url(#${P}-w2)`, null]; // I, II, III(plain)

function block(x, y, side, [n, seasons, t], { edgeOverride = null, gauge = true } = {}) {
  const tr = tier(t, n);
  const edge = edgeOverride ?? EDGE[tr];
  // strata bottom-up: I, II, III — shares by file count
  let cy = y + side;
  let strata = '';
  for (let s = 0; s < 3; s++) {
    const h = (seasons[s] / n) * side;
    if (!h) continue;
    cy -= h;
    if (SFILL[s]) strata += `<rect x="${x.toFixed(1)}" y="${cy.toFixed(1)}" width="${side.toFixed(1)}" height="${h.toFixed(1)}" fill="${SFILL[s]}"/>\n`;
    if (cy > y + 0.5) strata += `<line x1="${x.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(x + side).toFixed(1)}" y2="${cy.toFixed(1)}" class="skf"/>\n`;
  }
  // churn gauge: one tick per touch-per-file (rounded), under the bottom edge
  const ticks = Math.round(t / n);
  const th = tr === 'hot' ? 8 : tr === 'cold' ? 4 : 6;
  const tc = tr === 'hot' ? 'skr' : tr === 'cold' ? 'skf' : 'sks';
  const gy = y + side + 4;
  const g = gauge
    ? Array.from({ length: ticks }, (_, i) =>
        `<line x1="${(x + 1 + i * 5).toFixed(1)}" y1="${gy}" x2="${(x + 1 + i * 5).toFixed(1)}" y2="${(gy + th)}" class="${tc}"/>`).join('')
    : '';
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${side.toFixed(1)}" height="${side.toFixed(1)}" class="fp"/>
${strata}<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${side.toFixed(1)}" height="${side.toFixed(1)}" class="${edge} fnone"/>
${g}`;
}

const geom = new Map(D.map(([n, , , px, py, ssl, psl, src, spec]) => {
  const s = K * S(ssl), x = X(px), y = Y(py);
  const sa = spec ? K * S(psl) : 0;
  const ax = x + s + K * AG, ay = y + (s - sa) / 2;
  return [n, { x, y, s, sa, ax, ay, src, spec,
    x2: spec ? ax + sa : x + s, y1: spec ? Math.min(y, ay) : y, y2: spec ? Math.max(y + s, ay + sa) : y + s }];
}));
const g = (n) => geom.get(n);

const BADGE_LIFT = { 2: 12, 6: 14, 21: 14, 23: 14, 24: 14, 27: 14 };
const bodies = D.map((r) => {
  const [n, , , , , , , src, spec, , , , sealed] = r;
  const b = g(n);
  if (!src) { // wintercg-globals: nothing to date
    return `<rect x="${b.x}" y="${b.y}" width="${b.s.toFixed(1)}" height="${b.s.toFixed(1)}" class="sks fnone" stroke-dasharray="3 3"/>
<circle cx="${(b.x + b.s / 2).toFixed(1)}" cy="${(b.y - (BADGE_LIFT[n] ?? 12)).toFixed(1)}" r="9" class="sks fp"/>
${txt((b.x + b.s / 2).toFixed(1), (b.y - (BADGE_LIFT[n] ?? 12) + 3.4).toFixed(1), String(n), 'lbls', 'middle')}`;
  }
  const srcSvg = block(b.x, b.y, b.s, src);
  const specSvg = spec ? block(b.ax, b.ay, b.sa, spec, { edgeOverride: 'sks', gauge: false }) : '';
  const seal = sealed
    ? `<line x1="${b.x.toFixed(1)}" y1="${b.y.toFixed(1)}" x2="${(b.x + b.s).toFixed(1)}" y2="${(b.y + b.s).toFixed(1)}" class="sks" stroke-dasharray="4 3"/>
<line x1="${(b.x + b.s).toFixed(1)}" y1="${b.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${(b.y + b.s).toFixed(1)}" class="sks" stroke-dasharray="4 3"/>`
    : '';
  const lift = BADGE_LIFT[n] ?? 12;
  const tr = tier(src[2], src[0]);
  const badgeCls = tr === 'hot' ? 'skr fp' : 'sk fp';
  const numCls = tr === 'hot' ? 'lblr' : 'lbl';
  return `${srcSvg}${specSvg}${seal}
<circle cx="${(b.x + b.s / 2).toFixed(1)}" cy="${(b.y - lift).toFixed(1)}" r="9" class="${badgeCls}"/>
${txt((b.x + b.s / 2).toFixed(1), (b.y - lift + 3.4).toFixed(1), String(n), numCls, 'middle')}`;
}).join('\n');

// ---- districts (same membership as sheet 7) --------------------------------------
const DIST = [
  ['pkg', 20, 'packages/ — THE PRODUCT'],
  ['app', 20, 'apps/ — THE PROVING GROUND'],
  ['site', 18, 'docs/ + examples/ — THE SHOPFRONT'],
  ['tool', 22, 'tools/ — THE INSTRUMENT YARD'],
];
const districts = DIST.map(([d, pad]) => {
  const bs = D.filter((r) => r[2] === d).map((r) => g(r[0]));
  const x1 = Math.min(...bs.map((b) => b.x)) - pad, y1 = Math.min(...bs.map((b) => b.y1)) - pad - 14;
  const x2 = Math.max(...bs.map((b) => b.x2)) + pad, y2 = Math.max(...bs.map((b) => b.y2)) + pad + 8;
  return `<rect x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" width="${(x2 - x1).toFixed(1)}" height="${(y2 - y1).toFixed(1)}" class="skf fnone" stroke-dasharray="5 4"/>`;
}).join('\n');

// ---- the reading box, in the void sheet 7 spent on roads --------------------------
const RB = `
<rect x="620" y="188" width="330" height="332" class="sk fp"/>
${txt(638, 212, 'READING THE WEATHER', 'lbls')}
<line x1="620" y1="222" x2="950" y2="222" class="skf"/>
${txt(638, 244, 'AGE — masonry courses, oldest at the base', 'lbl')}
${[
  [`url(#${P}-w1)`, 'SEASON I · THE PORT · 2025-07 · 26f', 'sk'],
  [`url(#${P}-w2)`, 'SEASON II · WINTER · 2026-01 · 18f', 'sk'],
  [null, 'SEASON III · SUMMER · 07-04 on · 220f', 'sk'],
].map(([fill, label], i) => {
  const y = 256 + i * 24;
  return `<rect x="638" y="${y}" width="30" height="14" class="fp"/>${fill ? `<rect x="638" y="${y}" width="30" height="14" fill="${fill}"/>` : ''}<rect x="638" y="${y}" width="30" height="14" class="sk fnone"/>
${txt(680, y + 11, label, 'lbls')}`;
}).join('\n')}
${txt(638, 350, 'CHURN — ticks: one per touch per file', 'lbl')}
${[
  ['skr', 8, 7, 'HOT · ≥6/file · red edge · 6 blocks', 'lblr'],
  ['sks', 6, 3, 'MID · 2–5 · the working stock', 'lbls'],
  ['skf', 4, 1, 'COLD · <2 · touched once, left', 'lbls'],
].map(([cls, th, nn, label, lcls], i) => {
  const y = 362 + i * 24;
  return Array.from({ length: nn }, (_, j) => `<line x1="${640 + j * 5}" y1="${y}" x2="${640 + j * 5}" y2="${y + th}" class="${cls}"/>`).join('')
    + txt(680, y + 9, label, lcls);
}).join('\n')}
${txt(638, 448, 'THE GRADIENT THE MAP ARGUES', 'lbl')}
${txt(638, 466, 'mean touches per file, by birth season:', 'lbls')}
${txt(638, 482, 'I ×9.5 · II ×5.5 · III ×2.3', 'lbla')}
${txt(638, 500, 'the older the wall, the more it is chiselled', 'lbls')}`;

// ---- timeline: fourteen months, four of them alive --------------------------------
const MONTHS = ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
const COMMITS = { '2025-07': 42, '2026-01': 103, '2026-06': 3, '2026-07': 224, '2026-08': 111 };
const TOUCH = {
  pkg: { '2025-07': 20, '2026-01': 36, '2026-07': 132, '2026-08': 46 },
  app: { '2025-07': 39, '2026-01': 29, '2026-07': 173, '2026-08': 44 },
  site: { '2025-07': 10, '2026-01': 29, '2026-07': 40, '2026-08': 11 },
  tool: { '2025-07': 0, '2026-01': 5, '2026-07': 177, '2026-08': 50 },
};
const TLX = 232, TLW = 88, TLY = 1148, ROWH = 44;
const ROWS = [
  ['commits', 'ALL COMMITS', 0.17],
  ['pkg', 'packages/', 0.19],
  ['app', 'apps/', 0.19],
  ['site', 'docs+examples', 0.19],
  ['tool', 'tools/', 0.19],
];
const timeline = `
${txt(60, TLY - 18, 'THE FOUR SEASONS — activity by month · a bar is source-file touches in that district; the top row is every commit', 'lbls')}
${txt(60, TLY - 4, 'ten of fourteen months are silent — the city is built in campaigns, not tended daily', 'lblf')}
${ROWS.map(([key, label, sc], ri) => {
  const by = TLY + ri * ROWH + ROWH - 8; // baseline
  const src = key === 'commits' ? COMMITS : TOUCH[key];
  const bars = MONTHS.map((mo, i) => {
    const v = src[mo] ?? 0;
    if (!v) return `<line x1="${TLX + i * TLW + 8}" y1="${by}" x2="${TLX + i * TLW + TLW - 24}" y2="${by}" class="skf"/>`;
    const h = Math.max(3, v * sc);
    return `<rect x="${TLX + i * TLW + 8}" y="${(by - h).toFixed(1)}" width="${TLW - 32}" height="${h.toFixed(1)}" class="${key === 'commits' ? 'fa' : 'fp2'}"/>
<rect x="${TLX + i * TLW + 8}" y="${(by - h).toFixed(1)}" width="${TLW - 32}" height="${h.toFixed(1)}" class="${key === 'commits' ? 'ska' : 'sks'} fnone"/>
${txt(TLX + i * TLW + 8 + (TLW - 32) / 2, (by - h - 4).toFixed(1), String(v), 'lblf', 'middle')}`;
  }).join('');
  return txt(60, by - 2, label, 'lbls') + bars;
}).join('\n')}
<line x1="${TLX}" y1="${TLY + 5 * ROWH + 4}" x2="${TLX + 14 * TLW - 16}" y2="${TLY + 5 * ROWH + 4}" class="sk"/>
${MONTHS.map((mo, i) => txt(TLX + i * TLW + 8, TLY + 5 * ROWH + 20, mo.replace('20', "'"), 'lblf')).join('')}
${txt(TLX + 8, TLY + 5 * ROWH + 38, 'THE PORT', 'lbla')}
${txt(TLX + 6 * TLW + 8, TLY + 5 * ROWH + 38, 'WINTER WORKS', 'lbla')}
${txt(TLX + 12 * TLW + 8, TLY + 5 * ROWH + 38, 'THE SUMMER', 'lbla')}
${txt(TLX + 11 * TLW + 8, TLY + 5 * ROWH + 38, '3 commits ·', 'lblf')}`;

// ---- schedule --------------------------------------------------------------------
const seasonsOf = (r) => {
  const s = [0, 1, 2].map((i) => (r[7]?.[1][i] ?? 0) + (r[8]?.[1][i] ?? 0));
  return s.join('/');
};
const filesOf = (r) => (r[7]?.[0] ?? 0) + (r[8]?.[0] ?? 0);
const touchesOf = (r) => (r[7]?.[2] ?? 0) + (r[8]?.[2] ?? 0);
const schedRow = (r) => {
  const [n, name, , , , , , src, , born, medIdle, hot, sealed] = r;
  if (!src) return `${String(n).padStart(2, ' ')}  ${name} — no dated source (ambient types only)`;
  const f = filesOf(r), t = touchesOf(r);
  return `${String(n).padStart(2, ' ')}  ${name} — ${f}f · ${born} · ${seasonsOf(r)} · ×${t} (${(t / f).toFixed(1)}/f) · idle ${medIdle}d`
    + `${sealed ? ` · ${sealed} SEALED` : ''} · ${hot}`;
};
const half = Math.ceil(D.length / 2);
const SY = TLY + 5 * ROWH + 58;
const TOT_F = D.reduce((a, r) => a + filesOf(r), 0);
const TOT_T = D.reduce((a, r) => a + touchesOf(r), 0);
const schedule = `<rect x="40" y="${SY}" width="1480" height="${74 + half * 17}" class="sk fp"/>
${txt(58, SY + 22, 'STRUCTURE SCHEDULE — weathering per member · files · first-commit date · files born per season I/II/III · touches (per file) · median days since last touch', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1520" y2="${SY + 32}" class="skf"/>
${D.slice(0, half).map((r, i) => txt(58, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${D.slice(half).map((r, i) => txt(800, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${txt(58, SY + 58 + half * 17, `TOTAL — ${TOT_F} dated files (sheet 7 counted 258 on 08-16; members 1, 2, 9 grew spec files since) · ${fmt(TOT_T)} touches across 483 commits · seasons 26 / 18 / 220 · dated 2026-08-17`, 'lbls')}`;

// ---- callouts --------------------------------------------------------------------
const callouts = `
${txt(60, 432, 'lit-ui-router — THE ORIGINAL MASONRY', 'lbla')}
${txt(60, 446, 'seven of twelve src walls laid 2025-07-21, the first day —', 'lblf')}
${txt(60, 458, 'mean ×10.9 touches each, and still under the chisel:', 'lblf')}
${txt(60, 470, 'ui-sref.ts ×15, last touched 2026-08-16', 'lblf')}
<line x1="130" y1="422" x2="100" y2="238" class="skf"/>

${txt(1250, 700, 'docs/.vitepress/config.ts ×24', 'lblr')}
${txt(1250, 714, 'the most-weathered wall in the city —', 'lblf')}
${txt(1250, 726, '390 days old, repainted 24 times, idle 8d', 'lblf')}
<line x1="1246" y1="710" x2="1188" y2="702" class="skf"/>

${txt(1250, 780, 'examples/ — THE OLDEST UNTOUCHED STONE', 'lbls')}
${txt(1250, 794, 'two vite configs sealed 228 days,', 'lblf')}
${txt(1250, 806, 'helloworld/main.ts sealed 210 — all winter-built', 'lblf')}
<line x1="1246" y1="790" x2="1178" y2="800" class="skf"/>

${txt(560, 1078, '@tools/typedoc-plugin — SEALED WING', 'lbls')}
${txt(560, 1092, 'symbols/ untouched 220 days, since 2026-01-09', 'lblf')}
<line x1="556" y1="1080" x2="470" y2="1058" class="skf"/>

${txt(60, 1078, '@tools/release — 63 walls, every one summer-built', 'lbl')}
${txt(60, 1092, 'the yard’s largest building did not exist six weeks ago', 'lblf')}
<line x1="130" y1="1064" x2="146" y2="1044" class="skf"/>

${txt(196, 270, 'navigation-location-plugin — ×10.0/f', 'lblr')}
${txt(196, 284, 'one January wall, chiselled ten times:', 'lblf')}
${txt(196, 296, 'the highest churn intensity on the map', 'lblf')}
<line x1="412" y1="300" x2="456" y2="314" class="skf"/>`;

// ---- assemble --------------------------------------------------------------------
const H = SY + 104 + half * 17;
const svg = `<svg viewBox="0 0 1560 ${H}" role="img" aria-label="A flat plan-view weathering map of the lit-ui-router workspace: the same city as sheet 7, same four dashed districts and same footprints, but every building is now coloured by when its files were first committed and edged by how often they are touched. Each footprint is striped like masonry courses, oldest at the base: dense ink hatch for Season One, the July 2025 port; accent hatch for Season Two, the January 2026 winter works; plain paper for Season Three, the summer campaign that built 220 of the 264 files since July fourth. Under each building a tick gauge counts touches per file; six buildings carry red hot edges at six or more touches per file, and buildings touched less than twice are drawn faint. Dashed crosses seal the typedoc plugin and three example slabs, untouched for over two hundred days. A fourteen-month timeline below shows all activity concentrated in four months separated by silence, and a structure schedule dates every member. The reading box states the verdict: mean touches per file falls from nine and a half for the port cohort to two point three for the summer cohort — the oldest walls are the most chiselled.">
${defs(P)}
<defs>
  <pattern id="${P}-w1" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="4" stroke="var(--ink)" stroke-width="1.1" opacity="0.65"/>
  </pattern>
  <pattern id="${P}-w2" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" stroke-width="1.2" opacity="0.6"/>
  </pattern>
</defs>

<rect x="40" y="26" width="700" height="42" class="skf fnone"/>
${txt(52, 43, 'THE WEATHERING MAP — WHEN EVERY WALL WAS LAID, AND HOW OFTEN IT IS TOUCHED', 'lbls')}
${txt(52, 58, 'same city, same footprints as sheet 7 · fills date the stone · edges and ticks carry the churn', 'lblf')}

${txt(1520, 34, 'DATING — first-commit and last-touch per file from one pass over all 483 commits, renames followed', 'lbls', 'end')}
${txt(1520, 48, 'footprints reused from sheet 7 rev B as pure geometry (side = 1.6·√sloc) · weathering dated 2026-08-17', 'lblf', 'end')}
${txt(1520, 62, 'AGE IS FILL, CHURN IS EDGE — the two disagree: the oldest stone carries the hottest edges', 'lblf', 'end')}

${districts}
${bodies}
${RB}
${callouts}

${txt(X(0), Y(20) - 42, 'packages/ — THE PRODUCT', 'lblb')}
${txt(X(0), Y(20) - 30, 'the only district with port-era stone still in service', 'lblf')}

${txt(X(570) + 6, 436, 'apps/ — THE PROVING GROUND', 'lblb')}
${txt(X(570) + 6, 448, 'port-born shell, summer-rebuilt interior', 'lblf')}

${txt(1250, 652, 'docs/ + examples/ —', 'lblb')}
${txt(1250, 664, 'THE SHOPFRONT', 'lblb')}
<line x1="1246" y1="658" x2="1210" y2="668" class="skf"/>

${txt(60, 606, 'tools/ — THE INSTRUMENT YARD', 'lblb')}
${txt(60, 620, 'zero touches before 2026 · all but the typedoc plugin summer-built', 'lblf')}

${timeline}
${schedule}
</svg>`;

export const sheet13 = {
  num: 13, id: 'weathering', rev: 'A',
  title: 'THE WEATHERING MAP',
  sub: 'ALTITUDE t — the same city as sheet 7, surveyed in time · 264 files dated from 483 commits · three construction seasons, ten silent months · dated 2026-08-17',
  scale: 'WORKSPACE × TIME',
  form: 'WEATHERING MAP',
  svg,
  caption: 'Every sheet so far has drawn the city as it stands; this one dates the stone. Same districts, same footprints as sheet 7 — but the fills now say when each file was first committed and the edges say how often it is touched. The history turns out to be three construction campaigns separated by ten silent months, and the two encodings disagree on purpose: 83% of the city is summer-built and barely weathered, while the port’s original masonry — 26 files from July 2025 — carries the hottest edges on the map.',
  notes: `
<p><strong>Method — one pass, renames followed.</strong> Every file in sheet 7's universe was dated from a single <code>git log -M --name-status</code> pass over all 483 commits, walked newest to oldest with rename chains followed backwards — equivalent to per-file <code>--follow</code> (spot-verified against it, including <code>tools/shared/workspace.ts</code>, which the plain path log mis-dates by a week) but one process instead of 264. Per file: first-commit date, last-touch date, touch count. Merge commits list no files under the default log, so a touch is a non-merge commit — the standard convention. Footprints and placements are sheet 7 rev B's, reused as pure geometry so the two sheets reconcile by eye; the weathering itself is dated 2026-08-17 at HEAD, where the city has 264 files to sheet 7's 258 — members 1, 2 and 9 grew spec files in the intervening day, and the schedule carries the current counts.</p>
<p><strong>The bands are campaigns, not round numbers.</strong> The age histogram is not a slope, it is three spikes: files born around day 392 (July 2025), around day 210–228 (January 2026), and within the last 44 days — with <em>nothing</em> between them, because the repo has source births or touches in only four of its fourteen calendar months (commits in five: 42 · 103 · 3 · 224 · 111). So the map bins by season, where the distribution actually cuts: SEASON I, the port — 26 files that arrived 2025-07-21 with the upstream sample-app lineage; SEASON II, the winter works — 18 files including the typedoc plugin and the examples; SEASON III, the summer — 220 files, 83% of the city, none older than 2026-07-04. Churn tiers come from the per-block distribution the same way: touches-per-file has a clean gap between 4.6 and 6.0, so HOT is ≥6; the per-file median is 2, so COLD is below it. SEALED is idle &gt;180 days — the idle histogram is empty from 60 to 180, and exactly six files sit beyond the gap.</p>
<p><strong>The verdict: age and churn run opposite ways.</strong> Mean touches per file falls monotonically with youth — ×9.5 for the port cohort, ×5.5 for winter, ×2.3 for summer — and 104 of 264 files (39%) have been touched exactly once, ever. The port's masonry is not museum stone: 14 of its 26 files were touched in the last month, <code>ui-sref.ts</code> is at ×15 with the last chisel-mark dated 2026-08-16, and the two most-weathered walls in the city are the port-era <code>docs/.vitepress</code> pair — <code>config.ts</code> at ×24 and <code>vite.config.ts</code> at ×19. What survives from the first day is precisely what keeps being worked.</p>
<p><strong>What each district's weather says.</strong> The instrument yard — 4,684 sloc, the city's largest district by mass — logged <em>zero</em> touches before 2026 and is almost entirely summer stone at ×1.9 per file: infrastructure arrived late, fast, and mostly settled on the first cut. Its one winter building is also the map's sealed wing: the typedoc plugin's <code>symbols/</code> trio, untouched 220 days. The shopfront splits in two: <code>docs</code> runs the hottest block-average in the city (×7.1/f src) while <code>examples</code> holds the oldest untouched stone — two vite configs idle 228 days. And the smallest building on the map has the sharpest weather: <code>navigation-location-plugin</code>'s single January wall has been chiselled ten times, the highest per-file churn anywhere — matching its history as the extracted plugin that every routing change touches.</p>
<p><strong>Approximations, so the numbers stay honest.</strong> Dates are author dates (<code>%as</code>); on this repo's squash-merge convention they equal the merge day of the PR that landed the change. Rename detection is git's <code>-M</code> heuristic: a file moved <em>and</em> rewritten in one commit can read as a fresh birth — the July 2026 <code>scripts/ → tools/</code> graduations are dated to that graduation where git saw no rename, which the yard's notes above already state as its story. Generated and vendored trees were never in the universe (sheet 7's exclusions); nothing else was excluded.</p>`,
  key: [
    keyRow(`<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#${P}-w1)"/><rect x="6" y="3" width="36" height="12" class="sk fnone"/>`, 'SEASON I stone — born 2025-07, the port'),
    keyRow(`<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#${P}-w2)"/><rect x="6" y="3" width="36" height="12" class="sk fnone"/>`, 'SEASON II stone — born 2026-01, winter works'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp"/>', 'SEASON III stone — born since 2026-07-04'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="skr fnone"/><line x1="10" y1="15" x2="10" y2="17" class="skr"/><line x1="15" y1="15" x2="15" y2="17" class="skr"/><line x1="20" y1="15" x2="20" y2="17" class="skr"/>', 'HOT — ≥6 touches/file · red edge + tall ticks'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="skf fnone"/><line x1="10" y1="15" x2="10" y2="16" class="skf"/>', 'COLD — <2 touches/file · faint edge, short tick'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="sks fnone"/><line x1="6" y1="3" x2="42" y2="15" class="sks" stroke-dasharray="3 2"/><line x1="42" y1="3" x2="6" y2="15" class="sks" stroke-dasharray="3 2"/>', 'SEALED — contains files idle >180 days'),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sks fnone"/>', 'spec annex — same strata, own weather'),
    keyRow('<rect x="6" y="3" width="14" height="12" class="fp2"/><rect x="6" y="3" width="14" height="12" class="sks fnone"/><rect x="24" y="6" width="14" height="9" class="fa"/>', 'timeline bars — district touches · all commits'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'district (sheet 7’s)'),
  ].join('\n'),
};

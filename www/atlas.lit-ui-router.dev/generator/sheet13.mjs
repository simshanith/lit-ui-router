import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, schedule, leader, keyRow } from './helpers.mjs';
import { assertPlots, plotsOf } from './iso-hidden.mjs';

const P = 's13';

// ---- census: every date and count comes from www/atlas.lit-ui-router.dev/data/census-weather.json ----
// The plate is the checked-in snapshot census-weather.mjs writes: for every file
// in the shared city universe, first-commit date, last-touch date and touch count,
// from ONE `git log --name-status -M` pass walked newest→oldest with rename chains
// followed backwards (equivalent to --follow, batch).  Merge commits list no files
// under the default log, so touches = non-merge commits.  TODAY is the measured
// ref's own commit date, so ages are reproducible rather than wall-clock.
// Geometry (sloc) is read from www/atlas.lit-ui-router.dev/data/census-city.json — sheet 7's plate —
// so the two sheets share footprints by construction.  This file holds placement,
// bands and prose only.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-weather.json', import.meta.url), 'utf8'));
const CITY = JSON.parse(readFileSync(new URL('../data/census-city.json', import.meta.url), 'utf8'));
const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha}`;
const TODAY = PLATE.today.slice(0, 10);
const days = (d) => Math.round((new Date(PLATE.today) - new Date(d)) / 86400000);

// ---- editorial bands: where the distribution cuts, not round numbers ------------
// The history is not continuous — source files are born in only three campaigns,
// separated by empty months — so age bins by SEASON.  Churn tiers are editorial
// cuts on touches per file; the notes print where the plate's blocks fall against
// them.  SEALED = idle past the empty stretch in the idle histogram.
const SEASON_EDGE = ['2026-01', '2026-07'];
const HOT = 6, COLD = 2, SEAL = 180;
const season = (first) => (first < SEASON_EDGE[0] ? 0 : first < SEASON_EDGE[1] ? 1 : 2);

const CROW = new Map(CITY.rows.map((r) => [r.member, r]));
const MROW = new Map(PLATE.members.map((m) => [m.member, m]));
const FROW = new Map(PLATE.rows.map((r) => [r.path, r]));
const byMember = new Map();
for (const r of PLATE.rows) {
  if (!byMember.has(r.member)) byMember.set(r.member, []);
  byMember.get(r.member).push(r);
}
const cityRow = (dir) => {
  const r = CROW.get(dir);
  if (!r) throw new Error(`sheet 13: member ${dir} is missing from www/atlas.lit-ui-router.dev/data/census-city.json`);
  return r;
};
const file = (path) => {
  const r = FROW.get(path);
  if (!r) throw new Error(`sheet 13: file ${path} is missing from www/atlas.lit-ui-router.dev/data/census-weather.json`);
  return r;
};
// a drawn block: file count, files born per season, total touches
const agg = (rs) => (rs.length
  ? [rs.length, [0, 1, 2].map((s) => rs.filter((r) => season(r.first) === s).length), rs.reduce((a, r) => a + r.touches, 0)]
  : null);
// hottest wall, named short: member prefix and src/ dropped
const shortPath = (p, dir) => (p.startsWith(`${dir}/`) ? p.slice(dir.length + 1) : p).replace(/^src\//, '');

// ---- geometry: sheet 7's plan footprints, flattened -----------------------------
// Same placements, same side = 1.6·√sloc rule, same sloc plate — reused as pure
// geometry so the two sheets reconcile by eye.
const KS = 1.6, MIN = 12, K = 1.6, OX = 46, OY = 110;
const S = (sloc) => Math.max(MIN, KS * Math.sqrt(sloc));
const AG = 10;
const X = (x) => OX + K * x, Y = (y) => OY + K * y;

// [n, name, plate member dir, district, x, y] — every number comes from the plates
const PLACED = [
  // sheet 7's lots; the yard and the shopfront stand 30 south of them and the release-diffs worker east of examples, so the
  // lettering between the districts and the sheet's east edge both clear; 9 and 40 a step south, their badges clear of 45 and 12
  [1, 'lit-ui-router', 'packages/lit-ui-router', 'pkg', 0, 20],
  [2, 'ui-router-server', 'packages/ui-router-server', 'pkg', 266, 20],
  [3, 'lit-ui-router-mobx', 'packages/lit-ui-router-mobx', 'pkg', 30, 152],
  [4, 'navigation-location-plugin', 'packages/navigation-location-plugin', 'pkg', 504, 246],
  [5, 'sample-app-shared', 'apps/sample-app-shared', 'app', 648, 10],
  [6, 'sample-app-lit-vanilla', 'apps/sample-app-lit-vanilla', 'app', 798, 10],
  [7, 'sample-app-lit-mobx', 'apps/sample-app-lit-mobx', 'app', 798, 90],
  [8, 'sample-app-routes', 'apps/sample-app-routes', 'app', 778, 150],
  [9, 'sample-app-lit-e2e', 'apps/sample-app-lit-e2e', 'app', 658, 156],
  [10, 'docs', 'www/lit-ui-router.dev', 'site', 680, 400],
  [11, 'examples', 'examples', 'site', 680, 512],
  [12, '@tools/release', 'tools/release', 'tool', 0, 482],
  [13, '@tools/typedoc-plugin', 'tools/typedoc-plugin-lit-ui-router', 'tool', 486, 630],
  [14, '@tools/dts-backtest', 'tools/dts-backtest', 'tool', 8, 380],
  [15, '@tools/build_and_test', 'tools/build_and_test', 'tool', 208, 524],
  [16, '@tools/shared', 'tools/shared', 'tool', 200, 642],
  [17, '@tools/workers-builds', 'tools/workers-builds', 'tool', 220, 580],
  [18, '@tools/bundle-probe', 'tools/bundle-probe', 'tool', 346, 580],
  [19, '@tools/compat-guards', 'tools/compat-guards', 'tool', 130, 580],
  [20, '@tools/oxc-emit', 'tools/oxc-emit', 'tool', 234, 380],
  [21, '@tools/release-config', 'tools/release-config', 'tool', 316, 380],
  [22, '@tools/lit-template-lint', 'tools/lit-template-lint', 'tool', 446, 380],
  [23, '@tools/lit-test-env', 'tools/lit-test-env', 'tool', 85, 380],
  [24, '@tools/vue-check', 'tools/vue-check', 'tool', 376, 380],
  [25, '@tools/lcov-rebase', 'tools/lcov-rebase', 'tool', 180, 425],
  [26, '@tools/happy-dom', 'tools/happy-dom', 'tool', 174, 380],
  [27, '@tools/wintercg-globals', 'tools/wintercg-globals', 'tool', 214, 380],
  [28, '@tools/lint-elements', 'tools/lint-elements', 'tool', 426, 580],
  [30, '@tools/eslint-ts-parser', 'tools/eslint-ts-parser', 'tool', 54, 380],
  [31, 'eslint-plugin-lit-ui-router', 'packages/eslint-plugin-lit-ui-router', 'pkg', 346, 170],
  [32, '@tools/embed-heights', 'tools/embed-heights', 'tool', 476, 538],
  [33, '@tools/bootstrap', 'tools/bootstrap', 'tool', 394, 380],
  [34, '@tools/eslint', 'tools/eslint', 'tool', 514, 582],
  [35, '@tools/repo-checks', 'tools/repo-checks', 'tool', 440, 464],
  [36, 'sample-app-lit-effect', 'apps/sample-app-lit-effect', 'app', 738, 100],
  [37, 'lit-ui-router-effect', 'packages/lit-ui-router-effect', 'pkg', 30, 200],
  [38, 'lit-ui-router-ssr', 'packages/lit-ui-router-ssr', 'pkg', 130, 178],
  [39, '@tools/crap', 'tools/crap', 'tool', 560, 630],
  [40, '@tools/oxlint-anti-slop', 'tools/oxlint-anti-slop', 'tool', 0, 592],
  [41, 'lit-ui-router-signals', 'packages/lit-ui-router-signals', 'pkg', 504, 180],
  [42, 'ui-router-signals', 'packages/ui-router-signals', 'pkg', 538, -2],
  [43, 'ui-router-effect', 'packages/ui-router-effect', 'pkg', 538, 92],
  [44, '@repo/route-snapshot', 'packages/shared/route-snapshot', 'pkg', 538, 122],
  [45, 'sample-app-lit-signals', 'apps/sample-app-lit-signals', 'app', 668, 100],
  [46, '@tools/a11y', 'tools/a11y', 'tool', 540, 538],
  [47, 'ui-router-mobx', 'packages/ui-router-mobx', 'pkg', 538, 58],
  [48, '@tools/ci-logs', 'tools/ci-logs', 'tool', 295, 642],
  [49, '@repo/dev-gate', 'packages/shared/dev-gate', 'pkg', 538, 27],
  [50, 'ui-router-registry', 'packages/ui-router-registry', 'pkg', 436, 256],
  [51, '@tools/release-ledger', 'tools/release-ledger', 'tool', 392, 620],
  [52, 'release-diffs', 'www/release-diffs.lit-ui-router.dev', 'site', 842, 570],
  [53, 'release-ledger', 'www/release-ledger.lit-ui-router.dev', 'site', 764, 282],
  [54, '@repo/transition-status', 'packages/shared/transition-status', 'pkg', 538, 146],
  [55, '@tools/turbo-summary', 'tools/turbo-summary', 'tool', 236, 430],
  [56, 'postcss-lit-html', 'packages/postcss-lit-html', 'pkg', 346, 256],
  [57, '@tools/doc-example-check', 'tools/doc-example-check', 'tool', 292, 524],
  [58, '@tools/md-content-mapper', 'tools/md-content-mapper', 'tool', 366, 524],
  // a step south of sheet 7's lot, its badge clear of 19's ticks
  [59, '@tools/cloudflare-api', 'tools/cloudflare-api', 'tool', 130, 633],
];
// every census member stands on a lot, so the totals and the blocks cannot disagree
const UNPLACED = CITY.rows.filter((r) => !PLACED.some((p) => p[2] === r.member)).map((r) => r.member);
if (UNPLACED.length) throw new Error(`sheet 13: census-city.json carries ${UNPLACED.join(', ')} and PLACED gives ${UNPLACED.length === 1 ? 'it' : 'them'} no lot`);

// [n, name, dist, x, y, srcSloc, specSloc,
//  src:[n, seasons[I,II,III], t], spec or null,
//  born, medIdle, hot 'file×n', sealed]
const D = PLACED.map(([n, name, dir, dist, x, y]) => {
  const c = cityRow(dir), m = MROW.get(dir), rs = byMember.get(dir) ?? [];
  const born = rs.length ? rs.reduce((a, r) => (r.first < a ? r.first : a), '9999-99-99') : '—';
  return [n, name, dist, x, y, c.srcSloc, c.specSloc,
    agg(rs.filter((r) => !r.spec)), agg(rs.filter((r) => r.spec)),
    born, m?.medIdle ?? 0, m?.hotFile ? `${shortPath(m.hotFile, dir)}×${m.hotTouches}` : '—',
    rs.filter((r) => days(r.last) > SEAL).length];
});
const fmt = (v) => v.toLocaleString('en-US');

// ---- weather rendering ----------------------------------------------------------
// Age lives in the FILL as strata (oldest at the bottom, like masonry courses):
//   Season I = dense ink hatch · II = accent hatch · III = plain paper.
// Churn intensity lives on the EDGE + a tick gauge under the block:
//   HOT (≥6 t/f) = red edge, tall red ticks · COLD (<2) = faint edge, short faint
//   ticks · else ink.  Hue and weight move together so both themes read.
const tier = (t, n) => (t / n >= HOT ? 'hot' : t / n < COLD ? 'cold' : 'mid');
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
// this sheet keeps its own copy of the placements: assert its plots on their own
assertPlots('sheet 13', D.flatMap(([n, name]) => plotsOf({ n, name, ...g(n) })));

// 16 and 48 stand close under 17 and its annex: their badges sit on their own north edges
const BADGE_LIFT = { 2: 12, 6: 14, 16: -12, 21: 14, 23: 14, 24: 14, 27: 14, 48: -12 };
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
  ['site', 18, 'www/ + examples/ — THE SHOPFRONT'],
  ['tool', 22, 'tools/ — THE INSTRUMENT YARD'],
];
const districts = DIST.map(([d, pad]) => {
  const bs = D.filter((r) => r[2] === d).map((r) => g(r[0]));
  const x1 = Math.min(...bs.map((b) => b.x)) - pad, y1 = Math.min(...bs.map((b) => b.y1)) - pad - 14;
  const x2 = Math.max(...bs.map((b) => b.x2)) + pad, y2 = Math.max(...bs.map((b) => b.y2)) + pad + 8;
  return `<rect x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" width="${(x2 - x1).toFixed(1)}" height="${(y2 - y1).toFixed(1)}" class="skf fnone" stroke-dasharray="5 4"/>`;
}).join('\n');

// ---- city-wide roll-ups the prose and the schedule quote ----------------------
const SEASON_N = [0, 1, 2].map((s) => PLATE.rows.filter((r) => season(r.first) === s).length);
const SEASON_TPF = [0, 1, 2].map((s) => {
  const rs = PLATE.rows.filter((r) => season(r.first) === s);
  return (rs.reduce((a, r) => a + r.touches, 0) / rs.length).toFixed(1);
});
const SEASON_FIRST = [0, 1, 2].map((s) => PLATE.rows.filter((r) => season(r.first) === s)
  .reduce((a, r) => (r.first < a ? r.first : a), '9999-99-99'));
const TOT_F = PLATE.rows.length;
const TOT_T = PLATE.rows.reduce((a, r) => a + r.touches, 0);
const ONCE = PLATE.rows.filter((r) => r.touches === 1).length;
const SUMMER_PCT = Math.round((SEASON_N[2] / TOT_F) * 100);
// the cover index's fit verdict, told from the plate's own seasons
export const SHEET13_VERDICT = `${SUMMER_PCT}% of the city is summer stone — and the port’s original masonry, ${SEASON_N[0]} files from ${SEASON_FIRST[0]}, carries the hottest edges`;
const HOT_BLOCKS = D.filter((r) => r[7] && tier(r[7][2], r[7][0]) === 'hot').length;
const SEALED_ROWS = PLATE.rows.filter((r) => days(r.last) > SEAL);
const SEALED_F = SEALED_ROWS.length;
if (!SEALED_ROWS.every((r) => r.path.startsWith('examples/'))) throw new Error('sheet 13: a sealed file stands outside examples/ — the notes say every one is there');
const SEALED_WINTER = SEALED_ROWS.every((r) => season(r.first) === 1);
const SEALED_VITE = SEALED_ROWS.filter((r) => r.path.endsWith('/vite.config.ts')).length;
const SEALED_BLOCKS = D.filter((r) => r[12]).map((r) => r[1]);
const DATED_BLOCKS = D.filter((r) => r[7]).length;
const PER_FILE = PLATE.rows.map((r) => r.touches).sort((a, b) => a - b);
const PER_FILE_MED = PER_FILE[Math.floor(PER_FILE.length / 2)];
const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const dayN = (n) => `${n} day${n === 1 ? '' : 's'}`;
// the empty band the SEAL threshold sits in: last idle day before it, first after
const IDLE_SORTED = [...new Set(PLATE.rows.map((r) => days(r.last)))].sort((a, b) => a - b);
const IDLE_GAP = [IDLE_SORTED.filter((d) => d < SEAL).at(-1), IDLE_SORTED.find((d) => d > SEAL)];
const distSloc = (d) => D.filter((r) => r[2] === d).reduce((a, r) => a + r[5], 0);
const tpf = (n) => (g(n).src[2] / g(n).src[0]).toFixed(1);
const row = (n) => D.find((r) => r[0] === n);

// ---- timeline: every calendar month the plate spans, most of them silent ----------
const monthRange = () => {
  const keys = Object.keys(PLATE.months).sort();
  const out = [];
  let [y, m] = keys[0].split('-').map(Number);
  for (;;) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    out.push(k);
    if (k === keys[keys.length - 1]) return out;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
};
const MONTHS = monthRange();
const ALIVE = MONTHS.filter((mo) => PLATE.months[mo]).length;
const TOUCH = PLATE.months;
const total = (mo) => (TOUCH[mo] ? TOUCH[mo].pkg + TOUCH[mo].app + TOUCH[mo].site + TOUCH[mo].tool : 0);
// ROWH clears the tallest bar plus its value label — no bar climbs into the row above:
// each scale is capped by the plate's own busiest month, and the four districts share one
const TLX = 232, TLW = 75, TLY = 1296, ROWH = 56, BAR_MAX = ROWH - 22;
const DIST_PEAK = Math.max(...MONTHS.flatMap((mo) => ['pkg', 'app', 'site', 'tool'].map((k) => TOUCH[mo]?.[k] ?? 0)));
const ALL_PEAK = Math.max(...MONTHS.map(total));
const SC_ALL = Math.min(0.075, BAR_MAX / ALL_PEAK), SC_DIST = Math.min(0.19, BAR_MAX / DIST_PEAK);
const ROWS = [
  ['all', 'ALL DISTRICTS', SC_ALL],
  ['pkg', 'packages/', SC_DIST],
  ['app', 'apps/', SC_DIST],
  ['site', 'www+examples', SC_DIST],
  ['tool', 'tools/', SC_DIST],
];
const timeline = `
${txt(60, TLY - 18, 'THE FOUR SEASONS — activity by month · a bar is source-file touches in that district; the top row is all four together', 'lbls')}
${txt(60, TLY - 4, `${MONTHS.length - ALIVE} of ${MONTHS.length} months are silent — the city is built in campaigns, not tended daily`, 'lblf')}
${ROWS.map(([key, label, sc], ri) => {
  const by = TLY + ri * ROWH + ROWH - 8; // baseline
  const bars = MONTHS.map((mo, i) => {
    const v = key === 'all' ? total(mo) : (TOUCH[mo]?.[key] ?? 0);
    if (!v) return `<line x1="${TLX + i * TLW + 8}" y1="${by}" x2="${TLX + i * TLW + TLW - 24}" y2="${by}" class="skf"/>`;
    const h = Math.max(3, v * sc);
    return `<rect x="${TLX + i * TLW + 8}" y="${(by - h).toFixed(1)}" width="${TLW - 32}" height="${h.toFixed(1)}" class="${key === 'all' ? 'fa' : 'fp2'}"/>
<rect x="${TLX + i * TLW + 8}" y="${(by - h).toFixed(1)}" width="${TLW - 32}" height="${h.toFixed(1)}" class="${key === 'all' ? 'ska' : 'sks'} fnone"/>
${txt(TLX + i * TLW + 8 + (TLW - 32) / 2, (by - h - 4).toFixed(1), String(v), 'lblf', 'middle')}`;
  }).join('');
  return txt(60, by - 2, label, 'lbls') + bars;
}).join('\n')}
<line x1="${TLX}" y1="${TLY + 5 * ROWH + 4}" x2="${TLX + MONTHS.length * TLW - 16}" y2="${TLY + 5 * ROWH + 4}" class="sk"/>
${MONTHS.map((mo, i) => txt(TLX + i * TLW + 8, TLY + 5 * ROWH + 20, mo.replace('20', "'"), 'lblf')).join('')}
${txt(TLX + MONTHS.indexOf('2025-07') * TLW + 8, TLY + 5 * ROWH + 38, 'THE PORT', 'lbls')}
${txt(TLX + MONTHS.indexOf('2026-01') * TLW + 8, TLY + 5 * ROWH + 38, 'WINTER WORKS', 'lbls')}
${txt(TLX + MONTHS.indexOf('2026-07') * TLW + 8, TLY + 5 * ROWH + 38, 'THE SUMMER', 'lbls')}`;

// ---- schedule --------------------------------------------------------------------
const seasonsOf = (r) => {
  const s = [0, 1, 2].map((i) => (r[7]?.[1][i] ?? 0) + (r[8]?.[1][i] ?? 0));
  return s.join('/');
};
const filesOf = (r) => (r[7]?.[0] ?? 0) + (r[8]?.[0] ?? 0);
const touchesOf = (r) => (r[7]?.[2] ?? 0) + (r[8]?.[2] ?? 0);
const schedRow = (r) => {
  const [n, name, , , , , , src, , born, medIdle, hot, sealed] = r;
  if (!src) return [n, name, '—', '—', '—', '—', '—', '—', '—', 'no dated source (ambient types only)'];
  const f = filesOf(r), t = touchesOf(r);
  return [n, name, f, born, seasonsOf(r), t, (t / f).toFixed(1), medIdle, sealed ? `${sealed} SEALED` : '—', hot];
};
const SCHEDULE = schedule('STRUCTURE SCHEDULE — weathering per member · files · first-commit date · files born per season I/II/III · touches (per file) · median days since last touch',
  ['#', 'member', 'files', 'first commit', 'born I/II/III', 'touches', 'per file', 'idle (d)', 'sealed', 'hottest file'], D.map(schedRow),
  `TOTAL — ${TOT_F} dated files (sheet 7's plate counts the same ${TOT_F}) · ${fmt(TOT_T)} touches · seasons ${SEASON_N.join(' / ')} · mean touches per file by birth season I ×${SEASON_TPF[0]} · II ×${SEASON_TPF[1]} · III ×${SEASON_TPF[2]} · TODAY = ${TODAY} · ${BASIS}`);

// ---- callouts --------------------------------------------------------------------
const SREF = file('packages/lit-ui-router/src/ui-sref.ts');
const DCFG = file('www/lit-ui-router.dev/.vitepress/config.ts');
const SOLAR = file('examples/hellosolarsystem/vite.config.ts');
const HELLO = file('examples/helloworld/src/main.ts');
// symbols/ — this map's old sealed wing — left the tree with #831/#832; the citation
// relocates to the plugin's surviving winter wall rather than widening
const SYM = file('tools/typedoc-plugin-lit-ui-router/src/index.ts');
const PORT_LUR = (byMember.get('packages/lit-ui-router') ?? []).filter((r) => !r.spec && season(r.first) === 0);
// the plugin's walls and its block's rank by touches per file, all off the plates
const NAV_IDX = file('packages/navigation-location-plugin/src/index.ts');
const NAV_REST = (byMember.get('packages/navigation-location-plugin') ?? []).filter((r) => !r.spec && r.path !== NAV_IDX.path);
const MONTH = (d) => new Date(`${d}T00:00:00Z`).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
const NAV_RANK = D.filter((r) => r[7]).map((r) => r[7][2] / r[7][0]).sort((a, b) => b - a).indexOf(g(4).src[2] / g(4).src[0]) + 1;
const ORD = ['', 'the highest', 'the second-highest', 'the third-highest', 'the fourth-highest', 'the fifth-highest', 'the sixth-highest', 'the seventh-highest', 'the eighth-highest'];
const NAV_RANK_TXT = ORD[NAV_RANK] ?? `number ${NAV_RANK}`;
const SIZE_ORD = ['the smallest', 'the second-smallest', 'the third-smallest', 'the fourth-smallest', 'the fifth-smallest', 'the sixth-smallest', 'the seventh-smallest', 'the eighth-smallest', 'the ninth-smallest', 'the tenth-smallest'];
const NAV_SIZE_RANK = D.filter((r) => r[2] === 'pkg').sort((a, b) => a[5] - b[5]).findIndex((r) => r[0] === 4);
const NAV_SIZE_TXT = SIZE_ORD[NAV_SIZE_RANK];
if (!NAV_SIZE_TXT) throw new Error(`sheet 13: navigation-location-plugin ranks ${NAV_SIZE_RANK + 1} by size among the packages — extend SIZE_ORD`);
const MULTI = D.filter((r) => r[7] && r[7][0] > 1).sort((a, b) => b[7][2] / b[7][0] - a[7][2] / a[7][0]).map((r) => r[0]);
const HOT_ORD = ['the hottest', 'the second-hottest', 'the third-hottest', 'the fourth-hottest', 'the fifth-hottest', 'the sixth-hottest', 'the seventh-hottest', 'the eighth-hottest', 'the ninth-hottest', 'the tenth-hottest', 'the eleventh-hottest', 'the twelfth-hottest'];
const DOCS_HOT = HOT_ORD[MULTI.indexOf(10)];
if (!DOCS_HOT) throw new Error(`sheet 13: the notes rank docs among the hottest multi-file block-averages, and the plate ranks it ${MULTI.indexOf(10) + 1} — extend HOT_ORD`);
if (['pkg', 'app', 'site'].some((d) => distSloc(d) > distSloc('tool'))) throw new Error('sheet 13: the notes call the instrument yard the largest district by mass, and the plate says otherwise');
// the examples callout hangs under its block, below the district's frame
const EXB = g(11);
const EX_X = EXB.x, EX_Y = EXB.y2 + 70;
const EX_LINES = [
  [EX_Y - 26, 'examples/ — THE OLDEST UNTOUCHED STONE', 'lbls'],
  [EX_Y - 12, `${NUMW[SEALED_VITE]} vite configs sealed ${days(SOLAR.last)} days,`, 'lblf'],
  [EX_Y, `${days(HELLO.last) > SEAL ? `helloworld/main.ts sealed ${days(HELLO.last)} — ` : ''}${SEALED_WINTER ? `${SEALED_F === 2 ? 'both' : `all ${SEALED_F}`} winter-built` : 'not all of them winter stone'}`, 'lblf'],
];
// no bbox helper exists: each line's rect is estimated at 6.3 px per character, a margin over the data face
const LINE_H = { lbls: 10.5, lblf: 10 };
// the docs callout stands inside the shopfront's frame, in the band between the ledger worker and docs
const SITE_B = D.filter((r) => r[2] === 'site').map((r) => g(r[0]));
const SITE_LEFT = Math.min(...SITE_B.map((b) => b.x)) - 18, SITE_TOP = Math.min(...SITE_B.map((b) => b.y1)) - 32;
// the apps lettering hangs under its district's frame
const APP_BOTTOM = Math.max(...D.filter((r) => r[2] === 'app').map((r) => g(r[0]).y2)) + 28;
const DOC_X = SITE_LEFT + 6, DOC_Y = g(10).y - 54;
const DOC_LINES = [
  [DOC_Y, `.vitepress/config.ts ×${DCFG.touches}`, 'lblr'],
  [DOC_Y + 14, 'the most-weathered wall in the city —', 'lblf'],
  [DOC_Y + 26, `${days(DCFG.first)} days old, repainted ${DCFG.touches} times, idle ${days(DCFG.last)}d`, 'lblf'],
];
if (shortPath(DCFG.path, 'www/lit-ui-router.dev') !== '.vitepress/config.ts') throw new Error('sheet 13: the docs callout letters .vitepress/config.ts, and the plate names another wall');
for (const [x, set, what] of [[EX_X, EX_LINES, 'examples'], [DOC_X, DOC_LINES, 'docs']]) for (const [y, s, cls] of set) {
  const r = { x1: x, y1: y - (LINE_H[cls] ?? 10.5), x2: x + s.length * 6.3, y2: y + 3 };
  const hit = D.find(([n]) => { const b = g(n); return r.x1 < b.x2 && b.x < r.x2 && r.y1 < b.y2 && b.y1 < r.y2; });
  if (hit) throw new Error(`sheet 13: the ${what} callout line "${s}" lands on №${hit[0]} ${hit[1]} — move it`);
}
const callouts = `
${txt(60, 534, 'lit-ui-router — THE ORIGINAL MASONRY', 'lbla')}
${txt(60, 548, `${PORT_LUR.length} of ${g(1).src[0]} src walls laid ${SREF.first}, the first day —`, 'lblf')}
${txt(60, 560, `mean ×${(PORT_LUR.reduce((a, r) => a + r.touches, 0) / PORT_LUR.length).toFixed(1)} touches each, and still under the chisel:`, 'lblf')}
${txt(60, 572, `ui-sref.ts ×${SREF.touches}, last touched ${SREF.last}`, 'lblf')}
${leader(58, 524, 56, 242)}

${DOC_LINES.map(([y, s, cls]) => txt(DOC_X, y, s, cls)).join('\n')}
${leader(DOC_X + 2, DOC_Y + 31, g(10).x + 5, g(10).y - 2)}

${EX_LINES.map(([y, s, cls]) => txt(EX_X, y, s, cls)).join('\n')}
${leader(EX_X + 60, EX_Y - 38, EXB.x + EXB.s * 0.4, EXB.y2 + 14)}

${txt(g(13).x2, g(13).y2 + 40, '@tools/typedoc-plugin — THE YARD’S ONE WINTER WALL', 'lbls', 'end')}
${txt(g(13).x2, g(13).y2 + 54, `index.ts laid ${SYM.first}, still under the chisel — ×${SYM.touches}, idle ${days(SYM.last)}d`, 'lblf', 'end')}

${txt(60, g(12).y - 67, `@tools/release — ${filesOf(row(12))} walls, every one summer-built`, 'lbl')}
${txt(60, g(12).y - 53, `the yard’s largest building is ${days(row(12)[9])} days old`, 'lblf')}
${leader(150, g(12).y - 48, 166, g(12).y - 2)}

${txt(g(4).x - 92, 620, `navigation-location-plugin — ×${tpf(4)}/f`, 'lbls')}
${txt(g(4).x - 92, 634, `its ${MONTH(NAV_IDX.first)} index.ts chiselled ${NAV_IDX.touches} times;`, 'lblf')}
${txt(g(4).x - 92, 646, NAV_REST.length === 1 ? `one ${MONTH(NAV_REST[0].first)} wall beside it, touched ${NAV_REST[0].touches}×` : `${NAV_REST.length} younger walls beside it`, 'lblf')}
${leader(g(4).x + g(4).s / 2, 609, g(4).x + g(4).s / 2, g(4).y + g(4).s + 16)}`;

// ---- assemble --------------------------------------------------------------------
// the figure ends 20 px under the timeline's season lettering
const H = TLY + 5 * ROWH + 58;
const svg = `<svg viewBox="0 0 1560 ${H}" role="img" aria-label="A flat plan-view weathering map of the lit-ui-router workspace: the same city as sheet 7, same four dashed districts and same footprints, but every building is coloured by when its files were first committed and edged by how often they are touched. Each footprint is striped like masonry courses, oldest at the base: dense ink hatch for Season One, the July 2025 port; accent hatch for Season Two, the January 2026 winter works; plain paper for Season Three, the summer campaign that built ${SEASON_N[2]} of the ${TOT_F} files since July fourth. Under each building a tick gauge counts touches per file; ${HOT_BLOCKS} buildings carry red hot edges at six or more touches per file, and buildings touched less than twice are drawn faint. Dashed crosses seal ${SEALED_BLOCKS.length === 1 ? `the ${SEALED_BLOCKS[0]} slab` : `${NUMW[SEALED_BLOCKS.length]} slabs`}, where ${NUMW[SEALED_F] ?? SEALED_F} files stand untouched for over ${SEAL} days. A ${MONTHS.length}-month timeline below shows all activity concentrated in ${ALIVE} months separated by silence, and a structure schedule below the drawing dates every member. Mean touches per file falls from ${SEASON_TPF[0]} for the port cohort to ${SEASON_TPF[2]} for the summer cohort — the oldest walls are the most chiselled.">
${defs(P)}
<defs>
  <pattern id="${P}-w1" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="4" stroke="var(--ink)" stroke-width="1.1" opacity="0.65"/>
  </pattern>
  <pattern id="${P}-w2" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" stroke-width="1.2" opacity="0.6"/>
  </pattern>
</defs>

${txt(1520, 34, 'DATING — first-commit and last-touch per file from one pass over the history behind the measured ref, renames followed', 'lbls', 'end')}

${districts}
${bodies}
${callouts}

<!-- the district's north wall reaches x 187 now, so the note takes two short lines -->
${txt(X(0), Y(20) - 54, 'packages/ — THE PRODUCT', 'lblb')}
${txt(X(0), Y(20) - 41, 'the only district with stone', 'lblf')}
${txt(X(0), Y(20) - 29, 'from all three seasons', 'lblf')}

${txt(X(640) - 14, APP_BOTTOM + 14, 'apps/ — THE PROVING GROUND', 'lblb')}
${txt(X(640) - 14, APP_BOTTOM + 26, 'port-born shell, summer-rebuilt interior', 'lblf')}

${txt(SITE_LEFT + 6, SITE_TOP - 7, 'www/ + examples/ — THE SHOPFRONT', 'lblb')}

${txt(60, 652, 'tools/ — THE INSTRUMENT YARD', 'lblb')}
${txt(60, 666, 'zero touches before 2026 · all but the typedoc plugin summer-built', 'lblf')}

${timeline}
</svg>`;

// the homes the notes name: git's log reference and this repository's paths
const GIT_LOG = 'https://git-scm.com/docs/git-log';
const REPO = 'https://github.com/simshanith/lit-ui-router';
const tree = (path) => `${REPO}/tree/main/${path}`;
const blob = (path) => `${REPO}/blob/main/${path}`;

export const sheet13 = {
  num: 13, id: 'weathering', rev: 'L',
  title: 'THE WEATHERING MAP',
  sub: `ALTITUDE t — the same city as sheet 7, surveyed in time · ${TOT_F} files dated from the whole history · three construction seasons, ${MONTHS.length - ALIVE} silent months · ${BASIS}`,
  scale: 'WORKSPACE × TIME',
  form: 'WEATHERING MAP',
  svg,
  schedule: SCHEDULE,
  caption: `Every sheet so far has drawn the city as it stands; this one dates the stone. Same districts and footprints as sheet 7, but the fills now say when each file was first committed and the edges how often it is touched. The history is three construction campaigns separated by silent months, and the two encodings disagree on purpose: ${Math.round((SEASON_N[2] / TOT_F) * 100)}% of the city is summer-built and barely weathered, while the port’s original masonry carries the hottest edges on the map.`,
  notes: `
<p><strong>Method — one pass, renames followed.</strong> Every date on this sheet is read at build time from the checked-in plate <code>www/atlas.lit-ui-router.dev/data/census-weather.json</code>, ${BASIS}. Each file in the shared city universe was dated from a single <a href="${GIT_LOG}"><code>git log --name-status -M</code></a> pass over the history behind that ref, walked newest to oldest with rename chains followed backwards — equivalent to per-file <code>--follow</code> (spot-verified against it, including <code>tools/shared/workspace.ts</code>, which the plain path log mis-dates by a week) but one process instead of ${TOT_F}. Per file: first-commit date, last-touch date, touch count. Merge commits list no files under the default log, so a touch is a non-merge commit — the standard convention. <code>TODAY</code> is not a wall-clock date: it is the measured ref's own commit date, ${TODAY}, so every age and idle figure below is reproducible from the sha rather than from the day the sheet was drawn. Footprints come from sheet 7's plate, <code>www/atlas.lit-ui-router.dev/data/census-city.json</code>, reused as pure geometry so the two sheets reconcile by eye — and by count: ${TOT_F} dated files here against the same ${TOT_F} there.</p>
<p><strong>The bands are campaigns, not round numbers.</strong> The age histogram is not a slope, it is three spikes: files born around day ${days('2025-07-21')} (July 2025), around day ${days('2026-01-11')} (January 2026), and within the last ${days(SEASON_FIRST[2])} days — with <em>nothing</em> between them, because the repo has source births or touches in only ${ALIVE} of its ${MONTHS.length} calendar months. So the map bins by season, where the distribution actually cuts: SEASON I, the port — ${SEASON_N[0]} files that arrived 2025-07-21 with the upstream sample-app lineage; SEASON II, the winter works — ${SEASON_N[1]} files including the <a href="${tree('tools/typedoc-plugin-lit-ui-router')}">typedoc plugin</a> and the <a href="${tree('examples')}">examples</a>; SEASON III, the summer — ${SEASON_N[2]} files, ${Math.round((SEASON_N[2] / TOT_F) * 100)}% of the city, none older than ${SEASON_FIRST[2]}. Churn tiers are editorial cuts on touches per file: HOT is ≥${HOT}, where ${HOT_BLOCKS} of the ${DATED_BLOCKS} dated blocks stand, and COLD sits below ${COLD}, under the per-file median of ${PER_FILE_MED}. SEALED is idle &gt;${SEAL} days — the idle histogram is empty from ${IDLE_GAP[0]} to ${IDLE_GAP[1]}, and ${SEALED_F} files sit beyond the gap.</p>
<p><strong>The verdict: age and churn run opposite ways.</strong> Mean touches per file falls monotonically with youth — ×${SEASON_TPF[0]} for the port cohort, ×${SEASON_TPF[1]} for winter, ×${SEASON_TPF[2]} for summer — and ${ONCE} of ${TOT_F} files (${Math.round((ONCE / TOT_F) * 100)}%) have been touched exactly once, ever. The port's masonry is not museum stone: ${SREF.path.split('/').pop()} is at ×${SREF.touches} with the last chisel-mark dated ${SREF.last}, and the two most-weathered walls in the city are the port-era <a href="${tree('www/lit-ui-router.dev/.vitepress')}"><code>www/lit-ui-router.dev/.vitepress</code></a> pair — <a href="${blob('www/lit-ui-router.dev/.vitepress/config.ts')}"><code>config.ts</code></a> at ×${DCFG.touches} and <a href="${blob('www/lit-ui-router.dev/.vitepress/vite.config.ts')}"><code>vite.config.ts</code></a> at ×${file('www/lit-ui-router.dev/.vitepress/vite.config.ts').touches}. What survives from the first day is precisely what keeps being worked.</p>
<p><strong>What each district's weather says.</strong> The instrument yard — ${fmt(distSloc('tool'))} sloc, the city's largest district by mass — logged <em>zero</em> touches before 2026 and is almost entirely summer stone: infrastructure arrived late, fast, and mostly settled on the first cut. Its one winter building is the <a href="${tree('tools/typedoc-plugin-lit-ui-router')}">typedoc plugin</a>, whose <code>index.ts</code> was laid ${SYM.first} and is still under the chisel — idle ${dayN(days(SYM.last))}; every sealed file on this map stands in <a href="${tree('examples')}"><code>examples/</code></a>. The shopfront splits in two: <code>docs</code> runs ${DOCS_HOT} multi-file block-average in the city (×${tpf(10)}/f src${MULTI[0] === 10 ? '' : `, under <code>${row(MULTI[0])[1]}</code>'s ×${tpf(MULTI[0])}/f at the top`}) while <code>examples</code> holds the oldest untouched stone — ${NUMW[SEALED_VITE]} vite configs idle ${dayN(days(SOLAR.last))}. And ${NAV_SIZE_TXT} package on the map still runs hot: <a href="${tree('packages/navigation-location-plugin')}"><code>navigation-location-plugin</code></a>'s ${MONTH(NAV_IDX.first)} <code>index.ts</code> has been chiselled ${NAV_IDX.touches} times, and its ${g(4).src[0]}-file block averages ×${tpf(4)}/f, ${NAV_RANK_TXT} on the map — matching its history as the extracted plugin that every routing change touches.</p>
<p><strong>See also — appendix A1, THE SPRITE STUDY.</strong> This map draws age and churn <em>flat</em>, as fills and edges, so the dating stays readable at city scale. The sprited reading of the same two measurements — wreck &amp; ruin ↔ shine &amp; splendor on the building itself — is the research filed as appendix A1, and its recommendation is what sheet 7B draws.</p>
<p><strong>Approximations, so the numbers stay honest.</strong> Dates are author dates (<a href="${GIT_LOG}"><code>%as</code></a>); on this repo's squash-merge convention they equal the merge day of the PR that landed the change. Rename detection is git's <code>-M</code> heuristic: a file moved <em>and</em> rewritten in one commit can read as a fresh birth — the July 2026 <code>scripts/ → tools/</code> graduations are dated to that graduation where git saw no rename, which the yard's notes above already state as its story. Generated and vendored trees were never in the universe (the shared city rules); nothing else was excluded.</p>`,
  key: [
    keyRow(`<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#${P}-w1)"/><rect x="6" y="3" width="36" height="12" class="sk fnone"/>`, `SEASON I stone — born 2025-07, the port · ${SEASON_N[0]} files`),
    keyRow(`<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#${P}-w2)"/><rect x="6" y="3" width="36" height="12" class="sk fnone"/>`, `SEASON II stone — born 2026-01, winter works · ${SEASON_N[1]} files`),
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp"/>', `SEASON III stone — born since ${SEASON_FIRST[2]}, the summer · ${SEASON_N[2]} files`),
    keyRow('<rect x="6" y="3" width="36" height="12" class="skr fnone"/><line x1="10" y1="15" x2="10" y2="17" class="skr"/><line x1="15" y1="15" x2="15" y2="17" class="skr"/><line x1="20" y1="15" x2="20" y2="17" class="skr"/>', `HOT — ≥${HOT} touches/file · red edge + tall ticks`),
    keyRow('<rect x="6" y="3" width="36" height="12" class="skf fnone"/><line x1="10" y1="15" x2="10" y2="16" class="skf"/>', `COLD — <${COLD} touches/file · faint edge, short tick`),
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fnone"/><line x1="10" y1="15" x2="10" y2="17" class="sks"/><line x1="15" y1="15" x2="15" y2="17" class="sks"/>', `MID — ${COLD}–${HOT - 1} touches/file · ink edge, the working stock`),
    keyRow('<rect x="6" y="3" width="36" height="12" class="sks fnone"/><line x1="6" y1="3" x2="42" y2="15" class="sks" stroke-dasharray="3 2"/><line x1="42" y1="3" x2="6" y2="15" class="sks" stroke-dasharray="3 2"/>', `SEALED — contains files idle >${SEAL} days`),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sks fnone"/>', 'spec annex — same strata, own weather'),
    keyRow('<rect x="6" y="3" width="14" height="12" class="fp2"/><rect x="6" y="3" width="14" height="12" class="sks fnone"/><rect x="24" y="6" width="14" height="9" class="fa"/>', 'timeline bars — district touches · all four together'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'district (sheet 7’s)'),
  ].join('\n'),
};

import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, keyRow } from './helpers.mjs';

const P = 's13';

// ---- census: every date and count comes from diagrams/data/census-weather.json ----
// The plate is the checked-in snapshot census-weather.mjs writes: for every file
// in the shared city universe, first-commit date, last-touch date and touch count,
// from ONE `git log --name-status -M` pass walked newest→oldest with rename chains
// followed backwards (equivalent to --follow, batch).  Merge commits list no files
// under the default log, so touches = non-merge commits.  TODAY is the measured
// ref's own commit date, so ages are reproducible rather than wall-clock.
// Geometry (sloc) is read from diagrams/data/census-city.json — sheet 7's plate —
// so the two sheets share footprints by construction.  This file holds placement,
// bands and prose only.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-weather.json', import.meta.url), 'utf8'));
const CITY = JSON.parse(readFileSync(new URL('../data/census-city.json', import.meta.url), 'utf8'));
const BASIS = `counted at ${PLATE.ref} @ ${PLATE.sha}`;
const TODAY = PLATE.today.slice(0, 10);
const days = (d) => Math.round((new Date(PLATE.today) - new Date(d)) / 86400000);

// ---- editorial bands: where the distribution cuts, not round numbers ------------
// The history is not continuous — source files are born in only three campaigns,
// separated by empty months — so age bins by SEASON.  Churn tiers come from the
// per-block touches-per-file gap (still clean between 4.65 and 6.0; the per-file
// median is still 2).  SEALED = idle past the empty stretch in the idle histogram.
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
  if (!r) throw new Error(`sheet 13: member ${dir} is missing from diagrams/data/census-city.json`);
  return r;
};
const file = (path) => {
  const r = FROW.get(path);
  if (!r) throw new Error(`sheet 13: file ${path} is missing from diagrams/data/census-weather.json`);
  return r;
};
// a drawn block: file count, files born per season, total touches
const agg = (rs) => (rs.length
  ? [rs.length, [0, 1, 2].map((s) => rs.filter((r) => season(r.first) === s).length), rs.reduce((a, r) => a + r.touches, 0)]
  : null);
// hottest wall, named short: member prefix and src/ dropped
const shortPath = (p, dir) => (p.startsWith(`${dir}/`) ? p.slice(dir.length + 1) : p).replace(/^src\//, '');

// ---- geometry: sheet 7 rev D's plan footprints, flattened -----------------------
// Same placements, same side = 1.6·√sloc rule, same sloc plate — reused as pure
// geometry so the two sheets reconcile by eye.
const KS = 1.6, MIN = 12, K = 1.6, OX = 46, OY = 110;
const S = (sloc) => Math.max(MIN, KS * Math.sqrt(sloc));
const AG = 10;
const X = (x) => OX + K * x, Y = (y) => OY + K * y;

// [n, name, plate member dir, district, x, y] — every number comes from the plates
const PLACED = [
  [1, 'lit-ui-router', 'packages/lit-ui-router', 'pkg', 0, 20],
  [2, 'ui-router-server', 'packages/ui-router-server', 'pkg', 200, 20],
  [3, 'lit-ui-router-mobx', 'packages/lit-ui-router-mobx', 'pkg', 170, 130],
  [4, 'navigation-location-plugin', 'packages/navigation-location-plugin', 'pkg', 260, 130],
  [5, 'sample-app-shared', 'apps/sample-app-shared', 'app', 570, 10],
  [6, 'sample-app-lit-vanilla', 'apps/sample-app-lit-vanilla', 'app', 720, 10],
  [7, 'sample-app-lit-mobx', 'apps/sample-app-lit-mobx', 'app', 720, 90],
  [8, 'sample-app-routes', 'apps/sample-app-routes', 'app', 700, 150],
  [9, 'sample-app-lit-e2e', 'apps/sample-app-lit-e2e', 'app', 580, 150],
  [10, 'docs', 'docs', 'site', 660, 340],
  [11, 'examples', 'examples', 'site', 660, 430],
  [12, '@tools/release', 'tools/release', 'tool', 20, 430],
  [13, '@tools/typedoc-plugin', 'tools/typedoc-plugin-lit-ui-router', 'tool', 230, 430],
  [14, '@tools/dts-backtest', 'tools/dts-backtest', 'tool', 8, 350],
  [15, '@tools/build_and_test', 'tools/build_and_test', 'tool', 330, 430],
  [16, '@tools/shared', 'tools/shared', 'tool', 20, 550],
  [17, '@tools/workers-builds', 'tools/workers-builds', 'tool', 220, 550],
  [18, '@tools/bundle-probe', 'tools/bundle-probe', 'tool', 330, 550],
  [19, '@tools/compat-guards', 'tools/compat-guards', 'tool', 130, 550],
  [20, '@tools/oxc-emit', 'tools/oxc-emit', 'tool', 230, 350],
  [21, '@tools/release-config', 'tools/release-config', 'tool', 280, 350],
  [22, '@tools/lit-template-lint', 'tools/lit-template-lint', 'tool', 325, 350],
  [23, '@tools/lit-test-env', 'tools/lit-test-env', 'tool', 85, 350],
  [24, '@tools/vue-check', 'tools/vue-check', 'tool', 370, 350],
  [25, '@tools/lcov-rebase', 'tools/lcov-rebase', 'tool', 415, 350],
  [26, '@tools/happy-dom', 'tools/happy-dom', 'tool', 125, 350],
  [27, '@tools/wintercg-globals', 'tools/wintercg-globals', 'tool', 185, 350],
  // --- laid at rev C: the newest stone was cut the day it was surveyed ----------
  [28, '@tools/lint-elements', 'tools/lint-elements', 'tool', 380, 550],
  [29, '@tools/warn-lanes', 'tools/warn-lanes', 'tool', 430, 530],
  [30, '@tools/eslint-ts-parser', 'tools/eslint-ts-parser', 'tool', 54, 350],
  // --- the fifth published package (#676): sheet 7's plan slot lands under the
  //     reading box, so it takes the free third row of the packages district ----
  [31, 'eslint-plugin-lit-ui-router', 'packages/eslint-plugin-lit-ui-router', 'pkg', 30, 130],
];

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

// ---- city-wide roll-ups the prose and the reading box quote ----------------------
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
const HOT_BLOCKS = D.filter((r) => r[7] && tier(r[7][2], r[7][0]) === 'hot').length;
const SEALED_F = PLATE.rows.filter((r) => days(r.last) > SEAL).length;
// the empty band the SEAL threshold sits in: last idle day before it, first after
const IDLE_SORTED = [...new Set(PLATE.rows.map((r) => days(r.last)))].sort((a, b) => a - b);
const IDLE_GAP = [IDLE_SORTED.filter((d) => d < SEAL).at(-1), IDLE_SORTED.find((d) => d > SEAL)];
const distSloc = (d) => D.filter((r) => r[2] === d).reduce((a, r) => a + r[5], 0);
const tpf = (n) => (g(n).src[2] / g(n).src[0]).toFixed(1);
const row = (n) => D.find((r) => r[0] === n);

// ---- the reading box, in the void sheet 7 spent on roads --------------------------
const RB = `
<rect x="620" y="188" width="330" height="332" class="sk fp"/>
${txt(638, 212, 'READING THE WEATHER', 'lbls')}
<line x1="620" y1="222" x2="950" y2="222" class="skf"/>
${txt(638, 244, 'AGE — masonry courses, oldest at the base', 'lbl')}
${[
  [`url(#${P}-w1)`, `SEASON I · THE PORT · 2025-07 · ${SEASON_N[0]}f`],
  [`url(#${P}-w2)`, `SEASON II · WINTER · 2026-01 · ${SEASON_N[1]}f`],
  [null, `SEASON III · SUMMER · ${SEASON_FIRST[2].slice(5)} on · ${SEASON_N[2]}f`],
].map(([fill, label], i) => {
  const y = 256 + i * 24;
  return `<rect x="638" y="${y}" width="30" height="14" class="fp"/>${fill ? `<rect x="638" y="${y}" width="30" height="14" fill="${fill}"/>` : ''}<rect x="638" y="${y}" width="30" height="14" class="sk fnone"/>
${txt(680, y + 11, label, 'lbls')}`;
}).join('\n')}
${txt(638, 350, 'CHURN — ticks: one per touch per file', 'lbl')}
${[
  ['skr', 8, 7, `HOT · ≥${HOT}/file · red edge · ${HOT_BLOCKS} blocks`, 'lblr'],
  ['sks', 6, 3, `MID · ${COLD}–${HOT - 1} · the working stock`, 'lbls'],
  ['skf', 4, 1, `COLD · <${COLD} · touched once, left`, 'lbls'],
].map(([cls, th, nn, label, lcls], i) => {
  const y = 362 + i * 24;
  return Array.from({ length: nn }, (_, j) => `<line x1="${640 + j * 5}" y1="${y}" x2="${640 + j * 5}" y2="${y + th}" class="${cls}"/>`).join('')
    + txt(680, y + 9, label, lcls);
}).join('\n')}
${txt(638, 448, 'THE GRADIENT THE MAP ARGUES', 'lbl')}
${txt(638, 466, 'mean touches per file, by birth season:', 'lbls')}
${txt(638, 482, `I ×${SEASON_TPF[0]} · II ×${SEASON_TPF[1]} · III ×${SEASON_TPF[2]}`, 'lbla')}
${txt(638, 500, 'the older the wall, the more it is chiselled', 'lbls')}`;

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
// ROWH clears the tallest bar plus its value label — no bar climbs into the row above
const TLX = 232, TLW = 82, TLY = 1148, ROWH = 56;
const ROWS = [
  ['all', 'ALL DISTRICTS', 0.075],
  ['pkg', 'packages/', 0.19],
  ['app', 'apps/', 0.19],
  ['site', 'docs+examples', 0.19],
  ['tool', 'tools/', 0.19],
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
${txt(TLX + MONTHS.indexOf('2025-07') * TLW + 8, TLY + 5 * ROWH + 38, 'THE PORT', 'lbla')}
${txt(TLX + MONTHS.indexOf('2026-01') * TLW + 8, TLY + 5 * ROWH + 38, 'WINTER WORKS', 'lbla')}
${txt(TLX + MONTHS.indexOf('2026-07') * TLW + 8, TLY + 5 * ROWH + 38, 'THE SUMMER', 'lbla')}`;

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
const schedule = `<rect x="40" y="${SY}" width="1480" height="${74 + half * 17}" class="sk fp"/>
${txt(58, SY + 22, 'STRUCTURE SCHEDULE — weathering per member · files · first-commit date · files born per season I/II/III · touches (per file) · median days since last touch', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1520" y2="${SY + 32}" class="skf"/>
${D.slice(0, half).map((r, i) => txt(58, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${D.slice(half).map((r, i) => txt(800, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${txt(58, SY + 58 + half * 17, `TOTAL — ${TOT_F} dated files (sheet 7's plate counts the same ${TOT_F}) · ${fmt(TOT_T)} touches · seasons ${SEASON_N.join(' / ')} · TODAY = ${TODAY} · ${BASIS}`, 'lbls')}`;

// ---- callouts --------------------------------------------------------------------
const SREF = file('packages/lit-ui-router/src/ui-sref.ts');
const DCFG = file('docs/.vitepress/config.ts');
const SOLAR = file('examples/hellosolarsystem/vite.config.ts');
const HELLO = file('examples/helloworld/src/main.ts');
const SYM = file('tools/typedoc-plugin-lit-ui-router/src/symbols/index.ts');
const PORT_LUR = (byMember.get('packages/lit-ui-router') ?? []).filter((r) => !r.spec && season(r.first) === 0);
const callouts = `
${txt(60, 456, 'lit-ui-router — THE ORIGINAL MASONRY', 'lbla')}
${txt(60, 470, `${PORT_LUR.length} of ${g(1).src[0]} src walls laid ${SREF.first}, the first day —`, 'lblf')}
${txt(60, 482, `mean ×${(PORT_LUR.reduce((a, r) => a + r.touches, 0) / PORT_LUR.length).toFixed(1)} touches each, and still under the chisel:`, 'lblf')}
${txt(60, 494, `ui-sref.ts ×${SREF.touches}, last touched ${SREF.last}`, 'lblf')}
<line x1="80" y1="446" x2="72" y2="242" class="skf"/>

${txt(1250, 700, `docs/.vitepress/config.ts ×${DCFG.touches}`, 'lblr')}
${txt(1250, 714, 'the most-weathered wall in the city —', 'lblf')}
${txt(1250, 726, `${days(DCFG.first)} days old, repainted ${DCFG.touches} times, idle ${days(DCFG.last)}d`, 'lblf')}
<line x1="1246" y1="710" x2="1188" y2="702" class="skf"/>

${txt(1250, 780, 'examples/ — THE OLDEST UNTOUCHED STONE', 'lbls')}
${txt(1250, 794, `two vite configs sealed ${days(SOLAR.last)} days,`, 'lblf')}
${txt(1250, 806, `helloworld/main.ts sealed ${days(HELLO.last)} — all winter-built`, 'lblf')}
<line x1="1246" y1="790" x2="1178" y2="800" class="skf"/>

${txt(560, 1078, '@tools/typedoc-plugin — SEALED WING', 'lbls')}
${txt(560, 1092, `symbols/ untouched ${days(SYM.last)} days, since ${SYM.last}`, 'lblf')}
<line x1="556" y1="1080" x2="470" y2="1058" class="skf"/>

${txt(60, 1078, `@tools/release — ${filesOf(row(12))} walls, every one summer-built`, 'lbl')}
${txt(60, 1092, 'the yard’s largest building did not exist two months ago', 'lblf')}
<line x1="130" y1="1064" x2="146" y2="1044" class="skf"/>

${txt(196, 265, `navigation-location-plugin — ×${tpf(4)}/f`, 'lblr')}
${txt(196, 279, 'one January wall, chiselled ten times:', 'lblf')}
${txt(196, 291, 'the highest churn intensity on the map', 'lblf')}
<line x1="428" y1="294" x2="456" y2="314" class="skf"/>`;

// ---- assemble --------------------------------------------------------------------
const H = SY + 104 + half * 17;
const svg = `<svg viewBox="0 0 1560 ${H}" role="img" aria-label="A flat plan-view weathering map of the lit-ui-router workspace: the same city as sheet 7, same four dashed districts and same footprints, but every building is now coloured by when its files were first committed and edged by how often they are touched. Each footprint is striped like masonry courses, oldest at the base: dense ink hatch for Season One, the July 2025 port; accent hatch for Season Two, the January 2026 winter works; plain paper for Season Three, the summer campaign that built ${SEASON_N[2]} of the ${TOT_F} files since July fourth. Under each building a tick gauge counts touches per file; ${HOT_BLOCKS} buildings carry red hot edges at six or more touches per file, and buildings touched less than twice are drawn faint. Dashed crosses seal the typedoc plugin and three example slabs, untouched for over two hundred days. A ${MONTHS.length}-month timeline below shows all activity concentrated in ${ALIVE} months separated by silence, and a structure schedule dates every member. The reading box states the verdict: mean touches per file falls from ${SEASON_TPF[0]} for the port cohort to ${SEASON_TPF[2]} for the summer cohort — the oldest walls are the most chiselled.">
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

${txt(1520, 34, 'DATING — first-commit and last-touch per file from one pass over the history behind the measured ref, renames followed', 'lbls', 'end')}
${txt(1520, 48, `footprints reused from sheet 7's plate as pure geometry (side = 1.6·√sloc) · TODAY = ${TODAY} · ${BASIS}`, 'lblf', 'end')}
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
  num: 13, id: 'weathering', rev: 'D',
  title: 'THE WEATHERING MAP',
  sub: `ALTITUDE t — the same city as sheet 7, surveyed in time · ${TOT_F} files dated from the whole history · three construction seasons, ${MONTHS.length - ALIVE} silent months · REV B: drafting pass — the timeline rows now clear their own tallest bar, and no badge sits on a caption · REV C: re-dated off the plate at TODAY = ${TODAY}, with the fifth published package in the universe; every date and count is now imported from diagrams/data/census-weather.json · REV D: whole-cabinet refresh — ${TOT_F} dated files, every band re-tested and held — ${BASIS}`,
  scale: 'WORKSPACE × TIME',
  form: 'WEATHERING MAP',
  svg,
  caption: `Every sheet so far has drawn the city as it stands; this one dates the stone. Same districts, same footprints as sheet 7 — but the fills now say when each file was first committed and the edges say how often it is touched. The history turns out to be three construction campaigns separated by silent months, and the two encodings disagree on purpose: ${Math.round((SEASON_N[2] / TOT_F) * 100)}% of the city is summer-built and barely weathered, while the port’s original masonry — ${SEASON_N[0]} files from July 2025 — carries the hottest edges on the map.`,
  notes: `
<p><strong>Method — one pass, renames followed.</strong> Every date on this sheet is read at build time from the checked-in plate <code>diagrams/data/census-weather.json</code>, ${BASIS}. Each file in the shared city universe was dated from a single <code>git log --name-status -M</code> pass over the history behind that ref, walked newest to oldest with rename chains followed backwards — equivalent to per-file <code>--follow</code> (spot-verified against it, including <code>tools/shared/workspace.ts</code>, which the plain path log mis-dates by a week) but one process instead of ${TOT_F}. Per file: first-commit date, last-touch date, touch count. Merge commits list no files under the default log, so a touch is a non-merge commit — the standard convention. <code>TODAY</code> is not a wall-clock date: it is the measured ref's own commit date, ${TODAY}, so every age and idle figure below is reproducible from the sha rather than from the day the sheet was drawn. Footprints come from sheet 7's plate, <code>diagrams/data/census-city.json</code>, reused as pure geometry so the two sheets reconcile by eye — and by count: ${TOT_F} dated files here against the same ${TOT_F} there.</p>
<p><strong>The bands are campaigns, not round numbers.</strong> The age histogram is not a slope, it is three spikes: files born around day ${days('2025-07-21')} (July 2025), around day ${days('2026-01-11')} (January 2026), and within the last ${days(SEASON_FIRST[2])} days — with <em>nothing</em> between them, because the repo has source births or touches in only ${ALIVE} of its ${MONTHS.length} calendar months. So the map bins by season, where the distribution actually cuts: SEASON I, the port — ${SEASON_N[0]} files that arrived 2025-07-21 with the upstream sample-app lineage; SEASON II, the winter works — ${SEASON_N[1]} files including the typedoc plugin and the examples; SEASON III, the summer — ${SEASON_N[2]} files, ${Math.round((SEASON_N[2] / TOT_F) * 100)}% of the city, none older than ${SEASON_FIRST[2]}. Churn tiers come from the per-block distribution the same way: touches-per-file still has a clean gap between 4.65 and 6.0, so HOT is ≥${HOT}; the per-file median is still 2, so COLD is below it. SEALED is idle &gt;${SEAL} days — the idle histogram is empty from ${IDLE_GAP[0]} to ${IDLE_GAP[1]}, and exactly the same ${SEALED_F} files sit beyond the gap.</p>
<p><strong>The verdict: age and churn run opposite ways.</strong> Mean touches per file falls monotonically with youth — ×${SEASON_TPF[0]} for the port cohort, ×${SEASON_TPF[1]} for winter, ×${SEASON_TPF[2]} for summer — and ${ONCE} of ${TOT_F} files (${Math.round((ONCE / TOT_F) * 100)}%) have been touched exactly once, ever. The port's masonry is not museum stone: ${SREF.path.split('/').pop()} is at ×${SREF.touches} with the last chisel-mark dated ${SREF.last}, and the two most-weathered walls in the city are the port-era <code>docs/.vitepress</code> pair — <code>config.ts</code> at ×${DCFG.touches} and <code>vite.config.ts</code> at ×${file('docs/.vitepress/vite.config.ts').touches}. What survives from the first day is precisely what keeps being worked.</p>
<p><strong>What each district's weather says.</strong> The instrument yard — ${fmt(distSloc('tool'))} sloc, the city's largest district by mass — logged <em>zero</em> touches before 2026 and is almost entirely summer stone: infrastructure arrived late, fast, and mostly settled on the first cut. Its one winter building is also the map's sealed wing: the typedoc plugin's <code>symbols/</code> trio, untouched ${days(SYM.last)} days. The shopfront splits in two: <code>docs</code> runs the hottest multi-file block-average in the city (×${tpf(10)}/f src) while <code>examples</code> holds the oldest untouched stone — two vite configs idle ${days(SOLAR.last)} days. And the smallest building on the map has the sharpest weather: <code>navigation-location-plugin</code>'s single January wall has been chiselled ${g(4).src[2]} times, the highest per-file churn anywhere — matching its history as the extracted plugin that every routing change touches.</p>
<p><strong>REV C — the numbers by import, and a fifth package on the map.</strong> The sheet no longer carries a hand-pasted census: every per-file date, touch count, member roll-up and monthly bar is read from <code>census-weather.json</code>, and a member the drawing places but the plate does not carry is a build error rather than a stale constant. Re-dating at the plate's ref moves two things at once. The <em>clock</em>: <code>TODAY</code> is ${TODAY} rather than the working-tree date the old constants were counted at, so every idle figure is larger for reasons that are calendar, not neglect. The <em>city</em>: 286 dated files rather than 272, with <code>packages/eslint-plugin-lit-ui-router</code> (#676) drawn for the first time — ${filesOf(row(31))} files, none older than ${Math.max(...(byMember.get('packages/eslint-plugin-lit-ui-router') ?? []).map((r) => days(r.first)))} days, the youngest stone on the map. Sheet 7 gives it the plan slot 350,170; in this flat projection that lands underneath the reading box, so it takes the free third row of the packages district instead, beside №3 and №4. The <em>bands</em> survived the recount intact.</p>
<p><strong>REV D — the whole cabinet at one ref, and the bands hold a third time.</strong> Every plate in <code>diagrams/data/</code> was re-counted at ${PLATE.ref} @ ${PLATE.sha} in one pass. <code>TODAY</code> advanced under a day, so nothing on this map aged by more than one, and the city gained ${TOT_F - 286} walls net — ${filesOf(row(16)) - 15} new in <code>@tools/shared</code> and ${filesOf(row(31)) - 6} in the lint plugin, where #693 and #689 built, against three <code>@tools/release</code> walls that came down. All the new stone is summer stone. Season III is now ${SEASON_N[2]} files, ${Math.round((SEASON_N[2] / TOT_F) * 100)}% of the city. Every editorial cut this plate makes was re-tested against the new distribution rather than assumed: the per-block touches-per-file gap is still clean between 4.65 and 6.0, so HOT stays ≥${HOT}; the per-file median is still ${COLD}, so COLD stays below it; ${HOT_BLOCKS} source blocks run hot and the same ${SEALED_F} files sit beyond the ${SEAL}-day seal. One number in the prose did move with the clock and is now derived rather than typed — the empty stretch the seal sits in reads ${IDLE_GAP[0]} to ${IDLE_GAP[1]} at this ref, where rev C printed 61 to 227.</p>
<p><strong>Approximations, so the numbers stay honest.</strong> Dates are author dates (<code>%as</code>); on this repo's squash-merge convention they equal the merge day of the PR that landed the change. Rename detection is git's <code>-M</code> heuristic: a file moved <em>and</em> rewritten in one commit can read as a fresh birth — the July 2026 <code>scripts/ → tools/</code> graduations are dated to that graduation where git saw no rename, which the yard's notes above already state as its story. Generated and vendored trees were never in the universe (the shared city rules); nothing else was excluded.</p>`,
  key: [
    keyRow(`<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#${P}-w1)"/><rect x="6" y="3" width="36" height="12" class="sk fnone"/>`, 'SEASON I stone — born 2025-07, the port'),
    keyRow(`<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#${P}-w2)"/><rect x="6" y="3" width="36" height="12" class="sk fnone"/>`, 'SEASON II stone — born 2026-01, winter works'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="sk fp"/>', `SEASON III stone — born since ${SEASON_FIRST[2]}`),
    keyRow('<rect x="6" y="3" width="36" height="12" class="skr fnone"/><line x1="10" y1="15" x2="10" y2="17" class="skr"/><line x1="15" y1="15" x2="15" y2="17" class="skr"/><line x1="20" y1="15" x2="20" y2="17" class="skr"/>', `HOT — ≥${HOT} touches/file · red edge + tall ticks`),
    keyRow('<rect x="6" y="3" width="36" height="12" class="skf fnone"/><line x1="10" y1="15" x2="10" y2="16" class="skf"/>', `COLD — <${COLD} touches/file · faint edge, short tick`),
    keyRow('<rect x="6" y="3" width="36" height="12" class="sks fnone"/><line x1="6" y1="3" x2="42" y2="15" class="sks" stroke-dasharray="3 2"/><line x1="42" y1="3" x2="6" y2="15" class="sks" stroke-dasharray="3 2"/>', `SEALED — contains files idle >${SEAL} days`),
    keyRow('<rect x="8" y="3" width="18" height="12" class="sks fnone"/>', 'spec annex — same strata, own weather'),
    keyRow('<rect x="6" y="3" width="14" height="12" class="fp2"/><rect x="6" y="3" width="14" height="12" class="sks fnone"/><rect x="24" y="6" width="14" height="9" class="fa"/>', 'timeline bars — district touches · all four together'),
    keyRow('<rect x="4" y="2" width="26" height="13" class="skf fnone" stroke-dasharray="4 3"/>', 'district (sheet 7’s)'),
  ].join('\n'),
};

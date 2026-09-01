// Sheet 13 census: file age × churn from git history.
// Universe: same member/dir structure + file rules as census-city.mjs (sheet 7),
// so this sheet reconciles with the measured city. SRC + SPEC series merged here
// unless split is asked for — we keep the split for per-member stats.
//
// Method: ONE `git log --name-status -M --format=@%H|%as` pass over full history,
// walked newest -> oldest. Each current tracked file carries an alias that follows
// R (rename) records backwards, so first-commit dates survive renames exactly
// (equivalent to --follow, but batch). Merge commits list no files under the
// default log (no -m), so churn = non-merge commits touching the file — the
// standard convention.
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXT = /\.(tsx?|jsx?|mjs)$/;
const SKIP_FILE = (f) => /\.d\.ts$/.test(f) || /\.test-d\.ts$/.test(f);
const SKIP_DIR = (d) => ['node_modules', 'dist', 'fixtures', '.wrangler', 'cache', '.turbo', 'coverage'].includes(d);
const IS_SPEC = (rel) =>
  /\.(spec|test|cy)\./.test(basename(rel)) || /(^|\/)(specs|test|tests|__tests__|cypress)(\/)/.test(rel);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIR(e.name)) walk(join(dir, e.name), out); }
    else if (EXT.test(e.name) && !SKIP_FILE(e.name)) out.push(join(dir, e.name));
  }
  return out;
}

const MEMBERS = [
  ['packages/lit-ui-router', ['src'], 'pkg'],
  ['packages/lit-ui-router-mobx', ['src'], 'pkg'],
  ['packages/navigation-location-plugin', ['src'], 'pkg'],
  ['packages/ui-router-server', ['src', 'test'], 'pkg'],
  ['apps/sample-app-shared', ['src'], 'app'],
  ['apps/sample-app-lit-vanilla', ['src'], 'app'],
  ['apps/sample-app-lit-mobx', ['src'], 'app'],
  ['apps/sample-app-routes', ['src', 'test'], 'app'],
  ['apps/sample-app-lit-e2e', ['src', 'cypress'], 'app'],
  ['docs', ['.vitepress', 'worker', 'src'], 'site'],
  ['examples', ['.'], 'site'],
  ['tools/release', ['src'], 'tool'],
  ['tools/typedoc-plugin-lit-ui-router', ['src'], 'tool'],
  ['tools/dts-backtest', ['.'], 'tool'],
  ['tools/build_and_test', ['src'], 'tool'],
  ['tools/shared', ['src'], 'tool'],
  ['tools/workers-builds', ['.'], 'tool'],
  ['tools/bundle-probe', ['src'], 'tool'],
  ['tools/compat-guards', ['src'], 'tool'],
  ['tools/oxc-emit', ['src'], 'tool'],
  ['tools/release-config', ['src'], 'tool'],
  ['tools/lit-template-lint', ['src'], 'tool'],
  ['tools/lit-test-env', ['src'], 'tool'],
  ['tools/vue-check', ['.'], 'tool'],
  ['tools/lcov-rebase', ['src'], 'tool'],
  ['tools/happy-dom', ['src'], 'tool'],
  ['tools/wintercg-globals', ['src'], 'tool'],
];

// current tracked universe, tagged with member + series
const fileMeta = new Map(); // repo-rel path -> { member, district, spec }
for (const [m, dirs, district] of MEMBERS) {
  for (const abs of dirs.flatMap((d) => walk(ROOT + m + (d === '.' ? '' : '/' + d)))) {
    const rel = relative(ROOT, abs);
    if (!fileMeta.has(rel)) fileMeta.set(rel, { member: m, district, spec: IS_SPEC(relative(m, rel)) });
  }
}
// confirm all are tracked
const tracked = new Set(execFileSync('git', ['-C', ROOT, 'ls-files'], { maxBuffer: 1 << 26 }).toString().split('\n'));
const untracked = [...fileMeta.keys()].filter((f) => !tracked.has(f));
if (untracked.length) {
  console.error('UNTRACKED (excluded):', untracked);
  untracked.forEach((f) => fileMeta.delete(f));
}

// one history pass
const log = execFileSync('git', ['-C', ROOT, 'log', '-M', '--name-status', '--format=@%H|%as'], { maxBuffer: 1 << 28 }).toString();
const alias = new Map([...fileMeta.keys()].map((f) => [f, f])); // historical name -> current name
const stat = new Map([...fileMeta.keys()].map((f) => [f, { touches: 0, first: null, last: null, dates: [] }]));
let date = null;
for (const line of log.split('\n')) {
  if (line.startsWith('@')) { date = line.slice(line.indexOf('|') + 1); continue; }
  if (!line) continue;
  const parts = line.split('\t');
  const code = parts[0];
  let touchedCur = null;
  if (code.startsWith('R') || code.startsWith('C')) {
    const [old, nw] = [parts[1], parts[2]];
    const cur = alias.get(nw);
    if (cur) {
      touchedCur = cur;
      if (code.startsWith('R')) { alias.delete(nw); alias.set(old, cur); }
    }
  } else {
    const cur = alias.get(parts[1]);
    if (cur) touchedCur = cur;
  }
  if (touchedCur) {
    const s = stat.get(touchedCur);
    s.touches++;
    if (!s.last) s.last = date; // newest-first: first seen = last touch
    s.first = date;             // keeps updating; final value = oldest
    s.dates.push(date);
  }
}

const TODAY = new Date('2026-08-17');
const days = (d) => Math.round((TODAY - new Date(d)) / 86400000);
const rows = [...stat.entries()].map(([f, s]) => ({
  f, ...fileMeta.get(f), touches: s.touches, first: s.first, last: s.last,
  age: days(s.first), idle: days(s.last),
}));
const missing = rows.filter((r) => !r.first);
if (missing.length) console.error('NO HISTORY FOUND:', missing.map((r) => r.f));

// --- distributions, for threshold picking -------------------------------------
const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
const hist = (vals, edges, label) => {
  const bins = edges.map(() => 0);
  for (const v of vals) { let i = edges.findIndex((e) => v <= e); if (i < 0) i = edges.length - 1; bins[i]++; }
  console.log(label, edges.map((e, i) => `<=${e}:${bins[i]}`).join(' '));
};
console.log('files:', rows.length);
hist(rows.map((r) => r.age), [30, 60, 90, 120, 180, 240, 300, 360, 420], 'AGE d');
hist(rows.map((r) => r.idle), [7, 14, 30, 60, 90, 120, 180, 240, 300, 400], 'IDLE d');
hist(rows.map((r) => r.touches), [1, 2, 3, 5, 8, 12, 20, 40], 'TOUCH');
console.log('age quartiles', [0.25, 0.5, 0.75].map((p) => q(rows.map((r) => r.age), p)));
console.log('idle quartiles', [0.25, 0.5, 0.75].map((p) => q(rows.map((r) => r.idle), p)));
console.log('touch quartiles', [0.25, 0.5, 0.75].map((p) => q(rows.map((r) => r.touches), p)));

// --- per member ----------------------------------------------------------------
console.log('\nmember  files  medAge  medIdle  touches  t/f  oldest..newest  maxIdleFile  hottest');
const memRows = [];
for (const [m] of MEMBERS) {
  const rs = rows.filter((r) => r.member === m);
  if (!rs.length) { console.log(m, '— no files'); memRows.push([m, 0]); continue; }
  const t = rs.reduce((a, r) => a + r.touches, 0);
  const medAge = q(rs.map((r) => r.age), 0.5), medIdle = q(rs.map((r) => r.idle), 0.5);
  const oldest = rs.reduce((a, r) => (r.age > a.age ? r : a));
  const newest = rs.reduce((a, r) => (r.age < a.age ? r : a));
  const idlest = rs.reduce((a, r) => (r.idle > a.idle ? r : a));
  const hot = rs.reduce((a, r) => (r.touches > a.touches ? r : a));
  memRows.push([m, rs.length, medAge, medIdle, t, +(t / rs.length).toFixed(1),
    oldest.first, newest.first, idlest.f, idlest.idle, hot.f, hot.touches]);
  console.log(m.padEnd(36), String(rs.length).padStart(3), String(medAge).padStart(5), String(medIdle).padStart(6),
    String(t).padStart(5), (t / rs.length).toFixed(1).padStart(5),
    ` ${oldest.first}..${newest.first}`, ` idle:${basename(idlest.f)}=${idlest.idle}d`, ` hot:${basename(hot.f)}×${hot.touches}`);
}
console.log('\nJSON_MEMBERS'); console.log(JSON.stringify(memRows));

// per-district monthly touch counts (timeline strip)
const months = {};
for (const r of rows) for (const d of stat.get(r.f).dates) {
  const mo = d.slice(0, 7); (months[mo] ??= { pkg: 0, app: 0, site: 0, tool: 0 })[r.district]++;
}
console.log('\nJSON_MONTHS'); console.log(JSON.stringify(months));

// extremes list
const sortBy = (k, dir = 1) => [...rows].sort((a, b) => dir * (b[k] - a[k])).slice(0, 8)
  .map((r) => `${r.f} age=${r.age} idle=${r.idle} ×${r.touches}`);
console.log('\nOLDEST:', sortBy('age')); console.log('\nMOST IDLE:', sortBy('idle'));
console.log('\nHOTTEST:', sortBy('touches')); console.log('\nNEWEST:', sortBy('age', -1));
console.log('\nJSON_FILES'); console.log(JSON.stringify(rows.map((r) => [r.f, r.member, r.spec ? 1 : 0, r.first, r.last, r.touches])));

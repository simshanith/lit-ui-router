// Sheet 13 census, ported onto the pipeline (INITIATIVES.md I3): file age ×
// churn from git history.  Universe = the shared CITY UNIVERSE (census-query
// rules), so this sheet reconciles with the measured city by construction.
// TODAY = the ref's commit date — never a hard-coded date, so re-running ages
// files against the measured sha, reproducibly, on any ref.
//
// Method: the shared historyLog() read (one `git log <sha> --name-status -M`
// pass), walked newest -> oldest.  Each universe file carries an alias that
// follows R (rename) records backwards, so first-commit dates survive renames
// exactly (equivalent to --follow, but batch).  Merge commits list no files
// under the default log (no -m), so churn = non-merge commits touching the
// file — the standard convention.
import { basename } from 'node:path';
import { historyLog } from './basis.mjs';
import { cityUniverse, loadCensus, provenance, writeData } from './census-query.mjs';

const snap = loadCensus();
const { members, files } = cityUniverse(snap);
const fileMeta = new Map(files.map((f) => [f.path, f]));

const log = historyLog(snap.sha);
const alias = new Map([...fileMeta.keys()].map((f) => [f, f])); // historical name -> current name
const stat = new Map([...fileMeta.keys()].map((f) => [f, { touches: 0, first: null, last: null, dates: [] }]));
for (const c of log)
  for (const f of c.files) {
    let touchedCur = null;
    if (f.to !== undefined) {
      const cur = alias.get(f.to);
      if (cur) {
        touchedCur = cur;
        if (f.code.startsWith('R')) { alias.delete(f.to); alias.set(f.path, cur); }
      }
    } else {
      touchedCur = alias.get(f.path) ?? null;
    }
    if (touchedCur) {
      const s = stat.get(touchedCur);
      s.touches++;
      if (!s.last) s.last = c.date; // newest-first: first seen = last touch
      s.first = c.date;             // keeps updating; final value = oldest
      s.dates.push(c.date);
    }
  }

const TODAY = new Date(snap.commitDate);
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
console.log(`TODAY = ${snap.commitDate} (ref ${snap.ref} @ ${snap.sha})`);
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
for (const m of members) {
  const rs = rows.filter((r) => r.member === m.dir);
  if (!rs.length) { console.log(m.dir, '— no files'); memRows.push([m.dir, 0]); continue; }
  const t = rs.reduce((a, r) => a + r.touches, 0);
  const medAge = q(rs.map((r) => r.age), 0.5), medIdle = q(rs.map((r) => r.idle), 0.5);
  const oldest = rs.reduce((a, r) => (r.age > a.age ? r : a));
  const newest = rs.reduce((a, r) => (r.age < a.age ? r : a));
  const idlest = rs.reduce((a, r) => (r.idle > a.idle ? r : a));
  const hot = rs.reduce((a, r) => (r.touches > a.touches ? r : a));
  memRows.push([m.dir, rs.length, medAge, medIdle, t, +(t / rs.length).toFixed(1),
    oldest.first, newest.first, idlest.f, idlest.idle, hot.f, hot.touches]);
  console.log(m.dir.padEnd(36), String(rs.length).padStart(3), String(medAge).padStart(5), String(medIdle).padStart(6),
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

writeData('census-weather.json', {
  ...provenance(snap, 'diagrams/generator/census-weather.mjs', ['git log (historyLog)']),
  today: snap.commitDate,
  members: memRows.map(([member, count, medAge, medIdle, touches, perFile, oldestFirst, newestFirst, idlestFile, idlestDays, hotFile, hotTouches]) =>
    ({ member, files: count, medAge, medIdle, touches, perFile, oldestFirst, newestFirst, idlestFile, idlestDays, hotFile, hotTouches })),
  months,
  rows: rows.map((r) => ({ path: r.f, member: r.member, spec: r.spec, first: r.first, last: r.last, touches: r.touches })),
}, ['members', 'rows']);

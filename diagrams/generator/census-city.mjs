// Sheet 7 census, ported onto the pipeline (INITIATIVES.md I2): a QUERY over
// the master per-file snapshot — no measuring here.  Members come from the
// snapshot's workspace-derived list (never a frozen array); which dirs hold a
// member's authored source stays editorial below, default src/ (falling back
// to the member root when it has none).  A member the dir rules yield zero
// files for is printed LOUDLY, not silently dropped.
// Counted: authored .ts/.tsx/.js/.jsx/.mjs, excluding *.d.ts, *.test-d.ts and
// generated/vendored/output dirs.  sloc = scc `Code` from the snapshot.
// Sheet 7 SHOWS test code, so files split into two series:
//   SRC  — everything else
//   SPEC — *.{spec,test,cy}.*, and anything under specs/ test/ tests/ __tests__/ cypress/
import { basename } from 'node:path';
import { loadCensus, provenance, writeData } from './census-query.mjs';

const snap = loadCensus();
const EXT = /\.(tsx?|jsx?|mjs)$/;
const SKIP_FILE = (f) => /\.d\.ts$/.test(f) || /\.test-d\.ts$/.test(f);
const SKIP_SEG = new Set(['node_modules', 'dist', 'fixtures', '.wrangler', 'cache', '.turbo', 'coverage']);
const IS_SPEC = (rel) =>
  /\.(spec|test|cy)\./.test(basename(rel)) || /(^|\/)(specs|test|tests|__tests__|cypress)(\/)/.test(rel);

// Editorial: dirs that hold authored source, when not just src/ (or the root).
const DIRS = new Map([
  ['packages/ui-router-server', ['src', 'test']],
  ['packages/eslint-plugin-lit-ui-router', ['src', 'test']],
  ['apps/sample-app-routes', ['src', 'test']],
  ['apps/sample-app-lit-e2e', ['src', 'cypress']],
  ['docs', ['.vitepress', 'worker', 'src']],
]);
const RANK = ['packages/', 'apps/', 'docs', 'examples', 'tools/'];
const members = [...snap.members].sort((a, b) => {
  const r = RANK.findIndex((p) => a.dir.startsWith(p)) - RANK.findIndex((p) => b.dir.startsWith(p));
  return r || (a.dir < b.dir ? -1 : 1);
});

const rows = [];
for (const m of members) {
  const hasSrc = snap.rows.some((r) => r.path.startsWith(`${m.dir}/src/`));
  const dirs = DIRS.get(m.dir) ?? (hasSrc ? ['src'] : ['.']);
  const prefixes = dirs.map((d) => (d === '.' ? `${m.dir}/` : `${m.dir}/${d}/`));
  const files = snap.rows.filter((r) => {
    if (!prefixes.some((p) => r.path.startsWith(p))) return false;
    const rel = r.path.slice(m.dir.length + 1);
    if (!EXT.test(rel) || SKIP_FILE(basename(rel))) return false;
    return !rel.split('/').slice(0, -1).some((seg) => SKIP_SEG.has(seg));
  });
  const acc = { src: [0, 0], spec: [0, 0] };
  for (const f of files) {
    const k = IS_SPEC(f.path.slice(m.dir.length + 1)) ? 'spec' : 'src';
    acc[k][0]++; acc[k][1] += f.code;
  }
  if (!files.length) console.log('!! ZERO FILES for member', m.dir, '— check the dir rules');
  rows.push([m.dir, ...acc.src, ...acc.spec]);
  console.log(m.dir.padEnd(38), String(acc.src[0]).padStart(3), String(acc.src[1]).padStart(6),
    ' | spec', String(acc.spec[0]).padStart(3), String(acc.spec[1]).padStart(6));
}
const t = (i) => rows.reduce((a, r) => a + r[i], 0);
console.log('TOTAL', rows.length, 'members ·', t(1), 'src files', t(2), 'src sloc ·', t(3), 'spec files', t(4), 'spec sloc');
console.log(JSON.stringify(rows));

writeData('census-city.json', {
  ...provenance(snap, 'diagrams/generator/census-city.mjs'),
  rows: rows.map(([member, srcFiles, srcSloc, specFiles, specSloc]) =>
    ({ member, srcFiles, srcSloc, specFiles, specSloc })),
});

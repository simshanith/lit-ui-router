// Sheet 3 census, ported onto the pipeline (INITIATIVES.md I2): a QUERY over
// the master per-file snapshot.  The pool is derived from the snapshot's
// workspace-derived members — packages/apps/tools, src/ when a member has one,
// the member root otherwise; docs and examples stay out of the yard.  The
// INSTRUMENT groupings below are editorial pattern rules (first match wins);
// files no rule claims are printed LOUDLY as orphans.
// Counted: authored .ts/.tsx/.js/.jsx/.mjs excluding *.d.ts, *.test-d.ts,
// *.{spec,test}.*, typedoc stubs, and test/generated dirs.
// sloc = scc `Code` from the snapshot.
import { basename } from 'node:path';
import { loadCensus, provenance, writeData } from './census-query.mjs';

const snap = loadCensus();
const EXT = /\.(tsx?|jsx?|mjs)$/;
const SKIP_FILE = (f) =>
  /\.d\.ts$/.test(f) || /\.test-d\.ts$/.test(f) || /\.(spec|test)\./.test(f) || /\.typedoc\./.test(f);
const SKIP_SEG = new Set(['specs', 'test', 'tests', '__tests__', '__test__', 'node_modules', 'dist', 'fixtures', '.wrangler', '.vitepress']);

const POOL = snap.members
  .filter((m) => /^(packages|apps|tools)\//.test(m.dir))
  .flatMap((m) => {
    const base = snap.rows.some((r) => r.path.startsWith(`${m.dir}/src/`)) ? `${m.dir}/src/` : `${m.dir}/`;
    return snap.rows.filter((r) => {
      if (!r.path.startsWith(base)) return false;
      const rel = r.path.slice(m.dir.length + 1);
      if (!EXT.test(rel) || SKIP_FILE(basename(rel))) return false;
      return !rel.split('/').slice(0, -1).some((seg) => SKIP_SEG.has(seg));
    });
  });

// instrument -> ordered match rules (first match wins, so order matters)
const INSTRUMENTS = [
  ['src (5 published packages)', [/^packages\//]],
  ['build — @tools/oxc-emit', [/^tools\/oxc-emit\//]],
  ['pack — packPublishTarball', [/^tools\/release\/src\/checks\/(check-pack|check-packed-manifest|tarball|cache-paths)/, /^tools\/release\/src\/steps\/(pack-all|pack-staged|release-pack)/]],
  ['published-diff', [/^tools\/release\/src\/checks\/(check-published-diff|published-versions|resolve-published)/]],
  ['check:exports', [/^tools\/release\/src\/checks\/check-exports/]],
  ['peer-floor tier-1', [/^tools\/release\/src\/checks\/peer-floor-check-runs/]],
  ['peer-floor tier-2', [/^tools\/release\/src\/steps\/release-peer-floor-gate/, /^tools\/compat-guards\/src\/peer-floor-guard/]],
  ['docs deploy watch', [/^tools\/release\/src\/checks\/workers-builds-check-runs/, /^tools\/workers-builds\//]],
  ['publish — release-it', [/^tools\/release\//, /^tools\/release-config\//]],
  ['compat-guards', [/^tools\/compat-guards\//]],
  ['dts-backtest', [/^tools\/dts-backtest\//]],
  ['tests — vitest harness', [/^tools\/lit-test-env\//, /^tools\/happy-dom\//, /^tools\/wintercg-globals\//]],
  ['lint & probe fleet', [/^tools\/lit-template-lint\//, /^tools\/lint-elements\//, /^tools\/warn-lanes\//, /^tools\/eslint-ts-parser\//, /^tools\/embed-heights\//, /^tools\/bundle-probe\//, /^tools\/vue-check\//, /^tools\/lcov-rebase\//, /^tools\/build_and_test\//]],
  ['@tools/shared', [/^tools\/shared\//]],
  ['typedoc plugin', [/^tools\/typedoc-plugin/]],
  ['e2e — cypress', [/^apps\/sample-app-lit-e2e\//]],
  ['sample apps', [/^apps\//]],
];

const acc = new Map(INSTRUMENTS.map(([n]) => [n, { files: 0, sloc: 0 }]));
const orphans = [];
for (const f of POOL) {
  const hit = INSTRUMENTS.find(([, rules]) => rules.some((r) => r.test(f.path)));
  if (!hit) { orphans.push(f.path); continue; }
  const a = acc.get(hit[0]);
  a.files++;
  a.sloc += f.code;
}

const rows = [];
for (const [n] of INSTRUMENTS) {
  const a = acc.get(n);
  rows.push([n, a.files, a.sloc]);
  console.log(n.padEnd(30), String(a.files).padStart(4), String(a.sloc).padStart(7));
}
console.log('orphans', orphans.length, orphans.join(' '));
console.log('TOTAL', rows.reduce((a, r) => a + r[1], 0), 'files', rows.reduce((a, r) => a + r[2], 0), 'sloc');
console.log(JSON.stringify(rows));

writeData('census-yard.json', {
  ...provenance(snap, 'diagrams/generator/census-yard.mjs'),
  orphans,
  rows: rows.map(([instrument, files, sloc]) => ({ instrument, files, sloc })),
}, ['orphans', 'rows']);

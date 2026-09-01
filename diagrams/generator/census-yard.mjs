// Sheet 3 rev B census: authored source per YARD INSTRUMENT, this repo at HEAD.
// Basis matches tmp/family-src/measure.mjs, extended to tools/* and apps/*:
// counted .ts/.tsx/.js/.jsx/.mjs under each member's source dir, excluding *.d.ts,
// *.test-d.ts, *.{spec,test}.*, specs/ __tests__/ fixtures/ dist/ node_modules/.
// sloc = scc 4.0.0 `Code` lines (string-aware: template-literal interiors count as code).
// @tools/release hosts several instruments, so it is attributed by module prefix.
import { readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXT = /\.(tsx?|jsx?|mjs)$/;
const SKIP_FILE = (f) =>
  /\.d\.ts$/.test(f) || /\.test-d\.ts$/.test(f) || /\.(spec|test)\./.test(f) || /\.typedoc\./.test(f);
const SKIP_DIR = (d) =>
  ['specs', 'test', 'tests', '__tests__', '__test__', 'node_modules', 'dist', 'fixtures', '.wrangler', '.vitepress'].includes(d);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIR(e.name)) walk(join(dir, e.name), out); }
    else if (EXT.test(e.name) && !SKIP_FILE(e.name)) out.push(join(dir, e.name));
  }
  return out;
}

// Batch scc over absolute paths; Location echoes each path verbatim.
// Provision: `mise x aqua:boyter/scc@4.0.0` (bare `scc` is not an aqua name).
function sccSloc(files) {
  const out = execFileSync('mise',
    ['x', 'aqua:boyter/scc@4.0.0', '--', 'scc', '--by-file', '--format', 'json', ...files],
    { maxBuffer: 1 << 26 });
  const map = new Map();
  for (const lang of JSON.parse(out)) for (const f of lang.Files) map.set(f.Location, f.Code);
  return map;
}

// every authored file in the members this sheet draws
const POOL = [
  'packages/lit-ui-router/src', 'packages/lit-ui-router-mobx/src',
  'packages/navigation-location-plugin/src', 'packages/ui-router-server/src',
  'tools/build_and_test/src', 'tools/bundle-probe/src', 'tools/compat-guards/src',
  'tools/dts-backtest', 'tools/happy-dom/src', 'tools/lcov-rebase/src',
  'tools/lit-template-lint/src', 'tools/lit-test-env/src', 'tools/oxc-emit/src',
  'tools/release/src', 'tools/release-config/src', 'tools/shared/src',
  'tools/typedoc-plugin-lit-ui-router/src', 'tools/vue-check', 'tools/wintercg-globals/src',
  'tools/lint-elements/src', 'tools/warn-lanes/src', 'tools/eslint-ts-parser/src',
  'tools/workers-builds',
  'apps/sample-app-lit-e2e/src', 'apps/sample-app-lit-mobx/src',
  'apps/sample-app-lit-vanilla/src', 'apps/sample-app-routes/src', 'apps/sample-app-shared/src',
].flatMap((p) => walk(ROOT + p)).map((f) => relative(ROOT, f));

// instrument -> ordered match rules (first match wins, so order matters)
const INSTRUMENTS = [
  ['src (4 published packages)', [/^packages\//]],
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
  ['lint & probe fleet', [/^tools\/lit-template-lint\//, /^tools\/lint-elements\//, /^tools\/warn-lanes\//, /^tools\/eslint-ts-parser\//, /^tools\/bundle-probe\//, /^tools\/vue-check\//, /^tools\/lcov-rebase\//, /^tools\/build_and_test\//]],
  ['@tools/shared', [/^tools\/shared\//]],
  ['typedoc plugin', [/^tools\/typedoc-plugin/]],
  ['e2e — cypress', [/^apps\/sample-app-lit-e2e\//]],
  ['sample apps', [/^apps\//]],
];

const acc = new Map(INSTRUMENTS.map(([n]) => [n, { files: [], sloc: 0 }]));
const orphans = [];
const code = sccSloc(POOL.map((f) => ROOT + f));
for (const f of POOL) {
  const hit = INSTRUMENTS.find(([, rules]) => rules.some((r) => r.test(f)));
  if (!hit) { orphans.push(f); continue; }
  const a = acc.get(hit[0]);
  a.files.push(f);
  a.sloc += code.get(ROOT + f);
}

const rows = [];
for (const [n] of INSTRUMENTS) {
  const a = acc.get(n);
  rows.push([n, a.files.length, a.sloc]);
  console.log(n.padEnd(30), String(a.files.length).padStart(4), String(a.sloc).padStart(7));
}
console.log('orphans', orphans.length, orphans.join(' '));
console.log('TOTAL', rows.reduce((a, r) => a + r[1], 0), 'files', rows.reduce((a, r) => a + r[2], 0), 'sloc');
console.log(JSON.stringify(rows));

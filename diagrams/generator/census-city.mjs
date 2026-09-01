// Sheet 7 rev B census: every workspace member, two series.
// Basis matches sheets 3 + 4 rev B (tmp/atlas/census-yard.mjs):
//   authored .ts/.tsx/.js/.jsx/.mjs under the member's source dir,
//   excluding *.d.ts, *.test-d.ts, generated/vendored trees, fixtures/,
//   node_modules/, dist/, .wrangler/, .vitepress/cache.
// sloc = scc 4.0.0 `Code` lines (string-aware: template-literal interiors count as code).
// Unlike sheet 3, sheet 7 SHOWS test code, so files are split into two series:
//   SRC  — everything else
//   SPEC — *.{spec,test}.*, *.cy.*, and anything under specs/ test/ tests/ __tests__/
import { readdirSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

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

// member -> the directories that hold its authored source
const MEMBERS = [
  ['packages/lit-ui-router', ['src']],
  ['packages/lit-ui-router-mobx', ['src']],
  ['packages/navigation-location-plugin', ['src']],
  ['packages/ui-router-server', ['src', 'test']],
  ['apps/sample-app-shared', ['src']],
  ['apps/sample-app-lit-vanilla', ['src']],
  ['apps/sample-app-lit-mobx', ['src']],
  ['apps/sample-app-routes', ['src', 'test']],
  ['apps/sample-app-lit-e2e', ['src', 'cypress']],
  ['docs', ['.vitepress', 'worker', 'src']],
  ['examples', ['.']],
  ['tools/release', ['src']],
  ['tools/typedoc-plugin-lit-ui-router', ['src']],
  ['tools/dts-backtest', ['.']],
  ['tools/build_and_test', ['src']],
  ['tools/shared', ['src']],
  ['tools/workers-builds', ['.']],
  ['tools/bundle-probe', ['src']],
  ['tools/compat-guards', ['src']],
  ['tools/oxc-emit', ['src']],
  ['tools/release-config', ['src']],
  ['tools/lit-template-lint', ['src']],
  ['tools/lit-test-env', ['src']],
  ['tools/vue-check', ['.']],
  ['tools/lcov-rebase', ['src']],
  ['tools/happy-dom', ['src']],
  ['tools/wintercg-globals', ['src']],
];

const rows = [];
for (const [m, dirs] of MEMBERS) {
  const files = [...new Set(dirs.flatMap((d) => walk(ROOT + m + (d === '.' ? '' : '/' + d))).map((f) => relative(ROOT, f)))];
  const code = sccSloc(files.map((f) => ROOT + f));
  const acc = { src: [0, 0], spec: [0, 0] };
  for (const f of files) {
    const k = IS_SPEC(relative(m, f)) ? 'spec' : 'src';
    acc[k][0]++; acc[k][1] += code.get(ROOT + f);
  }
  rows.push([m, ...acc.src, ...acc.spec]);
  console.log(m.padEnd(38), String(acc.src[0]).padStart(3), String(acc.src[1]).padStart(6),
    ' | spec', String(acc.spec[0]).padStart(3), String(acc.spec[1]).padStart(6));
}
const t = (i) => rows.reduce((a, r) => a + r[i], 0);
console.log('TOTAL', rows.length, 'members ·', t(1), 'src files', t(2), 'src sloc ·', t(3), 'spec files', t(4), 'spec sloc');
console.log(JSON.stringify(rows));

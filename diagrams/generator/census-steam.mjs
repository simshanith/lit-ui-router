// Sheet 7B steam channel: distinct non-merge commits touching each member's
// source universe (census-city rules), trailing 90 days from 2026-08-17.
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXT = /\.(tsx?|jsx?|mjs)$/;
const SKIP_FILE = (f) => /\.d\.ts$/.test(f) || /\.test-d\.ts$/.test(f);
const SKIP_DIR = (d) => ['node_modules', 'dist', 'fixtures', '.wrangler', 'cache', '.turbo', 'coverage'].includes(d);
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIR(e.name)) walk(join(dir, e.name), out); }
    else if (EXT.test(e.name) && !SKIP_FILE(e.name)) out.push(join(dir, e.name));
  }
  return out;
}
const MEMBERS = [
  ['packages/lit-ui-router', ['src']], ['packages/lit-ui-router-mobx', ['src']],
  ['packages/navigation-location-plugin', ['src']], ['packages/ui-router-server', ['src', 'test']],
  ['apps/sample-app-shared', ['src']], ['apps/sample-app-lit-vanilla', ['src']],
  ['apps/sample-app-lit-mobx', ['src']], ['apps/sample-app-routes', ['src', 'test']],
  ['apps/sample-app-lit-e2e', ['src', 'cypress']], ['docs', ['.vitepress', 'worker', 'src']],
  ['examples', ['.']], ['tools/release', ['src']], ['tools/typedoc-plugin-lit-ui-router', ['src']],
  ['tools/dts-backtest', ['.']], ['tools/build_and_test', ['src']], ['tools/shared', ['src']],
  ['tools/workers-builds', ['.']], ['tools/bundle-probe', ['src']], ['tools/compat-guards', ['src']],
  ['tools/oxc-emit', ['src']], ['tools/release-config', ['src']], ['tools/lit-template-lint', ['src']],
  ['tools/lit-test-env', ['src']], ['tools/vue-check', ['.']], ['tools/lcov-rebase', ['src']],
  ['tools/happy-dom', ['src']], ['tools/wintercg-globals', ['src']],
];
const fileToMember = new Map();
for (const [m, dirs] of MEMBERS)
  for (const abs of dirs.flatMap((d) => walk(ROOT + m + (d === '.' ? '' : '/' + d))))
    fileToMember.set(relative(ROOT, abs), m);

const log = execFileSync('git', ['-C', ROOT, 'log', '-M', '--since=2026-05-19', '--name-status', '--format=@%H|%as'], { maxBuffer: 1 << 27 }).toString();
const commits = new Map(MEMBERS.map(([m]) => [m, new Set()]));
let total = new Set(); let hash = null;
for (const line of log.split('\n')) {
  if (line.startsWith('@')) { hash = line.slice(1, line.indexOf('|')); total.add(hash); continue; }
  if (!line) continue;
  const parts = line.split('\t');
  const paths = parts[0].startsWith('R') || parts[0].startsWith('C') ? [parts[2]] : [parts[1]];
  for (const p of paths) { const m = fileToMember.get(p); if (m) commits.get(m).add(hash); }
}
const rows = MEMBERS.map(([m]) => [m, commits.get(m).size]);
for (const [m, n] of rows) console.log(m.padEnd(38), n);
console.log('window commits total (non-merge listed):', total.size);
const vals = rows.map((r) => r[1]).filter((v) => v > 0).sort((a, b) => a - b);
console.log('nonzero sorted:', vals.join(','));

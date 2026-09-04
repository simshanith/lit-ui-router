// Census of the production node_modules closure of one consumer app, ported
// onto the pipeline (INITIATIVES.md I5, tier T3): the closure is resolved and
// measured inside a MATERIALIZED, INSTALLED, BUILT archive of the ref
// (basis.mjs materialize + installDeps + the tree's own .bin/turbo run build),
// never the working tree.  Writes diagrams/data/census-nm.json.
// BFS over package.json `dependencies` (+ peerDependencies when installed),
// resolving each dep by walking node_modules dirs upward from the dependent's
// real path (pnpm layout: .pnpm/<pkg>@<v>/node_modules/<dep> siblings).
// Measures delivered code: .js/.mjs/.cjs/.ts/.mts/.cts/.css/.html, with .d.ts/.d.mts/.d.cts
// tracked separately (drawn as the types annex). Excludes nested node_modules,
// source maps, and non-code files. Workspace-linked packages measure dist/ only
// (their registry-delivered shape); registry packages measure the whole dir.
import { readFileSync, readdirSync, statSync, realpathSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { installDeps, materialize, positionalsFromArgv, refFromArgv } from './basis.mjs';
import { writeData } from './census-query.mjs';

const APP_DIR = positionalsFromArgv()[0] ?? 'apps/sample-app-lit-vanilla';
const basis = materialize(refFromArgv());
process.on('exit', () => basis.cleanup());
const { turbo } = installDeps(basis);
// Real build (not dry): workspace members must have their dist/ to measure.
execFileSync(turbo, ['run', 'build'], { cwd: basis.dir, stdio: ['ignore', 2, 2], maxBuffer: 1 << 26 });
const APP = join(basis.dir, APP_DIR);

const isDts = (f) => /\.d\.(ts|mts|cts)$/.test(f);
const isCode = (f) => /\.(js|mjs|cjs|ts|mts|cts|css|html)$/.test(f) && !/\.map$/.test(f);

function countDir(dir, res) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) countDir(p, res);
    else if (e.isFile() || e.isSymbolicLink()) {
      let st; try { st = statSync(p); } catch { continue; }
      if (!st.isFile()) continue;
      if (isDts(e.name)) { res.df++; res.dl += lines(p); }
      else if (isCode(e.name)) { res.f++; res.l += lines(p); }
    }
  }
  return res;
}
const lines = (p) => readFileSync(p, 'utf8').split('\n').length;

function resolvePkg(dep, fromDir) {
  let dir = fromDir;
  for (let i = 0; i < 12; i++) {
    const cand = join(dir, 'node_modules', dep);
    if (existsSync(join(cand, 'package.json'))) return realpathSync(cand);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const seen = new Map();
const queue = [[realpathSync(APP), '(app)', true]];
while (queue.length) {
  const [dir, name, isRoot] = queue.shift();
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const deps = { ...(manifest.dependencies ?? {}), ...(manifest.peerDependencies ?? {}) };
  for (const dep of Object.keys(deps)) {
    const real = resolvePkg(dep, dir);
    if (!real) { if (!isRoot) console.error('UNRESOLVED', dep, 'from', name); continue; }
    if (seen.has(real)) continue;
    const m = JSON.parse(readFileSync(join(real, 'package.json'), 'utf8'));
    const ws = !real.includes('/.pnpm/');
    seen.set(real, { name: m.name, version: m.version, ws, real });
    queue.push([real, m.name, false]);
  }
}

const rows = [];
for (const { name, version, ws, real } of seen.values()) {
  const target = ws ? (existsSync(join(real, 'dist')) ? join(real, 'dist') : real) : real;
  const res = countDir(target, { f: 0, l: 0, df: 0, dl: 0 });
  rows.push({ name, version, ws, measured: ws ? 'dist/' : 'pkg', ...res });
}
// the app itself, for scale (src only, what sheet 7 counted)
rows.sort((a, b) => b.l - a.l);
for (const r of rows)
  console.log([r.name + '@' + r.version, r.ws ? 'WORKSPACE(' + r.measured + ')' : 'registry',
    'code ' + r.f + 'f ' + r.l + 'l', 'dts ' + r.df + 'f ' + r.dl + 'l'].join('\t'));
console.log('TOTAL pkgs', rows.length,
  'code', rows.reduce((s, r) => s + r.l, 0), 'dts', rows.reduce((s, r) => s + r.dl, 0));

writeData('census-nm.json', {
  ref: basis.ref,
  sha: basis.sha,
  commitDate: basis.commitDate,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: 'diagrams/generator/census-nm.mjs',
  used: `git archive ${basis.ref} @ ${basis.sha} + corepack pnpm install --frozen-lockfile + turbo run build`,
  wasAssociatedWith: ['pnpm (corepack)', 'turbo'],
  app: APP_DIR,
  // strip `real` — a tmpdir-absolute path with no life beyond this run
  rows: rows.map(({ real: _real, ...r }) => r),
});

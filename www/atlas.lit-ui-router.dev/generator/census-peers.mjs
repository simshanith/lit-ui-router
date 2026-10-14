// I11 plate: the family's external peers, discovered from census-couplings.json and measured off their npm tarballs.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { loadCensus, provenance, writeData } from './census-query.mjs';

const snap = loadCensus();
const couplings = JSON.parse(readFileSync(new URL('../data/census-couplings.json', import.meta.url), 'utf8'));
const EXT = /\.(js|mjs|cjs)$/;
const keep = (rel) => EXT.test(rel) && !rel.split('/').slice(0, -1).includes('node_modules');

const published = new Set(couplings.nodes.filter((n) => n.kind === 'published').map((n) => n.key));
const peers = couplings.rows.filter((r) => r.kind === 'peer' && !published.has(r.to));
if (!peers.length) throw new Error('census-peers: census-couplings.json has no external peer rows');

const npm = (args) => JSON.parse(execFileSync('npm', ['view', ...args, '--json'], { maxBuffer: 1 << 24 }).toString('utf8'));
// npm emits a bare value for one match and an array for many; the array is semver-ascending.
const last = (v) => (Array.isArray(v) ? v.at(-1) : v);
const resolve = (name, range) => {
  const version = last(npm([`${name}@${range}`, 'version']));
  if (!version) throw new Error(`census-peers: no published ${name} satisfies ${range}`);
  return version;
};
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(dir, e.name), out);
    else out.push(join(dir, e.name));
  }
  return out;
};

// ---- one build: the files a bundler reaches from the exports entries --------
const CONDITIONS = ['development', 'import', 'default', 'module', 'main', 'require'];
// every target an exports value names, in condition preference order, tagged by the condition that led there
const targets = (t, path = []) => {
  if (typeof t === 'string') return [{ target: t, cond: path.includes('development') ? 'development' : path[0] ?? 'default' }];
  if (Array.isArray(t)) return t.flatMap((x) => targets(x, path));
  if (!t || typeof t !== 'object') return [];
  return CONDITIONS.filter((c) => c in t).flatMap((c) => targets(t[c], [...path, c]));
};
// -> { '<subpath>': [{ target, cond }] }
const entryTargets = (pkg) => {
  const ex = pkg.exports;
  if (ex == null) {
    const fields = [['module', pkg.module], ['main', pkg.main], ['index', './index.js']];
    return { '.': fields.filter(([, t]) => t).map(([cond, target]) => ({ target, cond })) };
  }
  if (typeof ex !== 'object' || Array.isArray(ex) || !Object.keys(ex).some((k) => k.startsWith('.'))) return { '.': targets(ex) };
  return Object.fromEntries(Object.entries(ex).map(([k, v]) => [k, targets(v)]));
};
const CANDIDATES = (p) => [p, `${p}.js`, `${p}.mjs`, `${p}.cjs`, `${p}/index.js`, `${p}/index.mjs`, `${p}/index.cjs`];
const resolveFile = (shipped, p) => CANDIDATES(p).find((c) => shipped.has(c) && keep(c)) ?? null;
const relOf = (root, target) => posix.normalize(posix.join(root, target)).replace(/\/$/, '');
// a bare `*` passthrough (`./dist/*`) exposes the tarball, not a build; only extension-pinned patterns are entries
const expandOne = (shipped, root, target) => {
  if (!target.includes('*')) return [resolveFile(shipped, relOf(root, target))].filter(Boolean);
  if (!EXT.test(target)) return [];
  const re = new RegExp(`^${relOf(root, target).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return [...shipped].filter((f) => re.test(f) && keep(f));
};
const expand = (shipped, root, list) => {
  for (const { target, cond } of list) {
    const found = expandOne(shipped, root, target);
    if (found.length) return { found, cond };
  }
  return { found: [], cond: null };
};
const SPECIFIER = /(?:\bfrom|\bimport|\brequire\s*\()\s*\(?\s*['"](\.\.?\/[^'"]*)['"]/g;
const reachable = (tmp, shipped, root, pkg) => {
  const entries = Object.entries(entryTargets(pkg)).map(([sub, list]) => [sub, expand(shipped, root, list)]);
  const build = (entries.find(([sub, e]) => sub === '.' && e.cond) ?? entries.find(([, e]) => e.cond))?.[1].cond ?? null;
  const seen = new Set(entries.flatMap(([, e]) => e.found));
  const queue = [...seen];
  while (queue.length) {
    const file = queue.shift();
    const src = readFileSync(join(tmp, file), 'utf8');
    for (const m of src.matchAll(SPECIFIER)) {
      const spec = m[1].replace(/[?#].*$/, '');
      const dep = resolveFile(shipped, relOf(posix.dirname(file), spec));
      if (!dep || seen.has(dep)) continue;
      seen.add(dep);
      queue.push(dep);
    }
  }
  return { seen, build };
};

const fallbacks = [];
const count = async (key, tarball) => {
  const tmp = mkdtempSync(join(tmpdir(), 'census-peers-'));
  try {
    const res = await fetch(tarball);
    if (!res.ok) throw new Error(`census-peers: ${tarball}: HTTP ${res.status}`);
    writeFileSync(join(tmp, 'pkg.tgz'), Buffer.from(await res.arrayBuffer()));
    execFileSync('tar', ['-xzf', 'pkg.tgz'], { cwd: tmp });
    const all = walk(tmp).map((f) => f.slice(tmp.length + 1)).filter((f) => f !== 'pkg.tgz');
    const bytes = all.reduce((a, f) => a + statSync(join(tmp, f)).size, 0);
    const shipped = new Set(all.filter(keep));
    if (!shipped.size) return { files: 0, sloc: 0, build: null, shippedFiles: 0, shippedSloc: 0, bytes };
    const manifest = all.find((f) => /^[^/]+\/package\.json$/.test(f));
    if (!manifest) throw new Error(`census-peers: ${key} tarball ships no package.json`);
    const root = posix.dirname(manifest);
    let { seen, build } = reachable(tmp, shipped, root, JSON.parse(readFileSync(join(tmp, manifest), 'utf8')));
    if (!seen.size) {
      fallbacks.push(key);
      seen = shipped;
      build = 'tarball';
    }
    const langs = JSON.parse(execFileSync('mise',
      ['x', 'aqua:boyter/scc@4.0.0', '--', 'scc', '--by-file', '--format', 'json', ...shipped],
      { cwd: tmp, maxBuffer: 1 << 26 }).toString('utf8'));
    const byFile = langs.flatMap((l) => l.Files);
    const sloc = (set) => byFile.filter((f) => set.has(f.Location)).reduce((a, f) => a + f.Code, 0);
    return { files: seen.size, sloc: sloc(seen), build, shippedFiles: shipped.size, shippedSloc: sloc(shipped), bytes };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

const measured = new Map();
const measure = async (name, version) => {
  const key = `${name}@${version}`;
  if (measured.has(key)) return measured.get(key);
  // a dotted version is a path to npm's field syntax; brackets keep it one key
  const info = last(npm([key, `time[${version}]`, 'dist.tarball', 'dist.unpackedSize', 'dependencies', 'peerDependencies']));
  const { bytes, ...counts } = await count(key, info['dist.tarball']);
  // publishes older than npm's unpackedSize field have none; the extracted bytes are the same measure
  const m = {
    ...counts,
    unpacked: info['dist.unpackedSize'] ?? bytes,
    published: info[`time[${version}]`].slice(0, 10),
    deps: Object.entries(info.dependencies ?? {}),
    peers: Object.keys(info.peerDependencies ?? {}).sort(),
  };
  measured.set(key, m);
  return m;
};

// the transitive `dependencies` of name@version, de-duplicated by name, own name first
const closure = async (name, version) => {
  const seen = new Map([[name, version]]);
  const queue = [[name, version]];
  while (queue.length) {
    const [n, v] = queue.shift();
    for (const [dep, range] of (await measure(n, v)).deps) {
      if (seen.has(dep)) continue;
      const dv = resolve(dep, range);
      seen.set(dep, dv);
      queue.push([dep, dv]);
    }
  }
  const packages = [name, ...[...seen.keys()].filter((n) => n !== name).sort()];
  const sum = (k) => packages.reduce((a, n) => a + measured.get(`${n}@${seen.get(n)}`)[k], 0);
  return {
    packages,
    files: sum('files'),
    sloc: sum('sloc'),
    shippedFiles: sum('shippedFiles'),
    shippedSloc: sum('shippedSloc'),
    unpacked: sum('unpacked'),
  };
};

const rows = [];
for (const name of [...new Set(peers.map((r) => r.to))]) {
  const mine = peers.filter((r) => r.to === name);
  const range = [...new Set(mine.map((r) => r.range))].join(' || ');
  const version = resolve(name, range);
  const own = await measure(name, version);
  const deep = await closure(name, version);
  rows.push({
    name,
    range,
    version,
    published: own.published,
    files: own.files,
    sloc: own.sloc,
    build: own.build,
    shippedFiles: own.shippedFiles,
    shippedSloc: own.shippedSloc,
    unpacked: own.unpacked,
    peeredBy: [...new Set(mine.map((r) => r.from))].sort(),
    optional: mine.every((r) => r.optional),
    peers: own.peers,
    closure: deep,
  });
  console.log(name.padEnd(22), version.padEnd(10), own.published,
    `${own.files}f ${own.sloc} sloc [${own.build}] (ships ${own.shippedFiles}f ${own.shippedSloc})`,
    `closure ${deep.packages.length} pkgs ${deep.files}f ${deep.sloc} sloc`,
    own.peers.length ? `peers ${own.peers.join(' ')}` : '', mine.every((r) => r.optional) ? 'optional' : '');
  if (deep.packages.length > 40) console.log(`  ${name}: closure of ${deep.packages.length} packages`);
}
rows.sort((a, b) => b.sloc - a.sloc);
for (const key of fallbacks) console.log(`  ${key}: no entry reachable, counted the whole tarball`);

const plate = {
  ...provenance(snap, 'www/atlas.lit-ui-router.dev/generator/census-peers.mjs',
    ['scc 4.0.0 (mise x aqua:boyter/scc)', 'npm view <pkg>@<range> version time dist dependencies peerDependencies (registry.npmjs.org)']),
  rows,
};
plate.used += '; measure: one build per package, files reachable from its exports entries, the development condition where one is shipped';
writeData('census-peers.json', plate);
console.log(`census-peers.json: ${rows.length} peers`);

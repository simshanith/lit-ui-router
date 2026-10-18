// I17 plate: each consumer census-builds.mjs surveys, its family pins as declared and as resolved — the tree for a pnpm member, its own lockfile for an npm consumer — against npm's latest.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { materialize } from './basis.mjs';
import { loadCensus, provenance, writeData } from './census-query.mjs';

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const BUILDS = read('census-builds.json');
const NPM = read('census-npm.json');
const COUPLINGS = read('census-couplings.json');
const argv = process.argv.slice(2);
const flag = (name) => {
  if (!argv.includes(name)) return null;
  const v = argv[argv.indexOf(name) + 1];
  if (!v || v.startsWith('--')) throw new Error('usage: node census-pins.mjs [--ref <cabinet ref>] [--atlas-ref <atlas ref>]');
  return v;
};
const snap = loadCensus();
if (NPM.sha !== BUILDS.sha || snap.sha !== BUILDS.sha) throw new Error(`census-pins: census-builds.json is at ${BUILDS.sha}, census-npm.json at ${NPM.sha}, census-files.json at ${snap.sha}`);

const SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies'];
const ATLAS = BUILDS.basis.atlasApp.dir;
const FAMILY = new Set(COUPLINGS.nodes.filter((n) => n.kind === 'published').map((n) => n.key));
const MEMBERS = new Map(snap.members.map((m) => [m.name, m]));
const npmRow = (name) => NPM.rows.find((r) => r.name === name) ?? null;
const latestOf = (name) => {
  const r = npmRow(name);
  if (!r) throw new Error(`census-pins: family part ${name} has no row in census-npm.json`);
  return r.tags.latest;
};
// x.y.z with a prerelease below its release; anything else is not a version this plate compares
const parts = (v) => {
  const m = /^(\d+)\.(\d+)\.(\d+)(-.+)?$/.exec(v);
  if (!m) throw new Error(`census-pins: ${v} is not a version`);
  return [+m[1], +m[2], +m[3], m[4] ? 0 : 1];
};
const cmp = (a, b) => parts(a).reduce((d, x, i) => d || x - parts(b)[i], 0);

// ---- the pnpm workspace: catalogs from pnpm-workspace.yaml, importers from pnpm-lock.yaml ----
const unquote = (s) => s.trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
// a top-level block of pnpm-workspace.yaml: its two-space entries, and under each the four-space entries it nests
function blockOf(yaml, name) {
  const out = new Map();
  let inBlock = false, key = null;
  for (const line of yaml.split('\n')) {
    if (/^\S/.test(line)) { inBlock = line.startsWith(`${name}:`); continue; }
    const m = inBlock && /^( +)('[^']+'|[^:\s]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    if (m[1].length === 2) out.set((key = unquote(m[2])), { value: unquote(m[3]), nested: new Map() });
    else if (m[1].length === 4) out.get(key).nested.set(unquote(m[2]), unquote(m[3]));
  }
  return out;
}
const catalogsOf = (yaml) => new Map([
  ['', new Map([...blockOf(yaml, 'catalog')].map(([k, v]) => [k, v.value]))],
  ...[...blockOf(yaml, 'catalogs')].map(([k, v]) => [k, v.nested]),
]);
const flatOf = (yaml, name) => {
  const entries = [...blockOf(yaml, name)].map(([k, v]) => [k, v.value]);
  return entries.length ? Object.fromEntries(entries) : null;
};
// importer dir → section → name → { specifier, version }
function importersOf(yaml) {
  const out = new Map();
  let inImporters = false, dir = null, section = null, dep = null;
  for (const line of yaml.split('\n')) {
    if (/^\S/.test(line)) { inImporters = line.startsWith('importers:'); continue; }
    if (!inImporters) continue;
    const m = /^( +)('[^']+'|[^:\s]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const depth = m[1].length, key = unquote(m[2]);
    if (depth === 2) out.set((dir = key), {});
    else if (depth === 4) out.get(dir)[(section = key)] = {};
    else if (depth === 6) out.get(dir)[section][(dep = key)] = {};
    else if (depth === 8) out.get(dir)[section][dep][key] = unquote(m[3]);
  }
  return out;
}
const lockVersionOf = (yaml) => unquote(/^lockfileVersion:\s*(.+)$/m.exec(yaml)?.[1] ?? '');
const rangeOf = (catalogs, name, spec) => {
  if (!spec.startsWith('catalog:')) return spec;
  const range = catalogs.get(spec.slice('catalog:'.length) || '')?.get(name);
  if (!range) throw new Error(`census-pins: ${name} names ${spec}, which pnpm-workspace.yaml does not catalog`);
  return range;
};

// ---- one consumer: its manifest, the installer that resolves it, and each pin ----
const sectionsOf = (pkg, name) => SECTIONS.filter((s) => pkg[s]?.[name] !== undefined);
const specOf = (pkg, name) => pkg[sectionsOf(pkg, name)[0]][name];
function treeResolver(ws, dir) {
  const importer = ws.importers.get(dir);
  if (!importer) throw new Error(`census-pins: pnpm-lock.yaml has no importer ${dir}`);
  return (name, section) => {
    const v = importer[section]?.[name]?.version;
    if (!v) throw new Error(`census-pins: pnpm-lock.yaml's importer ${dir} resolves no ${section} ${name}`);
    if (!v.startsWith('link:')) return { resolved: v.replace(/\(.*$/, '') };
    const m = MEMBERS.get(name);
    if (!m) throw new Error(`census-pins: ${dir} links ${name}, which is no workspace member at ${snap.sha}`);
    return { resolved: 'tree', treeVersion: m.version };
  };
}
function lockResolver(lock, dir) {
  return (name) => {
    const v = lock.packages?.[`node_modules/${name}`]?.version;
    if (!v) throw new Error(`census-pins: ${dir}/package-lock.json resolves no ${name}`);
    return { resolved: v };
  };
}
function installerOf(basis, c, ws) {
  const lockPath = join(basis.dir, c.dir, 'package-lock.json');
  if (ws.importers.has(c.dir)) {
    if (existsSync(lockPath)) throw new Error(`census-pins: ${c.dir} is a pnpm importer and carries a package-lock.json`);
    return { installer: 'pnpm', lockfile: 'pnpm-lock.yaml', lockfileVersion: ws.lockfileVersion, resolve: treeResolver(ws, c.dir), range: (n, s) => rangeOf(ws.catalogs, n, s) };
  }
  if (!existsSync(lockPath)) throw new Error(`census-pins: ${c.name} installs with npm but ${c.dir}/package-lock.json is missing at ${basis.sha}`);
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  return { installer: 'npm', lockfile: `${c.dir}/package-lock.json`, lockfileVersion: lock.lockfileVersion, resolve: lockResolver(lock, c.dir), range: (_, s) => s };
}
function pinRow(pkg, how, name) {
  const sections = sectionsOf(pkg, name), spec = specOf(pkg, name);
  const r = how.resolve(name, sections[0]);
  const latest = latestOf(name);
  const version = r.resolved === 'tree' ? r.treeVersion : r.resolved;
  return { name, sections, spec, range: how.range(name, spec), ...r, latest, trails: cmp(version, latest) < 0, ahead: cmp(version, latest) > 0 };
}
function survey(basis, c, ws) {
  const pkg = JSON.parse(readFileSync(join(basis.dir, c.dir, 'package.json'), 'utf8'));
  const how = installerOf(basis, c, ws);
  const declared = [...new Set(SECTIONS.flatMap((s) => Object.keys(pkg[s] ?? {})))];
  const pinned = declared.filter((d) => FAMILY.has(d)).sort();
  if (pinned.join() !== c.pinned.join()) throw new Error(`census-pins: ${c.name} pins [${pinned}] but census-builds.json says [${c.pinned}]`);
  const runtime = Object.keys(pkg.dependencies ?? {}).filter((d) => !FAMILY.has(d)).sort().map((name) => {
    const spec = pkg.dependencies[name];
    return { name, spec, range: how.range(name, spec), ...how.resolve(name, 'dependencies'), latest: npmRow(name)?.tags.latest ?? null };
  });
  const own = (k) => (pkg[k] && Object.keys(pkg[k]).length ? pkg[k] : null);
  return {
    name: c.name, dir: c.dir, kind: c.kind, installer: how.installer, lockfile: how.lockfile, lockfileVersion: how.lockfileVersion,
    pins: pinned.map((n) => pinRow(pkg, how, n)), runtime, overrides: own('overrides'), patchedDependencies: own('patchedDependencies'),
  };
}
const totals = (rows) => {
  const pins = rows.flatMap((r) => r.pins);
  return {
    consumers: rows.length, pnpm: rows.filter((r) => r.installer === 'pnpm').length, npm: rows.filter((r) => r.installer === 'npm').length,
    pins: pins.length, fromTree: pins.filter((p) => p.resolved === 'tree').length, fromLock: pins.filter((p) => p.resolved !== 'tree').length,
    trailing: pins.filter((p) => p.trails).length, ahead: pins.filter((p) => p.ahead).length, runtime: rows.reduce((a, r) => a + r.runtime.length, 0),
  };
};

// the consumers, found the way census-builds finds them, and held to its two readings both ways
function enumerate(basis) {
  const sites = snap.members.filter((m) => m.dir.startsWith('apps/') || m.dir === 'www/lit-ui-router.dev').map((m) => ({ name: m.name, dir: m.dir }));
  const embeds = readFileSync(join(basis.dir, 'examples/embeds.ts'), 'utf8');
  const body = embeds.slice(embeds.indexOf('export const EXAMPLES = {'));
  const examples = [...body.matchAll(/^\s{2}(?:'([^']+)'|([\w-]+)):\s*\{/gm)].map((m) => m[1] ?? m[2]).map((e) => ({ name: e, dir: `examples/${e}` }));
  return [...sites, ...examples];
}
function holdTo(found, listed, where) {
  const names = (xs) => xs.map((x) => `${x.name}@${x.dir}`).sort();
  const missing = names(listed).filter((n) => !names(found).includes(n)), extra = names(found).filter((n) => !names(listed).includes(n));
  if (missing.length) throw new Error(`census-pins: census-builds.json's ${where} lists ${missing}, which this probe does not find`);
  if (extra.length) throw new Error(`census-pins: this probe finds ${extra}, which census-builds.json's ${where} does not list`);
}

// the cabinet's sha and the atlas sha census-builds.json read, unless a ref is named; a named ref must land on them
const basis = materialize(flag('--ref') ?? BUILDS.sha);
const atlasBasis = materialize(flag('--atlas-ref') ?? BUILDS.basis.atlasApp.sha);
try {
  if (basis.sha !== BUILDS.sha || atlasBasis.sha !== BUILDS.basis.atlasApp.sha) throw new Error(`census-pins: the archives are ${basis.sha} and ${atlasBasis.sha}, but census-builds.json reads ${BUILDS.sha} and ${BUILDS.basis.atlasApp.sha} — refile census-builds.json first`);
  const lockYaml = readFileSync(join(basis.dir, 'pnpm-lock.yaml'), 'utf8');
  const wsYaml = readFileSync(join(basis.dir, 'pnpm-workspace.yaml'), 'utf8');
  const ws = { catalogs: catalogsOf(wsYaml), importers: importersOf(lockYaml), lockfileVersion: lockVersionOf(lockYaml) };
  if (!ws.importers.size || !ws.lockfileVersion) throw new Error('census-pins: pnpm-lock.yaml parsed to no importers');
  holdTo(enumerate(basis), BUILDS.consumers, 'cabinet reading');
  const cabinet = BUILDS.consumers.map((c) => survey(basis, c, ws));
  const atlasRows = BUILDS.withAtlas.consumers.filter((c) => !BUILDS.consumers.some((x) => x.name === c.name));
  if (atlasRows.length !== 1 || atlasRows[0].dir !== ATLAS) throw new Error('census-pins: the second reading of census-builds.json should add the atlas app alone');
  holdTo([...enumerate(basis), { name: atlasRows[0].name, dir: ATLAS }], BUILDS.withAtlas.consumers, 'withAtlas reading');
  const withRows = [...cabinet, survey(atlasBasis, atlasRows[0], { ...ws, importers: new Map() })];

  const plate = {
    ...provenance({ ref: BUILDS.ref, sha: basis.sha, commitDate: basis.commitDate }, 'www/atlas.lit-ui-router.dev/generator/census-pins.mjs', ['git']),
    used: `git archive ${BUILDS.ref} @ ${basis.sha} — each consumer's package.json, pnpm-workspace.yaml's catalogs, pnpm-lock.yaml's importers and examples/<key>/package-lock.json; git archive ${BUILDS.basis.atlasApp.ref} @ ${atlasBasis.sha} — ${ATLAS}/package.json and package-lock.json; consumers and pins from census-builds.json, latest from census-npm.json, members from census-files.json @ ${snap.sha}`,
    rule: 'a family pin is a published part named in dependencies, devDependencies or peerDependencies; a pnpm member resolves it to the tree (resolved "tree", treeVersion the member\'s version at the ref) and an npm consumer to its own lockfile; trails = resolved below latest, ahead = above · runtime = dependencies only, family aside, each resolved the same way',
    totals: totals(cabinet),
    consumers: cabinet,
    // the pnpm members install under the workspace's own overrides and patches, not a manifest's
    workspace: { lockfile: 'pnpm-lock.yaml', lockfileVersion: ws.lockfileVersion, importers: ws.importers.size, catalogs: ws.catalogs.size, overrides: flatOf(wsYaml, 'overrides'), patchedDependencies: flatOf(wsYaml, 'patchedDependencies') },
    basis: { ...BUILDS.basis },
    withAtlas: { totals: totals(withRows), consumers: withRows },
  };
  writeData('census-pins.json', plate, ['consumers', 'withAtlas.consumers']);

  console.log(`census-pins.json: ${plate.ref} @ ${basis.sha} · atlas app from ${BUILDS.basis.atlasApp.ref} @ ${atlasBasis.sha}`);
  for (const r of withRows)
    console.log(' ', r.name.padEnd(26), r.installer.padEnd(5), String(r.lockfileVersion).padEnd(4), r.pins.map((p) => `${p.name} ${p.range}→${p.resolved === 'tree' ? `tree ${p.treeVersion}` : p.resolved}/${p.latest}${p.trails ? ' TRAILS' : ''}`).join(' · ') || '—', `| ${r.runtime.length} runtime`);
  for (const [label, t] of [['cabinet', plate.totals], ['with the atlas app', plate.withAtlas.totals]])
    console.log(`${label}: ${t.consumers} consumers (${t.pnpm} pnpm, ${t.npm} npm) · ${t.pins} pins, ${t.fromTree} from the tree, ${t.fromLock} from a lockfile · ${t.trailing} trailing, ${t.ahead} ahead · ${t.runtime} runtime`);
} finally {
  basis.cleanup();
  atlasBasis.cleanup();
}

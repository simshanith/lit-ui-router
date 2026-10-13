// I11 plate: the family BUILDS — each distinct set of published packages a consumer in the archive installs together.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, materialize, refFromArgv } from './basis.mjs';
import { loadCensus, provenance, writeData } from './census-query.mjs';

const argv = process.argv.slice(2);
const argRef = argv.includes('--ref') ? refFromArgv(argv) : null;
const snap = loadCensus();
const couplings = JSON.parse(readFileSync(new URL('../data/census-couplings.json', import.meta.url), 'utf8'));
const basis = materialize(argRef ?? snap.sha);

const SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies'];
const family = new Set(couplings.nodes.filter((n) => n.kind === 'published').map((n) => n.key));
const peerRows = couplings.rows.filter((r) => r.kind === 'peer' && family.has(r.from));
const runtimes = new Set(peerRows.filter((r) => !family.has(r.to) && r.to !== '@uirouter/core').map((r) => r.to));
if (!family.size || !runtimes.size) throw new Error('census-builds: census-couplings.json has no published nodes or no external peers');
const peersOf = (part) => peerRows.filter((r) => r.from === part).map((r) => r.to);
// a pinned set closed over family-to-family peers: what the consumer's package manager installs
const close = (pinned) => {
  const seen = new Set(pinned);
  const queue = [...pinned];
  while (queue.length) for (const p of peersOf(queue.shift())) if (family.has(p) && !seen.has(p)) { seen.add(p); queue.push(p); }
  return [...seen].sort();
};
const runtimePeers = (parts) => [...new Set(parts.flatMap(peersOf).filter((p) => runtimes.has(p)))].sort();

try {
  const has = (p) => basis.files.includes(p);
  const slurp = (p) => readFileSync(join(basis.dir, p), 'utf8');
  const manifest = (dir) => JSON.parse(slurp(`${dir}/package.json`));

  // ---- a) the consumers: workspace members under apps/ and the docs site, the embedded examples, the atlas app
  const sites = snap.members.filter((m) => m.dir.startsWith('apps/') || m.dir === 'www/lit-ui-router.dev');
  if (!sites.length) throw new Error('census-builds: the master plate lists no apps/ or docs-site members');
  const embeds = slurp('examples/embeds.ts');
  const body = embeds.slice(embeds.indexOf('export const EXAMPLES = {'));
  const examples = [...body.matchAll(/^\s{2}(?:'([^']+)'|([\w-]+)):\s*\{/gm)].map((m) => m[1] ?? m[2]);
  if (!examples.length) throw new Error('census-builds: examples/embeds.ts lists no examples');
  const ATLAS = 'www/atlas.lit-ui-router.dev/app';
  const atlasInSnapshot = has(`${ATLAS}/package.json`);

  const survey = (name, dir, kind) => {
    const pkg = manifest(dir);
    const declared = new Set(SECTIONS.flatMap((s) => Object.keys(pkg[s] ?? {})));
    const pinned = [...declared].filter((d) => family.has(d)).sort();
    const parts = close(pinned);
    return {
      name,
      dir,
      kind,
      pinned,
      parts,
      runtimes: runtimePeers(parts).filter((r) => declared.has(r)),
      runtimesByPeer: runtimePeers(parts),
    };
  };
  const consumers = [
    ...sites.map((m) => survey(m.name, m.dir, m.dir === 'www/lit-ui-router.dev' ? 'docs-site' : 'sample-app')),
    ...examples.map((e) => survey(e, `examples/${e}`, 'example')),
    ...(atlasInSnapshot ? [survey(manifest(ATLAS).name, ATLAS, 'atlas-app')] : []),
  ];

  // ---- b) the builds: the distinct closed parts sets, keyed by their sorted members
  const byKey = new Map();
  for (const c of consumers) {
    const key = c.parts.join(' + ');
    const b = byKey.get(key) ?? { parts: c.parts, pinned: new Map(), runtimes: new Set(), consumers: [] };
    b.pinned.set(c.pinned.join(' + '), c.pinned);
    for (const r of c.runtimes) b.runtimes.add(r);
    b.consumers.push(c.name);
    byKey.set(key, b);
  }
  const builds = [...byKey.values()]
    .map((b) => ({
      parts: b.parts,
      pinned: [...b.pinned.values()].sort((x, y) => x.join().localeCompare(y.join())),
      runtimes: [...b.runtimes].sort(),
      runtimesByPeer: runtimePeers(b.parts),
      consumers: b.consumers,
    }))
    .sort((a, b) => b.consumers.length - a.consumers.length || a.parts.length - b.parts.length
      || a.parts.join().localeCompare(b.parts.join()));

  const carrying = Object.fromEntries([...family].sort()
    .map((p) => [p, consumers.filter((c) => c.parts.includes(p)).length]));

  const plate = {
    ...provenance(argRef ? { ref: basis.ref, sha: basis.sha, commitDate: basis.commitDate } : snap,
      'www/atlas.lit-ui-router.dev/generator/census-builds.mjs', ['git']),
    used: `git archive ${argRef ?? snap.ref} @ ${basis.sha} — apps/*, www/lit-ui-router.dev and examples/<embeds.ts key>/package.json declarations, closed over family peers; family and runtimes from census-couplings.json`,
    totals: {
      consumers: consumers.length,
      builds: builds.length,
      empty: builds.filter((b) => !b.parts.length).length,
      carrying,
    },
    consumers,
    builds,
  };
  if (!atlasInSnapshot) {
    const branch = execFileSync('git', ['branch', '--list', '--format=%(refname:short)', '--contains', 'HEAD', 'www/atlas'], { cwd: ROOT }).toString().trim();
    plate.basis = { atlasApp: null, note: `${ATLAS} is on ${branch || 'this checkout'}, not in the measured tree` };
  }
  writeData('census-builds.json', plate, ['consumers', 'builds']);

  console.log(`census-builds.json: ${plate.ref} @ ${basis.sha} · atlas app ${atlasInSnapshot ? 'in' : 'not in'} the snapshot`);
  for (const c of consumers) {
    console.log(' ', c.name.padEnd(42), c.kind.padEnd(11), (c.parts.join(' + ') || '—').padEnd(76), c.runtimes.join(' '));
  }
  for (const b of builds) {
    console.log(`  [${b.consumers.length}]`, (b.parts.join(' + ') || '—').padEnd(76),
      `${b.pinned.length} pinned · stands on ${b.runtimes.join(' ') || '—'} · peers ${b.runtimesByPeer.join(' ') || '—'}`);
  }
  console.log(`${consumers.length} consumers · ${builds.length} builds · `
    + Object.entries(carrying).map(([p, n]) => `${p} ${n}`).join(' · '));
} finally {
  basis.cleanup();
}

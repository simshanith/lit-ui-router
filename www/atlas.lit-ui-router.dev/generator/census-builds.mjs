// I11 plate: the family BUILDS — each distinct set of published packages a consumer in the archive installs together.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { materialize, refFromArgv } from './basis.mjs';
import { loadCensus, provenance, writeData } from './census-query.mjs';

const argv = process.argv.slice(2);
const argRef = argv.includes('--ref') ? refFromArgv(argv) : null;
const ATLAS_REF = argv.includes('--atlas-ref') ? argv[argv.indexOf('--atlas-ref') + 1] : 'www/atlas';
if (!ATLAS_REF || ATLAS_REF.startsWith('--')) throw new Error('usage: node census-builds.mjs [--ref <cabinet ref>] [--atlas-ref <atlas ref>]');
const snap = loadCensus();
const couplings = JSON.parse(readFileSync(new URL('../data/census-couplings.json', import.meta.url), 'utf8'));

const SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies'];
const ATLAS = 'www/atlas.lit-ui-router.dev/app';
const family = new Set(couplings.nodes.filter((n) => n.kind === 'published').map((n) => n.key));
const peerRows = couplings.rows.filter((r) => r.kind === 'peer' && family.has(r.from));
const runtimes = new Set(peerRows.filter((r) => !family.has(r.to)).map((r) => r.to));
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

const survey = (basis, name, dir, kind) => {
  const pkg = JSON.parse(readFileSync(join(basis.dir, dir, 'package.json'), 'utf8'));
  const declared = new Set(SECTIONS.flatMap((s) => Object.keys(pkg[s] ?? {})));
  const pinned = [...declared].filter((d) => family.has(d)).sort();
  const parts = close(pinned);
  return {
    name: name ?? pkg.name,
    dir,
    kind,
    pinned,
    parts,
    runtimes: runtimePeers(parts).filter((r) => declared.has(r)),
    runtimesByPeer: runtimePeers(parts),
  };
};

// one reading: the consumers, their distinct closed parts sets keyed by sorted members, and the totals
const reading = (consumers) => {
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
  return {
    totals: { consumers: consumers.length, builds: builds.length, empty: builds.filter((b) => !b.parts.length).length, carrying },
    consumers,
    builds,
  };
};

const basis = materialize(argRef ?? snap.sha);
const atlasBasis = materialize(ATLAS_REF);
try {
  // ---- a) the cabinet's consumers: workspace members under apps/ and the docs site, the embedded examples
  const sites = snap.members.filter((m) => m.dir.startsWith('apps/') || m.dir === 'www/lit-ui-router.dev');
  if (!sites.length) throw new Error('census-builds: the master plate lists no apps/ or docs-site members');
  const embeds = readFileSync(join(basis.dir, 'examples/embeds.ts'), 'utf8');
  const body = embeds.slice(embeds.indexOf('export const EXAMPLES = {'));
  const examples = [...body.matchAll(/^\s{2}(?:'([^']+)'|([\w-]+)):\s*\{/gm)].map((m) => m[1] ?? m[2]);
  if (!examples.length) throw new Error('census-builds: examples/embeds.ts lists no examples');
  if (basis.files.includes(`${ATLAS}/package.json`)) throw new Error(`census-builds: the cabinet's tree carries ${ATLAS}; the second reading would count it twice`);
  if (!atlasBasis.files.includes(`${ATLAS}/package.json`)) throw new Error(`census-builds: ${ATLAS_REF} @ ${atlasBasis.sha} has no ${ATLAS}/package.json`);

  const consumers = [
    ...sites.map((m) => survey(basis, m.name, m.dir, m.dir === 'www/lit-ui-router.dev' ? 'docs-site' : 'sample-app')),
    ...examples.map((e) => survey(basis, e, `examples/${e}`, 'example')),
  ];
  const cabinet = reading(consumers);
  // ---- b) the second reading: the cabinet's consumers plus the atlas app, off the atlas branch's tree
  const withAtlas = reading([...consumers, survey(atlasBasis, null, ATLAS, 'atlas-app')]);

  const plate = {
    ...provenance(argRef ? { ref: basis.ref, sha: basis.sha, commitDate: basis.commitDate } : snap,
      'www/atlas.lit-ui-router.dev/generator/census-builds.mjs', ['git']),
    used: `git archive ${argRef ?? snap.ref} @ ${basis.sha} — apps/*, www/lit-ui-router.dev and examples/<embeds.ts key>/package.json declarations, closed over family peers; withAtlas adds git archive ${ATLAS_REF} @ ${atlasBasis.sha} — ${ATLAS}/package.json; family and runtimes from census-couplings.json`,
    ...cabinet,
    basis: {
      atlasApp: { ref: ATLAS_REF, sha: atlasBasis.sha, commitDate: atlasBasis.commitDate, dir: ATLAS },
      note: `${ATLAS} is on ${ATLAS_REF} @ ${atlasBasis.sha}, off the cabinet's tree; the second reading adds it`,
    },
    withAtlas,
  };
  writeData('census-builds.json', plate, ['consumers', 'builds', 'withAtlas.consumers', 'withAtlas.builds']);

  console.log(`census-builds.json: ${plate.ref} @ ${basis.sha} · atlas app from ${ATLAS_REF} @ ${atlasBasis.sha}`);
  for (const c of withAtlas.consumers) {
    console.log(' ', c.name.padEnd(42), c.kind.padEnd(11), (c.parts.join(' + ') || '—').padEnd(76), c.runtimes.join(' '));
  }
  for (const [label, r] of [['cabinet', cabinet], ['with the atlas app', withAtlas]]) {
    console.log(`${label}:`);
    for (const b of r.builds) {
      console.log(`  [${b.consumers.length}]`, (b.parts.join(' + ') || '—').padEnd(76),
        `${b.pinned.length} pinned · stands on ${b.runtimes.join(' ') || '—'} · peers ${b.runtimesByPeer.join(' ') || '—'}`);
    }
    console.log(`  ${r.totals.consumers} consumers · ${r.totals.builds} builds · `
      + Object.entries(r.totals.carrying).map(([p, n]) => `${p} ${n}`).join(' · '));
  }
} finally {
  basis.cleanup();
  atlasBasis.cleanup();
}

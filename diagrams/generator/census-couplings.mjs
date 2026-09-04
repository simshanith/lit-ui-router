// Sheet 2B's census: the COUPLING CONTRACTS between the five published packages
// and the two things they all reach for — @uirouter/core and lit — read from the
// ARCHIVE as a T1 tree probe (INITIATIVES.md I5 pattern; census-handoff.mjs is
// the exemplar).  Nothing is executed and nothing is resolved by a package
// manager: every figure here is a text read of three files git already tracks.
//
// Counting rules, stated so the ranges stay honest:
//   · a CONTRACT is one entry in a published package's `dependencies`,
//     `peerDependencies` or `optionalDependencies`.  devDependencies are NOT
//     contracts — they bind the workspace, never a consumer's install;
//   · the declared range is the range AS PUBLISHED.  Every spec in this repo is
//     a `catalog:` / `catalog:<name>` reference, which pnpm rewrites at pack
//     time, so each is resolved against the archive's own pnpm-workspace.yaml
//     (no YAML library: the catalog blocks are a flat two-level mapping) and
//     the plate carries BOTH the written spec and the range it stands for;
//   · a peer is OPTIONAL when `peerDependenciesMeta.<name>.optional` is true —
//     that is the difference between a coupling and a coupling drawn crossed out;
//   · `drawn` marks the contracts whose target is one of the seven nodes on the
//     bench; the rest are filed anyway, because the oxc runtime staying a
//     `dependency` is half of the deps-to-peers story sheet 2B tells.
// The version core and lit actually resolve to is taken from the archive's
// pnpm-lock.yaml `packages:` section — the lockfile is the honest source for a
// resolution, the catalog only ever states a range.
// The default ref is the CABINET's pin (the master plate's sha), not a live
// branch tip — a probe filed later must measure the tree its siblings measured.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { materialize, refFromArgv } from './basis.mjs';
import { loadCensus, provenance, writeData } from './census-query.mjs';

const argv = process.argv.slice(2);
const argRef = argv.includes('--ref') ? refFromArgv(argv) : null;
const snap = loadCensus();
const basis = materialize(argRef ?? snap.sha);
const slurp = (p) => readFileSync(join(basis.dir, p), 'utf8');

// the two nodes on the bench that the repo does not publish
const EXTERNAL = ['@uirouter/core', 'lit'];
const SECTIONS = [
  ['dependencies', 'dep'],
  ['peerDependencies', 'peer'],
  ['optionalDependencies', 'optionalDep'],
];

try {
  // ---- a) the catalogs: what a `catalog:` spec stands for --------------------
  // pnpm-workspace.yaml's `catalog:` is one flat mapping and `catalogs:` is a
  // mapping of them; both are plain `key: value` lines, so they are read
  // directly rather than dragging in a YAML parser for eight lines of work.
  const unquote = (s) => s.trim().replace(/^['"]|['"]$/g, '');
  const catalogs = { default: {} };
  {
    let block = null;      // 'catalog' | 'catalogs' | null
    let named = null;
    for (const line of slurp('pnpm-workspace.yaml').split('\n')) {
      if (/^\S/.test(line)) {
        block = /^catalog:\s*$/.test(line) ? 'catalog' : /^catalogs:\s*$/.test(line) ? 'catalogs' : null;
        named = null;
        continue;
      }
      if (!block || !line.trim() || /^\s*#/.test(line)) continue;
      const entry = line.match(/^(\s+)('[^']+'|"[^"]+"|[^:\s]+):\s*(.*)$/);
      if (!entry) continue;
      const [, indent, rawKey, rawVal] = entry;
      if (block === 'catalog') {
        catalogs.default[unquote(rawKey)] = unquote(rawVal);
      } else if (indent.length === 2) {
        named = unquote(rawKey);
        catalogs[named] = catalogs[named] ?? {};
      } else if (named) {
        catalogs[named][unquote(rawKey)] = unquote(rawVal);
      }
    }
  }
  // `catalog:` -> the default catalog; `catalog:x` -> catalogs.x.  A catalog
  // value can itself be an alias (`npm:lit@^2.8.0`); the plate keeps it whole.
  const resolveSpec = (name, spec) => {
    const m = spec.match(/^catalog:(.*)$/);
    if (!m) return { range: spec, catalog: null };
    const key = m[1] || 'default';
    const table = catalogs[key];
    if (!table) throw new Error(`census-couplings: ${name} declares ${spec}, but pnpm-workspace.yaml has no catalog "${key}"`);
    if (!(name in table)) throw new Error(`census-couplings: catalog "${key}" has no entry for ${name}`);
    return { range: table[name], catalog: key };
  };

  // ---- b) the lockfile's resolutions ---------------------------------------
  // Under `packages:` every entry is `  <name>@<version>:` followed by a
  // `resolution:` line — the pair is what makes a match a real package and not
  // an importer key that happens to contain an @.
  const lockVersions = (() => {
    const lines = slurp('pnpm-lock.yaml').split('\n');
    const found = new Map();
    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(/^ {2}'?((?:@[^/@]+\/)?[^@'\s]+)@([^'\s:()]+)'?:\s*$/);
      if (!m || !/^\s+resolution:/.test(lines[i + 1] ?? '')) continue;
      const [, name, version] = m;
      if (!found.has(name)) found.set(name, new Set());
      found.get(name).add(version);
    }
    return found;
  })();
  const resolved = (name) => {
    const set = lockVersions.get(name);
    if (!set) throw new Error(`census-couplings: pnpm-lock.yaml resolves no version of ${name}`);
    return [...set].sort();
  };

  // ---- c) the drawn nodes ---------------------------------------------------
  const published = snap.members.filter((m) => !m.private).map((m) => ({
    ...m,
    pkg: JSON.parse(slurp(`${m.dir}/package.json`)),
  }));
  if (!published.length) throw new Error('census-couplings: the master plate lists no published members');

  const nodes = [
    ...published.map((m) => ({
      key: m.name,
      dir: m.dir,
      version: m.version,
      kind: 'published',
      versionFrom: `${m.dir}/package.json`,
    })),
    ...EXTERNAL.map((name) => ({
      key: name,
      dir: null,
      version: resolved(name).join(' · '),
      kind: 'external',
      versionFrom: 'pnpm-lock.yaml',
    })),
  ];
  const drawnKeys = new Set(nodes.map((n) => n.key));

  // ---- d) the contracts -----------------------------------------------------
  const rows = [];
  for (const m of published) {
    const meta = m.pkg.peerDependenciesMeta ?? {};
    for (const [section, short] of SECTIONS) {
      for (const [name, spec] of Object.entries(m.pkg[section] ?? {})) {
        const { range, catalog } = resolveSpec(name, spec);
        rows.push({
          from: m.name,
          to: name,
          section,
          kind: short,
          optional: short === 'optionalDep' || meta[name]?.optional === true,
          range,
          spec,
          catalog,
          drawn: drawnKeys.has(name),
        });
      }
    }
  }
  rows.sort((a, b) => a.from.localeCompare(b.from)
    || Number(b.drawn) - Number(a.drawn)
    || a.to.localeCompare(b.to));

  const drawn = rows.filter((r) => r.drawn);
  const plate = {
    ...provenance(argRef ? { ref: basis.ref, sha: basis.sha, commitDate: basis.commitDate } : snap,
      'diagrams/generator/census-couplings.mjs', ['git']),
    used: `git archive ${argRef ?? snap.ref} @ ${basis.sha} — packages/*/package.json ranges resolved through pnpm-workspace.yaml catalogs; core and lit versions from pnpm-lock.yaml`,
    totals: {
      nodes: nodes.length,
      published: published.length,
      external: EXTERNAL.length,
      contracts: rows.length,
      drawnContracts: drawn.length,
      peers: rows.filter((r) => r.kind === 'peer').length,
      deps: rows.filter((r) => r.kind === 'dep').length,
      optional: rows.filter((r) => r.optional).length,
      uncoupled: nodes.filter((n) => n.kind === 'published'
        && !drawn.some((r) => r.from === n.key || r.to === n.key)).length,
    },
    nodes,
    rows,
  };
  writeData('census-couplings.json', plate, ['nodes', 'rows']);

  console.log(`census-couplings.json: ${plate.ref} @ ${basis.sha}`);
  for (const n of nodes) console.log(' ', n.key.padEnd(38), n.version, `(${n.kind})`);
  for (const r of rows) {
    console.log(' ', `${r.from} -> ${r.to}`.padEnd(60),
      (r.optional ? `optional ${r.kind}` : r.kind).padEnd(14), r.range, r.drawn ? '' : '· offstage');
  }
  console.log(`${plate.totals.contracts} contracts · ${plate.totals.drawnContracts} on the bench · `
    + `${plate.totals.peers} peers / ${plate.totals.deps} deps · ${plate.totals.optional} optional`);
} finally {
  basis.cleanup();
}

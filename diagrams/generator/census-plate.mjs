// Sheet 12 census — the PR CI task graph as a register plate, ported onto the
// pipeline (INITIATIVES.md I5, tier T3): the graph comes from `turbo run
// <pipeline> --dry=json` against a MATERIALIZED, INSTALLED archive of the ref
// (basis.mjs materialize + installDeps), never the working tree.  The tree's
// own .bin/turbo runs directly — never via pnpm, whose relative .bin PATH
// breaks turbo's spawn.  Banner goes to stderr; stdout is pure JSON.
// Writes diagrams/data/census-plate.json.
//
// Vocabulary:
//   node        — one (package, task) pair turbo put in the graph
//   real        — command !== "<NONEXISTENT>" (a script actually runs)
//   phantom     — command === "<NONEXISTENT>": a placeholder turbo mints so a
//                 `^task` chain has something to hang an edge on
//   real edge   — a dependency edge whose BOTH ends are real
//
// Output: a JSON blob on stdout (last line) for sheet12.mjs to eyeball, plus a
// human-readable matrix on stderr-free stdout above it.
import { execFileSync } from 'node:child_process';
import { installDeps, materialize, positionalsFromArgv, refFromArgv } from './basis.mjs';
import { writeData } from './census-query.mjs';

const PHANTOM = '<NONEXISTENT>';

const basis = materialize(refFromArgv());
process.on('exit', () => basis.cleanup());
const { turbo } = installDeps(basis);
let turboVersion = null;

function dry(pipeline) {
  const out = execFileSync(turbo, ['run', pipeline, '--dry=json'], {
    cwd: basis.dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 256 * 1024 * 1024,
  });
  return JSON.parse(out);
}

function analyse(j) {
  const tasks = j.tasks;
  const real = new Map(); // taskId -> bool
  for (const t of tasks) real.set(t.taskId, t.command !== PHANTOM);

  let edges = 0, realEdges = 0;
  for (const t of tasks) {
    for (const d of t.dependencies ?? []) {
      edges++;
      if (real.get(t.taskId) && real.get(d)) realEdges++;
    }
  }

  // longest chain (all nodes, and restricted to real nodes)
  const byId = new Map(tasks.map((t) => [t.taskId, t]));
  const memo = new Map();
  const depth = (id, filter) => {
    const k = filter + '|' + id;
    if (memo.has(k)) return memo.get(k);
    memo.set(k, 0); // cycle guard
    const t = byId.get(id);
    let best = filter === 'real' && !real.get(id) ? 0 : 1;
    let sub = 0;
    for (const d of t?.dependencies ?? []) sub = Math.max(sub, depth(d, filter));
    const v = filter === 'real' && !real.get(id) ? sub : Math.max(best, sub + 1);
    memo.set(k, v);
    return v;
  };
  let chain = 0, realChain = 0;
  for (const t of tasks) {
    chain = Math.max(chain, depth(t.taskId, 'all'));
    realChain = Math.max(realChain, depth(t.taskId, 'real'));
  }

  // per-task-name tallies
  const names = new Map();
  for (const t of tasks) {
    const n = names.get(t.task) ?? { name: t.task, nodes: 0, real: 0, pkgs: new Set() };
    n.nodes++;
    if (real.get(t.taskId)) n.real++;
    n.pkgs.add(t.package);
    names.set(t.task, n);
  }

  // cell matrix: package -> task -> 'real' | 'phantom'
  const cells = new Map();
  for (const t of tasks) {
    if (!cells.has(t.package)) cells.set(t.package, new Map());
    cells.get(t.package).set(t.task, real.get(t.taskId) ? 'r' : 'p');
  }

  const cacheFalse = tasks
    .filter((t) => t.resolvedTaskDefinition?.cache === false)
    .map((t) => t.taskId);

  return {
    nodes: tasks.length,
    real: tasks.filter((t) => real.get(t.taskId)).length,
    edges,
    realEdges,
    chain,
    realChain,
    packages: j.packages,
    names: [...names.values()].map((n) => ({ ...n, pkgs: n.pkgs.size })).sort((a, b) => b.nodes - a.nodes),
    cells,
    cacheFalse,
  };
}

const pipelines = positionalsFromArgv();
const want = pipelines.length ? pipelines : ['ci', 'ci:main', 'build', 'lint', 'pack:all'];
const results = {};
for (const p of want) {
  try {
    const j = dry(p);
    turboVersion ??= j.turboVersion;
    results[p] = analyse(j);
  } catch (e) {
    console.log(`# ${p}: FAILED — ${String(e.message).split('\n')[0]}`);
  }
}

const A = results.ci;
if (A) {
  const fan = A.names.filter((n) => n.nodes > 1);
  const tail = A.names.filter((n) => n.nodes === 1);
  console.log('== ci: task names by fan ==');
  for (const n of fan) console.log(`${n.name.padEnd(22)} nodes ${String(n.nodes).padStart(3)}  real ${String(n.real).padStart(3)}  ${n.real === 0 ? 'ALL PHANTOM' : ''}`);
  console.log(`\n== singleton tail (${tail.length}) ==`);
  for (const n of tail) console.log(`  ${[...(A.cells.keys())].find((p) => A.cells.get(p).has(n.name))}#${n.name} ${n.real ? '' : '(phantom)'}`);
  console.log('\n== matrix ==');
  const cols = fan.map((n) => n.name);
  for (const p of [...A.cells.keys()].sort()) {
    const row = cols.map((c) => ({ r: '#', p: '.', undefined: ' ' })[A.cells.get(p).get(c)]).join('');
    console.log(row, p);
  }
}

for (const [p, r] of Object.entries(results)) {
  console.log(`\n[${p}] nodes ${r.nodes} · real ${r.real} (${((r.real / r.nodes) * 100).toFixed(0)}%) · edges ${r.edges} · real←real ${r.realEdges} · chain ${r.chain} (real ${r.realChain}) · cache:false ${r.cacheFalse.length}`);
}

// ci:main delta
if (results.ci && results['ci:main']) {
  const base = new Set([...results.ci.cells].flatMap(([p, m]) => [...m.keys()].map((t) => `${p}#${t}`)));
  const extra = [...results['ci:main'].cells].flatMap(([p, m]) => [...m.keys()].map((t) => `${p}#${t}`)).filter((k) => !base.has(k));
  const byName = new Map();
  for (const k of extra) {
    const n = k.split('#')[1];
    byName.set(n, (byName.get(n) ?? 0) + 1);
  }
  console.log('\n== ci:main delta ==', extra.length, 'nodes across', byName.size, 'names:', [...byName].map(([n, c]) => `${n}×${c}`).join(' '));
}

const dump = Object.fromEntries(
  Object.entries(results).map(([p, r]) => [p, {
    nodes: r.nodes, real: r.real, edges: r.edges, realEdges: r.realEdges,
    chain: r.chain, realChain: r.realChain, cacheFalse: r.cacheFalse,
    names: r.names,
    cells: Object.fromEntries([...r.cells].map(([k, m]) => [k, Object.fromEntries(m)])),
  }]),
);
console.log('\nJSON>>' + JSON.stringify(dump));

writeData('census-plate.json', {
  ref: basis.ref,
  sha: basis.sha,
  commitDate: basis.commitDate,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: 'diagrams/generator/census-plate.mjs',
  used: `git archive ${basis.ref} @ ${basis.sha} + corepack pnpm install --frozen-lockfile`,
  wasAssociatedWith: [`turbo ${turboVersion}`, 'pnpm (corepack)'],
  pipelines: dump,
}, []);

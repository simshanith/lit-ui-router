// Sheet 3B census: per-task footprint + command mass for the PR `ci` graph.
// footprint = the dry-run `inputs` map (files the task hashes), counted per task.
// mass = command sloc: the package.json script line (1) + a .config/mise/config.toml
// `run` line (1) where the script delegates to `mise run` + the sloc of every repo
// script/bin file the command executes. Which file a command executes is a judgement,
// so it is encoded here in CITES, not inferred.
// sloc = scc 4.0.0 `Code` lines. Provision: `mise x aqua:boyter/scc@4.0.0`
// (bare `scc` is not an aqua name).  Ported onto the pipeline (INITIATIVES.md
// I5, tier T3): graph + every read comes from a materialized, INSTALLED
// archive of the ref (basis.mjs), never the working tree; the tree's own
// .bin/turbo runs directly — never via pnpm.  Writes
// diagrams/data/census-mass3b.json (rows + real task list, PROV-O meta).
import { readFileSync, mkdtempSync, copyFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { installDeps, materialize, refFromArgv } from './basis.mjs';
import { writeData } from './census-query.mjs';

const basis = materialize(refFromArgv());
process.on('exit', () => basis.cleanup());
const { turbo } = installDeps(basis);
const ROOT = basis.dir + '/';

// task id -> { mise: script delegates to `mise run`, files: repo scripts it executes }
// A judgement table, verified below against the ref's scripts + config.toml;
// drift prints loudly.
const CITES = {
  '//#check:docs-api-deps': { files: ['check-docs-api-deps.ts'] },
  '//#check:patches': { files: ['check-patches.ts'] },
  '//#format:check:toml': { mise: true, files: ['.config/mise/tasks/taplo'] },
  '//#lint:actionlint': { mise: true, files: [] },
  '//#lint:elements': {
    files: ['tools/lint-elements/src/lint-elements.ts', 'tools/warn-lanes/src/warn-lanes.core.ts'],
  },
  '//#lint:markdown': { mise: true, files: ['.config/mise/tasks/rumdl'] },
  '//#lint:shellcheck': { mise: true, files: ['.config/mise/tasks/shellcheck'] },
  '//#lint:templates': {
    files: [
      'tools/compat-guards/src/lit-analyzer-ts-guard.ts',
      'tools/lit-template-lint/src/lint-templates.ts',
    ],
  },
  '//#lint:toml': { mise: true, files: ['.config/mise/tasks/taplo'] },
  '//#lint:zizmor': { mise: true, files: [] },
  '@tools/dts-backtest#test': { files: ['tools/dts-backtest/run.ts'] },
  '@tools/release#check:exports': { files: ['tools/release/src/checks/check-exports.ts'] },
  '@tools/release#pack:all': { files: ['tools/release/src/steps/pack-all.ts'] },
  'docs#typecheck:vue': { files: ['tools/vue-check/bin.ts'] },
  'lit-ui-router#check:dev-split': { files: ['tools/oxc-emit/src/check-dev-split.ts'] },
  'ui-router-server#test:coverage': { files: ['tools/lcov-rebase/src/rebase-lcov.ts'] },
  'examples#build:embeds': { files: ['examples/build-embeds.ts'] },
};
// per-task-name rules for the bins shared across the package quarters
const BY_TASK = {
  'build:js': ['tools/oxc-emit/src/emit-js.ts'],
  'build:types': ['tools/oxc-emit/src/emit-dts.ts'],
  'check:bundle': ['tools/bundle-probe/src/check-bundle-inputs.ts'],
  'test:lit2-compat': ['tools/compat-guards/src/lit2-compat-guard.ts'],
  'typecheck:lit2': ['tools/compat-guards/src/lit2-compat-guard.ts'],
  'test:mobx6-compat': ['tools/compat-guards/src/mobx6-compat-guard.ts'],
  'typecheck:mobx6': ['tools/compat-guards/src/mobx6-compat-guard.ts'],
};

// stdout is pure JSON; the banner goes to stderr.
function dryRun() {
  const out = execFileSync(turbo, ['run', 'ci', '--dry=json'], {
    cwd: basis.dir,
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 1 << 28,
  });
  return JSON.parse(out);
}

// Batch scc over absolute paths; Location echoes each path verbatim. The mise file
// tasks are extensionless, and scc classifies by extension only, so they are counted
// through .sh copies (--remap-unknown does not reach explicitly named files).
function sccSloc(files) {
  const shim = mkdtempSync(join(tmpdir(), 'mass3b-'));
  const arg = new Map();
  for (const f of files) {
    if (/\.[a-z]+$/i.test(f)) { arg.set(ROOT + f, f); continue; }
    const p = join(shim, basename(f) + '.sh');
    copyFileSync(ROOT + f, p);
    arg.set(p, f);
  }
  const out = execFileSync(
    'mise',
    ['x', 'aqua:boyter/scc@4.0.0', '--', 'scc', '--by-file', '--format', 'json', ...arg.keys()],
    { maxBuffer: 1 << 26 },
  );
  const map = new Map();
  for (const lang of JSON.parse(out)) {
    for (const f of lang.Files) map.set(arg.get(f.Location), f.Code);
  }
  const missing = files.filter((f) => !map.has(f));
  if (missing.length) throw new Error('scc missed: ' + missing.join(' '));
  return map;
}

// Binaries this repo did not write: they contribute only the script line.
const EXTERNAL = new Set([
  'oxfmt', 'oxlint', 'tsc', 'eslint', 'vitest', 'node', 'vitepress', 'wrangler', 'typedoc',
  'concurrently', 'cypress', 'vite', 'turbo', 'rimraf', 'cem', 'mkdir', 'mise',
  'start-server-and-test', 'api-extractor', 'taplo', 'rumdl', 'shellcheck',
  'eslint-doc-generator',
]);
const MISE_TOML = readFileSync(ROOT + '.config/mise/config.toml', 'utf8');
const miseRunLine = (name) =>
  MISE_TOML.split(new RegExp(`^\\[tasks\\.${name}\\]$`, 'm'))[1]?.split(/^\[/m)[0]
    ?.match(/^run = "(.*)"$/m)?.[1] ?? '';

// bin name -> owning workspace dir (so `oxc-emit-js` resolves to tools/oxc-emit),
// plus that dir's one-hop workspace deps: a bin may cite a library it pulls in.
function binOwners(dirs) {
  const pkgs = dirs.map((d) => [d, JSON.parse(readFileSync(ROOT + join(d, 'package.json'), 'utf8'))]);
  const byName = new Map(pkgs.map(([d, p]) => [p.name, d]));
  const owners = new Map();
  for (const [d, p] of pkgs) {
    const deps = Object.keys({ ...p.dependencies, ...p.devDependencies })
      .map((n) => byName.get(n))
      .filter(Boolean);
    for (const b of Object.keys(p.bin ?? {})) owners.set(b, [d, ...deps]);
  }
  return owners;
}

// Each cited file must still be reachable from the command, and every repo-written
// executable the command names must be cited (bins are cited one hop past their thin
// shim, so a cite anywhere in the bin's own package counts). Anything else is drift
// to resolve by hand — CITES is a judgement, never inferred.
function verify(t, rule, bins) {
  const out = [];
  const segs = t.command.split(/&&|\|\|/).map((s) => s.trim().replace(/^(\w+=\S+\s+)+/, ''));
  const exes = segs.map((s) => s.split(/\s+/)[0]).filter(Boolean);
  const files = rule?.files ?? [];
  if (rule?.mise) {
    const run = miseRunLine(segs.find((s) => s.startsWith('mise '))?.split(/\s+/)[2] ?? '');
    if (!run) out.push(`declared mise-run but ${JSON.stringify(t.command)} resolves to no run line`);
    for (const f of files) {
      if (!run.includes(basename(f))) out.push(`cites ${f}, but the run line is ${JSON.stringify(run)}`);
    }
    return out;
  }
  const owned = exes.flatMap((e) => bins.get(e) ?? []).map((d) => d + '/');
  for (const f of files) {
    const ok = t.command.includes(basename(f)) || owned.some((d) => f.startsWith(d));
    if (!ok) out.push(`cites ${f} but runs ${JSON.stringify(t.command)}`);
  }
  for (const e of exes) {
    if (EXTERNAL.has(e)) continue;
    if (!bins.has(e)) { out.push(`unrecognised executable \`${e}\``); continue; }
    const home = bins.get(e)[0] + '/';
    if (!files.some((f) => f.startsWith(home))) out.push(`runs repo-written \`${e}\` (${home}) with no cite`);
  }
  return out;
}

const graph = dryRun();
const real = graph.tasks.filter((t) => t.command && t.command !== '<NONEXISTENT>');
console.log(`turbo ${graph.turboVersion} · ${graph.tasks.length} nodes · ${real.length} real`);

const cited = [...new Set(Object.values(CITES).flatMap((c) => c.files).concat(Object.values(BY_TASK).flat()))];
const sloc = sccSloc(cited);
const bins = binOwners([...new Set(real.map((t) => t.directory || '.'))]);

const rows = [];
const drift = [];
for (const t of real) {
  const rule = CITES[t.taskId] ?? (BY_TASK[t.task] ? { files: BY_TASK[t.task] } : null);
  const files = rule?.files ?? [];
  const cites = ['script line'];
  let mass = 1;
  if (rule?.mise) { cites.push('config.toml run line'); mass += 1; }
  for (const f of files) { cites.push(`${f} (${sloc.get(f)})`); mass += sloc.get(f); }
  for (const w of verify(t, rule, bins)) drift.push(`${t.taskId}: ${w}`);
  rows.push({
    id: t.taskId,
    pkg: t.package,
    task: t.task,
    dir: t.directory,
    inputs: Object.keys(t.inputs).length,
    mass,
    cites,
  });
}
rows.sort((a, b) => a.id.localeCompare(b.id));

const tasks = real
  .map((t) => ({
    id: t.taskId,
    pkg: t.package,
    task: t.task,
    inputs: Object.keys(t.inputs).length,
    cmd: t.command,
    deps: t.dependencies.length,
    dependents: t.dependents.length,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

for (const d of drift) console.log('DRIFT', d);
console.log('mass 1:', rows.filter((r) => r.mass === 1).length, 'of', rows.length);
console.log('command sloc total:', rows.reduce((a, r) => a + r.mass, 0));
console.log('task-file hashes:', rows.reduce((a, r) => a + r.inputs, 0));

writeData('census-mass3b.json', {
  ref: basis.ref,
  sha: basis.sha,
  commitDate: basis.commitDate,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: 'diagrams/generator/census-mass3b.mjs',
  used: `git archive ${basis.ref} @ ${basis.sha} + corepack pnpm install --frozen-lockfile`,
  wasAssociatedWith: [`turbo ${graph.turboVersion}`, 'scc 4.0.0 (mise x aqua:boyter/scc)', 'pnpm (corepack)'],
  drift,
  rows,
  tasks,
}, ['drift', 'rows', 'tasks']);

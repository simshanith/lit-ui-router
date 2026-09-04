// Sheet 7A census — the SHADOW SURVEY's metering, ported onto the pipeline
// (INITIATIVES.md I5, tier T3).  This is the last probe that was ever
// hand-pasted: the 2026-08-17 figures came from a bespoke generator in tmp/
// that is gone.  Reconstructed here to the rules sheet 7A's own header
// narrated, so the light can be re-metered at any ref the census is pinned to.
//
// Basis: a MATERIALIZED, INSTALLED archive of the ref (basis.mjs) — never the
// working tree.  Every member is metered under ITS OWN suite's meter, with the
// repo's own scripts, and nothing in the tree is edited:
//   test:coverage members — the tree's own `turbo run test:coverage`, unmodified
//   node:test members     — the member's own `test` script re-run with
//                           --experimental-test-coverage + the lcov reporter
//   vitest members        — the member's own `test` script re-run with
//                           --coverage.enabled --coverage.provider=v8
// Suites run SEQUENTIALLY (the vitest packages pin browser API ports) and each
// one's output is logged to its own file under the printed log directory.
//
// Vocabulary (sheet 7A's):
//   LIT     — a src file the suite actually executed (an lcov record with a hit)
//   SHADOW  — a member src file no run of its own suite ever loads
//   extent  — lit sloc / the member's census src sloc, both at THIS ref
//   cat     — m metered · e e2e light only · u tests run, no meter attaches ·
//             n no self-suite · z no source mass
//
// Coverage percentages are per-meter and never summed across meters (v8 remaps
// to executable lines, node counts raw lines) — the plate carries both the
// per-member percentages and the raw numerators, and the sheet says which.
// Writes diagrams/data/census-shadow.json.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { discoverMembers, installDeps, materialize, refFromArgv } from './basis.mjs';
import { cityUniverse, loadCensus, writeData } from './census-query.mjs';

const CABINET = loadCensus();
// Default ref is the CABINET's sha, not a branch tip: a plate filed later must
// measure the tree its siblings measured, or census-atlas throws on the ref.
const PINNED = !process.argv.slice(2).includes('--ref');
const REF = PINNED ? CABINET.sha : refFromArgv();
// `--dry` meters and prints without filing: a fidelity run at an OLDER ref must
// never leave a plate behind, or the cabinet splits across two shas.
const DRY = process.argv.slice(2).includes('--dry');

// ---- editorial judgements (the only two in this probe) ----------------------
// (1) e2e light: members no meter reads, but the cypress rig demonstrably
//     drives — the two demo apps it mounts, and the rig itself.  Cypress emits
//     no lcov, so this cannot be derived from a coverage artifact; it is
//     declared, and verified below against the rig's own cypress scripts.
const E2E = new Set([
  'apps/sample-app-lit-vanilla',
  'apps/sample-app-lit-mobx',
  'apps/sample-app-lit-e2e',
]);
// (2) runners this probe knows how to attach a meter to.  A `test` script that
//     runs anything else is not a self-suite (tools/dts-backtest's `node run.ts`
//     backtests the PACKAGES' d.ts, it does not test itself) and reads as `n`.
const RUNNER = (cmd) =>
  /(^|\s)node\s+(--\S+\s+)*--test(\s|$)/.test(cmd) ? 'node'
    : /(^|\s)vitest\s+run(\s|$)/.test(cmd) ? 'vitest'
      : /(^|\s)cypress(\s|$)|start-server-and-test/.test(cmd) ? 'cypress' : null;

// ---- basis ------------------------------------------------------------------
const basis = materialize(REF);
process.on('exit', () => basis.cleanup());
const LOGS = mkdtempSync(join(tmpdir(), `shadow-${basis.sha}-`));
console.log(`census-shadow: ${basis.ref} @ ${basis.sha} — logs in ${LOGS}`);

const { turbo } = installDeps(basis);
// pnpm links a member's own bins into ITS node_modules/.bin, not the root's
const bin = (dir, name) => {
  const own = join(basis.dir, dir, 'node_modules', '.bin', name);
  return existsSync(own) ? own : join(basis.dir, 'node_modules', '.bin', name);
};
const nodeVersion = process.version;
const turboVersion = execFileSync(turbo, ['--version'], { cwd: basis.dir, encoding: 'utf8' }).trim();

// ---- the file universe at THIS ref -----------------------------------------
// At the cabinet's own sha the master plate IS the measurement, so it is read
// rather than re-run — sheet 7A and sheet 7 then reconcile by construction; at
// any other ref the same scc run census-scc.mjs makes is repeated here, so a
// fidelity check at an older ref counts by the same ruler.
const SCC = 'aqua:boyter/scc@4.0.0';
const snapshot = () => {
  if (basis.sha === CABINET.sha) return CABINET;
  const langs = JSON.parse(execFileSync('mise',
    ['x', SCC, '--', 'scc', '--by-file', '--format', 'json', ...basis.files],
    { cwd: basis.dir, maxBuffer: 1 << 26 }).toString('utf8'));
  const rows = langs
    .flatMap((l) => l.Files.map((f) => ({ path: f.Location, lang: l.Name, code: f.Code })))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  return { members: discoverMembers(basis), rows };
};
const snap = snapshot();
const { members, files } = cityUniverse(snap);

const pkgJson = (dir) => JSON.parse(readFileSync(join(basis.dir, dir, 'package.json'), 'utf8'));

// the e2e judgement is verified, never assumed: the rig must still be a cypress
// suite at this ref, and every member it is claimed to light must still exist
for (const d of E2E) {
  if (!members.some((m) => m.dir === d)) throw new Error(`census-shadow: E2E names ${d}, absent at this ref — update the table`);
}
if (RUNNER(pkgJson('apps/sample-app-lit-e2e').scripts?.test ?? '') !== 'cypress') {
  throw new Error('census-shadow: apps/sample-app-lit-e2e no longer runs a cypress suite — the e2e judgement needs re-reading');
}

// ---- lcov ------------------------------------------------------------------
// Parsed for LF/LH/BRF/BRH/FNF/FNH per source file.  SF paths differ by tool:
// node --test writes them relative to its cwd, vitest absolute, and the repo's
// own rebase-lcov rewrites them to REPO-relative (its whole reason to exist —
// four packages own a src/index.ts).  So each SF is resolved against both the
// run's cwd and the tree root, and the candidate that names a real file wins —
// one comparable key for every meter.
const keyOf = (sf, cwd) => {
  const cand = [resolve(cwd, sf), resolve(basis.dir, sf)];
  return relative(basis.dir, cand.find((p) => existsSync(p)) ?? cand[0]);
};
function parseLcov(file, cwd) {
  const out = new Map();
  if (!existsSync(file)) return out;
  let cur = null;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('SF:')) {
      const p = keyOf(line.slice(3), cwd);
      cur = out.get(p) ?? { path: p, lf: 0, lh: 0, brf: 0, brh: 0, fnf: 0, fnh: 0 };
      out.set(p, cur);
    } else if (!cur) continue;
    else if (line.startsWith('LF:')) cur.lf += +line.slice(3);
    else if (line.startsWith('LH:')) cur.lh += +line.slice(3);
    else if (line.startsWith('BRF:')) cur.brf += +line.slice(4);
    else if (line.startsWith('BRH:')) cur.brh += +line.slice(4);
    else if (line.startsWith('FNF:')) cur.fnf += +line.slice(4);
    else if (line.startsWith('FNH:')) cur.fnh += +line.slice(4);
    else if (line === 'end_of_record') cur = null;
  }
  return out;
}

// ---- running a suite --------------------------------------------------------
// Quote-aware split: the globs in these scripts are quoted and must survive as
// ONE argv entry — node and vitest expand them themselves.
function tokenize(cmd) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(cmd))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}
// leading VAR=value assignments are the script's env, not its argv
function splitEnv(cmd) {
  const toks = tokenize(cmd);
  const env = {};
  while (toks.length && /^[A-Z_][A-Z0-9_]*=/.test(toks[0])) {
    const [k, ...v] = toks.shift().split('=');
    env[k] = v.join('=');
  }
  return { env, toks };
}

const run = (label, file, args, opts = {}) => {
  const log = join(LOGS, `${label}.log`);
  const t0 = Date.now();
  let ok = true, err = null;
  try {
    const out = execFileSync(file, args, {
      cwd: opts.cwd ?? basis.dir,
      env: { ...process.env, CI: '', ...opts.env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 28,
      timeout: 20 * 60 * 1000,
    });
    writeFileSync(log, out);
  } catch (e) {
    ok = false;
    // the tmpdir is per-run: a plate that carried it would never diff clean
    err = String(e.message).split('\n')[0].replaceAll(basis.dir, '<archive>');
    writeFileSync(log, `${err}\n\n--- stdout ---\n${e.stdout ?? ''}\n--- stderr ---\n${e.stderr ?? ''}`);
  }
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label} (${((Date.now() - t0) / 1000).toFixed(0)}s) -> ${log}`);
  return { ok, err, log };
};

// ---- the one unmodified turbo pass, for every member that declares one ------
const TURBO_MEMBERS = members.filter((m) => pkgJson(m.dir).scripts?.['test:coverage']);
if (TURBO_MEMBERS.length) {
  console.log(`turbo run test:coverage — ${TURBO_MEMBERS.length} members declare it`);
  run('turbo-test-coverage', turbo, ['run', 'test:coverage']);
}

// ---- per member -------------------------------------------------------------
const rows = [];
for (const m of members) {
  const mine = files.filter((f) => f.member === m.dir);
  const src = mine.filter((f) => !f.spec);
  const spec = mine.filter((f) => f.spec);
  const srcSloc = src.reduce((a, f) => a + f.code, 0);
  const specSloc = spec.reduce((a, f) => a + f.code, 0);
  const sloc = new Map(src.map((f) => [f.path, f.code]));
  const base = {
    member: m.dir,
    name: m.name,
    srcFiles: src.length,
    srcSloc,
    specFiles: spec.length,
    specSloc,
  };
  const scripts = pkgJson(m.dir).scripts ?? {};
  const suite = scripts['test:coverage'] ? 'test:coverage' : scripts.test ? 'test' : null;
  const cmd = suite ? scripts[suite] : null;
  const runner = cmd ? RUNNER(cmd) : null;

  const file = (label) => join(LOGS, `${label}.lcov`);
  let cov = null, recipe = null, cat = null, note = null, attached = false;

  if (!srcSloc) {
    cat = 'z';
    recipe = 'none — no source mass';
  } else if (scripts['test:coverage']) {
    recipe = `turbo run test:coverage (${cmd})`;
    const lcov = join(basis.dir, m.dir, 'coverage', 'lcov.info');
    attached = existsSync(lcov);
    cov = parseLcov(lcov, join(basis.dir, m.dir));
  } else if (runner === 'node') {
    const label = m.name.replace(/[@/]/g, '_');
    const { env, toks } = splitEnv(cmd);
    const i = toks.indexOf('--test');
    const args = [
      ...toks.slice(1, i + 1),
      '--experimental-test-coverage',
      '--test-reporter=spec', '--test-reporter-destination=stdout',
      '--test-reporter=lcov', `--test-reporter-destination=${file(label)}`,
      ...toks.slice(i + 1),
    ];
    recipe = `node --test --experimental-test-coverage (${cmd})`;
    const r = run(label, toks[0], args, { cwd: join(basis.dir, m.dir), env });
    attached = existsSync(file(label));
    cov = parseLcov(file(label), join(basis.dir, m.dir));
    if (!r.ok) note = r.err;
  } else if (runner === 'vitest') {
    const label = m.name.replace(/[@/]/g, '_');
    const { env, toks } = splitEnv(cmd);
    const dir = join(basis.dir, m.dir, '.shadow-cov');
    const args = [
      ...toks.slice(1),
      '--coverage.enabled', '--coverage.provider=v8',
      '--coverage.reporter=lcov', `--coverage.reportsDirectory=${dir}`,
    ];
    recipe = `vitest run --coverage.enabled --coverage.provider=v8 (${cmd})`;
    const r = run(label, bin(m.dir, toks[0]), args, { cwd: join(basis.dir, m.dir), env });
    attached = r.ok;
    cov = parseLcov(join(dir, 'lcov.info'), join(basis.dir, m.dir));
    rmSync(dir, { recursive: true, force: true });
    // A meter that ATTACHED and found nothing of this member's own is a real
    // reading (tools/happy-dom's canary lights happy-dom upstream, never its
    // own source) — `m` at extent 0.  `u` is only for a meter that would not
    // attach at all, and that is proved by re-running the suite without one.
    if (!r.ok) {
      const plain = run(`${label}-plain`, bin(m.dir, toks[0]), toks.slice(1),
        { cwd: join(basis.dir, m.dir), env });
      cat = plain.ok ? 'u' : 'n';
      note = plain.ok
        ? `suite passes, no meter attaches — ${r.err}`
        : (r.err ?? plain.err);
    }
  } else if (runner === 'cypress' || E2E.has(m.dir)) {
    cat = 'e';
    recipe = cmd ? `cypress (${cmd}) — emits no lcov` : 'driven by the cypress rig — emits no lcov';
  } else {
    cat = 'n';
    recipe = cmd ? `\`${cmd}\` is not a self-suite` : 'no test script';
  }

  if (E2E.has(m.dir) && cat === null) cat = 'e';

  if (cat === null) {
    const lit = [...cov.values()].filter((r) => sloc.has(r.path) && r.lh > 0);
    if (!attached) {
      cat = 'u';
      note ??= 'the suite ran but no meter left an lcov behind';
    } else {
      cat = 'm';
      const sum = (k) => lit.reduce((a, r) => a + r[k], 0);
      const litSloc = lit.reduce((a, r) => a + sloc.get(r.path), 0);
      const pct = (h, f) => (f ? +((h / f) * 100).toFixed(1) : null);
      Object.assign(base, {
        litFiles: lit.length,
        litSloc,
        extent: +((litSloc / srcSloc) * 100).toFixed(1),
        lines: sum('lf'), linesHit: sum('lh'), line: pct(sum('lh'), sum('lf')),
        branches: sum('brf'), branchesHit: sum('brh'), branch: pct(sum('brh'), sum('brf')),
        funcs: sum('fnf'), funcsHit: sum('fnh'), func: pct(sum('fnh'), sum('fnf')),
        shadow: src.map((f) => f.path).filter((p) => !lit.some((r) => r.path === p))
          .map((p) => p.slice(m.dir.length + 1)),
      });
    }
  }

  rows.push({ ...base, cat, suite, recipe, ...(note ? { note } : {}) });
  const b = base;
  console.log(`${cat}  ${m.dir.padEnd(40)} ${String(srcSloc).padStart(5)} src sloc`
    + (cat === 'm'
      ? ` · lit ${b.litFiles}/${src.length}f ${b.litSloc}/${srcSloc} (${b.extent}%) · L ${b.line} B ${b.branch} F ${b.func}`
      : ` · ${recipe}`));
}

// ---- totals (metered members only; the meters differ, and the plate says so) -
const met = rows.filter((r) => r.cat === 'm');
const T = (k) => met.reduce((a, r) => a + (r[k] ?? 0), 0);
const totals = {
  metered: met.length,
  lines: T('lines'), linesHit: T('linesHit'),
  branches: T('branches'), branchesHit: T('branchesHit'),
  funcs: T('funcs'), funcsHit: T('funcsHit'),
  litSloc: T('litSloc'), meteredSrcSloc: T('srcSloc'),
  byCat: Object.fromEntries(['m', 'e', 'u', 'n', 'z'].map((c) => [c, rows.filter((r) => r.cat === c).length])),
};
console.log('TOTALS', JSON.stringify(totals));

const plate = {
  // Pinned to the cabinet's sha but FILED under the cabinet's ref name: the sha
  // is the same tree, and census-atlas requires one ref string across the drawer.
  ref: PINNED ? CABINET.ref : basis.ref,
  sha: basis.sha,
  commitDate: basis.commitDate,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: 'diagrams/generator/census-shadow.mjs',
  used: `git archive ${PINNED ? CABINET.ref : basis.ref} @ ${basis.sha} + corepack pnpm install --frozen-lockfile`,
  wasAssociatedWith: [`turbo ${turboVersion}`, `node ${nodeVersion}`, 'vitest (the tree\'s own)', 'pnpm (corepack)'],
  note: 'REPLACES the 2026-08-17 hand-pasted metering: every figure here is re-metered at this ref, so sheet 7A\'s light and sheet 7\'s census are now the same measurement of the same tree.',
  totals,
  rows,
};
if (DRY) console.log('--dry: nothing filed\n' + JSON.stringify(plate, null, 1));
else writeData('census-shadow.json', plate, ['rows']);

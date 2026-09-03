// Sheet 2 brick census, ported onto the pipeline (INITIATIVES.md I2): the
// published packages are a QUERY over the master snapshot (members discovered,
// not listed — a new published package becomes a brick automatically).  The
// @uirouter/core baseplate is fetched HERE, no scratch clone: the npm tarball
// ships only built lib/, so the probe pulls the version-pinned SOURCE tarball
// from codeload.github.com (same archive-basis philosophy as basis.mjs) and
// runs scc over its src/ — `--core <version>` to pin, default = npm latest.
// Counted: .ts/.tsx/.js/.jsx/.mjs under src/, excluding *.d.ts,
// *.{spec,test}.*, typedoc stubs, and test dirs.  sloc = scc `Code`.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadCensus, provenance, writeData } from './census-query.mjs';

const snap = loadCensus();
const EXT = /\.(tsx?|jsx?|mjs)$/;
const SKIP_FILE = (f) => /\.d\.ts$/.test(f) || /\.(spec|test)\./.test(f) || /\.typedoc\./.test(f);
const SKIP_SEG = new Set(['specs', 'test', 'tests', '__tests__', '__test__', 'node_modules']);
const keep = (rel) => EXT.test(rel) && !SKIP_FILE(basename(rel))
  && !rel.split('/').slice(0, -1).some((seg) => SKIP_SEG.has(seg));

const argv = process.argv.slice(2);
const flag = argv.indexOf('--core');
const coreVersion = flag !== -1 && argv[flag + 1]
  ? argv[flag + 1]
  : execFileSync('npm', ['view', '@uirouter/core', 'version']).toString().trim();

const tmp = mkdtempSync(join(tmpdir(), 'census-bricks-core-'));
let core;
try {
  const res = await fetch(`https://codeload.github.com/ui-router/core/tar.gz/${coreVersion}`);
  if (!res.ok) throw new Error(`core source tarball ${coreVersion}: HTTP ${res.status}`);
  writeFileSync(join(tmp, 'core.tgz'), Buffer.from(await res.arrayBuffer()));
  execFileSync('tar', ['-xzf', 'core.tgz'], { cwd: tmp });

  const root = `core-${coreVersion}`;
  const walk = (dir, out = []) => {
    for (const e of readdirSync(join(tmp, dir), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`, out);
      else out.push(`${dir}/${e.name}`);
    }
    return out;
  };
  const files = walk(`${root}/src`).filter((f) => keep(f.slice(root.length + 1)));
  const langs = JSON.parse(execFileSync('mise',
    ['x', 'aqua:boyter/scc@4.0.0', '--', 'scc', '--by-file', '--format', 'json', ...files],
    { cwd: tmp, maxBuffer: 1 << 26 }).toString('utf8'));
  const sloc = langs.flatMap((l) => l.Files).reduce((a, f) => a + f.Code, 0);
  core = { name: '@uirouter/core', version: coreVersion, files: files.length, sloc };
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const locals = snap.members
  .filter((m) => !m.private)
  .map((m) => {
    const files = snap.rows.filter((r) =>
      r.path.startsWith(`${m.dir}/src/`) && keep(r.path.slice(m.dir.length + 1)));
    return { name: m.name, version: m.version, files: files.length, sloc: files.reduce((a, f) => a + f.code, 0) };
  })
  .sort((a, b) => b.sloc - a.sloc);

// The quantization rule drawn on sheet 2 rev B.
const STUDS = (s) => Math.max(1, Math.ceil(s / 150));
const SHAPE = (n) =>
  n <= 1 ? '1x1' : n <= 2 ? '1x2' : n <= 4 ? '2x2' : n <= 6 ? '2x3' : '2x4';
const COURSES = (f) => Math.max(1, Math.ceil(f / 3));

const rows = [core, ...locals].map((p) =>
  [p.name, p.files, p.sloc, STUDS(p.sloc), SHAPE(STUDS(p.sloc)), COURSES(p.files), p.version]);
for (const r of rows)
  console.log(
    r[0].padEnd(38),
    String(r[1]).padStart(3) + 'f',
    String(r[2]).padStart(6) + ' sloc',
    String(r[3]).padStart(3) + ' studs',
    r[4].padStart(4),
    String(r[5]) + ' courses',
  );
console.log(JSON.stringify(rows));

writeData('census-bricks.json', {
  ...provenance(snap, 'diagrams/generator/census-bricks.mjs',
    ['scc 4.0.0 (mise x aqua:boyter/scc)', `codeload.github.com ui-router/core@${coreVersion} source tarball`]),
  rows: rows.map(([name, files, sloc, studs, shape, courses, version]) =>
    ({ name, version, files, sloc, studs, shape, courses })),
});

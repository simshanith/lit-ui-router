// I16 plate: each consumer census-builds.mjs surveys, massed at sheet 2's mould from its authored source.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { materialize } from './basis.mjs';
import { CITY_DIRS, loadCensus, onCityRuler, provenance, writeData } from './census-query.mjs';
import { COURSES, FILES_PER_COURSE, SHAPE, SLOC_PER_STUD, STUDS } from './sheet2.mjs';

const SCC = 'aqua:boyter/scc@4.0.0';
const BUILDS = JSON.parse(readFileSync(new URL('../data/census-builds.json', import.meta.url), 'utf8'));
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  if (!argv.includes(name)) return fallback;
  const v = argv[argv.indexOf(name) + 1];
  if (!v || v.startsWith('--')) throw new Error('usage: node census-consumers.mjs [--ref <cabinet ref>] [--atlas-ref <atlas ref>]');
  return v;
};
const snap = loadCensus();
// the cabinet's sha and the atlas sha census-builds.json read, unless a ref is named
const REF = flag('--ref', BUILDS.ref);
const ATLAS_REF = flag('--atlas-ref', BUILDS.basis.atlasApp.ref);
const ATLAS = BUILDS.basis.atlasApp.dir;
// written by build.mjs, not authored
const GENERATED = new Map([[ATLAS, ['src/generated/']]]);

// a consumer's authored dirs: the city's editorial dirs, else src/, else its root
const dirsOf = (dir, paths) => CITY_DIRS.get(dir) ?? (paths.some((p) => p.startsWith(`${dir}/src/`)) ? ['src'] : ['.']);
const authored = (dir, paths) => {
  const prefixes = dirsOf(dir, paths).map((d) => (d === '.' ? `${dir}/` : `${dir}/${d}/`));
  return paths.filter((p) => {
    if (!prefixes.some((x) => p.startsWith(x))) return false;
    const rel = p.slice(dir.length + 1);
    if ((GENERATED.get(dir) ?? []).some((g) => rel.startsWith(g))) return false;
    const ruled = onCityRuler(rel);
    return ruled && !ruled.spec;
  });
};
// scc's Code per file: the master plate's rows at the cabinet's sha, a fresh scc --by-file pass over the archive otherwise
const sccRows = (basis, files) => {
  if (!files.length) return new Map();
  const langs = JSON.parse(execFileSync('mise', ['x', SCC, '--', 'scc', '--by-file', '--format', 'json', ...files], { cwd: basis.dir, maxBuffer: 1 << 26 }).toString('utf8'));
  return new Map(langs.flatMap((l) => l.Files.map((f) => [f.Location, f.Code])));
};
const mould = (files, sloc) => {
  const studs = STUDS(sloc), [w, d] = SHAPE(studs);
  return { files, sloc, studs, shape: `${w}x${d}`, courses: COURSES(files) };
};

const basis = materialize(argv.includes('--ref') ? REF : BUILDS.sha);
const atlasBasis = materialize(argv.includes('--atlas-ref') ? ATLAS_REF : BUILDS.basis.atlasApp.sha);
try {
  if (basis.sha !== BUILDS.sha) throw new Error(`census-consumers: ${REF} is ${basis.sha} but census-builds.json is at ${BUILDS.sha} — refile census-builds.json at that ref first`);
  if (atlasBasis.sha !== BUILDS.basis.atlasApp.sha)
    throw new Error(`census-consumers: ${ATLAS_REF} is ${atlasBasis.sha} but census-builds.json reads the atlas app at ${BUILDS.basis.atlasApp.sha} — refile census-builds.json with --atlas-ref ${ATLAS_REF} first`);
  const fromPlate = basis.sha === snap.sha;
  const cabinetFiles = (dir) => (fromPlate ? snap.rows.map((r) => r.path) : basis.files).filter((p) => p.startsWith(`${dir}/`));
  const cabinetCode = fromPlate ? new Map(snap.rows.map((r) => [r.path, r.code])) : null;

  const measure = (c, b) => {
    const paths = b === atlasBasis ? atlasBasis.files.filter((p) => p.startsWith(`${c.dir}/`)) : cabinetFiles(c.dir);
    let files = authored(c.dir, paths);
    const code = b === atlasBasis || !cabinetCode ? sccRows(b, files) : cabinetCode;
    // scc names a language for every file the city ruler keeps
    files = files.filter((p) => code.has(p));
    if (!files.length) throw new Error(`census-consumers: ${c.name} has no authored file under ${dirsOf(c.dir, paths).join(', ')}`);
    return {
      name: c.name, dir: c.dir, kind: c.kind, dirs: dirsOf(c.dir, paths), pinned: c.pinned, parts: c.parts,
      build: c.parts.length ? c.parts.join(' + ') : null, ...mould(files.length, files.reduce((a, p) => a + code.get(p), 0)),
    };
  };
  const totals = (rows) => ({
    consumers: rows.length, files: rows.reduce((a, r) => a + r.files, 0), sloc: rows.reduce((a, r) => a + r.sloc, 0), studs: rows.reduce((a, r) => a + r.studs, 0),
    builds: new Set(rows.map((r) => r.build).filter(Boolean)).size,
  });

  const rows = BUILDS.consumers.map((c) => measure(c, basis));
  const atlasRow = BUILDS.withAtlas.consumers.filter((c) => !BUILDS.consumers.some((x) => x.name === c.name));
  if (atlasRow.length !== 1 || atlasRow[0].dir !== ATLAS) throw new Error('census-consumers: the second reading of census-builds.json should add the atlas app alone');
  if (BUILDS.withAtlas.consumers.slice(0, rows.length).some((c, i) => c.name !== rows[i].name)) throw new Error('census-consumers: the two readings list the cabinet consumers differently');
  const withRows = [...rows, measure(atlasRow[0], atlasBasis)];

  const plate = {
    ...provenance({ ref: REF, sha: basis.sha, commitDate: basis.commitDate }, 'www/atlas.lit-ui-router.dev/generator/census-consumers.mjs', ['scc 4.0.0 (mise x aqua:boyter/scc)', 'git']),
    used: `${fromPlate ? `www/atlas.lit-ui-router.dev/data/census-files.json @ ${snap.sha}` : `git archive ${REF} @ ${basis.sha} + scc --by-file`} for the cabinet's consumers; git archive ${ATLAS_REF} @ ${atlasBasis.sha} + scc --by-file for ${ATLAS}; consumers, pins and builds from census-builds.json @ ${BUILDS.sha}`,
    rule: `authored = the city ruler (census-query.mjs onCityRuler, specs aside) over the consumer's CITY_DIRS entry, else src/, else its root; ${ATLAS}/src/generated/ aside · sloc = scc Code · studs = 1 per ${SLOC_PER_STUD} sloc rounded up, shape = sheet 2's SHAPE, courses = 1 per ${FILES_PER_COURSE} files rounded up`,
    totals: totals(rows),
    rows,
    basis: {
      atlasApp: { ref: ATLAS_REF, sha: atlasBasis.sha, commitDate: atlasBasis.commitDate, dir: ATLAS },
      note: `${ATLAS} is on ${ATLAS_REF} @ ${atlasBasis.sha}, off the cabinet's tree; the second reading adds it`,
    },
    withAtlas: { totals: totals(withRows), rows: withRows },
  };
  writeData('census-consumers.json', plate, ['rows', 'withAtlas.rows']);

  console.log(`census-consumers.json: ${REF} @ ${basis.sha} (${fromPlate ? 'census-files rows' : 'scc'}) · atlas app from ${ATLAS_REF} @ ${atlasBasis.sha}`);
  for (const r of withRows)
    console.log(' ', r.name.padEnd(28), r.kind.padEnd(10), r.dirs.join(',').padEnd(22), String(r.files).padStart(3) + 'f', String(r.sloc).padStart(6) + ' sloc', String(r.studs).padStart(3) + ' studs', r.shape.padStart(4), String(r.courses).padStart(2) + ' courses', '·', r.pinned.join(' + ') || '—');
  for (const [label, t] of [['cabinet', plate.totals], ['with the atlas app', plate.withAtlas.totals]])
    console.log(`${label}: ${t.consumers} consumers · ${t.builds} builds · ${t.files} files · ${t.sloc} sloc · ${t.studs} studs`);
} finally {
  basis.cleanup();
  atlasBasis.cleanup();
}

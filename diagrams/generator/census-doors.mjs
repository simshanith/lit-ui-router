// Per-entry bundle probe behind sheet 11 (INITIATIVES.md I5, tier T3): every
// exported entry ("door") of every publishable package bundled ALONE with
// rolldown — minified, declared deps + peers external, annotations off — the
// price a consumer pays at that door, and exactly the <pkg>-<label>-esm series
// the repo uploads to codecov.  Measured inside a MATERIALIZED, INSTALLED
// archive of the ref (basis.mjs), never the working tree; the repo's own
// tools/bundle-probe is imported FROM THAT ARCHIVE, so the recipe measured is
// the ref's recipe, resolved against the ref's rolldown.
// Writes diagrams/data/census-doors.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { installDeps, materialize, refFromArgv } from './basis.mjs';
import { loadCensus, writeData } from './census-query.mjs';

const basis = materialize(refFromArgv());
process.on('exit', () => basis.cleanup());
installDeps(basis);

// Import the archive's own probe machinery: node 24 strips the types, and the
// specifiers inside (@tools/shared, rolldown) resolve by walking up from these
// files — i.e. against the archive's freshly installed node_modules.
const probeSrc = join(basis.dir, 'tools', 'bundle-probe', 'src');
const { readPackageProbe } = await import(pathToFileURL(join(probeSrc, 'entries.ts')).href);
const { bundleEntry } = await import(pathToFileURL(join(probeSrc, 'bundle.ts')).href);

const rolldownVersion = (() => {
  for (const base of [join(basis.dir, 'tools', 'bundle-probe'), basis.dir]) {
    try {
      return JSON.parse(readFileSync(join(base, 'node_modules', 'rolldown', 'package.json'), 'utf8')).version;
    } catch { /* keep looking */ }
  }
  return null;
})();

const snap = loadCensus();
const members = snap.members.filter((m) => !m.private);
const doorOf = (label) => (label === 'index' ? '.' : `./${label}`);

const rows = [];
for (const m of members) {
  const dir = join(basis.dir, m.dir);
  let probe;
  try {
    probe = readPackageProbe(dir);
  } catch (err) {
    rows.push({ pkg: m.name, door: '*', min: null, gz: null, error: String(err.message ?? err) });
    continue;
  }
  for (const { label, file } of probe.entries) {
    const door = doorOf(label);
    try {
      const { chunks } = await bundleEntry(file, 'rolldown', {
        minify: true,
        external: probe.declared,
        annotations: false,
      });
      const min = chunks.reduce((s, c) => s + c.bytes, 0);
      const gz = chunks.reduce((s, c) => s + gzipSync(c.code).length, 0);
      rows.push({ pkg: probe.name, door, min, gz });
    } catch (err) {
      rows.push({ pkg: probe.name, door, min: null, gz: null, error: String(err.message ?? err) });
    }
  }
}

rows.sort((a, b) => (a.pkg < b.pkg ? -1 : a.pkg > b.pkg ? 1 : a.door < b.door ? -1 : a.door > b.door ? 1 : 0));
for (const r of rows)
  console.log(r.pkg.padEnd(38), r.door.padEnd(22), r.error ? `ERROR ${r.error}` : `${r.min} min\t${r.gz} gz`);
console.log('TOTAL doors', rows.length, 'min', rows.reduce((s, r) => s + (r.min ?? 0), 0),
  'gz', rows.reduce((s, r) => s + (r.gz ?? 0), 0));

writeData('census-doors.json', {
  ref: basis.ref,
  sha: basis.sha,
  commitDate: basis.commitDate,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: 'diagrams/generator/census-doors.mjs',
  used: `git archive ${basis.ref} @ ${basis.sha} + corepack pnpm install --frozen-lockfile + tools/bundle-probe (rolldown, minify, declared deps+peers external, annotations off)`,
  wasAssociatedWith: ['pnpm (corepack)', `rolldown@${rolldownVersion ?? '?'}`, 'node:zlib gzip'],
  rows,
});

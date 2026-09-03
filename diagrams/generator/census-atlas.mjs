// The census pipeline, measured by the same rules it measures the city with
// (INITIATIVES.md I6): build-time INTROSPECTION of diagrams/generator/ and
// diagrams/data/ — nothing on sheet 14 is hand-listed.  Probes are found by
// what they WRITE (a writeData call naming a plate); shared instruments are
// found by being IMPORTED by another generator file; tiers come from which
// basis.mjs primitive a probe calls (materialize / historyLog / installDeps);
// readers come from every data-plate URL constructed in the generator.
//
// Output is shaped for the I7 cytoscape lane: integer-indexed NODES with a
// kind tag + EDGES with a relation, per the RDF-crossover note.  Cross-checks
// THROW at build time — a plate with two writers, a probe writing a plate that
// is not on disk, or a reader of a plate nothing writes, are all errors.  A
// plate no drawing reads is NOT an error; it is filed and reported as such.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GEN = fileURLToPath(new URL('./', import.meta.url));
const DATA = fileURLToPath(new URL('../data/', import.meta.url));
const read = (dir, f) => readFileSync(dir + f, 'utf8');

// This module is the sheet's data layer, not a station in the pipeline: it is
// excluded from its own survey so the office never draws the surveyor twice.
const SELF = 'census-atlas.mjs';
const GEN_FILES = readdirSync(GEN).filter((f) => f.endsWith('.mjs') && f !== SELF).sort();
const SRC = new Map(GEN_FILES.map((f) => [f, read(GEN, f)]));

// ---- plates on disk (the cabinet is whatever is filed, not a list) ---------
const PLATE_FILES = readdirSync(DATA).filter((f) => /^census-.*\.json$/.test(f)).sort();
const PLATE_META = new Map(PLATE_FILES.map((f) => [f, JSON.parse(read(DATA, f))]));

// ---- who imports whom: an imported census-*.mjs is an instrument, not a probe
const IMPORTS = new Map([...SRC].map(([f, s]) => [f, [...s.matchAll(/from '\.\/([\w.-]+\.mjs)'/g)].map((m) => m[1])]));
const IMPORTED = new Set([...IMPORTS.values()].flat());

// ---- tiers, from the basis primitive a probe actually calls ---------------
// T1 pure-tree (archive + scc, or a query over the master plate), T2 history
// (git log over the ref), T3 execution (the tree installed in the tmpdir).
const tierOf = (s) => (/\binstallDeps\(/.test(s) ? 'T3' : /\bhistoryLog\(/.test(s) ? 'T2' : 'T1');
const basisOf = (s, plate) => {
  const used = plate?.used ?? '';
  if (used.startsWith('git archive')) return /\binstallDeps\(/.test(s) ? 'installed archive' : 'archive';
  if (used.startsWith('diagrams/data/')) return /\bhistoryLog\(/.test(s) ? 'master plate + git log' : 'master plate';
  return used ? 'live registry' : 'unknown';
};

// ---- probes: a census-*.mjs that writes a plate ---------------------------
const CENSUS = GEN_FILES.filter((f) => /^census-.*\.mjs$/.test(f) && !IMPORTED.has(f));

const probes = [];
const queries = [];
for (const file of CENSUS) {
  const s = SRC.get(file);
  const writes = [...s.matchAll(/\bwriteData\(\s*'([^']+)'/g)].map((m) => m[1]);
  if (writes.length > 1) throw new Error(`census-atlas: ${file} writes ${writes.length} plates — one probe, one plate`);
  // the master's own writer is not one of its readers
  const readsMaster = /\bloadCensus\(/.test(s)
    || (s.includes("'census-files.json'") && writes[0] !== 'census-files.json');
  if (!writes.length) {
    queries.push({ file, readsMaster, tier: tierOf(s) });
    continue;
  }
  const plate = writes[0];
  if (!PLATE_META.has(plate)) throw new Error(`census-atlas: ${file} writes ${plate}, which is not filed in diagrams/data/`);
  probes.push({ file, plate, tier: tierOf(s), basis: basisOf(s, PLATE_META.get(plate)), readsMaster });
}

// shared instruments = the generator files the PROBES themselves import
const STATIONS = [...probes, ...queries].map((p) => p.file);
const INSTRUMENTS = GEN_FILES
  .filter((f) => STATIONS.some((g) => IMPORTS.get(g).includes(f)))
  .map((f) => ({ file: f, importedBy: STATIONS.filter((g) => IMPORTS.get(g).includes(f)).length }));

// the old regime's last instrument: a census script wired to nothing at all
const UNWIRED = GEN_FILES.filter((f) => /^census/.test(f) && !IMPORTED.has(f)
  && !probes.some((p) => p.file === f) && !queries.some((q) => q.file === f));

// ---- readers: every `new URL('../data/<plate>')` in the generator ---------
const numOf = (s) => s.match(/^\s*num: (?:'([^']+)'|(\d+)),/m)?.slice(1).find(Boolean) ?? null;
const titleOf = (s) => s.match(/^\s*title: '([^']+)'/m)?.[1] ?? null;
const drawings = [];
for (const file of GEN_FILES) {
  if (!/^(sheet[\w]*|build)\.mjs$/.test(file)) continue;
  const s = SRC.get(file);
  const reads = [...s.matchAll(/new URL\('\.\.\/data\/(census-[\w.-]+\.json)'/g)].map((m) => m[1]);
  if (!reads.length) continue;
  drawings.push({ file, reads, num: numOf(s), title: titleOf(s) ?? 'GALLERY COVER SURVEY' });
}
// rack order = the atlas's own numbering; the cover, which is not a sheet, leads
const rank = (d) => (d.num === null ? [-1, ''] : [parseInt(d.num, 10), String(d.num).replace(/\d+/, '')]);
drawings.sort((a, b) => rank(a)[0] - rank(b)[0] || rank(a)[1].localeCompare(rank(b)[1]));

// the atlas's own sheets that no plate stands behind — arguments, mechanisms
// and metering no census produces (this sheet is honestly one of them)
const UNPLATED = GEN_FILES
  .filter((f) => /^sheet/.test(f) && !drawings.some((d) => d.file === f))
  .map((f) => numOf(SRC.get(f)))
  .filter(Boolean)
  .sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || String(a).localeCompare(String(b)));

// ---- cross-checks ---------------------------------------------------------
for (const f of PLATE_FILES) {
  const w = probes.filter((p) => p.plate === f);
  if (w.length !== 1) throw new Error(`census-atlas: ${f} has ${w.length} writers (${w.map((p) => p.file).join(', ') || 'none'}) — exactly one is required`);
}
for (const d of drawings) {
  for (const r of d.reads) {
    if (!PLATE_META.has(r)) throw new Error(`census-atlas: ${d.file} reads ${r}, which is not filed in diagrams/data/`);
  }
}

// every plate pinned to the same ref: the claim the sheet makes out loud
const REF = PLATE_META.get(probes[0].plate).ref;
const SHA = PLATE_META.get(probes[0].plate).sha;
for (const [f, m] of PLATE_META) {
  if (m.ref !== REF || m.sha !== SHA) throw new Error(`census-atlas: ${f} is pinned to ${m.ref} @ ${m.sha}, the cabinet to ${REF} @ ${SHA} — re-run the probes`);
}
const COMMIT_DATE = [...PLATE_META.values()].map((m) => m.commitDate).find(Boolean).slice(0, 10);

// ---- the plate table: writer, tier, readers -------------------------------
const PLATES = PLATE_FILES.map((file) => {
  const by = probes.find((p) => p.plate === file);
  const readers = drawings.filter((d) => d.reads.includes(file));
  const queriedBy = file === 'census-files.json'
    ? [...probes, ...queries].filter((p) => p.readsMaster).map((p) => p.file)
    : [];
  return { file, writer: by.file, tier: by.tier, basis: by.basis, readers, queriedBy };
});
const UNREAD = PLATES.filter((p) => !p.readers.length && !p.queriedBy.length);

// ---- external instruments, from the plates' own PROV-O wasAssociatedWith ---
const TOOLS = (() => {
  const seen = new Map();
  for (const m of PLATE_META.values()) {
    for (const raw of m.wasAssociatedWith ?? []) {
      const key = raw.split(/[\s(]/)[0].toLowerCase();
      const cur = seen.get(key);
      if (!cur || raw.length > cur.length) seen.set(key, raw);
    }
  }
  return [...seen].map(([key, label]) => ({ key, label })).sort((a, b) => a.key.localeCompare(b.key));
})();

// ---- NODES / EDGES (the I7 data model: integer ids + a kind tag) ----------
const nodes = [];
const edges = [];
const idOf = new Map();
const node = (kind, label, extra = {}) => {
  const id = nodes.length;
  nodes.push({ id, kind, label, ...extra });
  idOf.set(`${kind}:${label}`, id);
  return id;
};
const edge = (from, to, rel) => { edges.push({ from, to, rel }); };

for (const i of INSTRUMENTS) node('tool', i.file, { role: 'instrument', importedBy: i.importedBy });
for (const t of TOOLS) node('tool', t.label, { role: 'external' });
for (const p of probes) node('probe', p.file, { tier: p.tier, basis: p.basis });
for (const q of queries) node('probe', q.file, { tier: q.tier, role: 'query' });
for (const f of UNWIRED) node('probe', f, { tier: null, role: 'unwired' });
for (const p of PLATES) node('plate', p.file, { tier: p.tier });
for (const d of drawings) node('sheet', d.file, { num: d.num, title: d.title });

for (const p of probes) {
  const from = idOf.get(`probe:${p.file}`);
  edge(from, idOf.get(`plate:${p.plate}`), 'writes');
  if (p.readsMaster) edge(idOf.get('plate:census-files.json'), from, 'reads');
  for (const dep of IMPORTS.get(p.file).filter((f) => idOf.has(`tool:${f}`))) edge(from, idOf.get(`tool:${dep}`), 'imports');
}
for (const q of queries) {
  if (q.readsMaster) edge(idOf.get('plate:census-files.json'), idOf.get(`probe:${q.file}`), 'reads');
}
for (const d of drawings) {
  for (const r of d.reads) edge(idOf.get(`plate:${r}`), idOf.get(`sheet:${d.file}`), 'reads');
}

const count = (kind) => nodes.filter((n) => n.kind === kind).length;
const STATS = {
  probes: probes.length,
  plates: PLATES.length,
  drawings: drawings.length,
  sheets: drawings.filter((d) => d.file !== 'build.mjs').length,
  instruments: INSTRUMENTS.length,
  tools: TOOLS.length,
  writes: edges.filter((e) => e.rel === 'writes').length,
  reads: edges.filter((e) => e.rel === 'reads').length,
  imports: edges.filter((e) => e.rel === 'imports').length,
  nodes: nodes.length,
  edges: edges.length,
  byKind: { probe: count('probe'), plate: count('plate'), sheet: count('sheet'), tool: count('tool') },
  byTier: { T1: probes.filter((p) => p.tier === 'T1').length, T2: probes.filter((p) => p.tier === 'T2').length, T3: probes.filter((p) => p.tier === 'T3').length },
  sheetFiles: GEN_FILES.filter((f) => /^sheet/.test(f)).length,
};
STATS.unplated = STATS.sheetFiles - STATS.sheets;

// tier order is drawing order: pure tree, then history, then execution
const TIER_ORDER = ['T1', 'T2', 'T3'];
const ROWS = TIER_ORDER.flatMap((t) => {
  const band = probes.filter((p) => p.tier === t);
  // the master snapshot leads its band: everything else is a view of it
  return band.sort((a, b) => Number(b.plate === 'census-files.json') - Number(a.plate === 'census-files.json')
    || a.file.localeCompare(b.file));
}).map((p) => ({ ...p, ...PLATES.find((x) => x.file === p.plate) }));

export const ATLAS = {
  ref: REF, sha: SHA, commitDate: COMMIT_DATE,
  tracked: PLATE_META.get('census-files.json').tracked,
  masterRows: PLATE_META.get('census-files.json').rows.length,
  master: 'census-files.json',
  probes, queries, unwired: UNWIRED, instruments: INSTRUMENTS, tools: TOOLS,
  plates: PLATES, unread: UNREAD, drawings, unplated: UNPLATED, rows: ROWS, stats: STATS,
  nodes, edges,
};

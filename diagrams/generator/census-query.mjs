// Snapshot IO for Layer 1/2 probes (INITIATIVES.md): load the master per-file
// census, stamp PROV-O provenance, and write reviewable one-row-per-line
// snapshot plates under diagrams/data/.  Also home of the CITY UNIVERSE —
// the shared member/dir/spec file rules that sheets 7, 7B and 13 reconcile on.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DATA_DIR } from './basis.mjs';

export const loadCensus = () =>
  JSON.parse(readFileSync(join(DATA_DIR, 'census-files.json'), 'utf8'));

export const provenance = (snap, script, tools = []) => ({
  ref: snap.ref,
  sha: snap.sha,
  commitDate: snap.commitDate,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: script,
  used: `diagrams/data/census-files.json @ ${snap.sha}`,
  wasAssociatedWith: tools,
});

// List entries under `listKeys` render one item per line: snapshots are
// reviewed, committed plates — their diffs must read.
export const compactJson = (obj, listKeys) => {
  const parts = Object.entries(obj).map(([k, v]) => {
    if (listKeys.includes(k) && Array.isArray(v)) {
      const items = v.map((x) => '    ' + JSON.stringify(x)).join(',\n');
      return `  ${JSON.stringify(k)}: [\n${items}\n  ]`;
    }
    const s = JSON.stringify(v, null, 2).split('\n').map((l, i) => (i ? '  ' + l : l)).join('\n');
    return `  ${JSON.stringify(k)}: ${s}`;
  });
  return '{\n' + parts.join(',\n') + '\n}\n';
};

export const writeData = (file, obj, listKeys = ['rows']) => {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, file), compactJson(obj, listKeys));
};

// --- the city universe (sheets 7 / 7B / 13 share these rules exactly) --------
// Counted: authored .ts/.tsx/.js/.jsx/.mjs, excluding *.d.ts, *.test-d.ts and
// generated/vendored/output dirs.  SPEC = *.{spec,test,cy}.* or under
// specs/ test/ tests/ __tests__/ cypress/.  Which dirs hold a member's
// authored source stays editorial (CITY_DIRS), default src/ (member root
// when it has none).
const EXT = /\.(tsx?|jsx?|mjs)$/;
const SKIP_FILE = (f) => /\.d\.ts$/.test(f) || /\.test-d\.ts$/.test(f);
const SKIP_SEG = new Set(['node_modules', 'dist', 'fixtures', '.wrangler', 'cache', '.turbo', 'coverage']);
const IS_SPEC = (rel) =>
  /\.(spec|test|cy)\./.test(basename(rel)) || /(^|\/)(specs|test|tests|__tests__|cypress)(\/)/.test(rel);

export const CITY_DIRS = new Map([
  ['packages/ui-router-server', ['src', 'test']],
  ['packages/eslint-plugin-lit-ui-router', ['src', 'test']],
  ['apps/sample-app-routes', ['src', 'test']],
  ['apps/sample-app-lit-e2e', ['src', 'cypress']],
  ['docs', ['.vitepress', 'worker', 'src']],
]);
const RANK = ['packages/', 'apps/', 'docs', 'examples', 'tools/'];
const DISTRICT = (dir) =>
  dir.startsWith('packages/') ? 'pkg' : dir.startsWith('apps/') ? 'app' : dir.startsWith('tools/') ? 'tool' : 'site';

// -> { members: [{dir,name,...}] in editorial order,
//      files: [{path, member, district, spec, code}] }
export const cityUniverse = (snap) => {
  const members = [...snap.members].sort((a, b) => {
    const r = RANK.findIndex((p) => a.dir.startsWith(p)) - RANK.findIndex((p) => b.dir.startsWith(p));
    return r || (a.dir < b.dir ? -1 : 1);
  });
  const files = [];
  for (const m of members) {
    const hasSrc = snap.rows.some((r) => r.path.startsWith(`${m.dir}/src/`));
    const dirs = CITY_DIRS.get(m.dir) ?? (hasSrc ? ['src'] : ['.']);
    const prefixes = dirs.map((d) => (d === '.' ? `${m.dir}/` : `${m.dir}/${d}/`));
    for (const r of snap.rows) {
      if (!prefixes.some((p) => r.path.startsWith(p))) continue;
      const rel = r.path.slice(m.dir.length + 1);
      if (!EXT.test(rel) || SKIP_FILE(basename(rel))) continue;
      if (rel.split('/').slice(0, -1).some((seg) => SKIP_SEG.has(seg))) continue;
      files.push({ path: r.path, member: m.dir, district: DISTRICT(m.dir), spec: IS_SPEC(rel), code: r.code });
    }
  }
  return { members, files };
};

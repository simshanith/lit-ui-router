// Sheet 9 census: the production docs deploy, measured file by file on the wire.
// Ported onto the pipeline (INITIATIVES.md I5, tier T3): the deploy is BUILT
// inside a materialized, INSTALLED archive of the ref (basis.mjs materialize +
// installDeps + the tree's own .bin/turbo run build), never the working tree.
// The clean archive is the point, not ceremony: sheet9.mjs's rev-A survey read
// an accumulated local docs/dist, where parallel app builds pile up stale
// hashes, and reported twelve orphans that a clean deploy never ships.
// Each file contributes raw bytes and gzip level 9 bytes (the CDN serves
// compressed, so gz is the honest wire measure). Files are sorted into the
// sheet's districts by an explicit editorial pattern table plus a reachability
// walk; a shared chunk loaded by several apps counts where it is FIRST claimed
// (vanilla -> mobx -> hash), because the CDN ships it once.
// Writes diagrams/data/census-shipped.json.
import { readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { installDeps, materialize, refFromArgv } from './basis.mjs';
import { writeData } from './census-query.mjs';

const basis = materialize(refFromArgv());
process.on('exit', () => basis.cleanup());
const { turbo } = installDeps(basis);
// Whole-graph build: docs#build's dependsOn reaches `examples#build:embeds`,
// which `--filter=docs...` would prune (examples is not a docs dependency).
execFileSync(turbo, ['run', 'build'], { cwd: basis.dir, stdio: ['ignore', 2, 2], maxBuffer: 1 << 26 });
const DIST = join(basis.dir, 'docs', 'dist');

// --- measure ---------------------------------------------------------------
const walk = (dir, base = '', out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) walk(join(dir, e.name), rel, out);
    else out.push(rel);
  }
  return out;
};
const files = walk(DIST).sort();
if (!files.length) throw new Error(`empty docs/dist at ${DIST}`);
const raw = new Map();
const gz = new Map();
for (const f of files) {
  const buf = readFileSync(join(DIST, f));
  raw.set(f, buf.length);
  gz.set(f, gzipSync(buf, { level: 9 }).length);
}
const present = new Set(files);

// --- reachability ----------------------------------------------------------
// Any quoted path ending in a shipped extension, resolved root-relative,
// relative to the referrer, or bare. Covers HTML href/src, ESM import
// specifiers (static and dynamic), vite's preload manifests, and the
// backtick-quoted asset URLs the app chunks build by hand.
const SCANNABLE = /\.(html|js|mjs|css|json)$/;
const REF =
  /["'`(]([^"'`()\s]*?\.(?:js|mjs|css|woff2?|json|png|jpe?g|gif|svg|ico|webp|txt|txt\.gz|glb|gltf))(?=["'`)?#])/g;

const refsOf = (f) => {
  if (!SCANNABLE.test(f)) return [];
  const src = readFileSync(join(DIST, f), 'utf8');
  const dir = posix.dirname(f);
  const out = new Set();
  for (const [, spec] of src.matchAll(REF)) {
    if (/^(https?:)?\/\//.test(spec)) continue;
    const cands = spec.startsWith('/')
      ? [spec.slice(1)]
      : [posix.normalize(posix.join(dir, spec)), spec];
    for (const c of cands) if (present.has(c)) { out.add(c); break; }
  }
  return [...out];
};

const isShell = (f) => /^app(-mobx|-hash)?\.html$/.test(f);
// VitePress ships each page's full chunk under a name only hashmap.json knows
// (the shells preload the `.lean.js` twin), so the map is a seed, not a leaf.
// Its keys are lowercased; the emitted filenames are not.
const hashmapSeeds = () => {
  if (!present.has('hashmap.json')) return [];
  const lower = new Map(files.map((f) => [f.toLowerCase(), f]));
  const map = JSON.parse(readFileSync(join(DIST, 'hashmap.json'), 'utf8'));
  return Object.entries(map)
    .map(([page, hash]) => lower.get(`assets/${page.replaceAll('/', '_')}.${hash}.js`.toLowerCase()))
    .filter(Boolean);
};
// Trees copied wholesale by docs/.vitepress/vite.config.ts and addressed at
// runtime by COMPUTED paths (`/images/${w}/${name}.png`, corpus names out of
// a JSON index): no regex can see those edges, so the trees are seeded rather
// than reported as hundreds of false orphans. `_headers` is a Cloudflare
// deploy directive, read by the platform and never fetched. Orphan detection
// is therefore a statement about HASHED BUILD OUTPUT.
const SEEDED = (f) => f.startsWith('images/') || f.startsWith('static/') || f === '_headers';

const bfs = (seeds) => {
  const seen = new Set(seeds);
  const queue = [...seeds];
  while (queue.length) {
    for (const r of refsOf(queue.shift())) if (!seen.has(r)) { seen.add(r); queue.push(r); }
  }
  return seen;
};

const vanilla = bfs(['app.html']);
const mobx = bfs(['app-mobx.html']);
const hash = bfs(['app-hash.html']);
const site = bfs([
  ...files.filter((f) => f.endsWith('.html') && !isShell(f)),
  ...hashmapSeeds(),
  ...files.filter(SEEDED),
]);
const reached = new Set([...vanilla, ...mobx, ...hash, ...site]);
const orphans = files.filter((f) => !reached.has(f));

// --- districts -------------------------------------------------------------
// Editorial pattern table, first match wins — the thirteen districts sheet 9
// draws. Everything the table misses lands in a loud `unclassified` district
// rather than being dropped.
const PATTERNS = [
  ['demo corpora', /^static\/data\/corpora\//],
  ['static data', /^static\/data\//],
  ['inter fonts', /^assets\/inter-[^/]+\.woff2$/],
  ['images', /^images\/|^favicon\.ico$/],
  ['examples', /^examples\//],
  ['html pages', /\.html$/],
  ['site css', /\.css$/],
  ['vp framework', /^assets\/chunks\/|^assets\/app\.[\w-]+\.js$|^hashmap\.json$|^_headers$/],
  ['page chunks', /^assets\/[\w-]+\.md\.[\w-]+(\.lean)?\.js$/],
];
const ORDER = [
  'demo corpora', 'inter fonts', 'html pages', 'examples', 'page chunks', 'vp framework',
  'images', 'app: vanilla', 'app: mobx', 'app: hash', 'static data', 'site css',
  'orphans', 'unclassified',
];

const district = (f) => {
  if (!reached.has(f)) return 'orphans';
  for (const [name, re] of PATTERNS) if (re.test(f)) return name;
  // The remainder is hashed app output: shared chunks count where first claimed.
  if (vanilla.has(f)) return 'app: vanilla';
  if (mobx.has(f)) return 'app: mobx';
  if (hash.has(f)) return 'app: hash';
  return 'unclassified';
};

const byDistrict = new Map(ORDER.map((d) => [d, []]));
for (const f of files) byDistrict.get(district(f)).push(f);

const rows = ORDER.filter((d) => byDistrict.get(d).length).map((d) => {
  const members = byDistrict.get(d).slice().sort((a, b) => gz.get(b) - gz.get(a));
  return {
    district: d,
    files: members.length,
    gz: members.reduce((s, f) => s + gz.get(f), 0),
    top: { name: members[0], gz: gz.get(members[0]) },
  };
});

const totals = {
  files: files.length,
  rawBytes: files.reduce((s, f) => s + raw.get(f), 0),
  gzBytes: files.reduce((s, f) => s + gz.get(f), 0),
};

for (const r of rows) console.log([r.district, `${r.files}f`, `${r.gz} gz`, r.top.name].join('\t'));
console.log('TOTAL', totals.files, 'files', totals.rawBytes, 'raw', totals.gzBytes, 'gz');
for (const f of byDistrict.get('unclassified')) console.log('UNCLASSIFIED', f);
for (const f of orphans) console.log('ORPHAN', f, gz.get(f));

writeData('census-shipped.json', {
  ref: basis.ref,
  sha: basis.sha,
  commitDate: basis.commitDate,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: 'diagrams/generator/census-shipped.mjs',
  used: `git archive ${basis.ref} @ ${basis.sha} + corepack pnpm install --frozen-lockfile + turbo run build -> docs/dist`,
  wasAssociatedWith: ['pnpm (corepack)', 'turbo', 'node:zlib gzip level 9'],
  measure: 'per-file raw bytes + gzip level 9; districts by pattern table, shared app chunks first-claimed vanilla -> mobx -> hash',
  seededTrees: ['images/', 'static/', '_headers'],
  totals,
  rows,
  orphans: orphans.map((f) => ({ file: f, raw: raw.get(f), gz: gz.get(f) })),
}, ['rows', 'orphans']);

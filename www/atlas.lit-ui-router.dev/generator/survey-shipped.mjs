// Outside the cabinet: the atlas's own deploy, built from an archive of an atlas ref and filed survey-, not census-.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { gzipSync } from 'node:zlib';
import { materialize } from './basis.mjs';
import { writeData } from './census-query.mjs';

const AT = 'www/atlas.lit-ui-router.dev/';
const SITE = 'https://atlas.lit-ui-router.dev/';
const argv = process.argv.slice(2);
const REF = argv.includes('--ref') ? argv[argv.indexOf('--ref') + 1] : 'www/atlas';
if (!REF || REF.startsWith('--')) throw new Error('usage: node survey-shipped.mjs [--ref <atlas ref>]');

// Sheet 9's measure (census-shipped.mjs), on the atlas's own deploy: the app is built inside the
// archive by its own npm scripts, every file weighed raw and at gzip level 9, districts by a pattern
// table after a reachability walk from every page.
const PATTERNS = [
  ['routed pages', /^(?:index\.html|404\.html|(?:about|log|city|plant|bricks|builds|specimen)\/index\.html|sheet\/[^/]+\/index\.html)$/],
  ['bare plates', /^plate\/[^/]+\/index\.html$/],
  ['card pictures', /^thumbs\/[^/]+\.webp$/],
  ['the share card', /^brand\/card(?:-light|-dark)?\.(?:webp|png)$/],
  ['models', /^models\/(?:builds\/)?[^/]+\.glb$/],
  ['model viewer', /^assets\/(?:model-viewer|draco_|basis_)/],
  ['cytoscape', /^assets\/cytoscape/],
  ['icons', /^images\/|^favicon\.|^apple-touch-icon\.png$/],
  ['manifest', /^manifest\.json$|^_redirects$/],
  ['the routed app', /^assets\/|^sheets\/atlas\.css$/],
  ['plate fragments', /^sheets\/[^/]+\.html$/],
];
// drawing order on appendix A4; a file the table misses lands in `unclassified`, printed, not thrown
const ORDER = ['routed pages', 'bare plates', 'plate fragments', 'card pictures', 'the share card', 'models', 'model viewer',
  'cytoscape', 'the routed app', 'icons', 'manifest', 'orphans', 'unclassified'];
// Addressed at runtime by computed paths, so no regex sees the edge: the fragments by the manifest's
// `file`, the manifest by the router's base, the visualizer's icons by its stylesheet; `_redirects`
// is a Pages directive, read by the platform and never fetched.
const SEEDED = (f) => f.startsWith('sheets/') || f.startsWith('images/') || f === 'manifest.json' || f === '_redirects';

const basis = materialize(REF);
try {
  const APP = join(basis.dir, AT, 'app');
  if (!existsSync(join(APP, 'package-lock.json'))) throw new Error(`survey-shipped: ${REF} holds no ${AT}app/package-lock.json`);
  // cwd, not --prefix: npm reads a --prefix under the symlinked tmpdir as a package named `app`
  const npm = (...args) => execFileSync('npm', args, { cwd: APP, stdio: ['ignore', 'inherit', 'inherit'], maxBuffer: 1 << 26 });
  npm('ci', '--no-audit', '--no-fund', '--silent');
  npm('run', 'build');
  const DIST = join(APP, 'dist');

  const walk = (dir, base = '', out = []) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), rel, out);
      else out.push(rel);
    }
    return out;
  };
  const files = walk(DIST).sort();
  if (!files.length) throw new Error(`survey-shipped: empty ${DIST}`);
  const raw = new Map();
  const gz = new Map();
  for (const f of files) {
    const buf = readFileSync(join(DIST, f));
    raw.set(f, buf.length);
    gz.set(f, gzipSync(buf, { level: 9 }).length);
  }
  const present = new Set(files);

  const SCANNABLE = /\.(?:html|js|mjs|css|json)$/;
  const REFS = /["'`(]([^"'`()\s]*?\.(?:js|mjs|css|woff2?|json|png|jpe?g|gif|svg|ico|webp|txt|glb|gltf|wasm))(?=["'`)?#])/g;
  const refsOf = (f) => {
    if (!SCANNABLE.test(f)) return [];
    const src = readFileSync(join(DIST, f), 'utf8');
    const dir = posix.dirname(f);
    const out = new Set();
    for (const [, raw] of src.matchAll(REFS)) {
      // a share image is an absolute url to the site's own origin; any other host is off the deploy
      const spec = raw.startsWith(SITE) ? raw.slice(SITE.length - 1) : raw;
      if (/^(?:https?:)?\/\//.test(spec)) continue;
      const cands = spec.startsWith('/') ? [spec.slice(1)] : [posix.normalize(posix.join(dir, spec)), spec];
      for (const c of cands) if (present.has(c)) { out.add(c); break; }
    }
    return [...out];
  };
  const seeds = [...files.filter((f) => f.endsWith('.html')), ...files.filter(SEEDED)];
  const reached = new Set(seeds);
  const queue = [...seeds];
  while (queue.length) for (const r of refsOf(queue.shift())) if (!reached.has(r)) { reached.add(r); queue.push(r); }
  const orphans = files.filter((f) => !reached.has(f));

  const district = (f) => {
    if (!reached.has(f)) return 'orphans';
    for (const [name, re] of PATTERNS) if (re.test(f)) return name;
    return 'unclassified';
  };
  const byDistrict = new Map(ORDER.map((d) => [d, []]));
  for (const f of files) byDistrict.get(district(f)).push(f);
  const rows = ORDER.filter((d) => byDistrict.get(d).length).map((d) => {
    const members = byDistrict.get(d).slice().sort((a, b) => gz.get(b) - gz.get(a));
    return {
      district: d,
      files: members.length,
      raw: members.reduce((s, f) => s + raw.get(f), 0),
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

  writeData('survey-shipped.json', {
    ref: basis.ref,
    sha: basis.sha,
    commitDate: basis.commitDate,
    generatedAtTime: new Date().toISOString(),
    wasGeneratedBy: 'www/atlas.lit-ui-router.dev/generator/survey-shipped.mjs',
    used: `git archive ${basis.ref} @ ${basis.sha} + npm ci + npm run build (vite build, prerender) -> ${AT}app/dist`,
    wasAssociatedWith: ['npm', 'vite', 'node:zlib gzip level 9'],
    measure: 'per-file raw bytes + gzip level 9; districts by pattern table after a reachability walk from every page',
    seededTrees: ['sheets/', 'images/', 'manifest.json', '_redirects'],
    scope: `${AT}app/dist`,
    totals,
    rows,
    orphans: orphans.map((f) => ({ file: f, raw: raw.get(f), gz: gz.get(f) })),
  }, ['rows', 'orphans']);
  console.log(`survey-shipped.json: ${basis.ref} @ ${basis.sha} · ${files.length} files · ${totals.gzBytes} gz`);
} finally {
  basis.cleanup();
}

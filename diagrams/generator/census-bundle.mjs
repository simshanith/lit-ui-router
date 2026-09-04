// Module census INSIDE the production bundle of one consumer app (sheet 10),
// ported onto the pipeline (INITIATIVES.md I5, tier T3): the REAL vite
// production build runs inside a MATERIALIZED, INSTALLED, BUILT archive of the
// ref (basis.mjs materialize + installDeps + the tree's own .bin/turbo run
// build), never the working tree.  Writes diagrams/data/census-bundle.json.
//
// Method: vite's JS API from the ARCHIVE's node_modules builds the app with its
// own config file (root = the app dir), plus one appended plugin whose
// generateBundle hook reads every chunk.  Per module: `renderedLength` — the
// post-tree-shake source bytes the bundler kept.  Per chunk: the emitted
// (minified) code bytes and their gzip length.  A module's wire share is then
// estimated by scaling it through its OWN chunk's two ratios,
// rendered * (emitted/renderedSum) * (gz/emitted) — the sheet's estimated-gz
// method.  Output goes to a scratch outDir so the archive's real dist/ (built
// above, and read by other steps) is never touched.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { installDeps, materialize, positionalsFromArgv, refFromArgv } from './basis.mjs';
import { writeData } from './census-query.mjs';

const APP_DIR = positionalsFromArgv()[0] ?? 'apps/sample-app-lit-vanilla';

// EDITORIAL grouping table, first match wins: a module id (archive-relative,
// posix) is attributed to the package a reader would name it by.  Registry
// packages live under a pnpm virtual store dir, workspace members under their
// own source dir.  Anything unmatched lands in the loud `other` row — never
// dropped — so a new dependency shows up as residue instead of vanishing.
const GROUPS = [
  [/node_modules\/@uirouter\+core@|node_modules\/@uirouter\/core\//, '@uirouter/core'],
  [/node_modules\/@uirouter\+visualizer@|node_modules\/@uirouter\/visualizer\//, '@uirouter/visualizer'],
  [/node_modules\/@uirouter\+(dsr|sticky-states)@|node_modules\/@uirouter\/(dsr|sticky-states)\//,
    'router plugins'],
  // the navigation-location plugin: member dir and package name differ
  [/(^|\/)packages\/navigation-location-plugin\//, 'router plugins'],
  [/node_modules\/ui-router-navigation-location-plugin[@/]/, 'router plugins'],
  [/(^|\/)packages\/lit-ui-router\//, 'lit-ui-router'],
  [/node_modules\/lit-ui-router@|node_modules\/lit-ui-router\//, 'lit-ui-router'],
  [/node_modules\/(lit|lit-html|lit-element)@|node_modules\/(lit|lit-html|lit-element)\//, 'lit'],
  [/node_modules\/@lit\+|node_modules\/@lit-labs\+|node_modules\/@lit(-labs)?\//, 'lit'],
  [/node_modules\/@api-viewer\+|node_modules\/@api-viewer\//, '@api-viewer'],
  [/node_modules\/lit-dialog@|node_modules\/lit-dialog\//, 'lit-dialog'],
  [/node_modules\/marked@|node_modules\/marked\//, 'marked'],
  [/node_modules\/dompurify@|node_modules\/dompurify\//, 'dompurify'],
  [/node_modules\/lodash-es@|node_modules\/lodash-es\//, 'lodash-es'],
  [/node_modules\/tslib@|node_modules\/tslib\//, 'runtime helpers'],
  [/^\0?(vite|rolldown|rollup)[/:]|^\0/, 'runtime helpers'],
  [/(^|\/)apps\/sample-app-shared\//, 'sample-app-shared'],
  [/(^|\/)apps\/sample-app-routes\//, 'sample-app-routes'],
  [new RegExp(`(^|/)${APP_DIR.replaceAll('/', '\\/')}\\/`), 'app own src'],
];
const groupOf = (id) => GROUPS.find(([re]) => re.test(id))?.[1] ?? 'other';

const basis = materialize(refFromArgv());
process.on('exit', () => basis.cleanup());
const { turbo } = installDeps(basis);
// Real build (not dry): the app's config chain imports sample-app-shared's
// tooling and every workspace dep resolves through its dist/.
execFileSync(turbo, ['run', 'build', `--filter=${APP_DIR.split('/').pop()}...`],
  { cwd: basis.dir, stdio: ['ignore', 2, 2], maxBuffer: 1 << 26 });

const APP = join(basis.dir, APP_DIR);
const vite = await import(pathToFileURL(createRequire(join(APP, 'package.json')).resolve('vite')).href);

const outDir = mkdtempSync(join(tmpdir(), 'census-bundle-out-'));
process.on('exit', () => rmSync(outDir, { recursive: true, force: true }));

const chunks = [];
const censusPlugin = {
  name: 'census-bundle',
  generateBundle(_options, bundle) {
    for (const out of Object.values(bundle)) {
      if (out.type !== 'chunk') continue;
      const code = Buffer.from(out.code, 'utf8');
      const modules = Object.entries(out.modules ?? {})
        .map(([id, m]) => [id, m.renderedLength ?? 0])
        .filter(([, n]) => n > 0);
      chunks.push({
        name: out.fileName,
        rendered: modules.reduce((s, [, n]) => s + n, 0),
        emitted: code.length,
        gz: gzipSync(code, { level: 9 }).length,
        modules,
      });
    }
  },
};

await vite.build({
  root: APP,
  logLevel: 'warn',
  plugins: [censusPlugin],
  build: { outDir, emptyOutDir: true },
});

// Scale each module through its own chunk: minify ratio, then gzip ratio.
const byGroup = new Map();
const otherIds = new Map();
// macOS resolves the tmpdir through /private; module ids come back realpathed.
const ARCHIVE = realpathSync(basis.dir);
for (const c of chunks) {
  const toGz = c.rendered > 0 ? (c.gz / c.rendered) : 0;
  for (const [id, rendered] of c.modules) {
    const rel = id.startsWith(ARCHIVE) ? id.slice(ARCHIVE.length + 1) : id;
    const g = groupOf(rel);
    const row = byGroup.get(g) ?? { group: g, rendered: 0, estGz: 0, modules: 0 };
    row.rendered += rendered;
    row.estGz += rendered * toGz;
    row.modules += 1;
    byGroup.set(g, row);
    if (g === 'other') otherIds.set(rel, (otherIds.get(rel) ?? 0) + rendered);
  }
}

const rows = [...byGroup.values()]
  .map((r) => ({ ...r, estGz: Math.round(r.estGz) }))
  .sort((a, b) => b.rendered - a.rendered);
const totals = {
  chunks: chunks.length,
  kept: chunks.reduce((s, c) => s + c.rendered, 0),
  emitted: chunks.reduce((s, c) => s + c.emitted, 0),
  gz: chunks.reduce((s, c) => s + c.gz, 0),
};

for (const r of rows) console.log([r.group, r.modules + 'm', 'rendered ' + r.rendered, 'estGz ' + r.estGz].join('\t'));
console.log('TOTAL', totals.kept, 'kept →', totals.emitted, 'emitted →', totals.gz, 'gz', `(${totals.chunks} chunks)`);
if (otherIds.size) {
  console.error(`OTHER residue: ${otherIds.size} unmatched module ids`);
  for (const [id, n] of [...otherIds].sort((a, b) => b[1] - a[1]).slice(0, 40))
    console.error('  ', n, id);
}

writeData('census-bundle.json', {
  ref: basis.ref,
  sha: basis.sha,
  commitDate: basis.commitDate,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: 'diagrams/generator/census-bundle.mjs',
  used: `git archive ${basis.ref} @ ${basis.sha} + corepack pnpm install --frozen-lockfile + turbo run build + vite build (JS API)`,
  wasAssociatedWith: ['pnpm (corepack)', 'turbo', `vite ${vite.version}`],
  app: APP_DIR,
  method: 'generateBundle: module renderedLength scaled by its chunk gz/rendered ratio',
  totals,
  otherIds: [...otherIds].sort((a, b) => b[1] - a[1]).map(([id, rendered]) => ({ id, rendered })),
  rows,
}, otherIds.size ? ['rows', 'otherIds'] : ['rows']);

import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, schedule, arrow, isoBlock, isoPt, keyRow, npmUrl } from './helpers.mjs';
import { assertPlots, depthSort, solidFaces } from './iso-hidden.mjs';

const P = 's3b';
const OX = 400, OY = 170;

// ---- census: every mass and footprint comes from www/atlas.lit-ui-router.dev/data/census-mass3b.json,
// the checked-in snapshot written by census-mass3b.mjs from a bare
// `turbo run ci --dry=json` on an installed archive of the ref. Per-task:
//   footprint = files the task hashes (the dry-run `inputs` map, counted per task)
//   height    = command mass: the package.json script line (1 sloc) + the repo
//               script/bin file it executes, sloc'd like sheet 3 on scc 4.0.0's
//               `Code` basis (cites carried in the plate, printed in the schedule)
// Graph-level counts (nodes, real, edges) come from the ci pipeline of
// www/atlas.lit-ui-router.dev/data/census-plate.json. This file holds placement and prose only.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-mass3b.json', import.meta.url), 'utf8'));
// the package quarters are the packages/ members, by name
const FILES_PKGS = new Set(JSON.parse(readFileSync(new URL('../data/census-files.json', import.meta.url), 'utf8')).members
  .filter((m) => m.dir.startsWith('packages/')).map((m) => m.name));
const GRAPH = JSON.parse(readFileSync(new URL('../data/census-plate.json', import.meta.url), 'utf8'));
const CI = GRAPH.pipelines.ci;
const MAIN = GRAPH.pipelines['ci:main'];
const PHANTOM = CI.nodes - CI.real;
const PHPCT = ((PHANTOM / CI.nodes) * 100).toFixed(1);
// the homes the notes name: turbo's dry run, the counter, the binaries, the instruments and the lint plugin
const REPO = 'https://github.com/simshanith/lit-ui-router';
const HOME = {
  dryRun: 'https://turborepo.dev/docs/reference/run',
  scc: 'https://github.com/boyter/scc',
  tsc: 'https://www.typescriptlang.org/docs/handbook/compiler-options.html',
  oxlint: 'https://oxc.rs/docs/guide/usage/linter',
  dtsBacktest: `${REPO}/tree/main/tools/dts-backtest`,
  eslintPlugin: npmUrl('eslint-plugin-lit-ui-router'),
  repoChecks: `${REPO}/tree/main/tools/repo-checks`,
  knip: 'https://knip.dev/',
  dedupe: 'https://pnpm.io/cli/dedupe',
  taplo: 'https://taplo.tamasfe.dev/',
};
const TURBO = PLATE.wasAssociatedWith.find((a) => a.startsWith('turbo '));
const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;

const BY_ID = new Map(PLATE.rows.map((r) => [r.id, r]));
const BY_PKG = new Map();
for (const r of PLATE.rows) BY_PKG.set(r.pkg, [...(BY_PKG.get(r.pkg) ?? []), r]);
const TASK = new Map(PLATE.tasks.map((t) => [t.id, t]));

const row = (id) => {
  const r = BY_ID.get(id);
  if (!r) throw new Error(`sheet 3B: task ${id} is missing from www/atlas.lit-ui-router.dev/data/census-mass3b.json`);
  return r;
};
// cited repo files, verbatim from the plate, basename only: "run.ts (291)"
const cited = (id) => row(id).cites.filter((c) => /\(\d+\)$/.test(c)).map((c) => c.replace(/^.*\//, ''));
const cite = (id, i = 0) => {
  const c = cited(id)[i];
  if (!c) throw new Error(`sheet 3B: task ${id} has no cite ${i} in www/atlas.lit-ui-router.dev/data/census-mass3b.json`);
  return c;
};
const slocOf = (id, i = 0) => Number(cite(id, i).match(/\((\d+)\)$/)[1]);
// the repo-checks tasks turbo.json's `lint` umbrella names in its `dependsOn` — a hand
// list held to the plate: every one a real task, the guards cited, the rest a bare
// script line, knip the block's widest lot
const LINT_WITH_GUARDS = ['check:task-inputs', 'check:graph-edges', 'check:patches', 'check:single-version', 'check:package-coverage'];
const LINT_WITH_LINES = ['check:knip', 'check:dedupe', 'check:shared-source'];
const LINT_WITH = [...LINT_WITH_GUARDS, ...LINT_WITH_LINES].map((t) => row(`@tools/repo-checks#${t}`));
const GN = GRAPH.graphNodes;
const LINT_DEPS = [...new Set(GRAPH.graphEdges.filter(([d, t]) => GN[d].pkg === '@tools/repo-checks' && GN[d].task.startsWith('check:') && GN[t].task === 'lint').map(([d]) => GN[d].task))].sort();
if (LINT_DEPS.join() !== LINT_WITH.map((r) => r.task).sort().join()) throw new Error(`sheet 3B: the lint umbrella takes ${LINT_DEPS.join(', ')} off the plate's graph, and the notes name ${LINT_WITH.map((r) => r.task).join(', ')}`);
if (LINT_WITH_LINES.some((t) => row(`@tools/repo-checks#${t}`).mass !== 1)) throw new Error('sheet 3B: a repo-checks lane the notes call one script line carries command mass');
if (LINT_WITH_GUARDS.some((t) => row(`@tools/repo-checks#${t}`).mass === 1)) throw new Error('sheet 3B: a repo-checks lane the notes call a guard is one script line');
if (Math.max(...(BY_PKG.get('@tools/repo-checks') ?? []).map((r) => r.inputs)) !== row('@tools/repo-checks#check:knip').inputs) throw new Error('sheet 3B: check:knip is no longer the widest lot in the guard house');
const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const numw = (n) => { if (!NUMW[n]) throw new Error(`sheet 3B: no number word for ${n} — extend NUMW`); return NUMW[n]; };
// direct graph degree of a real task (real and phantom neighbours alike)
const deg = (id, k) => {
  const t = TASK.get(id);
  if (!t) throw new Error(`sheet 3B: task ${id} is missing from the plate's task list`);
  return t[k];
};

const KS = 1.2;                      // footprint side = 1.2 · √(files hashed)
const KH = 0.45;                     // height = 0.45 px per command sloc
const S = (i) => Math.max(6, KS * Math.sqrt(i));
const H = (m) => Math.max(3, KH * m);
const fmt = (v) => v.toLocaleString('en-US');

// packages only — @tools/repo-checks is drawn whole as structure 1
const TERRACE = [
  '@tools/a11y', '@tools/bootstrap', '@tools/build_and_test', '@tools/bundle-probe', '@tools/ci-logs', '@tools/compat-guards', '@tools/crap', '@tools/embed-heights',
  '@tools/eslint', '@tools/eslint-ts-parser', '@tools/happy-dom', '@tools/lcov-rebase', '@tools/lint-elements', '@tools/lit-template-lint',
  '@tools/lit-test-env', '@tools/oxc-emit', '@tools/oxlint-anti-slop', '@tools/release-config', '@tools/release-ledger', '@tools/vue-check',
  '@tools/wintercg-globals', '@tools/workers-builds',
];
const APPS = [
  'sample-app-lit-e2e', 'sample-app-lit-effect', 'sample-app-lit-mobx', 'sample-app-lit-signals', 'sample-app-lit-vanilla',
  'sample-app-routes', 'sample-app-shared',
];
// the harbour holds the docs site and its two release workers
const WWW = ['@www/lit-ui-router.dev', '@www/release-diffs.lit-ui-router.dev', '@www/release-ledger.lit-ui-router.dev'];
const ROOT = BY_PKG.get('//') ?? [];
const SURFACE = row('//#lint:root').inputs;  // the shared root glob the equal slabs watch
// the tower's lot is the whole dts-backtest block, not just the task that stands on it
const TOWER = (BY_PKG.get('@tools/dts-backtest') ?? []).reduce((a, r) => a + r.inputs, 0);

// the quarters that ship docs:api into the harbour, off the plate
const DOCS_API = PLATE.rows.filter((r) => r.task === 'docs:api').map((r) => r.pkg);
// the private quarter's lanes are all bare script lines
const SNAP = BY_PKG.get('@repo/route-snapshot') ?? [];
if (!SNAP.length || SNAP.some((r) => r.mass !== 1)) throw new Error('sheet 3B: quarter 33\'s note says every lane is one script line, and the plate says otherwise');
// the package quarters, and the plugin's rank among them by watched files
const QUARTERS = [...FILES_PKGS];
const quarterFiles = (pkg) => (BY_PKG.get(pkg) ?? []).reduce((a, r) => a + r.inputs, 0);
const SIZE_ORD = ['the smallest', 'the second-smallest', 'the third-smallest', 'the fourth-smallest', 'the fifth-smallest', 'the sixth-smallest'];
const NAV_RANK = QUARTERS.map(quarterFiles).sort((a, b) => a - b).indexOf(quarterFiles('ui-router-navigation-location-plugin'));
if (!SIZE_ORD[NAV_RANK]) throw new Error(`sheet 3B: the plugin ranks ${NAV_RANK + 1} by watched files among the quarters — extend SIZE_ORD`);
const NAV_SIZE_NOTE = `${SIZE_ORD[NAV_RANK]} quarter by watched files, same block shape`;
const MOBX_GUARDED = (BY_PKG.get('lit-ui-router-mobx') ?? []).filter((r) => r.cites.some((c) => /(lit2|mobx6)-compat-guard\.ts/.test(c))).length;

// [n, name, x, y, plate selector (task id, package, or packages), schedule note]
const M = [
  // --- the guard house: a package of its own, sited by what it gates -------------
  // south-west of the yard: at 10, 155 its roof stood in the plate's title block
  [1,  'repo-checks',           355,  585, '@tools/repo-checks', `the guard house — ${cite('@tools/repo-checks#check:task-inputs')}, the tallest one-file guard`],
  // --- the root yard (`//`) — every //# task drawn alone -------------------------
  // the root glob's slabs stand at a 44 pitch: a side is 1.2 · √files, 42.8 at 1,271
  [2,  '//#format:check:root',    0,    0, '//#format:check:root', `one oxfmt line · the ${fmt(SURFACE)}-file root glob`],
  [3,  '//#format:check:toml',   88,  110, '//#format:check:toml', `mise run + tasks/${cite('//#format:check:toml')} — plate 3A, seam C`],
  [4,  '//#lint:actionlint',    144,  110, '//#lint:actionlint', 'mise run + config.toml run line'],
  [5,  '//#lint:css',           132,    0, '//#lint:css', `one stylelint line · the same ${fmt(SURFACE)}-file surface`],
  [6,  '//#lint:markdown',       56,  110, '//#lint:markdown', `mise run + tasks/${cite('//#lint:markdown')}`],
  [7,  '//#lint:package-json',   60,   48, '//#lint:package-json', `one eslint line watching ${fmt(row('//#lint:package-json').inputs)} manifests`],
  [8,  '//#lint:root',           44,    0, '//#lint:root', `one oxlint line · the same ${fmt(SURFACE)}-file surface`],
  [9,  '//#lint:shellcheck',     28,  110, '//#lint:shellcheck', `mise run + tasks/${cite('//#lint:shellcheck')}`],
  [10, '//#lint:templates',     176,    0, '//#lint:templates', `${cite('//#lint:templates')} + ${cite('//#lint:templates', 1)}`],
  [11, '//#lint:toml',          116,  110, '//#lint:toml', `mise run + tasks/${cite('//#lint:toml')} — chain hop ③`],
  [12, '//#lint:zizmor',        172,  110, '//#lint:zizmor', 'mise run + config.toml run line'],
  [13, '//#typecheck:root',      88,    0, '//#typecheck:root', `one tsc line · the same ${fmt(SURFACE)}-file surface`],
  // born 2026-10-02 (#1058): the second slab row, east of lint:package-json
  [14, '//#lint:complexity',    104,   48, '//#lint:complexity', `one eslint line · the same ${fmt(SURFACE)}-file surface`],
  // --- the package quarters — one block per packages/ member ----------------------
  [15, 'lit-ui-router',         250,   30, 'lit-ui-router', 'guards + oxc-emit + bundle-probe bins behind every task'],
  [16, 'lit-ui-router-mobx',    292,   30, 'lit-ui-router-mobx', `the lit2 and mobx6 guards ride ${numw(MOBX_GUARDED)} tasks`],
  [17, 'nav-location-plugin',   355,   30, 'ui-router-navigation-location-plugin', NAV_SIZE_NOTE],
  [18, 'ui-router-server',      320,   30, 'ui-router-server', 'node:test + runtime-globals lanes'],
  [19, 'eslint-plugin',         373,   30, 'eslint-plugin-lit-ui-router', 'the fifth quarter — rules, docs and oxlint lanes'],
  // born 2026-09-12 (#833)
  [20, 'lit-ui-router-effect',   401,   30, 'lit-ui-router-effect', 'the sixth quarter — the effect bindings, running every lane'],
  // born 2026-09-14 (#806)
  [21, 'lit-ui-router-ssr',      428,   30, 'lit-ui-router-ssr', 'the seventh quarter — the prerender bridge'],
  // born 2026-10-12/13 (#1185): the row's east end, west of the release road's x 560 leg
  [30, 'lit-ui-router-signals',  456,   30, 'lit-ui-router-signals', 'the eighth quarter — the signals bindings'],
  [31, 'ui-router-signals',      481,   30, 'ui-router-signals', 'the ninth quarter — the framework-agnostic signal mirror'],
  [32, 'ui-router-effect',       499,   30, 'ui-router-effect', 'the tenth quarter — the framework-agnostic SubscriptionRef'],
  [33, '@repo/route-snapshot',   519,   30, '@repo/route-snapshot', `the eleventh quarter — private, ${numw(SNAP.length)} one-line lanes, nothing to build`],
  [34, 'ui-router-mobx',         529,   30, 'ui-router-mobx', 'the twelfth quarter — the framework-agnostic MobX store'],
  // born 2026-10-16 (#1409): the row's east end, the quarters east of the server one step east for its grown block
  [35, '@repo/dev-gate',         549,   30, '@repo/dev-gate', `the thirteenth quarter — private, the two halves of each package's #dev-gate import`],
  // born 2026-10-24
  [36, 'ui-router-registry',     535,   60, 'ui-router-registry', 'the fourteenth quarter — types only, no test lane'],
  // --- the instrument end of town -------------------------------------------------
  [22, '@tools/release',        600,   15, '@tools/release', `${cite('@tools/release#pack:all')} + ${cite('@tools/release#check:exports')} live here`],
  [23, '@tools/dts-backtest',   700,   40, '@tools/dts-backtest', `${cite('@tools/dts-backtest#test')} on a ${TOWER}-file footprint: THE TOWER`],
  [24, '@tools/shared',         600,   90, '@tools/shared', 'the library under the instruments — all one-liners'],
  [25, 'typedoc-plugin',        634,   96, '@tools/typedoc-plugin-lit-ui-router', `oxc-emit both passes — ${deg('@tools/typedoc-plugin-lit-ui-router#build:types', 'dependents')} nodes wait on build:types`],
  [26, 'instrument terrace',    690,  124, TERRACE, `${TERRACE.length} small tools × their style/test/typecheck rows`],
  // --- south of the river ---------------------------------------------------------
  [27, 'www — the harbour',     330,  205, WWW, `${numw(DOCS_API.length)} quarters ship docs:api here — its build waits on ${deg('@www/lit-ui-router.dev#build', 'deps')} nodes`],
  [28, 'examples — the plain',  420,  250, 'examples', `format:check:oxfmt hashes ${fmt(row('examples#format:check:oxfmt').inputs)}, lint:oxlint ${fmt(row('examples#lint:oxlint').inputs)}`],
  [29, `apps (${APPS.length} sample pkgs)`, 150, 210, APPS, `${APPS.length} packages, every command one line`],
];
// the root plots that watch the shared surface, in table order
const NO = (name) => { const r = M.find(([, nm]) => nm === name); if (!r) throw new Error(`sheet 3B: no structure named ${name}`); return r[0]; };
const SLABS = M.filter(([, , , , sel]) => typeof sel === 'string' && sel.startsWith('//#') && row(sel).inputs === SURFACE);
const andList = (xs) => xs.join(', ').replace(/, ([^,]*)$/, ' and $1');
const capW = (n) => numw(n)[0].toUpperCase() + numw(n).slice(1);

// Every structure resolves to plate rows; every plate row lands in exactly one
// structure — so the schedule totals reconcile the whole real graph or throw.
const claimed = new Set();
const rowsOf = (n, sel) => {
  const out = [];
  for (const s of [sel].flat()) {
    const rs = BY_ID.has(s) ? [BY_ID.get(s)] : (BY_PKG.get(s) ?? []);
    if (!rs.length) throw new Error(`sheet 3B: structure ${n} draws ${s}, absent from www/atlas.lit-ui-router.dev/data/census-mass3b.json`);
    for (const r of rs) {
      if (claimed.has(r.id)) throw new Error(`sheet 3B: ${r.id} is drawn twice (structure ${n})`);
      claimed.add(r.id);
      out.push(r);
    }
  }
  return out;
};
const CELL = new Map(M.map(([n, , , , sel]) => {
  const rs = rowsOf(n, sel);
  return [n, {
    tasks: rs.length,
    inputs: rs.reduce((a, r) => a + r.inputs, 0),
    mass: rs.reduce((a, r) => a + r.mass, 0),
  }];
}));
// the eslint-plugin quarter's lanes that carry more than their script line, off the plate
const EP_ROWS = BY_PKG.get('eslint-plugin-lit-ui-router') ?? [];
if (EP_ROWS.length !== CELL.get(NO('eslint-plugin')).tasks) throw new Error(`sheet 3B: plot ${NO('eslint-plugin')} draws ${CELL.get(NO('eslint-plugin')).tasks} tasks, the eslint-plugin package has ${EP_ROWS.length}`);
const EP_HEAVY = EP_ROWS.filter((r) => r.mass > 1);
const EP_NOTE = EP_HEAVY.length
  ? `all but ${EP_HEAVY.map((r) => `<code>${r.task}</code> (${r.mass})`).join(', ').replace(/, ([^,]*)$/, ' and $1')} are one line apiece`
  : 'every lane is one line';
const unclaimed = PLATE.rows.filter((r) => !claimed.has(r.id));
if (unclaimed.length) {
  throw new Error(`sheet 3B: ${unclaimed.length} real task(s) no structure draws: ${unclaimed.map((r) => r.id).join(', ')}`);
}

const geom = new Map(M.map(([n, , x, y]) => {
  const side = S(CELL.get(n).inputs), h = H(CELL.get(n).mass);
  return [n, { n, x, y, side, h, cx: x + side / 2, cy: y + side / 2 }];
}));
const g = (n) => geom.get(n);
// hand-placed against data-driven sides: the graph city may not ship overlapped
assertPlots('sheet 3B', M.map(([n, name]) => ({ n, name, part: 'block', x: g(n).x, y: g(n).y, w: g(n).side, d: g(n).side })));
const pt = (x, y, z = 0) => isoPt(OX, OY, x, y, z);
const p2 = (x, y, z = 0) => pt(x, y, z).map((v) => v.toFixed(1)).join(',');

// one gate tier only: every block stops the PR, so the blocks stand in ink and the key states the tier
const massBlock = (n) => {
  const { x, y, side, h } = g(n);
  return solidFaces(isoBlock(P, OX, OY, x, y, side, side, h, { capCls: 'fp', edge: 'sk', sideFill: `url(#${P}-hx)` }));
};

function massBadge(n) {
  const { x, y, side, h } = g(n);
  // Badge seats: wide caps (side >= 26) carry it on the roof; smalls float it
  // north, south or east — whichever pocket their neighbours leave open.
  const MODE = { 3: 'S', 6: 'S', 9: 'S', 16: 'S', 25: 'S', 36: 'S', 4: 'E', 11: 'E', 12: 'E' };
  const ADJ = { 5: [-4, 2], 30: [-4, -18] };
  const mode = MODE[n] ?? (side >= 26 ? 'C' : 'N');
  let bx, by;
  if (mode === 'C') { [bx, by] = pt(x + side / 2, y + side / 2, h); by -= 3; }
  else if (mode === 'N') { [bx, by] = pt(x + side / 2, y, h); by -= 16; }
  else if (mode === 'S') { [bx, by] = pt(x + side / 2, y + side, 0); by += 16; }
  else { [bx, by] = pt(x + side, y + side / 2, h / 2); bx += 14; }
  const [ax, ay] = ADJ[n] ?? [0, 0];
  bx += ax; by += ay;
  return `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="9" class="sk fp"/>
${txt(bx.toFixed(1), (by + 3.6).toFixed(1), String(n), 'lbl', 'middle')}`;
}

// Ghost pad: a vacant lot — outline + faint hatch, never massed.
const ghostPad = (x, y, w, d) => {
  const poly = [p2(x, y), p2(x + w, y), p2(x + w, y + d), p2(x, y + d)].join(' ');
  return `<polygon points="${poly}" fill="url(#${P}-hd)" opacity="0.35"/>
<polygon points="${poly}" class="sks fnone" stroke-dasharray="4 3"/>`;
};

// Ground road on the iso grid, trimmed at the ends.
function leg(wps, { mk = 'ai', cls = 'sk2', dash = '', t0 = 8, t1 = 10 } = {}) {
  const pts = wps.map(([x, y, z = 0]) => pt(x, y, z));
  const trim = (a, b, d) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return [a[0] + (dx / L) * d, a[1] + (dy / L) * d];
  };
  if (t0) pts[0] = trim(pts[0], pts[1], t0);
  if (t1) pts[pts.length - 1] = trim(pts[pts.length - 1], pts[pts.length - 2], t1);
  const d = 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' L');
  return mk ? arrow(P, d, mk, cls, dash) : `<path d="${d}" class="${cls}" ${dash ? `stroke-dasharray="${dash}"` : ''} fill="none"/>`;
}

// ---- phantom flats: one vacant field, every phantom plot, never enumerated here --
const field = `<polygon points="${[p2(0, -100), p2(460, -100), p2(460, -65), p2(0, -65)].join(' ')}" fill="url(#${P}-hd)" opacity="0.3"/>
<polygon points="${[p2(0, -100), p2(460, -100), p2(460, -65), p2(0, -65)].join(' ')}" class="sks fnone" stroke-dasharray="7 5"/>`;

// ---- roads: the dependency arteries between districts ---------------------------
const roads = [
  leg([[300, 60, 0], [300, 160, 0], [345, 160, 0], [345, 205, 0]], {}),                       // quarters -> docs
  leg([[264, 60, 0], [264, 190, 0], [164, 190, 0], [164, 210, 0]], {}),                       // quarters -> apps
  // the two eastward arteries dropped 50/54 -> 64/68 when the sixth quarter (20) was
  // founded and the fifth (19) grew: the old lanes ran under both, so each road left
  // the row from inside a building.  typedoc's return leg drops with them, 62 -> 84,
  // rather than running two units off the release lane.
  leg([[380, 64, 0], [560, 64, 0], [560, 27, 0], [596, 27, 0]], { cls: 'sks' }),              // quarters -> release
  leg([[634, 106, 0], [420, 106, 0], [420, 84, 0], [386, 84, 0]], { cls: 'sks' }),            // typedoc -> quarters
  leg([[380, 68, 0], [660, 68, 0], [660, 43, 0], [696, 43, 0]], { cls: 'sks', dash: '5 4' }), // quarters -> dts tower
].join('\n');
const roadLabels = `${txt(572, 430, `${deg('@www/lit-ui-router.dev#build', 'deps')} ↦ the harbour`, 'lblf')}
${txt(740, 530, `${deg('@tools/typedoc-plugin-lit-ui-router#build:types', 'dependents')} ↤ typedoc`, 'lblf')}`;

// ---- the chain: hops ② -> ③ pass through this city (plate 3A traces all six) ----
const chain = leg([[20, 230, 0], [119, 230, 0], [119, 118, 0]], { mk: 'aa', cls: 'ska', dash: '3 3', t0: 0, t1: 8 });

// ---- ci:main annex: outside this survey, drawn unmassed -------------------------
// seated in the gap between the harbour note above and the plain's lettering below
const AXY = 170;
const annex = `${solidFaces(isoBlock(P, OX, OY, 740, AXY, 34, 18, 5, { capCls: 'fp', edge: 'ska', sideFill: `url(#${P}-ha)` }))}
<polygon points="${[p2(740, AXY, 5), p2(774, AXY, 5), p2(774, AXY + 18, 5), p2(740, AXY + 18, 5)].join(' ')}" fill="url(#${P}-ha)"/>`;

// ---- bodies painted back to front ----------------------------------------------
const bodies = depthSort(M.map(([n]) => {
  const b = g(n);
  return { x: b.x, y: b.y, w: b.side, d: b.side, svg: massBlock(n) };
})).map((m) => m.svg).join('\n')
  + '\n' + M.map(([n]) => massBadge(n)).join('\n');

// ---- structure schedule, set as a table under the figure ---------------------------------------------------------
const TOT_I = PLATE.rows.reduce((a, r) => a + r.inputs, 0);
const TOT_M = PLATE.rows.reduce((a, r) => a + r.mass, 0);
const FLAT = PLATE.rows.filter((r) => r.mass === 1).length;
// the skyline's one spire, read off the plate rather than pinned in prose
const TALLEST = PLATE.rows.reduce((a, r) => (r.mass > a.mass ? r : a));
if (TALLEST.id !== '@tools/dts-backtest#test') throw new Error(`sheet 3B: the tower caption names @tools/dts-backtest#test the tallest command, and the plate says ${TALLEST.id}`);
// the aria names the row's east end off the table
const EAST_Q = M.filter(([, , , , sel]) => typeof sel === 'string' && FILES_PKGS.has(sel)).reduce((a, r) => (r[2] > a[2] ? r : a));
// the cover index's fit verdict, told from the plate's own tallies
export const SHEET3B_VERDICT = `footprint = watched files, height = command sloc — ${FLAT} of ${PLATE.rows.length} tasks are one-line pads; the tallest is the ${TALLEST.mass}-sloc ${TALLEST.id} tower`;
const schedRow = ([n, name, , , , note]) => {
  const { tasks, inputs, mass } = CELL.get(n);
  return [n, name, tasks, inputs, mass, note];
};
const SCHEDULE = schedule('STRUCTURE SCHEDULE — tasks (t) · watched files (per-task inputs, summed) · command sloc · every mass cited in data/census-mass3b.json',
  ['#', 'structure', 'tasks', 'watched files', 'command sloc', 'note'], M.map(schedRow),
  `TOTALS — ${M.length} massed structures reconcile all ${CI.real} real tasks · ${fmt(TOT_I)} task-file hashes · ${fmt(TOT_M)} command sloc · +1 vacant twin lot (//#lint:workflows, phantom) · ${fmt(PHANTOM)} phantom plots · ${BASIS} · ROADS — five district arteries drawn, the graph's heaviest degrees: @www/lit-ui-router.dev#build waits on ${deg('@www/lit-ui-router.dev#build', 'deps')} nodes · typedoc-plugin#build:types unblocks ${deg('@tools/typedoc-plugin-lit-ui-router#build:types', 'dependents')} · lit-ui-router#build:types ${deg('lit-ui-router#build:types', 'dependents')} · release#check:exports ${deg('@tools/release#check:exports', 'dependents')}; ${fmt(CI.realEdges)} of the graph's ${fmt(CI.edges)} edges join two real tasks, the rest are local streets itemised in the dry-run JSON`);
// the examples plain lettering is the lowest line on the plate; the figure ends 20 px under its second line
const PLAIN_Y = 738, VH = PLAIN_Y + 13 + 20;

// ---- assemble -------------------------------------------------------------------
const svg = `<svg viewBox="0 0 1400 ${VH}" role="img" aria-label="Isometric city of the lit-ui-router pull-request CI task graph, the second alternate plate at altitude three. Behind the city lies a long hatched vacant field: ${fmt(PHANTOM)} phantom plots, the ${PHPCT} percent of the graph that runs nothing. The root yard at the north-west holds every root-scoped task as its own pad: ${numw(SLABS.length)} equal slabs that each watch the same ${fmt(SURFACE)} root files and a cluster of small pads including the taplo pad the deepest chain enters. One vacant lot among them is the phantom lint:workflows twin. Off the yard's west edge stands the guard house: @tools/repo-checks, one block for all ${CELL.get(NO('repo-checks')).tasks} of its tasks, ${CELL.get(NO('repo-checks')).mass} sloc of command over ${fmt(CELL.get(NO('repo-checks')).inputs)} watched files, ${LINT_WITH.length} of them checks the lint umbrella depends on. The ${numw(QUARTERS.length)} package quarters stand in a center row, massed by their watched files and the guard and emitter scripts behind their tasks; the easternmost is ${EAST_Q[1]}. To the east, the instrument end of town: the release works, the typedoc plugin annotated with its fan-out, a terrace of ${TERRACE.length} small tools, and the city's landmark — the dts-backtest tower, ${slocOf('@tools/dts-backtest#test')} lines of run dot ts standing on a ${TOWER}-file footprint. South of the river sit the apps block, the harbour ${numw(DOCS_API.length)} quarters ship API docs into, and the defining horizontal feature: the examples plain, ${fmt(CELL.get(NO('examples — the plain')).inputs)} watched files under ${CELL.get(NO('examples — the plain')).mass} lines of command. Every massed block is drawn in ink: every one stops the PR, so severity is uniform by construction and the key states the tier. Roads trace the dependency arteries with degree counts; an accent dashed road marks where the six-hop deepest chain of plate 3A passes through. A structure schedule reconciles all ${CI.real} real tasks, their ${fmt(TOT_I)} task-file hashes and ${fmt(TOT_M)} command sloc.">
${defs(P)}

${txt(1360, 34, 'SCALE — footprint side = 1.2·√(files the task hashes) · height = 0.45 px per command sloc (floor 3)', 'lbls', 'end')}
${txt(1360, 48, 'wall-clock and cache-rate excluded by design — run-confounded; the drawing is static and citable', 'lblf', 'end')}

${field}
${ghostPad(198, 112, 12, 12)}
${roads}
${roadLabels}
${chain}
${annex}
${bodies}

<!-- lettering -->
${txt(1030, 150, `PHANTOM FLATS — ${fmt(PHANTOM)} vacant plots (${PHPCT}%)`, 'lbls')}
${txt(1030, 163, 'no command — hash carriers for script-less', 'lblf')}
${txt(1030, 176, 'packages · punched hole-by-hole on SHEET 12', 'lblf')}

${txt(1100, 300, 'THE TOWER — @tools/dts-backtest#test', 'lbls')}
${txt(1100, 313, `${slocOf('@tools/dts-backtest#test')}-sloc run.ts on a ${TOWER}-file footprint:`, 'lblf')}
${txt(1100, 326, `the tallest command in the city (${NO('@tools/dts-backtest')})`, 'lblf')}

${txt(1080, 480, `FAN-OUT — typedoc-plugin#build:types (${NO('typedoc-plugin')})`, 'lbla')}
${txt(1080, 493, `unblocks ${deg('@tools/typedoc-plugin-lit-ui-router#build:types', 'dependents')} nodes — every docs:api waits on it;`, 'lblf')}
${txt(1080, 506, `only lit-ui-router#build:types reaches wider (${deg('lit-ui-router#build:types', 'dependents')})`, 'lblf')}

${txt(1080, 540, `MAIN-LINE ANNEX — ci:main adds ${MAIN.real - CI.real} real`, 'lbls')}
${txt(1080, 553, `tasks (${MAIN.nodes}/${MAIN.real} nodes) · outside this`, 'lblf')}
${txt(1080, 566, 'survey, drawn unmassed · accent tier', 'lblf')}

${txt(40, 130, `THE ROOT YARD — ${ROOT.length + 1} //# plots`, 'lblb')}
${txt(40, 143, `${numw(SLABS.length)} equal slabs watch the same`, 'lblf')}
${txt(40, 156, `${fmt(SURFACE)} root files (${SLABS.map(([n]) => n).join('·')})`, 'lblf')}
${txt(40, 169, `the guard house (${NO('repo-checks')}) is a package`, 'lblf')}

${txt(40, 348, '①② mise run ci → turbo run ci', 'lbla')}
${txt(40, 361, 'enter here — hop ③ lands on', 'lblf')}
${txt(40, 373, `//#lint:toml (${NO('//#lint:toml')}), then leaves:`, 'lblf')}
${txt(40, 385, '④⑤⑥ run back inside mise via', 'lblf')}
${txt(40, 397, 'the cache gasket (PLATE 3A)', 'lblf')}
<line x1="282" y1="352" x2="224" y2="304" class="skf"/>

${txt(1030, 220, 'VACANT TWIN LOT — //#lint:workflows,', 'lbls')}
${txt(1030, 233, 'the dependsOn umbrella (plate 3A’s twin):', 'lblf')}
${txt(1030, 246, 'a plot with no building, even here', 'lblf')}
<path d="M1024,232 L760,232 L496,330" class="skf" fill="none"/>

${txt(430, PLAIN_Y, `THE EXAMPLES PLAIN — ${fmt(CELL.get(NO('examples — the plain')).inputs)} files watched by ${CELL.get(NO('examples — the plain')).mass} sloc of command (${NO('examples — the plain')}):`, 'lblb')}
${txt(430, PLAIN_Y + 13, `format:check:oxfmt hashes ${fmt(row('examples#format:check:oxfmt').inputs)} files, lint:oxlint ${fmt(row('examples#lint:oxlint').inputs)} — the examples file set, watched as CI surface`, 'lblf')}

${txt(560, 660, `the harbour (${NO('www — the harbour')}): the site's build waits on ${deg('@www/lit-ui-router.dev#build', 'deps')} nodes — where the city drains`, 'lblf')}

</svg>`;

export const sheet3b = {
  num: '3B', id: 'graphcity', rev: 'M',
  title: 'THE WATCHED CITY',
  sub: `ALTITUDE 3 · ALTERNATE PLATE B — the PR ci graph as a city: ${CI.real} real tasks in ${M.length} massed structures · footprint = watched files (${fmt(TOT_I)} task-file hashes) · height = command sloc (${fmt(TOT_M)}) · ${fmt(PHANTOM)} phantom plots · every number imported from www/atlas.lit-ui-router.dev/data/census-mass3b.json, ${BASIS}`,
  scale: 'THE CI TASK GRAPH',
  form: 'ISOMETRIC GRAPH CITY',
  svg,
  schedule: SCHEDULE,
  caption: `The pull-request graph that plate 3A traced as plumbing, surveyed here as ground: every real task massed by what it watches (footprint) and what it actually executes (height). The survey’s verdict is flatness — ${FLAT} of ${CI.real} blocks are a single script line riding an external binary — which makes the exceptions legible at a glance: a ${slocOf('@tools/dts-backtest#test')}-line test tower on a ${TOWER}-file lot, and a ${fmt(CELL.get(NO('examples — the plain')).inputs)}-file plain patrolled by ${CELL.get(NO('examples — the plain')).mass} lines of command.`,
  notes: `
<p><strong>Method — the graph, imported.</strong> Every mass and footprint on this plate is read from <code>www/atlas.lit-ui-router.dev/data/census-mass3b.json</code>, the checked-in snapshot <code>census-mass3b.mjs</code> writes from a bare <a href="${HOME.dryRun}"><code>turbo run ci --dry=json</code></a> on an installed archive of the ref — ${BASIS}, ${TURBO}: ${CI.nodes} nodes, ${CI.real} real, ${fmt(CI.edges)} edges, ${CI.realEdges} real→real. Nothing below is hand-pasted; a structure whose tasks have left the plate throws at build time rather than drawing a stale number, and the schedule totals are the plate's own sums. <em>Footprint</em> is the per-task <code>inputs</code> map — the files whose hashes decide that task's cache key — at 1.2·√files per side. <em>Height</em> is command mass: the package.json script line plus the repo script or bin file it executes, sloc-counted by <code>census-mass3b.mjs</code> on <a href="${HOME.scc}"><code>scc</code></a> 4.0.0's <code>Code</code> basis (guards, emitters and mise task files each cited in the schedule; external binaries like <a href="${HOME.tsc}"><code>tsc</code></a> and <a href="${HOME.oxlint}"><code>oxlint</code></a> contribute only their one line, because that is all this repo wrote). Wall-clock and cache-hit rates are excluded as geometry by design: they are properties of runs, not of the graph.</p>
<p><strong>The city is flat, and that is the finding.</strong> ${FLAT} of ${CI.real} real tasks have command mass 1 — one script line handing the work to a pinned binary. The whole city executes ${fmt(TOT_M)} sloc of repo-written command while watching ${fmt(TOT_I)} task-file hashes. The skyline is inverted from intuition: <a href="${HOME.dtsBacktest}"><code>@tools/dts-backtest#test</code></a>, the tallest command in the city, is a ${slocOf('@tools/dts-backtest#test')}-line <code>run.ts</code> on a ${TOWER}-file lot — sheet 3 calls it "one ${slocOf('@tools/dts-backtest#test')}-line run.ts holds the TS 5.0 floor", and the graph survey agrees to the line — while the largest footprint, the examples plain, watches ${fmt(CELL.get(NO('examples — the plain')).inputs)} files (format:check:oxfmt ${fmt(row('examples#format:check:oxfmt').inputs)} + lint:oxlint ${fmt(row('examples#lint:oxlint').inputs)} alone) under ${CELL.get(NO('examples — the plain')).mass} lines of command. The eslint-plugin quarter is ${EP_HEAVY.length ? 'nearly flat' : 'flat throughout'}: <a href="${HOME.eslintPlugin}"><code>eslint-plugin-lit-ui-router</code></a> brings ${CELL.get(NO('eslint-plugin')).tasks} tasks and ${CELL.get(NO('eslint-plugin')).mass} sloc, and ${EP_NOTE}.</p>
<p><strong>The root yard repays the walk.</strong> All ${ROOT.length + 1} <code>//#</code> plots are drawn individually, and ${numw(SLABS.length)} of them — ${andList(SLABS.map(([, , , , sel]) => `<code>${sel.slice(3)}</code>`))} — are equal slabs watching one identical root surface of ${fmt(SURFACE)} files. ${capW(SLABS.length)} tasks, one surface, one number: it is the plate's cleanest finding. The guards that patrol that surface are not root tasks: <a href="${HOME.repoChecks}"><code>@tools/repo-checks</code></a> is a package, drawn whole as the guard house (${NO('repo-checks')}) standing apart, south-west of the yard, and ${numw(LINT_WITH.length)} of its ${CELL.get(NO('repo-checks')).tasks} tasks — ${andList(LINT_WITH.map((r) => `<code>${r.task}</code>`))} — are named in the <code>dependsOn</code> list of the <code>lint</code> umbrella, so a lint run takes them along wherever it starts. ${capW(LINT_WITH_GUARDS.length)} of the ${numw(LINT_WITH.length)} are the city's tall one-file guards, ${andList(LINT_WITH_GUARDS.map((t) => slocOf(`@tools/repo-checks#${t}`)))} lines of TypeScript apiece; the other ${numw(LINT_WITH_LINES.length)} are one script line each — <a href="${HOME.knip}"><code>knip</code></a> hashing ${fmt(row('@tools/repo-checks#check:knip').inputs)} files, the widest lot in the block, <a href="${HOME.dedupe}"><code>pnpm dedupe --check</code></a> hashing ${fmt(row('@tools/repo-checks#check:dedupe').inputs)}, and <code>check:shared-source</code> hashing ${fmt(row('@tools/repo-checks#check:shared-source').inputs)}. The <a href="${HOME.taplo}">taplo</a> pad (${NO('//#lint:toml')}) is where plate 3A's six-hop chain touches ground: hops ①–② arrive from <code>mise run ci</code>, hop ③ is this block, and ④–⑥ leave immediately to run back inside mise through the cache gasket. And one lot in the yard is vacant on purpose — <code>//#lint:workflows</code>, an umbrella with no script of its own, has no command even here.</p>
<p><strong>One tier, stated in the key.</strong> Sheet 3's severity vocabulary survives, but at this altitude it degenerates truthfully: every real node in the <code>ci</code> graph stops the PR when it fails, so the tier is a constant: the blocks stand in ink, the key states the tier, and the drawing spends its information elsewhere. The ${MAIN.real - CI.real} ci:main-only tasks (test:engines ×3, check:pack, test:matrix) sit outside this survey on an unmassed accent annex — ${MAIN.nodes}/${MAIN.real} nodes when they are included; the ${fmt(PHANTOM)} phantom plots — ${PHPCT}% of the graph, transit and ^build hash carriers and the script-less <code>lint</code>, <code>typecheck</code> and <code>format:check</code> umbrellas — are the vacant field behind the city, inventoried hole-by-hole on sheet 12.</p>
<p><strong>Roads and reach.</strong> Five arteries are drawn, one per district pair, and the plate labels them with degree rather than with an edge tally it cannot cite: <code>@www/lit-ui-router.dev#build</code> waits on ${deg('@www/lit-ui-router.dev#build', 'deps')} nodes (${numw(DOCS_API.length)} quarters ship <code>docs:api</code> there, plus worker types and app fixtures — it is the city's sink), <code>@tools/typedoc-plugin-lit-ui-router#build:types</code> unblocks ${deg('@tools/typedoc-plugin-lit-ui-router#build:types', 'dependents')}, <code>@tools/release#check:exports</code> ${deg('@tools/release#check:exports', 'dependents')} (<code>pack:all</code> and <code>check:exports</code> read every published quarter), and the widest fan-out in the graph is <code>lit-ui-router#build:types</code> at ${deg('lit-ui-router#build:types', 'dependents')}. Of the graph's ${fmt(CI.edges)} edges only ${CI.realEdges} join two real tasks; the rest hang off phantom transit nodes, which is why the roads are drawn as districts and not as a wire count.</p>`,
  key: [
    keyRow(`<polygon points="6,10 24,2 42,10 24,18" class="sk fp"/><polygon points="6,10 24,2 42,10 24,18" fill="url(#${P}-hx)"/>`, 'massed task block, in ink — every one stops the PR line, one tier'),
    keyRow('<polygon points="6,12 24,4 42,12 24,20" class="sk fp"/><rect x="21" y="1" width="6" height="8" class="sk fp"/>', 'height = command sloc — script line + the file behind it'),
    keyRow('<polygon points="2,14 24,4 46,14 24,24" class="sk fp"/>', 'footprint = watched files — the task’s hashed inputs'),
    keyRow(`<polygon points="6,10 24,2 42,10 24,18" class="ska fp"/><polygon points="6,10 24,2 42,10 24,18" fill="url(#${P}-ha)"/>`, 'ci:main annex — gates main, not the PR; unmassed'),
    keyRow('<polygon points="6,10 24,2 42,10 24,18" class="sks fnone" stroke-dasharray="4 3"/>', 'vacant plot — phantom node, runs nothing'),
    keyRow(`<rect x="6" y="4" width="36" height="10" fill="url(#${P}-hd)" opacity="0.35"/><rect x="6" y="4" width="36" height="10" class="sks fnone" stroke-dasharray="5 4"/>`, `the phantom flats — ${fmt(PHANTOM)} plots (see sheet 12)`),
    keyRow(`<path d="M2,9 L40,9" class="sk2" marker-end="url(#${P}-ai)"/>`, 'artery — real dependsOn edges, count labelled'),
    keyRow(`<path d="M2,9 L40,9" class="ska" stroke-dasharray="3 3" marker-end="url(#${P}-aa)"/>`, 'the deepest chain passing through (plate 3A, hops ②③)'),
  ].join('\n'),
};

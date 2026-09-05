import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, arrow, isoBlock, isoPt, keyRow } from './helpers.mjs';
import { depthSort, solidFaces } from './iso-hidden.mjs';

const P = 's3b';
const OX = 400, OY = 170;

// ---- census: every mass and footprint comes from diagrams/data/census-mass3b.json,
// the checked-in snapshot written by census-mass3b.mjs from a bare
// `turbo run ci --dry=json` on an installed archive of the ref. Per-task:
//   footprint = files the task hashes (the dry-run `inputs` map, counted per task)
//   height    = command mass: the package.json script line (1 sloc) + the repo
//               script/bin file it executes, sloc'd like sheet 3 on scc 4.0.0's
//               `Code` basis (cites carried in the plate, printed in the schedule)
// Graph-level counts (nodes, real, edges) come from the ci pipeline of
// diagrams/data/census-plate.json. This file holds placement and prose only.
const PLATE = JSON.parse(readFileSync(new URL('../data/census-mass3b.json', import.meta.url), 'utf8'));
const GRAPH = JSON.parse(readFileSync(new URL('../data/census-plate.json', import.meta.url), 'utf8'));
const CI = GRAPH.pipelines.ci;
const MAIN = GRAPH.pipelines['ci:main'];
const PHANTOM = CI.nodes - CI.real;
const PHPCT = ((PHANTOM / CI.nodes) * 100).toFixed(1);
const TURBO = PLATE.wasAssociatedWith.find((a) => a.startsWith('turbo '));
const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;

const BY_ID = new Map(PLATE.rows.map((r) => [r.id, r]));
const BY_PKG = new Map();
for (const r of PLATE.rows) BY_PKG.set(r.pkg, [...(BY_PKG.get(r.pkg) ?? []), r]);
const TASK = new Map(PLATE.tasks.map((t) => [t.id, t]));

const row = (id) => {
  const r = BY_ID.get(id);
  if (!r) throw new Error(`sheet 3B: task ${id} is missing from diagrams/data/census-mass3b.json`);
  return r;
};
// cited repo files, verbatim from the plate, basename only: "run.ts (291)"
const cited = (id) => row(id).cites.filter((c) => /\(\d+\)$/.test(c)).map((c) => c.replace(/^.*\//, ''));
const cite = (id, i = 0) => {
  const c = cited(id)[i];
  if (!c) throw new Error(`sheet 3B: task ${id} has no cite ${i} in diagrams/data/census-mass3b.json`);
  return c;
};
const slocOf = (id, i = 0) => Number(cite(id, i).match(/\((\d+)\)$/)[1]);
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

const TERRACE = [
  '@tools/build_and_test', '@tools/bundle-probe', '@tools/compat-guards', '@tools/embed-heights',
  '@tools/eslint-ts-parser', '@tools/happy-dom', '@tools/lcov-rebase', '@tools/lint-elements', '@tools/lit-template-lint',
  '@tools/lit-test-env', '@tools/oxc-emit', '@tools/release-config', '@tools/vue-check',
  '@tools/warn-lanes', '@tools/wintercg-globals', '@tools/workers-builds',
];
const APPS = [
  'sample-app-lit-e2e', 'sample-app-lit-mobx', 'sample-app-lit-vanilla',
  'sample-app-routes', 'sample-app-shared',
];
const ROOT = BY_PKG.get('//') ?? [];
const SURFACE = row('//#lint:root').inputs;  // the shared root glob the five slabs watch
// the tower's lot is the whole dts-backtest block, not just the task that stands on it
const TOWER = (BY_PKG.get('@tools/dts-backtest') ?? []).reduce((a, r) => a + r.inputs, 0);

// [n, name, x, y, plate selector (task id, package, or packages), schedule note]
const M = [
  // --- the root yard (`//`) — every //# task drawn alone -------------------------
  [1,  '//#check:graph-edges',    0,   48, '//#check:graph-edges', `${cite('//#check:graph-edges')} — #693, tied with lint:package-json for the widest lot`],
  [2,  '//#check:patches',      162,   48, '//#check:patches', `${cite('//#check:patches')} — the yard’s tallest one-file guard`],
  [3,  '//#format:check:root',    0,    0, '//#format:check:root', `one oxfmt line · the ${fmt(SURFACE)}-file root glob`],
  [4,  '//#format:check:toml',   88,  110, '//#format:check:toml', `mise run + tasks/${cite('//#format:check:toml')} — plate 3A, seam C`],
  [5,  '//#lint:actionlint',    144,  110, '//#lint:actionlint', 'mise run + config.toml run line'],
  [6,  '//#lint:elements',      114,    0, '//#lint:elements', `${cite('//#lint:elements')} + ${cite('//#lint:elements', 1)} — THE TALLEST`],
  [7,  '//#lint:markdown',       56,  110, '//#lint:markdown', `mise run + tasks/${cite('//#lint:markdown')}`],
  [8,  '//#lint:package-json',   60,   48, '//#lint:package-json', `one eslint line watching ${fmt(row('//#lint:package-json').inputs)} manifests`],
  [9,  '//#lint:root',           38,    0, '//#lint:root', `one oxlint line · the same ${fmt(SURFACE)}-file surface`],
  [10, '//#lint:shellcheck',     28,  110, '//#lint:shellcheck', `mise run + tasks/${cite('//#lint:shellcheck')}`],
  [11, '//#lint:templates',     152,    0, '//#lint:templates', `${cite('//#lint:templates')} + ${cite('//#lint:templates', 1)}`],
  [12, '//#lint:toml',          116,  110, '//#lint:toml', `mise run + tasks/${cite('//#lint:toml')} — chain hop ③`],
  [13, '//#lint:zizmor',        172,  110, '//#lint:zizmor', 'mise run + config.toml run line'],
  [14, '//#typecheck:root',      76,    0, '//#typecheck:root', `one tsc line · the same ${fmt(SURFACE)}-file surface`],
  [28, '//#check:task-inputs',  122,   48, '//#check:task-inputs', `${cite('//#check:task-inputs')} — #693's twin, over the root surface`],
  // --- the package quarters — one block per published package ---------------------
  [15, 'lit-ui-router',         250,   30, 'lit-ui-router', 'guards + oxc-emit + bundle-probe bins behind every task'],
  [16, 'lit-ui-router-mobx',    292,   30, 'lit-ui-router-mobx', 'heaviest commands: the lit2 and mobx6 guards ride four tasks'],
  [17, 'nav-location-plugin',   360,   30, 'ui-router-navigation-location-plugin', 'the smallest quarter, same block shape'],
  [18, 'ui-router-server',      325,   30, 'ui-router-server', 'node:test + runtime-globals lanes'],
  [27, 'eslint-plugin',         388,   30, 'eslint-plugin-lit-ui-router', 'the fifth quarter, new since rev C — rules, docs and oxlint lanes'],
  // --- the instrument end of town -------------------------------------------------
  [19, '@tools/release',        600,   15, '@tools/release', `${cite('@tools/release#pack:all')} + ${cite('@tools/release#check:exports')} live here`],
  [20, '@tools/dts-backtest',   700,   40, '@tools/dts-backtest', `${cite('@tools/dts-backtest#test')} on a ${TOWER}-file footprint: THE TOWER`],
  [21, '@tools/shared',         600,   90, '@tools/shared', 'the library under the instruments — all one-liners'],
  [22, 'typedoc-plugin',        634,   96, '@tools/typedoc-plugin-lit-ui-router', `oxc-emit both passes — ${deg('@tools/typedoc-plugin-lit-ui-router#build:types', 'dependents')} nodes wait on build:types`],
  [23, 'instrument terrace',    690,  124, TERRACE, `${TERRACE.length} small tools × their style/test/typecheck rows`],
  // --- south of the river ---------------------------------------------------------
  [24, 'docs — the harbour',    330,  205, 'docs', `every quarter ships docs:api here — docs#build waits on ${deg('docs#build', 'deps')} nodes`],
  [25, 'examples — the plain',  420,  250, 'examples', `format:check hashes ${fmt(row('examples#format:check').inputs)}, lint ${fmt(row('examples#lint').inputs)}`],
  [26, `apps (${APPS.length} sample pkgs)`, 150, 210, APPS, `${APPS.length} packages, every command one line`],
];

// Every structure resolves to plate rows; every plate row lands in exactly one
// structure — so the schedule totals reconcile the whole real graph or throw.
const claimed = new Set();
const rowsOf = (n, sel) => {
  const out = [];
  for (const s of [sel].flat()) {
    const rs = BY_ID.has(s) ? [BY_ID.get(s)] : (BY_PKG.get(s) ?? []);
    if (!rs.length) throw new Error(`sheet 3B: structure ${n} draws ${s}, absent from diagrams/data/census-mass3b.json`);
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
const unclaimed = PLATE.rows.filter((r) => !claimed.has(r.id));
if (unclaimed.length) {
  throw new Error(`sheet 3B: ${unclaimed.length} real task(s) no structure draws: ${unclaimed.map((r) => r.id).join(', ')}`);
}

const geom = new Map(M.map(([n, , x, y]) => {
  const side = S(CELL.get(n).inputs), h = H(CELL.get(n).mass);
  return [n, { n, x, y, side, h, cx: x + side / 2, cy: y + side / 2 }];
}));
const g = (n) => geom.get(n);
const pt = (x, y, z = 0) => isoPt(OX, OY, x, y, z);
const p2 = (x, y, z = 0) => pt(x, y, z).map((v) => v.toFixed(1)).join(',');

// One gate tier only: everything the ci graph runs stops the PR (sheet 3's "pr"
// red-hatch vocabulary), so severity is uniform by construction — the finding.
function massBlock(n) {
  const { x, y, side, h } = g(n);
  const body = solidFaces(isoBlock(P, OX, OY, x, y, side, side, h, { capCls: 'fp', edge: 'skr', sideFill: `url(#${P}-hr)` }));
  const top = [p2(x, y, h), p2(x + side, y, h), p2(x + side, y + side, h), p2(x, y + side, h)].join(' ');
  const wash = `<polygon points="${top}" fill="url(#${P}-hr)"/>
<polygon points="${top}" class="skr fnone"/>`;
  return `${body}${wash}`;
}

function massBadge(n) {
  const { x, y, side, h } = g(n);
  // Badge seats: wide caps (side >= 26) carry it on the roof; smalls float it
  // north, south or east — whichever pocket their neighbours leave open.
  const MODE = { 2: 'S', 4: 'S', 7: 'S', 10: 'S', 16: 'S', 22: 'S', 5: 'E', 12: 'E', 13: 'E' };
  const ADJ = { 6: [-4, 2] };
  const mode = MODE[n] ?? (side >= 26 ? 'C' : 'N');
  let bx, by;
  if (mode === 'C') { [bx, by] = pt(x + side / 2, y + side / 2, h); by -= 3; }
  else if (mode === 'N') { [bx, by] = pt(x + side / 2, y, h); by -= 16; }
  else if (mode === 'S') { [bx, by] = pt(x + side / 2, y + side, 0); by += 16; }
  else { [bx, by] = pt(x + side, y + side / 2, h / 2); bx += 14; }
  const [ax, ay] = ADJ[n] ?? [0, 0];
  bx += ax; by += ay;
  return `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="9" class="skr fp"/>
${txt(bx.toFixed(1), (by + 3.6).toFixed(1), String(n), 'lblr', 'middle')}`;
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
  leg([[380, 50, 0], [560, 50, 0], [560, 27, 0], [596, 27, 0]], { cls: 'sks' }),              // quarters -> release
  leg([[634, 106, 0], [420, 106, 0], [420, 62, 0], [386, 62, 0]], { cls: 'sks' }),            // typedoc -> quarters
  leg([[380, 54, 0], [660, 54, 0], [660, 43, 0], [696, 43, 0]], { cls: 'sks', dash: '5 4' }), // quarters -> dts tower
].join('\n');
const roadLabels = `${txt(572, 430, `${deg('docs#build', 'deps')} ↦ the harbour`, 'lblf')}
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

// ---- structure schedule ---------------------------------------------------------
const TOT_I = PLATE.rows.reduce((a, r) => a + r.inputs, 0);
const TOT_M = PLATE.rows.reduce((a, r) => a + r.mass, 0);
const FLAT = PLATE.rows.filter((r) => r.mass === 1).length;
const schedRow = ([n, name, , , , note]) => {
  const { tasks, inputs, mass } = CELL.get(n);
  return `${String(n).padStart(2, ' ')}  ${name} — ${tasks}t · ${fmt(inputs)} files · ${fmt(mass)} sloc · ${note}`;
};
const half = Math.ceil(M.length / 2);
const ART_H = 700;
const SY = ART_H + 14;
const schedule = `<rect x="40" y="${SY}" width="1320" height="${90 + half * 16}" class="sk fp"/>
${txt(58, SY + 22, 'STRUCTURE SCHEDULE — tasks (t) · watched files (per-task inputs, summed) · command sloc · every mass cited in data/census-mass3b.json', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1360" y2="${SY + 32}" class="skf"/>
${M.slice(0, half).map((r, i) => txt(58, SY + 50 + i * 16, schedRow(r), 'lbls')).join('\n')}
${M.slice(half).map((r, i) => txt(712, SY + 50 + i * 16, schedRow(r), 'lbls')).join('\n')}
${txt(58, SY + 56 + half * 16, `TOTALS — ${M.length} massed structures reconcile all ${CI.real} real tasks · ${fmt(TOT_I)} task-file hashes · ${fmt(TOT_M)} command sloc · +1 vacant twin lot (//#lint:workflows, phantom) · ${fmt(PHANTOM)} phantom plots · ${BASIS}`, 'lbls')}
${txt(58, SY + 72 + half * 16, `ROADS — five district arteries drawn, the graph's heaviest degrees: docs#build waits on ${deg('docs#build', 'deps')} nodes · typedoc-plugin#build:types unblocks ${deg('@tools/typedoc-plugin-lit-ui-router#build:types', 'dependents')} · lit-ui-router#build:types ${deg('lit-ui-router#build:types', 'dependents')} · release#check:exports ${deg('@tools/release#check:exports', 'dependents')}; ${fmt(CI.realEdges)} of the graph's ${fmt(CI.edges)} edges join two real tasks, the rest are local streets itemised in the dry-run JSON`, 'lblf')}`;

// ---- assemble -------------------------------------------------------------------
const svg = `<svg viewBox="0 0 1400 ${SY + 110 + half * 16}" role="img" aria-label="Isometric city of the lit-ui-router pull-request CI task graph, the second alternate plate at altitude three. Behind the city lies a long hatched vacant field: ${fmt(PHANTOM)} phantom plots, the ${PHPCT} percent of the graph that runs nothing. The root yard at the north-west holds every root-scoped task as its own pad: five equal slabs that each watch the same ${fmt(SURFACE)} root files — one of them, lint:elements, a ${row('//#lint:elements').mass}-sloc spire since its lane began running the repo's own bin — two huge flat pads watching ${fmt(row('//#check:graph-edges').inputs)} and ${fmt(row('//#lint:package-json').inputs)} files, one of them a ${slocOf('//#check:graph-edges')}-line guard and the other a one-line command, two mid-sized guard pads for check:task-inputs and check:patches, and a cluster of small pads including the taplo pad the deepest chain enters. One vacant lot among them is the phantom lint:workflows twin. The five package quarters stand in a center row, massed by their watched files and the guard and emitter scripts behind their tasks; the easternmost is the eslint plugin, new to this survey. To the east, the instrument end of town: the release works, the typedoc plugin annotated with its fan-out, a terrace of ${TERRACE.length} small tools, and the city's landmark — the dts-backtest tower, ${slocOf('@tools/dts-backtest#test')} lines of run dot ts standing on a ${TOWER}-file footprint. South of the river sit the apps block, the docs harbour that every quarter ships API docs into, and the defining horizontal feature: the examples plain, ${fmt(CELL.get(25).inputs)} watched files under ${CELL.get(25).mass} lines of command. Every massed block carries the same red hatch because every one stops the PR — severity is uniform by construction. Roads trace the dependency arteries with degree counts; an accent dashed road marks where the six-hop deepest chain of plate 3A passes through. A structure schedule reconciles all ${CI.real} real tasks, their ${fmt(TOT_I)} task-file hashes and ${fmt(TOT_M)} command sloc.">
${defs(P)}

<rect x="40" y="24" width="420" height="72" class="skf fnone"/>
${txt(52, 42, 'PLATE 3B — THE SAME TWO MACHINES, CITY SIDE', 'lbls')}
${txt(52, 56, 'plate 3A drew the seams flat; this plate walks through seam B', 'lblf')}
${txt(52, 70, 'and surveys what turbo actually schedules on every PR', 'lblf')}
${txt(52, 84, `source: bare \`turbo run ci --dry=json\` · ${PLATE.sha} · ${CI.nodes}/${CI.real}`, 'lblf')}

${txt(1360, 34, 'SCALE — footprint side = 1.2·√(files the task hashes) · height = 0.45 px per command sloc (floor 3)', 'lbls', 'end')}
${txt(1360, 48, 'ONE TIER ONLY — every massed block stops the PR line: sheet-3 red hatch throughout, by construction', 'lblf', 'end')}
${txt(1360, 62, 'wall-clock and cache-rate excluded by design — run-confounded; the drawing is static and citable', 'lblf', 'end')}

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

${txt(1100, 300, 'THE TOWER — @tools/dts-backtest#test', 'lblr')}
${txt(1100, 313, `${slocOf('@tools/dts-backtest#test')}-sloc run.ts on a ${TOWER}-file footprint:`, 'lblf')}
${txt(1100, 326, 'the tallest command on the smallest lot (20)', 'lblf')}
${txt(1100, 344, 'THE SPIRE — //#lint:elements (6), since rev C:', 'lblr')}
${txt(1100, 357, 'the root lane that was one eslint line now runs', 'lblf')}
${txt(1100, 370, `the repo’s own bin — ${row('//#lint:elements').mass} sloc, the city’s tallest`, 'lblf')}

${txt(1080, 480, 'FAN-OUT — typedoc-plugin#build:types (22)', 'lbla')}
${txt(1080, 493, `unblocks ${deg('@tools/typedoc-plugin-lit-ui-router#build:types', 'dependents')} nodes — every docs:api waits on it;`, 'lblf')}
${txt(1080, 506, `only lit-ui-router#build:types reaches wider (${deg('lit-ui-router#build:types', 'dependents')})`, 'lblf')}

${txt(1080, 540, `MAIN-LINE ANNEX — ci:main adds ${MAIN.real - CI.real} real`, 'lbls')}
${txt(1080, 553, `tasks (${MAIN.nodes}/${MAIN.real} nodes) · outside this`, 'lblf')}
${txt(1080, 566, 'survey, drawn unmassed · accent tier', 'lblf')}

${txt(60, 130, `THE ROOT YARD — all ${ROOT.length + 1} //# plots`, 'lblb')}
${txt(60, 143, 'five equal slabs watch the same', 'lblf')}
${txt(60, 156, `${fmt(SURFACE)} root files (3·9·14·6·11)`, 'lblf')}
${txt(60, 169, 'flats 1 + 8: thousand-file, one-line', 'lblf')}

${txt(40, 348, '①② mise run ci → turbo run ci', 'lbla')}
${txt(40, 361, 'enter here — hop ③ lands on', 'lblf')}
${txt(40, 373, '//#lint:toml (12), then leaves:', 'lblf')}
${txt(40, 385, '④⑤⑥ run back inside mise via', 'lblf')}
${txt(40, 397, 'the cache gasket (PLATE 3A)', 'lblf')}
<line x1="282" y1="352" x2="224" y2="304" class="skf"/>

${txt(1030, 220, 'VACANT TWIN LOT — //#lint:workflows,', 'lbls')}
${txt(1030, 233, 'the virtual `with` node (plate 3A’s twin):', 'lblf')}
${txt(1030, 246, 'a plot with no building, even here', 'lblf')}
<path d="M1024,232 L760,232 L496,330" class="skf" fill="none"/>

${txt(430, 676, `THE EXAMPLES PLAIN — ${fmt(CELL.get(25).inputs)} files watched by ${CELL.get(25).mass} sloc of command (25):`, 'lblb')}
${txt(430, 689, `format:check hashes ${fmt(row('examples#format:check').inputs)} files, lint ${fmt(row('examples#lint').inputs)} — the corpus from sheet 9, now as CI surface`, 'lblf')}

${txt(752, 590, `the harbour (24): docs#build waits on ${deg('docs#build', 'deps')} nodes — where the city drains`, 'lblf')}

${schedule}
</svg>`;

export const sheet3b = {
  num: '3B', id: 'graphcity', rev: 'F',
  title: 'THE WATCHED CITY',
  sub: `ALTITUDE 3 · ALTERNATE PLATE B — the PR ci graph as a city: ${CI.real} real tasks in ${M.length} massed structures · footprint = watched files (${fmt(TOT_I)} task-file hashes) · height = command sloc (${fmt(TOT_M)}) · ${fmt(PHANTOM)} phantom plots · REV B: hidden-line pass — opaque walls painted back to front, and the main-line annex reseated clear of the plain’s lettering · REV C 2026-08-31: re-surveyed at ${TURBO} — the graph grew, the plain widened by a third, and //#lint:elements stopped being a one-line lane · REV C corrected 2026-09-01: every height re-derived on scc 4.0.0 by census-mass3b.mjs — command sloc 1,737 → 1,774, flat blocks 134 → 130, and the plain re-measured on a clean tree at 17,692 files · REV D 2026-09-02: every number now imported from diagrams/data/census-mass3b.json — the re-based survey grew a fifth package quarter (eslint-plugin-lit-ui-router, ${CELL.get(27).tasks} tasks), 165 → 176 real tasks and 1,774 → 2,022 command sloc · REV E: whole-cabinet refresh — #693 swapped one root guard for two, so the yard is re-platted and the plate stands at ${CI.real} real tasks in ${M.length} structures · REV F 2026-09-04: refreshed after the 1.11.2 + mobx 1.0.0 releases — @tools/embed-heights (#703) takes four rows on the instrument terrace, and the examples plain grew from 17,821 to ${fmt(CELL.get(25).inputs)} watched files, so the harbour's note moved to clear its corner — ${BASIS}`,
  scale: 'THE CI TASK GRAPH',
  form: 'ISOMETRIC GRAPH CITY',
  svg,
  caption: `The pull-request graph that plate 3A traced as plumbing, surveyed here as ground: every real task massed by what it watches (footprint) and what it actually executes (height). The survey’s verdict is flatness — ${FLAT} of ${CI.real} blocks are a single script line riding an external binary — which makes the exceptions legible at a glance: a ${slocOf('@tools/dts-backtest#test')}-line test tower on a ${TOWER}-file lot, a ${slocOf('//#check:patches')}-line patch check on a ${row('//#check:patches').inputs}-file lot, a ${fmt(CELL.get(25).inputs)}-file plain patrolled by ${CELL.get(25).mass} lines of command, and a root lint lane that grew a ${row('//#lint:elements').mass}-sloc spire when it stopped being one eslint line.`,
  notes: `
<p><strong>Method — the graph, imported.</strong> Every mass and footprint on this plate is read from <code>diagrams/data/census-mass3b.json</code>, the checked-in snapshot <code>census-mass3b.mjs</code> writes from a bare <code>turbo run ci --dry=json</code> on an installed archive of the ref — ${BASIS}, ${TURBO}: ${CI.nodes} nodes, ${CI.real} real, ${fmt(CI.edges)} edges, ${CI.realEdges} real→real, against rev C's 535/165/1,375/117. Nothing below is hand-pasted; a structure whose tasks have left the plate throws at build time rather than drawing a stale number, and the schedule totals are the plate's own sums. <em>Footprint</em> is the per-task <code>inputs</code> map — the files whose hashes decide that task's cache key — at 1.2·√files per side. <em>Height</em> is command mass: the package.json script line plus the repo script or bin file it executes, sloc-counted by <code>census-mass3b.mjs</code> on <code>scc</code> 4.0.0's <code>Code</code> basis (guards, emitters and mise task files each cited in the schedule; external binaries like <code>tsc</code> and <code>oxlint</code> contribute only their one line, because that is all this repo wrote). Wall-clock and cache-hit rates are excluded as geometry by design: they are properties of runs, not of the graph.</p>
<p><strong>The city is flat, and that is still the finding.</strong> ${FLAT} of ${CI.real} real tasks have command mass 1 — one script line handing the work to a pinned binary; the ratio barely moved as the graph grew a fifth package. The whole city executes ${fmt(TOT_M)} sloc of repo-written command while watching ${fmt(TOT_I)} task-file hashes. The skyline is inverted from intuition: <code>@tools/dts-backtest#test</code> is a ${slocOf('@tools/dts-backtest#test')}-line <code>run.ts</code> on a ${TOWER}-file lot — sheet 3 calls it "one 291-line run.ts holds the TS 5.0 floor", and the graph survey agrees to the line — while the largest footprint, the examples plain, watches ${fmt(CELL.get(25).inputs)} files (format:check ${fmt(row('examples#format:check').inputs)} + lint ${fmt(row('examples#lint').inputs)} alone) under ${CELL.get(25).mass} lines of command. The tallest command is still the root yard's <code>//#lint:elements</code>, which rev B drew as "one eslint line" on the shared root surface and which now runs the repo's own <code>lint-elements</code> bin — ${slocOf('//#lint:elements')} sloc over <code>warn-lanes.core.ts</code>'s ${slocOf('//#lint:elements', 1)} — a ${row('//#lint:elements').mass}-sloc spire on an unchanged footprint. The new quarter arrives flat: <code>eslint-plugin-lit-ui-router</code> brings ${CELL.get(27).tasks} tasks and ${CELL.get(27).mass} sloc, and all but its two <code>oxc-emit</code> build lanes are one line apiece.</p>
<p><strong>The root yard repays the walk.</strong> All ${ROOT.length + 1} <code>//#</code> plots are drawn individually: five equal slabs — <code>lint:root</code>, <code>typecheck:root</code>, <code>lint:elements</code>, <code>format:check:root</code>, <code>lint:templates</code> — still watch one identical root surface, now ${fmt(SURFACE)} files; two lots watch over two thousand files apiece — <code>lint:package-json</code> ${fmt(row('//#lint:package-json').inputs)} on one line, and <code>check:graph-edges</code> ${fmt(row('//#check:graph-edges').inputs)} on ${slocOf('//#check:graph-edges')}; <code>check:patches</code> and <code>check:task-inputs</code> are ${slocOf('//#check:patches')}- and ${slocOf('//#check:task-inputs')}-line guards standing on the same ${fmt(row('//#check:patches').inputs)}-file root surface the five slabs watch. The five-equal-slabs finding is the plate's cleanest, and it survived the refresh exactly — the same five tasks, one surface, one number. The taplo pad (12) is where plate 3A's six-hop chain touches ground: hops ①–② arrive from <code>mise run ci</code>, hop ③ is this block, and ④–⑥ leave immediately to run back inside mise through the cache gasket. And one lot in the yard is vacant on purpose — <code>//#lint:workflows</code>, the virtual <code>with</code> twin, has no command even here.</p>
<p><strong>REV E — the root yard re-platted, and one lot got its ground back.</strong> The whole plate cabinet was re-surveyed at ${PLATE.ref} @ ${PLATE.sha} in one pass, and every change on this plate is #693's. It retired <code>//#check:docs-api-deps</code> and put two guards where it stood — <code>//#check:graph-edges</code>, which watches ${fmt(row('//#check:graph-edges').inputs)} files — tied with <code>//#lint:package-json</code> for the widest lot in the yard, and the only one of the two that runs more than a line — and <code>//#check:task-inputs</code> on the root surface — so the yard is drawn with ${M.length} structures rather than 27 and reconciles ${CI.real} real tasks rather than 176. The same PR gave <code>//#check:patches</code> the root <code>$TURBO_DEFAULT$</code> glob it had been missing: its footprint goes 24 files to ${fmt(row('//#check:patches').inputs)}, which is why the yard's thinnest sliver is now a proper block and its note no longer calls it one. The plain, the tower and the five equal slabs did not move. Flatness held through all of it — ${FLAT} of ${CI.real} blocks are still a single script line — and the city now watches ${fmt(TOT_I)} task-file hashes against rev D's 27,953, almost all of it that one guard's new lot.</p>
<p><strong>One tier, uniformly red.</strong> Sheet 3's severity vocabulary survives, but at this altitude it degenerates truthfully: every real node in the <code>ci</code> graph stops the PR when it fails, so every massed block wears the same red hatch, and the drawing spends its information elsewhere. The ${MAIN.real - CI.real} ci:main-only tasks (test:engines ×3, check:pack, test:matrix) sit outside this survey on an unmassed accent annex — ${MAIN.nodes}/${MAIN.real} nodes when they are included; the ${fmt(PHANTOM)} phantom plots — ${PHPCT}% of the graph, transit and ^build hash carriers — are the vacant field behind the city, inventoried hole-by-hole on sheet 12.</p>
<p><strong>Roads and reach.</strong> Five arteries are drawn, one per district pair, and the plate labels them with degree rather than with an edge tally it cannot cite: <code>docs#build</code> waits on ${deg('docs#build', 'deps')} nodes (every quarter ships <code>docs:api</code> there, plus worker types and app fixtures — it is the city's sink), <code>@tools/typedoc-plugin-lit-ui-router#build:types</code> unblocks ${deg('@tools/typedoc-plugin-lit-ui-router#build:types', 'dependents')}, <code>@tools/release#check:exports</code> ${deg('@tools/release#check:exports', 'dependents')} (<code>pack:all</code> and <code>check:exports</code> read every quarter), and the widest fan-out in the graph is <code>lit-ui-router#build:types</code> at ${deg('lit-ui-router#build:types', 'dependents')}. Of the graph's ${fmt(CI.edges)} edges only ${CI.realEdges} join two real tasks; the rest hang off phantom transit nodes, which is why the roads are drawn as districts and not as a wire count.</p>`,
  key: [
    keyRow(`<polygon points="6,10 24,2 42,10 24,18" class="skr fp"/><polygon points="6,10 24,2 42,10 24,18" fill="url(#${P}-hr)"/>`, 'massed task block — stops the PR (all of them do)'),
    keyRow('<polygon points="6,10 24,2 42,10 24,18" class="sks fnone" stroke-dasharray="4 3"/>', 'vacant plot — phantom node, runs nothing'),
    keyRow(`<rect x="6" y="4" width="36" height="10" fill="url(#${P}-hd)" opacity="0.35"/><rect x="6" y="4" width="36" height="10" class="sks fnone" stroke-dasharray="5 4"/>`, `the phantom flats — ${fmt(PHANTOM)} plots (see sheet 12)`),
    keyRow(`<polygon points="6,10 24,2 42,10 24,18" class="ska fp"/><polygon points="6,10 24,2 42,10 24,18" fill="url(#${P}-ha)"/>`, 'ci:main annex — gates main, not the PR; unmassed'),
    keyRow(`<path d="M2,9 L40,9" class="sk2" marker-end="url(#${P}-ai)"/>`, 'artery — real dependsOn edges, count labelled'),
    keyRow(`<path d="M2,9 L40,9" class="ska" stroke-dasharray="3 3" marker-end="url(#${P}-aa)"/>`, 'the deepest chain passing through (plate 3A, hops ②③)'),
    keyRow('<polygon points="6,12 24,4 42,12 24,20" class="skr fp"/><rect x="21" y="1" width="6" height="8" class="skr fp"/>', 'height = command sloc — script line + the file behind it'),
    keyRow('<polygon points="2,14 24,4 46,14 24,24" class="skr fp"/>', 'footprint = watched files — the task’s hashed inputs'),
  ].join('\n'),
};

import { defs } from './chrome.mjs';
import { txt, arrow, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's3b';
const OX = 400, OY = 170;

// ---- census: bare `turbo run ci --dry=json` rerun 2026-08-17 at 3557c29 --------
// (saved as ci-dry-3b.json / mass-3b.json beside this file). 501 nodes, 158 real,
// 1,294 edges, 116 real->real — matching the handoff census. Per-task:
//   footprint = files the task hashes (the dry-run `inputs` map, counted per task)
//   height    = command mass: the package.json script line (1 sloc) + the repo
//               script/bin file it executes, sloc'd like sheet 3 (cites in schedule)
// 124 of 158 tasks have mass 1 — one script line riding an external binary.

const KS = 1.2;                      // footprint side = 1.2 · √(files hashed)
const KH = 0.45;                     // height = 0.45 px per command sloc
const S = (i) => Math.max(6, KS * Math.sqrt(i));
const H = (m) => Math.max(3, KH * m);
const fmt = (v) => v.toLocaleString('en-US');

// [n, name, x, y, inputs, mass, tasks, schedule note]
const M = [
  // --- the root yard (`//`) — every //# task drawn alone -------------------------
  [1,  '//#check:docs-api-deps',  0,   48, 1355, 39, 1, 'check-docs-api-deps.ts (38 sloc)'],
  [2,  '//#check:patches',        0,  110,   23, 71, 1, 'check-patches.ts (70 sloc) — the yard’s thinnest tower'],
  [3,  '//#format:check:root',    0,    0,  612,  1, 1, 'one oxfmt line · the 612-file root glob'],
  [4,  '//#format:check:toml',   88,  110,    9, 18, 1, 'mise run + tasks/taplo (16 sloc) — plate 3A, seam C'],
  [5,  '//#lint:actionlint',    144,  110,   16,  2, 1, 'mise run + config.toml run line'],
  [6,  '//#lint:elements',      114,    0,  612,  1, 1, 'one eslint line · same 612-file surface'],
  [7,  '//#lint:markdown',       56,  110,  154, 17, 1, 'mise run + tasks/rumdl (15 sloc)'],
  [8,  '//#lint:package-json',   60,   48, 1342,  1, 1, 'one eslint line watching 1,342 manifests'],
  [9,  '//#lint:root',           38,    0,  612,  1, 1, 'one oxlint line · same 612-file surface'],
  [10, '//#lint:shellcheck',     28,  110,   24, 24, 1, 'mise run + tasks/shellcheck (22 sloc)'],
  [11, '//#lint:templates',     152,    0,  612, 51, 1, 'lit-analyzer-ts-guard (30) + lint-templates (20)'],
  [12, '//#lint:toml',          116,  110,    9, 18, 1, 'mise run + tasks/taplo (16 sloc) — chain hop ③'],
  [13, '//#lint:zizmor',        172,  110,   17,  2, 1, 'mise run + config.toml run line'],
  [14, '//#typecheck:root',      76,    0,  612,  1, 1, 'one tsc line · same 612-file surface'],
  // --- the four package quarters -------------------------------------------------
  [15, 'lit-ui-router',         250,   30,  624, 137, 13, 'guards + oxc-emit + bundle-probe bins behind 13 tasks'],
  [16, 'lit-ui-router-mobx',    292,   30,  299, 172, 14, 'heaviest commands: both compat guards ride 6 tasks'],
  [17, 'nav-location-plugin',   360,   30,  196,  96, 10, 'the smallest quarter, same block shape'],
  [18, 'ui-router-server',      325,   30,  377,  98, 12, 'node:test + runtime-globals lanes'],
  // --- the instrument end of town -------------------------------------------------
  [19, '@tools/release',        600,   15,  405, 108, 6, 'pack-all.ts (38) + check-exports.ts (64) live here'],
  [20, '@tools/dts-backtest',   700,   40,   30, 293, 3, 'run.ts — 290 sloc on a 30-file footprint: THE TOWER'],
  [21, '@tools/shared',         600,   90,   75,   4, 4, 'the library under the instruments — all one-liners'],
  [22, 'typedoc-plugin',        634,   96,   58,  61, 6, 'oxc-emit both passes — and the widest blast radius'],
  [23, 'instrument terrace',    690,  124,  287,  42, 42, '13 small tools × their style/test/typecheck rows'],
  // --- south of the river ---------------------------------------------------------
  [24, 'docs — the harbour',    330,  205,  619,  33, 9, 'every quarter ships docs:api here — 37 inbound edges'],
  [25, 'examples — the plain',  420,  250, 13443, 17, 4, '13,443 files watched by 17 sloc of command'],
  [26, 'apps (5 sample pkgs)',  150,  210,  550,  21, 21, '5 packages, 21 tasks, every command one line'],
];

const geom = new Map(M.map(([n, , x, y, inputs, mass]) => {
  const side = S(inputs), h = H(mass);
  return [n, { n, x, y, side, h, cx: x + side / 2, cy: y + side / 2 }];
}));
const g = (n) => geom.get(n);
const pt = (x, y, z = 0) => isoPt(OX, OY, x, y, z);
const p2 = (x, y, z = 0) => pt(x, y, z).map((v) => v.toFixed(1)).join(',');

// One gate tier only: everything the ci graph runs stops the PR (sheet 3's "pr"
// red-hatch vocabulary), so severity is uniform by construction — the finding.
function massBlock(n) {
  const { x, y, side, h } = g(n);
  const body = isoBlock(P, OX, OY, x, y, side, side, h, { capCls: 'fp', edge: 'skr', sideFill: `url(#${P}-hr)` });
  const top = [p2(x, y, h), p2(x + side, y, h), p2(x + side, y + side, h), p2(x, y + side, h)].join(' ');
  const wash = `<polygon points="${top}" fill="url(#${P}-hr)"/>
<polygon points="${top}" class="skr fnone"/>`;
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
  return `${body}${wash}
<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="9" class="skr fp"/>
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

// ---- phantom flats: one vacant field, 343 plots, never enumerated here ----------
const field = `<polygon points="${[p2(0, -100), p2(460, -100), p2(460, -65), p2(0, -65)].join(' ')}" fill="url(#${P}-hd)" opacity="0.3"/>
<polygon points="${[p2(0, -100), p2(460, -100), p2(460, -65), p2(0, -65)].join(' ')}" class="sks fnone" stroke-dasharray="7 5"/>`;

// ---- roads: real->real edges between districts, counts from the dry-run ---------
const roads = [
  leg([[300, 60, 0], [300, 160, 0], [345, 160, 0], [345, 205, 0]], {}),                       // quarters -> docs (32)
  leg([[264, 60, 0], [264, 190, 0], [164, 190, 0], [164, 210, 0]], {}),                       // quarters -> apps (15)
  leg([[380, 50, 0], [560, 50, 0], [560, 27, 0], [596, 27, 0]], { cls: 'sks' }),              // quarters -> release (12)
  leg([[634, 106, 0], [420, 106, 0], [420, 62, 0], [386, 62, 0]], { cls: 'sks' }),            // typedoc -> quarters (20)
  leg([[380, 54, 0], [660, 54, 0], [660, 43, 0], [696, 43, 0]], { cls: 'sks', dash: '5 4' }), // quarters -> dts tower (4)
].join('\n');
const roadLabels = `${txt(572, 430, '32 ↦ the harbour', 'lblf')}
${txt(740, 530, '20 ↤ typedoc', 'lblf')}`;

// ---- the chain: hops ② -> ③ pass through this city (plate 3A traces all six) ----
const chain = leg([[20, 230, 0], [119, 230, 0], [119, 118, 0]], { mk: 'aa', cls: 'ska', dash: '3 3', t0: 0, t1: 8 });

// ---- ci:main annex: outside this survey, drawn unmassed -------------------------
const annex = `${isoBlock(P, OX, OY, 740, 170, 34, 18, 5, { capCls: 'fp', edge: 'ska', sideFill: `url(#${P}-ha)` })}
<polygon points="${[p2(740, 170, 5), p2(774, 170, 5), p2(774, 188, 5), p2(740, 188, 5)].join(' ')}" fill="url(#${P}-ha)"/>`;

// ---- bodies painted back to front ----------------------------------------------
const bodies = M.map(([n]) => n)
  .sort((a, b) => (g(a).cx + g(a).cy) - (g(b).cx + g(b).cy))
  .map(massBlock)
  .join('\n');

// ---- structure schedule ---------------------------------------------------------
const TOT_T = M.reduce((a, r) => a + r[6], 0);
const TOT_I = M.reduce((a, r) => a + r[4], 0);
const TOT_M = M.reduce((a, r) => a + r[5], 0);
const schedRow = ([n, name, , , inputs, mass, tasks, note]) =>
  `${String(n).padStart(2, ' ')}  ${name} — ${tasks}t · ${fmt(inputs)} files · ${fmt(mass)} sloc · ${note}`;
const half = Math.ceil(M.length / 2);
const ART_H = 700;
const SY = ART_H + 14;
const schedule = `<rect x="40" y="${SY}" width="1320" height="${90 + half * 16}" class="sk fp"/>
${txt(58, SY + 22, 'STRUCTURE SCHEDULE — tasks (t) · watched files (per-task inputs, summed) · command sloc · every mass cited in mass-3b.json', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1360" y2="${SY + 32}" class="skf"/>
${M.slice(0, half).map((r, i) => txt(58, SY + 50 + i * 16, schedRow(r), 'lbls')).join('\n')}
${M.slice(half).map((r, i) => txt(712, SY + 50 + i * 16, schedRow(r), 'lbls')).join('\n')}
${txt(58, SY + 56 + half * 16, `TOTALS — 26 massed structures reconcile all 158 real tasks · ${fmt(TOT_I)} task-file hashes · ${fmt(TOT_M)} command sloc · +1 vacant twin lot (//#lint:workflows, phantom) · 343 phantom plots · surveyed 2026-08-17`, 'lbls')}
${txt(58, SY + 72 + half * 16, 'ROADS — 83 of 116 real→real edges drawn as arteries (32 into docs · 20 from the typedoc plugin · 15 to apps · 12 to release · 4 to the tower); the remaining 33 are local streets, itemised in the dry-run JSON', 'lblf')}`;

// ---- assemble -------------------------------------------------------------------
const svg = `<svg viewBox="0 0 1400 ${SY + 110 + half * 16}" role="img" aria-label="Isometric city of the lit-ui-router pull-request CI task graph, the second alternate plate at altitude three. Behind the city lies a long hatched vacant field: 343 phantom plots, the sixty-eight and a half percent of the graph that runs nothing. The root yard at the north-west holds every root-scoped task as its own pad: five equal slabs that each watch the same 612 root files, two huge flat pads watching 1,355 and 1,342 files with one-line commands, and a cluster of small pads including a thin 70-line tower for check:patches and the taplo pad the deepest chain enters. One vacant lot among them is the phantom lint:workflows twin. The four package quarters stand in a center row, massed by their watched files and the guard and emitter scripts behind their tasks. To the east, the instrument end of town: the release works, the typedoc plugin annotated with the widest blast radius, a terrace of thirteen small tools, and the city's landmark — the dts-backtest tower, 290 lines of run dot ts standing on a 30-file footprint. South of the river sit the apps block, the docs harbour that every quarter ships API docs into, and the defining horizontal feature: the examples plain, 13,443 watched files under 17 lines of command. Every massed block carries the same red hatch because every one stops the PR — severity is uniform by construction. Roads trace the real dependency arteries with edge counts; an accent dashed road marks where the six-hop deepest chain of plate 3A passes through. A structure schedule reconciles all 158 real tasks, their 22,972 task-file hashes and 1,329 command sloc.">
${defs(P)}

<rect x="40" y="24" width="420" height="72" class="skf fnone"/>
${txt(52, 42, 'PLATE 3B — THE SAME TWO MACHINES, CITY SIDE', 'lbls')}
${txt(52, 56, 'plate 3A drew the seams flat; this plate walks through seam B', 'lblf')}
${txt(52, 70, 'and surveys what turbo actually schedules on every PR', 'lblf')}
${txt(52, 84, 'source: bare `turbo run ci --dry=json` · 2026-08-17 · 501/158', 'lblf')}

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
${txt(1030, 150, 'PHANTOM FLATS — 343 vacant plots (68.5%)', 'lbls')}
${txt(1030, 163, 'no command — hash carriers for script-less', 'lblf')}
${txt(1030, 176, 'packages · punched hole-by-hole on SHEET 12', 'lblf')}

${txt(1100, 300, 'THE TOWER — @tools/dts-backtest#test', 'lblr')}
${txt(1100, 313, '290-sloc run.ts on a 30-file footprint:', 'lblf')}
${txt(1100, 326, 'the tallest command in the city (20)', 'lblf')}

${txt(1080, 480, 'BLAST RADIUS — typedoc-plugin#build:types', 'lbla')}
${txt(1080, 493, 'blocks 57 of 158 real tasks downstream —', 'lblf')}
${txt(1080, 506, 'the widest reach of any block (22)', 'lblf')}

${txt(1080, 540, 'MAIN-LINE ANNEX — ci:main adds 5 real', 'lbls')}
${txt(1080, 553, 'tasks (531/163 nodes) · outside this', 'lblf')}
${txt(1080, 566, 'survey, drawn unmassed · accent tier', 'lblf')}

${txt(60, 130, 'THE ROOT YARD — all 15 //# plots', 'lblb')}
${txt(60, 143, 'five equal slabs watch the same', 'lblf')}
${txt(60, 156, '612 root files (3·9·14·6·11)', 'lblf')}
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

${txt(430, 660, 'THE EXAMPLES PLAIN — 13,443 files watched by 17 sloc of command (25):', 'lblb')}
${txt(430, 673, 'format:check hashes 6,926 files, lint 6,471 — the corpus from sheet 9, now as CI surface', 'lblf')}

${txt(720, 610, 'the harbour (24): 37 real edges flow in — docs#build is where the city drains', 'lblf')}

${schedule}
</svg>`;

export const sheet3b = {
  num: '3B', id: 'graphcity', rev: 'A',
  title: 'THE WATCHED CITY',
  sub: 'ALTITUDE 3 · ALTERNATE PLATE B — the PR ci graph as a city: 158 real tasks in 26 massed structures · footprint = watched files (22,972 task-file hashes) · height = command sloc (1,329) · 343 phantom plots · surveyed 2026-08-17',
  scale: 'THE CI TASK GRAPH',
  form: 'ISOMETRIC GRAPH CITY',
  svg,
  caption: 'The pull-request graph that plate 3A traced as plumbing, surveyed here as ground: every real task massed by what it watches (footprint) and what it actually executes (height). The survey’s verdict is flatness — 124 of 158 blocks are a single script line riding an external binary — which makes the exceptions legible at a glance: a 290-line test tower on a 30-file lot, a 70-line patch check on a 23-file lot, and a 13,443-file plain patrolled by 17 lines of command.',
  notes: `
<p><strong>Method — the graph, remeasured.</strong> Every mass comes from a fresh bare <code>turbo run ci --dry=json</code> at HEAD (2026-08-17), which reproduced the handoff census exactly: 501 nodes, 158 real, 1,294 edges, 116 real→real. <em>Footprint</em> is the per-task <code>inputs</code> map — the files whose hashes decide that task's cache key — at 1.2·√files per side. <em>Height</em> is command mass: the package.json script line plus the repo script or bin file it executes, sloc-counted like sheet 3 (guards, emitters and mise task files each cited in the schedule; external binaries like <code>tsc</code> and <code>oxlint</code> contribute only their one line, because that is all this repo wrote). Wall-clock and cache-hit rates are excluded as geometry by design: they are properties of runs, not of the graph.</p>
<p><strong>The city is flat, and that is the finding.</strong> 124 of 158 real tasks have command mass 1 — one script line handing the work to a pinned binary. The whole city executes 1,329 sloc of repo-written command while watching 22,972 task-file hashes. So the skyline is inverted from intuition: the tallest structure is <code>@tools/dts-backtest#test</code>, a 290-line <code>run.ts</code> (tools/dts-backtest/run.ts) on a 30-file lot — sheet 3 called it "one 291-line run.ts holds the TS 5.0 floor", and the graph survey agrees — while the largest footprint, the examples plain, watches 13,443 files (format:check 6,926 + lint 6,471 alone) under 17 lines of command.</p>
<p><strong>The root yard repays the walk.</strong> All 15 <code>//#</code> plots are drawn individually: five equal slabs — <code>lint:root</code>, <code>typecheck:root</code>, <code>lint:elements</code>, <code>format:check:root</code>, <code>lint:templates</code> — each watch the same 612-file root surface; two one-line flats watch over 1,300 files apiece (<code>lint:package-json</code> 1,342, <code>check:docs-api-deps</code> 1,355); <code>check:patches</code> is a 70-line tower on a 23-file lot. The taplo pad (12) is where plate 3A's six-hop chain touches ground: hops ①–② arrive from <code>mise run ci</code>, hop ③ is this block, and ④–⑥ leave immediately to run back inside mise through the cache gasket. And one lot in the yard is vacant on purpose — <code>//#lint:workflows</code>, the virtual <code>with</code> twin, has no command even here.</p>
<p><strong>One tier, uniformly red.</strong> Sheet 3's severity vocabulary survives, but at this altitude it degenerates truthfully: every real node in the <code>ci</code> graph stops the PR when it fails, so every massed block wears the same red hatch, and the drawing spends its information elsewhere. The five ci:main-only tasks (test:engines ×3, check:pack, test:matrix) sit outside this survey on an unmassed accent annex; the 343 phantom plots — 68.5% of the graph, transit and ^build hash carriers — are the vacant field behind the city, inventoried hole-by-hole on sheet 12.</p>
<p><strong>Roads and reach.</strong> The arteries carry 83 of the 116 real→real edges: 32 into the docs harbour (every quarter ships <code>docs:api</code> there, plus worker types and app fixtures — docs#build is the city's sink), 20 out of the typedoc plugin (every <code>docs:api</code> waits on it), 15 down to the apps, 12 into the release works (<code>pack:all</code> and <code>check:exports</code> read all four quarters), 4 to the tower. The remaining 33 are local streets. Reach is annotated once, where it is extreme: <code>@tools/typedoc-plugin-lit-ui-router#build:types</code> transitively blocks 57 of the 158 real tasks — the widest blast radius in the city.</p>`,
  key: [
    keyRow(`<polygon points="6,10 24,2 42,10 24,18" class="skr fp"/><polygon points="6,10 24,2 42,10 24,18" fill="url(#${P}-hr)"/>`, 'massed task block — stops the PR (all of them do)'),
    keyRow('<polygon points="6,10 24,2 42,10 24,18" class="sks fnone" stroke-dasharray="4 3"/>', 'vacant plot — phantom node, runs nothing'),
    keyRow(`<rect x="6" y="4" width="36" height="10" fill="url(#${P}-hd)" opacity="0.35"/><rect x="6" y="4" width="36" height="10" class="sks fnone" stroke-dasharray="5 4"/>`, 'the phantom flats — 343 plots (see sheet 12)'),
    keyRow(`<polygon points="6,10 24,2 42,10 24,18" class="ska fp"/><polygon points="6,10 24,2 42,10 24,18" fill="url(#${P}-ha)"/>`, 'ci:main annex — gates main, not the PR; unmassed'),
    keyRow(`<path d="M2,9 L40,9" class="sk2" marker-end="url(#${P}-ai)"/>`, 'artery — real dependsOn edges, count labelled'),
    keyRow(`<path d="M2,9 L40,9" class="ska" stroke-dasharray="3 3" marker-end="url(#${P}-aa)"/>`, 'the deepest chain passing through (plate 3A, hops ②③)'),
    keyRow('<polygon points="6,12 24,4 42,12 24,20" class="skr fp"/><rect x="21" y="1" width="6" height="8" class="skr fp"/>', 'height = command sloc — script line + the file behind it'),
    keyRow('<polygon points="2,14 24,4 46,14 24,24" class="skr fp"/>', 'footprint = watched files — the task’s hashed inputs'),
  ].join('\n'),
};

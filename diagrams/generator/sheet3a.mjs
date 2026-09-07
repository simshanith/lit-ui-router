import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, box, arrow, keyRow } from './helpers.mjs';

const P = 's3a';

// ---- census: IMPORTED, rev C (INITIATIVES.md I5) ---------------------------------
// The vanished tmp/handoff-census generator is reconstructed as census-handoff.mjs,
// a T1 tree probe: workflows / mise tasks / turbo definitions counted from the
// archive.  The turbo GRAPH is census-plate.json's ci + ci:main dry-runs.  Nothing
// numeric is hand-pasted here; only the task-name lists, the prose and the cited
// file:lines are editorial.  This plate promotes the sheet-3 "two task managers"
// inset to a full sheet; the inset stays.
const HANDOFF = JSON.parse(readFileSync(new URL('../data/census-handoff.json', import.meta.url), 'utf8'));
const PLATE = JSON.parse(readFileSync(new URL('../data/census-plate.json', import.meta.url), 'utf8'));

const W = HANDOFF.workflows;
const M = HANDOFF.mise;
const T = HANDOFF.turbo;
const H = (file) => {
  const r = HANDOFF.miseHomes.find((h) => h.home === file);
  if (!r) throw new Error(`plate 3A: mise home ${file} is missing from diagrams/data/census-handoff.json`);
  return r;
};
const pipe = (n) => {
  const p = PLATE.pipelines[n];
  if (!p) throw new Error(`plate 3A: pipeline ${n} is missing from diagrams/data/census-plate.json`);
  return p;
};
const CI = pipe('ci');
const MAIN = pipe('ci:main');
const PHANTOM = CI.nodes - CI.real;
// one fanned name by name — the rev-D note cites the docs:api column
const ciName = (n) => CI.names.find((x) => x.name === n)
  ?? (() => { throw new Error(`plate 3A: ci has no task named ${n}`); })();
const PHANTOM_PCT = ((PHANTOM / CI.nodes) * 100).toFixed(1);
const fmt = (n) => n.toLocaleString('en-US');
const TURBO_V = PLATE.wasAssociatedWith.find((t) => t.startsWith('turbo'));
const BASIS = `counted at ${HANDOFF.ref} @ ${HANDOFF.sha} (${HANDOFF.generatedAtTime.slice(0, 10)})`;
const GRAPH_BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)}) · ${TURBO_V}`;

// The plate is FLAT on purpose, like the inset it grows from: a task manager is
// not a place.  Two machines, four seams drawn as gaskets, three service doors.

// ---- small builders -------------------------------------------------------------
const lf = (x, y, arr, lh = 12, cls = 'lblf', anchor = 'start') =>
  arr.map((s, i) => {
    const [str, c] = Array.isArray(s) ? s : [s, cls];
    return txt(x, y + i * lh, str, c, anchor);
  }).join('\n');
const clines = (x, y, rows, lh = 12.5) =>
  rows.map(([s, cls], i) => txt(x, y + i * lh, s, cls, 'middle')).join('\n');

// ---- the spine, rev E: derived from the DIN measure, not hand-set ---------------
// Every frame here was drawn to the old mono advance and now holds a line ~26%
// shorter, so the horizontal spine is computed from the widest label each mass
// carries: five masses and two corridors sum to the 1320 between the margins, and
// each corridor is its seam caption's own measure plus air on both sides.
const GX = 40, GW = 168;                 // GITHUB ACTIONS — widest footnote 142
const MX = 344, MW = 330;                // MISE — two compartment columns + gutters
const C1 = 145, C2 = 151, CGAP = 10;     // columns sized to their own widest row
const SHX = 814, SHW = 546;              // phantom shroud (20 of wall each side)
const CX = 834, CW = 506, CPAD = 14;     // turbo core — the 472px PORTS line sets CW
const CL = CX + CPAD, CR = CX + CW - CPAD;
const SEAM_A = 276, SEAM_B = 744;        // corridor centre lines
const PW = 142, PGAP = 26;               // re-entrant port boxes
const portX = (i) => CL + (i % 3) * (PW + PGAP);
const DUCT_X = CL + PW + PGAP + PW / 2;  // door 1 enters and the duct leaves on one axis
const CACHE_X = 712, DX = 1120, DW = 240; // bottom band: three columns, even gutters
// One leading for every stacked label on the plate. The data face sets an 11px
// accent row 13.9 high, so 13 is the pitch that keeps a ★ line off the one below
// it; the old 10.5 was cut for a mono that stood 2px shorter.
const CLH = 13;
const compH = (n) => 27 + (n - 1) * CLH + 12;
// Both machines stand on one base line, and the duct band and caption band drop
// with them: the compartments are now as tall as their task lists demand.
const MACH_BOT = 577, DUCT_Y = 620, BAND_Y = 652;

// A coupling gasket: two bolted plates across a trunk.
function gasket(x, y, h, { hatch = null } = {}) {
  const plates = `${box(x, y, 5, h, 'sk fp2')}${box(x + 15, y, 5, h, 'sk fp2')}`;
  const band = hatch ? `<rect x="${x + 5}" y="${y + 4}" width="10" height="${h - 8}" fill="url(#${P}-${hatch})"/>` : '';
  const bolts = [[x + 2.5, y - 5], [x + 17.5, y - 5], [x + 2.5, y + h + 5], [x + 17.5, y + h + 5]]
    .map(([bx, by]) => `<circle cx="${bx}" cy="${by}" r="2.4" class="skf fnone"/>`).join('');
  return plates + band + bolts;
}

// ---- GITHUB ACTIONS panel -------------------------------------------------------
// rows, counts and the no-mise list all read from the plate; ① marks the chain head
const CHAIN_WF = 'build-test-run';
const WF = HANDOFF.workflowRows.filter((w) => w.callSites)
  .sort((a, b) => b.callSites - a.callSites || (a.name < b.name ? -1 : 1));
const NO_MISE = HANDOFF.workflowRows.filter((w) => !w.callSites).map((w) => w.name);
const wfRowY = (i) => 162 + i * 37;
const ghPanel = `${box(GX, 110, GW, MACH_BOT - 110, 'sk2 fp')}
${txt(GX + 12, 130, 'GITHUB ACTIONS', 'lblb')}
${txt(GX + 12, 143, `${W.files} workflows · ${W.calling} call mise`, 'lblf')}
${WF.map(({ name, callSites }, i) => {
  const y = wfRowY(i);
  return `${box(GX + 12, y, GW - 24, 26, name === CHAIN_WF ? 'ska fp' : 'sk fp')}
${txt(GX + 20, y + 17, name, 'lbls')}
${txt(GX + GW - 20, y + 17, `·${callSites}`, 'lblf', 'end')}`;
}).join('\n')}
<line x1="${GX + 12}" y1="468" x2="${GX + GW - 12}" y2="468" class="skf"/>
${lf(GX + 12, 482, [
  `no mise: ${NO_MISE[0]},`,
  NO_MISE.slice(1).join(' · '),
])}
${lf(GX + 12, 522, [
  ['branch_ci_gate needs', 'lbls'],
  ['NO setup — node builtins', 'lbls'],
  '(build-test-branch.yml:35-36)',
])}`;

// ---- SEAM A — workflow → mise ---------------------------------------------------
const seamA = `${arrow(P, `M${GX + GW},285 L${MX - 8},285`, 'ai', 'sk2')}
<path d="M${GX + GW},291 L${MX - 8},291" class="ska" stroke-dasharray="3 3" fill="none"/>
${txt(GX + GW + 14, 278, '①', 'lbla')}
${gasket(SEAM_A - 10, 240, 90)}
${clines(SEAM_A, 362, [
  ['SEAM A', 'lbla'], ['WORKFLOW → MISE', 'lbls'],
  [`${W.callSites} call sites`, 'lblf'], [`${W.targets} distinct targets`, 'lblf'],
  ['args cross as env —', 'lblf'], ['step env: satisfies', 'lblf'],
  ['$usage_* flags; no', 'lblf'], ['${{ }} in run lines', 'lblf'],
  ['buys: pinned tools +', 'lblf'], ['node-free bootstrap', 'lblf'],
])}`;

// ---- MISE machine ---------------------------------------------------------------
const comp = (x, y, w, rows, head) =>
  `${box(x, y, w, compH(rows.length), 'sk fp')}
${txt(x + 8, y + 14, head, 'lbls')}
${rows.map(([s, cls], i) => txt(x + 8, y + 27 + i * CLH, s, cls)).join('\n')}`;

const mise = `${box(MX, 110, MW, MACH_BOT - 110, 'sk2 fp')}
${txt(MX + 12, 130, 'MISE — THE NODE-FREE UMBRELLA', 'lblb')}
${txt(MX + 12, 143, `${M.tasks} tasks · ${M.homes} homes · ${M.withDepends} use depends · ${M.withUsage} with $usage_* specs`, 'lblf')}
${box(MX + 12, 155, MW - 24, 48, 'sk fp2')}
${txt(MX + 20, 169, 'TOOL BELT — aqua pins, mise.lock checksums', 'lbls')}
${txt(MX + 20, 183, '⑥ taplo 0.10.0 · rumdl · shellcheck · pnpm (bootstrap)', 'lblf')}
${txt(MX + 20, 195, 'actionlint · zizmor — node never installs these', 'lblf')}
${comp(MX + 12, 212, C1, [
  ['xvfb · branch_ci_gate', 'lblf'], ['turbo_summary · cypress', 'lblf'],
  ['playwright_version', 'lblf'], ['cypress_version', 'lblf'],
  ['playwright', 'lblf'], ['playwright_deps_engines', 'lblf'],
  ['✕ playwright_deps — DEAD', 'lblr'], ['no caller; superseded', 'lblr'],
  ['(mise.toml:72-76)', 'lblr'],
], `${H('tools/build_and_test/mise.toml').label} — ${H('tools/build_and_test/mise.toml').count}`)}
${comp(MX + 12 + C1 + CGAP, 212, C2, [
  ['⑤ taplo · rumdl', 'lblf'], ['shellcheck · read_secret', 'lblf'],
  ['turbo_login', 'lblf'], ['turbo_link_worktree', 'lblf'],
  ['cloudflare_item_create', 'lblf'], ['§ check_workers_builds', 'lblf'],
  ['measure_deflake', 'lblf'], ['§ = the one mise→pnpm→', 'lblf'],
  ['turbo loop-closer (manual)', 'lblf'],
], `${H('.config/mise/tasks/*').label} — ${H('.config/mise/tasks/*').count}`)}
${comp(MX + 12, 370, C1, [
  ['git_user · package_info', 'lblf'], ['pack · check_tarball', 'lblf'],
  ['reconcile · tag · tag_push', 'lblf'], ['publish · bump', 'lblf'],
  ['peer_floor_gate', 'lblf'], ['3× *_check_runs', 'lblf'],
  ['★ check_pack', 'lbla'], ['★ published_diff', 'lbla'],
  ['   (runs turbo ×2)', 'lblf'], ['↩ check_release_closure', 'lblf'],
], `${H('tools/release/mise.toml').label} — ${H('tools/release/mise.toml').count}`)}
${comp(MX + 12 + C1 + CGAP, 370, C2, [
  ['② ★ ci · ★ ci_main', 'lbla'], ['★ build', 'lbla'],
  ['★ codecov_bundle', 'lbla'], ['★ dts_backtest_matrix', 'lbla'],
  ['↩ lint_actionlint', 'lblf'], ['↩ lint_zizmor', 'lblf'],
  ['④ ↩ lint_toml', 'lblf'], ['↩ lint_shellcheck', 'lblf'],
  ['↩ lint_markdown', 'lblf'], ['↩ format_check_toml', 'lblf'],
  ['↩ format_toml (writer)', 'lblf'], ['⌂ lint_workflows (dep×4)', 'lblf'],
  ['setup · cloudflare_login', 'lblf'],
], `${H('.config/mise/config.toml').label} — ${H('.config/mise/config.toml').count}`)}
${txt(MX, MACH_BOT + 15, '★ shells turbo (7) · ↩ turbo re-enters (8)', 'lblf')}`;

// ---- SEAM B — mise → turbo ------------------------------------------------------
// Both trunks run on one datum at y=285, so the sheet reads as the single left-to-
// right pass it claims to be, and seam B's caption clears its own gasket.
const seamB = `${arrow(P, `M${MX + MW},285 L${SHX - 8},285`, 'ai', 'sk2')}
<path d="M${MX + MW},291 L${SHX - 8},291" class="ska" stroke-dasharray="3 3" fill="none"/>
${gasket(SEAM_B - 10, 263, 46)}
${clines(SEAM_B, 122, [
  ['SEAM B', 'lbla'], ['MISE → TURBO', 'lbls'],
  ['7 tasks', 'lblf'], ['8 invocations', 'lblf'],
  ['TURBO_* crosses', 'lblf'], ['as ambient env —', 'lblf'],
  ['no flags at all', 'lblf'], ['buys: remote', 'lblf'],
  ['cache + summary', 'lblf'],
], CLH)}`;

// ---- TURBO machine: phantom shroud wall + real core -----------------------------
const wall = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${P}-hd)" opacity="0.45"/>`;
const PORTS = [
  ['//#lint:actionlint'], ['//#lint:zizmor'], ['③ //#lint:toml'],
  ['//#lint:shellcheck'], ['//#lint:markdown'], ['//#format:check:toml'],
];
const turbo = `<rect x="${SHX}" y="110" width="${SHW}" height="${MACH_BOT - 110}" class="sks fnone" stroke-dasharray="7 5"/>
${wall(SHX + 1, 111, SHW - 2, 19)}${wall(SHX + 1, MACH_BOT - 19, SHW - 2, 18)}${wall(SHX + 1, 130, 19, MACH_BOT - 149)}${wall(SHX + SHW - 20, 130, 19, MACH_BOT - 149)}
${box(CX, 130, CW, MACH_BOT - 150, 'sk2 fp')}
${txt(CL, 152, 'TURBO — THE CACHED FAN-OUT', 'lblb')}
${lf(CL, 168, [
  `ci graph: ${CI.nodes} nodes · ${CI.real} real · ${fmt(CI.edges)} edges · ${CI.realEdges} real→real`,
  `${T.files} turbo.json files · ${T.definitions} task definitions (${T.rootDefinitions} root + ${T.memberDefinitions} member)`,
  `ci:main overlay: ${MAIN.nodes} nodes · ${MAIN.real} real (+${MAIN.real - CI.real} real tasks)`,
  `${T.cacheFalse} cache:false tasks repo-wide — ${CI.cacheFalse.length === 0 ? 'ZERO' : CI.cacheFalse.length} reachable from ci`,
  `counted from bare \`turbo run ci --dry=json\` · ${PLATE.generatedAtTime.slice(0, 10)}`,
], 13)}
${box(CL, 244, 140, 26, 'sk fp2')}${txt(CL + 70, 261, 'ci → ci:pull_request', 'lbls', 'middle')}
${box(CR - 206, 244, 206, 26, 'sk fp2')}${txt(CR - 103, 261, `ci:main = ci:pr + ${MAIN.nodes - CI.nodes} nodes, ${MAIN.real - CI.real} real`, 'lbls', 'middle')}
${txt(CL, 291, 'turbo.json:352-366 — 11 dependsOn lanes under ci:pull_request', 'lblf')}
${txt(CL, 315, `PHANTOM SHROUD — ${PHANTOM} of ${CI.nodes} nodes run nothing (${PHANTOM_PCT}%)`, 'lbls')}
${txt(CL, 328, 'transit / ^build hash carriers — punched hole-by-hole on SHEET 12', 'lblf')}
<line x1="${CX + 10}" y1="320" x2="${CX - 6}" y2="320" class="skf"/>
${box(CL, 346, 200, 26, 'ska fp')}${txt(CL + 100, 363, '//#lint:workflows — virtual with ×4', 'lbls', 'middle')}
${txt(CL + 210, 363, '← the turbo twin', 'lblf')}
${txt(CL, 400, 'RE-ENTRANT PORTS — six root //# scripts whose command is `mise run …` + 1 member port ↓', 'lblf')}
${PORTS.map(([name], i) => {
  const x = portX(i), y = 410 + Math.floor(i / 3) * 34;
  return `${box(x, y, PW, 24, 'sk fp2')}${txt(x + PW / 2, y + 16, name, 'lbls', 'middle')}`;
}).join('\n')}
${lf(CR - 172, 508, ['the seven results cache in turbo,', 'keyed on files mise owns ↓', '7th: release#check:release-closure'])}`;

// ---- SEAM C — the return duct + the cache gasket (the star finding) -------------
const RET_X = MX + 12 + C1 + CGAP + C2 / 2;
const duct = `${arrow(P, `M${DUCT_X},476 L${DUCT_X},${DUCT_Y} L${RET_X},${DUCT_Y} L${RET_X},${MACH_BOT + 6}`, 'ai', 'sk2')}
<path d="M${DUCT_X - 6},482 L${DUCT_X - 6},${DUCT_Y - 6} L${RET_X + 6},${DUCT_Y - 6} L${RET_X + 6},${MACH_BOT + 6}" class="ska" stroke-dasharray="3 3" fill="none"/>
${gasket(770, DUCT_Y - 20, 40, { hatch: 'ha' })}`;

// ---- twins link -----------------------------------------------------------------
const twins = `${arrow(P, `M${CL},359 L${SEAM_B},359 L${SEAM_B},452 L${MX + MW + 6},452`, 'aa', 'ska', '5 4')}
${clines(SEAM_B, 474, [
  ['HAND-SYNCED TWINS', 'lbls'], ['⌂ lint_workflows', 'lblf'],
  ['config.toml:139-143', 'lblf'], ['∥ //#lint:workflows', 'lblf'],
  ['turbo.json:251-261', 'lblf'], ['same 4 legs, kept', 'lblf'],
  ['in sync by hand', 'lblf'],
])}`;

// ---- door 1 route (bare turbo over the umbrella) --------------------------------
const D1_X = GX + GW + 28;
const D1_Y = wfRowY(5) + 13; // the door sits on the panel edge, mid-row
const door1 = `${box(GX + GW - 8, D1_Y - 7, 8, 14, 'skr fp')}<rect x="${GX + GW - 8}" y="${D1_Y - 7}" width="8" height="14" fill="url(#${P}-hr)"/>
${arrow(P, `M${GX + GW},${D1_Y} L${D1_X},${D1_Y} L${D1_X},102 L${DUCT_X},102 L${DUCT_X},108`, 'ar', 'skr', '6 4')}
${txt((D1_X + DUCT_X) / 2, 94, 'DOOR 1 — deflake-e2e.yml:73 · bare `turbo run build --filter=…` — over the umbrella, straight into turbo (PATH still mise)', 'lblr', 'middle')}`;

// ---- bottom captions ------------------------------------------------------------
const chainCap = `${txt(40, BAND_Y, 'THE DEEPEST CHAIN — 6 HOPS · runs on every PR, ×4 tool lanes', 'lbla')}
${lf(40, BAND_Y + 18, [
  '① build-test-run.yml:114 — `mise run ci` (env: TURBO_FORCE · TURBO_TOKEN/API/TEAM)',
  '② mise ci — `turbo run ci --summarize` (.config/mise/config.toml:204)',
  '③ turbo //#lint:toml — executes the root script `mise run lint_toml` (package.json:33)',
  '④ mise lint_toml — `mise run taplo lint` (.config/mise/config.toml:124)',
  '⑤ file task .config/mise/tasks/taplo — exec taplo over `git ls-files -- *.toml`',
  '⑥ taplo 0.10.0 — pinned (.config/mise/config.toml:77) · terminal: a binary, not a task',
])}
${txt(40, BAND_Y + 96, 'why it never recurses: the ★ set and the ↩ set are disjoint — mise→turbo→mise is a DAG in a loop costume', 'lbls')}`;

const cacheCap = `${txt(CACHE_X, BAND_Y + 8, 'DETAIL — THE CACHE GASKET: TURBO CACHES MISE', 'lbla')}
${lf(CACHE_X, BAND_Y + 26, [
  '//#lint:* inputs hash .config/mise/tasks/* AND mise.lock',
  '(turbo.json:264-268 · 281-287 · 292-298)',
  'a taplo pin bump busts exactly the taplo lane — nothing else',
  'turbo holds the cache; mise holds the versions; the gasket',
  'hashes one machine against the other',
])}
<line x1="${CACHE_X + 30}" y1="${BAND_Y - 2}" x2="772" y2="${DUCT_Y - 18}" class="skf"/>`;

const doorsBox = `${box(DX, BAND_Y - 16, DW, 152, 'skr fp')}
<rect x="${DX + DW - 60}" y="${BAND_Y - 16}" width="60" height="20" fill="url(#${P}-hr)"/>
<rect x="${DX}" y="${BAND_Y - 16}" width="${DW}" height="20" class="skr fnone"/>
${txt(DX + 10, BAND_Y - 2, 'SERVICE DOORS — 3 BYPASSES', 'lblr')}
${lf(DX + 10, BAND_Y + 18, [
  ['1 deflake-e2e.yml:73 — bare turbo', 'lblr'],
  ['  build --filter (skips mise tasks)', 'lblf'],
  ['2 deflake-e2e.yml:87 — deflake runs', 'lblr'],
  ['  OUTSIDE turbo: a cached test task', 'lblf'],
  ['  would replay attempt 1 logs (:6-8)', 'lblf'],
  ['3 cloudflare-build.sh:26-38 — the', 'lblr'],
  ['  PRODUCTION docs deploy, rev C:', 'lblf'],
  ['  npm -g pnpm@12.2.1 replaces the', 'lblf'],
  ['  corepack shims, then npx turbo', 'lblf'],
  ['  docs#build — still NO mise', 'lblf'],
])}`;

// ---- seam schedule --------------------------------------------------------------
const SCHED = [
  `A   workflow → mise — ${W.callSites} call sites · ${W.targets} targets · crossing: env, never argv (no \${{ }} in run lines) · buys: pinned tools + node-free bootstrap · ${W.calling} workflow files`,
  'B   mise → turbo — 7 tasks · 8 invocations · crossing: TURBO_* ambient env · buys: remote cache + --summarize · config.toml:193-220 · tools/release/mise.toml:97,104-107',
  'C   turbo → mise — 7 root scripts + 1 member script (7 in ci) · crossing: script body `mise run …` · buys: TURBO CACHES MISE — inputs hash the task files + mise.lock · turbo.json:264-298 · tools/release/turbo.json:39-50',
  'D   mise → pnpm → turbo — 1 (check_workers_builds, manual) · turbo leg is cache:false, so the crossing buys only env passthrough + addressing · tasks file :21',
  `D2  mise → mise — 8 edges · ${M.dependsEdges} depends (setup · lint_workflows ×4, from ${M.withDepends} declaring tasks) + run-line delegations · cutest: turbo_login → $(mise run read_secret) · config.toml:94,143`,
  'E   bypasses — 3, all deliberate · deflake-e2e.yml:73 (bare turbo) · :87 (pnpm outside turbo) · cloudflare-build.sh:26-38 (npm -g pnpm + npx turbo, no mise — production)',
];
const SY = BAND_Y + 156;
const schedule = `${box(40, SY, 1320, 170, 'sk fp')}
${txt(58, SY + 22, 'SEAM SCHEDULE — every crossing between the two machines · what crosses · what the boundary buys · cite', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1360" y2="${SY + 32}" class="skf"/>
${SCHED.map((s, i) => txt(58, SY + 52 + i * 17, s, 'lbls')).join('\n')}
${txt(58, SY + 58 + SCHED.length * 17, `TOTALS — ${M.tasks} mise tasks · ${M.withUsage} with $usage_* specs · ${T.definitions} turbo definitions · ci ${CI.nodes} nodes / ${CI.real} real · 1 dead task (playwright_deps) · ${BASIS} · graph via ${TURBO_V}`, 'lblf')}`;

// ---- assemble -------------------------------------------------------------------
const svg = `<svg viewBox="0 0 1400 ${SY + 190}" role="img" aria-label="Flat coupling schematic of the two task managers in the lit-ui-router monorepo, promoted from the small inset on sheet 3. On the left a GitHub Actions panel lists eleven workflows, eight of which call mise for a total of thirty-seven call sites. A trunk crosses a bolted gasket labeled seam A into the mise machine, drawn as a node-free umbrella housing ${M.tasks} tasks in four compartments: a tool belt of aqua-pinned binaries, nine build-and-test tasks including one dead task drawn in red, nine file tasks, sixteen release tasks, and fifteen inline tasks. Seven tasks marked with stars shell out to turbo; eight marked with return arrows are re-entered from turbo, and the two sets never overlap. A second gasket, seam B, crosses into the turbo machine, drawn as a real core of ${CI.real} tasks inside a hatched phantom shroud representing the ${PHANTOM} nodes that run nothing, cross-referenced to sheet twelve. Six root re-entrant ports at the bottom of the core return through a duct fitted with the featured cache gasket: turbo caches mise, because the lint tasks hash the mise task files and lockfile. The deepest chain, six hops from workflow YAML to the pinned taplo binary, is traced with circled digits and an accent thread. A red dashed service-door route arcs over the umbrella for the one bare-turbo bypass, and a red box catalogues all three deliberate bypasses including the mise-free production docs deploy. A seam schedule at the bottom lists every crossing with counts and citations.">
${defs(P)}

<rect x="40" y="24" width="414" height="58" class="skf fnone"/>
${txt(52, 42, 'PLATE 3A — THE SHEET-3 INSET, PROMOTED TO A FULL SHEET', 'lbls')}
${txt(52, 56, 'same spine as the sheet-3 top-left inset: Actions → mise → turbo → back again', 'lblf')}
${txt(52, 70, 'the inset stays on sheet 3; this plate is the full treatment it points to', 'lblf')}

${txt(1360, 34, 'READ LEFT TO RIGHT — every PR enters at a workflow, crosses two gaskets, and returns through the cache gasket', 'lbls', 'end')}
${txt(1360, 48, 'EMPHASIS — circled digits ①–⑥ + accent thread = the deepest chain · red + hatch = the service doors', 'lblf', 'end')}
${txt(1360, 62, 'REV D whole-cabinet refresh — mise STILL unmoved at 48 tasks / 37 call sites · turbo 96 definitions in 17 files (97 in 18 at rev C) · ci 590→586 nodes, 176→177 real', 'lblf', 'end')}

${door1}
${ghPanel}
${seamA}
${mise}
${seamB}
${turbo}
${duct}
${twins}
${chainCap}
${cacheCap}
${doorsBox}
${schedule}
</svg>`;

export const sheet3a = {
  num: '3A', id: 'handoff', rev: 'E',
  title: 'THE HANDOFF WORKS',
  sub: `ALTITUDE 3 · ALTERNATE PLATE — the sheet-3 task-manager inset at full size: ${W.calling} of ${W.files} workflows · ${M.tasks} mise tasks in ${M.homes} homes · turbo ci ${CI.nodes} nodes, ${CI.real} real · 4 seam types · 3 service doors · REV B: census refresh 2026-08-31 · REV C: the vanished tmp/ census is a scripted probe — every count imported from diagrams/data/census-handoff.json + census-plate.json · REV D: whole-cabinet refresh — mise unmoved a third time, turbo down to 17 files / 96 definitions · REV E 2026-09-06: recomposed to the data face — every frame on this plate was drawn to the old mono advance and is now sized to the widest DIN line it holds, so the spine is computed rather than hand-set: the Actions panel, the mise compartments and the service-door catalogue tighten to their own measure, the freed width goes to the two seam corridors and to the turbo core, which finally fits its re-entrant-ports line, one leading runs through all four mise compartments and each is as tall as its task list, and the bottom band files as three columns on even gutters · ${BASIS}`,
  scale: 'TWO TASK MANAGERS',
  form: 'COUPLING SCHEMATIC',
  svg,
  caption: 'The two task managers drawn as the two machines they are — mise the node-free umbrella, turbo the cached fan-out — with the seams as the featured parts: every crossing is a bolted gasket labeled with what crosses it and what the boundary buys. The star fitting is the cache gasket on the return duct: turbo caches mise, because the six re-entrant lint lanes hash the mise task files and mise.lock, so a tool-pin bump invalidates exactly its own lane.',
  notes: `
<p><strong>Method — one census, cited throughout.</strong> Every count on this plate comes from a fresh 2026-08-17 census of the repo at HEAD: the 11 workflow files, all 17 <code>turbo.json</code> files, <code>.config/mise/**</code> and both member <code>mise.toml</code> files read directly, cross-checked against <code>mise tasks ls --all</code> and bare <code>turbo run ci --dry=json</code>. Three figures on the sheet-3 inset had drifted and were corrected at rev A: 36→37 workflow call sites, 51→48 repo-defined mise tasks (the 51 had mixed in four user-global <code>rtk:*</code> tasks), and 483→501 ci graph nodes after the lit dedupe — the phantom share held at 68.5%.</p>
<p><strong>Rev B — census refresh, 2026-08-31.</strong> The plate was re-measured from the same sources at HEAD, and the finding it exists to make survived intact: <em>the mise machine did not move a single task.</em> 48 tasks in the same four homes, 2 <code>depends</code> declarations, 21 <code>$usage_*</code> specs, 37 workflow call sites across the same 8 of 11 workflows, the same 7 ★ / 7 ↩ disjoint sets, the same 6 re-entrant ports, the same one dead task. Only turbo's graph grew, and only because the workspace did: three new members — <code>@tools/lint-elements</code>, <code>@tools/warn-lanes</code> (#639) and <code>@tools/eslint-ts-parser</code> — take the <code>ci</code> graph from 501 nodes / 158 real to 535 / 165, edges 1,294 → 1,375, real→real 116 → 117, and the phantom share from 68.5% to 69.2%. <code>ci:main</code> now stands at 567 nodes / 170 real. The turbo <em>definitions</em> are unchanged at 91 across the same 17 files: every new node is fan-out, not authorship. Two other figures were corrected in passing — the repo holds 12 <code>cache:false</code> definitions, not 11 (7 at root, 5 in member files; still zero reachable from <code>ci</code>) — and four <code>turbo.json</code> line citations moved as <code>//#lint:elements</code> landed above them. A new root lint lane, <code>//#lint:elements</code>, joins the <code>lint</code> fan but is <em>not</em> a re-entrant port: it runs a node bin, not <code>mise run</code>.</p>
<p><strong>Rev C — the census is a script now, and the mise machine still has not moved.</strong> The 2026-08-17 generator this plate was measured with lived in <code>tmp/</code> and is gone; it is reconstructed as <code>diagrams/generator/census-handoff.mjs</code>, a T1 tree probe that counts workflow <code>mise run</code> call sites, mise task tables and turbo task definitions from a materialized archive of the ref — no mise, no turbo, nothing executed. Run against rev B's own ref (0e4ab36) it reproduces every printed figure exactly: ${W.files} workflows, ${W.calling} calling mise, the same per-file counts, ${W.callSites} call sites, ${W.targets} targets, ${M.tasks} tasks in ${M.homes} homes, ${M.withUsage} arg specs, 17 <code>turbo.json</code> files, 91 definitions (45 + 46) and 12 <code>cache:false</code>. Two <code>depends</code> figures that read as a contradiction turn out to be two different counts, and the plate now carries both: ${M.withDepends} tasks <em>declare</em> a <code>depends</code>, and between them they declare ${M.dependsEdges} dependency edges (setup 1 + lint_workflows 4) — the mise header counts tasks, seam row D2 counts edges. Re-measured at origin/main @ 35c6766, the finding this plate exists to make held a second time: <em>the mise machine still had not moved a task</em> — 48 tasks, 21 arg specs, 37 call sites, 28 targets, all identical, and <code>playwright_deps</code> still dead. turbo moved again, and again only because the workspace did: <code>packages/eslint-plugin-lit-ui-router</code> brought an 18th <code>turbo.json</code> with five definitions and the root file gained <code>check:dev-split</code>, so definitions went 91 → 97 (46 root + 51 member) and <code>ci:pull_request</code> listed eleven <code>dependsOn</code> lanes, not ten. <code>cache:false</code> held at 12, none of it reachable from <code>ci</code>. The graph figures came from <code>diagrams/data/census-plate.json</code> — 590 nodes / 176 real / 1,504 edges / 126 real→real, phantom share 70.2% — with <code>ci:main</code> at 623 / 181. One editorial claim did not survive the recount: the production docs deploy no longer bootstraps with <code>npx pnpm@11.21.0</code>. <code>tools/workers-builds/cloudflare-build.sh</code> now clears corepack's shims and installs <code>pnpm@12.2.1</code> globally through npm before <code>npx turbo docs#build</code> (:26-38) — a different way through the same door, and still the one production path that never sees mise.</p>
<p><strong>Rev D — the first full-cabinet refresh, and the mise machine has still not moved.</strong> Every plate in <code>diagrams/data/</code> was re-counted at ${HANDOFF.ref} @ ${HANDOFF.sha} in one pass, the first time the whole cabinet has been turned over at a single ref rather than sheet by sheet. This plate's own finding survives a third measurement without a single figure moving: 48 mise tasks in ${M.homes} homes, ${M.withUsage} arg specs, ${M.withDepends} declaring tasks and ${M.dependsEdges} edges, ${W.callSites} call sites across ${W.calling} of ${W.files} workflows, ${W.targets} targets, and <code>playwright_deps</code> still dead. turbo moved, and this time it moved <em>down</em>: <code>apps/sample-app-shared/turbo.json</code> is gone (#696 restored <code>turbo run e2e</code> and its two definitions went with it) and the root file swapped <code>//#check:docs-api-deps</code> for <code>//#check:graph-edges</code> and <code>//#check:task-inputs</code> (#693), so files go 18 → 17 and definitions 97 → 96 (47 root + 49 member) — the first recount in this sheet's history where the schedule shrank. <code>cache:false</code> holds at 12 (7 root + 5 member), still with none reachable from <code>ci</code>. The <code>ci</code> graph followed: 586 nodes / 177 real / 1,382 edges / 96 real→real against rev C's 590 / 176 / 1,504 / 126, phantom share 70.2% → 69.8%, <code>ci:main</code> 623 / 181 → 619 / 182. The sharp one is real→real, down a quarter, and it has a single cause: #693 replaced the three <code>^docs:api</code> fan-outs with four package-qualified <code>&lt;pkg&gt;#docs:api</code> edges, because <code>^</code> walks direct deps only and <code>docs</code> was carrying devDependencies it never imports just to let it reach. The <code>docs:api</code> column collapses from 9 nodes to 4, all of them real, and the fan's edges went with it — the same work, wired by name instead of by a fiction. Six line citations moved with the two <code>turbo.json</code> edits and were re-verified against the archive: <code>ci:pull_request</code> 316-330 → 351-365 (still eleven lanes), the <code>//#lint:workflows</code> virtual node 215-225 → 250-260, the three cache-gasket input blocks 228-232 · 245-251 · 256-262 → 263-267 · 280-286 · 291-297, and <code>package.json</code>'s <code>lint:toml</code> script :31 → :32. Everything else this plate cites — <code>config.toml</code>:71, :88, :116, :131-135, :185-212, :196, <code>tools/release/mise.toml</code>:97 and :104-107, <code>tools/build_and_test/mise.toml</code>:72-76, <code>deflake-e2e.yml</code>:73 and :87, <code>cloudflare-build.sh</code>:26-38 — reads at the same lines it did. Basis: ${BASIS}; graph ${GRAPH_BASIS}.</p>
<p><strong>The star fitting: turbo caches mise.</strong> Six root <code>//#</code> scripts in the ci graph have <code>mise run …</code> as their literal command, and their turbo <code>inputs</code> explicitly hash <code>.config/mise/tasks/*</code> and <code>.config/mise/mise.lock</code> (turbo.json:264-268, 281-287, 292-298); a seventh port, <code>@tools/release#check:release-closure</code>, re-enters from a member script and hashes <code>config.toml</code> the same way (tools/release/turbo.json:39-50). That is the whole trade drawn as one gasket on the return duct: mise owns the tool versions (taplo, rumdl, shellcheck, actionlint, zizmor — none installable by node), turbo owns the cache, and the gasket hashes one machine against the other, so a taplo pin bump invalidates exactly the taplo lane and nothing else.</p>
<p><strong>A DAG in a loop costume.</strong> The circuit workflow → mise → turbo → mise looks re-entrant, but the ${M.tasks} tasks partition cleanly: the seven that shell turbo (★ — <code>ci</code>, <code>ci_main</code>, <code>build</code>, <code>codecov_bundle</code>, <code>dts_backtest_matrix</code>, <code>check_pack</code>, <code>published_diff</code>) are reachable only from workflows and humans, while the eight turbo re-enters (↩ — the lint and format tasks, and <code>check_release_closure</code>) only exec pinned binaries, file tasks or a manifest reader. No edge leads from the second set back to the first. The deepest chain is six hops and runs on every PR, four tool lanes in parallel: workflow YAML → <code>mise run ci</code> → <code>turbo run ci</code> → <code>//#lint:toml</code> → <code>mise run lint_toml</code> → the <code>taplo</code> file task → the pinned binary.</p>
<p><strong>Three service doors, all deliberate.</strong> deflake-e2e.yml:73 runs bare <code>turbo run build --filter=…</code> — over the umbrella, though mise still supplies the PATH; deflake-e2e.yml:87 runs the flake attempts through pnpm <em>outside</em> turbo, because a cached test task would replay attempt 1’s logs; and the production docs deploy never sees mise at all — Cloudflare Workers Builds clears corepack’s shims and installs <code>pnpm@12.2.1</code> globally through npm before <code>npx turbo docs#build</code> (tools/workers-builds/cloudflare-build.sh:26-38), because the hosted image’s corepack shim cannot materialize pnpm 12. The doors are drawn red and hatched because each one gives up something the machines provide — and each was opened on purpose.</p>
<p><strong>Two curiosities the census surfaced.</strong> One task in the whole machine is dead: <code>//tools/build_and_test:playwright_deps</code> (mise.toml:72-76) has no caller anywhere, superseded by <code>playwright_deps_engines</code>. And one umbrella exists twice: mise <code>lint_workflows</code> (a 4-leg <code>depends</code>, config.toml:139-143) and turbo <code>//#lint:workflows</code> (a virtual <code>with</code> node, turbo.json:251-261) are the same shape maintained by hand in both schedulers — the one place the two machines duplicate rather than delegate. The phantom shroud around turbo’s core — ${PHANTOM} of ${CI.nodes} nodes that exist only to carry hashes — is drawn as wall thickness here; sheet 12 punches it hole by hole.</p>`,
  key: [
    keyRow(`<path d="M2,9 L40,9" class="sk2" marker-end="url(#${P}-ai)"/>`, 'trunk — the handoff, in flow direction'),
    keyRow('<rect x="14" y="2" width="4" height="14" class="sk fp2"/><rect x="26" y="2" width="4" height="14" class="sk fp2"/><circle cx="16" cy="1" r="2" class="skf fnone"/><circle cx="28" cy="17" r="2" class="skf fnone"/>', 'coupling gasket — a seam between the machines'),
    keyRow(`<rect x="14" y="2" width="4" height="14" class="sk fp2"/><rect x="18" y="4" width="8" height="10" fill="url(#${P}-ha)"/><rect x="26" y="2" width="4" height="14" class="sk fp2"/>`, 'the cache gasket — turbo hashes mise-owned files'),
    keyRow(`<path d="M2,9 L34,9" class="ska" stroke-dasharray="3 3"/><text x="38" y="13" class="lbla" font-size="11">①</text>`, 'the deepest chain — 6 hops, circled digits'),
    keyRow(`<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#${P}-hr)"/><rect x="6" y="3" width="36" height="12" class="skr fnone"/>`, 'service door — a deliberate bypass'),
    keyRow('<text x="4" y="13" class="lbl" font-size="11">★ / ↩</text>', 'shells turbo / re-entered by turbo — disjoint sets'),
    keyRow(`<rect x="6" y="3" width="36" height="12" fill="url(#${P}-hd)" opacity="0.45"/><rect x="6" y="3" width="36" height="12" class="sks fnone" stroke-dasharray="4 3"/>`, `phantom shroud — ${PHANTOM} nodes that run nothing (sheet 12)`),
    keyRow('<text x="4" y="13" class="lblr" font-size="11">✕</text>', 'dead task — no caller anywhere'),
  ].join('\n'),
};

import { defs } from './chrome.mjs';
import { txt, box, arrow, keyRow } from './helpers.mjs';

const P = 's3a';

// ---- census: tmp/handoff-census/census.json, measured 2026-08-17 at 3557c29 ----
// Every printed number traces to that file or to a cited file:line.  This plate
// promotes the sheet-3 "two task managers" inset to a full sheet; the inset stays.

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

// A coupling gasket: two bolted plates across a trunk.
function gasket(x, y, h, { hatch = null } = {}) {
  const plates = `${box(x, y, 5, h, 'sk fp2')}${box(x + 15, y, 5, h, 'sk fp2')}`;
  const band = hatch ? `<rect x="${x + 5}" y="${y + 4}" width="10" height="${h - 8}" fill="url(#${P}-${hatch})"/>` : '';
  const bolts = [[x + 2.5, y - 5], [x + 17.5, y - 5], [x + 2.5, y + h + 5], [x + 17.5, y + h + 5]]
    .map(([bx, by]) => `<circle cx="${bx}" cy="${by}" r="2.4" class="skf fnone"/>`).join('');
  return plates + band + bolts;
}

// ---- GITHUB ACTIONS panel -------------------------------------------------------
// per-file call-site counts: census.json sheet3_corrections.workflow_mise_call_sites
const WF = [
  ['build-test-run', 11, true], ['publish-npm', 7, false], ['release-signals', 5, false],
  ['bump-version', 4, false], ['publish-gh', 4, false], ['deflake-e2e', 4, false],
  ['build-test-branch', 1, false], ['lint-workflows', 1, false],
];
const wfRowY = (i) => 162 + i * 34;
const ghPanel = `${box(40, 110, 190, 425, 'sk2 fp')}
${txt(52, 130, 'GITHUB ACTIONS', 'lblb')}
${txt(52, 143, '11 workflows · 8 call mise', 'lblf')}
${WF.map(([name, n, chain], i) => {
  const y = wfRowY(i);
  return `${box(52, y, 166, 26, chain ? 'ska fp' : 'sk fp')}
${txt(60, y + 17, name, 'lbls')}
${txt(210, y + 17, `·${n}`, 'lblf', 'end')}`;
}).join('\n')}
<line x1="52" y1="442" x2="218" y2="442" class="skf"/>
${lf(52, 456, [
  'no mise: build-test,',
  'commitlint · semantic-pr',
])}
${lf(52, 492, [
  ['branch_ci_gate needs', 'lbls'],
  ['NO setup — node builtins', 'lbls'],
  '(build-test-branch.yml:35-36)',
])}`;

// ---- SEAM A — workflow → mise ---------------------------------------------------
const seamA = `${arrow(P, 'M230,285 L354,285', 'ai', 'sk2')}
<path d="M230,291 L354,291" class="ska" stroke-dasharray="3 3" fill="none"/>
${txt(244, 278, '①', 'lbla')}
${gasket(286, 240, 90)}
${clines(296, 362, [
  ['SEAM A', 'lbla'], ['WORKFLOW → MISE', 'lbls'],
  ['37 call sites', 'lblf'], ['28 distinct targets', 'lblf'],
  ['args cross as env —', 'lblf'], ['step env: satisfies', 'lblf'],
  ['$usage_* flags; no', 'lblf'], ['${{ }} in run lines', 'lblf'],
  ['buys: pinned tools +', 'lblf'], ['node-free bootstrap', 'lblf'],
])}`;

// ---- MISE machine ---------------------------------------------------------------
const comp = (x, y, w, h, head, rows, lh = 11.5) =>
  `${box(x, y, w, h, 'sk fp')}
${txt(x + 8, y + 14, head, 'lbls')}
${rows.map(([s, cls], i) => txt(x + 8, y + 27 + i * lh, s, cls)).join('\n')}`;

const mise = `${box(362, 110, 368, 435, 'sk2 fp')}
${txt(374, 130, 'MISE — THE NODE-FREE UMBRELLA', 'lblb')}
${txt(374, 143, '48 tasks · 4 homes · 2 use depends · 21 with $usage_* specs', 'lblf')}
${box(374, 155, 344, 56, 'sk fp2')}
${txt(382, 169, 'TOOL BELT — aqua pins, mise.lock checksums', 'lbls')}
${txt(382, 183, '⑥ taplo 0.10.0 · rumdl · shellcheck', 'lblf')}
${txt(382, 195, 'actionlint · zizmor — node never installs these', 'lblf')}
${comp(374, 222, 166, 150, 'tools/build_and_test — 9', [
  ['xvfb · branch_ci_gate', 'lblf'], ['error_summary · cypress', 'lblf'],
  ['playwright_version', 'lblf'], ['cypress_version', 'lblf'],
  ['playwright', 'lblf'], ['playwright_deps_engines', 'lblf'],
  ['✕ playwright_deps — DEAD', 'lblr'], ['no caller; superseded', 'lblr'],
  ['(mise.toml:69-73)', 'lblr'],
])}
${comp(552, 222, 166, 150, '.config/mise/tasks/* — 9', [
  ['⑤ taplo · rumdl', 'lblf'], ['shellcheck · read_secret', 'lblf'],
  ['turbo_login', 'lblf'], ['turbo_link_worktree', 'lblf'],
  ['cloudflare_item_create', 'lblf'], ['§ check_workers_builds', 'lblf'],
  ['measure_deflake', 'lblf'], ['§ = the one mise→pnpm→', 'lblf'],
  ['turbo loop-closer (manual)', 'lblf'],
])}
${comp(374, 378, 166, 158, 'tools/release — 15', [
  ['git_user · package_info', 'lblf'], ['pack · check_tarball', 'lblf'],
  ['reconcile · tag · tag_push', 'lblf'], ['publish · bump', 'lblf'],
  ['peer_floor_gate', 'lblf'], ['3× *_check_runs', 'lblf'],
  ['★ check_pack', 'lbla'], ['★ published_diff', 'lbla'],
  ['   (runs turbo ×2)', 'lblf'],
])}
${comp(552, 378, 166, 158, 'config.toml inline — 15', [
  ['② ★ ci · ★ ci_main', 'lbla'], ['★ build', 'lbla'],
  ['★ codecov_bundle', 'lbla'], ['★ dts_backtest_matrix', 'lbla'],
  ['↩ lint_actionlint', 'lblf'], ['↩ lint_zizmor', 'lblf'],
  ['④ ↩ lint_toml', 'lblf'], ['↩ lint_shellcheck', 'lblf'],
  ['↩ lint_markdown', 'lblf'], ['↩ format_check_toml', 'lblf'],
  ['↩ format_toml (writer)', 'lblf'], ['⌂ lint_workflows (dep×4)', 'lblf'],
  ['setup · cloudflare_login', 'lblf'],
], 10.5)}
${txt(362, 560, '★ shells turbo (7) · ↩ turbo re-enters (7)', 'lblf')}`;

// ---- SEAM B — mise → turbo ------------------------------------------------------
const seamB = `${arrow(P, 'M730,240 L856,240', 'ai', 'sk2')}
<path d="M730,246 L856,246" class="ska" stroke-dasharray="3 3" fill="none"/>
${gasket(785, 218, 46)}
${clines(795, 122, [
  ['SEAM B', 'lbla'], ['MISE → TURBO', 'lbls'],
  ['7 tasks', 'lblf'], ['8 invocations', 'lblf'],
  ['TURBO_* crosses', 'lblf'], ['as ambient env —', 'lblf'],
  ['no flags at all', 'lblf'], ['buys: remote', 'lblf'],
  ['cache + summary', 'lblf'],
], 11)}`;

// ---- TURBO machine: phantom shroud wall + real core -----------------------------
const wall = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${P}-hd)" opacity="0.45"/>`;
const PORTS = [
  ['//#lint:actionlint'], ['//#lint:zizmor'], ['③ //#lint:toml'],
  ['//#lint:shellcheck'], ['//#lint:markdown'], ['//#format:check:toml'],
];
const turbo = `<rect x="860" y="110" width="500" height="435" class="sks fnone" stroke-dasharray="7 5"/>
${wall(861, 111, 498, 19)}${wall(861, 526, 498, 18)}${wall(861, 130, 19, 396)}${wall(1340, 130, 19, 396)}
${box(880, 130, 460, 395, 'sk2 fp')}
${txt(896, 152, 'TURBO — THE CACHED FAN-OUT', 'lblb')}
${lf(896, 168, [
  'ci graph: 501 nodes · 158 real · 1,294 edges · 116 real→real',
  '17 turbo.json files · 91 task definitions (45 root + 46 member)',
  'ci:main overlay: 531 nodes · 163 real (+5 real tasks)',
  '11 cache:false tasks repo-wide — ZERO reachable from ci',
  'counted from bare `turbo run ci --dry=json` · 2026-08-17',
], 13)}
${box(896, 240, 190, 26, 'sk fp2')}${txt(991, 257, 'ci → ci:pull_request', 'lbls', 'middle')}
${box(1098, 240, 226, 26, 'sk fp2')}${txt(1211, 257, 'ci:main = ci:pr + 5 real tasks', 'lbls', 'middle')}
${txt(896, 281, 'turbo.json:308-340 — 10 dependsOn lanes under ci:pull_request', 'lblf')}
${txt(896, 303, 'PHANTOM SHROUD — 343 of 501 nodes run nothing (68.5%)', 'lbls')}
${txt(896, 316, 'transit / ^build hash carriers — punched hole-by-hole on SHEET 12', 'lblf')}
<line x1="890" y1="308" x2="874" y2="308" class="skf"/>
${box(896, 332, 230, 26, 'ska fp')}${txt(1011, 349, '//#lint:workflows — virtual with ×4', 'lbls', 'middle')}
${txt(1136, 349, '← the turbo twin', 'lblf')}
${txt(896, 380, 'RE-ENTRANT PORTS — six root //# scripts whose command is `mise run …`', 'lblf')}
${PORTS.map(([name], i) => {
  const x = 896 + (i % 3) * 152, y = 390 + Math.floor(i / 3) * 32;
  return `${box(x, y, 142, 24, 'sk fp2')}${txt(x + 71, y + 16, name, 'lbls', 'middle')}`;
}).join('\n')}
${lf(1132, 484, ['the six results cache in turbo,', 'keyed on files mise owns ↓'])}`;

// ---- SEAM C — the return duct + the cache gasket (the star finding) -------------
const duct = `${arrow(P, 'M1120,454 L1120,588 L635,588 L635,551', 'ai', 'sk2')}
<path d="M1114,460 L1114,582 L641,582 L641,551" class="ska" stroke-dasharray="3 3" fill="none"/>
${gasket(770, 568, 40, { hatch: 'ha' })}`;

// ---- twins link -----------------------------------------------------------------
const twins = `${arrow(P, 'M896,345 L744,345 L744,430 L736,430', 'aa', 'ska', '5 4')}
${clines(795, 452, [
  ['HAND-SYNCED TWINS', 'lbls'], ['⌂ lint_workflows', 'lblf'],
  ['config.toml:130-134', 'lblf'], ['∥ //#lint:workflows', 'lblf'],
  ['turbo.json:207-217', 'lblf'], ['same 4 legs, kept', 'lblf'],
  ['in sync by hand', 'lblf'],
])}`;

// ---- door 1 route (bare turbo over the umbrella) --------------------------------
const door1 = `${box(226, 338, 8, 14, 'skr fp')}<rect x="226" y="338" width="8" height="14" fill="url(#${P}-hr)"/>
${arrow(P, 'M234,345 L262,345 L262,102 L1120,102 L1120,108', 'ar', 'skr', '6 4')}
${txt(700, 94, 'DOOR 1 — deflake-e2e.yml:73 · bare `turbo run build --filter=…` — over the umbrella, straight into turbo (PATH still mise)', 'lblr', 'middle')}`;

// ---- bottom captions ------------------------------------------------------------
const chainCap = `${txt(40, 620, 'THE DEEPEST CHAIN — 6 HOPS · runs on every PR, ×4 tool lanes', 'lbla')}
${lf(40, 638, [
  '① build-test-run.yml:114 — `mise run ci` (env: TURBO_FORCE · TURBO_TOKEN/API/TEAM)',
  '② mise ci — `turbo run ci --summarize` (.config/mise/config.toml:195)',
  '③ turbo //#lint:toml — executes the root script `mise run lint_toml` (package.json:30)',
  '④ mise lint_toml — `mise run taplo lint` (.config/mise/config.toml:115)',
  '⑤ file task .config/mise/tasks/taplo — exec taplo over `git ls-files -- *.toml`',
  '⑥ taplo 0.10.0 — pinned (.config/mise/config.toml:70) · terminal: a binary, not a task',
])}
${txt(40, 716, 'why it never recurses: the ★ set and the ↩ set are disjoint — mise→turbo→mise is a DAG in a loop costume', 'lbls')}`;

const cacheCap = `${txt(560, 628, 'DETAIL — THE CACHE GASKET: TURBO CACHES MISE', 'lbla')}
${lf(560, 646, [
  '//#lint:* inputs hash .config/mise/tasks/* AND mise.lock',
  '(turbo.json:220-224 · 240-243 · 250-254)',
  'a taplo pin bump busts exactly the taplo lane — nothing else',
  'turbo holds the cache; mise holds the versions; the gasket',
  'hashes one machine against the other',
])}
<line x1="700" y1="618" x2="768" y2="600" class="skf"/>`;

const doorsBox = `${box(1080, 604, 280, 152, 'skr fp')}
<rect x="1252" y="604" width="108" height="20" fill="url(#${P}-hr)"/>
<rect x="1080" y="604" width="280" height="20" class="skr fnone"/>
${txt(1090, 618, 'SERVICE DOORS — 3 BYPASSES', 'lblr')}
${lf(1090, 638, [
  ['1 deflake-e2e.yml:73 — bare turbo', 'lblr'],
  ['  build --filter (skips mise tasks)', 'lblf'],
  ['2 deflake-e2e.yml:87 — deflake runs', 'lblr'],
  ['  OUTSIDE turbo: a cached test task', 'lblf'],
  ['  would replay attempt 1 logs (:6-8)', 'lblf'],
  ['3 cloudflare-build.sh:16-19 — the', 'lblr'],
  ['  PRODUCTION docs deploy: npx pnpm +', 'lblf'],
  ['  npx turbo docs#build, NO mise — the', 'lblf'],
  ['  CF image’s corepack shim cannot', 'lblf'],
  ['  materialize pnpm 12', 'lblf'],
])}`;

// ---- seam schedule --------------------------------------------------------------
const SCHED = [
  'A   workflow → mise — 37 call sites · 28 targets · crossing: env, never argv (no ${{ }} in run lines) · buys: pinned tools + node-free bootstrap · 8 workflow files',
  'B   mise → turbo — 7 tasks · 8 invocations · crossing: TURBO_* ambient env · buys: remote cache + --summarize · config.toml:184-211 · tools/release/mise.toml:97,104-107',
  'C   turbo → mise — 7 root scripts (6 in ci) · crossing: script body `mise run …` · buys: TURBO CACHES MISE — inputs hash the task files + mise.lock · turbo.json:220-254',
  'D   mise → pnpm → turbo — 1 (check_workers_builds, manual) · turbo leg is cache:false, so the crossing buys only env passthrough + addressing · tasks file :21',
  'D2  mise → mise — 8 edges · 5 depends (setup · lint_workflows ×4) + run-line delegations · cutest: turbo_login → $(mise run read_secret) · config.toml:87,134',
  'E   bypasses — 3, all deliberate · deflake-e2e.yml:73 (bare turbo) · :87 (pnpm outside turbo) · cloudflare-build.sh:16-19 (npx, no mise — production)',
];
const SY = 776;
const schedule = `${box(40, SY, 1320, 170, 'sk fp')}
${txt(58, SY + 22, 'SEAM SCHEDULE — every crossing between the two machines · what crosses · what the boundary buys · cite', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1360" y2="${SY + 32}" class="skf"/>
${SCHED.map((s, i) => txt(58, SY + 52 + i * 17, s, 'lbls')).join('\n')}
${txt(58, SY + 58 + SCHED.length * 17, 'TOTALS — 48 mise tasks · 21 with $usage_* specs · 91 turbo definitions · ci 501 nodes / 158 real · 1 dead task (playwright_deps) · counted 2026-08-17', 'lblf')}`;

// ---- assemble -------------------------------------------------------------------
const svg = `<svg viewBox="0 0 1400 ${SY + 190}" role="img" aria-label="Flat coupling schematic of the two task managers in the lit-ui-router monorepo, promoted from the small inset on sheet 3. On the left a GitHub Actions panel lists eleven workflows, eight of which call mise for a total of thirty-seven call sites. A trunk crosses a bolted gasket labeled seam A into the mise machine, drawn as a node-free umbrella housing forty-eight tasks in four compartments: a tool belt of aqua-pinned binaries, nine build-and-test tasks including one dead task drawn in red, nine file tasks, fifteen release tasks, and fifteen inline tasks. Seven tasks marked with stars shell out to turbo; seven marked with return arrows are re-entered from turbo, and the two sets never overlap. A second gasket, seam B, crosses into the turbo machine, drawn as a real core of 158 tasks inside a hatched phantom shroud representing the 343 nodes that run nothing, cross-referenced to sheet twelve. Six re-entrant ports at the bottom of the core return through a duct fitted with the featured cache gasket: turbo caches mise, because the lint tasks hash the mise task files and lockfile. The deepest chain, six hops from workflow YAML to the pinned taplo binary, is traced with circled digits and an accent thread. A red dashed service-door route arcs over the umbrella for the one bare-turbo bypass, and a red box catalogues all three deliberate bypasses including the mise-free production docs deploy. A seam schedule at the bottom lists every crossing with counts and citations.">
${defs(P)}

<rect x="40" y="24" width="480" height="58" class="skf fnone"/>
${txt(52, 42, 'PLATE 3A — THE SHEET-3 INSET, PROMOTED TO A FULL SHEET', 'lbls')}
${txt(52, 56, 'same spine as the sheet-3 top-left inset: Actions → mise → turbo → back again', 'lblf')}
${txt(52, 70, 'the inset stays on sheet 3; this plate is the full treatment it points to', 'lblf')}

${txt(1360, 34, 'READ LEFT TO RIGHT — every PR enters at a workflow, crosses two gaskets, and returns through the cache gasket', 'lbls', 'end')}
${txt(1360, 48, 'EMPHASIS — circled digits ①–⑥ + accent thread = the deepest chain · red + hatch = the service doors', 'lblf', 'end')}
${txt(1360, 62, 'sheet-3 inset figures corrected by this census: 36→37 call sites · 51→48 tasks · 483→501 nodes', 'lblf', 'end')}

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
  num: '3A', id: 'handoff', rev: 'A',
  title: 'THE HANDOFF WORKS',
  sub: 'ALTITUDE 3 · ALTERNATE PLATE — the sheet-3 task-manager inset at full size: 8 of 11 workflows · 48 mise tasks in 4 homes · turbo ci 501 nodes, 158 real · 4 seam types · 3 service doors · counted 2026-08-17',
  scale: 'TWO TASK MANAGERS',
  form: 'COUPLING SCHEMATIC',
  svg,
  caption: 'The two task managers drawn as the two machines they are — mise the node-free umbrella, turbo the cached fan-out — with the seams as the featured parts: every crossing is a bolted gasket labeled with what crosses it and what the boundary buys. The star fitting is the cache gasket on the return duct: turbo caches mise, because the six re-entrant lint lanes hash the mise task files and mise.lock, so a tool-pin bump invalidates exactly its own lane.',
  notes: `
<p><strong>Method — one census, cited throughout.</strong> Every count on this plate comes from a fresh 2026-08-17 census of the repo at HEAD: the 11 workflow files, all 17 <code>turbo.json</code> files, <code>.config/mise/**</code> and both member <code>mise.toml</code> files read directly, cross-checked against <code>mise tasks ls --all</code> and bare <code>turbo run ci --dry=json</code>. Three figures on the sheet-3 inset had drifted and are corrected here: 36→37 workflow call sites, 51→48 repo-defined mise tasks (the 51 had mixed in four user-global <code>rtk:*</code> tasks), and 483→501 ci graph nodes after the lit dedupe — the phantom share held at 68.5%.</p>
<p><strong>The star fitting: turbo caches mise.</strong> Six root <code>//#</code> scripts in the ci graph have <code>mise run …</code> as their literal command, and their turbo <code>inputs</code> explicitly hash <code>.config/mise/tasks/*</code> and <code>.config/mise/mise.lock</code> (turbo.json:220-224, 240-243, 250-254). That is the whole trade drawn as one gasket on the return duct: mise owns the tool versions (taplo, rumdl, shellcheck, actionlint, zizmor — none installable by node), turbo owns the cache, and the gasket hashes one machine against the other, so a taplo pin bump invalidates exactly the taplo lane and nothing else.</p>
<p><strong>A DAG in a loop costume.</strong> The circuit workflow → mise → turbo → mise looks re-entrant, but the 48 tasks partition cleanly: the seven that shell turbo (★ — <code>ci</code>, <code>ci_main</code>, <code>build</code>, <code>codecov_bundle</code>, <code>dts_backtest_matrix</code>, <code>check_pack</code>, <code>published_diff</code>) are reachable only from workflows and humans, while the seven turbo re-enters (↩ — the lint and format tasks) only exec pinned binaries or file tasks. No edge leads from the second set back to the first. The deepest chain is six hops and runs on every PR, four tool lanes in parallel: workflow YAML → <code>mise run ci</code> → <code>turbo run ci</code> → <code>//#lint:toml</code> → <code>mise run lint_toml</code> → the <code>taplo</code> file task → the pinned binary.</p>
<p><strong>Three service doors, all deliberate.</strong> deflake-e2e.yml:73 runs bare <code>turbo run build --filter=…</code> — over the umbrella, though mise still supplies the PATH; deflake-e2e.yml:87 runs the flake attempts through pnpm <em>outside</em> turbo, because a cached test task would replay attempt 1’s logs; and the production docs deploy never sees mise at all — Cloudflare Workers Builds bootstraps with <code>npx pnpm@11.21.0</code> then <code>npx turbo docs#build</code> (tools/workers-builds/cloudflare-build.sh:16-19), because the hosted image’s corepack shim cannot materialize pnpm 12. The doors are drawn red and hatched because each one gives up something the machines provide — and each was opened on purpose.</p>
<p><strong>Two curiosities the census surfaced.</strong> One task in the whole machine is dead: <code>//tools/build_and_test:playwright_deps</code> (mise.toml:69-73) has no caller anywhere, superseded by <code>playwright_deps_engines</code>. And one umbrella exists twice: mise <code>lint_workflows</code> (a 4-leg <code>depends</code>, config.toml:130-134) and turbo <code>//#lint:workflows</code> (a virtual <code>with</code> node, turbo.json:207-217) are the same shape maintained by hand in both schedulers — the one place the two machines duplicate rather than delegate. The phantom shroud around turbo’s core — 343 of 501 nodes that exist only to carry hashes — is drawn as wall thickness here; sheet 12 punches it hole by hole.</p>`,
  key: [
    keyRow(`<path d="M2,9 L40,9" class="sk2" marker-end="url(#${P}-ai)"/>`, 'trunk — the handoff, in flow direction'),
    keyRow('<rect x="14" y="2" width="4" height="14" class="sk fp2"/><rect x="26" y="2" width="4" height="14" class="sk fp2"/><circle cx="16" cy="1" r="2" class="skf fnone"/><circle cx="28" cy="17" r="2" class="skf fnone"/>', 'coupling gasket — a seam between the machines'),
    keyRow(`<rect x="14" y="2" width="4" height="14" class="sk fp2"/><rect x="18" y="4" width="8" height="10" fill="url(#${P}-ha)"/><rect x="26" y="2" width="4" height="14" class="sk fp2"/>`, 'the cache gasket — turbo hashes mise-owned files'),
    keyRow(`<path d="M2,9 L34,9" class="ska" stroke-dasharray="3 3"/><text x="38" y="13" class="lbla" font-size="11">①</text>`, 'the deepest chain — 6 hops, circled digits'),
    keyRow(`<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#${P}-hr)"/><rect x="6" y="3" width="36" height="12" class="skr fnone"/>`, 'service door — a deliberate bypass'),
    keyRow('<text x="4" y="13" class="lbl" font-size="11">★ / ↩</text>', 'shells turbo / re-entered by turbo — disjoint sets'),
    keyRow(`<rect x="6" y="3" width="36" height="12" fill="url(#${P}-hd)" opacity="0.45"/><rect x="6" y="3" width="36" height="12" class="sks fnone" stroke-dasharray="4 3"/>`, 'phantom shroud — 343 nodes that run nothing (sheet 12)'),
    keyRow('<text x="4" y="13" class="lblr" font-size="11">✕</text>', 'dead task — no caller anywhere'),
  ].join('\n'),
};

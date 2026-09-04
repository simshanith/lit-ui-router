import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, arrow, isoBlock, isoPt, keyRow } from './helpers.mjs';

const P = 's3';
const OX = 360, OY = 200;

// ---- census: every number below comes from diagrams/data/census-yard.json -------
// Same basis as sheet 4: .ts/.tsx/.js/.mjs under each member's source dir,
// excluding *.d.ts, *.test-d.ts, *.{spec,test}.*, specs/ __tests__/ fixtures/.
// sloc = scc `Code` lines (string-aware: template-literal interiors count as
// code).  @tools/release hosts several instruments, so it is attributed by module
// prefix (see diagrams/generator/census-yard.mjs).
const PLATE = JSON.parse(readFileSync(new URL('../data/census-yard.json', import.meta.url), 'utf8'));
// every massed structure cites a plate row by instrument name — [files, sloc]
const C = (instrument) => {
  const r = PLATE.rows.find((x) => x.instrument === instrument);
  if (!r) throw new Error(`census-yard.json: no row for instrument ${instrument}`);
  return [r.files, r.sloc];
};
const COUNTED = `counted at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;

// the inset's task-manager figures are the SAME plates sheet 3A draws from —
// hand-pasted here until rev D, where they disagreed with 3A in the same build
const HANDOFF = JSON.parse(readFileSync(new URL('../data/census-handoff.json', import.meta.url), 'utf8'));
const CIPLATE = JSON.parse(readFileSync(new URL('../data/census-plate.json', import.meta.url), 'utf8'));
const HW = HANDOFF.workflows, HM = HANDOFF.mise;
const CI_NODES = CIPLATE.pipelines.ci.nodes;

// ---- scale rule ---------------------------------------------------------------
const KS = 1.6;   // iso footprint SIDE = 1.6 · √sloc  (plan units — plan area ∝ sloc)
const KH = 1.5;   // block HEIGHT       = 1.5 px per authored file
const S = (sloc) => KS * Math.sqrt(sloc);
const H = (files) => Math.max(4, KH * files);
const fmt = (v) => v.toLocaleString('en-US');

// ---- gate severity lives in COLOUR, never in height -----------------------------
const TIER = {
  halt:   { edge: 'skr', cap: 'fr',  hatch: null, side: `url(#${P}-hr)`, badge: 'skr fp', num: 'lblr' },
  pr:     { edge: 'skr', cap: 'fp',  hatch: 'hr', side: `url(#${P}-hr)`, badge: 'skr fp', num: 'lblr' },
  late:   { edge: 'ska', cap: 'fp',  hatch: 'ha', side: `url(#${P}-ha)`, badge: 'ska fp', num: 'lbla' },
  report: { edge: 'skf', cap: 'fp2', hatch: null, side: `url(#${P}-hx)`, badge: 'skf fp', num: 'lbls' },
  line:   { edge: 'sk',  cap: 'fp',  hatch: null, side: `url(#${P}-hx)`, badge: 'sk fp',  num: 'lbl' },
  art:    { edge: 'skg', cap: 'fg',  hatch: null, side: `url(#${P}-hx)`, badge: 'skg fp', num: 'lbl' },
  off:    { edge: 'sks', cap: 'fp2', hatch: null, side: `url(#${P}-hd)`, badge: 'sks fp', num: 'lbls' },
};
const TIER_TEXT = {
  halt: 'HALTS A PUBLISH', pr: 'STOPS THE PR LINE', late: 'gates a later stage',
  report: 'never gates', line: 'the line itself', art: 'the artifact', off: 'not massed',
};

// [n, name, tier, x, y, files, sloc, fixed side, fixed height, schedule note]
const M = [
  // --- the conveyor (packages/), one straight lane at y = 71 --------------------
  [1,  'src — packages/*/src',      'line',    20,    30.45, ...C('src (5 published packages)'), null, null, 'five published packages — the material'],
  [2,  'build — @tools/oxc-emit',   'line',   201.1,  63,    ...C('build — @tools/oxc-emit'), null, null, 'JS pass + d.ts pass, one emitter'],
  [3,  'pack — packPublishTarball', 'line',   296.1,  55.9,  ...C('pack — packPublishTarball'), null, null, 'the one packer (#449), cached'],
  [4,  'THE TARBALL',               'art',    426.8,  53,     0,    0,   36,   26, 'the one artifact every check reads'],
  [5,  'publish — release-it',      'line',   578.3,  49.6,  ...C('publish — release-it'), null, null, 'bump · tag · push · publish steps'],
  [6,  'npm registry',              'off',    742.6,  36,     0,    0,   70,   32, 'immutable once crossed'],
  // --- instrument yard, row A: the checks that stop a pull request --------------
  [7,  'tests — vitest harness',    'pr',      20,   215,    ...C('tests — vitest harness'), null, null, 'lit-test-env + happy-dom · 4 real browsers'],
  [8,  'compat-guards',             'pr',      62,   215,    ...C('compat-guards'), null, null, 'the lit 2 / mobx 6 / analyzer lanes'],
  [9,  'dts-backtest',              'pr',     120,   215,    ...C('dts-backtest'), null, null, `one ${C('dts-backtest')[1]}-line run.ts holds the TS 5.0 floor`],
  [10, 'check:exports',             'pr',     200,   215,    ...C('check:exports'), null, null, 'publint + attw over the raw pack'],
  [11, 'published-diff',            'halt',   313.9, 215,    ...C('published-diff'), null, null, 'vs the LIVE npm tarball · halts publishing'],
  // --- instrument yard, row B: the gates that fire later, and the reporters -----
  [12, 'peer-floor tier-2',         'late',    40,   320,    ...C('peer-floor tier-2'), null, null, 'gates version bumps, never a PR'],
  [13, 'peer-floor tier-1',         'report',  90,   320,    ...C('peer-floor tier-1'), null, null, 'reports check runs, never gates'],
  [14, 'lint & probe fleet',        'report', 175,   320,    ...C('lint & probe fleet'), null, null, 'oxlint · elements · warn-lanes · CI gate'],
  [15, '@tools/shared',             'report', 275,   320,    ...C('@tools/shared'), null, null, 'the library under every instrument'],
  [16, 'typedoc plugin',            'report', 380,   320,    ...C('typedoc plugin'), null, null, 'builds the API pages, gates nothing'],
  // --- proving ground & shopfront (apps/ + docs/) -------------------------------
  [17, 'e2e — cypress',             'pr',     377.8, 420,    ...C('e2e — cypress'), null, null, 'drives the sample apps · stops the PR line'],
  [18, 'sample apps',               'line',   560,   390,    ...C('sample apps'), null, null, 'shared routes + vanilla + mobx + e2e fixtures'],
  [19, 'docs deploy watch',         'late',   680,   400,    ...C('docs deploy watch'), null, null, 'workers-builds triggers · gates the deploy'],
];
const F = (n) => M.find((r) => r[0] === n);      // [.., files, sloc, ..] by structure number
const nf = (n) => F(n)[5];                       // authored files of structure n
const nl = (n) => F(n)[6];                       // sloc of structure n
const nfl = (n) => `${nf(n)} files, ${fmt(nl(n))} lines`;
const PR_GATES = [7, 8, 9, 10, 17];

const geom = new Map(
  M.map(([n, , tier, x, y, files, sloc, fw, fh]) => {
    const side = fw ?? S(sloc);
    const h = fh ?? H(files);
    return [n, { n, tier, x, y, side, h, cx: x + side / 2, cy: y + side / 2 }];
  }),
);
const g = (n) => geom.get(n);

const BADGE_LEFT = new Set([9, 10, 11]);
const pt = (x, y, z = 0) => isoPt(OX, OY, x, y, z);
const p2 = (x, y, z = 0) => pt(x, y, z).map((v) => v.toFixed(1)).join(',');

// A block massed by its own census: footprint side ∝ √sloc, height ∝ authored
// files.  The gate tier paints the cap and the flank; it never touches the height.
function massBlock(n) {
  const { tier, x, y, side, h } = g(n);
  const t = TIER[tier];
  const body = isoBlock(P, OX, OY, x, y, side, side, h, { capCls: t.cap, edge: t.edge, sideFill: t.side });
  const top = [p2(x, y, h), p2(x + side, y, h), p2(x + side, y + side, h), p2(x, y + side, h)].join(' ');
  const wash = t.hatch ? `<polygon points="${top}" fill="url(#${P}-${t.hatch})"/>
<polygon points="${top}" class="${t.edge} fnone"/>` : '';
  // Readers take a stub down their centre line, so their badge moves off it.
  const [bx, by] = BADGE_LEFT.has(n) ? pt(x, y, h) : pt(x + side / 2, y, h);
  return `${body}${wash}
<circle cx="${bx.toFixed(1)}" cy="${(by - 17).toFixed(1)}" r="9.5" class="${t.badge}"/>
${txt(bx.toFixed(1), (by - 13.4).toFixed(1), String(n), t.num, 'middle')}`;
}

// A leg routed on the iso grid and trimmed in SCREEN space at both ends.  A block's
// roof floats exactly h px above the ground point a leg aims at, so clearing the
// silhouette costs h + 1.15·gap — computed from the census, never guessed.
const clearance = (n, gap) => (n == null ? gap : g(n).h + 1.15 * gap);
function leg(wps, { from = null, to = null, t0 = null, t1 = null, mk = 'ai', cls = 'sk2', dash = '' } = {}) {
  const pts = wps.map(([x, y, z = 0]) => pt(x, y, z));
  const trim = (a, b, d) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    return [a[0] + (dx / L) * d, a[1] + (dy / L) * d];
  };
  const d0 = t0 ?? clearance(from, 9);
  const d1 = t1 ?? clearance(to, 11.5);
  if (d0) pts[0] = trim(pts[0], pts[1], d0);
  if (d1) pts[pts.length - 1] = trim(pts[pts.length - 1], pts[pts.length - 2], d1);
  const d = 'M' + pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' L');
  return mk ? arrow(P, d, mk, cls, dash) : `<path d="${d}" class="${cls}" ${dash ? `stroke-dasharray="${dash}"` : ''} fill="none"/>`;
}

// ---- the conveyor: one straight run along the y = 71 lane -----------------------
const LANE = 71;
const runLeg = (a, b) => leg([[g(a).x + g(a).side, LANE], [g(b).x, LANE]], { from: a, to: b });
const conveyor = [runLeg(1, 2), runLeg(2, 3), runLeg(3, 4), runLeg(4, 5), runLeg(5, 6)].join('\n');

// ---- the tarball bus: one cached pack, three readers ----------------------------
const BUS = 145;
const READERS = [11, 10, 9];
const busTrunk = leg(
  [[g(4).cx, g(4).y + g(4).side], [g(4).cx, BUS], [g(READERS.at(-1)).cx, BUS]],
  { from: 4, mk: null, cls: 'sks', dash: '5 4', t1: 0 },
);
const busStubs = READERS
  .map((n) => leg([[g(n).cx, BUS], [g(n).cx, g(n).y]], { to: n, t0: 0, mk: 'as', cls: 'sks', dash: '5 4' }))
  .join('\n');

// ---- the return: published-diff reads the LIVE tarball back out of the registry --
const RET = 545;
const ret = leg(
  [[g(6).cx, g(6).y + g(6).side], [g(6).cx, RET], [g(11).cx, RET], [g(11).cx, g(11).y + g(11).side]],
  { from: 6, mk: 'aa', cls: 'ska', dash: '7 4', t1: 11 },
);

// ---- e2e drives the sample apps ---------------------------------------------------
const DRIVE = 515;
const drive = leg(
  [[g(17).cx, g(17).y + g(17).side], [g(17).cx, DRIVE], [g(18).cx, DRIVE], [g(18).cx, g(18).y + g(18).side]],
  { t0: 9, t1: 11, mk: 'ai', cls: 'sks', dash: '4 3' },
);

// ---- districts --------------------------------------------------------------------
const district = (x1, y1, x2, y2) =>
  `<polygon points="${[[x1, y1], [x2, y1], [x2, y2], [x1, y2]].map(([px, py]) => p2(px, py)).join(' ')}" class="skf fnone" stroke-dasharray="5 4"/>`;

// ---- registry boundary --------------------------------------------------------------
const [bx1, by1] = pt(680, -40), [bx2, by2] = pt(680, 150);
const boundary = `<line x1="${bx1.toFixed(1)}" y1="${by1.toFixed(1)}" x2="${bx2.toFixed(1)}" y2="${by2.toFixed(1)}" class="sks" stroke-dasharray="9 5"/>`;

// ---- bodies, painted back to front --------------------------------------------------
const bodies = M.map(([n]) => n)
  .sort((a, b) => (g(a).cx + g(a).cy) - (g(b).cx + g(b).cy))
  .map(massBlock)
  .join('\n');

// ---- schedule -----------------------------------------------------------------------
const ART_H = 930;
const massed = M.filter((r) => r[6] > 0);
const TOT_F = massed.reduce((a, r) => a + r[5], 0);
const TOT_L = massed.reduce((a, r) => a + r[6], 0);
const schedRow = ([n, name, tier, , , files, sloc, , , note]) =>
  `${String(n).padStart(2, ' ')}  ${name} — ${sloc > 0 ? `${files}f · ${fmt(sloc)} sloc` : 'not massed'} · ${TIER_TEXT[tier]} · ${note}`;
const half = Math.ceil(M.length / 2);
const SY = ART_H + 14;
const schedule = `<rect x="40" y="${SY}" width="1320" height="${72 + half * 17}" class="sk fp"/>
${txt(58, SY + 22, 'STRUCTURE SCHEDULE — authored source per structure · files (f) · sloc · gate tier', 'lbls')}
<line x1="40" y1="${SY + 32}" x2="1360" y2="${SY + 32}" class="skf"/>
${M.slice(0, half).map((r, i) => txt(58, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${M.slice(half).map((r, i) => txt(710, SY + 52 + i * 17, schedRow(r), 'lbls')).join('\n')}
${txt(58, SY + 58 + half * 17, `TOTAL — ${massed.length} massed structures · ${TOT_F} authored files · ${fmt(TOT_L)} sloc · ${COUNTED} · gate tiers unchanged from rev A`, 'lbls')}`;

// ---- inset: the two task managers, drawn FLAT because the shape is a loop --------
// Every figure read from the same two plates sheet 3A draws: census-handoff.json
// (workflows, mise tasks) and census-plate.json (the ci graph).  Non-iso: plumbing.
const ibox = (x, y, w, h, name, count) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="sk fp"/>
${txt(x + w / 2, count ? y + 15 : y + h / 2 + 3.5, name, 'lbls', 'middle')}${count ? `\n${txt(x + w / 2, y + 26, count, 'lblf', 'middle')}` : ''}`;
const iflow = (d, cls = 'sk', mk = 'ai') => arrow(P, d, mk, cls);

const inset = `<rect x="40" y="26" width="600" height="156" class="skf fnone"/>
${txt(52, 43, 'TWO TASK MANAGERS, ONE RE-ENTRANT LOOP', 'lbls')}
${txt(52, 55, 'mise — node-free umbrella · turbo — cached fan-out (remote R2) · neither sits above the other', 'lblf')}

${ibox(52, 74, 104, 32, 'GITHUB ACTIONS', `${HW.calling} workflows`)}
${ibox(254, 74, 166, 32, 'mise', `${HM.tasks} tasks · ${HM.withDepends} depends edges`)}
${ibox(498, 74, 126, 32, 'turbo', `ci = ${CI_NODES} task nodes`)}
${ibox(52, 130, 200, 28, 'AQUA TOOL BELT', null)}

${iflow('M160,90 L250,90')}
${iflow('M424,90 L494,90')}
${iflow('M561,106 L561,124 L300,124 L300,107', 'ska', 'aa')}
${iflow('M280,106 L280,144 L258,144', 'sks', 'as')}

${txt(205, 71, `${HW.callSites} call sites · ${HW.targets} distinct tasks`, 'lblf', 'middle')}
${txt(459, 71, '7 tasks shell turbo', 'lblf', 'middle')}
${txt(430, 139, '7 root scripts shell mise run', 'lbls', 'middle')}
${txt(430, 151, 'cache key over tools node never installs', 'lblf', 'middle')}
${txt(272, 120, 'mise/aqua provisions them', 'lblf', 'end')}
${txt(52, 172, 'rumdl · taplo · shellcheck · actionlint · zizmor — none installable by node', 'lblf')}`;

const svg = `<svg viewBox="0 0 1400 ${SY + 100 + half * 17}" role="img" aria-label="Isometric map of the lit-ui-router monorepo as an industrial site, re-massed from measured source. A build conveyor runs along one straight isometric lane from upper left to lower right: the packages source slab, the oxc-emit build shed, the packer, a green crate that is the one tarball, the publish hall, and the npm registry beyond a dashed boundary. Below and to the left stands the instrument yard in two rows, and below that a proving ground of sample apps, end to end tests and the docs deploy watch. Every structure is massed by its own census — footprint side proportional to the square root of its authored source lines, height one and a half pixels per authored file — so the two heaviest masses on the sheet are material rather than instruments: the sample apps tower at ${nfl(18)}, and the source slab at ${nfl(1)}. Gate severity is carried entirely in colour, never in height: five small red hatched pads stop the pull request line — the vitest harness, compat-guards, dts-backtest, check exports, and Cypress end to end — one solid red block, published-diff, halts publishing outright; two accent hatched blocks gate a later stage, the version bump and the docs deploy; and the faint unhatched blocks never gate at all. A dashed trunk carries the one cached tarball from the green crate to the three checks that read it, and a long accent return runs from the registry around the front of the whole site back into published-diff, closing the loop. A structure schedule lists all ${M.length} structures with exact file and line counts and their gate tier. In the upper left corner, set apart from the isometric site, a small flat schematic shows the two task managers as a loop rather than a stack: GitHub Actions enters mise at thirty-seven call sites across eight workflows, mise holds forty-eight tasks with only two dependency edges, seven of those tasks shell turbo whose continuous-integration graph expands to ${CI_NODES} task nodes, and an accent arrow returns from turbo back into mise, where seven root scripts shell mise again for the aqua-provisioned linters — rumdl, taplo, shellcheck, actionlint and zizmor — that node never installs.">
${defs(P)}

${inset}

${txt(1360, 34, 'SCALE — footprint side = 1.6 · √sloc (plan area ∝ sloc) · height = 1.5 px per authored file · mass = sloc × files', 'lbls', 'end')}
${txt(1360, 48, 'GATE SEVERITY IS COLOUR, NOT HEIGHT — red stops the line, accent gates a later stage, faint never gates', 'lblf', 'end')}
${txt(1360, 62, 'the tarball, the registry and the boundary are diagrammatic, not to scale', 'lblf', 'end')}

<!-- severity ladder: the encoding, on the drawing -->
<rect x="950" y="130" width="410" height="146" class="skf fnone"/>
${txt(966, 152, 'GATE SEVERITY — READ THE COLOUR, NOT THE HEIGHT', 'lbls')}
${[
  ['skr', 'fr', null, 'halts a publish — published-diff (11)', 'lblr'],
  ['skr', 'fp', 'hr', 'stops the PR line — 7 · 8 · 9 · 10 · 17', 'lblr'],
  ['ska', 'fp', 'ha', 'gates a later stage — 12 · 19', 'lbla'],
  ['skf', 'fp2', null, 'never gates — 13 · 14 · 15 · 16', 'lbls'],
].map(([edge, fill, hatch, label, cls], i) => {
  const y = 176 + i * 24;
  return `<rect x="966" y="${y}" width="34" height="14" class="${fill}"/>${hatch ? `<rect x="966" y="${y}" width="34" height="14" fill="url(#${P}-${hatch})"/>` : ''}<rect x="966" y="${y}" width="34" height="14" class="${edge} fnone"/>
${txt(1014, y + 11, label, cls)}`;
}).join('\n')}

<!-- districts -->
${district(10, 175, 445, 385)}

${boundary}
${conveyor}
${busTrunk}
${busStubs}
${ret}
${drive}
${bodies}

<!-- lettering: every label in its own pocket, leaders where the gap is wide -->
${txt(55, 200, 'PACKAGES/* — THE MATERIAL', 'lblb')}
${txt(55, 213, `${nf(1)} authored files · ${fmt(nl(1))} sloc`, 'lblf')}
${txt(55, 225, 'five published packages enter here', 'lblf')}
<line x1="250" y1="212" x2="276" y2="238" class="skf"/>

${txt(742, 398, 'THE TARBALL', 'lblb')}
${txt(742, 411, 'one packer · many readers · never re-packed', 'lblf')}
<line x1="736" y1="404" x2="712" y2="424" class="skf"/>

${txt(1060, 600, 'NPM REGISTRY', 'lblb')}
${txt(1060, 613, 'beyond the boundary a release is immutable', 'lblf')}
${txt(1060, 625, 'and only published-diff still reads it', 'lblf')}
<line x1="1054" y1="596" x2="1037" y2="593" class="skf"/>

${txt(560, 535, 'published-diff — the only halt', 'lblr')}
${txt(560, 548, `${nf(11)} files, ${fmt(nl(11))} sloc`, 'lblf')}
<line x1="554" y1="532" x2="455" y2="499" class="skf"/>

${txt(470, 795, 'docs deploy — gates the site', 'lbls')}
<line x1="560" y1="789" x2="578" y2="768" class="skf"/>

${txt(600, 645, `SAMPLE APPS — ${nf(18)}f · ${fmt(nl(18))} sloc`, 'lblb')}
${txt(600, 658, 'the heaviest mass on the sheet', 'lblf')}
${txt(600, 670, 'gates nothing at all', 'lblf')}
<line x1="594" y1="652" x2="582" y2="712" class="skf"/>

${txt(90, 555, 'e2e — cypress · stops the line', 'lblr')}
${txt(90, 568, 'and drives the apps beside it', 'lblf')}
<line x1="278" y1="559" x2="300" y2="588" class="skf"/>

${txt(620, 900, 'the return: published-diff reads the LIVE npm tarball — the registry is inside the circuit, not at the end of it', 'lbla', 'middle')}

<!-- district lettering -->
${txt(700, 300, 'packages/ — the conveyor: source in, one tarball out', 'lblf')}
${txt(40, 520, 'tools/ — the instrument yard', 'lblf')}
${txt(40, 532, 'nineteen packages, mostly measurement', 'lblf')}
${txt(700, 830, 'apps/ + docs/ — proving ground & shopfront', 'lblf')}

${schedule}
</svg>`;

export const sheet3 = {
  num: 3, id: 'monorepo', rev: 'D',
  title: 'THE INSTRUMENT YARD',
  sub: `ALTITUDE 3 — 5 publishable packages · 19 tools · 44 turbo task names · one packer, many readers · REV C: census refresh — every mass ${COUNTED} from diagrams/data/census-yard.json (scc Code lines), ${TOT_F} authored files and ${fmt(TOT_L)} sloc across ${massed.length} massed structures · REV D: the task-manager inset reads census-handoff.json + census-plate.json — ci ${CI_NODES} nodes, no longer a hand-pasted 535`,
  scale: 'THE MONOREPO',
  form: 'ISOMETRIC CITY',
  svg,
  caption: 'The monorepo drawn as what it functionally is: a short conveyor that turns source into one tarball, inside a yard of instruments built to measure that tarball. Rev B gives every structure its measured mass — footprint ∝ √sloc, height ∝ authored files — and moves gate severity out of height and into colour, because the two never correlated: the blocks that stop the line are among the smallest on the sheet.',
  notes: `
<p><strong>Method — one basis, shared with sheet 4.</strong> Every massed structure was counted from this repo's authored source, ${COUNTED} and read from <code>diagrams/data/census-yard.json</code>: <code>.ts/.tsx/.js/.mjs</code> under each member's source directory, excluding <code>*.d.ts</code>, <code>*.test-d.ts</code>, <code>*.spec.*</code> and <code>*.test.*</code>, <code>specs/</code>, <code>__tests__/</code> and fixtures. <em>sloc</em> is <code>scc</code>'s <code>Code</code> count — string-aware, so the interior of a template literal counts as code rather than as one line. <code>@tools/release</code> hosts several instruments at once, so it is attributed by module prefix — <code>check-published-diff*</code> to structure 11, <code>check-exports*</code> to 10, the pack modules to 3, the release steps to 5 — with every file landing in exactly one structure and none counted twice. ${M.length} structures, ${massed.length} of them massed: ${TOT_F} authored files, ${fmt(TOT_L)} lines. The tarball, the registry and the boundary are diagrammatic.</p>
<p><strong>Mass is volume; volume does not predict authority.</strong> Footprint side is <code>1.6 · √sloc</code>, so plan area tracks lines; height is <code>1.5 px</code> per authored file, so a block's volume is its <code>sloc × files</code>. The two heaviest masses on the sheet are <em>material</em>: the sample apps (${nfl(18)}) and <code>packages/*/src</code> (${nfl(1)}). The ${PR_GATES.length} structures that can stop a pull request total ${PR_GATES.reduce((a, n) => a + nf(n), 0)} files between them, and one of them — <code>dts-backtest</code> — is a single ${nl(9)}-line <code>run.ts</code>. Rev A encoded severity as height and so implied the opposite; the census says a gate's authority has nothing to do with how much code it is.</p>
<p><strong>Severity in colour.</strong> Red hatch across cap and flank marks a check that stops the PR line: the vitest harness (7), <code>compat-guards</code> (8), <code>dts-backtest</code> (9), <code>check:exports</code> (10) and Cypress <code>e2e</code> (17). One block is solid red — <code>published-diff</code> (11) — because it is the only structure that halts publishing itself, and it closes the loop by pulling the <em>live</em> npm tarball back for comparison, which makes the registry part of the circuit rather than a destination. Accent hatch marks the gates that fire later rather than on a PR: <code>peer-floor</code> tier-2 (12) gates version bumps, the workers-builds watch (19) gates the docs deploy. Faint, unhatched blocks never gate at all — <code>peer-floor</code> tier-1 reports check runs, the lint &amp; probe fleet is advisory, <code>@tools/shared</code> and the typedoc plugin are libraries. The tiers survive both themes because they differ in hatch as well as hue: solid red, red hatch, accent hatch, no hatch.</p>
<p><strong>One packer, many readers (#449).</strong> The dashed trunk leaving the green crate is literal: <code>check:exports</code> (publint + attw), <code>dts-backtest</code> and <code>published-diff</code> all read the same cached <code>packPublishTarball</code> output. No check re-packs, so a drift verdict is always about the artifact that would actually ship. Known failure mode, drawn nowhere but real: a poisoned remote cache entry can replay a stale verdict — <code>--force</code> is the remediation.</p>
<p><strong>Two task managers, one re-entrant loop.</strong> The inset at top left is drawn flat, not isometric, because a task manager is not a place — and because the relationship is not the clean layering it sounds like. GitHub Actions enters mise at ${HW.callSites} call sites across ${HW.calling} workflows (${HW.targets} distinct tasks); mise itself is almost graphless — ${HM.tasks} tasks with exactly ${HM.withDepends} <code>depends</code> edges, <code>lint_workflows</code> → its four linters and <code>setup</code> → <code>turbo_link_worktree</code> — because it delegates fan-out rather than modelling it. Seven mise tasks shell turbo, whose <code>ci</code> graph alone expands to ${CI_NODES} task nodes. Then the loop closes back on itself: seven root <code>package.json</code> scripts shell <code>mise run</code> again, so turbo's <code>//#lint:markdown</code> node literally runs <code>mise run lint_markdown</code>. That return is the whole point — mise/aqua owns the versions of the non-node tools (rumdl, taplo, shellcheck, actionlint, zizmor), and turbo climbs back out to it to get a cache key over tools node never installs. Neither gantry is above the other.</p>
<p><strong>Rev C — census refresh (${COUNTED}) and a change of ruler.</strong> Nothing about the argument changed; the numbers under it did, for two separate reasons that are worth keeping apart. <em>The ruler changed:</em> sloc is now <code>scc</code>'s string-aware <code>Code</code> count instead of a homegrown blank-and-comment filter, which adds roughly 0.9% across the yard because a template literal's interior now counts line by line. Measured both ways over one identical file set — rev B's twenty-five source directories — the old ruler reads 11,560 lines and <code>scc</code> reads 11,658, so of everything below, about a hundred lines are the tape measure and the rest is code. <em>The code changed:</em> re-measured on the plate, <code>packages/*/src</code> went 2,568 → ${fmt(nl(1))}, the sample apps 2,995 → ${fmt(nl(18))}, Cypress <code>e2e</code> 5 files/405 → ${nf(17)} files/${fmt(nl(17))}. And the yard gained three instruments — <code>@tools/lint-elements</code>, <code>@tools/warn-lanes</code> (#639) and <code>@tools/eslint-ts-parser</code> — which is why <code>tools/</code> now reads nineteen packages and the lint &amp; probe fleet is the one block that visibly grew, 13 files/732 lines to ${nf(14)}/${fmt(nl(14))}. Structure 15 shifted 13 plan units right to keep air around it. Totals: ${TOT_F} authored files, ${fmt(TOT_L)} lines, up from 171/10,652. A note on the count: <code>@tools/wintercg-globals</code> is a member of the workspace but massed nowhere, because its entire source is one <code>globals.d.ts</code> and declaration files are outside this basis — it has always been invisible to this sheet. In the inset, only turbo moved: the <code>ci</code> graph went 501 → 535 nodes (<code>turbo run ci --dry=json</code>, turbo 2.10.11), while mise held at 48 tasks and Actions at 37 call sites across eight workflows. The tarball's readers, the gate tiers and the loop are unchanged.</p>
<p><strong>Rev D — the inset is off the clipboard too.</strong> The whole plate cabinet was re-counted at ${PLATE.ref} @ ${PLATE.sha} in one pass, and the yard moved with it: ${TOT_F} authored files and ${fmt(TOT_L)} sloc across ${massed.length} massed structures, up from rev C's 187 / 12,798. The correction rev D exists for is the inset. Its four task-manager figures were the last hand-pasted constants on this sheet, and by rev C's own printing one of them was wrong in the same build that printed it: the inset said the <code>ci</code> graph was 535 nodes while plates 3A and 12, reading <code>census-plate.json</code>, said 590. All four now read from the same two plates 3A draws — <code>census-handoff.json</code> for the workflow, mise and call-site counts, <code>census-plate.json</code> for the graph — so the three sheets cannot disagree about the machine again. At this ref that is ${HW.calling} workflows, ${HW.callSites} call sites over ${HW.targets} distinct tasks, ${HM.tasks} mise tasks with ${HM.withDepends} <code>depends</code> edges, and <code>ci</code> at ${CI_NODES} nodes. The gate tiers, the loop and the argument are unchanged.</p>`,
  key: [
    keyRow('<rect x="6" y="3" width="36" height="12" class="fr"/><rect x="6" y="3" width="36" height="12" class="skr fnone"/>', 'halts a publish (published-diff alone)'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#s3-hr)"/><rect x="6" y="3" width="36" height="12" class="skr fnone"/>', 'stops the PR line'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="fp"/><rect x="6" y="3" width="36" height="12" fill="url(#s3-ha)"/><rect x="6" y="3" width="36" height="12" class="ska fnone"/>', 'gates a later stage (bump · release · deploy)'),
    keyRow('<rect x="6" y="3" width="36" height="12" class="skf fp2"/>', 'never gates — reporters and libraries'),
    keyRow('<polygon points="6,10 24,2 42,10 24,18" class="sk fp"/>', 'mass — footprint ∝ √sloc, height ∝ files'),
    keyRow('<rect x="10" y="4" width="28" height="11" class="skg fg"/>', 'the artifact (one tarball)'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="sks" stroke-dasharray="5 4"/>', 'checks reading the cached tarball'),
    keyRow('<line x1="2" y1="9" x2="44" y2="9" class="ska" stroke-dasharray="7 4"/>', 'the return from the live registry'),
  ].join('\n'),
};

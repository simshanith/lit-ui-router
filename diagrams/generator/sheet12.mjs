import { defs } from './chrome.mjs';
import { txt, lines, box, keyRow } from './helpers.mjs';

const P = 's12';

// ---------------------------------------------------------------------------
// DATA — from census-plate.mjs (`turbo run <pipeline> --dry=json`, turbo 2.10.9,
// worktree altitude-atlas, 2026-08-16). Cell codes: R = command-bearing,
// p = phantom placeholder (command "<NONEXISTENT>"), - = no node in the graph.
// ---------------------------------------------------------------------------

// column order = pipeline stage, not fan
const COLS = [
  'transit', 'build:types', 'build:js', 'build', 'docs:api',
  'typecheck', 'typecheck:src', 'typecheck:lit2', 'typecheck:mobx6', 'lint', 'format:check',
  'test', 'test:coverage', 'test:lit2-compat', 'test:mobx6-compat', 'check:bundle',
  'ci:pull_request', 'ci',
];
const COL_TOT = [[27, 0], [26, 5], [23, 5], [27, 4], [9, 4], [27, 23], [26, 5], [25, 2], [25, 1], [27, 27], [27, 27], [27, 16], [27, 4], [27, 2], [27, 1], [27, 4], [27, 0], [27, 0]];
const SELF = new Set(['transit', 'build:types', 'build', 'test', 'test:coverage']); // ^self chains
const ALLP = new Set(['transit', 'ci:pull_request', 'ci']); // 100% phantom by design

const STAGES = [[0, 0, 'GATHER'], [1, 4, 'EMIT'], [5, 10, 'CHECK'], [11, 15, 'PROVE'], [16, 17, 'ROLL-UP']];

const GROUPS = [
  ['PACKAGES/ — PUBLISHABLE ×4', [
    ['lit-ui-router', 'pRRpRRRRpRRRRRpRpp'],
    ['lit-ui-router-mobx', 'pRRpRRRRRRRRRRRRpp'],
    ['ui-router-navigation-location-plugin', 'pRRpRRRppRRRRppRpp'],
    ['ui-router-server', 'pRRpRRR--RRRRppRpp'],
  ]],
  ['APPS/ — SAMPLE + E2E ×5', [
    ['sample-app-shared', 'pppp-RpppRRRpppppp'],
    ['sample-app-routes', 'pppppRpppRRRpppppp'],
    ['sample-app-lit-vanilla', 'pp-RpRpppRRppppppp'],
    ['sample-app-lit-mobx', 'pp-RpRpppRRppppppp'],
    ['sample-app-lit-e2e', 'p--R-ppppRRRpppppp'],
  ]],
  ['DOCS + EXAMPLES ×2', [
    ['docs', 'pp-R-R---RRRpppppp'],
    ['examples', 'pppp-RpppRRppppppp'],
  ]],
  ['TOOLS/ — INSTRUMENTS ×16', [
    ['@tools/build_and_test', 'pppppRpppRRRpppppp'],
    ['@tools/bundle-probe', 'pppp-RpppRRppppppp'],
    ['@tools/compat-guards', 'pppp-RpppRRRpppppp'],
    ['@tools/dts-backtest', 'pppp-ppppRRRpppppp'],
    ['@tools/happy-dom', 'pppp-RpppRRRpppppp'],
    ['@tools/lcov-rebase', 'pppp-RpppRRRpppppp'],
    ['@tools/lit-template-lint', 'pppp-RpppRRppppppp'],
    ['@tools/lit-test-env', 'pppp-RpppRRppppppp'],
    ['@tools/oxc-emit', 'pppp-RpppRRppppppp'],
    ['@tools/release', 'pppp-RpppRRRpppppp'],
    ['@tools/release-config', 'pppp-ppppRRppppppp'],
    ['@tools/shared', 'pppp-RpppRRRpppppp'],
    ['@tools/typedoc-plugin-lit-ui-router', 'pRRp-RRppRRppppppp'],
    ['@tools/vue-check', 'pppppppppRRppppppp'],
    ['@tools/wintercg-globals', 'pppp-RpppRRppppppp'],
    ['@tools/workers-builds', 'pppp-RpppRRRpppppp'],
  ]],
  ['ROOT // — NO FANNED TASKS', [
    ['//', '------------------'],
  ]],
];

// ci:main overlay — the four names ci:pull_request does not carry.
const OCOLS = ['ci:main', 'test:engines', 'test:matrix', 'check:pack'];
const OREAL = {
  'test:engines': new Set(['lit-ui-router', 'sample-app-shared', 'ui-router-navigation-location-plugin']),
  'test:matrix': new Set(['@tools/dts-backtest']),
  'check:pack': new Set(['@tools/release']),
};
const OPRESENT = { 'ci:main': null, 'test:engines': null, 'test:matrix': new Set(['@tools/dts-backtest']), 'check:pack': new Set(['@tools/release']) };

// the ragged tail: one node, one package, no fan
const TAIL = [
  ['//#check:docs-api-deps', 1], ['//#check:patches', 1], ['//#format:check:root', 1],
  ['//#format:check:toml', 1], ['//#lint:actionlint', 1], ['//#lint:markdown', 1],
  ['//#lint:package-json', 1], ['//#lint:root', 1], ['//#lint:shellcheck', 1],
  ['//#lint:templates', 1], ['//#lint:toml', 1], ['//#lint:workflows', 0],
  ['//#lint:zizmor', 1], ['//#typecheck:root', 1],
  ['@tools/release#check:exports', 1], ['@tools/release#pack:all', 1],
  ['docs#typecheck:vue', 1], ['docs#typecheck:worker', 1], ['docs#typecheck:worker:tests', 1],
  ['docs#types:worker', 1], ['examples#build:embeds', 1],
  ['lit-ui-router#build:custom-elements', 1], ['sample-app-lit-vanilla#build:hash', 1],
  ['ui-router-server#typecheck:runtime-globals', 1], ['ui-router-server#typecheck:tests', 1],
];

// the deepest chain in the ci graph: 12 nodes, 5 of them command-bearing
const CHAIN = [
  ['@tools/build_and_test#build:types', 0], ['@tools/bundle-probe#build:types', 0],
  ['ui-router-server#build:types', 1], ['sample-app-routes#build:types', 0],
  ['sample-app-routes#build', 0], ['sample-app-shared#build', 0],
  ['sample-app-lit-mobx#build', 1], ['docs#build', 1],
  ['sample-app-lit-e2e#build', 1], ['sample-app-lit-e2e#test', 1],
  ['sample-app-lit-e2e#ci:pull_request', 0], ['sample-app-lit-e2e#ci', 0],
];

// the only uncacheable task definitions in the repo — none reachable from ci
const UNCACHED = [
  ['codecov:bundle', 'reports to a third party'],
  ['format', 'WRITER — rewrites its own inputs'],
  ['//#format:root', 'WRITER'],
  ['//#format:toml', 'WRITER — taplo'],
  ['dev', 'persistent server'],
  ['docs', 'persistent server'],
  ['e2e', 'persistent server'],
];

const LEDGER = [
  ['ci', 483, 154, 1280, 116, '12 / 7', 'the PR gate — 27 packages × 18 fanned names'],
  ['ci:main', 512, 159, 1430, 117, '12 / 7', '+56 nodes over 4 names; PR graph folded in'],
  ['build', 103, 22, 252, 14, '9 / 6', 'the emit tier alone — four fifths placeholder'],
  ['lint', 61, 43, 120, 31, '8 / 4', 'the densest real graph here — 70% real'],
  ['pack:all', 50, 12, 98, 5, '6 / 4', 'one real task atop a 50-node cone'],
];

// ---------------------------------------------------------------------------
// GEOMETRY
// ---------------------------------------------------------------------------
const LX = 252;              // right edge of the row-label gutter
const CX0 = 268, CP = 24;    // first column centre, column pitch
const OX0 = 706;             // overlay first column centre
const RP = 16;               // row pitch
const CW = 15, CH = 10;      // card-hole size
const RX = 810;              // right annotation column
const cx = (i) => CX0 + i * CP;
const ox = (j) => OX0 + j * CP;

const MTOP = 300;
const rows = [];             // [name, code, y, groupIdx]
{
  let y = MTOP;
  GROUPS.forEach(([, rs], gi) => {
    y += 16;                 // section header sits on this line
    const hy = y;
    rs.forEach(([n, c]) => { y += RP; rows.push([n, c, y, gi, hy]); });
    y += 10;                 // air between groups
  });
}
const HDRS = GROUPS.map(([label], gi) => [label, rows.find((r) => r[3] === gi)[4]]);
const MBOT = rows[rows.length - 1][2] + 10;
const TOTY = MBOT + 22;

function hole(x, y, kind) {
  const a = (x - CW / 2).toFixed(1), b = (y - CH / 2).toFixed(1);
  const r = (cls, fill) => `<rect x="${a}" y="${b}" width="${CW}" height="${CH}" class="${cls}"${fill ? ` fill="${fill}"` : ''}/>`;
  switch (kind) {
    case 'R': return r('sk fa');
    case 'p': return `<rect x="${a}" y="${b}" width="${CW}" height="${CH}" stroke="var(--ink-faint)" stroke-width="1" fill="url(#${P}-hp)"/>`;
    case 'x': return r('skr fnone') + `<line x1="${a}" y1="${b}" x2="${(+a + CW).toFixed(1)}" y2="${(+b + CH).toFixed(1)}" class="skr" opacity="0.7"/>`;
    case 'g': return r('ska', `url(#${P}-ha)`);
    case 'h': return `<rect x="${a}" y="${b}" width="${CW}" height="${CH}" class="ska fnone" stroke-dasharray="2 2" opacity="0.7"/>`;
    case 'c': return r('skg fp') + `<circle cx="${x}" cy="${y}" r="2.2" class="fg"/>`;
    default: return '';
  }
}

// --- grid ruling: a dot lattice, so an absent node reads as an empty station
const RULE = 'stroke="var(--ink-faint)" stroke-width="1" opacity="0.5" stroke-dasharray="1 5" fill="none"';
const vrules = COLS.map((_, i) => `<line x1="${cx(i)}" y1="${MTOP + 8}" x2="${cx(i)}" y2="${MBOT}" ${RULE}/>`).join('\n');
const hrules = rows.map(([, , y]) => `<line x1="${CX0 - 12}" y1="${y}" x2="${cx(17) + 12}" y2="${y}" ${RULE}/>`).join('\n');

// --- column headers, rotated to read upward
const headers = COLS.map((n, i) => {
  const cls = ALLP.has(n) ? 'lblr' : SELF.has(n) ? 'lbla' : 'lbls';
  return txt(cx(i) + 3.5, 288, n, cls, 'start', `transform="rotate(-90 ${cx(i) + 3.5} 288)"`);
}).join('\n');

const stages = STAGES.map(([a, b, label]) => {
  const x1 = cx(a) - 9, x2 = cx(b) + 9;
  return `<path d="M${x1},178 L${x1},172 L${x2},172 L${x2},178" class="sks" opacity="0.7"/>
${txt((x1 + x2) / 2, 162, label, 'lblf', 'middle')}`;
}).join('\n');

// --- row labels + cells
const body = rows.map(([name, code, y]) => {
  const pub = /^(lit-ui-router|lit-ui-router-mobx|ui-router-server|ui-router-navigation)/.test(name);
  const label = txt(LX, y + 3.5, name, 'lbls', 'end', pub ? 'fill="var(--accent)"' : '');
  const cells = [...code].map((k, i) => {
    if (k === '-') return '';
    const kind = k === 'R' ? 'R' : ALLP.has(COLS[i]) ? 'x' : 'p';
    return hole(cx(i), y, kind);
  }).join('');
  const over = name === '//' ? '' : OCOLS.map((n, j) => {
    if (OPRESENT[n] && !OPRESENT[n].has(name)) return '';
    return hole(ox(j), y, OREAL[n]?.has(name) ? 'g' : 'h');
  }).join('');
  return label + cells + over;
}).join('\n');

const sectionHdrs = HDRS.map(([label, y]) => txt(30, y + 3.5, label, 'lblf')).join('\n');

// --- per-column tallies under the plate
const tallies = COLS.map((_, i) => {
  const [n, r] = COL_TOT[i];
  return txt(cx(i), TOTY, String(r), r === 0 ? 'lblr' : 'lbls', 'middle')
    + txt(cx(i), TOTY + 13, String(n), 'lblf', 'middle');
}).join('\n');

// --- ci:main overlay frame
const oFrame = `<rect x="${OX0 - 16}" y="${MTOP + 4}" width="${CP * 3 + 32}" height="${MBOT - MTOP - 4}" class="ska fnone" stroke-dasharray="5 4" opacity="0.75"/>
${OCOLS.map((n, j) => txt(ox(j) + 3.5, 288, n, 'lbla', 'start', `transform="rotate(-90 ${ox(j) + 3.5} 288)"`)).join('\n')}
${txt(OX0 - 16, 162, 'ci:main OVERLAY', 'lbla')}
${txt(OX0 - 16, TOTY, '+56 nodes · 4 names · +5 real', 'lbla')}`;

// --- right column: the phantom share, the deepest chain, the uncacheable tier
const stat = `${txt(RX, 206, 'THE PHANTOM SHARE', 'lblt')}
${lines(RX, 226, [
  '483 nodes in the PR graph.',
  '329 of them run nothing at all:',
  'command "<NONEXISTENT>", a stub',
  'turbo mints so a ^self chain has',
  'somewhere to land an edge.',
], 'lbls', 'start', 13)}
${txt(RX, 300, '68% PLACEHOLDER', 'lblr')}`;

const CLY = 352;
const ladder = `${txt(RX, CLY - 22, 'DEEPEST CHAIN IN THE GRAPH — 12 DEEP', 'lbls')}
<line x1="${RX + 8}" y1="${CLY}" x2="${RX + 8}" y2="${CLY + 11 * 22}" class="sks" opacity="0.6"/>
${CHAIN.map(([n, r], i) => {
    const y = CLY + i * 22;
    return hole(RX + 8, y, r ? 'R' : 'p') + txt(RX + 26, y + 3.5, n, r ? 'lbl' : 'lbls');
  }).join('\n')}
${lines(RX, CLY + 11 * 22 + 26, [
  'Five of those twelve run a command.',
  'The longest all-real chain is seven',
  '— and it is seven «test» tasks in a',
  'row, ordered by ^test alone. Nothing',
  'in it consumes anything above it.',
], 'lbls', 'start', 13)}`;

const UY = CLY + 11 * 22 + 118;
const uncached = `${txt(RX, UY, 'THE UNCACHEABLE SEVEN', 'lbls')}
${txt(RX, UY + 14, 'the only cache:false definitions in the', 'lblf')}
${txt(RX, UY + 25, 'repo — and none is reachable from ci', 'lblf')}
${UNCACHED.map(([n, why], i) => {
    const y = UY + 46 + i * 17;
    return hole(RX + 8, y, 'c') + txt(RX + 26, y + 3.5, n, 'lbls') + txt(RX + 26 + 132, y + 3.5, why, 'lblf');
  }).join('\n')}`;

// --- the ragged tail, below the plate
const TY = MBOT + 90;
const half = Math.ceil(TAIL.length / 2);
const tail = `${txt(30, TY, 'THE RAGGED TAIL — 25 SINGLETON TASKS, ONE NODE EACH, NO FAN', 'lbls')}
${txt(30, TY + 14, 'fourteen of them belong to the root package «//», which appears in no fanned column at all', 'lblf')}
${TAIL.map(([n, r], i) => {
    const col = i < half ? 0 : 1;
    const y = TY + 40 + (i - col * half) * 16;
    const x = 38 + col * 380;
    return hole(x, y, r ? 'R' : 'p') + txt(x + 18, y + 3.5, n, r ? 'lbls' : 'lblf');
  }).join('\n')}`;

// --- totals ledger
const SY = TY + 40 + half * 16 + 46;
const SH = 46 + LEDGER.length * 19 + 34;
const colx = [46, 300, 380, 462, 546, 634, 720];
const ledger = `<rect x="30" y="${SY}" width="1100" height="${SH}" class="sk fnone"/>
${txt(46, SY + 22, 'STRUCTURE SCHEDULE — TASK GRAPHS BY PIPELINE', 'lbls')}
<line x1="30" y1="${SY + 32}" x2="1130" y2="${SY + 32}" class="sks" opacity="0.7"/>
${['PIPELINE', 'NODES', 'REAL', 'PHANTOM', 'EDGES', 'REAL←REAL', 'CHAIN / REAL'].map((h, i) => txt(colx[i], SY + 48, h, 'lblf')).join('\n')}
${LEDGER.map(([n, nodes, real, edges, redges, chain, note], i) => {
    const y = SY + 68 + i * 19;
    const pct = Math.round(((nodes - real) / nodes) * 100) + '%';
    return [n, String(nodes), String(real), pct, String(edges), String(redges), chain]
      .map((v, k) => txt(colx[k], y, v, k === 0 ? 'lbl' : k === 3 ? 'lblr' : 'lbls')).join('')
      + txt(830, y, note, 'lblf');
  }).join('\n')}
${txt(46, SY + SH - 16, 'No duration is encoded anywhere on this plate: CI wall-clock comparisons in this repo are confounded by cache state and task counts.', 'lblf')}`;

const H = SY + SH + 30;

const svg = `<svg viewBox="0 78 1160 ${H - 78}" role="img" aria-label="A punchcard register plate of the pull-request CI task graph. Rows are the twenty-seven workspace packages plus the root, grouped into publishable packages, sample apps, docs and examples, tools, and root. Columns are the eighteen task names that fan across packages, ordered by pipeline stage: gather, emit, check, prove, roll-up. A filled accent card-hole marks a command-bearing task node; a faintly hatched hole marks a placeholder node that runs nothing; a red crossed hole marks the three task names that are one hundred percent placeholder by design — transit, ci:pull_request and ci. Of 483 nodes only 154 run a command and only 116 of 1280 dependency edges connect two real tasks. A ghosted four-column overlay to the right shows the fifty-six extra nodes the ci:main pipeline adds. Beside the plate, the deepest chain in the graph is drawn as a twelve-rung ladder of which five rungs are real, and the seven uncacheable task definitions in the repository are listed as a tier that never appears in this graph. Below, twenty-five singleton tasks form a ragged tail, and a structure schedule totals five pipelines.">
${defs(P)}
<defs><pattern id="${P}-hp" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
  <line x1="0" y1="0" x2="0" y2="4" stroke="var(--ink-faint)" stroke-width="0.9" opacity="0.75"/>
</pattern></defs>

${txt(30, 106, 'THE PR CI TASK GRAPH, PUNCHED', 'lblt')}
${txt(30, 122, 'one card-hole per (package, task) node turbo puts in the graph · turbo 2.10.9 · --dry=json', 'lbls')}
${txt(1130, 106, '483 NODES · 154 RUN A COMMAND', 'lblb', 'end')}
${txt(1130, 122, '1,280 EDGES · 116 JOIN TWO REAL TASKS', 'lbls', 'end')}

${stages}
${headers}
${vrules}
${hrules}
${sectionHdrs}
${body}
${oFrame}
${tallies}
${txt(LX, TOTY, 'run a command  →', 'lblf', 'end')}
${txt(LX, TOTY + 13, 'nodes minted  →', 'lblf', 'end')}

${txt(30, 206, 'THREE COLUMNS RUN NOTHING', 'lblr')}
${lines(30, 222, [
  'transit · ci:pull_request · ci',
  'have no implementation in any of',
  'the 27 packages. They exist only',
  'so the other columns can depend',
  'on something — pure graph edge.',
], 'lbls', 'start', 13)}

${stat}
${ladder}
${uncached}
${tail}
${ledger}
</svg>`;

export const sheet12 = {
  num: 12, id: 'graph',
  title: 'THE REGISTER PLATE',
  sub: 'ALTITUDE 3¼ — the monorepo as its CI reads it · every task node punched · turbo 2.10.9 · counted 2026-08-16',
  scale: 'PR CI GRAPH',
  form: 'REGISTER PLATE',
  svg,
  caption: 'The pull-request graph is a near-rectangle: twenty-seven packages against eighteen fanned task names, plus a ragged tail of twenty-five one-offs. Two thirds of the holes are unpunched — placeholder nodes that run nothing, minted so a ^self chain has somewhere to land an edge.',
  notes: `
<p><strong>Method.</strong> <code>turbo run ci --dry=json</code> and <code>turbo run ci:main --dry=json</code> from the repository worktree, turbo 2.10.9, counted 2026-08-16; the same for <code>build</code>, <code>lint</code> and <code>pack:all</code> in the schedule. A node is one <code>(package, task)</code> pair turbo placed in the graph. A node is <em>command-bearing</em> when its resolved command is not the literal <code>&lt;NONEXISTENT&gt;</code> — turbo's marker for a task it had to invent because something depends on it in that package. An edge is <em>real</em> only when both of its ends are. No duration is drawn anywhere: wall-clock comparisons here are confounded by cache state and by the task counts themselves, so this plate measures shape and nothing else.</p>
<p><strong>Why an inventory and not a city.</strong> Sheet 3 argues that a task manager is not a place; drawing this graph in isometric would smuggle back the geography that sheet's note denies. What a CI graph actually is, is a register: a fixed set of names crossed against a fixed set of packages, with most of the intersections empty. The honest form is the plate that shape already implies — a punchcard, read by column.</p>
<p><strong>The finding.</strong> 483 nodes; 154 run a command. 1,280 dependency edges; 116 join two real tasks. Of the eighteen fanned names, five carry a <code>^self</code> chain — <code>build</code>, <code>build:types</code>, <code>test</code>, <code>test:coverage</code>, <code>transit</code> — and a self-chain is what mints placeholders: turbo needs a node in <em>every</em> package to hang the chain on, whether or not that package has such a script. Three names are 100% placeholder in all 27 packages: <code>transit</code> (which has no implementation anywhere in the repo — it exists purely as an edge), and the two roll-ups <code>ci:pull_request</code> and <code>ci</code>. The plate's rightmost columns and its leftmost are, in the strictest sense, empty.</p>
<p><strong>Depth is mostly scaffolding too.</strong> The deepest chain is twelve nodes and five of them run anything. The longest chain of consecutive real nodes is seven — and it is seven <code>test</code> tasks in a row, serialized by <code>^test</code> and nothing else: no task in that chain consumes an artifact from the one above it. That is the price of a self-chain used for ordering rather than for data flow, and it is what a plate makes visible that a node-and-arrow render never does.</p>
<p><strong>What the plate is not evidence for.</strong> Placeholders are cheap — turbo schedules and skips them, and the phantom share is not a runtime cost. The argument is about legibility: 68% of what a maintainer sees in <code>--graph</code> output is scaffolding, and the two ratios worth watching are the real-node share per column and the real-edge count. Note also the one tier that never appears here at all: the repo's seven <code>cache:false</code> definitions — four writers and three persistent servers — are all outside every <code>ci:*</code> graph by design. A cache hit on any of them would be wrong, and the gate depends on their read-only twins instead (<code>format:check</code> for <code>format</code>).</p>
<p><strong>The overlay.</strong> <code>ci:main</code> is not a different pipeline; it swallows <code>ci:pull_request</code> whole and adds 56 nodes across four names — <code>ci:main</code>, <code>test:engines</code>, <code>test:matrix</code>, <code>check:pack</code> — of which five are command-bearing. The main-branch graph is 6% larger and buys three engine tests, one d.ts back-test and one pack check.</p>`,
  key: [
    keyRow(`<rect x="14" y="3" width="15" height="10" class="sk fa"/>`, 'punched — the task runs a command'),
    keyRow(`<rect x="14" y="3" width="15" height="10" stroke="var(--ink-faint)" stroke-width="1" fill="url(#${P}-hp)"/>`, 'unpunched — placeholder node, runs nothing'),
    keyRow('<rect x="14" y="3" width="15" height="10" class="skr fnone"/><line x1="14" y1="3" x2="29" y2="13" class="skr" opacity="0.7"/>', 'phantom by design — the whole column'),
    keyRow('<line x1="4" y1="9" x2="40" y2="9" stroke="var(--ink-faint)" stroke-width="1" opacity="0.5" stroke-dasharray="1 5"/>', 'grid station — no node in this graph'),
    keyRow(`<rect x="14" y="3" width="15" height="10" class="ska" fill="url(#${P}-ha)"/>`, 'ci:main overlay — main-branch only'),
    keyRow('<rect x="14" y="3" width="15" height="10" class="skg fp"/><circle cx="21.5" cy="8" r="2.2" class="fg"/>', 'cache:false — a cache hit would be wrong'),
    keyRow('<text x="4" y="13" class="lbla" font-size="10">^self</text>', 'accent column head = carries a ^self chain'),
  ].join('\n'),
};

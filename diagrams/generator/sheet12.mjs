import { readFileSync } from 'node:fs';
import { defs } from './chrome.mjs';
import { txt, lines, keyRow } from './helpers.mjs';

const P = 's12';

// ---------------------------------------------------------------------------
// DATA — every graph number on this plate is imported from
// diagrams/data/census-plate.json, the checked-in snapshot census-plate.mjs
// writes from `turbo run <pipeline> --dry=json` against a materialized,
// installed archive of the ref.  Cell codes come straight from the plate:
// r = command-bearing, p = phantom placeholder (command "<NONEXISTENT>"),
// absent = no node in the graph.  This file holds placement, column order,
// the traced chain and prose only.
// ---------------------------------------------------------------------------
const PLATE = JSON.parse(readFileSync(new URL('../data/census-plate.json', import.meta.url), 'utf8'));

const pipe = (n) => {
  const p = PLATE.pipelines?.[n];
  if (!p) throw new Error(`sheet 12: pipeline ${n} is missing from diagrams/data/census-plate.json`);
  return p;
};
const CI = pipe('ci');
const MAIN = pipe('ci:main');
const NAMES = new Map(CI.names.map((n) => [n.name, n]));
const nm = (n) => {
  const v = NAMES.get(n);
  if (!v) throw new Error(`sheet 12: task name ${n} is missing from the ci graph in diagrams/data/census-plate.json`);
  return v;
};
const CELLS = CI.cells;
const cell = (pkg, task) => CELLS[pkg]?.[task];

const TURBO = PLATE.wasAssociatedWith?.find((a) => a.startsWith('turbo '));
if (!TURBO) throw new Error('sheet 12: diagrams/data/census-plate.json carries no turbo version in wasAssociatedWith');
const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)}) · ${TURBO}`;

const fmt = (v) => v.toLocaleString('en-US');
const WORD = ['NO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];
const phantomPct = (p) => Math.round(((p.nodes - p.real) / p.nodes) * 100);

// column order = pipeline stage, not fan; every fanned name in the plate must be placed here
const COLS = [
  'transit', 'build:types', 'build:js', 'build', 'docs:api',
  'typecheck', 'typecheck:src', 'typecheck:lit2', 'typecheck:mobx6', 'lint', 'format:check',
  'test', 'test:coverage', 'test:lit2-compat', 'test:mobx6-compat', 'check:bundle', 'check:dev-split',
  'ci:pull_request', 'ci',
];
const FANNED = CI.names.filter((n) => n.nodes > 1).map((n) => n.name);
for (const n of FANNED) {
  if (!COLS.includes(n)) throw new Error(`sheet 12: fanned task name ${n} has no column — place it in COLS by pipeline stage`);
}
COLS.forEach(nm);

const SELF = new Set(['transit', 'build:types', 'build', 'test', 'test:coverage']); // ^self chains, from turbo.json
const ALLP = new Set(COLS.filter((n) => nm(n).real === 0));                          // 100% phantom by design

const STAGES = [[0, 0, 'GATHER'], [1, 4, 'EMIT'], [5, 10, 'CHECK'], [11, 16, 'PROVE'], [17, 18, 'ROLL-UP']];

// row grouping: a rule per block, so a new member lands in its own block
const APP_ORDER = ['sample-app-shared', 'sample-app-routes', 'sample-app-lit-vanilla', 'sample-app-lit-mobx', 'sample-app-lit-e2e'];
const BLOCKS = [
  { label: (n) => `PACKAGES/ — PUBLISHABLE ×${n}`, test: (p) => !p.startsWith('@tools/') && !p.startsWith('sample-app-') && p !== 'docs' && p !== 'examples' && p !== '//' },
  { label: (n) => `APPS/ — SAMPLE + E2E ×${n}`, test: (p) => p.startsWith('sample-app-'), order: APP_ORDER },
  { label: (n) => `DOCS + EXAMPLES ×${n}`, test: (p) => p === 'docs' || p === 'examples' },
  { label: (n) => `TOOLS/ — INSTRUMENTS ×${n}`, test: (p) => p.startsWith('@tools/') },
  { label: () => 'ROOT // — NO FANNED TASKS', test: (p) => p === '//' },
];
const GROUPS = BLOCKS.map((b) => {
  // curated order where the block has one (build order, not alphabet); unknowns fall to the end
  const rank = (v) => (b.order?.indexOf(v) ?? -1) < 0 ? Number.MAX_SAFE_INTEGER : b.order.indexOf(v);
  const members = Object.keys(CELLS).filter(b.test)
    .sort((a, c) => rank(a) - rank(c) || a.localeCompare(c));
  return [b.label(members.length), members];
});
{
  const placed = GROUPS.flatMap(([, m]) => m);
  const miss = Object.keys(CELLS).filter((p) => !placed.includes(p));
  if (miss.length) throw new Error(`sheet 12: no row block accepts ${miss.join(', ')}`);
}
const PKGS = Object.keys(CELLS).filter((p) => p !== '//').length; // fanned packages, root excluded

// ci:main overlay — the names ci:pull_request does not carry.
const OCOLS = ['ci:main', 'test:engines', 'test:matrix', 'check:pack'];
{
  const extra = MAIN.names.map((n) => n.name).filter((n) => !NAMES.has(n));
  const miss = extra.filter((n) => !OCOLS.includes(n));
  if (miss.length) throw new Error(`sheet 12: ci:main adds task names with no overlay column — ${miss.join(', ')}`);
  for (const n of OCOLS) if (!extra.includes(n)) throw new Error(`sheet 12: overlay column ${n} is not in the ci:main graph any more`);
}
const OPRESENT = Object.fromEntries(OCOLS.map((n) => [n, new Set(Object.keys(MAIN.cells).filter((p) => MAIN.cells[p][n]))]));
const OREAL = Object.fromEntries(OCOLS.map((n) => [n, new Set(Object.keys(MAIN.cells).filter((p) => MAIN.cells[p][n] === 'r'))]));
const ODN = MAIN.nodes - CI.nodes;                                   // nodes the overlay adds
const ODR = OCOLS.reduce((s, n) => s + OREAL[n].size, 0);            // …of which command-bearing
const OPCT = Math.round((ODN / CI.nodes) * 100);

// the ragged tail: one node, one package, no fan
const TAIL = CI.names
  .filter((n) => n.nodes === 1)
  .map((n) => {
    const owner = Object.keys(CELLS).find((p) => CELLS[p][n.name]);
    if (!owner) throw new Error(`sheet 12: singleton task ${n.name} has no owning package in the plate`);
    return [`${owner}#${n.name}`, n.real];
  })
  .sort((a, b) => a[0].localeCompare(b[0]));
const TAIL_ROOT = TAIL.filter(([id]) => id.startsWith('//#')).length;

// the deepest chain in the ci graph — hand-traced path; its length and every
// rung's fill are checked against the plate.
const CHAIN = [
  '@tools/warn-lanes#build:types',
  '@tools/build_and_test#build:types', '@tools/bundle-probe#build:types',
  'ui-router-server#build:types', 'sample-app-routes#build:types',
  'sample-app-routes#build', 'sample-app-shared#build',
  'sample-app-lit-mobx#build', 'docs#build',
  'sample-app-lit-e2e#build', 'sample-app-lit-e2e#test',
  'sample-app-lit-e2e#ci:pull_request', 'sample-app-lit-e2e#ci',
].map((id) => {
  const [pkg, task] = [id.slice(0, id.indexOf('#')), id.slice(id.indexOf('#') + 1)];
  const k = cell(pkg, task);
  if (!k) throw new Error(`sheet 12: chain node ${id} is not in the ci graph in diagrams/data/census-plate.json`);
  return [id, k === 'r' ? 1 : 0];
});
if (CHAIN.length !== CI.chain) throw new Error(`sheet 12: traced chain is ${CHAIN.length} deep, the plate says ${CI.chain} — retrace it`);
const CHAIN_REAL = CHAIN.filter(([, r]) => r).length;

// the only uncacheable task definitions in the repo — none reachable from ci,
// so the plate cannot supply them (its cacheFalse is empty by construction)
const UNCACHED = [
  ['codecov:bundle', 'reports to a third party'],
  ['format', 'WRITER — rewrites its own inputs'],
  ['//#format:root', 'WRITER'],
  ['//#format:toml', 'WRITER — taplo'],
  ['dev', 'persistent server'],
  ['docs', 'persistent server'],
  ['e2e', 'persistent server'],
  ['docs#docs:preview', 'persistent server'],
  ['docs#wrangler:dev', 'persistent server'],
  ['docs#docs', 'persistent server'],
  ['release#resolve:published', 'reads the LIVE registry'],
  ['workers-builds#check', 'reads the LIVE deploy API'],
];

const LEDGER = [
  ['ci', `the PR gate — ${PKGS} packages × ${COLS.length} fanned names`],
  ['ci:main', `+${ODN} nodes over ${OCOLS.length} names; PR graph folded in`],
  ['build', 'the emit tier alone — four fifths placeholder'],
  ['lint', `the densest real graph here — ${100 - phantomPct(pipe('lint'))}% real`],
  ['pack:all', `one real task atop a ${pipe('pack:all').nodes}-node cone`],
];

// ---------------------------------------------------------------------------
// GEOMETRY
// ---------------------------------------------------------------------------
const LX = 252;              // right edge of the row-label gutter
const CX0 = 268, CP = 23;    // first column centre, column pitch
const RP = 16;               // row pitch
const CW = 15, CH = 10;      // card-hole size
const RX = 810;              // right annotation column
const cx = (i) => CX0 + i * CP;
const OX0 = cx(COLS.length - 1) + 32; // overlay first column centre, clear of the plate
const ox = (j) => OX0 + j * CP;

const MTOP = 300;
const rows = [];             // [name, y, groupIdx, headerY]
{
  let y = MTOP;
  GROUPS.forEach(([, rs], gi) => {
    y += 16;                 // section header sits on this line
    const hy = y;
    rs.forEach((n) => { y += RP; rows.push([n, y, gi, hy]); });
    y += 10;                 // air between groups
  });
}
const HDRS = GROUPS.map(([label], gi) => [label, rows.find((r) => r[2] === gi)[3]]);
const MBOT = rows[rows.length - 1][1] + 10;
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
const hrules = rows.map(([, y]) => `<line x1="${CX0 - 12}" y1="${y}" x2="${cx(COLS.length - 1) + 12}" y2="${y}" ${RULE}/>`).join('\n');

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
const body = rows.map(([name, y, gi]) => {
  const label = txt(LX, y + 3.5, name, 'lbls', 'end', gi === 0 ? 'fill="var(--accent)"' : '');
  const cells = COLS.map((c, i) => {
    const k = cell(name, c);
    if (!k) return '';
    return hole(cx(i), y, k === 'r' ? 'R' : ALLP.has(c) ? 'x' : 'p');
  }).join('');
  const over = OCOLS.map((n, j) => {
    if (!OPRESENT[n].has(name)) return '';
    return hole(ox(j), y, OREAL[n].has(name) ? 'g' : 'h');
  }).join('');
  return label + cells + over;
}).join('\n');

const sectionHdrs = HDRS.map(([label, y]) => txt(30, y + 3.5, label, 'lblf')).join('\n');

// --- per-column tallies under the plate
const tallies = COLS.map((c, i) => {
  const { nodes, real } = nm(c);
  return txt(cx(i), TOTY, String(real), real === 0 ? 'lblr' : 'lbls', 'middle')
    + txt(cx(i), TOTY + 13, String(nodes), 'lblf', 'middle');
}).join('\n');

// --- ci:main overlay frame
const oFrame = `<rect x="${OX0 - 16}" y="${MTOP + 4}" width="${CP * (OCOLS.length - 1) + 32}" height="${MBOT - MTOP - 4}" class="ska fnone" stroke-dasharray="5 4" opacity="0.75"/>
${OCOLS.map((n, j) => txt(ox(j) + 3.5, 288, n, 'lbla', 'start', `transform="rotate(-90 ${ox(j) + 3.5} 288)"`)).join('\n')}
${txt(OX0 - 16, 162, 'ci:main OVERLAY', 'lbla')}
${txt(OX0 - 16, TOTY, `+${ODN} nodes · ${OCOLS.length} names · +${ODR} real`, 'lbla')}`;

// --- right column: the phantom share, the deepest chain, the uncacheable tier
const stat = `${txt(RX, 206, 'THE PHANTOM SHARE', 'lblt')}
${lines(RX, 226, [
  `${CI.nodes} nodes in the PR graph.`,
  `${CI.nodes - CI.real} of them run nothing at all:`,
  'command "<NONEXISTENT>", a stub',
  'turbo mints so a ^self chain has',
  'somewhere to land an edge.',
], 'lbls', 'start', 13)}
${txt(RX, 300, `${phantomPct(CI)}% PLACEHOLDER`, 'lblr')}`;

const CLY = 352;
const CN = CHAIN.length - 1;
const ladder = `${txt(RX, CLY - 22, `DEEPEST CHAIN IN THE GRAPH — ${CHAIN.length} DEEP`, 'lbls')}
<line x1="${RX + 8}" y1="${CLY}" x2="${RX + 8}" y2="${CLY + CN * 22}" class="sks" opacity="0.6"/>
${CHAIN.map(([n, r], i) => {
    const y = CLY + i * 22;
    return hole(RX + 8, y, r ? 'R' : 'p') + txt(RX + 26, y + 3.5, n, r ? 'lbl' : 'lbls');
  }).join('\n')}
${lines(RX, CLY + CN * 22 + 26, [
  `${CHAIN_REAL} of those ${CHAIN.length} run a command.`,
  `The longest all-real chain is ${CI.realChain}`,
  `— and it is ${CI.realChain} «test» tasks in a`,
  'row, ordered by ^test alone. Nothing',
  'in it consumes anything above it.',
], 'lbls', 'start', 13)}`;

// clears the plate's own tally row: the right column and the plate both grew
const UY = Math.max(CLY + CN * 22 + 118, TOTY + 40);
const uncached = `${txt(RX, UY, 'THE UNCACHEABLE TWELVE', 'lbls')}
${txt(RX, UY + 14, 'every cache:false definition in the repo — 7 at', 'lblf')}
${txt(RX, UY + 25, 'root, 5 in member files (@tools/ scope elided)', 'lblf')}
${txt(RX, UY + 36, 'none of them reachable from ci', 'lblf')}
${UNCACHED.map(([n, why], i) => {
    const y = UY + 57 + i * 17;
    return hole(RX + 8, y, 'c') + txt(RX + 26, y + 3.5, n, 'lbls') + txt(RX + 26 + 162, y + 3.5, why, 'lblf');
  }).join('\n')}`;

// --- the ragged tail, below the plate
const TY = MBOT + 90;
const half = Math.ceil(TAIL.length / 2);
const tail = `${txt(30, TY, `THE RAGGED TAIL — ${TAIL.length} SINGLETON TASKS, ONE NODE EACH, NO FAN`, 'lbls')}
${txt(30, TY + 14, `${TAIL_ROOT} of them belong to the root package «//», which appears in no fanned column at all`, 'lblf')}
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
${LEDGER.map(([n, note], i) => {
    const y = SY + 68 + i * 19;
    const p = pipe(n);
    return [n, String(p.nodes), String(p.real), `${phantomPct(p)}%`, String(p.edges), String(p.realEdges), `${p.chain} / ${p.realChain}`]
      .map((v, k) => txt(colx[k], y, v, k === 0 ? 'lbl' : k === 3 ? 'lblr' : 'lbls')).join('')
      + txt(830, y, note, 'lblf');
  }).join('\n')}
${txt(46, SY + SH - 16, 'No duration is encoded anywhere on this plate: CI wall-clock comparisons in this repo are confounded by cache state and task counts.', 'lblf')}`;

const H = SY + SH + 30;

const svg = `<svg viewBox="0 78 1160 ${H - 78}" role="img" aria-label="A punchcard register plate of the pull-request CI task graph. Rows are the ${PKGS} workspace packages plus the root, grouped into publishable packages, sample apps, docs and examples, tools, and root. Columns are the ${COLS.length} task names that fan across packages, ordered by pipeline stage: gather, emit, check, prove, roll-up. A filled accent card-hole marks a command-bearing task node; a faintly hatched hole marks a placeholder node that runs nothing; a red crossed hole marks the ${ALLP.size} task names that are one hundred percent placeholder by design — ${[...ALLP].join(', ')}. Of ${CI.nodes} nodes only ${CI.real} run a command and only ${CI.realEdges} of ${CI.edges} dependency edges connect two real tasks. A ghosted ${OCOLS.length}-column overlay to the right shows the ${ODN} extra nodes the ci:main pipeline adds. Beside the plate, the deepest chain in the graph is drawn as a ${CHAIN.length}-rung ladder of which ${CHAIN_REAL} rungs are real, and the ${UNCACHED.length} uncacheable task definitions in the repository are listed as a tier that never appears in this graph. Below, ${TAIL.length} singleton tasks form a ragged tail, and a structure schedule totals ${LEDGER.length} pipelines.">
${defs(P)}
<defs><pattern id="${P}-hp" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
  <line x1="0" y1="0" x2="0" y2="4" stroke="var(--ink-faint)" stroke-width="0.9" opacity="0.75"/>
</pattern></defs>

${txt(30, 106, 'THE PR CI TASK GRAPH, PUNCHED', 'lblt')}
${txt(30, 122, `one card-hole per (package, task) node turbo puts in the graph · ${TURBO} · --dry=json`, 'lbls')}
${txt(1130, 106, `${CI.nodes} NODES · ${CI.real} RUN A COMMAND`, 'lblb', 'end')}
${txt(1130, 122, `${fmt(CI.edges)} EDGES · ${CI.realEdges} JOIN TWO REAL TASKS`, 'lbls', 'end')}

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

${txt(30, 206, `${WORD[ALLP.size] ?? ALLP.size} COLUMNS RUN NOTHING`, 'lblr')}
${lines(30, 222, [
  [...ALLP].join(' · '),
  'have no implementation in any of',
  `the ${PKGS} packages. They exist only`,
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
  num: 12, id: 'graph', rev: 'D',
  title: 'THE REGISTER PLATE',
  sub: `ALTITUDE 3¼ — the monorepo as its CI reads it · every task node punched · ${TURBO} · REV B: census refresh 2026-08-31 — three new members, three new rows, the phantom share held · REV C: every number now imported from diagrams/data/census-plate.json — the fifth publishable package joined the register and the graph grew to 590 nodes / 176 real · REV D: whole-cabinet refresh — ${CI.nodes} nodes / ${CI.real} real, and real→real edges down a quarter to ${CI.realEdges} · ${BASIS}`,
  scale: 'PR CI GRAPH',
  form: 'REGISTER PLATE',
  svg,
  caption: `The pull-request graph is a near-rectangle: ${PKGS} packages against ${COLS.length} fanned task names, plus a ragged tail of ${TAIL.length} one-offs. ${phantomPct(CI)}% of the holes are unpunched — placeholder nodes that run nothing, minted so a ^self chain has somewhere to land an edge.`,
  notes: `
<p><strong>Method.</strong> <code>turbo run ci --dry=json</code> and <code>turbo run ci:main --dry=json</code> against a materialized, installed archive of the ref — ${BASIS} — and the same for <code>build</code>, <code>lint</code> and <code>pack:all</code> in the schedule. Every number on the plate is read from <code>diagrams/data/census-plate.json</code>, the checked-in snapshot <code>census-plate.mjs</code> writes; this sheet holds placement and prose only. A node is one <code>(package, task)</code> pair turbo placed in the graph. A node is <em>command-bearing</em> when its resolved command is not the literal <code>&lt;NONEXISTENT&gt;</code> — turbo's marker for a task it had to invent because something depends on it in that package. An edge is <em>real</em> only when both of its ends are. No duration is drawn anywhere: wall-clock comparisons here are confounded by cache state and by the task counts themselves, so this plate measures shape and nothing else.</p>
<p><strong>Why an inventory and not a city.</strong> Sheet 3 argues that a task manager is not a place; drawing this graph in isometric would smuggle back the geography that sheet's note denies. What a CI graph actually is, is a register: a fixed set of names crossed against a fixed set of packages, with most of the intersections empty. The honest form is the plate that shape already implies — a punchcard, read by column.</p>
<p><strong>The finding.</strong> ${CI.nodes} nodes; ${CI.real} run a command. ${fmt(CI.edges)} dependency edges; ${CI.realEdges} join two real tasks. Of the ${COLS.length} fanned names, ${SELF.size} carry a <code>^self</code> chain — <code>build</code>, <code>build:types</code>, <code>test</code>, <code>test:coverage</code>, <code>transit</code> — and a self-chain is what mints placeholders: turbo needs a node in <em>every</em> package to hang the chain on, whether or not that package has such a script. ${ALLP.size} names are 100% placeholder in all ${PKGS} packages: <code>transit</code> (which has no implementation anywhere in the repo — it exists purely as an edge), and the two roll-ups <code>ci:pull_request</code> and <code>ci</code>. The plate's rightmost columns and its leftmost are, in the strictest sense, empty.</p>
<p><strong>Depth is mostly scaffolding too.</strong> The deepest chain is ${CI.chain} nodes and ${CHAIN_REAL} of them run anything. The longest chain of consecutive real nodes is ${CI.realChain} — and it is ${CI.realChain} <code>test</code> tasks in a row, serialized by <code>^test</code> and nothing else: no task in that chain consumes an artifact from the one above it. That is the price of a self-chain used for ordering rather than for data flow, and it is what a plate makes visible that a node-and-arrow render never does.</p>
<p><strong>What the plate is not evidence for.</strong> Placeholders are cheap — turbo schedules and skips them, and the phantom share is not a runtime cost. The argument is about legibility: ${phantomPct(CI)}% of what a maintainer sees in <code>--graph</code> output is scaffolding, and the two ratios worth watching are the real-node share per column and the real-edge count. Note also the one tier that never appears here at all: the repo's ${UNCACHED.length} <code>cache:false</code> definitions — four writers, six persistent servers and two live-network readers — are all outside every <code>ci:*</code> graph by design. A cache hit on any of them would be wrong, and the gate depends on their read-only twins instead (<code>format:check</code> for <code>format</code>).</p>
<p><strong>The overlay.</strong> <code>ci:main</code> is not a different pipeline; it swallows <code>ci:pull_request</code> whole and adds ${ODN} nodes across ${OCOLS.length} names — <code>ci:main</code>, <code>test:engines</code>, <code>test:matrix</code>, <code>check:pack</code> — of which ${ODR} are command-bearing. The main-branch graph is ${OPCT}% larger and buys three engine tests, one d.ts back-test and one pack check.</p>
<p><strong>Rev B — census refresh, 2026-08-31.</strong> Two weeks and one release (<code>lit-ui-router@1.10.0</code>) after the first printing, the plate was re-punched from a fresh <code>--dry=json</code>. Three rows joined the tools block — <code>@tools/eslint-ts-parser</code>, <code>@tools/lint-elements</code> and <code>@tools/warn-lanes</code> (#639) — taking the register from 27 packages to 30 and the graph from 483 nodes / 154 real to 535 / 165; edges 1,280 → 1,375, real edges 116 → 117. The <em>shape</em> is what held: the phantom share moved only 68% → 69%, the eighteen fanned names are the same eighteen, and all three new rows punch the same sparse pattern every small instrument does: <code>typecheck</code>, <code>lint</code>, <code>format:check</code> — three holes of eighteen — plus <code>test</code> for <code>@tools/warn-lanes</code>, which is the only one of the three with a suite. That is the plate's own thesis holding under a new measurement: a new member adds eighteen stations to the register and punches three or four of them. Elsewhere: the ragged tail gained <code>//#lint:elements</code> (25 → 26 singletons, fifteen of them root); the deepest chain grew a rung to thirteen — still five real — because <code>@tools/warn-lanes#build:types</code> now sits above <code>build_and_test</code>; the longest all-real chain shortened from seven <code>test</code> tasks to six; and the uncacheable tier was recounted across all seventeen <code>turbo.json</code> files rather than the root alone, which is twelve definitions, not seven. Still none of them reachable from <code>ci</code>.</p>
<p><strong>Rev C — off the plate.</strong> The hand-pasted constants are gone: rows, columns, cells, tallies, the overlay and the schedule are all read from <code>diagrams/data/census-plate.json</code> at draw time, and the sheet throws rather than draws if a pipeline or a fanned name it needs is missing. Re-surveyed at origin/main @ 35c6766, the graph had grown again: <code>packages/eslint-plugin-lit-ui-router</code> is the fifth publishable package, taking the register from 30 fanned rows to 31 and the graph from 535 nodes / 165 real to 590 / 176; edges 1,375 → 1,504, real edges 117 → 126, phantom share 69% → 70%. There was also a 19th fanned column — <code>check:dev-split</code>, the dev-warning split guard, command-bearing in 1 package and a placeholder in the other 30 — which is the same story the eighteen told, one column wider. The ragged tail took the new package's three singletons (<code>lint:docs</code>, <code>lint:rules</code>, <code>test:oxlint</code>) and stood at 29; the deepest chain was 13 rungs with 5 real, and the longest all-real chain went back up to 7 <code>test</code> tasks — a new publishable package with a suite is exactly the sort of member that lengthens it.</p>
<p><strong>Rev D — the whole cabinet, one ref, and the first recount that shrank.</strong> Every plate in <code>diagrams/data/</code> was re-counted at ${PLATE.ref} @ ${PLATE.sha} in one pass. The register keeps its shape — ${PKGS} fanned rows, ${COLS.length} fanned columns, ${CI.chain} rungs at the deepest and ${CI.realChain} at the longest all-real — but the punched inventory did not simply grow: nodes ${CI.nodes} against rev C's 590 and edges ${fmt(CI.edges)} against 1,504, real tasks up one to ${CI.real}, the ragged tail up one to ${TAIL.length} as the root swapped one guard for two, and the phantom share easing from 70.2% to 69.8%. Two root singletons changed hands — <code>//#check:docs-api-deps</code> left, <code>//#check:graph-edges</code> and <code>//#check:task-inputs</code> arrived with #693 — and <code>apps/sample-app-shared</code> gave up its own <code>turbo.json</code> when #696 restored <code>turbo run e2e</code>. The figure that actually moved is real→real: ${CI.realEdges} against rev C's 126, down a quarter on a graph the same size. That is #693's doing, and it is this plate's own thesis arriving from the other side. The <code>docs:api</code> column stood in nine packages and was command-bearing in four; the other five holes existed because <code>docs#build</code> reached its producers through <code>^docs:api</code>, and <code>^</code> walks direct dependencies, so <code>docs</code> carried devDependencies it never imports to make the walk land. #693 names the four producers instead — <code>lit-ui-router#docs:api</code> and its three siblings — and the column collapses to ${nm('docs:api').nodes} holes, every one of them punched. Scaffolding came out of the graph and the real work stayed. Two thirds of the holes still run nothing.</p>`,
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

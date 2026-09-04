// SHEET 12i — THE REGISTER, WALKED: sheet 12's punchcard with a pointer in it.
//
// Every figure on this page is imported from diagrams/data/census-plate.json,
// the same plate sheet 12 draws — this file holds the frame, the prose and the
// title block; generator/register-graph.mjs holds the lane and its layout.
import { readFileSync } from 'node:fs';
import { PROJECT, TOTAL, titleBlock } from './chrome.mjs';
import { keyRow } from './helpers.mjs';
import { REGISTER as R, registerLane } from './register-graph.mjs';

const PLATE = JSON.parse(readFileSync(new URL('../data/census-plate.json', import.meta.url), 'utf8'));
const BASIS = `surveyed at ${PLATE.ref} @ ${PLATE.sha} (commit ${PLATE.commitDate.slice(0, 10)}) · ${R.turbo}`;
const fmt = R.fmt;
const PCT = R.phantomPct.toFixed(1);
const SHROUD_N = R.nodes - R.real;
const SHROUD_E = R.edges - R.realEdges;
const WORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

const KEY = [
  keyRow('<rect x="10" y="2" width="28" height="14" fill="none" stroke="var(--ink)" stroke-width="1.6"/>'
    + '<rect x="20" y="9" width="8" height="7" fill="var(--accent)" stroke="var(--ink)" stroke-width="1"/>',
    'a task that runs a command — walled, roofed, lit'),
  keyRow('<rect x="10" y="2" width="28" height="14" fill="none" stroke="var(--ink-faint)" stroke-width="1.6" stroke-dasharray="3 3"/>'
    + '<line x1="24" y1="2" x2="24" y2="16" stroke="var(--ink-faint)" stroke-width="1" stroke-dasharray="3 3"/>',
    'a phantom — surveyed, never built'),
  keyRow('<line x1="4" y1="9" x2="44" y2="9" stroke="var(--ink-soft)" stroke-width="1.6"/>',
    `real→real edge — ${R.realEdges} of ${fmt(R.edges)}`),
  keyRow('<line x1="4" y1="9" x2="44" y2="9" stroke="var(--ink-faint)" stroke-width="1" stroke-dasharray="3 3"/>',
    'an edge with one end in the shroud'),
  keyRow('<text x="4" y="13" class="lblr" font-size="9.5">column</text>',
    `a red column head — 100% phantom (${R.allPhantomCols.join(', ')})`),
].join('\n');

const NOTES = `
<p><strong>Method — what is drawn, and from where.</strong> Everything on this page comes out of
<code>diagrams/data/census-plate.json</code>, the checked-in plate <code>generator/census-plate.mjs</code>
writes from <code>turbo run ${R.pipeline} --dry=json</code> against a materialized, <em>installed</em> archive of
the ref — ${BASIS}. Sheet 12 reads that plate's cell codes and tallies; this sheet reads the two fields the
plate gained for it, <code>graphNodes</code> and <code>graphEdges</code>: one <code>(package, task)</code> pair
per line, sorted by task id, and one <code>[dependency, dependent]</code> index pair per line into that array.
The whole graph is carried — all ${fmt(R.nodes)} nodes and all ${fmt(R.edges)} edges, unaggregated — and it is
embedded in this page verbatim, so what the pointer walks is the measurement itself and not a summary of it.
The lane cross-checks the two readings at build time and <em>throws</em> rather than drawing if the node list
and the tally disagree about how many nodes, real nodes, edges or real edges there are.</p>
<p><strong>The shroud, defined.</strong> A node is <em>real</em> — command-bearing — when turbo resolved it to
an actual command. A <em>phantom</em> is a node whose command is the literal <code>&lt;NONEXISTENT&gt;</code>:
a placeholder turbo mints so that a <code>^task</code> chain has something in that package to hang an edge on.
The default view here is the real subgraph alone — ${R.real} nodes and the ${R.realEdges} edges that join two of
them. <code>PHANTOM SHROUD</code> floods in the other ${SHROUD_N} nodes and ${fmt(SHROUD_E)} edges, faint, and
that flood <em>is</em> the ${PCT}% figure sheet 12 prints: the share of this graph a maintainer reads in
<code>--graph</code> output that runs nothing at all. Untick it and the real subgraph comes back exactly as it
was — the shroud is a visibility swap over one fixed layout, never a re-layout.</p>
<p><strong>Layout — ranked from the edges, computed at build time.</strong> Rows are the ${R.pkgs} packages in
sheet 12's own block order (publishable, apps, docs and examples, tools, root), so the two plates read the same
way down the page. Columns are the ${R.cols} task names, and their order is not editorial: each column is
ranked by the longest dependency depth any of its nodes reaches, which sorts the graph into its real stages —
gather, emit, check, prove, roll-up — out of the edge list rather than out of a hand-written list. Positions are
computed here and drawn with cytoscape <code>preset</code>: no physics, so the picture is identical on every
load and a node is always in the same place when you come back to it. ${WORD[R.allPhantomCols.length] ?? R.allPhantomCols.length}
column heads are drawn in red because not one node in them runs anything at all:
<code>${R.allPhantomCols.join('</code>, <code>')}</code> — and in the default view those columns are not drawn,
because there is nothing real in them to draw.</p>
<p><strong>Sprites.</strong> Two skins, authored to the house recipe — the girding frame drawn first and a
semi-opaque wall washed over it, so the frame reads through and the themed node body tints the building. A real
task is a works shed with a lit door. A phantom is the plot without the building: a dashed frame, no wall, no
roof — it cannot be mistaken for work at any zoom. Both palettes are baked at build time and swapped with the
page's theme, the survey office's pattern exactly.</p>
<p><strong>What this shows that the plate cannot.</strong> Sheet 12 proves the phantom share as a ratio; here it
is a shape. With the shroud off, the ${R.real} real tasks fall into a handful of dense columns and the
${R.realEdges} real edges are sparse enough to trace one by one — the deepest all-real run is ${R.realChain}
<code>test</code> tasks, serialized by <code>^test</code> and consuming nothing from each other. With the shroud
on, the same picture disappears into ${fmt(R.nodes)} nodes and ${fmt(R.edges)} edges of scaffolding. Hover any
building for its package, its task, whether it runs, whether a cache hit would be wrong (${R.cacheFalse} nodes in
this graph are <code>cache:false</code> — the repo's uncacheable tier is outside every <code>ci:*</code> graph by
design, which is sheet 12's finding, here as an empty field), its in and out degree in both readings, and the
full list of what it waits on.</p>
<p><strong>What is editorial.</strong> The row blocks and their order; the pitch, the sprite drawing and the
colours; this prose. The nodes, the edges, the column ranking, every count and every name are the plate's.</p>`;

export const sheet12i = {
  num: '12i',
  id: 'register-interactive',
  rev: 'A',
  title: 'THE REGISTER, WALKED',
  scale: 'PR CI GRAPH',
  form: 'INTERACTIVE REGISTER',
  sub: `ALTITUDE 3¼ — sheet 12's plate, live under the pointer · the whole ${R.pipeline} graph carried node by node · ${fmt(R.nodes)} NODES · ${R.real} RUN A COMMAND · ${fmt(R.edges)} EDGES · ${R.realEdges} JOIN TWO REAL TASKS · ${BASIS}`,
  caption: `The punchcard, stood up. Default view is the real subgraph alone — ${R.real} tasks that run a command over ${R.realEdges} edges that join two of them. PHANTOM SHROUD floods in the other ${SHROUD_N} nodes and ${fmt(SHROUD_E)} edges, and ${PCT}% of the graph stops being a statistic.`,
  notes: NOTES,
  key: KEY,
};

export function register12iSection() {
  return `<section class="sheet rg" id="sheet-${sheet12i.num}" aria-label="Sheet ${sheet12i.num}: ${sheet12i.title}">
  <div class="sheet-head"><span class="proj">${PROJECT} — INTERACTIVE PLATE</span><span class="shno">SHEET ${sheet12i.num} / ${TOTAL}</span></div>
  <h2 class="sheet-title">${sheet12i.title}</h2>
  <p class="sheet-sub">${sheet12i.sub}</p>
  ${registerLane()}
  <figure><figcaption>${sheet12i.caption}</figcaption></figure>
  <div class="notes-grid">
    <div class="notes">
      <h3>GENERAL NOTES</h3>
      ${sheet12i.notes}
    </div>
    <div class="keyblock">
      <h3>KEY</h3>
      <table>${sheet12i.key}</table>
      ${titleBlock(sheet12i)}
    </div>
  </div>
</section>`;
}

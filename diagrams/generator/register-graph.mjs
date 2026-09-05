// SHEET 12i — THE REGISTER, INTERACTIVE: sheet 12's punchcard, stood up and
// walkable.  The data model is diagrams/data/census-plate.json's own
// `graphNodes` / `graphEdges` — the complete `ci` task graph as turbo emitted
// it, one (package, task) node per line and one [dependency, dependent] index
// pair per edge, nothing aggregated — shipped to the page VERBATIM as a JSON
// island.  Layout is computed here, not in the browser: columns are task names
// ranked by their longest dependency depth, rows are packages in sheet 12's own
// block order, and cytoscape draws the result with `preset` — no physics, so
// the picture is identical on every load.
//
// The hero interaction is the PHANTOM SHROUD.  The default view is the REAL
// subgraph alone: the tasks that run a command and the edges that join two of
// them.  Tick the box and the placeholders flood in faint — the 70% of this
// graph that runs nothing, drawn rather than asserted.
import { readFileSync } from 'node:fs';
import { PALETTES } from './sprites.mjs';
import { CYTOSCAPE_URL } from './pipeline-graph.mjs';

export const REV = 'A';

const PLATE = JSON.parse(readFileSync(new URL('../data/census-plate.json', import.meta.url), 'utf8'));

const PIPE = PLATE.graph;
if (!PIPE) throw new Error('register-graph: diagrams/data/census-plate.json carries no `graph` field — re-run generator/census-plate.mjs');
const CI = PLATE.pipelines?.[PIPE];
if (!CI) throw new Error(`register-graph: pipeline ${PIPE} is missing from diagrams/data/census-plate.json`);
const NODES = PLATE.graphNodes;
const EDGES = PLATE.graphEdges;

// The plate must agree with itself: the walked graph and the counted one are
// two readings of the same dry-run, and a mismatch means a half-refreshed plate.
const REAL_N = NODES.filter((n) => n.real).length;
const REAL_E = EDGES.filter(([a, b]) => NODES[a].real && NODES[b].real).length;
for (const [what, got, want] of [
  ['nodes', NODES.length, CI.nodes], ['real nodes', REAL_N, CI.real],
  ['edges', EDGES.length, CI.edges], ['real edges', REAL_E, CI.realEdges],
]) {
  if (got !== want) throw new Error(`register-graph: the ${PIPE} node/edge list has ${got} ${what}, the ${PIPE} tally says ${want} — re-run generator/census-plate.mjs`);
}

const TURBO = PLATE.wasAssociatedWith?.find((a) => a.startsWith('turbo '));
if (!TURBO) throw new Error('register-graph: diagrams/data/census-plate.json carries no turbo version in wasAssociatedWith');

const fmt = (v) => v.toLocaleString('en-US');
const PHANTOM_PCT = ((NODES.length - REAL_N) / NODES.length) * 100;

// ---- adjacency + depth ----------------------------------------------------
const deps = NODES.map(() => []);
for (const [a, b] of EDGES) deps[b].push(a);

const depth = new Array(NODES.length).fill(-1);
const depthOf = (i) => {
  if (depth[i] >= 0) return depth[i];
  depth[i] = 0;                                   // cycle guard, as in the probe
  let best = 0;
  for (const d of deps[i]) best = Math.max(best, depthOf(d) + 1);
  depth[i] = best;
  return best;
};
NODES.forEach((_, i) => depthOf(i));

// ---- columns: one per task name, ranked by how deep the graph carries it ---
const COLMAP = new Map();
NODES.forEach((n, i) => {
  const c = COLMAP.get(n.task) ?? { name: n.task, rank: 0, nodes: 0, real: 0 };
  c.rank = Math.max(c.rank, depth[i]);
  c.nodes += 1;
  if (n.real) c.real += 1;
  COLMAP.set(n.task, c);
});
const COLS = [...COLMAP.values()].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
const colIndex = new Map(COLS.map((c, i) => [c.name, i]));

// ---- rows: sheet 12's own block rule, so the two plates read the same way --
const APP_ORDER = ['sample-app-shared', 'sample-app-routes', 'sample-app-lit-vanilla', 'sample-app-lit-mobx', 'sample-app-lit-e2e'];
const BLOCKS = [
  { label: 'PACKAGES/ — PUBLISHABLE', test: (p) => !p.startsWith('@tools/') && !p.startsWith('sample-app-') && p !== 'docs' && p !== 'examples' && p !== '//' },
  { label: 'APPS/ — SAMPLE + E2E', test: (p) => p.startsWith('sample-app-'), order: APP_ORDER },
  { label: 'DOCS + EXAMPLES', test: (p) => p === 'docs' || p === 'examples' },
  { label: 'TOOLS/ — INSTRUMENTS', test: (p) => p.startsWith('@tools/') },
  { label: 'ROOT //', test: (p) => p === '//' },
];
const PKGS = [...new Set(NODES.map((n) => n.pkg))];
const GROUPS = BLOCKS.map((b) => {
  const rank = (v) => ((b.order?.indexOf(v) ?? -1) < 0 ? Number.MAX_SAFE_INTEGER : b.order.indexOf(v));
  return { label: b.label, members: PKGS.filter(b.test).sort((a, c) => rank(a) - rank(c) || a.localeCompare(c)) };
}).filter((g) => g.members.length);
{
  const placed = GROUPS.flatMap((g) => g.members);
  const miss = PKGS.filter((p) => !placed.includes(p));
  if (miss.length) throw new Error(`register-graph: no row block accepts ${miss.join(', ')}`);
}

// ---- geometry -------------------------------------------------------------
const CP = 36;               // column pitch
const RP = 30;               // row pitch
const GAP = 22;              // air between row blocks
const NODE = 23;
const X0 = 0;
const HEADER_Y = -78;        // task names, rotated to read upward
const rowY = new Map();
const BANDS = [];
{
  let y = 0;
  for (const g of GROUPS) {
    BANDS.push({ label: `${g.label} ×${g.members.length}`, y: y - 15 });
    for (const p of g.members) { rowY.set(p, y); y += RP; }
    y += GAP;
  }
}
const xOf = (n) => X0 + colIndex.get(n.task) * CP;
const XY = NODES.flatMap((n) => [xOf(n), rowY.get(n.pkg)]);
const WIDTH = (COLS.length - 1) * CP;
const BOTTOM = Math.max(...rowY.values());

const LAYOUT = {
  xy: XY,
  node: NODE,
  cols: COLS.map((c, i) => ({ name: c.name, x: X0 + i * CP, y: HEADER_Y, real: c.real, nodes: c.nodes })),
  rows: [...rowY].map(([pkg, y]) => ({ pkg, y, x: X0 - 26, real: NODES.filter((n) => n.pkg === pkg && n.real).length })),
  bands: BANDS.map((b) => ({ ...b, x: X0 - 26 })),
  foot: { x: X0 + WIDTH / 2, y: BOTTOM + 54 },
};

// ---- sprite skins ---------------------------------------------------------
// The house recipe (INITIATIVES.md sprite note, and generator/sprites.mjs):
// the girding frame is drawn FIRST and a semi-opaque wall washed over it, so
// the frame reads through and the themed node body tints the building.  The
// palettes are sprites.mjs's own — one ink, imported, never restated.

function skins(p) {
  const line = (x1, y1, x2, y2, stroke, w = 1, dash = '') =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const rect = (x, y, w, h, fill, stroke = 'none', sw = 1.4, dash = '') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const girder = (x, y, w, h, cols, rows) => {
    let s = '';
    for (let i = 1; i < cols; i += 1) s += line(x + (w * i) / cols, y, x + (w * i) / cols, y + h, p.soft, 1.1);
    for (let j = 1; j < rows; j += 1) s += line(x, y + (h * j) / rows, x + w, y + (h * j) / rows, p.soft, 1.1);
    return s;
  };
  const shell = (x, y, w, h, c, r) =>
    girder(x, y, w, h, c, r) + rect(x, y, w, h, p.wall) + rect(x, y, w, h, 'none', p.ink, 2);

  return {
    // a task that runs a command: a works shed, girded, walled, roofed, lit
    'task-real': shell(9, 17, 30, 24, 3, 2)
      + `<polygon points="6,17 24,6 42,17" fill="${p.roof}" stroke="${p.ink}" stroke-width="2" stroke-linejoin="round"/>`
      + rect(20, 29, 8, 12, p.accent, p.ink, 1.6)
      + line(6, 42.5, 42, 42.5, p.faint, 1.6),
    // a placeholder: the plot is surveyed and nothing was ever built on it —
    // frame only, no wall, so it can never be mistaken for work
    'task-phantom': rect(9, 17, 30, 24, 'none', p.faint, 1.8, '3 3')
      + line(9, 29, 39, 29, p.faint, 1.2, '3 3')
      + line(24, 17, 24, 41, p.faint, 1.2, '3 3')
      + line(6, 42.5, 42, 42.5, p.faint, 1.4, '3 3'),
  };
}

const uri = (body) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">${body}</svg>`)}`;
const SKINS = Object.fromEntries(Object.entries(PALETTES).map(([t, p]) =>
  [t, Object.fromEntries(Object.entries(skins(p)).map(([k, b]) => [k, uri(b)]))]));
const skinSvg = (k, theme) => `<svg viewBox="0 0 48 48" width="24" height="24" aria-hidden="true">${skins(PALETTES[theme])[k]}</svg>`;

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

// ---------------------------------------------------------------------------
const CSS = `
.rg { max-width: 1300px; margin: 0 auto 40px; }
.rg-bar { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; justify-content: space-between;
  border: 1.5px solid var(--ink); border-bottom: none; background: var(--paper-2); padding: 8px 14px; }
.rg-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; }
.rg-legend .lg { display: inline-flex; align-items: center; gap: 7px; font-family: var(--mono); font-size: 9.5px;
  letter-spacing: 0.06em; color: var(--ink-soft); }
.rg-legend .lg svg { display: block; }
.rg-legend .lg .sw-dark { display: none; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .rg-legend .lg .sw-light { display: none; }
  :root:not([data-theme="light"]) .rg-legend .lg .sw-dark { display: block; }
}
:root[data-theme="dark"] .rg-legend .lg .sw-light { display: none; }
:root[data-theme="dark"] .rg-legend .lg .sw-dark { display: block; }
.rg-legend .lg i { display: block; width: 24px; height: 0; border-top-width: 2px; border-top-style: solid; }
.rg-ctl { display: flex; gap: 12px; align-items: center; font-family: var(--mono); font-size: 9.5px;
  letter-spacing: 0.1em; color: var(--ink-soft); }
.rg-ctl button { font: inherit; letter-spacing: inherit; color: var(--ink); background: var(--paper);
  border: 1px solid var(--ink); padding: 4px 9px; cursor: pointer; }
.rg-ctl button:hover { background: var(--paper-2); }
.rg-ctl label { display: inline-flex; gap: 5px; align-items: center; cursor: pointer; }
.rg-ctl label.on { color: var(--accent); }
.rg-stage { display: grid; grid-template-columns: minmax(0, 1fr) 250px; border: 1.5px solid var(--ink);
  background: var(--paper); }
.rg-cy { height: 720px; min-width: 0; }
.rg-info { border-left: 1.5px solid var(--ink); background: var(--paper-2); padding: 12px 14px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.04em; color: var(--ink); overflow-y: auto;
  max-height: 720px; }
.rg-info h4 { font-size: 11.5px; letter-spacing: 0.06em; margin-bottom: 8px; word-break: break-all; }
.rg-info .f { display: block; font-size: 8.5px; letter-spacing: 0.16em; color: var(--ink-soft); margin: 9px 0 2px; }
.rg-info ul { list-style: none; padding: 0; }
.rg-info li { padding: 1px 0; color: var(--ink-soft); word-break: break-all; }
.rg-info .hint { color: var(--ink-faint); }
.rg-info .red { color: var(--red); }
.rg-basis { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.06em; color: var(--ink-faint);
  border: 1.5px solid var(--ink); border-top: none; background: var(--paper-2); padding: 8px 14px 9px; }
@media (max-width: 860px) {
  .rg-stage { grid-template-columns: 1fr; }
  .rg-info { border-left: none; border-top: 1.5px solid var(--ink); max-height: none; }
}`;

// Written without template placeholders on purpose: this is emitted inside one,
// and every byte of data reaches it through the JSON islands.
const INIT = `
(function () {
  // The cytoscape tag is deferred; deferred scripts run BEFORE DOMContentLoaded,
  // so boot there rather than probing the global during parse.
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
  function boot() {
  var stage = document.getElementById('rg-cy');
  var info = document.getElementById('rg-info');
  if (!stage || !info) return;
  if (typeof cytoscape === 'undefined') {
    info.innerHTML = '\\u003ch4\\u003eTHE REGISTER\\u003c/h4\\u003e\\u003cp class="hint"\\u003ecytoscape did not load, so the '
      + 'walkable graph is not available here. Sheet 12 draws the same measurement as a static plate, '
      + 'and diagrams/data/census-plate.json carries every node and edge of it.\\u003c/p\\u003e';
    return;
  }
  var G = JSON.parse(document.getElementById('rg-graph').textContent);
  var L = JSON.parse(document.getElementById('rg-layout').textContent);
  var N = G.nodes, E = G.edges;

  var deps = N.map(function () { return []; });
  var uses = N.map(function () { return []; });
  E.forEach(function (e) { deps[e[1]].push(e[0]); uses[e[0]].push(e[1]); });
  var nid = function (i) { return N[i].pkg + '#' + N[i].task; };

  function dark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function tok(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function pal() {
    return { ink: tok('--ink'), soft: tok('--ink-soft'), faint: tok('--ink-faint'), accent: tok('--accent'),
      paper: tok('--paper'), paper2: tok('--paper-2'), line: tok('--edge'), red: tok('--red') };
  }
  var skins = function () { return L.skins[dark() ? 'dark' : 'light']; };

  var els = [];
  N.forEach(function (n, i) {
    var key = n.real ? 'task-real' : 'task-phantom';
    els.push({ data: { id: 'n' + i, i: i, kind: n.real ? 'real' : 'phantom', sprite: skins()[key], skey: key },
      position: { x: L.xy[i * 2], y: L.xy[i * 2 + 1] },
      classes: n.real ? 'cell real' : 'cell phantom' });
  });
  E.forEach(function (e, k) {
    var both = N[e[0]].real && N[e[1]].real;
    els.push({ data: { id: 'e' + k, source: 'n' + e[0], target: 'n' + e[1] },
      classes: both ? 'wire real' : 'wire phantom' });
  });
  L.cols.forEach(function (c, i) {
    els.push({ data: { id: 'c' + i, label: c.name, real: c.real }, position: { x: c.x, y: c.y },
      classes: 'head' + (c.real ? '' : ' phantom') });
  });
  L.rows.forEach(function (r, i) {
    els.push({ data: { id: 'r' + i, label: r.pkg }, position: { x: r.x, y: r.y }, classes: 'rowlabel' });
  });
  L.bands.forEach(function (b, i) {
    els.push({ data: { id: 'b' + i, label: b.label }, position: { x: b.x, y: b.y }, classes: 'band' });
  });
  els.push({ data: { id: 'foot', label: L.footLabel }, position: { x: L.foot.x, y: L.foot.y }, classes: 'band foot' });

  function style(c) {
    return [
      { selector: 'node.cell', style: { 'background-color': c.paper, 'background-image': 'data(sprite)',
        'background-fit': 'contain', 'background-clip': 'none', 'border-width': 1, 'border-color': c.line,
        shape: 'round-rectangle', width: L.node, height: L.node, label: '', 'overlay-opacity': 0,
        'transition-property': 'opacity', 'transition-duration': '120ms' } },
      { selector: 'node.cell.phantom', style: { 'background-color': c.paper2, 'border-color': c.faint, opacity: 0.4 } },
      { selector: 'node.head', style: { 'background-opacity': 0, 'border-width': 0, label: 'data(label)',
        'text-valign': 'center', 'text-halign': 'center', 'text-rotation': -Math.PI / 2, 'text-margin-y': 0,
        'font-family': 'ui-monospace, Menlo, Consolas, monospace', 'font-size': 12, color: c.ink,
        width: 1, height: 1, events: 'no' } },
      { selector: 'node.head.phantom', style: { color: c.red } },
      { selector: 'node.rowlabel', style: { 'background-opacity': 0, 'border-width': 0, label: 'data(label)',
        'text-valign': 'center', 'text-halign': 'left', 'text-margin-x': -4,
        'font-family': 'ui-monospace, Menlo, Consolas, monospace', 'font-size': 12, color: c.soft,
        width: 1, height: 1, events: 'no' } },
      { selector: 'node.band', style: { 'background-opacity': 0, 'border-width': 0, label: 'data(label)',
        'text-valign': 'center', 'text-halign': 'left', 'text-margin-x': -4,
        'font-family': 'ui-monospace, Menlo, Consolas, monospace', 'font-size': 12.5, color: c.accent,
        width: 1, height: 1, events: 'no' } },
      { selector: 'node.foot', style: { 'text-halign': 'center', 'text-margin-x': 0, color: c.soft, 'font-size': 13 } },
      { selector: 'edge', style: { 'curve-style': 'straight', 'target-arrow-shape': 'triangle',
        'arrow-scale': 0.5, width: 1, 'line-color': c.soft, 'target-arrow-color': c.soft, opacity: 0.55,
        'transition-property': 'opacity', 'transition-duration': '120ms' } },
      { selector: 'edge.phantom', style: { width: 0.6, 'line-color': c.faint, 'target-arrow-shape': 'none',
        opacity: 0.18 } },
      { selector: '.dim', style: { opacity: 0.15 } },
      { selector: 'node.lit', style: { 'border-width': 2.4, 'border-color': c.accent, opacity: 1 } },
      { selector: 'node.pick', style: { 'border-width': 3, 'border-color': c.red, opacity: 1 } },
      { selector: 'edge.lit', style: { opacity: 1, width: 2.2, 'line-color': c.accent,
        'target-arrow-color': c.accent, 'target-arrow-shape': 'triangle' } }
    ];
  }

  var cy = cytoscape({ container: stage, elements: els, style: style(pal()), layout: { name: 'preset' },
    minZoom: 0.12, maxZoom: 3.4, autoungrabify: true });

  var shroud = false;
  function applyShroud() {
    cy.batch(function () {
      cy.elements('.phantom').style('display', shroud ? 'element' : 'none');
    });
    cy.fit(cy.elements(':visible'), 26);
  }
  applyShroud();

  var IDLE = '\\u003ch4\\u003eTHE REGISTER\\u003c/h4\\u003e\\u003cp class="hint"\\u003e' + L.idle + '\\u003c/p\\u003e';
  function field(k, v) { return '\\u003cspan class="f"\\u003e' + k + '\\u003c/span\\u003e' + v; }
  function list(k, arr, cap) {
    if (!arr.length) return '';
    var shown = arr.slice(0, cap);
    var more = arr.length - shown.length;
    return '\\u003cspan class="f"\\u003e' + k + '\\u003c/span\\u003e\\u003cul\\u003e\\u003cli\\u003e'
      + shown.join('\\u003c/li\\u003e\\u003cli\\u003e')
      + (more ? '\\u003c/li\\u003e\\u003cli\\u003e+ ' + more + ' more' : '')
      + '\\u003c/li\\u003e\\u003c/ul\\u003e';
  }
  function describe(i) {
    var n = N[i];
    var inR = deps[i].filter(function (j) { return N[j].real; });
    var outR = uses[i].filter(function (j) { return N[j].real; });
    var h = '\\u003ch4\\u003e' + nid(i) + '\\u003c/h4\\u003e';
    h += field('PACKAGE', n.pkg);
    h += field('TASK', n.task);
    h += field('KIND', n.real ? 'command-bearing — this runs'
      : '\\u003cspan class="red"\\u003ephantom placeholder — command "&lt;NONEXISTENT&gt;"\\u003c/span\\u003e');
    h += field('CACHE', n.cacheFalse ? 'cache: false — a hit would be wrong' : 'cacheable');
    h += field('DEGREE', 'in ' + deps[i].length + ' · out ' + uses[i].length
      + '  (real: in ' + inR.length + ' · out ' + outR.length + ')');
    h += list('DEPENDS ON', deps[i].map(nid).sort(), 14);
    h += list('REQUIRED BY', uses[i].map(nid).sort(), 8);
    return h;
  }

  function clear() { cy.elements().removeClass('dim lit pick'); info.innerHTML = IDLE; }
  function focus(node) {
    if (!node.hasClass('cell')) return;
    var hood = node.closedNeighborhood().filter(':visible');
    // the lettering never dims: with 600-odd cells you must still be able to read
    // which package and which task column the lit neighbourhood is standing in
    cy.elements().not('.head, .rowlabel, .band').addClass('dim');
    hood.removeClass('dim');
    hood.addClass('lit');
    node.removeClass('lit').addClass('pick');
    info.innerHTML = describe(node.data('i'));
  }
  cy.on('mouseover', 'node', function (e) { focus(e.target); });
  cy.on('tap', 'node', function (e) { focus(e.target); });
  cy.on('mouseout', 'node', clear);
  cy.on('tap', function (e) { if (e.target === cy) clear(); });
  clear();

  document.getElementById('rg-fit').addEventListener('click', function () { cy.fit(cy.elements(':visible'), 26); });
  var box = document.getElementById('rg-shroud');
  box.addEventListener('change', function (e) {
    shroud = e.target.checked;
    clear();
    applyShroud();
    box.parentNode.classList.toggle('on', shroud);
    document.getElementById('rg-hint').textContent = shroud ? L.hintShroud : L.hintReal;
  });

  function repaint() {
    var s = skins();
    cy.batch(function () {
      cy.nodes('.cell').forEach(function (n) { n.data('sprite', s[n.data('skey')]); });
    });
    cy.style(style(pal()));
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', repaint);
  new MutationObserver(repaint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
})();
`;

export const REGISTER = {
  pipeline: PIPE,
  nodes: NODES.length,
  real: REAL_N,
  edges: EDGES.length,
  realEdges: REAL_E,
  cols: COLS.length,
  allPhantomCols: COLS.filter((c) => c.real === 0).map((c) => c.name),
  pkgs: PKGS.length,
  phantomPct: PHANTOM_PCT,
  ref: PLATE.ref,
  sha: PLATE.sha,
  commitDate: PLATE.commitDate.slice(0, 10),
  turbo: TURBO,
  deepest: CI.chain,
  realChain: CI.realChain,
  cacheFalse: NODES.filter((n) => n.cacheFalse).length,
  fmt,
};

// ---------------------------------------------------------------------------
export function registerLane() {
  const island = {
    ...LAYOUT,
    skins: SKINS,
    footLabel: `${fmt(NODES.length)} NODES · ${REAL_N} RUN A COMMAND · ${fmt(EDGES.length)} EDGES · ${REAL_E} JOIN TWO REAL TASKS`,
    idle: 'Hover or tap any building for its package, its task, whether it runs anything, and everything it '
      + 'waits on. What you are looking at is the REAL subgraph alone — the '
      + `${REAL_N} tasks that run a command and the ${REAL_E} edges that join two of them. Tick PHANTOM `
      + `SHROUD to flood the other ${NODES.length - REAL_N} in.`,
    hintReal: 'REAL SUBGRAPH · DRAG TO PAN · SCROLL TO ZOOM',
    hintShroud: `PHANTOM SHROUD — ALL ${fmt(NODES.length)} NODES · ${PHANTOM_PCT.toFixed(1)}% RUN NOTHING`,
  };
  const swatch = (k) => `<span class="sw sw-light">${skinSvg(k, 'light')}</span><span class="sw sw-dark">${skinSvg(k, 'dark')}</span>`;
  const legend = [
    ['task-real', 'a task that runs a command'],
    ['task-phantom', 'a placeholder — surveyed, never built'],
  ].map(([k, d]) => `<span class="lg">${swatch(k)}${d}</span>`).join('\n    ')
    + '\n    ' + [
      ['real→real edge', 'var(--ink-soft)', 'solid'],
      ['edge into the shroud', 'var(--ink-faint)', 'dashed'],
    ].map(([rel, col, st]) => `<span class="lg"><i style="border-top-color:${col};border-top-style:${st}"></i>${rel}</span>`).join('\n    ');

  return `<style>${CSS}</style>
<div class="rg-bar">
  <div class="rg-legend">
    ${legend}
  </div>
  <div class="rg-ctl">
    <span id="rg-hint">REAL SUBGRAPH · DRAG TO PAN · SCROLL TO ZOOM</span>
    <label><input type="checkbox" id="rg-shroud"> PHANTOM SHROUD</label>
    <button type="button" id="rg-fit">FIT</button>
  </div>
</div>
<div class="rg-stage">
  <div class="rg-cy" id="rg-cy" role="img" aria-label="An interactive register of the pull-request CI task graph: ${PKGS.length} packages as rows against ${COLS.length} task names as columns, ordered by dependency depth. By default only the ${REAL_N} command-bearing tasks and the ${REAL_E} edges joining two of them are drawn; the phantom shroud floods in the remaining ${NODES.length - REAL_N} placeholder nodes and ${fmt(EDGES.length - REAL_E)} edges."></div>
  <aside class="rg-info" id="rg-info"></aside>
</div>
<p class="rg-basis">BASIS — <code>turbo run ${PIPE} --dry=json</code> against a materialized, installed archive of ${PLATE.ref} @ ${PLATE.sha} (commit ${PLATE.commitDate.slice(0, 10)}) · ${TURBO} · all ${fmt(NODES.length)} nodes and ${fmt(EDGES.length)} edges read verbatim from <code>diagrams/data/census-plate.json</code>'s <code>graphNodes</code> / <code>graphEdges</code> and embedded here unaggregated; columns ranked from those edges at build time and drawn with cytoscape <code>preset</code> — no physics, so the picture is the same on every load.</p>
<script type="application/json" id="rg-graph">${json({ nodes: NODES, edges: EDGES })}</script>
<script type="application/json" id="rg-layout">${json(island)}</script>
<script defer src="${CYTOSCAPE_URL}"></script>
<script>${INIT}</script>`;
}

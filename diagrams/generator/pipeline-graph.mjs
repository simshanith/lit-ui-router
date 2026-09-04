// I7 — THE SURVEY OFFICE, INTERACTIVE: sheet 14's cytoscape sibling.
//
// The data model is census-atlas.mjs's NODES/EDGES arrays, embedded VERBATIM in
// the page as JSON (nothing here is hand-listed; every label, tier, basis and
// edge is introspected from diagrams/generator/ + diagrams/data/ at build time).
// Layout is computed here, not in the browser: ranks come from the edges
// (basis -> stations -> plates -> sheets), plate rows are pinned to their
// writer's row so every «writes» edge is horizontal, and sheets are ordered by
// the barycentre of the plates they read.  cytoscape draws it with `preset` —
// no physics, so the picture is the same on every load.
import { ATLAS } from './census-atlas.mjs';
import { SPRITES, spriteSvg } from './sprites.mjs';

export const CYTOSCAPE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.31.0/cytoscape.min.js';
export const REV = 'A';

const A = ATLAS;
const byId = new Map(A.nodes.map((nd) => [nd.id, nd]));
const MASTER = A.nodes.find((nd) => nd.kind === 'plate' && nd.label === A.master);
const WRITES = A.edges.filter((e) => e.rel === 'writes');
const MASTER_WRITER = byId.get(WRITES.find((e) => e.to === MASTER.id).from);

// ---- columns, left to right: basis, master station, master plate, stations,
// cabinet, rack.  The master pair gets its own two lanes because the whole
// point of the picture is that everything downstream is a view of one plate.
const COL = { basis: 60, station: 265, master: 480, probe: 740, plate: 1000, sheet: 1265 };
const PITCH = 66;
const NODE = { probe: 46, plate: 46, sheet: 46, tool: 40, basis: 58, master: 66 };

// ---- station bands.  The probe column carries the tiers, in drawing order;
// the stations that file no plate stand in an annex off the master station, so
// the filing floor is exactly as tall as the cabinet it fills.
const BAND_LABEL = { T1: 'T1 · PURE TREE', T2: 'T2 · HISTORY', T3: 'T3 · EXECUTION' };
const ANNEX_LABEL = 'FILES NO PLATE';
const stations = A.nodes.filter((nd) => nd.kind === 'probe' && nd.id !== MASTER_WRITER.id);
const bandOf = (nd) => nd.role ?? nd.tier;
const BANDS = ['T1', 'T2', 'T3']
  .map((key) => ({ key, label: BAND_LABEL[key], nodes: stations.filter((nd) => bandOf(nd) === key) }))
  .map((b) => ({ ...b, label: `${b.label} · ${b.nodes.length}` }))
  .filter((b) => b.nodes.length);
const ANNEX = stations.filter((nd) => nd.role);
for (const nd of stations) {
  if (!BAND_LABEL[bandOf(nd)] && !nd.role) throw new Error(`pipeline-graph: station ${nd.label} is in band "${bandOf(nd)}", which has no label`);
}

const pos = new Map();
const place = (id, x, y) => pos.set(id, { x, y });

// stations down the probe column, one band at a time
const bandY = new Map();
let cursor = 0;
for (const b of BANDS) {
  bandY.set(b.key, cursor);
  cursor += 32;
  for (const nd of b.nodes) { place(nd.id, COL.probe, cursor); cursor += PITCH; }
  cursor += 26;
}
const SPAN = cursor - 26 - 32;
const SHIFT = -SPAN / 2;                       // centre the whole column on y = 0
for (const [id, p] of pos) place(id, p.x, p.y + SHIFT);
for (const [k, y] of bandY) bandY.set(k, y + SHIFT + 4);

// the master pair and the basis sit on the centreline; the annex hangs below
// the master station, off the filing floor entirely
place(MASTER.id, COL.master, 0);
place(MASTER_WRITER.id, COL.station, 0);
const ANNEX_Y = 168;
ANNEX.forEach((nd, i) => place(nd.id, COL.station, ANNEX_Y + i * PITCH));

// a plate is filed on its writer's row: every «writes» edge is horizontal
for (const e of WRITES) {
  if (e.to === MASTER.id) continue;
  place(e.to, COL.plate, pos.get(e.from).y);
}

// the rack, ordered by the barycentre of the plates each drawing reads
const READS = A.edges.filter((e) => e.rel === 'reads');
const sheets = A.nodes.filter((nd) => nd.kind === 'sheet').map((nd) => {
  const src = READS.filter((e) => e.to === nd.id).map((e) => pos.get(e.from).y);
  return { nd, bary: src.reduce((a, v) => a + v, 0) / (src.length || 1) };
});
// the cover is not a sheet; like the rack in sheet 14, it leads
sheets.sort((a, b) => Number(b.nd.num === null) - Number(a.nd.num === null) || a.bary - b.bary);
const sheetTop = -((sheets.length - 1) * PITCH) / 2;
sheets.forEach((s, i) => place(s.nd.id, COL.sheet, sheetTop + i * PITCH));

// the tools ledger: a bottom band, folded away until asked for
const tools = A.nodes.filter((nd) => nd.kind === 'tool');
const LEDGER_Y = Math.max(...[...pos.values()].map((p) => p.y)) + 150;
const perRow = Math.ceil(tools.length / 2);
tools.forEach((nd, i) => {
  const row = Math.floor(i / perRow);
  const col = i % perRow;
  place(nd.id, COL.station + col * ((COL.sheet - COL.station) / (perRow - 1)), LEDGER_Y + row * 96);
});

// ---- sprite + label per node -----------------------------------------------
const spriteOf = (nd) => {
  if (nd.id === MASTER.id) return 'plate-master';
  if (nd.kind === 'plate') return 'plate';
  if (nd.kind === 'sheet') return 'sheet';
  if (nd.kind === 'tool') return nd.role === 'instrument' ? 'tool-instrument' : 'tool-external';
  return nd.role ? `probe-${nd.role}` : `probe-${nd.tier}`;
};
// a rack tab reads by its drawing, a ledger entry by its instrument's first word
const labelOf = (nd) => {
  if (nd.kind === 'sheet') return nd.num === null ? nd.title : `S${nd.num} ${nd.title}`;
  if (nd.kind === 'tool') return nd.role === 'instrument' ? nd.label : nd.label.split(/[\s(]/)[0];
  return nd.label;
};

const LAYOUT = {
  masterId: MASTER.id,
  sprites: SPRITES,
  nodes: Object.fromEntries(A.nodes.map((nd) => {
    const p = pos.get(nd.id);
    const cls = [`k-${nd.kind}`];
    if (nd.id === MASTER.id) cls.push('hero');
    if (nd.kind === 'tool') cls.push('tool');
    const size = nd.id === MASTER.id ? NODE.master : NODE[nd.kind];
    return [nd.id, { x: p.x, y: p.y, w: size, h: size, sprite: spriteOf(nd), label: labelOf(nd), classes: cls.join(' ') }];
  })),
  // the basis is not a station, so it is not in the census; it is drawn from the
  // plates' own shared pin, with a faint tie to every probe that opens the archive
  basis: {
    id: 'basis',
    label: `${A.ref} @ ${A.sha}`,
    sub: `git archive · commit ${A.commitDate}`,
    x: COL.basis, y: 0, w: NODE.basis, h: NODE.basis, sprite: 'basis',
    ties: A.probes.filter((p) => p.basis.includes('archive')).map((p) => A.nodes.find((nd) => nd.kind === 'probe' && nd.label === p.file).id),
  },
  bands: [
    ...BANDS.map((b) => ({ id: `band-${b.key}`, label: b.label, x: COL.probe - NODE.probe / 2, y: bandY.get(b.key) })),
    { id: 'band-annex', label: ANNEX_LABEL, x: COL.station - NODE.probe / 2, y: ANNEX_Y - 40 },
  ],
  ledger: { y: LEDGER_Y - 62, x: COL.station - NODE.tool / 2, label: `TOOLS LEDGER — ${A.stats.instruments} shared instruments · ${A.stats.tools} external` },
};

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

const LEGEND_NODES = [
  ['probe-T1', 'probe station (pips = tier)'],
  ['plate-master', 'the master plate'],
  ['plate', 'a filed plate'],
  ['sheet', 'a finished drawing'],
  ['tool-instrument', 'shared instrument'],
  ['basis', 'the archive basis'],
];

const CSS = `
.pg { max-width: 1300px; margin: 0 auto 40px; }
.pg-bar { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; justify-content: space-between;
  border: 1.5px solid var(--ink); border-bottom: none; background: var(--paper-2); padding: 8px 14px; }
.pg-bar .pg-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; }
.pg-bar .lg { display: inline-flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 9.5px;
  letter-spacing: 0.06em; color: var(--ink-soft); }
.pg-bar .lg svg { display: block; }
.pg-bar .lg .sw-dark { display: none; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .pg-bar .lg .sw-light { display: none; }
  :root:not([data-theme="light"]) .pg-bar .lg .sw-dark { display: block; }
}
:root[data-theme="dark"] .pg-bar .lg .sw-light { display: none; }
:root[data-theme="dark"] .pg-bar .lg .sw-dark { display: block; }
.pg-bar .lg i { display: block; width: 26px; height: 0; border-top-width: 2px; border-top-style: solid; }
.pg-ctl { display: flex; gap: 12px; align-items: center; font-family: var(--mono); font-size: 9.5px;
  letter-spacing: 0.1em; color: var(--ink-soft); }
.pg-ctl button { font: inherit; letter-spacing: inherit; color: var(--ink); background: var(--paper);
  border: 1px solid var(--ink); padding: 4px 9px; cursor: pointer; }
.pg-ctl button:hover { background: var(--paper-2); }
.pg-ctl label { display: inline-flex; gap: 5px; align-items: center; cursor: pointer; }
.pg-desk { perspective: 1600px; perspective-origin: 50% 42%; }
.pg-stage { display: grid; grid-template-columns: minmax(0, 1fr) 240px; border: 1.5px solid var(--ink);
  background: var(--paper); transform-origin: 50% 100%; }
/* tilt is a viewing pose: the drawing lies on the desk and stops taking pointers */
.pg-desk.tilt { pointer-events: none; }
.pg-desk.tilt .pg-stage { transform: rotateX(23deg); margin-top: calc(-1 * var(--pg-pull, 0px)); }
/* --pg-pull is measured at runtime: the height the foreshortened plate gives back,
   so its near edge stays on the basis line and its far edge meets the control bar */
.pg.tilt-on .pg-bar { border-bottom: 1.5px solid var(--ink); }
@media (prefers-reduced-motion: no-preference) {
  .pg-stage { transition: transform 420ms cubic-bezier(0.33, 0.72, 0.28, 1), margin-top 420ms cubic-bezier(0.33, 0.72, 0.28, 1); }
}
.pg-cy { height: 700px; min-width: 0; }
.pg-info { border-left: 1.5px solid var(--ink); background: var(--paper-2); padding: 12px 14px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.04em; color: var(--ink); overflow-y: auto;
  max-height: 700px; }
.pg-info h4 { font-size: 11.5px; letter-spacing: 0.08em; margin-bottom: 8px; word-break: break-all; }
.pg-info .f { display: block; font-size: 8.5px; letter-spacing: 0.16em; color: var(--ink-soft); margin: 9px 0 2px; }
.pg-info ul { list-style: none; padding: 0; }
.pg-info li { padding: 1px 0; color: var(--ink-soft); word-break: break-all; }
.pg-info .hint { color: var(--ink-faint); font-style: normal; }
.pg-basis { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.06em; color: var(--ink-faint);
  border: 1.5px solid var(--ink); border-top: none; background: var(--paper-2); padding: 8px 14px 9px; }
@media (max-width: 860px) {
  .pg-stage { grid-template-columns: 1fr; }
  .pg-info { border-left: none; border-top: 1.5px solid var(--ink); max-height: none; }
}`;

// The init script is written without template placeholders on purpose: it is
// emitted inside one, and all of its data arrives through the JSON islands.
const INIT = `
(function () {
  // The cytoscape tag above is deferred; deferred scripts run before
  // DOMContentLoaded, so boot there rather than probing during parse.
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
  function boot() {
  var stage = document.getElementById('pg-cy');
  if (!stage || typeof cytoscape === 'undefined') return;
  var A = JSON.parse(document.getElementById('pg-atlas').textContent);
  var L = JSON.parse(document.getElementById('pg-layout').textContent);
  var byId = {}; A.nodes.forEach(function (n) { byId[n.id] = n; });

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
  var sprites = function () { return L.sprites[dark() ? 'dark' : 'light']; };

  var els = [];
  A.nodes.forEach(function (n) {
    var p = L.nodes[n.id];
    els.push({ data: { id: 'n' + n.id, nid: n.id, label: p.label, kind: n.kind, w: p.w, h: p.h,
      sprite: sprites()[p.sprite], skey: p.sprite }, position: { x: p.x, y: p.y }, classes: p.classes });
  });
  els.push({ data: { id: L.basis.id, label: L.basis.label, kind: 'basis', w: L.basis.w, h: L.basis.h,
    sprite: sprites()[L.basis.sprite], skey: L.basis.sprite }, position: { x: L.basis.x, y: L.basis.y },
    classes: 'k-basis' });
  L.bands.forEach(function (b) {
    els.push({ data: { id: b.id, label: b.label, w: 1, h: 1 }, position: { x: b.x, y: b.y }, classes: 'band' });
  });
  els.push({ data: { id: 'ledger-label', label: L.ledger.label, w: 1, h: 1 },
    position: { x: L.ledger.x, y: L.ledger.y }, classes: 'band tool' });
  A.edges.forEach(function (e, i) {
    var hero = e.rel === 'reads' && e.from === L.masterId;
    els.push({ data: { id: 'e' + i, source: 'n' + e.from, target: 'n' + e.to, rel: e.rel },
      classes: 'r-' + e.rel + (hero ? ' hero' : '') + (e.rel === 'imports' ? ' tool' : '') });
  });
  L.basis.ties.forEach(function (id, i) {
    els.push({ data: { id: 'b' + i, source: L.basis.id, target: 'n' + id, rel: 'basis' }, classes: 'r-basis' });
  });

  function style(c) {
    return [
      { selector: 'node', style: { 'background-color': c.paper, 'background-image': 'data(sprite)',
        'background-fit': 'contain', 'background-clip': 'none', 'border-width': 1.1, 'border-color': c.line,
        shape: 'round-rectangle', width: 'data(w)', height: 'data(h)', label: 'data(label)',
        'text-valign': 'bottom', 'text-margin-y': 5, 'text-wrap': 'none',
        'font-family': 'ui-monospace, Menlo, Consolas, monospace', 'font-size': 12, color: c.ink,
        'text-halign': 'center', 'overlay-opacity': 0, 'transition-property': 'opacity', 'transition-duration': '110ms' } },
      { selector: 'node.hero', style: { 'border-width': 2.2, 'border-color': c.accent, color: c.accent,
        'font-size': 13.5, 'font-weight': 'bold' } },
      { selector: 'node.k-basis', style: { 'border-width': 1.6, 'border-color': c.ink } },
      { selector: 'node.band', style: { 'background-opacity': 0, 'background-image': 'none', 'border-width': 0,
        label: 'data(label)', 'text-valign': 'center', 'text-halign': 'right', 'text-margin-x': 2,
        'text-wrap': 'none', 'font-size': 12, color: c.soft, events: 'no' } },
      { selector: 'edge', style: { 'curve-style': 'bezier', 'target-arrow-shape': 'triangle',
        'arrow-scale': 0.75, 'line-color': c.soft, 'target-arrow-color': c.soft, width: 1,
        'transition-property': 'opacity', 'transition-duration': '110ms' } },
      { selector: 'edge.r-writes', style: { width: 2.2, 'line-color': c.accent, 'target-arrow-color': c.accent } },
      { selector: 'edge.r-reads', style: { width: 1, 'line-color': c.soft, 'target-arrow-color': c.soft, opacity: 0.5 } },
      { selector: 'edge.r-imports', style: { width: 1, 'line-style': 'dashed', 'line-dash-pattern': [4, 4],
        'line-color': c.faint, 'target-arrow-shape': 'none', opacity: 0.4 } },
      { selector: 'edge.r-basis', style: { width: 1, 'line-style': 'dotted', 'line-color': c.faint,
        'target-arrow-color': c.faint, opacity: 0.45 } },
      { selector: 'edge.hero', style: { width: 2, 'line-color': c.accent, 'target-arrow-color': c.accent, opacity: 0.95 } },
      { selector: '.dim', style: { opacity: 0.09 } },
      { selector: 'node.lit', style: { 'border-width': 2.4, 'border-color': c.accent } },
      { selector: 'edge.lit', style: { opacity: 1, width: 2.4, 'line-color': c.accent, 'target-arrow-color': c.accent } }
    ];
  }

  var cy = cytoscape({ container: stage, elements: els, style: style(pal()), layout: { name: 'preset' },
    minZoom: 0.2, maxZoom: 2.6, autoungrabify: true });

  function showTools(on) {
    cy.elements('.tool').style('display', on ? 'element' : 'none');
    cy.fit(cy.elements(':visible'), 34);
  }
  showTools(false);

  var info = document.getElementById('pg-info');
  var IDLE = '<h4>THE SURVEY OFFICE</h4><p class="hint">Hover or tap any building to light its neighbourhood: '
    + 'what wrote it, what reads it, what it imports. The wide accent fan leaving the master plate is the '
    + 'one-measurement-many-views claim, drawn.</p>';
  function field(k, v) { return '<span class="f">' + k + '</span>' + v; }
  function list(k, arr) {
    if (!arr.length) return '';
    return '<span class="f">' + k + '</span><ul><li>' + arr.join('</li><li>') + '</li></ul>';
  }
  function nameOf(id) { return L.nodes[id] ? byId[id].label : id; }
  function describe(id) {
    var n = byId[id], p = L.nodes[id];
    var ins = A.edges.filter(function (e) { return e.to === id; });
    var outs = A.edges.filter(function (e) { return e.from === id; });
    var h = '<h4>' + p.label + '</h4>';
    h += field('KIND', n.kind + (n.role ? ' · ' + n.role : ''));
    if (n.tier) h += field('TIER', n.tier);
    if (n.basis) h += field('BASIS', n.basis);
    if (n.title) h += field('DRAWING', (n.num ? 'sheet ' + n.num + ' — ' : '') + n.title);
    if (n.importedBy) h += field('IMPORTED BY', n.importedBy + ' stations');
    h += list('WRITTEN BY', ins.filter(function (e) { return e.rel === 'writes'; }).map(function (e) { return nameOf(e.from); }));
    h += list('WRITES', outs.filter(function (e) { return e.rel === 'writes'; }).map(function (e) { return nameOf(e.to); }));
    h += list('READS', ins.filter(function (e) { return e.rel === 'reads'; }).map(function (e) { return nameOf(e.from); }));
    h += list('READ BY', outs.filter(function (e) { return e.rel === 'reads'; }).map(function (e) { return nameOf(e.to); }));
    h += list('IMPORTS', outs.filter(function (e) { return e.rel === 'imports'; }).map(function (e) { return nameOf(e.to); }));
    h += list('IMPORTED BY', ins.filter(function (e) { return e.rel === 'imports'; }).map(function (e) { return nameOf(e.from); }));
    return h;
  }

  function clear() { cy.elements().removeClass('dim lit'); info.innerHTML = IDLE; }
  function focus(node) {
    if (node.hasClass('band')) return;
    var hood = node.closedNeighborhood();
    cy.elements().addClass('dim');
    hood.removeClass('dim');
    hood.addClass('lit');
    node.removeClass('lit');
    var id = node.data('nid');
    info.innerHTML = typeof id === 'number' ? describe(id)
      : '<h4>' + node.data('label') + '</h4>' + field('KIND', 'the archive basis') + field('BASIS', L.basis.sub)
        + field('OPENS', L.basis.ties.length + ' stations materialize this ref');
  }
  cy.on('mouseover', 'node', function (e) { focus(e.target); });
  cy.on('tap', 'node', function (e) { focus(e.target); });
  cy.on('mouseout', 'node', clear);
  cy.on('tap', function (e) { if (e.target === cy) clear(); });
  clear();

  document.getElementById('pg-fit').addEventListener('click', function () { cy.fit(cy.elements(':visible'), 34); });
  document.getElementById('pg-tools').addEventListener('change', function (e) { clear(); showTools(e.target.checked); });

  // a 3D transform breaks cytoscape's flat-rect hit test, so tilt disables input
  var desk = document.getElementById('pg-desk');
  var plate = desk.firstElementChild;
  var hint = document.getElementById('pg-hint');

  // measure the foreshortening once, transition suppressed, so CSS can close the gap
  function measurePull() {
    var t = plate.style.transition;
    var was = desk.classList.contains('tilt');
    plate.style.transition = 'none';
    plate.style.setProperty('--pg-pull', '0px');
    desk.classList.add('tilt');
    var pull = Math.max(0, Math.round(plate.offsetHeight - plate.getBoundingClientRect().height));
    if (!was) desk.classList.remove('tilt');
    plate.style.setProperty('--pg-pull', pull + 'px');
    void plate.offsetHeight;
    plate.style.transition = t;
  }
  measurePull();
  window.addEventListener('resize', measurePull);
  var PAN = 'DRAG TO PAN · SCROLL TO ZOOM';
  var POSE = 'TILT — VIEWING POSE · INPUT PAUSED';
  var TILTED = '<h4>THE SURVEY OFFICE</h4><p class="hint">Tilted: the plate is lying on the drafting table, '
    + 'seen from the surveyor\\'s chair. It is a viewing pose only — pan, zoom and hover are paused until you '
    + 'lay it flat again.</p>';
  document.getElementById('pg-tilt').addEventListener('change', function (e) {
    var on = e.target.checked;
    clear();
    desk.classList.toggle('tilt', on);
    document.getElementById('pipeline-graph').classList.toggle('tilt-on', on);
    cy.userPanningEnabled(!on);
    cy.userZoomingEnabled(!on);
    hint.textContent = on ? POSE : PAN;
    if (on) info.innerHTML = TILTED;
  });

  function repaint() {
    var s = sprites();
    cy.batch(function () {
      cy.nodes().forEach(function (n) { if (n.data('skey')) n.data('sprite', s[n.data('skey')]); });
    });
    cy.style(style(pal()));
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', repaint);
  new MutationObserver(repaint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
})();
`;

export function pipelineSection() {
  const swatch = (k) => `<span class="sw sw-light">${spriteSvg(k, 'light')}</span><span class="sw sw-dark">${spriteSvg(k, 'dark')}</span>`;
  const legend = LEGEND_NODES.map(([k, d]) => `<span class="lg">${swatch(k)}${d}</span>`).join('\n    ')
    + '\n    ' + [
      ['writes', 'var(--accent)', 'solid'],
      ['reads', 'var(--ink-soft)', 'solid'],
      ['imports', 'var(--ink-faint)', 'dashed'],
    ].map(([rel, col, st]) => `<span class="lg"><i style="border-top-color:${col};border-top-style:${st}"></i>${rel}</span>`).join('\n    ');

  return `<style>${CSS}</style>
<section class="sheet pg" id="pipeline-graph" aria-label="The Survey Office, interactive">
  <div class="sheet-head"><span class="proj">THE ALTITUDE ATLAS — INTERACTIVE PLATE</span><span class="shno">SHEET 14 · REV ${REV}</span></div>
  <h2 class="sheet-title">THE SURVEY OFFICE — INTERACTIVE</h2>
  <p class="sheet-sub">THE CENSUS PIPELINE AS A LIVE GRAPH · ${A.stats.nodes} NODES · ${A.stats.edges} EDGES · ${A.stats.writes} WRITES / ${A.stats.reads} READS / ${A.stats.imports} IMPORTS</p>
  <div class="pg-bar">
    <div class="pg-legend">
    ${legend}
    </div>
    <div class="pg-ctl">
      <span id="pg-hint">DRAG TO PAN · SCROLL TO ZOOM</span>
      <label><input type="checkbox" id="pg-tools"> TOOLS LEDGER</label>
      <label><input type="checkbox" id="pg-tilt"> TILT</label>
      <button type="button" id="pg-fit">FIT</button>
    </div>
  </div>
  <div class="pg-desk" id="pg-desk">
    <div class="pg-stage">
      <div class="pg-cy" id="pg-cy" role="img" aria-label="Interactive flow graph of the census pipeline: archive basis, ${A.stats.probes} probe stations, ${A.stats.plates} filed plates and ${A.stats.drawings} drawings."></div>
      <aside class="pg-info" id="pg-info"></aside>
    </div>
  </div>
  <p class="pg-basis">BASIS — all ${A.stats.plates} plates pinned to ${A.ref} @ ${A.sha} · commit ${A.commitDate} · ${A.stats.nodes} nodes and ${A.stats.edges} edges introspected from <code>diagrams/generator/</code> and <code>diagrams/data/</code> by <code>generator/census-atlas.mjs</code> and embedded here verbatim; layout ranked from those edges, drawn with cytoscape <code>preset</code> — no physics. The archive basis is the one node the census does not contain: it is drawn from the plates' own shared pin.</p>
</section>
<script type="application/json" id="pg-atlas">${json({ nodes: A.nodes, edges: A.edges })}</script>
<script type="application/json" id="pg-layout">${json(LAYOUT)}</script>
<script defer src="${CYTOSCAPE_URL}"></script>
<script>${INIT}</script>`;
}

// I7 — THE SURVEY OFFICE, INTERACTIVE: appendix A2's cytoscape sibling.
//
// The data model is census-atlas.mjs's NODES/EDGES arrays, embedded VERBATIM in
// the page as JSON (nothing here is hand-listed; every label, tier, basis and
// edge is introspected from www/atlas.lit-ui-router.dev/generator/ + www/atlas.lit-ui-router.dev/data/ at build time).
// Layout is computed here, not in the browser: ranks come from the edges
// (basis -> stations -> plates -> sheets), plate rows are pinned to their
// writer's row so every «writes» edge is horizontal, and sheets are ordered by
// the barycentre of the plates they read.  cytoscape draws it with `preset` —
// no physics, so the picture is the same on every load.
import { ATLAS } from './census-atlas.mjs';
import { PROJECT_MARK, articleTitle } from './chrome.mjs';
import { LANE_KEYS_JS, LANE_TOUCH_JS, PLATE_FOCUS_JS } from './focus.mjs';
import { glyph } from './icons.mjs';
import { basisStrip, laneCss, laneHints } from './lane-chrome.mjs';
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
const BANDGAP = 44;                            // clears the band head off the first station in it
let cursor = 0;
for (const b of BANDS) {
  bandY.set(b.key, cursor);
  cursor += BANDGAP;
  for (const nd of b.nodes) { place(nd.id, COL.probe, cursor); cursor += PITCH; }
  cursor += 26;
}
const SPAN = cursor - 26 - BANDGAP;
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
// the cover is not a sheet; like the rack in appendix A2, it leads
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
  if (nd.kind === 'sheet') return nd.num === null ? nd.title : `${/^[A-Z]/.test(nd.num) ? '' : 'S'}${nd.num} ${nd.title}`;
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
  // Lucide on the panel heads: the card's own subject (pipeline) at rest;
  // arrow-down-to-line on the ties that come in, arrow-up-from-line on the
  // ties that go out
  glyphs: { rest: glyph('ic-pipeline'), in: glyph('arrow-down-to-line'), out: glyph('arrow-up-from-line') },
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

const CSS = laneCss('pg', 'break-all');

// The init script is written without template placeholders on purpose: it is
// emitted inside one, and all of its data arrives through the JSON islands.
const INIT = `
(function () {
$$FOCUS  // The cytoscape tag above is deferred; deferred scripts run before
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
      paper: tok('--paper'), paper2: tok('--paper-2'), line: tok('--edge'), red: tok('--red'),
      data: tok('--data') || '"Barlow Semi Condensed", sans-serif' };
  }
  var sprites = function () { return L.sprites[dark() ? 'dark' : 'light']; };

  // the url names a building by the census label it stands for (a file name), never by its id
  var pinIds = {};
  var els = [];
  A.nodes.forEach(function (n) {
    var p = L.nodes[n.id];
    pinIds[n.label] = 'n' + n.id;
    els.push({ data: { id: 'n' + n.id, nid: n.id, key: n.label, label: p.label, kind: n.kind, w: p.w, h: p.h,
      sprite: sprites()[p.sprite], skey: p.sprite }, position: { x: p.x, y: p.y }, classes: p.classes });
  });
  if (!pinIds[L.basis.label]) pinIds[L.basis.label] = L.basis.id;
  els.push({ data: { id: L.basis.id, key: L.basis.label, label: L.basis.label, kind: 'basis', w: L.basis.w, h: L.basis.h,
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
        'font-family': c.data, 'font-size': 13, color: c.ink,
        'text-halign': 'center', 'overlay-opacity': 0, 'transition-property': 'opacity', 'transition-duration': '110ms' } },
      { selector: 'node.hero', style: { 'border-width': 2.2, 'border-color': c.accent, color: c.accent,
        'font-size': 14.5, 'font-weight': 'bold' } },
      { selector: 'node.k-basis', style: { 'border-width': 1.6, 'border-color': c.ink } },
      { selector: 'node.band', style: { 'background-opacity': 0, 'background-image': 'none', 'border-width': 0,
        label: 'data(label)', 'text-valign': 'center', 'text-halign': 'right', 'text-margin-x': 2,
        'text-wrap': 'none', 'font-size': 13, color: c.soft, events: 'no' } },
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
      { selector: 'node.pick', style: { 'border-width': 3, 'border-color': c.ink, opacity: 1 } },
      { selector: 'edge.lit', style: { opacity: 1, width: 2.4, 'line-color': c.accent, 'target-arrow-color': c.accent } },
      { selector: '.small', style: { label: '' } }
    ];
  }

  var cy = cytoscape({ container: stage, elements: els, style: style(pal()), layout: { name: 'preset' },
    minZoom: 0.2, maxZoom: 2.6, autoungrabify: true });
  // The stage keeps a handle on its own graph. Nothing on the page reads it;
  // generator/thumbs.mjs does, to re-lay this lane into the portrait window of
  // a cover card before photographing it — a landscape slice read as a corner.
  stage.__cy = cy;

  // a label under 6.5 css px on screen is dropped rather than drawn as fuzz
  var sizing = 0;
  function floorLabels() {
    sizing = 0;
    var z = cy.zoom();
    cy.batch(function () {
      cy.nodes().forEach(function (n) { n.toggleClass('small', n.numericStyle('font-size') * z < 6.5); });
    });
  }
  cy.on('zoom', function () { if (!sizing) sizing = requestAnimationFrame(floorLabels); });
  floorLabels();

  function showTools(on) {
    cy.elements('.tool').style('display', on ? 'element' : 'none');
    cy.fit(cy.elements(':visible'), 34);
  }
  showTools(false);

  var info = document.getElementById('pg-info');
  var IDLE = '<h4>' + L.glyphs.rest + 'THE SURVEY OFFICE</h4><p class="hint">Hover or tap any building to light its neighbourhood: '
    + 'what wrote it, what reads it, what it imports. The wide accent fan leaving the master plate is the '
    + 'one-measurement-many-views claim, drawn. A tap pins a building and the link in the address bar carries '
    + 'the pin; tap it again or the ground to clear it.</p>';
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
    h += list(L.glyphs.in + 'WRITTEN BY', ins.filter(function (e) { return e.rel === 'writes'; }).map(function (e) { return nameOf(e.from); }));
    h += list(L.glyphs.out + 'WRITES', outs.filter(function (e) { return e.rel === 'writes'; }).map(function (e) { return nameOf(e.to); }));
    h += list(L.glyphs.in + 'READS', ins.filter(function (e) { return e.rel === 'reads'; }).map(function (e) { return nameOf(e.from); }));
    h += list(L.glyphs.out + 'READ BY', outs.filter(function (e) { return e.rel === 'reads'; }).map(function (e) { return nameOf(e.to); }));
    h += list(L.glyphs.out + 'IMPORTS', outs.filter(function (e) { return e.rel === 'imports'; }).map(function (e) { return nameOf(e.to); }));
    var importers = ins.filter(function (e) { return e.rel === 'imports'; }).map(function (e) { return nameOf(e.from); });
    h += list(L.glyphs.in + 'IMPORTED BY · ' + importers.length + ' stations', importers);
    return h;
  }

  function clear() { cy.elements().removeClass('dim lit pick'); info.innerHTML = IDLE; }
  function focus(node) {
    if (node.hasClass('band')) return;
    var hood = node.closedNeighborhood();
    cy.elements().removeClass('lit pick').addClass('dim');
    hood.removeClass('dim');
    hood.addClass('lit');
    node.removeClass('lit').addClass('pick');
    var id = node.data('nid');
    info.innerHTML = typeof id === 'number' ? describe(id)
      : '<h4>' + node.data('label') + '</h4>' + field('KIND', 'the archive basis') + field('BASIS', L.basis.sub)
        + field('OPENS', L.basis.ties.length + ' stations materialize this ref');
  }
  // hover previews over the pin; a tap pins, and the pinned building or the ground clears it
  var pinned = null;
  function show(node) { if (node) focus(node); else clear(); }
  function tap(node) {
    var next = node && pinned && node.same(pinned) ? null : node;
    if (next === pinned) return;
    pinned = next;
    show(pinned);
    atlasFocusPush(stage, pinned ? pinned.data('key') : null);
  }
  // a url or keyboard pin brings its neighbourhood in, held between 0.7 and 1.2; a clear returns to the whole survey
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // centre the hood at a zoom it fits, keep the pin 64px inside, and never show more than 48px of paper past the graph
  function frameOn(pin, hood, all, floor) {
    var W = cy.width(), H = cy.height(), bb = hood.boundingBox(), g = all.boundingBox();
    var p = pin.isNode() ? pin.position() : pin.midpoint();
    var z = Math.max(floor, Math.min(1.2, (W - 96) / bb.w, (H - 96) / bb.h));
    var x = W / 2 - z * (bb.x1 + bb.w / 2), y = H / 2 - z * (bb.y1 + bb.h / 2);
    var px = x + z * p.x, py = y + z * p.y;
    x += Math.max(0, 64 - px) - Math.max(0, px - (W - 64));
    y += Math.max(0, 64 - py) - Math.max(0, py - (H - 64));
    if (z * g.w > W - 96) x = Math.min(48 - z * g.x1, Math.max(W - 48 - z * g.x2, x));
    if (z * g.h > H - 96) y = Math.min(48 - z * g.y1, Math.max(H - 48 - z * g.y2, y));
    return { zoom: z, pan: { x: x, y: y } };
  }
  function frame(node) {
    var ms = reduced ? 0 : 260, all = cy.elements(':visible');
    cy.stop(true);
    if (!node) { cy.animate({ fit: { eles: all, padding: 34 }, duration: ms }); return; }
    cy.animate(Object.assign(frameOn(node, node.closedNeighborhood().filter(':visible'), all, 0.7), { duration: ms }));
  }
  function steer(node) {
    var was = pinned;
    tap(node);
    if (pinned !== was) frame(pinned);
  }
  var tools = document.getElementById('pg-tools');
  function apply(key) {
    var id = key ? pinIds[key] : null;
    var node = id ? cy.getElementById(id) : null;
    if (node === pinned || (node && pinned && node.same(pinned))) return;
    pinned = node;
    // a pinned tool opens the ledger it stands in
    if (pinned && pinned.hasClass('tool') && !tools.checked) { tools.checked = true; showTools(true); }
    show(pinned);
    frame(pinned);
  }
  cy.on('mouseover', 'node', function (e) { if (!e.target.hasClass('band')) focus(e.target); });
  cy.on('mouseout', 'node', function () { show(pinned); });
  cy.on('tap', function (e) {
    if (e.target === cy) { if (pinned) steer(null); }
    else if (e.target.isNode() && !e.target.hasClass('band')) tap(e.target);
  });
  clear();

  document.getElementById('pg-fit').addEventListener('click', function () { cy.fit(cy.elements(':visible'), 34); });
  tools.addEventListener('change', function (e) { showTools(e.target.checked); show(pinned); });
  apply(atlasFocusHost(stage, apply));
  atlasLaneKeys(stage, function () { return cy.nodes('[key]:visible'); }, function () { return pinned; }, steer);
  atlasLaneTouch(stage, cy, function () { cy.fit(cy.elements(':visible'), 34); });

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

const SUB = `THE CENSUS PIPELINE AS A LIVE GRAPH · ${A.stats.nodes} NODES · ${A.stats.edges} EDGES · ${A.stats.writes} WRITES / ${A.stats.reads} READS / ${A.stats.imports} IMPORTS`;
// The gallery index's own FIT VERDICT line for this lane — one wording, two places.
export const PIPELINE_VERDICT = "appendix A2's cytoscape sibling — the same introspected nodes and edges, hoverable; the master plate's fan-out is the hero";
const VERDICT = PIPELINE_VERDICT;

// The sheet meta, in the shape build.mjs's sheet objects have: this lane is
// A2i, the appendix's one lane: drawn here and mounted in the gallery's appendix,
// on its own standalone page and as the app's a2i fragment. `sub` and `caption`
// are the section's own strings.
export const sheetA2i = {
  num: 'A2i',
  appendix: true,
  id: 'pipeline-interactive',
  rev: REV,
  title: 'THE SURVEY OFFICE — INTERACTIVE',
  scale: 'THE CENSUS PIPELINE',
  form: 'INTERACTIVE GRAPH',
  sub: SUB,
  caption: VERDICT,
};

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
  <div class="sheet-head"><span class="proj">${PROJECT_MARK} — INTERACTIVE PLATE</span><span class="shno">APPENDIX ${sheetA2i.num} · META · REV ${REV}</span></div>
  <h2 class="sheet-title">${articleTitle('THE SURVEY OFFICE')} — INTERACTIVE</h2>
  <p class="sheet-sub">${SUB}</p>
  <div class="pg-bar">
    <div class="pg-legend">
    ${legend}
    </div>
    <div class="pg-ctl">
      <span id="pg-hint" class="hints">${laneHints(`<span class="nw">${glyph('move')}DRAG TO PAN</span> <span class="nw">${glyph('mouse')}SCROLL TO ZOOM</span>`)}</span>
      <label><input type="checkbox" id="pg-tools"> <span>${glyph('wrench')}TOOLS LEDGER</span></label>
      <button type="button" id="pg-fit">${glyph('scan')}FIT</button>
    </div>
  </div>
  <div class="pg-stage fillable"><button type="button" class="fill" data-fill aria-label="Fill the window with this figure, or leave it"></button>
    <div class="pg-cy" id="pg-cy" role="application" tabindex="0" aria-label="Interactive flow graph of the census pipeline: archive basis, ${A.stats.probes} probe stations, ${A.stats.plates} filed plates and ${A.stats.drawings} drawings. With the graph focused, the arrow keys step the pin through the buildings and Escape clears it."></div>
    <aside class="pg-info" id="pg-info"></aside>
  </div>
  ${basisStrip('pg', `all ${A.stats.plates} plates pinned to ${A.ref} @ ${A.sha} · commit <span class="nw">${A.commitDate}</span> · ${A.stats.nodes} nodes and ${A.stats.edges} edges introspected from <code>www/atlas.lit-ui-router.dev/generator/</code> and <code>www/atlas.lit-ui-router.dev/data/</code> by <code>generator/census-atlas.mjs</code> and embedded here verbatim; layout ranked from those edges, drawn with cytoscape <code>preset</code> — no physics. The archive basis is the one node the census does not contain: it is drawn from the plates' own shared pin.`)}
</section>
<script type="application/json" id="pg-atlas">${json({ nodes: A.nodes, edges: A.edges })}</script>
<script type="application/json" id="pg-layout">${json(LAYOUT)}</script>
<script defer src="${CYTOSCAPE_URL}"></script>
<script>${INIT.replace('$$FOCUS', () => PLATE_FOCUS_JS + LANE_KEYS_JS + LANE_TOUCH_JS)}</script>`;
}

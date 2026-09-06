// SHEET 1i — THE RENDER LOOP, WALKED: sheet 1's circuit stood up and STEPPED.
// The data model is diagrams/data/census-loop.json's own `stations`, `legs`
// and `walk` — the buildings of sheet 1, the arrows between them with the call
// or event that carries each, and ONE navigation (a click on `<a uiSref>` from
// /people to /people/32) as an ordered list of steps, every step citing the
// verbatim source lines it stands on — shipped to the page VERBATIM as a JSON
// island.  Layout is computed here, not in the browser: the loop reads
// clockwise as sheet 1 does, the two overlays stand inside the ring because
// they are not on the route, and cytoscape draws the result with `preset` —
// no physics, so the picture is identical on every load.
//
// The hero interaction is the WALK: ◀ PREV · NEXT ▶ (and ← → while the lane
// has focus) step the pointer through the navigation; the current step's legs
// burn in accent, the legs already walked stay in ink, the rest wait faint,
// and the panel reads the narration and the evidence out of the plate.
import { readFileSync } from 'node:fs';
import { PALETTES } from './sprites.mjs';
import { CYTOSCAPE_URL } from './pipeline-graph.mjs';

export const REV = 'A';

const PLATE = JSON.parse(readFileSync(new URL('../data/census-loop.json', import.meta.url), 'utf8'));
const STATIONS = PLATE.stations;
const LEGS = PLATE.legs;
const WALK = PLATE.walk;
const T = PLATE.totals;
if (!STATIONS?.length || !LEGS?.length || !WALK?.length) throw new Error('loop-walk: diagrams/data/census-loop.json carries no stations, legs or walk — re-run generator/census-loop.mjs');

// The plate must agree with itself: the walk and the tally are two readings of
// the same probe run, and a mismatch means a half-refreshed plate.
for (const [what, got, want] of [
  ['stations', STATIONS.length, T.stations], ['legs', LEGS.length, T.legs], ['steps', WALK.length, T.steps],
  ['evidence lines', WALK.reduce((a, s) => a + s.evidence.length, 0), T.evidence],
]) {
  if (got !== want) throw new Error(`loop-walk: the plate lists ${got} ${what}, its tally says ${want} — re-run generator/census-loop.mjs`);
}
const sid = new Set(STATIONS.map((s) => s.id));
const lid = new Map(LEGS.map((l) => [l.id, l]));
for (const l of LEGS) {
  if (!sid.has(l.from) || !sid.has(l.to)) throw new Error(`loop-walk: leg ${l.id} joins ${l.from} → ${l.to}, and one of those is not a station`);
}
for (const s of WALK) {
  for (const l of s.legs) if (!lid.has(l)) throw new Error(`loop-walk: step ${s.step} lights ${l}, which is not a leg`);
  for (const e of s.evidence) {
    if (!/^packages\/lit-ui-router\/src\/[\w.-]+\.ts$/.test(e.file) || !Number.isInteger(e.line) || !e.text) throw new Error(`loop-walk: step ${s.step} cites ${e.file}:${e.line} without a verbatim text`);
    if (e.text.split('\n').length > 3) throw new Error(`loop-walk: step ${s.step}'s excerpt at ${e.file}:${e.line} runs past 3 lines`);
  }
}
const KINDS = ['loop', 'click', 'event', 'tap'];
for (const l of LEGS) if (!KINDS.includes(l.kind)) throw new Error(`loop-walk: leg ${l.id} is of kind ${l.kind}, which the key does not draw`);
const stepsOf = (id) => WALK.filter((s) => s.legs.includes(id)).map((s) => s.step);
for (const l of LEGS) if (!stepsOf(l.id).length) throw new Error(`loop-walk: the walk never lights ${l.id}`);

const fmt = (v) => v.toLocaleString('en-US');

// ---- geometry: the ring reads clockwise, overlays stand inside it ----------
// Sheet 1's order around the loop — location, core, the hall, the view (its
// child below it), Lit render, the document with the link on it — and the two
// stations that are not on the route inside the ring: sheet 1's key says
// "elevated = overlay, not on the route"; here that is "inside".
const NODE = 64;
// [x, y, where the lettering goes] — a label sits on the side no leg arrives at.
const POS = new Map([
  ['location', [90, 260, 'bottom']],
  ['core', [330, 80, 'top']],
  ['hall', [640, 80, 'top']],
  ['view', [900, 170, 'top']],
  ['child', [900, 370, 'bottom']],
  ['render', [640, 470, 'bottom']],
  ['document', [350, 470, 'bottom']],
  ['link', [110, 490, 'bottom']],
  ['active', [330, 270, 'bottom']],
  ['controller', [500, 260, 'bottom']],
]);
for (const s of STATIONS) if (!POS.has(s.id)) throw new Error(`loop-walk: station ${s.id} is on the plate but has no place on the ring`);
for (const id of POS.keys()) if (!sid.has(id)) throw new Error(`loop-walk: ${id} is placed on the ring but is not a station on the plate`);

// A leg that would otherwise lie on top of another (the child's context event
// runs back up the descend leg) or cut a building bows clear; the rest run straight.
const BOW = { nest: 70, target: -50, 'tap-active': 60 };

const NODES = STATIONS.map((s) => ({ ...s, x: POS.get(s.id)[0], y: POS.get(s.id)[1], lpos: POS.get(s.id)[2], w: NODE, h: NODE, sprite: s.id }));
const EDGES = LEGS.map((l) => ({ ...l, bow: BOW[l.id] ?? 0, steps: stepsOf(l.id) }));

// ---- sprite skins ---------------------------------------------------------
// The house recipe (INITIATIVES.md sprite note, and generator/sprites.mjs):
// the girding frame is drawn FIRST and a semi-opaque wall washed over it, so
// the frame reads through and the themed node body tints the building.  One
// building per station; the palettes are sprites.mjs's own.
function skins(p) {
  const n = (v) => Number(v.toFixed(1));
  const line = (x1, y1, x2, y2, stroke, w = 1, dash = '') =>
    `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const rect = (x, y, w, h, fill, stroke = 'none', sw = 1.4, dash = '') =>
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const poly = (pts, fill, stroke = 'none', sw = 1.4) =>
    `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  const girder = (x, y, w, h, cols, rows) => {
    let s = '';
    for (let i = 1; i < cols; i += 1) s += line(x + (w * i) / cols, y, x + (w * i) / cols, y + h, p.soft, 1);
    for (let j = 1; j < rows; j += 1) s += line(x, y + (h * j) / rows, x + w, y + (h * j) / rows, p.soft, 1);
    return s;
  };
  const shell = (x, y, w, h, cols = 3, rows = 2, fill = p.wall) =>
    girder(x, y, w, h, cols, rows) + rect(x, y, w, h, fill) + rect(x, y, w, h, 'none', p.ink, 1.4);
  const ground = line(5, 43.5, 43, 43.5, p.faint, 1.2);
  // an iso plate: a parallelogram lying on the ground, the document's own form
  const plate = (x, y, w, d, fill, stroke, sw = 1.2) =>
    poly(`${n(x)},${n(y)} ${n(x + w)},${n(y)} ${n(x + w - d)},${n(y + d)} ${n(x - d)},${n(y + d)}`, fill, stroke, sw);

  return {
    // LOCATION: a gatehouse — low, wide, one arch, a flag for the address bar
    location: ground
      + shell(8, 24, 32, 19, 4, 2)
      + poly('6,24 24,15 42,24', p.roof, p.ink, 1.4)
      + `<path d="M19,43 V33 a5,5 0 0 1 10,0 V43" fill="${p.glass}" stroke="${p.ink}" stroke-width="1.3"/>`
      + line(24, 15, 24, 6, p.ink, 1.2) + poly('24,6 32,9 24,12', p.accent),
    // @uirouter/core: the plant — the tallest building, a stack, a lit window row
    core: ground
      + shell(10, 12, 28, 31, 3, 4)
      + rect(10, 12, 28, 3.5, p.roof)
      + rect(31, 3, 5, 9, p.wall, p.ink, 1.3)
      + `<circle cx="33.5" cy="1.5" r="1.6" fill="${p.glass}"/>`
      + rect(14, 20, 4, 4, p.accent) + rect(22, 20, 4, 4, p.accent) + rect(30, 20, 4, 4, p.accent)
      + rect(21, 34, 6, 9, p.glass, p.ink, 1.2),
    // TRANSITION HALL: a long hall with three bays and three ridges
    hall: ground
      + shell(5, 26, 38, 17, 3, 1)
      + poly('3,26 24,16 45,26', p.roof, p.ink, 1.4)
      + line(15.7, 21, 15.7, 43, p.ink, 1.1) + line(32.3, 21, 32.3, 43, p.ink, 1.1)
      + rect(8.5, 34, 5, 9, p.glass, p.ink, 1.1) + rect(21.5, 34, 5, 9, p.accent, p.ink, 1.1) + rect(34.5, 34, 5, 9, p.glass, p.ink, 1.1),
    // <ui-view>: a viewport block — one large window, its frame the whole front
    view: ground
      + shell(9, 18, 30, 25, 2, 2)
      + rect(9, 18, 30, 3, p.roof)
      + rect(14, 25, 20, 13, p.glass, p.accent, 1.5)
      + line(14, 31.5, 34, 31.5, p.accent, 1),
    // the nested view: the same block, smaller, stood on a parent's slab
    child: ground
      + rect(6, 36, 36, 7.5, p.wall, p.ink, 1.3)
      + shell(14, 16, 20, 20, 2, 2)
      + rect(14, 16, 20, 2.6, p.roof)
      + rect(18, 22, 12, 9, p.glass, p.accent, 1.4),
    // LIT RENDER: a hall with a glass front, the template's backticks lettered on it
    render: ground
      + shell(7, 22, 34, 21, 4, 2)
      + poly('5,22 24,13 43,22', p.roof, p.ink, 1.4)
      + rect(11, 27, 26, 12, p.glass, p.ink, 1.2)
      + `<text x="24" y="37" font-family="ui-monospace, Menlo, monospace" font-size="9" font-weight="700" fill="${p.ink}" text-anchor="middle">html\`\`</text>`,
    // THE DOCUMENT: sheet 1's metaphor break — a window with its DOM rising in plates
    document: ground
      + rect(4, 30, 40, 13, p.wall, p.ink, 1.3)
      + rect(4, 30, 40, 4, p.roof)
      + `<circle cx="7.5" cy="32" r="0.9" fill="${p.soft}"/><circle cx="10.5" cy="32" r="0.9" fill="${p.soft}"/><circle cx="13.5" cy="32" r="0.9" fill="${p.soft}"/>`
      + plate(14, 24, 26, 5, p.wall, p.ink, 1.1)
      + plate(17, 17, 22, 5, p.wall, p.ink, 1.1)
      + plate(20, 10, 18, 5, p.glass, p.accent, 1.2),
    // <a uiSref>: the topmost plate alone, the link lettered on it in accent
    link: ground
      + plate(12, 24, 30, 9, p.wall, p.ink, 1.3)
      + line(9, 33, 36, 33, p.faint, 1)
      + rect(15, 18, 16, 3.2, p.accent)
      + line(23, 18, 23, 10, p.accent, 1.2) + `<circle cx="23" cy="8.5" r="1.8" fill="${p.accent}"/>`,
    // uiSrefActive: the watchtower — a cabin on stilts, a lamp on the roof
    active: ground
      + line(13, 43, 16, 24, p.ink, 1.3) + line(35, 43, 32, 24, p.ink, 1.3) + line(14, 36, 34, 36, p.soft, 1)
      + shell(12, 12, 24, 12, 3, 1)
      + poly('10,12 24,6 38,12', p.roof, p.ink, 1.4)
      + `<circle cx="24" cy="4" r="2.2" fill="${p.accent}"/>`
      + rect(21, 15, 6, 6, p.glass, p.ink, 1.1),
    // TransitionController: the skybridge — a deck on two piers, a tap dropped from it
    controller: ground
      + line(11, 43, 11, 22, p.ink, 1.4) + line(37, 43, 37, 22, p.ink, 1.4)
      + shell(6, 15, 36, 8, 4, 1)
      + rect(6, 15, 36, 2.4, p.roof)
      + line(24, 23, 24, 38, p.soft, 1.2, '2 2') + `<circle cx="24" cy="39.5" r="1.8" fill="${p.accent}"/>`,
  };
}

const uri = (body) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">${body}</svg>`)}`;
const SKINS = Object.fromEntries(Object.entries(PALETTES).map(([t, p]) =>
  [t, Object.fromEntries(Object.entries(skins(p)).map(([k, b]) => [k, uri(b)]))]));
for (const s of STATIONS) if (!SKINS.light[s.id]) throw new Error(`loop-walk: no sprite is authored for station ${s.id}`);
const skinSvg = (k, theme) => `<svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true">${skins(PALETTES[theme])[k]}</svg>`;

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------
const CSS = `
.lw { max-width: 1300px; margin: 0 auto 40px; }
.lw-bar { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; justify-content: space-between;
  border: 1.5px solid var(--ink); border-bottom: none; background: var(--paper-2); padding: 8px 14px; }
.lw-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; }
.lw-legend .lg { display: inline-flex; align-items: center; gap: 7px; font-family: var(--data); font-size: 9.5px;
  letter-spacing: 0.06em; color: var(--ink-soft); }
.lw-legend .lg svg { display: block; }
.lw-legend .lg .sw-dark { display: none; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .lw-legend .lg .sw-light { display: none; }
  :root:not([data-theme="light"]) .lw-legend .lg .sw-dark { display: block; }
}
:root[data-theme="dark"] .lw-legend .lg .sw-light { display: none; }
:root[data-theme="dark"] .lw-legend .lg .sw-dark { display: block; }
.lw-legend .lg i { display: block; width: 24px; height: 0; border-top-width: 2px; border-top-style: solid; }
.lw-ctl { display: flex; gap: 10px; align-items: center; font-family: var(--data); font-size: 9.5px;
  letter-spacing: 0.1em; color: var(--ink-soft); }
.lw-ctl button { font: inherit; letter-spacing: inherit; color: var(--ink); background: var(--paper);
  border: 1px solid var(--ink); padding: 4px 9px; cursor: pointer; }
.lw-ctl button:hover { background: var(--paper-2); }
.lw-ctl button:disabled { color: var(--ink-faint); border-color: var(--line); cursor: default; background: var(--paper); }
.lw-ctl .lw-step { color: var(--accent); font-weight: 600; min-width: 9ch; text-align: center;
  font-variant-numeric: tabular-nums; }
.lw-stage { display: grid; grid-template-columns: minmax(0, 1fr) 300px; border: 1.5px solid var(--ink);
  background: var(--paper); }
.lw-stage:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.lw-cy { height: 600px; min-width: 0; }
.lw-info { border-left: 1.5px solid var(--ink); background: var(--paper-2); padding: 12px 14px;
  font-family: var(--data); font-size: 10.5px; letter-spacing: 0.04em; color: var(--ink); overflow-y: auto;
  max-height: 600px; }
.lw-info h4 { font-size: 11.5px; letter-spacing: 0.06em; margin-bottom: 8px; word-break: break-word; }
.lw-info h4 .n { color: var(--accent); }
.lw-info .f { display: block; font-size: 8.5px; letter-spacing: 0.16em; color: var(--ink-soft); margin: 9px 0 2px; }
.lw-info p { font-family: var(--serif); font-size: 13px; letter-spacing: 0; line-height: 1.45; color: var(--ink); }
.lw-info ul { list-style: none; padding: 0; }
.lw-info li { padding: 1px 0; color: var(--ink-soft); word-break: break-word; }
.lw-info li .now { color: var(--accent); }
.lw-info .ev { margin: 4px 0 8px; }
.lw-info .ev .at { display: block; font-size: 9.5px; color: var(--accent); letter-spacing: 0.04em; margin-bottom: 2px; }
.lw-info .ev pre { font-family: var(--code); font-size: 9.5px; letter-spacing: 0; line-height: 1.35;
  color: var(--ink); background: var(--paper); border: 1px solid var(--line); padding: 4px 6px; margin: 0;
  overflow-x: auto; white-space: pre; }
.lw-info .hint { color: var(--ink-faint); }
.lw-basis { font-family: var(--data); font-size: 9.5px; letter-spacing: 0.06em; color: var(--ink-faint);
  border: 1.5px solid var(--ink); border-top: none; background: var(--paper-2); padding: 8px 14px 9px; }
@media (max-width: 860px) {
  .lw-stage { grid-template-columns: 1fr; }
  .lw-info { border-left: none; border-top: 1.5px solid var(--ink); max-height: none; }
}`;

// Written without template placeholders on purpose: this is emitted inside one,
// and every byte of data reaches it through the JSON islands.
const INIT = `
(function () {
  // The cytoscape tag is deferred; deferred scripts run BEFORE DOMContentLoaded,
  // so boot there rather than probing the global during parse.
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
  function boot() {
  var stage = document.getElementById('lw-cy');
  var info = document.getElementById('lw-info');
  var wrap = document.getElementById('lw-stage');
  if (!stage || !info || !wrap) return;
  if (typeof cytoscape === 'undefined') {
    info.innerHTML = '\\u003ch4\\u003eTHE RENDER LOOP\\u003c/h4\\u003e\\u003cp class="hint"\\u003ecytoscape did not load, so the '
      + 'walk is not available here. Sheet 1 draws the same circuit as a static plate, and '
      + 'diagrams/data/census-loop.json carries every station, leg and step of it.\\u003c/p\\u003e';
    return;
  }
  var P = JSON.parse(document.getElementById('lw-plate').textContent);
  var L = JSON.parse(document.getElementById('lw-layout').textContent);
  var N = L.nodes, E = L.edges, W = P.walk;
  var byId = {}; N.forEach(function (n) { byId[n.id] = n; });
  var legById = {}; E.forEach(function (e) { legById[e.id] = e; });
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

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
  var skins = function () { return L.skins[dark() ? 'dark' : 'light']; };

  var els = [];
  N.forEach(function (n) {
    els.push({ data: { id: 's-' + n.id, sid: n.id, label: n.label, sprite: skins()[n.sprite], skey: n.sprite, w: n.w, h: n.h, lpos: n.lpos, lgap: n.lpos === 'top' ? -6 : 6 },
      position: { x: n.x, y: n.y }, classes: 'station' });
  });
  E.forEach(function (e) {
    els.push({ data: { id: 'l-' + e.id, lid: e.id, source: 's-' + e.from, target: 's-' + e.to, label: e.short, bow: e.bow },
      classes: 'leg k-' + e.kind + (e.bow ? ' bow' : '') });
  });

  function style(c) {
    var face = c.data;
    return [
      { selector: 'node.station', style: { 'background-color': c.paper, 'background-image': 'data(sprite)',
        'background-fit': 'contain', 'background-clip': 'none', 'border-width': 1.1, 'border-color': c.line,
        shape: 'round-rectangle', width: 'data(w)', height: 'data(h)', label: 'data(label)',
        'text-valign': 'data(lpos)', 'text-margin-y': 'data(lgap)', 'text-wrap': 'none', 'font-family': face, 'font-size': 12,
        'font-weight': 600, color: c.ink, 'text-halign': 'center', 'overlay-opacity': 0,
        'transition-property': 'opacity, border-color', 'transition-duration': reduced.matches ? '0ms' : '140ms' } },
      { selector: 'edge.leg', style: { 'curve-style': 'straight', 'target-arrow-shape': 'triangle', 'arrow-scale': 0.8,
        'line-color': c.faint, 'target-arrow-color': c.faint, width: 1.2, opacity: 0.55, label: 'data(label)',
        'font-family': face, 'font-size': 9.5, color: c.faint, 'text-rotation': 'autorotate',
        'text-background-color': c.paper, 'text-background-opacity': 0.92, 'text-background-padding': 2,
        'transition-property': 'line-color, opacity, width', 'transition-duration': reduced.matches ? '0ms' : '140ms' } },
      { selector: 'edge.bow', style: { 'curve-style': 'unbundled-bezier', 'control-point-distances': 'data(bow)',
        'control-point-weights': 0.5 } },
      { selector: 'edge.k-loop', style: { width: 2 } },
      { selector: 'edge.k-click', style: { width: 1.8 } },
      { selector: 'edge.k-event, edge.k-tap', style: { 'line-style': 'dashed', 'line-dash-pattern': [4, 3], width: 1.2 } },
      { selector: 'edge.walked', style: { 'line-color': c.soft, 'target-arrow-color': c.soft, color: c.soft, opacity: 0.9 } },
      { selector: 'edge.k-loop.walked, edge.k-click.walked', style: { 'line-color': c.ink, 'target-arrow-color': c.ink } },
      { selector: 'edge.now', style: { 'line-color': c.accent, 'target-arrow-color': c.accent, color: c.accent,
        opacity: 1, width: 3.2, 'z-index': 9 } },
      { selector: 'edge.now.k-event, edge.now.k-tap', style: { width: 2.4 } },
      { selector: 'node.touched', style: { 'border-color': c.soft } },
      { selector: 'node.lit', style: { 'border-width': 2.6, 'border-color': c.accent, color: c.accent } },
      { selector: 'node.pick', style: { 'border-width': 3, 'border-color': c.red } },
      { selector: '.dim', style: { opacity: 0.18 } },
      { selector: 'edge.hover', style: { 'line-color': c.red, 'target-arrow-color': c.red, color: c.red, opacity: 1 } }
    ];
  }

  var cy = cytoscape({ container: stage, elements: els, style: style(pal()), layout: { name: 'preset' },
    minZoom: 0.3, maxZoom: 2.6, autoungrabify: true });
  cy.fit(cy.elements(), 42);

  // ---- the walk ------------------------------------------------------------
  var step = 0;                                    // 0 = the circuit at rest
  var counter = document.getElementById('lw-step');
  var prev = document.getElementById('lw-prev');
  var next = document.getElementById('lw-next');
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/\\u003c/g, '&lt;').replace(/>/g, '&gt;'); };
  function field(k, v) { return '\\u003cspan class="f"\\u003e' + k + '\\u003c/span\\u003e' + v; }
  function evidence(list) {
    return list.map(function (e) {
      return '\\u003cdiv class="ev"\\u003e\\u003cspan class="at"\\u003e' + esc(e.file.replace(/^packages\\/lit-ui-router\\//, '')) + ':' + e.line
        + '\\u003c/span\\u003e\\u003cpre\\u003e' + esc(e.text) + '\\u003c/pre\\u003e\\u003c/div\\u003e';
    }).join('');
  }
  function legLine(id, now) {
    var e = legById[id];
    return '\\u003cli\\u003e' + (now ? '\\u003cspan class="now"\\u003e' : '') + esc(byId[e.from].label) + ' \\u2192 ' + esc(byId[e.to].label)
      + (now ? '\\u003c/span\\u003e' : '') + ' \\u00b7 ' + esc(e.carrier) + '\\u003c/li\\u003e';
  }
  function describeStep() {
    if (!step) {
      return '\\u003ch4\\u003eTHE RENDER LOOP \\u00b7 AT REST\\u003c/h4\\u003e\\u003cp\\u003e' + esc(L.idle) + '\\u003c/p\\u003e'
        + field('THE WALK', esc(P.walkOf) + ' \\u00b7 ' + W.length + ' steps');
    }
    var s = W[step - 1];
    var h = '\\u003ch4\\u003e\\u003cspan class="n"\\u003eSTEP ' + s.step + ' / ' + W.length + '\\u003c/span\\u003e \\u00b7 ' + esc(s.title) + '\\u003c/h4\\u003e';
    h += '\\u003cp\\u003e' + esc(s.text) + '\\u003c/p\\u003e';
    h += field('LEGS LIT', '\\u003cul\\u003e' + s.legs.map(function (id) { return legLine(id, true); }).join('') + '\\u003c/ul\\u003e');
    h += field('EVIDENCE \\u00b7 ' + esc(P.ref) + ' @ ' + esc(P.sha), evidence(s.evidence));
    return h;
  }
  function paint() {
    var walked = {}, now = {};
    for (var i = 0; i < step; i += 1) {
      W[i].legs.forEach(function (id) { if (i === step - 1) now[id] = true; else walked[id] = true; });
    }
    cy.batch(function () {
      cy.elements().removeClass('walked now lit touched dim pick hover');
      cy.edges().forEach(function (e) {
        var id = e.data('lid');
        if (now[id]) e.addClass('now'); else if (walked[id]) e.addClass('walked');
      });
      cy.edges('.now').connectedNodes().addClass('lit');
      cy.edges('.walked').connectedNodes().not('.lit').addClass('touched');
    });
    counter.textContent = 'STEP ' + step + ' / ' + W.length;
    prev.disabled = step === 0;
    next.disabled = step === W.length;
    info.innerHTML = describeStep();
  }
  function go(n) { step = Math.max(0, Math.min(W.length, n)); paint(); }
  prev.addEventListener('click', function () { go(step - 1); });
  next.addEventListener('click', function () { go(step + 1); });
  document.getElementById('lw-reset').addEventListener('click', function () { go(0); cy.fit(cy.elements(), 42); });
  // ← → only while the lane has focus: the routed app walks sheets with the same keys
  wrap.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(step + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(step - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(W.length); }
  });
  stage.addEventListener('pointerdown', function () { wrap.focus({ preventScroll: true }); });

  // ---- hover: a station's file and anchor, its legs in and out ----------
  function describeStation(id) {
    var n = byId[id];
    var outs = E.filter(function (e) { return e.from === id; });
    var ins = E.filter(function (e) { return e.to === id; });
    var h = '\\u003ch4\\u003e' + esc(n.label) + '\\u003c/h4\\u003e';
    h += field('WHAT', esc(n.sub));
    h += field('ANCHOR', evidence([n]));
    if (outs.length) h += field('LEGS OUT', '\\u003cul\\u003e' + outs.map(function (e) { return legLine(e.id, false); }).join('') + '\\u003c/ul\\u003e');
    if (ins.length) h += field('LEGS IN', '\\u003cul\\u003e' + ins.map(function (e) { return legLine(e.id, false); }).join('') + '\\u003c/ul\\u003e');
    return h;
  }
  function describeLeg(id) {
    var e = legById[id];
    var h = '\\u003ch4\\u003e' + esc(byId[e.from].label) + ' \\u2192 ' + esc(byId[e.to].label) + '\\u003c/h4\\u003e';
    h += field('KIND', e.kind + ' \\u00b7 ' + L.kinds[e.kind]);
    h += field('CARRIED BY', esc(e.carrier));
    h += field('LIT AT STEP' + (e.steps.length > 1 ? 'S' : ''), e.steps.join(', '));
    h += field('EVIDENCE', evidence([e]));
    return h;
  }
  cy.on('mouseover', 'node.station', function (ev) {
    var node = ev.target;
    cy.elements().addClass('dim');
    node.closedNeighborhood().removeClass('dim');
    node.addClass('pick');
    info.innerHTML = describeStation(node.data('sid'));
  });
  cy.on('mouseover', 'edge.leg', function (ev) {
    var edge = ev.target;
    cy.elements().addClass('dim');
    edge.removeClass('dim').addClass('hover');
    edge.connectedNodes().removeClass('dim');
    info.innerHTML = describeLeg(edge.data('lid'));
  });
  cy.on('mouseout', 'node, edge', function () { paint(); });
  cy.on('tap', 'node.station', function (ev) { info.innerHTML = describeStation(ev.target.data('sid')); });
  cy.on('tap', 'edge.leg', function (ev) { info.innerHTML = describeLeg(ev.target.data('lid')); });
  paint();

  function repaint() {
    var s = skins();
    cy.batch(function () {
      cy.nodes('.station').forEach(function (n) { n.data('sprite', s[n.data('skey')]); });
    });
    cy.style(style(pal()));
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', repaint);
  reduced.addEventListener('change', repaint);
  new MutationObserver(repaint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
})();
`;

const KIND_WORDS = {
  loop: 'the render cycle itself',
  click: 'the click flying back into core',
  event: 'a composed DOM event stations find each other by',
  tap: 'a transition hook an overlay registers without standing on the route',
};

export const LOOP = {
  stations: T.stations,
  legs: T.legs,
  steps: T.steps,
  evidence: T.evidence,
  files: T.files,
  byKind: T.byKind,
  walkOf: PLATE.walkOf,
  ref: PLATE.ref,
  sha: PLATE.sha,
  commitDate: PLATE.commitDate.slice(0, 10),
  // on the route = touched by the cycle or by the click that re-enters it
  overlays: STATIONS.filter((s) => !LEGS.some((l) => (l.kind === 'loop' || l.kind === 'click') && (l.from === s.id || l.to === s.id))).map((s) => s.label),
  onRing: STATIONS.filter((s) => LEGS.some((l) => (l.kind === 'loop' || l.kind === 'click') && (l.from === s.id || l.to === s.id))).length,
  hooksOn: [...new Set(LEGS.filter((l) => l.kind === 'tap').map((l) => l.from))],
  firstStep: WALK[0].title,
  lastStep: WALK[WALK.length - 1].title,
  clickStep: WALK.find((s) => s.legs.includes('click'))?.step,
  fmt,
};
if (!LOOP.clickStep) throw new Error('loop-walk: no step of the walk lights the click leg');

// ---------------------------------------------------------------------------
export function loopWalkLane() {
  const island = {
    nodes: NODES,
    edges: EDGES,
    skins: SKINS,
    kinds: KIND_WORDS,
    idle: `Sheet 1's circuit, stood up: ${T.stations} stations and the ${T.legs} legs between them, every leg carrying the call or event that moves it. Press NEXT (or → with the lane focused) to walk one navigation — ${PLATE.walkOf} — ${T.steps} steps, each one standing on the source lines it cites. Hover any building for its file and anchor line, any leg for what carries it.`,
  };
  const swatch = (k) => `<span class="sw sw-light">${skinSvg(k, 'light')}</span><span class="sw sw-dark">${skinSvg(k, 'dark')}</span>`;
  const legend = [
    ['core', 'a station on the route'],
    ['active', 'an overlay — inside the ring, never on it'],
  ].map(([k, d]) => `<span class="lg">${swatch(k)}${d}</span>`).join('\n    ')
    + '\n    ' + [
      ['loop leg', 'var(--ink)', 'solid'],
      ['the click', 'var(--accent)', 'solid'],
      ['event / hook tap', 'var(--ink-soft)', 'dashed'],
      ['the leg lit now', 'var(--accent)', 'solid'],
    ].map(([rel, col, st]) => `<span class="lg"><i style="border-top-color:${col};border-top-style:${st}"></i>${rel}</span>`).join('\n    ');

  return `<style>${CSS}</style>
<div class="lw-bar">
  <div class="lw-legend">
    ${legend}
  </div>
  <div class="lw-ctl" role="group" aria-label="walk controls">
    <button type="button" id="lw-prev" aria-label="previous step">◀ PREV</button>
    <span class="lw-step" id="lw-step" aria-live="polite">STEP 0 / ${T.steps}</span>
    <button type="button" id="lw-next" aria-label="next step">NEXT ▶</button>
    <button type="button" id="lw-reset">RESET</button>
  </div>
</div>
<div class="lw-stage" id="lw-stage" tabindex="0" aria-label="the render loop, walkable — arrow keys step the walk while this lane has focus">
  <div class="lw-cy" id="lw-cy" role="img" aria-label="An interactive circuit of the lit-ui-router render loop: ${T.stations} stations — ${esc(STATIONS.map((s) => s.label).join(', '))} — joined by ${T.legs} legs, with one navigation (${esc(PLATE.walkOf)}) walked in ${T.steps} steps."></div>
  <aside class="lw-info" id="lw-info"></aside>
</div>
<p class="lw-basis">BASIS — <code>${esc(PLATE.used)}</code> by <code>generator/census-loop.mjs</code> · commit ${PLATE.commitDate.slice(0, 10)} · ${T.stations} stations, ${T.legs} legs, ${T.steps} steps and ${T.evidence} evidence lines read verbatim from <code>diagrams/data/census-loop.json</code>; the ring is sheet 1's own order, computed at build time and drawn with cytoscape <code>preset</code> — no physics, so the picture is the same on every load.</p>
<script type="application/json" id="lw-plate">${json({ ref: PLATE.ref, sha: PLATE.sha, walkOf: PLATE.walkOf, walk: WALK })}</script>
<script type="application/json" id="lw-layout">${json(island)}</script>
<script defer src="${CYTOSCAPE_URL}"></script>
<script>${INIT}</script>`;
}

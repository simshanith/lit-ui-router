// SHEET 2B — THE COUPLING BENCH: sheet 2A's interactive sibling.
//
// Seven nodes — the five published packages, @uirouter/core and lit — and every
// EDGE is a real coupling contract read from diagrams/data/census-couplings.json:
// the declared range as published, the section it lives in, and whether the peer
// is optional.  Nothing on the bench is hand-listed.
//
// Layout is computed HERE, not in the browser, and it deliberately echoes sheet
// 2A's arrangement: the socket wall at the left with lit above it, the companions
// in a column at its right in 2A's own order, the server below them with its one
// coupling drawn to be crossed out, and the eslint plugin in a bay of its own
// because it touches nothing else on the bench.  cytoscape draws it with
// `preset` — no physics, so the picture is the same on every load.
import { readFileSync } from 'node:fs';
import { CYTOSCAPE_URL } from './pipeline-graph.mjs';
import { SPRITES, spriteSvg } from './sprites.mjs';

export const REV = 'B';

const C = JSON.parse(readFileSync(new URL('../data/census-couplings.json', import.meta.url), 'utf8'));
const B = JSON.parse(readFileSync(new URL('../data/census-bricks.json', import.meta.url), 'utf8'));

const brick = (name) => B.rows.find((r) => r.name === name) ?? null;
// ---- the bench, in sheet 2A's arrangement -----------------------------------
// x/y are the preset coordinates; `short` is the label the bench can carry at
// node size, `band` the note lettered beside it (`halign` says which side).
// The wall stands at the left with lit lifted clear of it — the two peer fans
// then cross at a wide angle, and every range label lands in its own air rather
// than in the pile four identical `^6.0.8` labels would otherwise make.  The
// fifth package is not below the column but beside it: a bay, not a basement.
const BENCH = new Map([
  ['lit', { x: 250, y: -330, short: 'lit', band: 'THE OTHER PEER', halign: 'right' }],
  ['@uirouter/core', { x: 120, y: 95, short: '@uirouter/core', band: 'THE SOCKET WALL' }],
  ['lit-ui-router', { x: 560, y: -215, short: 'lit-ui-router' }],
  ['ui-router-navigation-location-plugin', { x: 560, y: -55, short: 'navigation-location-plugin' }],
  ['lit-ui-router-mobx', { x: 560, y: 95, short: 'lit-ui-router-mobx' }],
  ['ui-router-server', { x: 560, y: 275, band: 'OPTIONAL — THE TIE 2A DRAWS CROSSED OUT', short: 'ui-router-server', halign: 'right' }],
  ['eslint-plugin-lit-ui-router', { x: 940, y: 275, band: 'A BAY OF ITS OWN — COUPLES TO NOTHING HERE', short: 'eslint-plugin-lit-ui-router', halign: 'right' }],
]);
for (const n of C.nodes) {
  if (!BENCH.has(n.key)) throw new Error(`coupling-bench: ${n.key} is on the plate but has no place on the bench`);
}

// ---- massing: the brick schedule's own figures -------------------------------
// Front-face area tracks sloc the way sheet 2A's blocks do, the smallest companions
// clamped up to a legible minimum; the shape column sets the aspect.  lit is not
// in the brick schedule (it is not ours to count), so it takes a fixed crate.
const ASPECT = { '1x1': 1, '1x2': 1.2, '2x2': 1.25, '2x3': 1.4, '2x4': 1.6 };
const sizeOf = (key) => {
  const r = brick(key);
  if (!r) return { w: 54, h: 54 };
  const side = Math.max(32, Math.min(96, 1.19 * Math.sqrt(r.sloc)));
  const a = ASPECT[r.shape] ?? 1;
  return { w: Math.round(side * Math.sqrt(a)), h: Math.round(side / Math.sqrt(a)) };
};

// Sprite skins from sprites.mjs's vocabulary.  The station sprites are used for
// their DRAWING — a hut of 1, 2 or 3 storeys — and the storey count is the brick
// schedule's `courses` band, never a pipeline tier: the flagship is the tallest
// building on the bench because it has the most courses.
const STOREYS = (courses) => (courses >= 5 ? 'probe-T3' : courses >= 3 ? 'probe-T2' : 'probe-T1');
const spriteOf = (n) => {
  if (n.key === '@uirouter/core') return 'basis';        // the strongroom: peered by all, replaced by none
  if (n.kind === 'external') return 'tool-external';     // a crate off the yard — not ours to publish
  return STOREYS(brick(n.key)?.courses ?? 1);
};

const NODES = C.nodes.map((n) => {
  const b = BENCH.get(n.key);
  const r = brick(n.key);
  return {
    ...n,
    ...sizeOf(n.key),
    x: b.x,
    y: b.y,
    label: b.short,
    sprite: spriteOf(n),
    courses: r?.courses ?? null,
    sloc: r?.sloc ?? null,
    files: r?.files ?? null,
  };
});
// An edge between two nodes of the SAME column would be drawn as a vertical
// line straight through whatever stands between them (mobx -> lit-ui-router
// reads as passing through the nav plugin), so it is flagged to bow out of the
// column instead of running down it.
const EDGES = C.rows.filter((r) => r.drawn).map((r) => ({
  ...r,
  bow: BENCH.get(r.from).x === BENCH.get(r.to).x,
}));
const OFFSTAGE = C.rows.filter((r) => !r.drawn);
// A band is lettered off one shoulder of its node: `left` puts the text to the
// node's left (cytoscape's own halign names the side the LABEL takes).
const BANDS = [...BENCH].filter(([, b]) => b.band).map(([key, b]) => {
  const n = NODES.find((x) => x.key === key);
  const halign = b.halign ?? 'left';
  return {
    id: `band-${key}`,
    label: b.band,
    halign,
    x: halign === 'left' ? b.x - n.w / 2 - 12 : b.x + n.w / 2 + 12,
    y: b.y - n.h / 2 - 14,
  };
});

const LAYOUT = { sprites: SPRITES, nodes: NODES, edges: EDGES, offstage: OFFSTAGE, bands: BANDS, totals: C.totals };

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

const LEGEND_NODES = [
  ['basis', '@uirouter/core — the socket wall'],
  ['tool-external', 'lit — not ours to publish'],
  ['probe-T3', 'a published package (storeys = brick courses)'],
];

const CSS = `
.cb { max-width: 1300px; margin: 0 auto 40px; }
.cb-bar { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; justify-content: space-between;
  border: 1.5px solid var(--ink); border-bottom: none; background: var(--paper-2); padding: 8px 14px; }
.cb-bar .cb-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; }
.cb-bar .lg { display: inline-flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 9.5px;
  letter-spacing: 0.06em; color: var(--ink-soft); }
.cb-bar .lg svg { display: block; }
.cb-bar .lg .sw-dark { display: none; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .cb-bar .lg .sw-light { display: none; }
  :root:not([data-theme="light"]) .cb-bar .lg .sw-dark { display: block; }
}
:root[data-theme="dark"] .cb-bar .lg .sw-light { display: none; }
:root[data-theme="dark"] .cb-bar .lg .sw-dark { display: block; }
.cb-bar .lg i { display: block; width: 26px; height: 0; border-top-width: 2px; border-top-style: solid; }
.cb-ctl { display: flex; gap: 12px; align-items: center; font-family: var(--mono); font-size: 9.5px;
  letter-spacing: 0.1em; color: var(--ink-soft); }
.cb-ctl button { font: inherit; letter-spacing: inherit; color: var(--ink); background: var(--paper);
  border: 1px solid var(--ink); padding: 4px 9px; cursor: pointer; }
.cb-ctl button:hover { background: var(--paper-2); }
.cb-stage { display: grid; grid-template-columns: minmax(0, 1fr) 268px; border: 1.5px solid var(--ink);
  background: var(--paper); }
.cb-cy { height: 620px; min-width: 0; }
.cb-info { border-left: 1.5px solid var(--ink); background: var(--paper-2); padding: 12px 14px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.04em; color: var(--ink); overflow-y: auto;
  max-height: 620px; }
.cb-info h4 { font-size: 11.5px; letter-spacing: 0.08em; margin-bottom: 8px; word-break: break-word; }
.cb-info .f { display: block; font-size: 8.5px; letter-spacing: 0.16em; color: var(--ink-soft); margin: 9px 0 2px; }
.cb-info .rng { color: var(--accent); font-size: 12px; letter-spacing: 0.02em; word-break: break-word; }
.cb-info .opt { color: var(--red); }
.cb-info ul { list-style: none; padding: 0; }
.cb-info li { padding: 1px 0; color: var(--ink-soft); word-break: break-word; }
.cb-info .hint { color: var(--ink-faint); font-style: normal; }
.cb-basis { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.06em; color: var(--ink-faint);
  border: 1.5px solid var(--ink); border-top: none; background: var(--paper-2); padding: 8px 14px 9px; }
@media (max-width: 860px) {
  .cb-stage { grid-template-columns: 1fr; }
  .cb-info { border-left: none; border-top: 1.5px solid var(--ink); max-height: none; }
}`;

// Written without template placeholders on purpose: this string is emitted
// inside one, and every figure it draws arrives through the JSON island.
const INIT = `
(function () {
  // The cytoscape tag above is deferred; deferred scripts run before
  // DOMContentLoaded, so boot there rather than probing during parse.
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
  function boot() {
  var stage = document.getElementById('cb-cy');
  if (!stage || typeof cytoscape === 'undefined') return;
  var L = JSON.parse(document.getElementById('cb-layout').textContent);
  var byKey = {}; L.nodes.forEach(function (n) { byKey[n.key] = n; });

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
  var idOf = function (key) { return 'n' + key.replace(/[^a-zA-Z0-9]/g, '_'); };

  var els = [];
  L.nodes.forEach(function (n) {
    els.push({ data: { id: idOf(n.key), key: n.key, label: n.label, w: n.w, h: n.h,
      sprite: sprites()[n.sprite], skey: n.sprite }, position: { x: n.x, y: n.y },
      classes: 'k-' + n.kind });
  });
  L.bands.forEach(function (b) {
    els.push({ data: { id: b.id, label: b.label, halign: b.halign, w: 1, h: 1 },
      position: { x: b.x, y: b.y }, classes: 'band' });
  });
  L.edges.forEach(function (e, i) {
    var brick = byKey[e.to] && byKey[e.to].kind === 'published';
    els.push({ data: { id: 'e' + i, idx: i, source: idOf(e.from), target: idOf(e.to), label: e.range },
      classes: 'r-' + e.kind + (e.optional ? ' opt' : '') + (brick ? ' brick' : '') + (e.bow ? ' bow' : '') });
  });

  function style(c) {
    return [
      { selector: 'node', style: { 'background-color': c.paper, 'background-image': 'data(sprite)',
        'background-fit': 'contain', 'background-clip': 'none', 'border-width': 1.1, 'border-color': c.line,
        shape: 'round-rectangle', width: 'data(w)', height: 'data(h)', label: 'data(label)',
        'text-valign': 'bottom', 'text-margin-y': 5, 'text-wrap': 'none',
        'font-family': 'ui-monospace, Menlo, Consolas, monospace', 'font-size': 12, color: c.ink,
        'text-halign': 'center', 'overlay-opacity': 0, 'transition-property': 'opacity', 'transition-duration': '110ms' } },
      { selector: 'node.k-external', style: { 'border-width': 2.2, 'border-color': c.accent, color: c.accent } },
      { selector: 'node.band', style: { 'background-opacity': 0, 'background-image': 'none', 'border-width': 0,
        label: 'data(label)', 'text-valign': 'center', 'text-halign': 'data(halign)',
        'text-wrap': 'none', 'font-size': 11, color: c.soft, events: 'no' } },
      { selector: 'edge', style: { 'curve-style': 'bezier', 'target-arrow-shape': 'triangle',
        'arrow-scale': 0.75, 'line-color': c.soft, 'target-arrow-color': c.soft, width: 1.6,
        label: 'data(label)', 'font-family': 'ui-monospace, Menlo, Consolas, monospace', 'font-size': 9.5,
        color: c.faint, 'text-rotation': 'autorotate', 'text-background-color': c.paper,
        'text-background-opacity': 0.9, 'text-background-padding': 2,
        'transition-property': 'opacity', 'transition-duration': '110ms' } },
      { selector: 'edge.r-peer', style: { width: 2.2, 'line-color': c.accent, 'target-arrow-color': c.accent } },
      { selector: 'edge.r-dep', style: { width: 1.6, 'line-style': 'dashed', 'line-dash-pattern': [5, 4],
        'line-color': c.soft, 'target-arrow-color': c.soft } },
      { selector: 'edge.opt', style: { 'line-style': 'dashed', 'line-dash-pattern': [4, 5],
        'line-color': c.red, 'target-arrow-color': c.red, color: c.red } },
      { selector: 'edge.brick', style: { 'line-style': 'solid', width: 2.6 } },
      { selector: 'edge.bow', style: { 'curve-style': 'unbundled-bezier',
        'control-point-distances': [120], 'control-point-weights': [0.5] } },
      { selector: '.dim', style: { opacity: 0.1 } },
      { selector: 'node.lit', style: { 'border-width': 2.6, 'border-color': c.accent } },
      { selector: 'edge.lit', style: { opacity: 1, width: 3, 'line-color': c.accent,
        'target-arrow-color': c.accent, color: c.accent } }
    ];
  }

  var cy = cytoscape({ container: stage, elements: els, style: style(pal()), layout: { name: 'preset' },
    minZoom: 0.25, maxZoom: 2.6, autoungrabify: true });
  cy.fit(cy.elements(), 40);

  var info = document.getElementById('cb-info');
  var IDLE = '\\u003ch4\\u003eTHE COUPLING BENCH\\u003c/h4\\u003e\\u003cp class="hint"\\u003eEvery line on this bench is a '
    + 'published contract. Hover or tap an EDGE for the range it declares and the section it lives in; hover a '
    + 'BUILDING for its version, what it declares, and what declares it. '
    + L.totals.drawnContracts + ' contracts are drawn; ' + (L.totals.contracts - L.totals.drawnContracts)
    + ' more bind targets that are not on this bench.\\u003c/p\\u003e';
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/\\u003c/g, '&lt;').replace(/>/g, '&gt;');
  }
  function field(k, v) { return '\\u003cspan class="f"\\u003e' + k + '\\u003c/span\\u003e' + v; }
  function list(k, arr) {
    if (!arr.length) return '';
    return '\\u003cspan class="f"\\u003e' + k + '\\u003c/span\\u003e\\u003cul\\u003e\\u003cli\\u003e'
      + arr.join('\\u003c/li\\u003e\\u003cli\\u003e') + '\\u003c/li\\u003e\\u003c/ul\\u003e';
  }
  function contract(e) {
    return esc(e.to) + ' \\u003cspan class="rng"\\u003e' + esc(e.range) + '\\u003c/span\\u003e · '
      + (e.optional ? '\\u003cspan class="opt"\\u003eoptional ' + e.section + '\\u003c/span\\u003e' : e.section);
  }
  function describeEdge(i) {
    var e = L.edges[i];
    var h = '\\u003ch4\\u003e' + esc(e.from) + ' \\u2192 ' + esc(e.to) + '\\u003c/h4\\u003e';
    h += field('DECLARED RANGE', '\\u003cspan class="rng"\\u003e' + esc(e.range) + '\\u003c/span\\u003e');
    h += field('SECTION', e.optional
      ? '\\u003cspan class="opt"\\u003e' + e.section + ' \\u00b7 OPTIONAL\\u003c/span\\u003e' : e.section);
    h += field('WRITTEN AS', esc(e.spec) + (e.catalog ? ' \\u00b7 catalog ' + esc(e.catalog) : ''));
    h += field('DIRECTION', esc(e.from) + ' asks the installer for ' + esc(e.to) + '; '
      + (e.kind === 'peer'
        ? 'a peer is the consumer\\'s copy, so this is a contract, not a shipment'
        : 'a dependency ships inside the tarball'));
    return h;
  }
  function describeNode(key) {
    var n = byKey[key];
    var outs = L.edges.filter(function (e) { return e.from === key; });
    var ins = L.edges.filter(function (e) { return e.to === key; });
    var off = L.offstage.filter(function (e) { return e.from === key; });
    var h = '\\u003ch4\\u003e' + esc(n.key) + '\\u003c/h4\\u003e';
    h += field('VERSION', esc(n.version) + ' \\u00b7 ' + esc(n.versionFrom));
    if (n.sloc !== null) h += field('MASS', n.files + 'f \\u00b7 ' + n.sloc.toLocaleString('en-US')
      + ' sloc \\u00b7 ' + n.courses + ' courses');
    h += list('DECLARES', outs.map(contract));
    h += list('DECLARED BY', ins.map(function (e) {
      return esc(e.from) + ' \\u003cspan class="rng"\\u003e' + esc(e.range) + '\\u003c/span\\u003e · '
        + (e.optional ? '\\u003cspan class="opt"\\u003eoptional ' + e.section + '\\u003c/span\\u003e' : e.section);
    }));
    h += list('OFF THE BENCH', off.map(contract));
    if (!outs.length && !ins.length) {
      h += field('ON THIS BENCH', 'no contract in either direction — it couples to eslint, and to nothing here');
    }
    return h;
  }

  function clear() { cy.elements().removeClass('dim lit'); info.innerHTML = IDLE; }
  function focusNode(node) {
    if (node.hasClass('band')) return;
    var hood = node.closedNeighborhood();
    cy.elements().addClass('dim');
    hood.removeClass('dim');
    hood.addClass('lit');
    node.removeClass('lit');
    info.innerHTML = describeNode(node.data('key'));
  }
  function focusEdge(edge) {
    cy.elements().addClass('dim');
    edge.removeClass('dim').addClass('lit');
    edge.connectedNodes().removeClass('dim').addClass('lit');
    info.innerHTML = describeEdge(edge.data('idx'));
  }
  cy.on('mouseover', 'node', function (e) { focusNode(e.target); });
  cy.on('tap', 'node', function (e) { focusNode(e.target); });
  cy.on('mouseover', 'edge', function (e) { focusEdge(e.target); });
  cy.on('tap', 'edge', function (e) { focusEdge(e.target); });
  cy.on('mouseout', 'node, edge', clear);
  cy.on('tap', function (e) { if (e.target === cy) clear(); });
  clear();

  document.getElementById('cb-fit').addEventListener('click', function () { cy.fit(cy.elements(), 40); });

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

export function couplingBenchSection() {
  const swatch = (k) => `<span class="sw sw-light">${spriteSvg(k, 'light')}</span><span class="sw sw-dark">${spriteSvg(k, 'dark')}</span>`;
  const legend = LEGEND_NODES.map(([k, d]) => `<span class="lg">${swatch(k)}${d}</span>`).join('\n    ')
    + '\n    ' + [
      ['peerDependency', 'var(--accent)', 'solid'],
      ['dependency', 'var(--ink-soft)', 'dashed'],
      ['optional peer', 'var(--red)', 'dashed'],
    ].map(([rel, col, st]) => `<span class="lg"><i style="border-top-color:${col};border-top-style:${st}"></i>${rel}</span>`).join('\n    ');

  return `<style>${CSS}</style>
<section class="sheet cb" id="coupling-bench" aria-label="The Coupling Bench, interactive">
  <div class="sheet-head"><span class="proj">THE ALTITUDE ATLAS — INTERACTIVE PLATE</span><span class="shno">SHEET 2B · REV ${REV}</span></div>
  <h2 class="sheet-title">THE COUPLING BENCH</h2>
  <p class="sheet-sub">EVERY EDGE IS A PUBLISHED CONTRACT · ${C.totals.nodes} NODES · ${C.totals.drawnContracts} DRAWN CONTRACTS OF ${C.totals.contracts} · ${C.totals.peers} PEERS / ${C.totals.deps} DEPENDENCIES · ${C.totals.optional} OPTIONAL</p>
  <div class="cb-bar">
    <div class="cb-legend">
    ${legend}
    </div>
    <div class="cb-ctl">
      <span>HOVER AN EDGE FOR ITS RANGE · DRAG TO PAN</span>
      <button type="button" id="cb-fit">FIT</button>
    </div>
  </div>
  <div class="cb-stage">
    <div class="cb-cy" id="cb-cy" role="img" aria-label="Interactive coupling graph: the five published packages, @uirouter/core and lit, with one edge per declared dependency or peer dependency, each labelled with its published range."></div>
    <aside class="cb-info" id="cb-info"></aside>
  </div>
  <p class="cb-basis">BASIS — ${C.totals.contracts} contracts read from <code>packages/*/package.json</code> at ${C.ref} @ ${C.sha} · commit ${C.commitDate} · every <code>catalog:</code> spec resolved through the archive's own <code>pnpm-workspace.yaml</code> to the range that ships, and <code>@uirouter/core</code> and <code>lit</code> versions taken from <code>pnpm-lock.yaml</code>, by <code>generator/census-couplings.mjs</code> · massing and storeys from <code>census-bricks.json</code> · layout is sheet 2A's arrangement, computed at build and drawn with cytoscape <code>preset</code> — no physics.</p>
</section>
<script type="application/json" id="cb-layout">${json(LAYOUT)}</script>
<script defer src="${CYTOSCAPE_URL}"></script>
<script>${INIT}</script>`;
}

// sheet 2B's prose reads the same figures the bench does
export const COUPLINGS = { plate: C, nodes: NODES, edges: EDGES, offstage: OFFSTAGE };

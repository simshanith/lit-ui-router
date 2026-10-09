// SHEET 2B — THE COUPLING BENCH: sheet 2A's interactive sibling.
//
// Nine nodes — the seven published packages, @uirouter/core and lit — and every
// EDGE is a real coupling contract read from www/atlas.lit-ui-router.dev/data/census-couplings.json:
// the declared range as published, the section it lives in, and whether the peer
// is optional.  Nothing on the bench is hand-listed.
//
// Layout is computed HERE, not in the browser, and it deliberately echoes sheet
// 2A's arrangement: the socket wall at the left with lit above it, the lit
// companions in a column at the right in 2A's own order, the server below them
// with its one coupling drawn to be crossed out, the two companions that tie the
// flagship from outside that column in a second column beyond it, and the eslint
// plugin in a bay of its own because it touches nothing else.  The navigation
// plugin stands in a middle column of its own, on the wall's own baseline: it
// declares core and nothing else, so it belongs nearer the wall than the lit
// column and its one tie runs straight.  cytoscape draws it with `preset` — no
// physics, so the picture is the same on every load.
import { readFileSync } from 'node:fs';
import { PROJECT_MARK, articleTitle } from './chrome.mjs';
import { LANE_KEYS_JS, LANE_TOUCH_JS, PLATE_FOCUS_JS } from './focus.mjs';
import { glyph } from './icons.mjs';
import { basisStrip, laneCss, laneHints, LANE_TOK_JS } from './lane-chrome.mjs';
import { CYTOSCAPE_URL } from './pipeline-graph.mjs';
import { SPRITES, spriteSvg } from './sprites.mjs';

export const REV = 'D';

const C = JSON.parse(readFileSync(new URL('../data/census-couplings.json', import.meta.url), 'utf8'));
const B = JSON.parse(readFileSync(new URL('../data/census-bricks.json', import.meta.url), 'utf8'));

const brick = (name) => B.rows.find((r) => r.name === name) ?? null;
// ---- the bench, in sheet 2A's arrangement -----------------------------------
// x/y are the preset coordinates; `short` is the label the bench can carry at
// node size, `band` the note lettered beside it (`halign` says which side).
// Five columns, read right to left the way the arrows run: the lit companions at
// 680, the navigation plugin alone at 400, the two externals stacked at 120 with
// lit lifted clear of the wall, effect and ssr at 900, and the eslint bay at
// 1120 — a bay, not a basement.  effect and ssr cannot stand in the 680 column:
// both tie lit-ui-router, and a tie laid down that column would run straight
// through mobx, which the guard below throws on.  The middle column is the plate's whole argument about that plugin:
// it declares @uirouter/core and nothing else, so it sits on the wall's own
// baseline (y = 0) and its single tie is a straight horizontal run.  Keeping it
// out of the lit column also leaves that column with nothing standing between
// mobx and the flagship, so the one intra-column tie is a plain vertical.  The
// two peer fans still cross at a wide angle, and no two range labels share a
// baseline — which is what the four identical `^6.0.8` ties would otherwise do.
const BENCH = new Map([
  ['lit', { x: 120, y: -350, short: 'lit', band: 'THE OTHER PEER', halign: 'right' }],
  ['@uirouter/core', { x: 120, y: 0, short: '@uirouter/core', band: 'THE SOCKET WALL', halign: 'center' }],
  ['ui-router-navigation-location-plugin', { x: 400, y: 0, short: 'navigation-location-plugin', band: 'A COLUMN OF ITS OWN — CORE ONLY, NO LIT', halign: 'right' }],
  ['lit-ui-router', { x: 680, y: -300, short: 'lit-ui-router' }],
  ['lit-ui-router-mobx', { x: 680, y: -160, short: 'lit-ui-router-mobx' }],
  ['ui-router-server', { x: 680, y: 260, band: 'OPTIONAL — THE TIE 2A DRAWS CROSSED OUT', short: 'ui-router-server', halign: 'right' }],
  ['lit-ui-router-effect', { x: 900, y: -160, short: 'lit-ui-router-effect' }],
  ['lit-ui-router-ssr', { x: 900, y: 120, band: 'THE BRIDGE — IT TIES TWO SIBLINGS', short: 'lit-ui-router-ssr', halign: 'center' }],
  ['eslint-plugin-lit-ui-router', { x: 1120, y: -300, band: 'A BAY OF ITS OWN — COUPLES TO NOTHING HERE', short: 'eslint-plugin-lit-ui-router', halign: 'center' }],
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
// No edge on this bench is bowed.  The only intra-column tie is mobx ->
// lit-ui-router, and since the navigation plugin took a column of its own there
// is nothing standing between them: it runs straight, like every other tie.
// A same-column pair with a third node between them would be a layout fault to
// fix in BENCH, not a curve to hide it behind.
const EDGES = C.rows.filter((r) => r.drawn);
const COLUMNS = new Map();
for (const [key, b] of BENCH) COLUMNS.set(b.x, [...(COLUMNS.get(b.x) ?? []), key]);
for (const e of EDGES) {
  const [a, z] = [BENCH.get(e.from), BENCH.get(e.to)];
  if (a.x !== z.x) continue;
  const [lo, hi] = [Math.min(a.y, z.y), Math.max(a.y, z.y)];
  for (const key of COLUMNS.get(a.x)) {
    const o = BENCH.get(key);
    if (key === e.from || key === e.to || o.y <= lo || o.y >= hi) continue;
    throw new Error(`coupling-bench: ${e.from} -> ${e.to} runs down column x=${a.x} straight through ${key}`);
  }
}
const OFFSTAGE = C.rows.filter((r) => !r.drawn);
// A band is lettered off one shoulder of its node: `left` puts the text to the
// node's left (cytoscape's own halign names the side the LABEL takes).  `center`
// letters it squarely over the node instead, which is how the two longest bands
// are kept from throwing the drawing's bounding box — and so its fitted scale —
// hundreds of units wider than the buildings themselves.
const BANDS = [...BENCH].filter(([, b]) => b.band).map(([key, b]) => {
  const n = NODES.find((x) => x.key === key);
  const halign = b.halign ?? 'left';
  return {
    id: `band-${key}`,
    label: b.band,
    halign,
    x: halign === 'left' ? b.x - n.w / 2 - 12 : halign === 'right' ? b.x + n.w / 2 + 12 : b.x,
    y: b.y - n.h / 2 - (halign === 'center' ? 20 : 14),
  };
});

// Lucide on the panel heads: the card's own subject (coupling) at rest,
// arrow-up-from-line on DECLARES, arrow-down-to-line on DECLARED BY.
const GLYPHS = { rest: glyph('ic-coupling'), out: glyph('arrow-up-from-line'), in: glyph('arrow-down-to-line') };
const LAYOUT = { sprites: SPRITES, nodes: NODES, edges: EDGES, offstage: OFFSTAGE, bands: BANDS, totals: C.totals, glyphs: GLYPHS };

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

const LEGEND_NODES = [
  ['basis', '@uirouter/core — the socket wall'],
  ['tool-external', 'lit — not ours to publish'],
  ['probe-T3', 'a published package (storeys = brick courses)'],
];

const CSS = laneCss('cb') + `
.cb-info .rng { color: var(--accent); font-size: 13.5px; letter-spacing: 0.02em; word-break: break-word; }
.cb-info .opt { color: var(--red); }
`;

// Written without template placeholders on purpose: this string is emitted
// inside one, and every figure it draws arrives through the JSON island.
const INIT = `
(function () {
$$FOCUS  // The cytoscape tag above is deferred; deferred scripts run before
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
${LANE_TOK_JS}
  function pal() {
    return { ink: col('--ink'), soft: col('--ink-soft'), faint: col('--ink-faint'), accent: col('--accent'),
      paper: col('--paper'), paper2: col('--paper-2'), line: col('--edge'), red: col('--red'),
      data: tok('--data') || '"Barlow Semi Condensed", sans-serif' };
  }
  var sprites = function () { return L.sprites[dark() ? 'dark' : 'light']; };
  var idOf = function (key) { return 'n' + key.replace(/[^a-zA-Z0-9]/g, '_'); };

  // the url names a building by its npm name and an edge as from>to, never by position
  var pinIds = {};
  var els = [];
  L.nodes.forEach(function (n) {
    pinIds[n.key] = idOf(n.key);
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
    if (!pinIds[e.from + '>' + e.to]) pinIds[e.from + '>' + e.to] = 'e' + i;
    els.push({ data: { id: 'e' + i, idx: i, key: e.from + '>' + e.to, source: idOf(e.from), target: idOf(e.to), label: e.range },
      classes: 'r-' + e.kind + (e.optional ? ' opt' : '') + (brick ? ' brick' : '') });
  });

  function style(c) {
    return [
      { selector: 'node', style: { 'background-color': c.paper, 'background-image': 'data(sprite)',
        'background-fit': 'contain', 'background-clip': 'none', 'border-width': 1.1, 'border-color': c.line,
        shape: 'round-rectangle', width: 'data(w)', height: 'data(h)', label: 'data(label)',
        'text-valign': 'bottom', 'text-margin-y': 5, 'text-wrap': 'none',
        // a name lettered over a tie knocks the tie out, the way a plan label does
        'text-background-color': c.paper, 'text-background-opacity': 0.92, 'text-background-padding': 2,
        'font-family': c.data, 'font-size': 13, color: c.ink,
        'text-halign': 'center', 'overlay-opacity': 0, 'transition-property': 'opacity', 'transition-duration': '110ms' } },
      { selector: 'node.k-external', style: { 'border-width': 2.2, 'border-color': c.accent, color: c.accent } },
      { selector: 'node.band', style: { 'background-opacity': 0, 'background-image': 'none', 'border-width': 0,
        label: 'data(label)', 'text-valign': 'center', 'text-halign': 'data(halign)',
        'text-wrap': 'none', 'font-size': 12, color: c.soft, events: 'no' } },
      { selector: 'edge', style: { 'curve-style': 'bezier', 'target-arrow-shape': 'triangle',
        'arrow-scale': 0.75, 'line-color': c.soft, 'target-arrow-color': c.soft, width: 1.6,
        label: 'data(label)', 'font-family': c.data, 'font-size': 11,
        color: c.faint, 'text-rotation': 'autorotate', 'text-background-color': c.paper,
        'text-background-opacity': 0.9, 'text-background-padding': 2,
        'transition-property': 'opacity', 'transition-duration': '110ms' } },
      { selector: 'edge.r-peer', style: { width: 2.2, 'line-color': c.accent, 'target-arrow-color': c.accent } },
      { selector: 'edge.r-dep', style: { width: 1.6, 'line-style': 'dashed', 'line-dash-pattern': [5, 4],
        'line-color': c.soft, 'target-arrow-color': c.soft } },
      { selector: 'edge.opt', style: { 'line-style': 'dashed', 'line-dash-pattern': [4, 5],
        'line-color': c.red, 'target-arrow-color': c.red, color: c.red } },
      { selector: 'edge.brick', style: { 'line-style': 'solid', width: 2.6 } },
      { selector: '.dim', style: { opacity: 0.1 } },
      { selector: 'node.lit', style: { 'border-width': 2.6, 'border-color': c.accent } },
      { selector: 'node.pick', style: { 'border-width': 3, 'border-color': c.ink, opacity: 1 } },
      { selector: 'edge.lit', style: { opacity: 1, width: 3, 'line-color': c.accent,
        'target-arrow-color': c.accent, color: c.accent } },
      { selector: '.small', style: { label: '' } }
    ];
  }

  var cy = cytoscape({ container: stage, elements: els, style: style(pal()), layout: { name: 'preset' },
    minZoom: 0.25, maxZoom: 2.6, autoungrabify: true });
  // The stage keeps a handle on its own graph. Nothing on the page reads it;
  // generator/thumbs.mjs does, to re-lay this lane into the portrait window of
  // a cover card before photographing it — a landscape slice read as a corner.
  stage.__cy = cy;

  // a range label under 7.5 css px on screen is dropped, any other label under 6.5
  var sizing = 0;
  function floorLabels() {
    sizing = 0;
    var z = cy.zoom();
    cy.batch(function () {
      cy.elements().forEach(function (el) { el.toggleClass('small', el.numericStyle('font-size') * z < (el.isEdge() ? 7.5 : 6.5)); });
    });
  }
  cy.on('zoom', function () { if (!sizing) sizing = requestAnimationFrame(floorLabels); });
  cy.fit(cy.elements(), 40);
  floorLabels();

  var info = document.getElementById('cb-info');
  var IDLE = '\\u003ch3\\u003e' + L.glyphs.rest + 'THE COUPLING BENCH\\u003c/h3\\u003e\\u003cp class="hint"\\u003eEvery line on this bench is a '
    + 'published contract. Hover or tap an EDGE for the range it declares and the section it lives in; hover a '
    + 'BUILDING for its version, what it declares, and what declares it. '
    + L.totals.drawnContracts + ' contracts are drawn; ' + (L.totals.contracts - L.totals.drawnContracts)
    + ' more bind targets that are not on this bench. A tap pins a building or an edge and the link in the '
    + 'address bar carries the pin; tap it again or the ground to clear it.\\u003c/p\\u003e';
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
    var h = '\\u003ch3\\u003e' + esc(e.from) + ' \\u2192 ' + esc(e.to) + '\\u003c/h3\\u003e';
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
    var h = '\\u003ch3\\u003e' + esc(n.key) + '\\u003c/h3\\u003e';
    h += field('VERSION', esc(n.version) + ' \\u00b7 ' + esc(n.versionFrom));
    if (n.sloc !== null) h += field('MASS', n.files + 'f \\u00b7 ' + n.sloc.toLocaleString('en-US')
      + ' sloc \\u00b7 ' + n.courses + ' courses');
    h += list(L.glyphs.out + 'DECLARES', outs.map(contract));
    h += list(L.glyphs.in + 'DECLARED BY', ins.map(function (e) {
      return esc(e.from) + ' \\u003cspan class="rng"\\u003e' + esc(e.range) + '\\u003c/span\\u003e · '
        + (e.optional ? '\\u003cspan class="opt"\\u003eoptional ' + e.section + '\\u003c/span\\u003e' : e.section);
    }));
    h += list('OFF THE BENCH', off.map(contract));
    if (!outs.length && !ins.length) {
      h += field('ON THIS BENCH', 'no contract in either direction — it couples to eslint, and to nothing here');
    }
    return h;
  }

  function clear() { cy.elements().removeClass('dim lit pick'); info.innerHTML = IDLE; }
  function focusNode(node) {
    if (node.hasClass('band')) return;
    var hood = node.closedNeighborhood();
    cy.elements().removeClass('lit pick').addClass('dim');
    hood.removeClass('dim');
    hood.addClass('lit');
    node.removeClass('lit').addClass('pick');
    info.innerHTML = describeNode(node.data('key'));
  }
  function focusEdge(edge) {
    cy.elements().removeClass('lit pick').addClass('dim');
    edge.removeClass('dim').addClass('lit');
    edge.connectedNodes().removeClass('dim').addClass('lit');
    info.innerHTML = describeEdge(edge.data('idx'));
  }
  // hover previews over the pin; a tap pins, and the pinned element or the ground clears it
  var pinned = null;
  function show(el) {
    if (!el) clear();
    else if (el.isNode()) focusNode(el);
    else focusEdge(el);
  }
  function find(key) {
    var id = key ? pinIds[key] : null;
    return id ? cy.getElementById(id) : null;
  }
  function tap(el) {
    var next = el && pinned && el.same(pinned) ? null : el;
    if (next === pinned) return;
    pinned = next;
    show(pinned);
    atlasFocusPush(stage, pinned ? pinned.data('key') : null);
  }
  // a url or keyboard pin brings its neighbourhood in, held between 0.7 and 1.2; a clear returns to the whole bench
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
  function frame(el) {
    var ms = reduced ? 0 : 260;
    cy.stop(true);
    if (!el) { cy.animate({ fit: { eles: cy.elements(), padding: 40 }, duration: ms }); return; }
    var hood = el.isNode() ? el.closedNeighborhood() : el.union(el.connectedNodes());
    // under 480px the floor drops to 0.55: the rail names every neighbour anyway
    cy.animate(Object.assign(frameOn(el, hood, cy.elements(), cy.width() < 480 ? 0.55 : 0.7), { duration: ms }));
  }
  function steer(el) {
    var was = pinned;
    tap(el);
    if (pinned !== was) frame(pinned);
  }
  function apply(key) {
    var el = find(key);
    if (el === pinned || (el && pinned && el.same(pinned))) return;
    pinned = el;
    show(pinned);
    frame(pinned);
  }
  cy.on('mouseover', 'node, edge', function (e) { if (!e.target.hasClass('band')) show(e.target); });
  cy.on('mouseout', 'node, edge', function () { show(pinned); });
  cy.on('tap', function (e) {
    if (e.target === cy) { if (pinned) steer(null); }
    else if (!e.target.hasClass('band')) tap(e.target);
  });
  clear();
  apply(atlasFocusHost(stage, apply));
  atlasLaneKeys(stage, function () { return cy.nodes('[key]'); }, function () { return pinned; }, steer);
  atlasLaneTouch(stage, cy, function () { cy.fit(cy.elements(), 40); });

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

export function couplingBenchSection({ caption = '' } = {}) {
  const swatch = (k) => `<span class="sw sw-light">${spriteSvg(k, 'light')}</span><span class="sw sw-dark">${spriteSvg(k, 'dark')}</span>`;
  const legend = LEGEND_NODES.map(([k, d]) => `<span class="lg">${swatch(k)}${d}</span>`).join('\n    ')
    + '\n    ' + [
      ['peerDependency', 'var(--accent)', 'solid'],
      ['dependency', 'var(--ink-soft)', 'dashed'],
      ['optional peer', 'var(--red)', 'dashed'],
    ].map(([rel, col, st]) => `<span class="lg"><i style="border-top-color:${col};border-top-style:${st}"></i>${rel}</span>`).join('\n    ');

  return `<style>${CSS}</style>
<section class="sheet cb" id="coupling-bench" aria-label="The Coupling Bench, interactive">
  <div class="sheet-head"><span class="proj">${PROJECT_MARK} — INTERACTIVE PLATE</span><span class="shno">SHEET 2B · REV ${REV}</span></div>
  <h2 class="sheet-title">${articleTitle('THE COUPLING BENCH')}</h2>
  <p class="sheet-sub">EVERY EDGE IS A PUBLISHED CONTRACT · ${C.totals.nodes} NODES · ${C.totals.drawnContracts} DRAWN CONTRACTS OF ${C.totals.contracts} · ${C.totals.peers} PEERS / ${C.totals.deps} DEPENDENCIES · ${C.totals.optional} OPTIONAL</p>
  <div class="cb-bar">
    <div class="cb-legend">
    ${legend}
    </div>
    <div class="cb-ctl">
      <span class="hints">${laneHints(`<span class="nw">HOVER AN EDGE FOR ITS RANGE</span> <span class="nw">${glyph('move')}DRAG TO PAN</span>`)}</span>
      <button type="button" id="cb-fit">${glyph('scan')}FIT</button>
    </div>
  </div>
  <div class="cb-stage fillable"><button type="button" class="fill" data-fill aria-label="Enlarge this figure, or leave it"></button>
    <div class="cb-cy" id="cb-cy" role="application" tabindex="0" aria-label="Interactive coupling graph: the ${C.totals.published} published packages, @uirouter/core and lit, with one edge per declared dependency or peer dependency, each labelled with its published range. lit-ui-router-ssr is the one node with a tie to two siblings — the flagship and the server. With the graph focused, the arrow keys step the pin through the buildings and Escape clears it."></div>
    <aside class="cb-info" id="cb-info"></aside>
  </div>
  ${basisStrip('cb', `${C.totals.contracts} contracts read from <code>packages/*/package.json</code> at ${C.ref} @ ${C.sha} · commit <span class="nw">${C.commitDate.slice(0, 10)}</span> · every <code>catalog:</code> spec resolved through the archive's own <code>pnpm-workspace.yaml</code> to the range that ships, and <code>@uirouter/core</code> and <code>lit</code> versions taken from <code>pnpm-lock.yaml</code>, by <code>generator/census-couplings.mjs</code> · massing and storeys from <code>census-bricks.json</code> · layout is sheet 2A's arrangement in five columns — the lit companions, the navigation plugin alone, the two externals, effect and ssr, the eslint bay — computed at build and drawn with cytoscape <code>preset</code> — no physics, and no bowed ties.`)}
  ${caption ? `<figure><figcaption><span class="figno">FIG. 2B</span>${caption}</figcaption></figure>` : ''}
</section>
<script type="application/json" id="cb-layout">${json(LAYOUT)}</script>
<script defer src="${CYTOSCAPE_URL}"></script>
<script>${INIT.replace('$$FOCUS', () => PLATE_FOCUS_JS + LANE_KEYS_JS + LANE_TOUCH_JS)}</script>`;
}

// sheet 2B's prose reads the same figures the bench does
export const COUPLINGS = { plate: C, nodes: NODES, edges: EDGES, offstage: OFFSTAGE };

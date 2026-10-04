// THE BRICK ASSEMBLY, IN THE ROUND: sheet 2's seated model as a glTF binary in
// Google's <model-viewer>, with the sheet's own explosion as its one clip.
//
// Nothing is re-derived: sheet2.mjs exports the MODEL its finished-model band
// draws and the EXPLODE lifts its exploded view hovers at, brick-glb.mjs writes
// them into one GLB, and this module ships the bricks' rows and seats as a JSON
// island beside the viewer. The plate is app-only: the flat set draws no copy.
import { readFileSync } from 'node:fs';
import { PROJECT_MARK, articleTitle } from './chrome.mjs';
import { FOCUS_JS } from './focus.mjs';
import { basisStrip, laneCss } from './lane-chrome.mjs';
import { ASSEMBLE_SECONDS, brickGlb, seatedBoxes, toModel } from './brick-glb.mjs';
import { BRICK_COUPLES, BRICK_MODEL, BRICK_ROWS, EXPLODE } from './sheet2.mjs';
import { BASE } from '../app/src/routes.ts';

const PLATE = JSON.parse(readFileSync(new URL('../data/census-bricks.json', import.meta.url), 'utf8'));
const COUNTED = `${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;
const APP_PKG = JSON.parse(readFileSync(new URL('../app/package.json', import.meta.url), 'utf8'));
const MV_VERSION = APP_PKG.dependencies['@google/model-viewer'].replace(/^[^\d]*/, '');

/** Where the app serves the model: app/public/models/, under the app's base. */
export const BRICKS_GLB = 'models/bricks.glb';

/** The model as a GLB — emit-app.mjs writes it to app/public/models/bricks.glb. */
export const bricksGlb = () => brickGlb(BRICK_MODEL, { explode: EXPLODE });

const fmt = (v) => v.toLocaleString('en-US');
const ISO_POLAR = +(90 - (Math.atan(1 / Math.SQRT2) * 180) / Math.PI).toFixed(3);
// The sheet's three drawn corners: its own (the +x and +y faces in view), the
// opposite one, and the server side, brick-iso's turn 1.
const CORNERS = [
  ['drawn', 'DRAWING’S CORNER', 45],
  ['opposite', 'OPPOSITE CORNER', 225],
  ['server', 'SERVER SIDE', 135],
].map(([id, label, az]) => ({ id, label, orbit: `${az}deg ${ISO_POLAR}deg 88%` }));

const PLATE_NAME = { P1: 'the @uirouter/core plate', P2: 'the headless plate, on the server shelf' };
const seatsOf = (n, on) => {
  const couples = BRICK_COUPLES.filter(([a]) => a === n);
  if (couples.length) return couples.map(([, b, stud]) => `brick ${b}, stud ${stud}`).join(' and ');
  return PLATE_NAME[on];
};

const SEATED = new Map(seatedBoxes(BRICK_MODEL).map((b) => [b.m.id, b]));
const r4 = (v) => +v.toFixed(4);
const DATA = {
  end: ASSEMBLE_SECONDS,
  bricks: BRICK_ROWS.map((row) => {
    const b = SEATED.get(row.n);
    if (!b) throw new Error(`brick-scene: brick ${row.n} has no part in sheet 2's model`);
    const mid = [b.x + b.w / 2, b.y + b.d / 2];
    return {
      n: row.n,
      name: row.name,
      ver: row.ver,
      hue: row.hue,
      ledger: `${row.files}f · ${fmt(row.sloc)} sloc · ${row.shape[0]}×${row.shape[1]} · ${row.courses} course${row.courses > 1 ? 's' : ''}`,
      seats: seatsOf(row.n, b.m.on),
      // a stud's height clear of the cap, so the badge stands over the studs, not among them
      cap: toModel(BRICK_MODEL, ...mid, b.z0 + b.h + 14).map(r4),
      centre: toModel(BRICK_MODEL, ...mid, b.z0 + b.h / 2).map(r4),
      lift: r4(EXPLODE.get(row.n) / 40),
    };
  }),
};
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

export const BRICKS_META = {
  id: 'bricks',
  head: 'SHEET 2 · 3D',
  rev: 'A',
  title: 'THE BRICK ASSEMBLY, IN THE ROUND',
  sub: `SHEET 2'S FINISHED MODEL IN THE ROUND · ${BRICK_ROWS.length} BRICKS · 2 PLATES · 2 LEVELS OF GROUND · ONE GLTF BINARY · THE SHEET'S OWN EXPLOSION AS ITS ONE CLIP, ASSEMBLE ⇄ EXPLODE · THE CAMERA TURNS TO THE SHEET'S THREE DRAWN CORNERS`,
  /** The flat set draws no copy of it. */
  standalone: '',
};

const CSS = `
.bk-frame { border: 1.5px solid var(--ink); border-bottom: none; }
.bk-frame:focus-within { outline: 2px solid var(--accent); outline-offset: -2px; }
.bk-frame:fullscreen .bk-view, .bk-frame.is-filled .bk-view { height: 100vh; }
.bk-view { display: block; width: 100%; height: clamp(460px, 64vh, 920px);
  background: radial-gradient(ellipse 70% 60% at 50% 42%, var(--paper) 0%, var(--paper-2) 58%, var(--ground) 100%);
  --poster-color: transparent; --progress-bar-color: var(--accent); }
.bk .bk-bar { border-bottom: 1.5px solid var(--ink); }
.bk-bar .lg i.sw { display: block; width: 20px; height: 12px; border: 1.2px solid var(--ink); }
.bk-bar .lg i.sw-brick { background: linear-gradient(90deg, #D8A33A, #D8A33A 33%, #5B8E4B 33%, #5B8E4B 66%, #4C86C6 66%); }
.bk-bar .lg i.sw-stud { background: #2E5077; border-radius: 50%; width: 14px; }
.bk-bar .lg i.sw-seat { background: #A63D2F; border-radius: 50%; width: 14px; }
.bk-bar .lg i.sw-ghost { background: rgba(241, 240, 231, 0.45); border-style: dashed; }
.bk-bar .lg i.sw-ground { background: #E9E8DD; height: 7px; }
.bk-ctl .grp { display: inline-flex; gap: 6px; }
.bk-ctl button[aria-pressed="true"] { background: var(--ink); color: var(--paper); }
.bk-ctl input[type=range] { width: 150px; accent-color: var(--accent); }
.bk-pin { width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--hue, var(--ink)); background: var(--paper);
  color: var(--ink); font-family: var(--data); font-size: 12px; font-weight: 600; padding: 0; cursor: pointer;
  display: grid; place-items: center; }
.bk-pin.on { background: var(--hue, var(--accent)); color: #F1F0E7; }
.bk-pin:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.bk-read { border: 1.5px solid var(--ink); border-top: none; background: var(--paper-2); padding: 14px 22px 16px;
  min-height: 72px; color: var(--ink); }
.bk-read h3 { font-family: var(--code); font-size: 16px; font-weight: 600; letter-spacing: 0.04em; line-height: 1.3;
  margin: 0; word-break: break-word; }
.bk-read h3 i.sw { display: inline-block; width: 18px; height: 11px; margin-right: 8px; border: 1.2px solid var(--ink); vertical-align: baseline; }
.bk-read h3 .n { font-family: var(--data); font-size: 11px; letter-spacing: 0.16em; color: var(--accent);
  margin-right: 10px; vertical-align: 0.12em; white-space: nowrap; }
.bk-read .ledger { font-family: var(--data); font-size: 12px; letter-spacing: 0.08em; line-height: 1.5;
  color: var(--ink-soft); margin: 3px 0 0; }
.bk-read .note, .bk-read .hint { font-family: var(--prose); font-size: 16px; line-height: 1.5; max-width: 66ch;
  margin: 4px 0 0; color: var(--ink-soft); }
@media (max-width: 860px) { .bk-view { height: clamp(420px, 62vh, 620px); } }`;

const LEGEND = [
  ['brick', 'a published package, as a quantized brick in its own colour'],
  ['stud', 'a published extension point'],
  ['seat', 'the location seat'],
  ['ghost', 'the headless plate — an optional peer'],
  ['ground', 'ground — the browser, and the server shelf'],
];

const BASIS = `The model is <code>generator/sheet2.mjs</code>'s own <code>MODEL</code>, the parts its finished-model band seats, written into one glTF binary by <code>generator/brick-glb.mjs</code>: every ground, plate and brick a cuboid edged in ink, each face graded a little — the cap from its near corner across, the flanks from the top edge down, every stud a 24-sided cylinder on its part's cap, one node per part named by its id; each brick wears its own colour, cap and plain studs in the hue and flanks a step darker, while the plates and ground wear the page's paper and every edge its ink, retinted from the theme's tokens on each turn. One stud pitch is one unit. Each brick's lift in the <code>assemble</code> clip is the hover the sheet's exploded view draws it at, measured from its plate (${[...EXPLODE].map(([n, z]) => `brick ${n} ${z}`).join(', ')} plan units), so the explosion is the sheet's own. The numbered badges ride the bricks through the clip. Counted at ${COUNTED}; <code>@google/model-viewer</code> ${MV_VERSION} is fetched only when this page is entered, and the clip jumps to its end under <code>prefers-reduced-motion</code>.`;

/** The plate: style, section and the JSON island — no init script. */
export function bricksMarkup() {
  const meta = BRICKS_META;
  const pins = DATA.bricks.map((b) =>
    `      <button type="button" class="bk-pin" slot="hotspot-${b.n}" style="--hue:${b.hue}" data-position="${b.cap.map((v) => `${v}m`).join(' ')}" data-normal="0m 1m 0m" aria-pressed="false" aria-label="Brick ${b.n}, ${b.name}">${b.n}</button>`).join('\n');
  return `<style>${laneCss('bk')}${CSS}</style>
<section class="sheet bk" id="${meta.id}-scene" aria-label="The Brick Assembly in the round — sheet 2's finished model as a three-dimensional model that explodes and reassembles">
  <div class="sheet-head"><span class="proj">${PROJECT_MARK} — INTERACTIVE PLATE</span><span class="shno">${meta.head} · REV ${meta.rev}</span></div>
  <h2 class="sheet-title">${articleTitle(meta.title)}</h2>
  <p class="sheet-sub">${meta.sub}</p>
  <div class="bk-frame fillable" id="bk-frame"><button type="button" class="fill" data-fill aria-label="Fill the window with this figure, or leave it"></button>
    <model-viewer id="bk-viewer" class="bk-view" src="${BASE}${BRICKS_GLB}" loading="eager" reveal="manual" camera-controls touch-action="pan-y" interaction-prompt="none" camera-orbit="${CORNERS[0].orbit}" max-camera-orbit="Infinity 88deg auto" field-of-view="14deg" min-field-of-view="5deg" max-field-of-view="18deg" exposure="1" shadow-intensity="0" animation-name="assemble" alt="Sheet 2's finished LEGO model in three dimensions: a low slab of browser ground carries the @uirouter/core baseplate, its back rail of studs ringed in the accent colour and one red location seat; lit-ui-router stands on it as a tall two-by-four, the one-stud navigation location plugin on the location seat, lit-ui-router-mobx and lit-ui-router-effect on lit-ui-router's cap; a raised server shelf carries a translucent headless plate with ui-router-server on it, and lit-ui-router-ssr bridges from lit-ui-router's cap to ui-router-server's. The explode control lifts every brick to the height the sheet's exploded view draws it at.">
${pins}
    </model-viewer>
  </div>
  <div class="bk-bar">
    <div class="bk-legend">
${LEGEND.map(([k, t]) => `      <span class="lg"><i class="sw sw-${k}"></i>${t}</span>`).join('\n')}
    </div>
    <div class="bk-ctl">
      <span class="hints"><span class="mouse">DRAG TO ORBIT · SCROLL TO ZOOM · TAP A NUMBER TO PIN <span class="nw">← → STEP THE PIN</span> <span class="nw">ESC CLEARS</span></span><span class="nw touch">A FINGER ACROSS ORBITS · PINCH TO ZOOM · TAP A NUMBER TO PIN</span></span>
      <span class="grp" role="group" aria-label="Camera corner">
${CORNERS.map((c, i) => `        <button type="button" data-orbit="${c.orbit}" aria-pressed="${i === 0}">${c.label}</button>`).join('\n')}
      </span>
      <button type="button" id="bk-play" disabled>EXPLODE</button>
      <label>EXPLODED <input type="range" id="bk-t" min="0" max="${ASSEMBLE_SECONDS}" step="0.01" value="${ASSEMBLE_SECONDS}" disabled aria-label="Assembly, from exploded to seated"> SEATED</label>
    </div>
  </div>
  <aside class="bk-read" id="bk-info" aria-live="polite"></aside>
  ${basisStrip('bk', BASIS)}
</section>
<script type="application/json" id="bk-model">${json(DATA)}</script>`;
}

// The scene, as a module for the app: handed the resolved <model-viewer> module
// and the opening pin, it returns { dispose, select }.
const BODY = `${FOCUS_JS}  var mv = root.querySelector('#bk-viewer');
  var island = root.querySelector('#bk-model');
  if (!mv || !island || !viewer) return undefined;
  var D = JSON.parse(island.textContent);
  var stage = root.querySelector('#bk-frame');
  var info = root.querySelector('#bk-info');
  var play = root.querySelector('#bk-play');
  var slider = root.querySelector('#bk-t');
  var corners = Array.prototype.slice.call(root.querySelectorAll('[data-orbit]'));
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var ac = new AbortController();
  var on = function (el, type, fn, capture) { el.addEventListener(type, fn, { signal: ac.signal, capture: Boolean(capture) }); };
  var END = D.end, t = END, raf = 0, pinN = null, loaded = false;
  var byN = {}, pins = {};
  D.bricks.forEach(function (b) {
    byN[b.n] = b;
    pins[b.n] = mv.querySelector('[slot="hotspot-' + b.n + '"]');
  });
  var order = D.bricks.map(function (b) { return b.n; }).sort(function (a, b) { return a - b; });
  var IDLE = '<p class="hint">' + D.bricks.length + ' bricks on two plates. Tap a number to read its brick and turn the camera on it; EXPLODE lifts every brick to the height sheet 2 draws it at.</p>';

  function rise(b) { return b.lift * (1 - t / END); }
  function vec(p, k) { return p[0] + 'm ' + (p[1] + k).toFixed(4) + 'm ' + p[2] + 'm'; }
  function aim() { mv.cameraTarget = pinN === null ? 'auto auto auto' : vec(byN[pinN].centre, rise(byN[pinN])); }
  // the clip's one clock: the pose, the badges riding with it, and the controls that read it
  function pose(next) {
    t = Math.min(END, Math.max(0, next));
    // a hair short of the end: three clamps a LoopOnce action that reaches it, and a clamped action ignores later seeks
    if (loaded) mv.currentTime = Math.min(t, END - 1e-4);
    slider.value = String(t);
    play.textContent = t >= END ? 'EXPLODE' : 'ASSEMBLE';
    D.bricks.forEach(function (b) { mv.updateHotspot({ name: 'hotspot-' + b.n, position: vec(b.cap, rise(b)) }); });
    if (pinN !== null) aim();
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  // forward or backward at the clip's own speed; reduced motion lands on the end at once
  function run(to) {
    stop();
    if (reduce.matches) { pose(to); return; }
    var dir = to > t ? 1 : -1, last = performance.now();
    function tick(now) {
      raf = 0;
      var next = t + dir * (now - last) / 1000;
      last = now;
      if (dir > 0 ? next >= to : next <= to) { pose(to); return; }
      pose(next);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }

  function show(n) {
    if (n === null) { info.innerHTML = IDLE; return; }
    var b = byN[n];
    info.innerHTML = '<h3><i class="sw" style="background:' + b.hue + '"></i><span class="n">BRICK ' + b.n + '</span>' + b.name + ' ' + b.ver + '</h3>'
      + '<p class="ledger">' + b.ledger + '</p><p class="note">Seats on ' + b.seats + '.</p>';
  }
  function member(v) { return v !== null && v !== undefined && byN[v] ? Number(v) : null; }
  // idempotent, so the url's echo of a pick lands on a no-op
  function pin(n) {
    if (n === pinN) return;
    pinN = n;
    order.forEach(function (k) {
      pins[k].classList.toggle('on', k === n);
      pins[k].setAttribute('aria-pressed', String(k === n));
    });
    aim();
    show(n);
  }
  function tap(n) {
    var next = n === pinN ? null : n;
    pin(next);
    atlasFocusPush(mv, next === null ? null : String(next));
  }

  order.forEach(function (n) { on(pins[n], 'click', function () { tap(n); }); });
  on(play, 'click', function () { run(t >= END ? 0 : END); });
  on(slider, 'input', function () { stop(); pose(Number(slider.value)); });
  corners.forEach(function (c) {
    on(c, 'click', function () {
      corners.forEach(function (o) { o.setAttribute('aria-pressed', String(o === c)); });
      mv.cameraOrbit = c.getAttribute('data-orbit');
      if (reduce.matches) mv.jumpCameraToGoal();
    });
  });
  // captured on the way down, so the viewer's own arrow-key orbit never sees ← →
  on(stage, 'keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    var at = order.indexOf(pinN);
    if (d) tap(order[at < 0 ? (d > 0 ? 0 : order.length - 1) : (at + d + order.length) % order.length]);
    else if (e.key === 'Escape' && pinN !== null) tap(pinN);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // the plates and ground wear the page's paper and the edges its ink, in either theme
  var TINT = [['cap', '--paper'], ['flank', '--paper-2'], ['edge', '--ink'], ['ghost-cap', '--paper', 0.45], ['ghost-flank', '--paper-2', 0.45], ['ghost-edge', '--ink', 0.45]];
  // setBaseColorFactor takes linear values, so the token's sRGB bytes are linearised first
  function lin(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function tint() {
    if (!mv.model) return Promise.resolve();
    var cs = getComputedStyle(document.documentElement);
    return Promise.all(TINT.map(function (row) {
      var m = mv.model.getMaterialByName(row[0]);
      var hex = cs.getPropertyValue(row[1]).trim();
      if (!m || hex.length !== 7) return undefined;
      var c = [1, 3, 5].map(function (i) { return lin(parseInt(hex.slice(i, i + 2), 16) / 255); });
      // a material only the edge lines use is loaded lazily
      return m.ensureLoaded().then(function () { m.pbrMetallicRoughness.setBaseColorFactor([c[0], c[1], c[2], row[2] === undefined ? 1 : row[2]]); });
    }));
  }
  var themeMO = new MutationObserver(tint);
  themeMO.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  on(window.matchMedia('(prefers-color-scheme: dark)'), 'change', tint);

  var ready = new Promise(function (resolve) {
    function boot() {
      loaded = true;
      // LoopOnce, so the clip's last frame is the seat rather than a wrap to frame 0
      mv.play({ repetitions: 1 });
      mv.pause();
      play.disabled = false;
      slider.disabled = false;
      pose(t);
      // revealed once the theme's colours are on the model, so neither a reader nor a photograph sees the baked ones
      tint().then(function () { mv.dismissPoster(); resolve(); });
    }
    if (mv.loaded) boot();
    else on(mv, 'load', boot);
  });
  show(null);
  pin(member(atlasFocusRead(focus)));

  // verification hook: the clip's clock, the pin, and a clean frame for the card photograph
  window.__bricksScene = {
    ready: ready.then(function () {
      return new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(resolve); }); });
    }),
    animations: function () { return mv.availableAnimations; },
    time: function () { return t; },
    pose: function (v) { stop(); pose(v); },
    pinned: function () { return pinN; },
    orbit: function () { return mv.getCameraOrbit().toString(); },
    photo: function () { order.forEach(function (n) { pins[n].style.visibility = 'hidden'; }); },
  };

  return {
    select: function (n) { pin(member(n)); },
    dispose: function () {
      stop();
      themeMO.disconnect();
      ac.abort();
      delete window.__bricksScene;
    },
  };
`;

/** emit-app.mjs writes this to app/src/generated/bricks-init.js. */
export function bricksInitModule() {
  return `// GENERATED by www/atlas.lit-ui-router.dev/generator/brick-scene.mjs — do not edit.
// Sheet 2's model in the round: wires the fragment's <model-viewer> to its clip,
// corners and pins once the routed state has loaded the element; returns { dispose, select }.
export async function initBricks(root, viewer, focus) {
${BODY}}
`;
}

export const BRICKS_INIT_DTS = `// GENERATED by www/atlas.lit-ui-router.dev/generator/emit-app.mjs — do not edit.
/** The wired model: its teardown, and the pin the url carries as \`focus\`. */
export interface BricksScene {
  dispose(): void;
  /** Pins brick \`n\`; null, or a number no brick carries, clears the pin. */
  select(n: number | null): void;
}
/** Wires the model inside \`root\`, opening on the \`focus\` pin.
 *  Undefined when there was nothing to wire — no plate, or no viewer. */
export declare function initBricks(
  root: Element,
  viewer: unknown,
  focus: string | null,
): Promise<BricksScene | undefined>;
`;

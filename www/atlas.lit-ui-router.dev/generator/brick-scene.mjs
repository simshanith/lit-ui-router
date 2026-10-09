// THE BRICK ASSEMBLY, IN THE ROUND: sheet 2's seated model as a glTF binary in
// Google's <model-viewer>, with the sheet's explosion, scaled, as its one clip.
//
// Nothing is re-derived: sheet2.mjs exports the MODEL its finished-model band
// draws and the EXPLODE lifts its exploded view hovers at, brick-glb.mjs writes
// them into one GLB along assembleMotion's keys, and this module ships the
// bricks' rows, seats and keyed rises as a JSON island beside the viewer. The plate is app-only: the flat set draws no copy.
import { readFileSync } from 'node:fs';
import { PROJECT_MARK, articleTitle } from './chrome.mjs';
import { FOCUS_JS } from './focus.mjs';
import { basisStrip, laneCss } from './lane-chrome.mjs';
import { ASSEMBLE_SECONDS, assembleMotion, brickGlb, seatedBoxes, toModel } from './brick-glb.mjs';
import { MV_JS, frameCss, orbitAt, pinCss } from './mv-kit.mjs';
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
// the corners' radius, as a percentage of model-viewer's framing radius
const RADIUS = 88;
// The sheet's three drawn corners: its own (the +x and +y faces in view), the
// opposite one, and the server side, brick-iso's turn 1.
const CORNERS = [
  ['drawn', 'DRAWING’S CORNER', 45],
  ['opposite', 'OPPOSITE CORNER', 225],
  ['server', 'SERVER SIDE', 135],
].map(([id, label, az]) => ({ id, label, orbit: orbitAt(az, `${RADIUS}%`) }));
// degrees TURN swings the camera off its corner at the exploded end
const SWEEP = 30;
// how far the radius dollies out at the full explosion, as a fraction of the corner's radius
const DOLLY = 0.5;
// the zoom-out limit widens only off the seat: model-viewer sets its depth range from it, so the seated limit keeps the seated render
const SEATED_MAX = 'Infinity 88deg auto';
const EXPLODED_MAX = `Infinity 88deg ${+(RADIUS * (1 + DOLLY)).toFixed(2)}%`;

const PLATE_NAME = { P1: 'the @uirouter/core plate', P2: 'the headless plate, on the server shelf' };
const seatsOf = (n, on) => {
  const couples = BRICK_COUPLES.filter(([a]) => a === n);
  if (couples.length) return couples.map(([, b, stud]) => `brick ${b}, stud ${stud}`).join(' and ');
  return PLATE_NAME[on];
};

const SEATED = new Map(seatedBoxes(BRICK_MODEL).map((b) => [b.m.id, b]));
const r4 = (v) => +v.toFixed(4);
// the cap's centre, or on a cap bricks seat on, the open stud farthest from their badges
const openStud = (b) => {
  const riders = [...SEATED.values()].filter((o) => o.m.on === b.m.id), pitch = b.w / b.m.ws;
  if (!riders.length) return [b.x + b.w / 2, b.y + b.d / 2];
  const clear = (x, y) => Math.min(...riders.map((o) => Math.hypot(x - o.x - o.w / 2, y - o.y - o.d / 2)));
  let best = null;
  for (let i = 0; i < b.m.ws; i++) for (let j = 0; j < b.m.ds; j++) {
    const x = b.x + (i + 0.5) * pitch, y = b.y + (j + 0.5) * pitch;
    if (riders.some((o) => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.d)) continue;
    if (!best || clear(x, y) > best[2]) best = [x, y, clear(x, y)];
  }
  return best ? [best[0], best[1]] : [b.x + b.w / 2, b.y + b.d / 2];
};
const MOTION = assembleMotion(BRICK_MODEL, EXPLODE);
const DATA = {
  end: ASSEMBLE_SECONDS,
  // the clip's key times as fractions of it; each brick's rise is keyed at the same fractions
  us: MOTION.us.map(r4),
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
      // a stud's height clear of the cap, over an open stud, so the badge stands clear of the bricks seated on it
      cap: toModel(BRICK_MODEL, ...openStud(b), b.z0 + b.h + 14).map(r4),
      centre: toModel(BRICK_MODEL, ...mid, b.z0 + b.h / 2).map(r4),
      rise: MOTION.us.map((u) => r4(MOTION.rise(row.n, u) / 40)),
    };
  }),
};
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

export const BRICKS_META = {
  id: 'bricks',
  head: 'SHEET 2 · 3D',
  rev: 'A',
  title: 'THE BRICK ASSEMBLY, IN THE ROUND',
  sub: `SHEET 2'S FINISHED MODEL IN THE ROUND · ${BRICK_ROWS.length} BRICKS · 2 PLATES · 2 LEVELS OF GROUND · ONE GLTF BINARY · THE SHEET'S EXPLOSION HALF AGAIN AS HIGH AS ITS ONE CLIP, ASSEMBLE ⇄ EXPLODE · THE CAMERA TURNS TO THE SHEET'S THREE DRAWN CORNERS`,
  /** The flat set draws no copy of it. */
  standalone: '',
};

const CSS = `
${frameCss('bk', 'bk-read', ['stage', 'bar', 'read'])}
/* the lane chrome lays a stage out as two columns; the viewer takes the whole stage */
.bk-stage { display: block; border: 1.5px solid var(--ink); border-block-end: none; }
.bk-stage:focus-within { outline: max(2px, 0.08em) solid var(--accent); outline-offset: -2px; }
.bk-view { display: block; width: 100%; height: clamp(460px, 64vh, 920px);
  background: radial-gradient(ellipse 70% 60% at 50% 42%, var(--paper) 0%, var(--paper-2) 58%, var(--ground) 100%);
  --poster-color: transparent; --progress-bar-color: var(--accent); }
.bk .bk-bar { border-block-end: 1.5px solid var(--ink); }
.bk-bar .lg i.sw { display: block; width: 20px; height: 12px; border: 1.2px solid var(--ink); }
.bk-bar .lg i.sw-brick { background: linear-gradient(90deg, oklch(74.7% 0.133 80.8), oklch(74.7% 0.133 80.8) 33%, oklch(59.4% 0.111 138.6) 33%, oklch(59.4% 0.111 138.6) 66%, oklch(60.9% 0.115 252.3) 66%); }
.bk-bar .lg i.sw-stud { background: oklch(42.4% 0.077 253.0); border-radius: 50%; width: 14px; }
.bk-bar .lg i.sw-seat { background: oklch(50.5% 0.141 30.3); border-radius: 50%; width: 14px; }
.bk-bar .lg i.sw-ghost { background: oklch(95.3% 0.012 101.5 / 0.45); border-style: dashed; }
.bk-bar .lg i.sw-ground { background: oklch(92.9% 0.015 102.5); height: 7px; }
.bk-ctl .grp { display: inline-flex; flex-wrap: wrap; gap: 6px; }
@media (max-width: 560px) { .bk-ctl .touch { white-space: normal; } }
.bk-ctl button[aria-pressed="true"] { background: var(--ink); color: var(--paper); }
.bk-ctl input[type=range] { flex: none; width: 150px; accent-color: var(--accent); }
/* the button keeps the wider label's width, so the slider after it never shifts under a drag */
#bk-play::after { content: "ASSEMBLE"; display: block; height: 0; overflow: clip; visibility: hidden; }
${pinCss('bk-pin', 26, 12)}
.bk-read { border: 1.5px solid var(--ink); border-block-start: none; background: var(--paper-2); padding-block: 14px 16px; padding-inline: 22px;
  min-height: 72px; color: var(--ink); }
.bk-read h3 { font-family: var(--code); font-size: 16px; font-weight: 600; letter-spacing: 0.04em; line-height: 1.3;
  margin: 0; word-break: break-word; }
.bk-read h3 i.sw { display: inline-block; width: 18px; height: 11px; margin-inline-end: 8px; border: 1.2px solid var(--ink); vertical-align: baseline; }
.bk-read h3 .n { font-family: var(--data); font-size: 11px; letter-spacing: 0.16em; color: var(--accent);
  margin-inline-end: 10px; vertical-align: 0.12em; white-space: nowrap; }
.bk-read .ledger { font-family: var(--data); font-size: 12px; letter-spacing: 0.08em; line-height: 1.5;
  color: var(--ink-soft); margin-block: 3px 0; margin-inline: 0; }
.bk-read .note, .bk-read .hint { font-family: var(--prose); font-size: 16px; line-height: 1.5; max-width: 66ch;
  margin-block: 4px 0; margin-inline: 0; color: var(--ink-soft); }
@media (max-width: 860px) { .bk-view { height: clamp(420px, 62vh, 620px); } }`;

const LEGEND = [
  ['brick', 'a published package, as a quantized brick in its own colour'],
  ['stud', 'a published extension point'],
  ['seat', 'the location seat'],
  ['ghost', 'the headless plate — an optional peer'],
  ['ground', 'ground — the browser, and the server shelf'],
];

const BASIS = `The model is <code>generator/sheet2.mjs</code>'s own <code>MODEL</code>, the parts its finished-model band seats, written into one glTF binary by <code>generator/brick-glb.mjs</code>: every ground, plate and brick a cuboid edged in ink, each face graded a little — the cap from its near corner across, the flanks from the top edge down, every stud a 24-sided cylinder on its part's cap, one node per part named by its id; each brick wears its own colour, cap and plain studs in the hue and flanks a step darker, while the plates and ground wear the page's paper and every edge its ink, retinted from the theme's tokens on each turn. One stud pitch is one unit. Each brick's lift in the <code>assemble</code> clip is the hover the sheet's exploded view draws it at, measured from its plate (${[...EXPLODE].map(([n, z]) => `brick ${n} ${z}`).join(', ')} plan units), scaled ×1.5, and a brick stacked on another hovers at least a stud's pitch clear of it; the stacked bricks leave first and land last, each easing in to a hard landing, and every hovering brick hangs plumb over the stud it seats on by a dashed leader. The numbered badges ride the bricks through the clip, the camera rises and draws back with the explosion so the lifted stack stays in frame, and TURN couples the camera to it, swung ${SWEEP}° off the chosen corner when exploded and landing on that corner as the bricks seat. Counted at ${COUNTED}; <code>@google/model-viewer</code> ${MV_VERSION} is fetched only when this page is entered, and the clip jumps to its end under <code>prefers-reduced-motion</code>.`;

/** The plate: style, section and the JSON island — no init script. */
export function bricksMarkup() {
  const meta = BRICKS_META;
  const pins = DATA.bricks.map((b) =>
    `        <button type="button" class="bk-pin" slot="hotspot-${b.n}" style="--hue:${b.hue}" data-position="${b.cap.map((v) => `${v}m`).join(' ')}" data-normal="0m 1m 0m" aria-pressed="false" aria-label="Brick ${b.n}, ${b.name}">${b.n}</button>`).join('\n');
  return `<style>${laneCss('bk')}${CSS}</style>
<section class="sheet bk" id="${meta.id}-scene" aria-label="The Brick Assembly in the round — sheet 2's finished model as a three-dimensional model that explodes and reassembles">
  <div class="sheet-head"><span class="proj">${PROJECT_MARK} — INTERACTIVE PLATE</span><span class="shno">${meta.head} · REV ${meta.rev}</span></div>
  <h2 class="sheet-title">${articleTitle(meta.title)}</h2>
  <p class="sheet-sub">${meta.sub}</p>
  <div class="bk-frame fillable" id="bk-frame"><button type="button" class="fill" data-fill aria-label="Enlarge this figure, or leave it"></button>
    <div class="bk-stage">
      <model-viewer id="bk-viewer" class="bk-view" src="${BASE}${BRICKS_GLB}" loading="eager" reveal="manual" camera-controls touch-action="pan-y" interaction-prompt="none" camera-orbit="${CORNERS[0].orbit}" max-camera-orbit="${SEATED_MAX}" field-of-view="14deg" min-field-of-view="5deg" max-field-of-view="18deg" exposure="1" shadow-intensity="0" animation-name="assemble" alt="Sheet 2's finished LEGO model in three dimensions: a low slab of browser ground carries the @uirouter/core baseplate, its back rail of studs ringed in the accent colour and one red location seat; lit-ui-router stands on it as a tall two-by-four, the one-stud navigation location plugin on the location seat, lit-ui-router-mobx and lit-ui-router-effect on lit-ui-router's cap; a raised server shelf carries a translucent headless plate with ui-router-server on it, and lit-ui-router-ssr bridges from lit-ui-router's cap to ui-router-server's. The explode control lifts the stacked bricks first, then the rest, each to at least half again the height the sheet's exploded view draws it at, with a dashed leader dropping from each to the stud it seats on.">
${pins}
      </model-viewer>
    </div>
    <div class="bk-bar">
      <div class="bk-legend">
${LEGEND.map(([k, t]) => `        <span class="lg"><i class="sw sw-${k}"></i>${t}</span>`).join('\n')}
      </div>
      <div class="bk-ctl">
        <span class="hints"><span class="mouse">DRAG TO ORBIT · SCROLL TO ZOOM · TAP A NUMBER TO PIN <span class="nw">← → STEP THE PIN</span> <span class="nw">ESC CLEARS</span></span><span class="nw touch">A FINGER ACROSS ORBITS · PINCH TO ZOOM · TAP A NUMBER TO PIN</span></span>
        <span class="grp" role="group" aria-label="Camera corner">
${CORNERS.map((c, i) => `          <button type="button" data-orbit="${c.orbit}" aria-pressed="${i === 0}">${c.label}</button>`).join('\n')}
        </span>
        <button type="button" id="bk-turn" aria-pressed="false" aria-label="Turn the camera with the clip">TURN</button>
        <button type="button" id="bk-play" disabled>EXPLODE</button>
        <label>EXPLODED <input type="range" id="bk-t" min="0" max="${ASSEMBLE_SECONDS}" step="0.01" value="${ASSEMBLE_SECONDS}" disabled aria-label="Assembly, from exploded to seated"> SEATED</label>
      </div>
    </div>
    <aside class="bk-read" id="bk-info" aria-live="polite"></aside>
  </div>
  ${basisStrip('bk', BASIS)}
</section>
<script type="application/json" id="bk-model">${json(DATA)}</script>`;
}

// The scene, as a module for the app: handed the resolved <model-viewer> module
// and the opening pin, it returns { dispose, select }.
const BODY = `${FOCUS_JS}${MV_JS}  var mv = root.querySelector('#bk-viewer');
  var island = root.querySelector('#bk-model');
  if (!mv || !island || !viewer) return undefined;
  var D = JSON.parse(island.textContent);
  var stage = root.querySelector('.bk-stage');
  var info = root.querySelector('#bk-info');
  var play = root.querySelector('#bk-play');
  var slider = root.querySelector('#bk-t');
  var turnBtn = root.querySelector('#bk-turn');
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
  var IDLE = '<p class="hint">' + D.bricks.length + ' bricks on two plates. Tap a number to read its brick and turn the camera on it; EXPLODE lifts the stacked bricks first, every brick to at least half again the height sheet 2 draws it at, each hanging on a leader over its stud.</p>';

  // the clip's own LINEAR interpolation, so a badge rides its brick exactly
  function rise(b) {
    var u = t / END, k = 0;
    while (k < D.us.length - 2 && u > D.us[k + 1]) k++;
    var s = Math.min(1, Math.max(0, (u - D.us[k]) / (D.us[k + 1] - D.us[k])));
    return b.rise[k] + (b.rise[k + 1] - b.rise[k]) * s;
  }
  // the camera rides the clip: the target rises with the stack and the radius dollies out by the explode fraction, so the exploded model fits the stage
  var TOP = D.bricks.reduce(function (m, b) { return Math.max(m, b.rise[0]); }, 0);
  function exploded() { return D.bricks.reduce(function (m, b) { return Math.max(m, rise(b)); }, 0) / TOP; }
  // TURN: the azimuth leaves the corner on the clip's cubic, so the camera lands on the corner as the bricks seat
  var turning = false, moved = false, corner = corners[0].getAttribute('data-orbit'), base = null;
  function swept(at) { var u = at / END; return turning ? ${SWEEP} * (1 - u * u * u) : 0; }
  function rebase(orbit) {
    var p = orbit.split(' ');
    base = { orbit: orbit, az: parseFloat(p[0]), polar: p[1], r: parseFloat(p[2]), unit: p[2].replace(/^[\\d.]+/, '') };
    moved = false;
  }
  // a user's orbit becomes the base at the next pose, so a drag or a zoom never fights the clip
  function adopt() {
    var o = mv.getCameraOrbit();
    base = { orbit: null, az: o.theta * 180 / Math.PI - swept(t), polar: (o.phi * 180 / Math.PI).toFixed(3) + 'deg', r: o.radius / (1 + ${DOLLY} * exploded()), unit: 'm' };
    moved = false;
  }
  function camera(jump) {
    var e = exploded(), sweep = swept(t);
    mv.maxCameraOrbit = e ? '${EXPLODED_MAX}' : '${SEATED_MAX}';
    // seated on a corner, the orbit is the corner's own string, so the framing is the one the sheet ships
    mv.cameraOrbit = base.orbit && !e && !sweep ? base.orbit
      : (base.az + sweep).toFixed(3) + 'deg ' + base.polar + ' ' + (base.r * (1 + ${DOLLY} * e)).toFixed(4) + base.unit;
    aim();
    if (jump) mv.jumpCameraToGoal();
  }
  function turn(v) {
    turning = Boolean(v);
    turnBtn.setAttribute('aria-pressed', String(turning));
    rebase(corner);
    camera(reduce.matches);
  }
  rebase(corner);
  function vec(p, k) { return p[0] + 'm ' + (p[1] + k).toFixed(4) + 'm ' + p[2] + 'm'; }
  function aim() {
    if (pinN !== null) { mv.cameraTarget = vec(byN[pinN].centre, rise(byN[pinN])); return; }
    var e = exploded();
    mv.cameraTarget = e ? 'auto ' + (mv.getBoundingBoxCenter().y + e * TOP / 2).toFixed(4) + 'm auto' : 'auto auto auto';
  }
  // the clip's one clock: the pose, the badges riding with it, and the controls that read it
  function pose(next) {
    if (moved) adopt();
    var was = exploded();
    t = Math.min(END, Math.max(0, next));
    // a hair short of the end: three clamps a LoopOnce action that reaches it, and a clamped action ignores later seeks
    if (loaded) mv.currentTime = Math.min(t, END - 1e-4);
    slider.value = String(t);
    play.textContent = t >= END ? 'EXPLODE' : 'ASSEMBLE';
    D.bricks.forEach(function (b) { mv.updateHotspot({ name: 'hotspot-' + b.n, position: vec(b.cap, rise(b)) }); });
    // off the seat, the camera is on the clip's clock; seated and still, it is left alone
    if (loaded && (was || exploded() || turning)) camera(true);
    else if (pinN !== null) aim();
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
      corner = c.getAttribute('data-orbit');
      rebase(corner);
      camera(reduce.matches);
    });
  });
  on(turnBtn, 'click', function () { turn(!turning); });
  on(mv, 'camera-change', function (e) { if (e.detail && e.detail.source === 'user-interaction') moved = true; });
  pinKeys(stage, on, {
    step: function (d) { tap(walk(order, pinN, d)); },
    escape: function () { if (pinN === null) return false; tap(pinN); return true; },
  });
  wheelGate(stage, on);

  // the plates and ground wear the page's paper and the edges its ink, in either theme
  var TINT = [['cap', '--paper'], ['flank', '--paper-2'], ['edge', '--ink'], ['ghost-cap', '--paper', 0.45], ['ghost-flank', '--paper-2', 0.45], ['ghost-edge', '--ink', 0.45]];
  function tint() {
    return paint(mv, TINT.map(function (row) { return [row[0], tokenRgb(tokColor(row[1])), row[2]]; }));
  }
  var themeOff = onTheme(tint, on);

  var ready = new Promise(function (resolve) {
    function boot() {
      loaded = true;
      // LoopOnce, so the clip's last frame is the seat rather than a wrap to frame 0
      mv.play({ repetitions: 1 });
      mv.pause();
      play.disabled = false;
      slider.disabled = false;
      pose(t);
      revealPainted(mv, tint).then(resolve);
    }
    if (mv.loaded) boot();
    else on(mv, 'load', boot);
  });
  show(null);
  pin(member(atlasFocusRead(focus)));

  // verification hook: the clip's clock, the pin, and a clean frame for the card photograph
  window.__bricksScene = {
    ready: ready,
    animations: function () { return mv.availableAnimations; },
    time: function () { return t; },
    pose: function (v) { stop(); pose(v); },
    pinned: function () { return pinN; },
    orbit: function () { return mv.getCameraOrbit().toString(); },
    turn: function (v) { turn(v); },
    turning: function () { return turning; },
    photo: function () { order.forEach(function (n) { pins[n].style.visibility = 'hidden'; }); },
  };

  return {
    select: function (n) { pin(member(n)); },
    dispose: function () {
      stop();
      themeOff();
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

// THE CITY, IN THE ROUND: sheet 7's census city as a glTF binary in Google's
// <model-viewer>, and its working twin with every mass crowned by its plant.
//
// Nothing is re-derived: city-glb.mjs writes sheet7.mjs's computed CITY into
// city.glb and plant.glb and hands back the layout beside them (pins, pick boxes,
// district labels, the rise schedule), which this module ships as a JSON island.
// One body wires both plates; the island's `plant` field is the switch. The plates
// are app-only: the flat set draws no copy.
import { readFileSync } from 'node:fs';
import { PROJECT_MARK, articleTitle } from './chrome.mjs';
import { FOCUS_JS } from './focus.mjs';
import { CITY, PLACED } from './sheet7.mjs';
import { SURVEY, SURVEY_META } from './sheet7a.mjs';
import { PLANT_RULES } from './city-plant.mjs';
import {
  CITY_GLB, DRESS_JS, FACES, HATCH, LIT, PLANT_GLB, PX, RISE_SECONDS, TIERS, TINT, cityModel, materialPlan,
} from './city-glb.mjs';
import { ISO_POLAR, MV_JS, frameCss, orbitAt, pinCss } from './mv-kit.mjs';
import { BASE } from '../app/src/routes.ts';

export const REV = 'H';
export const PLANT_REV = 'B';

const PLATE = JSON.parse(readFileSync(new URL('../data/census-city.json', import.meta.url), 'utf8'));
const BASIS = `${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;
const APP_PKG = JSON.parse(readFileSync(new URL('../app/package.json', import.meta.url), 'utf8'));
const MV_VERSION = APP_PKG.dependencies['@google/model-viewer'].replace(/^[^\d]*/, '');

// sheet 7's own vocabulary, verbatim: the panel must read like the flat schedule
const TIER_TEXT = {
  halt: 'HALTS A PUBLISH', pr: 'STOPS THE PR LINE', late: 'gates a later stage',
  report: 'never gates', line: 'the material', off: 'types only — not massed',
};
const DIST_TEXT = { pkg: 'packages/', app: 'apps/', site: 'www/ + examples/', tool: 'tools/' };
const DIST_LABEL = { pkg: 'PACKAGES/', app: 'APPS/', site: 'DOCS + EXAMPLES/', tool: 'TOOLS/' };

const LEGEND = ['halt', 'pr', 'late', 'report', 'line', 'annex'].map((k) => [k, TIERS[k].label]);
const LIGHT_LEGEND = ['b1', 'b2', 'b3', 'sh', 'e2e', 'lamp'].map((k) => [k, LIT[k].label]);
const lgHtml = (rows) => rows
  .map(([k, d]) => `<span class="lg"><i class="sw sw-${k}"></i>${d}</span>`).join('\n      ');

// Every mass must have a survey row: sheet 7A numbers from sheet 7's own PLACED table.
const SURVEY_BY_N = Object.fromEntries(SURVEY.map((r) => [r.n, r]));
for (const b of CITY) {
  if (!SURVEY_BY_N[b.n]) throw new Error(`city-scene: member ${b.n} has no row in sheet 7A's SURVEY`);
}

/** The camera: the four diagonals at the iso polar, the home field of view, and how far a pin frames. */
const HOME_FOV = 14;
const CORNERS = [45, 135, 225, 315];
// the home pose aims at the ground's centre; its radius is set on load to the stage's aspect
const HOME_TARGET = 'auto 0m auto';
const ISO_RAD = (ISO_POLAR * Math.PI) / 180;
// The plan seen down each diagonal, orthographically: the padded ground's corners and
// every member's box, as a half width across the screen and a half height up it, each
// over the share of the stage the home pose gives it.
const homeSpan = ({ extent: [hx, hz], members }) => {
  const points = [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz]];
  for (const m of members) for (const [x0, y0, z0, x1, y1, z1] of m.boxes)
    for (const x of [x0, x1]) for (const y of [Math.max(0, y0), y1]) for (const z of [z0, z1]) points.push([x, y, z]);
  let right = 0, up = 0;
  for (const az of CORNERS) {
    const t = (az * Math.PI) / 180;
    for (const [x, y, z] of points) {
      right = Math.max(right, Math.abs(x * Math.cos(t) - z * Math.sin(t)));
      up = Math.max(up, Math.abs(y * Math.sin(ISO_RAD) - (x * Math.sin(t) + z * Math.cos(t)) * Math.cos(ISO_RAD)));
    }
  }
  return [+(right / 0.94).toFixed(2), +(up / 0.92).toFixed(2)];
};
const PIN_FOV = HOME_FOV / 1.8;
// below this share of the plan's home scale on a desktop stage, the unpinned pins fold to dots
const DOTS = 0.62;

const island = (plant) => {
  const { layout } = cityModel({ plant });
  const byN = new Map(layout.members.map((m) => [m.n, m]));
  return {
    plant,
    end: layout.end,
    crowns: layout.crowns,
    lift: layout.lift,
    home: { fov: HOME_FOV, pin: +PIN_FOV.toFixed(3), dots: +(DOTS / PX).toFixed(4), corners: CORNERS, span: homeSpan(layout) },
    rows: CITY.map((b) => {
      const m = byN.get(b.n);
      return {
        n: b.n, name: b.name, dist: b.dist, tier: b.tier, sf: b.sf, sl: b.sl, pf: b.pf, pl: b.pl,
        h: m.h, top: m.top, cap: m.cap, centre: m.centre, boxes: m.boxes, rise: m.rise,
      };
    }),
    districts: layout.districts,
    // the schedule's own note line, keyed by member number: the plate's prose, not new prose
    notes: Object.fromEntries(PLACED.map(([n, , , , , , , note]) => [n, note])),
    survey: SURVEY_BY_N,
    tierText: TIER_TEXT,
    distText: DIST_TEXT,
    M: materialPlan(plant),
    legend: { tier: lgHtml(LEGEND), light: lgHtml(LIGHT_LEGEND) },
  };
};

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

const MASSED = CITY.filter((b) => b.tier !== 'off').length;
const ANNEXES = CITY.filter((b) => b.sa).length;

// The plates' own identity, shared: the gallery letters them and emit-app.mjs
// files them in the app's manifest, so the routed card cannot drift from the page.
export const CITY_META = {
  id: 'city',
  head: 'SHEET 7 · 3D',
  rev: REV,
  title: 'THE CITY, IN THE ROUND',
  sub: `SHEET 7'S CENSUS CITY IN THE ROUND · ${CITY.length} MEMBERS · ${MASSED} MASSED · ${ANNEXES} SPEC ANNEXES · 4 DISTRICTS · ONE GLTF BINARY · ONE CLIP RAISES IT FROM THE GROUND, RAISE ⇄ GROUND · THE CAMERA ORBITS FREE AND TURNS TO THE FOUR TRUE DIAGONALS · A SECOND LANE RELIGHTS THE CITY FROM SHEET 7A'S FILED SHADOW PLATE`,
  /** The flat set draws no copy of it. */
  standalone: '',
};

// The same city at work: sheet 7B's twin in the round.
export const PLANT_META = {
  id: 'plant',
  head: 'SHEET 7B · 3D',
  rev: PLANT_REV,
  title: 'THE WORKING CITY, IN THE ROUND',
  sub: `SHEET 7'S CENSUS CITY IN THE ROUND, AT WORK · ${CITY.length} MEMBERS · ${MASSED} MASSED · EACH CROWNED BY A WORKING PLANT SIZED FROM ITS OWN CENSUS · ${ANNEXES} SPEC ANNEXES · 4 DISTRICTS · ONE GLTF BINARY · ONE CLIP RAISES IT FROM THE GROUND AND CROWNS IT, RAISE ⇄ GROUND · THE CAMERA ORBITS FREE AND TURNS TO THE FOUR TRUE DIAGONALS · A SECOND LANE RELIGHTS THE CITY FROM SHEET 7A'S FILED SHADOW PLATE`,
  /** The flat set draws no copy of it. */
  standalone: '',
};

const CSS = `
.cs { margin-block: 0 40px; margin-inline: 0; }
.cs-bar { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; justify-content: space-between;
  border: 1.5px solid var(--ink); border-block-end: none; background: var(--paper-2); padding: 8px 14px; }
.cs-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; }
.cs-legend .lg { display: inline-flex; align-items: center; gap: 7px; font-family: var(--data); font-size: 10.5px;
  letter-spacing: 0.06em; color: var(--ink-soft); }
.cs-legend .sw { display: block; flex: none; width: 20px; height: 12px; border: 1.2px solid var(--ink); }
.cs-legend .sw-annex, .cs-legend .sw-lamp { border-color: var(--ink-soft); border-style: dashed; }
.cs-ctl { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; font-family: var(--data); font-size: 10.5px;
  letter-spacing: 0.1em; color: var(--ink-soft); }
.cs-ctl .grp { display: inline-flex; gap: 6px; }
.cs-ctl button { font: inherit; letter-spacing: inherit; color: var(--ink); background: var(--paper);
  border: 1px solid var(--ink); padding: 4px 9px; cursor: pointer; }
@media (hover: hover) and (pointer: fine) { .cs-ctl button:hover { background: var(--paper-2); } }
.cs-ctl button:not(:disabled):active { transform: scale(0.97); }
@media (prefers-reduced-motion: no-preference) { .cs-ctl button { transition: transform 160ms var(--ease-out, ease-out); } }
.cs-ctl button[aria-pressed="true"] { background: var(--ink); color: var(--paper); }
.cs-ctl label { display: inline-flex; gap: 5px; align-items: center; cursor: pointer; }
.cs-ctl input[type=range] { flex: none; width: 130px; accent-color: var(--accent); }
/* the button keeps the wider label's width, so the slider after it never shifts under a drag */
#cs-play::after { content: "GROUND"; display: block; height: 0; overflow: clip; visibility: hidden; }
.cs-ctl .touch { display: none; }
@media (pointer: coarse) { .cs-ctl .mouse { display: none; } .cs-ctl .touch { display: inline; } }
${frameCss('cs', 'cs-info', ['bar', 'stage', 'read'])}
.cs-stage { position: relative; border: 1.5px solid var(--ink); background: var(--paper); }
.cs-stage:focus-within { outline: max(2px, 0.08em) solid var(--accent); outline-offset: -2px; }
.cs-view { display: block; width: 100%; height: clamp(520px, 80vh, 1400px); background: var(--paper);
  --poster-color: transparent; --progress-bar-color: var(--accent); }
.cs-stage.over .cs-view { cursor: pointer; }
${pinCss('cs-pin', 22, 11)}
.cs-pin { --hue: var(--ink-soft); }
@media (prefers-reduced-motion: no-preference) { .cs-pin { transition: width 0.15s, height 0.15s, transform 160ms var(--ease-out, ease-out); } }
.cs-pin.on { background: var(--accent); border-color: var(--accent); color: var(--paper); }
.cs-stage.far .cs-pin:not(.on) { width: 9px; height: 9px; font-size: 0; border-width: 1.5px; }
.cs-dist { font-family: var(--data); font-size: 11px; font-weight: 600; letter-spacing: 0.16em; color: var(--ink-soft);
  white-space: nowrap; pointer-events: none; }
/* THE CAPTION STRIP. Three kinds of text, each in its own role: the member's identity
   (its pin number as the cards set theirs, its name in the code face — a bare identifier
   is the one place that face earns its keep), a ledger line in the data face at the key
   block's size, and sentences in the prose face at the running text's. Two columns once
   the strip is wide enough to carry them: identity left, sentences right. */
.cs-info { border: 1.5px solid var(--ink); border-block-start: none; background: var(--paper-2); padding-block: 14px 16px; padding-inline: 18px;
  display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px 36px; align-items: start;
  min-height: 92px; color: var(--ink); }
.cs-info h3 { font-family: var(--code); font-size: 16px; font-weight: 600; letter-spacing: 0.04em;
  line-height: 1.3; margin: 0; word-break: break-all; }
.cs-info h3 .n { font-family: var(--data); font-size: 11px; font-weight: 600; letter-spacing: 0.16em;
  color: var(--accent); margin-inline-end: 10px; vertical-align: 0.12em; white-space: nowrap; }
.cs-info .ledger { font-family: var(--data); font-size: 12px; letter-spacing: 0.08em; line-height: 1.5;
  color: var(--ink-soft); margin-block: 3px 0; margin-inline: 0; word-break: break-word; }
.cs-info .txt { display: grid; gap: 4px; }
.cs-info .note, .cs-info .lamp, .cs-info .hint { font-family: var(--prose); font-size: 16px; line-height: 1.5;
  color: var(--ink); max-width: 66ch; margin: 0; }
.cs-info .lamp, .cs-info .hint { color: var(--ink-soft); }
@media (min-width: 900px) {
  .cs-info { grid-template-columns: 300px minmax(0, 1fr); }
  .cs-info > .hint { grid-column: 1 / -1; }
}
/* beside the bar, the panel is one column */
@media (min-width: 1100px) { .cs-frame:fullscreen .cs-info, .cs-frame.is-filled .cs-info { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 560px) {
  .cs-info { padding-block: 12px 14px; padding-inline: 14px; }
  .cs-info h3 { font-size: 15px; }
  .cs-info .note, .cs-info .lamp, .cs-info .hint { font-size: 15px; }
}
/* the plate's general notes, set to the flat set's notes measure: 18/1.8 prose in columns
   no narrower than 24em (48ch) and, because the next column lands first, never past 74ch */
.cs-basis { font-family: var(--prose); font-size: 18px; line-height: 1.8; color: var(--ink);
  border: 1.5px solid var(--ink); border-block-start: none; background: var(--paper-2);
  padding-block: 16px 4px; padding-inline: 22px; column-width: 24em; column-gap: 44px; column-rule: 1px solid var(--line); }
/* a note never splits across columns; the cap only bites in the single-column band */
.cs-basis p { margin-block: 0 1.1em; margin-inline: 0; max-width: 70ch; break-inside: avoid; }
/* the label is a key, not a sentence: data face, tracked caps, its own line */
.cs-basis p > strong:first-child { display: block; font-family: var(--data); font-size: 11.5px;
  font-weight: 600; letter-spacing: 0.16em; line-height: 1.4; text-transform: uppercase;
  color: var(--ink-soft); margin-block: 0 4px; margin-inline: 0; }
/* chip on --paper because the strip is --paper-2; a chip never breaks at desktop */
.cs-basis code { font-family: var(--code); font-size: 0.88em; color: var(--ink); background: var(--paper);
  padding: 0 3px; border-radius: 2px; white-space: nowrap; }
/* nowrap does not hold the <wbr> chipBreaks writes after a slash */
.cs-basis code wbr { display: none; }
@media (max-width: 560px) {
  .cs-basis { font-size: 16px; line-height: 1.65; padding-block: 14px 2px; padding-inline: 14px; }
  .cs-basis code { white-space: normal; overflow-wrap: anywhere;
    -webkit-box-decoration-break: clone; box-decoration-break: clone; }
  .cs-basis code wbr { display: inline; }
}
/* below 1100 the legend and the controls each take a row: one bar, two lines */
@media (max-width: 1100px) {
  .cs-bar { flex-direction: column; align-items: stretch; gap: 8px; }
  .cs-ctl { justify-content: flex-start; }
}
@media (max-width: 860px) { .cs-view { height: clamp(420px, 62vh, 620px); } }`;

// The scene, as a module for the app: handed the resolved <model-viewer> module
// and the opening pin, it returns { dispose, select }.
const BODY = `${FOCUS_JS}${MV_JS}  ${DRESS_JS}
  var mv = root.querySelector('#cs-viewer');
  var island = root.querySelector('#cs-city');
  if (!mv || !island || !viewer) return undefined;
  var D = JSON.parse(island.textContent);
  var stage = root.querySelector('.cs-stage');
  var info = root.querySelector('#cs-info');
  var laneBox = root.querySelector('#cs-lane');
  var legend = root.querySelector('.cs-legend');
  var corners = Array.prototype.slice.call(root.querySelectorAll('[data-az]'));
  var reset = root.querySelector('#cs-reset');
  var play = root.querySelector('#cs-play');
  var slider = root.querySelector('#cs-t');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var ac = new AbortController();
  var on = function (el, type, fn, capture) { el.addEventListener(type, fn, { signal: ac.signal, capture: Boolean(capture) }); };
  var END = D.end, t = END, clock = 0, loaded = false, lane = 'tier', litN = null, pinN = null, pal = null, homeR = 0, homeFov = D.home.fov, raf = 0;
  var byN = {}, pins = {};
  D.rows.forEach(function (b) {
    byN[b.n] = b;
    pins[b.n] = mv.querySelector('[slot="hotspot-' + b.n + '"]');
  });
  var order = D.rows.filter(function (b) { return b.tier !== 'off'; })
    .map(function (b) { return b.n; }).sort(function (a, b) { return a - b; });
  var IDLE = '<p class="hint">Hover or tap any mass to read its member: district, gate tier, '
    + "authored source and the spec annex beside it. Each pin carries the member's number on sheet 7. "
    + 'A tap pins the member and the link in the address bar carries the pin; tap it again or the ground to clear it.</p>';

  // ---- the dress: every material recomputed from the page's tokens, in linear light ----
  var TOK = { paper: '--paper', paper2: '--paper-2', ink: '--ink', soft: '--ink-soft', faint: '--ink-faint',
    line: '--line', accent: '--accent', red: '--red', redHatch: '--red-hatch', green: '--green', halo: '--halo' };
  function palette() {
    var c = { black: [0, 0, 0] };
    Object.keys(TOK).forEach(function (k) { c[k] = tokenRgb(tokColor(TOK[k])); });
    c.redHatch = c.redHatch || c.red;
    c.green = c.green || c.accent;
    // --halo is an rgba: its colour rides alone, the depth comes from D.M.lit's own factors
    c.halo = c.halo || c.accent;
    return c;
  }
  function frameOf(n) {
    var r = D.M.frames.filter(function (f) { return f[0] === n; })[0];
    return r ? pal[lane === 'light' ? r[2] : r[1]] : pal.ink;
  }
  function retint() {
    pal = palette();
    var rows = cityDress(pal, D.M, lane).map(function (row) {
      return litN !== null && row[0] === 'frame-' + litN ? [row[0], pal.accent, 1] : row;
    });
    return paint(mv, rows);
  }
  // a member drawn hot: its frame takes the accent
  function light(n, hot) {
    if (n === null || !pal) return;
    void paint(mv, [['frame-' + n, hot ? pal.accent : frameOf(n), 1]]);
  }

  // ---- reading ----
  function fmt(v) { return String(v).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ','); }
  function plural(n) { return n === 1 ? ' file' : ' files'; }
  // the light lane's sentence: sheet 7A's own numbers, unrounded
  function survey(b) {
    var sv = D.survey[b.n];
    if (sv.cat === 'z') return 'no mass — nothing to light';
    if (sv.cat === 'n') return 'FULL SHADOW — no suite';
    if (sv.cat === 'e') return 'e2e light only — no meter reads it';
    if (sv.cat === 'u') return 'tests run — no meter attaches';
    var s = 'suite lights ' + sv.ext + '% of the source';
    if (sv.line != null) s += ' · line ' + sv.line;
    if (sv.branch != null) s += ' · branch ' + sv.branch;
    if (sv.func != null) s += ' · func ' + sv.func;
    return sv.ext ? s : s + ' — the lamp is lit, pointed elsewhere';
  }
  function describe(b) {
    var line = D.distText[b.dist] + ' · ' + D.tierText[b.tier] + ' — '
      + (b.sf ? fmt(b.sl) + ' src sloc in ' + b.sf + plural(b.sf) : 'no authored source');
    if (b.pf) line += ' · spec annex ' + fmt(b.pl) + ' sloc in ' + b.pf + plural(b.pf);
    var tail = lane === 'light' ? '<p class="lamp">' + survey(b) + '</p>' : '';
    return '<div class="id"><h3><span class="n">' + b.n + '</span>' + b.name + '</h3>'
      + '<p class="ledger">' + line + '</p></div><div class="txt"><p class="note">'
      + (D.notes[b.n] || '') + '</p>' + tail + '</div>';
  }
  function show(n) {
    if (n === litN) return;
    if (litN !== null) light(litN, false);
    litN = n;
    if (litN !== null) light(litN, true);
    info.innerHTML = litN === null ? IDLE : describe(byN[litN]);
  }
  // a member number, or null for anything that names none
  function member(v) {
    var n = v === null || v === undefined || v === '' ? NaN : Number(v);
    return byN[n] ? n : null;
  }

  // ---- the camera ----
  function vec(p) { return p[0] + 'm ' + p[1] + 'm ' + p[2] + 'm'; }
  function settle() { if (reduce.matches) mv.jumpCameraToGoal(); }
  // a pin from the url or the keyboard brings its member in; a clear goes back to the home target and field
  function frame(n) {
    if (n === null) {
      mv.cameraTarget = ${JSON.stringify(HOME_TARGET)};
      mv.fieldOfView = D.home.fov + 'deg';
    } else {
      mv.cameraTarget = vec(byN[n].centre);
      mv.fieldOfView = Math.min(mv.getFieldOfView(), D.home.pin) + 'deg';
    }
    settle();
  }
  function turnTo(az) {
    var o = mv.getCameraOrbit();
    mv.cameraOrbit = az + 'deg ${ISO_POLAR}deg ' + o.radius + 'm';
    settle();
  }
  // the home radius frames the plan's diagonal at this stage's aspect; the viewer widens a narrow stage's field itself
  function home() {
    var r = mv.getBoundingClientRect(), tv = Math.tan(homeFov * Math.PI / 360);
    homeR = Math.max(D.home.span[0] / ((r.width / r.height) * tv), D.home.span[1] / tv);
    mv.cameraOrbit = ${JSON.stringify(`${CORNERS[0]}deg ${ISO_POLAR}deg `)} + homeR + 'm';
    settle();
  }
  // how large the city stands against its home pose: the radius and the field of view both zoom
  function scale() {
    var o = mv.getCameraOrbit();
    if (!homeR || !o.radius) return 1;
    return (homeR * Math.tan(homeFov * Math.PI / 360)) / (o.radius * Math.tan(mv.getFieldOfView() * Math.PI / 360));
  }
  // css px per model unit on screen: the hatch and the strokes are drawn for PX of them at home
  function density() {
    var o = mv.getCameraOrbit();
    if (!o.radius) return 1;
    return (mv.getBoundingClientRect().height / 2) / (o.radius * Math.tan(mv.getFieldOfView() * Math.PI / 360));
  }
  function onCamera() {
    stage.classList.toggle('far', density() < D.home.dots);
    var o = mv.getCameraOrbit(), az = ((o.theta * 180 / Math.PI) % 360 + 360) % 360;
    corners.forEach(function (c) {
      var d = Math.abs(az - Number(c.getAttribute('data-az')));
      c.setAttribute('aria-pressed', String(Math.min(d, 360 - d) < 0.5));
    });
  }

  // ---- the rise: one clock for the pose, the pins riding it, and the controls that read it ----
  function grown(at, span) { return 0.001 + 0.999 * Math.min(1, Math.max(0, (at - span[0]) / (span[1] - span[0]))); }
  function pinAt(b) {
    var y = b.h * grown(t, b.rise) + (D.crowns ? (b.top - b.h) * grown(t, D.crowns) : 0) + D.lift;
    return b.cap[0] + 'm ' + y.toFixed(3) + 'm ' + b.cap[2] + 'm';
  }
  function pose(next) {
    t = Math.min(END, Math.max(0, next));
    // a hair short of the end: three clamps a LoopOnce action that reaches it, and a clamped action ignores later seeks
    if (loaded) mv.currentTime = Math.min(t, END - 1e-4);
    slider.value = String(t);
    play.textContent = t >= END ? 'GROUND' : 'RAISE';
    D.rows.forEach(function (b) { mv.updateHotspot({ name: 'hotspot-' + b.n, position: pinAt(b) }); });
  }
  function stop() {
    if (clock) cancelAnimationFrame(clock);
    clock = 0;
  }
  // forward or back at the clip's own speed; reduced motion lands at once
  function run(to) {
    stop();
    if (reduce.matches) { pose(to); return; }
    var dir = to > t ? 1 : -1, last = performance.now();
    function tick(now) {
      clock = 0;
      var next = t + dir * (now - last) / 1000;
      last = now;
      if (dir > 0 ? next >= to : next <= to) { pose(to); return; }
      pose(next);
      clock = requestAnimationFrame(tick);
    }
    clock = requestAnimationFrame(tick);
  }

  // ---- pins: one tab stop, on the pinned member or the first ----
  function rove() {
    var stop = pinN !== null ? pinN : order[0];
    order.forEach(function (k) { pins[k].tabIndex = k === stop ? 0 : -1; });
  }
  // idempotent, so the url's echo of a pick lands on a no-op
  function pin(n) {
    if (n === pinN) return false;
    pinN = n;
    D.rows.forEach(function (b) {
      pins[b.n].classList.toggle('on', b.n === n);
      pins[b.n].setAttribute('aria-pressed', String(b.n === n));
    });
    rove();
    show(n);
    return true;
  }
  // a tap pins; the pinned member or the ground clears it, and the url follows
  function tap(n) {
    var next = n === pinN ? null : n;
    if (!pin(next)) return;
    atlasFocusPush(mv, next === null ? null : String(next));
  }
  // the keyboard's pin also frames, and carries the focus along the pins
  function key(n) {
    var was = pinN, focused = document.activeElement && document.activeElement.classList.contains('cs-pin');
    tap(n);
    if (pinN === was) return;
    frame(pinN);
    if (focused && pinN !== null) pins[pinN].focus();
  }

  // ---- picking: model-viewer's own hit test, against the island's boxes ----
  function pick(e) {
    var hit = mv.positionAndNormalFromPoint(e.clientX, e.clientY);
    if (!hit) return null;
    var p = hit.position;
    for (var i = 0; i < D.rows.length; i++) {
      var bx = D.rows[i].boxes;
      for (var j = 0; j < bx.length; j++) {
        var q = bx[j];
        if (p.x >= q[0] && p.x <= q[3] && p.y >= q[1] && p.y <= q[4] && p.z >= q[2] && p.z <= q[5]) return D.rows[i].n;
      }
    }
    return null;
  }
  var down = null;
  on(mv, 'pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, moved: 0 }; });
  on(mv, 'pointermove', function (e) {
    if (down && e.buttons) {
      down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
      return;
    }
    // hover is a reading aid, not a fight with the camera: not mid-drag, not under a finger
    if (e.pointerType === 'touch' || !loaded || raf) return;
    var cx = e.clientX, cy = e.clientY;
    raf = requestAnimationFrame(function () {
      raf = 0;
      var n = pick({ clientX: cx, clientY: cy });
      stage.classList.toggle('over', n !== null);
      show(n !== null ? n : pinN);
    });
  });
  on(mv, 'pointerup', function (e) {
    var d = down;
    down = null;
    if (!d || d.moved >= 4 || !loaded || e.target !== mv) return;
    tap(pick(e));
  });
  on(mv, 'pointerleave', function () {
    stage.classList.remove('over');
    show(pinN);
  });
  D.rows.forEach(function (b) {
    var n = b.n;
    on(pins[n], 'click', function (e) {
      tap(n);
      // a pin pressed from the keyboard frames its member, as the arrows do
      if (e.detail === 0 && pinN !== null) frame(pinN);
    });
    on(pins[n], 'pointerenter', function () { show(n); });
  });
  pinKeys(stage, on, {
    step: function (d) { key(walk(order, pinN, d)); },
    enter: function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('cs-pin')) return false;
      key(litN !== null ? litN : pinN !== null ? pinN : order[0]);
      return true;
    },
    escape: function () { if (pinN === null) return false; key(pinN); return true; },
  });
  wheelGate(stage, on);
  corners.forEach(function (c) { on(c, 'click', function () { turnTo(Number(c.getAttribute('data-az'))); }); });
  on(reset, 'click', function () {
    home();
    frame(null);
  });
  on(laneBox, 'change', function () {
    lane = laneBox.checked ? 'light' : 'tier';
    mv.variantName = lane === 'light' ? 'test-light' : null;
    legend.innerHTML = D.legend[lane];
    info.innerHTML = litN === null ? IDLE : describe(byN[litN]);
    void retint();
  });
  on(play, 'click', function () { run(t >= END ? 0 : END); });
  on(slider, 'input', function () { stop(); pose(Number(slider.value)); });
  on(mv, 'camera-change', onCamera);
  on(window, 'resize', onCamera);
  var themeOff = onTheme(retint, on);

  var ready = new Promise(function (resolve) {
    function boot() {
      loaded = true;
      homeFov = mv.getFieldOfView();
      home();
      mv.jumpCameraToGoal();
      // LoopOnce, so the clip's last frame is the raised city rather than a wrap to the ground
      mv.play({ repetitions: 1 });
      mv.pause();
      play.disabled = false;
      slider.disabled = false;
      pose(t);
      onCamera();
      revealPainted(mv, retint).then(resolve);
    }
    if (mv.loaded) boot();
    else on(mv, 'load', boot);
  });
  info.innerHTML = IDLE;
  rove();
  pin(member(atlasFocusRead(focus)));
  if (pinN !== null) frame(pinN);

  // verification hook: the pose, the pin, the lane, and a clean frame for the card photograph
  window.__cityScene = {
    ready: ready,
    plant: D.plant,
    pinned: function () { return pinN; },
    hovered: function () { return litN; },
    lane: function () { return lane; },
    orbit: function () { return mv.getCameraOrbit().toString(); },
    fov: function () { return mv.getFieldOfView(); },
    scale: scale,
    density: density,
    target: function () { return mv.getCameraTarget().toString(); },
    panel: function () { return info.textContent; },
    pick: function (x, y) { return pick({ clientX: x, clientY: y }); },
    animations: function () { return mv.availableAnimations; },
    time: function () { return t; },
    pose: function (v) { stop(); pose(v); },
    photo: function () {
      Array.prototype.forEach.call(mv.querySelectorAll('[slot^="hotspot-"]'), function (el) { el.style.visibility = 'hidden'; });
    },
  };

  return {
    select: function (n) { if (pin(member(n))) frame(pinN); },
    dispose: function () {
      stop();
      if (raf) cancelAnimationFrame(raf);
      themeOff();
      ac.abort();
      delete window.__cityScene;
    },
  };
`;

/** emit-app.mjs writes this to app/src/generated/city-init.js. */
export function cityInitModule() {
  return `// GENERATED by www/atlas.lit-ui-router.dev/generator/city-scene.mjs — do not edit.
// Sheet 7's city in the round: wires the fragment's <model-viewer> to its lane, corners
// and pins once the routed state has loaded the element; returns { dispose, select }.
export async function initCity(root, viewer, focus) {
${BODY}}
`;
}

export const CITY_INIT_DTS = `// GENERATED by www/atlas.lit-ui-router.dev/generator/emit-app.mjs — do not edit.
/** The wired model: its teardown, and the pin the url carries as \`focus\`. */
export interface CityScene {
  dispose(): void;
  /** Pins member \`n\`; null, or a number no member carries, clears the pin. */
  select(n: number | null): void;
}
/** Wires the model inside \`root\`, opening on the \`focus\` pin.
 *  Undefined when there was nothing to wire — no plate, or no viewer. */
export declare function initCity(
  root: Element,
  viewer: unknown,
  focus: string | null,
): Promise<CityScene | undefined>;
`;

const pct = (v) => Math.round(v * 100);
// The basis notes: running prose under the stage, present state only, one note per concern.
// The plant sheet adds PLANT after HATCH.
const BASIS_NOTES = (plant) => [
  ['BASIS', `The model masses sheet 7's own geometry: every footprint, height and position is <code>generator/sheet7.mjs</code>'s computed <code>CITY</code> export, massed from <code>data/census-city.json</code>, ${BASIS}. <code>generator/city-glb.mjs</code> writes it into one glTF binary, <code>${plant ? PLANT_GLB : CITY_GLB}</code>, at one plan unit to the model unit, with a node per mass and per annex${plant ? ' and per plant' : ''}; nothing is re-derived, so a mass in the model cannot drift from the mass on the plate. <code>@google/model-viewer</code> ${MV_VERSION} and the model are fetched only when this page is entered, and the viewer draws only while something moves.`],
  ['PAPER', `The masses are drawn the way the flat plates draw them. Faces are opaque and remove what stands behind them. The cap takes the tier's own fill; the walls take a <code>--paper-2</code> stone, the tier's hue pulled ${pct(TINT)}% of the way in so the tiers still part at a glance, each wall graded a breath darker toward its foot. Every material is unlit and baked in the vellum palette, and the page recomputes each one from its own tokens on load and on every theme turn, so the cyanotype theme stands the city on navy paper. Each frame strokes the tier's edge colour from the ladder the plates use (red, accent, <code>--line</code>, soft, ink) as a strip on the faces either side of the edge.`],
  ['HATCH', `Laid in world space: a pattern tile repeated over the +x and −z walls, ${HATCH.hx.sp} CSS px apart across the rake at the home pose, so the stripes keep their spacing on the model and grow with it as the camera closes in. Gate severity is the rake: the halt and PR hatch runs opposite to the neutral one, and the halt cap is filled red. The <code>pr</code> and <code>late</code> tiers carry sheet 7's roof wash, the cap taking the side's hatch. The <code>off</code> tier is drawn frame-only, because there is nothing to mass.`],
  ...(plant ? [['PLANT', `Every massed member is drawn as a working plant, after the sprite study's Factorio-leaning treatment, and every piece of it reads a field the census row already carries. The plant keeps to the roof's corners, clear of the pin over its centre. Stacks stand in a row up the west edge, one per ten authored files up to four, their height set by the footprint and banded in the tier's edge colour. Tanks line the north edge from the north-east corner, one at 150 sloc, two at 600, three at 1,800, as many as the roof holds. A header pipe joins them, and the field left over carries one vent per five files, up to six. A footprint of 45 units or more takes a portal gantry along its east edge, and one of 28 or more a catwalk rail. A wall of 20 units or more runs a riser up its east face, two from 60, and a mass of 40 or more is ringed by a deck every ${PLANT_RULES.deckEvery} units. A spec annex is joined by a pipe rack across the gap and carries three module lamps, lit green by sheet 7A's line coverage: three at 95 and over, two at 85, one below or unmetered, none when no suite loads the member. Where a choice is left, such as which roof cells the vents take, a generator seeded on the member's name makes it, so the same census always builds the same plant. Each solid is a box or two turned boxes, stacks and tanks as octagons, merged per material on its member's roof and shaded top to foot.`]] : []),
  ['CAMERA', `Perspective, at a ${HOME_FOV}° field of view, so the city reads close to the plates' isometric. The camera orbits free under the pointer with the viewer's own damping, and four buttons turn it to the true diagonals, ${CORNERS.join('°, ')}° at the isometric polar angle of 54.736°, instantly under <code>prefers-reduced-motion</code>. A plain scroll over the plate scrolls the page; the wheel zooms once the plate has been touched.`],
  ['LETTERING', `Each member carries a numbered pin with sheet 7's own number, standing over its ${plant ? 'plant' : 'cap'}, in the page's data face and its colours. Once the plan stands smaller than ${pct(DOTS)}% of its size at home on a desktop stage, the unpinned pins fold to dots, so a distant or a phone-sized plan stays a plan. District names stand on their ground plates as labels of their own. The reading panel prints the same row the schedule does.`],
  ['RISE', `The model carries one clip, <code>rise</code>, ${RISE_SECONDS} s: every mass and its annex grow out of the ground in sheet 7's schedule order, district by district${plant ? ', and the plants grow onto their roofs over the last 0.4 s' : ''}. The plate opens raised and never plays by itself. RAISE ⇄ GROUND runs the clip at its own speed and the slider scrubs it, the pins riding the roofs; under <code>prefers-reduced-motion</code> the button lands at once.`],
  ['TEST LIGHT', `A second material lane over the same geometry, the model's <code>test-light</code> variant: the city relit from <code>data/census-shadow.json</code>, ${SURVEY_META.basis}, the ref the geometry is massed at, with ${SURVEY_META.metered} members read under their own suites' meters. The model and the flat shadow plate cannot drift either. Every mass in the model has a survey row; one without is a build error.`],
  ['POLARITY', `Sheet 7A's: covered source is LIT, source no suite loads is SHADOW, and the spec annex is the LAMP that throws the light. A metered member's mass splits along its footprint. The lit slab is side × the extent the meter records, taken from the annex (east) side, its tint stepping down through the line-coverage bands. The shadow slab is sheet 7A's own black wash with a faint stripe, lerped toward black rather than the ink, because <code>--ink</code> is light in the cyanotype theme and a shadow that brightens in the dark is not a shadow.`],
];

/** A plate: style, section and the JSON island — no init script. */
function markup(plant) {
  const meta = plant ? PLANT_META : CITY_META;
  const data = island(plant);
  // swatch fills follow the same tints the model uses, in page tokens
  const HUE = { red: '--red', accent: '--accent', halo: '--accent', soft: '--ink-soft',
    ink: '--ink', faint: '--ink-faint', black: '#000' };
  const swatch = (k, t) => {
    const hue = HUE[t.hue];
    const paint = hue.startsWith('--') ? `var(${hue})` : hue;
    return `.cs-legend .sw-${k} { background: color-mix(in srgb, ${paint} ${Math.round(t.f * 100)}%, var(--paper)); }`;
  };
  // A tier key draws what a tier's wall draws: the cap's stone with the tier's hue a breath
  // in, and the side's hatch over it at the side's own rake.
  const STROKE = { line: '--line', soft: '--ink-soft', redHatch: '--red-hatch', accent: '--accent', ink: '--ink' };
  const tierSwatch = (k) => {
    const f = FACES[k];
    const h = HATCH[f.a[1]];
    const stone = f.cap[0] === 'red'
      ? 'var(--red)'
      : `color-mix(in srgb, var(${HUE[TIERS[k].hue]}) ${Math.round(TIERS[k].f * TINT * 100)}%, var(--${f.cap[0] === 'paper2' ? 'paper-2' : 'paper'}))`;
    const ink = `color-mix(in srgb, var(${STROKE[h.tok]}) ${Math.round(h.a * 100)}%, transparent)`;
    const rake = h.rake > 0 ? 135 : 45;
    return `.cs-legend .sw-${k} { background: repeating-linear-gradient(${rake}deg, ${ink} 0 1px, transparent 1px ${h.sp}px), ${stone}; }`;
  };
  const swatchCss = LEGEND.map(([k]) => tierSwatch(k))
    .concat(LIGHT_LEGEND.map(([k]) => swatch(k, LIT[k]))).join('\n');
  const r4 = (p) => p.map((v) => `${v}m`).join(' ');
  const pins = data.rows.map((b) =>
    `        <button type="button" class="cs-pin" slot="hotspot-${b.n}" data-position="${r4(b.cap)}" data-normal="0m 1m 0m" aria-pressed="false" tabindex="-1" aria-label="Member ${b.n}, ${b.name}">${b.n}</button>`).join('\n');
  const labels = data.districts.map((d) =>
    `        <span class="cs-dist" slot="hotspot-district-${d.d}" data-position="${r4(d.at)}" data-normal="0m 1m 0m" aria-hidden="true">${DIST_LABEL[d.d]}</span>`).join('\n');
  const alt = `Sheet 7's census city in three dimensions: ${MASSED} massed workspace members in four districts, ${plant ? 'each crowned by a working plant of stacks, tanks, vents and pipes sized from its own census, and ' : ''}each an opaque paper box inside its girding frame, its right-hand wall hatched in the rake its gate tier is hatched in on the flat plate, footprint proportional to the square root of its authored lines and height three units per authored file, with ${ANNEXES} dashed spec annexes beside them. Each member carries a numbered pin matching sheet 7's schedule. A TEST LIGHT switch relights the same city from sheet 7A's shadow survey: each metered member's mass splits along its footprint, the share its own suite loads lit from the annex side and the rest washed toward black, with the spec annexes burning as the lamps that throw the light.`;

  return `<style>${CSS}
${swatchCss}</style>
<section class="sheet cs" id="${meta.id}-scene" aria-label="${plant ? 'The Working City in the round — sheet 7 in three dimensions, each mass crowned by a working plant' : 'The City in the round — sheet 7 in three dimensions'}, with a second material lane that relights it from sheet 7A's shadow survey">
  <div class="sheet-head"><span class="proj">${PROJECT_MARK} — INTERACTIVE PLATE</span><span class="shno">${meta.head} · REV ${meta.rev}</span></div>
  <h2 class="sheet-title">${articleTitle(meta.title)}</h2>
  <p class="sheet-sub">${meta.sub}</p>
  <div class="cs-frame fillable" id="cs-frame"><button type="button" class="fill" data-fill aria-label="Enlarge this figure, or leave it"></button>
    <div class="cs-bar">
      <div class="cs-legend">
        ${data.legend.tier}
      </div>
      <div class="cs-ctl">
        <span class="mouse">DRAG TO ORBIT · HOVER TO READ · TAP TO PIN · ← → STEP · ENTER PINS · ESC CLEARS</span><span class="touch">A FINGER ACROSS ORBITS · PINCH TO ZOOM · TAP TO PIN</span>
        <span class="grp" role="group" aria-label="Camera corner">
${CORNERS.map((az, i) => `          <button type="button" data-az="${az}" aria-pressed="${i === 0}">${az}°</button>`).join('\n')}
        </span>
        <label><input type="checkbox" id="cs-lane"> TEST LIGHT</label>
        <button type="button" id="cs-play" disabled>GROUND</button>
        <label>GROUND <input type="range" id="cs-t" min="0" max="${RISE_SECONDS}" step="0.01" value="${RISE_SECONDS}" disabled aria-label="The rise, from the ground to the raised city"> RAISED</label>
        <button type="button" id="cs-reset">RESET</button>
      </div>
    </div>
    <div class="cs-stage">
      <model-viewer id="cs-viewer" class="cs-view" src="${BASE}${plant ? PLANT_GLB : CITY_GLB}" loading="eager" reveal="manual" camera-controls disable-tap touch-action="pan-y" interaction-prompt="none" camera-orbit="${orbitAt(CORNERS[0])}" camera-target="${HOME_TARGET}" max-camera-orbit="Infinity 88deg 160%" field-of-view="${HOME_FOV}deg" min-field-of-view="4deg" max-field-of-view="20deg" tone-mapping="none" exposure="1" shadow-intensity="0" animation-name="rise" alt="${alt}">
${pins}
${labels}
      </model-viewer>
    </div>
    <aside class="cs-info" id="cs-info" aria-live="polite"></aside>
  </div>
  <div class="cs-basis">
${BASIS_NOTES(plant).map(([k, v]) => `    <p><strong>${k}</strong> ${v}</p>`).join('\n')}
  </div>
</section>
<script type="application/json" id="cs-city">${json(data)}</script>`;
}

/** The measured city's plate. */
export const cityMarkup = () => markup(false);

/** The working city's plate: the same plate with its plants raised. */
export const plantMarkup = () => markup(true);

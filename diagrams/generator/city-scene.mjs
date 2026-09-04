// I8 (full step) — THE CITY, ISOMETRIC: sheet 7's census city as a real 3D scene.
//
// The CSS-perspective tilt on the survey-office graph was the cheap first step;
// the payoff the atlas actually wanted is here — the isometric city in the round,
// with an isometric SNAP: the camera orbits freely under the pointer and lands on
// one of the four true diagonals when you let go.
//
// Nothing is re-derived: sheet7.mjs exports its COMPUTED geometry (CITY) and this
// module ships those rows verbatim as a JSON island, so a mass in the scene can
// never drift from the mass on the plate.  Treatment is the pinned sprite recipe
// in three dimensions: semi-opaque tinted walls over a girding frame, so the
// structure behind reads through — a drafting set, not a video game.
import { readFileSync } from 'node:fs';
import { CITY, PLACED } from './sheet7.mjs';
import { SURVEY, SURVEY_META } from './sheet7a.mjs';

export const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.169.0/three.module.min.js';
export const REV = 'D';

const PLATE = JSON.parse(readFileSync(new URL('../data/census-city.json', import.meta.url), 'utf8'));
const BASIS = `${PLATE.ref} @ ${PLATE.sha} (${PLATE.generatedAtTime.slice(0, 10)})`;

// Tier -> wall tint: a hue token and how far the vellum is pulled towards it.
// Severity is COLOUR here exactly as on the plate; height stays the file count.
const TIERS = {
  halt: { hue: 'red', f: 0.62, label: 'halts a publish' },
  pr: { hue: 'red', f: 0.34, label: 'stops the PR line' },
  late: { hue: 'accent', f: 0.34, label: 'gates a later stage' },
  report: { hue: 'soft', f: 0.13, label: 'never gates' },
  line: { hue: 'ink', f: 0.24, label: 'the material' },
  off: { hue: 'faint', f: 0, label: 'types only — frame, no mass' },
  annex: { hue: 'accent', f: 0.16, label: 'spec annex — the test mass' },
};
// The SECOND lane — sheet 7A's polarity in three dimensions: covered source is
// LIT, untested source is SHADOW, and the spec annex is the lamp that throws it.
// Shadow lerps toward BLACK, never ink: ink is light in the cyanotype theme, and
// a shadow that brightens in the dark is not a shadow.  The flat plate's own rule.
const LIT = {
  b1: { hue: 'halo', f: 0.46, label: 'LIT ≥95' },
  b2: { hue: 'halo', f: 0.34, label: 'lit 85–95' },
  b3: { hue: 'red', f: 0.38, label: 'lit <85' },
  b4: { hue: 'red', f: 0.58, label: 'lit <85' },
  sh: { hue: 'black', f: 0.74, label: 'SHADOW — never loaded' },
  e2e: { hue: 'accent', f: 0.24, label: 'e2e light (accent)' },
  bare: { hue: 'ink', f: 0.05, label: 'no meter attaches' },
  lamp: { hue: 'halo', f: 0.60, label: 'lamp = spec annex' },
};
const DISTRICTS = { pkg: 24, app: 24, site: 24, tool: 26 };
// sheet 7's own vocabulary, verbatim: the panel must read like the flat schedule
const TIER_TEXT = {
  halt: 'HALTS A PUBLISH', pr: 'STOPS THE PR LINE', late: 'gates a later stage',
  report: 'never gates', line: 'the material', off: 'types only — not massed',
};
const DIST_TEXT = { pkg: 'packages/', app: 'apps/', site: 'docs/ + examples/', tool: 'tools/' };
const DIST_LABEL = { pkg: 'PACKAGES/', app: 'APPS/', site: 'DOCS + EXAMPLES/', tool: 'TOOLS/' };

const LEGEND = ['halt', 'pr', 'late', 'report', 'line', 'annex'].map((k) => [k, TIERS[k].label]);
const LIGHT_LEGEND = ['b1', 'b2', 'b3', 'sh', 'e2e', 'lamp'].map((k) => [k, LIT[k].label]);
const lgHtml = (rows) => rows
  .map(([k, d]) => `<span class="lg"><i class="sw sw-${k}"></i>${d}</span>`).join('\n      ');

// Every mass must have a survey row — sheet 7A now numbers from sheet 7's own
// PLACED table, so a mass without light is a build error, not a blank building.
const SURVEY_BY_N = Object.fromEntries(SURVEY.map((r) => [r.n, r]));
for (const b of CITY) {
  if (!SURVEY_BY_N[b.n]) throw new Error(`city-scene: member ${b.n} has no row in sheet 7A's SURVEY`);
}

const DATA = {
  three: THREE_URL,
  rows: CITY,
  tiers: TIERS,
  districts: DISTRICTS,
  // the schedule's own note line, keyed by member number — the plate's prose, not new prose
  notes: Object.fromEntries(PLACED.map(([n, , , , , , , note]) => [n, note])),
  lit: LIT,
  survey: SURVEY_BY_N,
  tierText: TIER_TEXT,
  distText: DIST_TEXT,
  distLabel: DIST_LABEL,
  chip: { h: 21, lift: 9, min: 0.62 },   // world units; min = zoom below which chips fade out
  az0: 45,                 // the initial diagonal; the snap targets are 45/135/225/315
  snaps: [45, 135, 225, 315],
  snapMs: 380,
  margin: 1.06,
  zoom: [0.45, 4],
  op: { cap: 0.88, side: 0.8 },
  legend: { tier: lgHtml(LEGEND), light: lgHtml(LIGHT_LEGEND) },
};

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

const MASSED = CITY.filter((b) => b.tier !== 'off').length;
const ANNEXES = CITY.filter((b) => b.sa).length;

const CSS = `
.cs { max-width: 1300px; margin: 0 auto 40px; }
.cs-bar { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; justify-content: space-between;
  border: 1.5px solid var(--ink); border-bottom: none; background: var(--paper-2); padding: 8px 14px; }
.cs-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; }
.cs-legend .lg { display: inline-flex; align-items: center; gap: 7px; font-family: var(--mono); font-size: 9.5px;
  letter-spacing: 0.06em; color: var(--ink-soft); }
.cs-legend .sw { display: block; width: 20px; height: 12px; border: 1.2px solid var(--ink); }
.cs-legend .sw-annex, .cs-legend .sw-lamp { border-color: var(--ink-soft); border-style: dashed; }
.cs-ctl { display: flex; gap: 12px; align-items: center; font-family: var(--mono); font-size: 9.5px;
  letter-spacing: 0.1em; color: var(--ink-soft); }
.cs-ctl button { font: inherit; letter-spacing: inherit; color: var(--ink); background: var(--paper);
  border: 1px solid var(--ink); padding: 4px 9px; cursor: pointer; }
.cs-ctl button:hover { background: var(--paper-2); }
.cs-ctl label { display: inline-flex; gap: 5px; align-items: center; cursor: pointer; }
.cs-stage { border: 1.5px solid var(--ink); background: var(--paper); }
/* pan-y keeps the page scrollable under a touch; a horizontal drag orbits */
.cs-canvas { height: 540px; touch-action: pan-y; cursor: grab; position: relative; overflow: hidden; }
.cs-canvas.over { cursor: pointer; }
.cs-canvas.grabbing { cursor: grabbing; }
.cs-canvas canvas { display: block; }
.cs-canvas .cs-note { position: absolute; inset: 0; display: grid; place-items: center; text-align: center;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em; color: var(--ink-faint); padding: 20px; }
.cs-info { border-top: 1.5px solid var(--ink); background: var(--paper-2); padding: 9px 14px 10px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.04em; color: var(--ink); min-height: 52px; }
.cs-info h4 { font-size: 11.5px; letter-spacing: 0.08em; margin: 0 0 3px; word-break: break-all; }
.cs-info p { margin: 0; color: var(--ink-soft); word-break: break-word; }
.cs-info .hint { color: var(--ink-faint); }
.cs-basis { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.06em; color: var(--ink-faint);
  border: 1.5px solid var(--ink); border-top: none; background: var(--paper-2); padding: 8px 14px 9px; }
@media (max-width: 860px) { .cs-canvas { height: 460px; } }`;

// Written without template placeholders on purpose: it is emitted inside one, and
// every number it draws arrives through the JSON island.
const INIT = `
(function () {
  var stage = document.getElementById('cs-canvas');
  var island = document.getElementById('cs-city');
  if (!stage || !island) return;
  var D = JSON.parse(island.textContent);
  var hint = document.getElementById('cs-hint');
  var info = document.getElementById('cs-info');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function tok(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  // --halo is an rgba and a wall carries no alpha: the hue rides alone, and the
  // depth comes from D.lit's own factors.  black is not a token — shadow must
  // darken in BOTH themes, and --ink is light in the cyanotype one.
  function bare(v, fb) { return /^rgba\\(/.test(v) ? v.replace(/,[^,)]*\\)$/, ')').replace('rgba', 'rgb') : (v || fb); }
  function pal() {
    return { ink: tok('--ink'), soft: tok('--ink-soft'), faint: tok('--ink-faint'),
      accent: tok('--accent'), halo: bare(tok('--halo'), tok('--accent')), red: tok('--red'),
      paper: tok('--paper'), paper2: tok('--paper-2'), black: '#000000',
      mono: tok('--mono') || 'ui-monospace, Menlo, monospace' };
  }
  function note(msg) {
    var el = document.createElement('p');
    el.className = 'cs-note';
    el.textContent = msg;
    stage.appendChild(el);
  }

  function boot(THREE) {
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
      note('THIS PLATE NEEDS WEBGL — SHEET 7 DRAWS THE SAME CITY FLAT');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    stage.appendChild(renderer.domElement);
    var scene = new THREE.Scene();

    // ---- the plate's own plan bounds, centred on the origin ------------------
    var rows = D.rows;
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 0;
    rows.forEach(function (b) {
      minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.s);
      minZ = Math.min(minZ, b.y); maxZ = Math.max(maxZ, b.y + b.s);
      maxY = Math.max(maxY, b.h, b.ha);
      if (b.sa) {
        minX = Math.min(minX, b.ax); maxX = Math.max(maxX, b.ax + b.sa);
        minZ = Math.min(minZ, b.ay); maxZ = Math.max(maxZ, b.ay + b.sa);
      }
    });
    var PAD = 30;
    minX -= PAD; maxX += PAD; minZ -= PAD; maxZ += PAD;
    var cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    var target = new THREE.Vector3(0, maxY / 2, 0);

    // ---- materials: one set per tier, recoloured with the theme ---------------
    var mats = {}, hot = {}, lines = {};
    var make = function (lift) {
      return ['cap', 'a', 'b'].map(function (k) {
        return new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false,
          opacity: Math.min(1, (k === 'cap' ? D.op.cap : D.op.side) + lift) });
      });
    };
    Object.keys(D.tiers).forEach(function (t) {
      mats[t] = make(0);
      hot[t] = make(0.1);           // the hover twin: same tint pulled a shade further
    });
    // the second lane's own materials — same treatment, sheet 7A's polarity
    var lmats = {}, lhot = {};
    Object.keys(D.lit).forEach(function (k) { lmats[k] = make(0); lhot[k] = make(0.1); });
    lines.src = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.92, depthWrite: false });
    lines.off = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false });
    lines.annex = new THREE.LineDashedMaterial({ transparent: true, opacity: 0.9, depthWrite: false,
      dashSize: 5, gapSize: 4 });
    lines.district = new THREE.LineDashedMaterial({ transparent: true, opacity: 0.95, depthWrite: false,
      dashSize: 7, gapSize: 6 });
    lines.e2e = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.92, depthWrite: false });
    lines.hot = new THREE.LineBasicMaterial({ transparent: true, opacity: 1, depthWrite: false });
    lines.hotDash = new THREE.LineDashedMaterial({ transparent: true, opacity: 1, depthWrite: false,
      dashSize: 5, gapSize: 4 });
    var plateMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.62, depthWrite: false });
    // never rendered: the picking proxies live outside the scene graph
    var pickMat = new THREE.MeshBasicMaterial();

    var parts = {};                 // n -> { tier: {meshes, frames}, light: {…} } — both lanes
    var picks = [];                 // raycast proxies, each tagged with its member
    var lane = 'tier';
    function rec(n) {
      if (!parts[n]) parts[n] = { tier: { meshes: [], frames: [] }, light: { meshes: [], frames: [] } };
      return parts[n];
    }

    // One solid, in one lane.  The picking proxies belong to the TIER pass only:
    // the two lanes stand on the same footprints, so the raycast never changes.
    function box(lk, n, x, z, sx, sz, h, wall, hotWall, lineMat, dashed, pick) {
      var geo = new THREE.BoxGeometry(sx, h, sz);
      var px = x + sx / 2 - cx, pz = z + sz / 2 - cz;
      var r = rec(n)[lk];
      var vis = lk === lane;
      if (wall) {
        var faces = function (q) { return [q[1], q[2], q[0], q[0], q[2], q[1]]; };
        var mesh = new THREE.Mesh(geo, faces(wall));
        mesh.userData.base = mesh.material;
        mesh.userData.hot = faces(hotWall);
        mesh.position.set(px, h / 2, pz);
        mesh.renderOrder = 1;
        mesh.visible = vis;
        scene.add(mesh);
        r.meshes.push(mesh);
      }
      var frame = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat);
      frame.userData.base = lineMat;
      frame.userData.hot = dashed ? lines.hotDash : lines.hot;
      frame.position.set(px, h / 2, pz);
      frame.computeLineDistances();
      frame.renderOrder = 2;
      frame.visible = vis;
      scene.add(frame);
      r.frames.push(frame);
      if (pick) {
        var proxy = new THREE.Mesh(geo, pickMat);
        proxy.position.set(px, h / 2, pz);
        proxy.userData.n = n;
        proxy.updateMatrixWorld(true);
        picks.push(proxy);
      }
      return [px, pz];
    }

    function mass(n, x, z, s, h, tier, lineMat, dashed) {
      var t = D.tiers[tier];
      return box('tier', n, x, z, s, s, h, t.f > 0 ? mats[tier] : null, hot[tier], lineMat, dashed, true);
    }
    // sheet 7A's brightness ladder, its own thresholds
    function band(line) {
      return line == null ? 'b1' : line >= 95 ? 'b1' : line >= 85 ? 'b2' : line >= 70 ? 'b3' : 'b4';
    }
    function wash(n, x, z, sx, sz, h, k, lineMat, dashed) {
      box('light', n, x, z, sx, sz, h, lmats[k], lhot[k], lineMat, dashed, false);
    }
    // The light lane, built ONCE at init and toggled by visibility: covered source
    // is lit from the annex (east) side, what no suite loads stays in shadow.
    function relight(b) {
      var sv = D.survey[b.n];
      if (b.tier === 'off' || sv.cat === 'z') {                 // no mass in either lane
        box('light', b.n, b.x, b.y, b.s, b.s, b.h, null, null, lines.off, false, false);
      } else if (sv.cat === 'n') {
        wash(b.n, b.x, b.y, b.s, b.s, b.h, 'sh', lines.src, false);
      } else if (sv.cat === 'e') {
        wash(b.n, b.x, b.y, b.s, b.s, b.h, 'e2e', lines.e2e, false);
      } else if (sv.cat === 'u') {
        wash(b.n, b.x, b.y, b.s, b.s, b.h, 'bare', lines.src, false);
      } else {
        var e = Math.max(0, Math.min(100, sv.ext || 0)) / 100;
        var litW = b.s * e, shW = b.s - litW;
        if (shW > 0.01) wash(b.n, b.x, b.y, shW, b.s, b.h, 'sh', lines.src, false);
        if (litW > 0.01) wash(b.n, b.x + shW, b.y, litW, b.s, b.h, band(sv.line), lines.src, false);
      }
      // every lamp that is lit at all — an annex glows brighter than any wall
      if (b.sa) wash(b.n, b.ax, b.ay, b.sa, b.sa, b.ha, sv.cat === 'n' ? 'bare' : 'lamp', lines.annex, true);
    }

    var tops = {};                  // n -> [x, y, z] of the src mass's cap centre
    rows.forEach(function (b) {
      var p = mass(b.n, b.x, b.y, b.s, b.h, b.tier, b.tier === 'off' ? lines.off : lines.src, false);
      tops[b.n] = [p[0], b.h, p[1]];
      if (b.sa) mass(b.n, b.ax, b.ay, b.sa, b.ha, 'annex', lines.annex, true);
      relight(b);
    });

    // ---- the quiet ground: one plate per district, plus a faint grid ----------
    // Lettering is drawn ON the ground, foreshortened with it — a site plan, not a
    // billboard.  It is turned onto the default diagonal so it reads level at the
    // opening pose; the other three snaps show it turned, exactly as a plan would.
    var letters = [];
    function letterTex(label, wpx, hpx, c) {
      var cv = document.createElement('canvas');
      cv.width = Math.max(2, Math.round(wpx)); cv.height = Math.max(2, Math.round(hpx));
      var g2 = cv.getContext('2d');
      g2.font = '600 ' + Math.round(hpx * 0.6) + 'px ' + c.mono;
      if ('letterSpacing' in g2) g2.letterSpacing = Math.round(hpx * 0.09) + 'px';
      g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.globalAlpha = 0.85;
      g2.fillStyle = c.soft;
      g2.fillText(label, wpx / 2, hpx / 2);
      var tex = new THREE.CanvasTexture(cv);
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
      return tex;
    }
    function letter(label, px, pz, W, H) {
      var h = Math.max(20, Math.min(42, Math.min(W, H) * 0.2));
      var w = h * (label.length * 0.78 + 0.6);
      var fit = Math.min(1, (W + H) * 0.62 / w);   // the label stays inside its plate
      h *= fit; w *= fit;
      var geo = new THREE.PlaneGeometry(w, h);
      geo.rotateX(-Math.PI / 2);
      var mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, 0.45, pz);
      mesh.rotation.y = D.az0 * Math.PI / 180;   // level at the opening diagonal
      mesh.renderOrder = 0;
      scene.add(mesh);
      letters.push({ label: label, mat: mat, w: w, h: h });
    }

    Object.keys(D.districts).forEach(function (d) {
      var members = rows.filter(function (b) { return b.dist === d; });
      if (!members.length) return;
      var pad = D.districts[d];
      var x1 = Infinity, x2 = -Infinity, z1 = Infinity, z2 = -Infinity;
      members.forEach(function (b) {
        x1 = Math.min(x1, b.x); z1 = Math.min(z1, b.sa ? Math.min(b.y, b.ay) : b.y);
        x2 = Math.max(x2, b.sa ? b.ax + b.sa : b.x + b.s);
        z2 = Math.max(z2, b.y + b.s, b.sa ? b.ay + b.sa : 0);
      });
      x1 -= pad; z1 -= pad; x2 += pad; z2 += pad;
      var geo = new THREE.PlaneGeometry(x2 - x1, z2 - z1);
      geo.rotateX(-Math.PI / 2);
      var px = (x1 + x2) / 2 - cx, pz = (z1 + z2) / 2 - cz;
      var plate = new THREE.Mesh(geo, plateMat);
      plate.position.set(px, 0.4, pz);
      scene.add(plate);
      var edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lines.district);
      edge.position.set(px, 0.5, pz);
      edge.computeLineDistances();
      scene.add(edge);
      // set toward the plate's near corner, where the ground is clear of massing
      letter(D.distLabel[d], px + (x2 - x1) * 0.35, pz + (z2 - z1) * 0.35, x2 - x1, z2 - z1);
    });
    var span = Math.max(maxX - minX, maxZ - minZ);
    var grid = new THREE.GridHelper(span, Math.round(span / 50));
    grid.material.transparent = true;
    grid.material.opacity = 0.3;
    grid.material.depthWrite = false;
    grid.position.set((minX + maxX) / 2 - cx, 0, (minZ + maxZ) / 2 - cz);
    scene.add(grid);

    // ---- number chips: sheet 7's own numbering, billboarded over each src mass --
    // A drafting callout, not a HUD: ink on paper, drawn on top, and dropped when
    // the camera pulls back far enough that 31 of them would silt up the plan.
    var chips = [];
    function chipTex(text, c) {
      var K = Math.min(window.devicePixelRatio || 1, 2) * 3;
      var fs = 30, pad = 11, h = 46;
      var probe = document.createElement('canvas').getContext('2d');
      probe.font = '600 ' + fs + 'px ' + c.mono;
      var w = Math.ceil(probe.measureText(text).width) + pad * 2;
      var cv = document.createElement('canvas');
      cv.width = Math.round(w * K); cv.height = Math.round(h * K);
      var g2 = cv.getContext('2d');
      g2.scale(K, K);
      g2.fillStyle = c.paper; g2.globalAlpha = 0.9;
      g2.fillRect(1, 1, w - 2, h - 2);
      g2.globalAlpha = 1;
      g2.strokeStyle = c.soft; g2.lineWidth = 1.6;
      g2.strokeRect(0.8, 0.8, w - 1.6, h - 1.6);
      g2.font = '600 ' + fs + 'px ' + c.mono;
      g2.fillStyle = c.ink; g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.fillText(text, w / 2, h / 2 + 1);
      var tex = new THREE.CanvasTexture(cv);
      return { tex: tex, ar: w / h };
    }
    rows.forEach(function (b) {
      var t = tops[b.n];
      var mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false });
      var sp = new THREE.Sprite(mat);
      sp.position.set(t[0], t[1] + D.chip.lift + D.chip.h / 2, t[2]);
      sp.renderOrder = 5;
      scene.add(sp);
      chips.push({ n: b.n, sp: sp, mat: mat });
    });

    // ---- the isometric camera: elevation fixed at atan(1/sqrt2) ---------------
    var EL = Math.atan(1 / Math.SQRT2);
    var STEP = Math.PI / 2;
    var AZ0 = D.az0 * Math.PI / 180;
    var az = AZ0;
    var R = 4000;
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 12000);
    function place() {
      camera.position.set(target.x + R * Math.sin(az) * Math.cos(EL), target.y + R * Math.sin(EL),
        target.z + R * Math.cos(az) * Math.cos(EL));
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
    }
    var corners = [];
    [minX - cx, maxX - cx].forEach(function (x) {
      [0, maxY].forEach(function (y) {
        [minZ - cz, maxZ - cz].forEach(function (z) { corners.push(new THREE.Vector3(x, y, z)); });
      });
    });
    // fit over ALL four diagonals, so a snap can never clip the city
    var baseW = 0, baseH = 0, keep = az;
    D.snaps.forEach(function (deg) {
      az = deg * Math.PI / 180;
      place();
      corners.forEach(function (v) {
        var p = v.clone().applyMatrix4(camera.matrixWorldInverse);
        baseW = Math.max(baseW, Math.abs(p.x));
        baseH = Math.max(baseH, Math.abs(p.y));
      });
    });
    az = keep;

    function resize() {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      // updateStyle must stay ON: without a CSS size the canvas displays at its
      // backing-store size, w × devicePixelRatio — a 2× flood on retina screens
      renderer.setSize(w, h);
      var aspect = w / h;
      var half = Math.max(baseH, baseW / aspect) * D.margin;
      camera.left = -half * aspect; camera.right = half * aspect;
      camera.top = half; camera.bottom = -half;
      camera.updateProjectionMatrix();
    }

    // ---- render on demand: this is a document, not a game loop ----------------
    var pending = false;
    function draw() {
      pending = false;
      var show = camera.zoom >= D.chip.min;
      chips.forEach(function (c) { c.sp.visible = show; });
      place();
      renderer.render(scene, camera);
    }
    function ask() { if (!pending) { pending = true; requestAnimationFrame(draw); } }

    function paint() {
      var c = pal();
      renderer.setClearColor(new THREE.Color(c.paper), 1);
      var paper = new THREE.Color(c.paper);
      // both lanes are recoloured on every theme turn, whichever one is showing
      var tint = function (m, hm, spec) {
        var hue = new THREE.Color(c[spec.hue]);
        m[0].color = paper.clone().lerp(hue, spec.f * 0.72);
        m[1].color = paper.clone().lerp(hue, spec.f * 1.15);
        m[2].color = paper.clone().lerp(hue, spec.f);
        hm[0].color = paper.clone().lerp(hue, Math.min(1, spec.f * 1.05));
        hm[1].color = paper.clone().lerp(hue, Math.min(1, spec.f * 1.5));
        hm[2].color = paper.clone().lerp(hue, Math.min(1, spec.f * 1.32));
      };
      Object.keys(D.tiers).forEach(function (t) {
        if (D.tiers[t].f) tint(mats[t], hot[t], D.tiers[t]);
      });
      Object.keys(D.lit).forEach(function (k) { tint(lmats[k], lhot[k], D.lit[k]); });
      lines.src.color = new THREE.Color(c.ink);
      lines.e2e.color = new THREE.Color(c.accent);
      lines.off.color = new THREE.Color(c.faint);
      lines.annex.color = new THREE.Color(c.soft);
      lines.district.color = new THREE.Color(c.faint);
      lines.hot.color = new THREE.Color(c.accent);
      lines.hotDash.color = new THREE.Color(c.accent);
      plateMat.color = new THREE.Color(c.paper2).lerp(new THREE.Color(c.faint), 0.3);
      grid.material.color = new THREE.Color(c.faint);
      // canvas-drawn ink has to be redrawn when the ink changes
      chips.forEach(function (ch) {
        var t = chipTex(String(ch.n), c);
        if (ch.mat.map) ch.mat.map.dispose();
        ch.mat.map = t.tex;
        ch.mat.needsUpdate = true;
        ch.sp.scale.set(D.chip.h * t.ar, D.chip.h, 1);
      });
      letters.forEach(function (L) {
        if (L.mat.map) L.mat.map.dispose();
        L.mat.map = letterTex(L.label, L.w * 8, L.h * 8, c);
        L.mat.needsUpdate = true;
      });
      ask();
    }
    paint();
    resize();
    ask();

    // ---- the feature: free orbit, isometric snap on release -------------------
    var tween = null;
    function step(now) {
      if (!tween) return;
      var k = Math.min(1, (now - tween.t0) / tween.d);
      var e = 1 - Math.pow(1 - k, 3);
      az = tween.a0 + (tween.a1 - tween.a0) * e;
      camera.zoom = tween.z0 + (tween.z1 - tween.z0) * e;
      camera.updateProjectionMatrix();
      draw();
      if (k < 1) { requestAnimationFrame(step); } else { az = tween.a1; tween = null; }
    }
    function glide(a1, z1) {
      if (reduce.matches) {
        az = a1; camera.zoom = z1; camera.updateProjectionMatrix(); tween = null; draw();
        return;
      }
      tween = { a0: az, a1: a1, z0: camera.zoom, z1: z1, t0: performance.now(), d: D.snapMs };
      requestAnimationFrame(step);
    }
    function snap() { glide(Math.round((az - AZ0) / STEP) * STEP + AZ0, camera.zoom); }

    // ---- picking: the canvas is flat and untransformed, so a raycast is honest --
    var ray = new THREE.Raycaster();
    var ndc = new THREE.Vector2();
    var byN = {};
    rows.forEach(function (b) { byN[b.n] = b; });
    var IDLE = '<h4>THE CITY — ISOMETRIC</h4><p class="hint">Hover or tap any mass to read its member — '
      + 'district, gate tier, authored source and the spec annex beside it. The number on each chip is '
      + 'the number sheet 7 gives that member.</p>';
    function fmt(v) { return String(v).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ','); }
    function plural(n) { return n === 1 ? ' file' : ' files'; }
    // the light lane's sentence — sheet 7A's own numbers, unrounded
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
      var tail = lane === 'light' ? '<p>' + survey(b) + '</p>' : '';
      return '<h4>' + b.n + ' · ' + b.name + '</h4><p>' + line + '</p><p>'
        + (D.notes[b.n] || '') + '</p>' + tail;
    }
    var litN = null;
    function light(n, on) {
      var r = parts[n];
      if (!r) return;
      r[lane].meshes.forEach(function (m) { m.material = on ? m.userData.hot : m.userData.base; });
      r[lane].frames.forEach(function (f) { f.material = on ? f.userData.hot : f.userData.base; });
    }
    function setLane(k) {
      if (k === lane) return;
      if (litN !== null) light(litN, false);
      lane = k;
      Object.keys(parts).forEach(function (n) {
        ['tier', 'light'].forEach(function (L) {
          var on = L === k;
          parts[n][L].meshes.forEach(function (m) { m.visible = on; });
          parts[n][L].frames.forEach(function (f) { f.visible = on; });
        });
      });
      if (litN !== null) light(litN, true);
      info.innerHTML = litN === null ? IDLE : describe(byN[litN]);
      var lg = stage.closest('.cs').querySelector('.cs-legend');
      if (lg) lg.innerHTML = D.legend[k === 'light' ? 'light' : 'tier'];
      ask();
    }
    function select(n) {
      if (n === litN) return false;
      if (litN !== null) light(litN, false);
      litN = n;
      if (litN !== null) light(litN, true);
      info.innerHTML = litN === null ? IDLE : describe(byN[litN]);
      return true;
    }
    function hit(e) {
      var r = stage.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      place();
      ray.setFromCamera(ndc, camera);
      var xs = ray.intersectObjects(picks, false);
      return xs.length ? xs[0].object.userData.n : null;
    }
    info.innerHTML = IDLE;

    var dragging = false, engaged = false, lastX = 0, moved = 0;
    stage.addEventListener('pointerdown', function (e) {
      tween = null; dragging = true; engaged = true; lastX = e.clientX; moved = 0;
      stage.classList.add('grabbing');
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', function (e) {
      if (dragging) {
        moved += Math.abs(e.clientX - lastX);
        az -= (e.clientX - lastX) * 0.0075;
        lastX = e.clientX;
        ask();
        return;
      }
      // hover is a reading aid, not a fight with the camera: not while it moves
      if (tween || e.pointerType === 'touch') return;
      var n = hit(e);
      stage.classList.toggle('over', n !== null);
      if (select(n)) ask();
    });
    function release(e) {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('grabbing');
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      if (moved < 4 && select(hit(e))) ask();   // a tap reads; a tap on ground clears
      snap();
    }
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('pointerleave', function () {
      engaged = false;
      stage.classList.remove('over');
      if (!dragging && select(null)) ask();
    });
    // a plain scroll over the plate still scrolls the page: the wheel only zooms
    // once the plate has been touched, or when it is a trackpad pinch (ctrlKey)
    stage.addEventListener('wheel', function (e) {
      if (!engaged && !e.ctrlKey) return;
      e.preventDefault();
      var z = camera.zoom * Math.exp(-e.deltaY * 0.0015);
      camera.zoom = Math.min(D.zoom[1], Math.max(D.zoom[0], z));
      camera.updateProjectionMatrix();
      ask();
    }, { passive: false });
    stage.addEventListener('dblclick', function () { engaged = true; glide(AZ0, 1); });
    document.getElementById('cs-reset').addEventListener('click', function () { glide(AZ0, 1); });
    document.getElementById('cs-lane').addEventListener('change', function (e) {
      setLane(e.target.checked ? 'light' : 'tier');
    });

    if (window.ResizeObserver) new ResizeObserver(function () { resize(); ask(); }).observe(stage);
    else window.addEventListener('resize', function () { resize(); ask(); });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paint);
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (hint) hint.textContent = 'DRAG TO ORBIT · RELEASE SNAPS · HOVER TO READ A MEMBER · SCROLL TO ZOOM · DOUBLE-CLICK RESETS';

    // verification hook: azimuth in degrees, live zoom, the initial pose
    window.__cityScene = {
      az: function () { return ((az * 180 / Math.PI) % 360 + 360) % 360; },
      zoom: function () { return camera.zoom; },
      tweening: function () { return tween !== null; },
      reset: function () { glide(AZ0, 1); },
      hovered: function () { return litN; },
      lane: function () { return lane; },
      walls: function (n) { return parts[n] ? parts[n][lane].meshes.length : -1; },
      panel: function () { return info.textContent; },
      chipsShown: function () { return chips.filter(function (c) { return c.sp.visible; }).length; },
      at: function (n) {                       // a member's screen point, for probes
        place();
        var b = byN[n];
        var v = new THREE.Vector3(b.x + b.s / 2 - cx, b.h / 2, b.y + b.s / 2 - cz).project(camera);
        var r = stage.getBoundingClientRect();
        return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
      },
    };
  }

  // lazy: the gallery does not pay for three until the plate is on screen
  var io = new IntersectionObserver(function (entries) {
    if (!entries.some(function (en) { return en.isIntersecting; })) return;
    io.disconnect();
    import(D.three).then(boot, function () {
      note('THREE.JS COULD NOT BE LOADED — SHEET 7 DRAWS THE SAME CITY FLAT');
    });
  }, { rootMargin: '300px' });
  io.observe(stage);
})();
`;

export function citySection() {
  // swatch fills follow the same tints the scene uses, in page tokens
  const HUE = { red: '--red', accent: '--accent', halo: '--accent', soft: '--ink-soft',
    ink: '--ink', faint: '--ink-faint', black: '#000' };
  const swatch = (k, t) => {
    const hue = HUE[t.hue];
    const paint = hue.startsWith('--') ? `var(${hue})` : hue;
    return `.cs-legend .sw-${k} { background: color-mix(in srgb, ${paint} ${Math.round(t.f * 100)}%, var(--paper)); }`;
  };
  const swatchCss = LEGEND.map(([k]) => swatch(k, TIERS[k]))
    .concat(LIGHT_LEGEND.map(([k]) => swatch(k, LIT[k]))).join('\n');

  return `<style>${CSS}
${swatchCss}</style>
<section class="sheet cs" id="city-scene" aria-label="The City, isometric — sheet 7 in the round, with a second material lane that relights it from sheet 7A's shadow survey">
  <div class="sheet-head"><span class="proj">THE ALTITUDE ATLAS — INTERACTIVE PLATE</span><span class="shno">SHEET 7 · 3D · REV ${REV}</span></div>
  <h2 class="sheet-title">THE CITY — ISOMETRIC</h2>
  <p class="sheet-sub">SHEET 7'S CENSUS CITY IN THE ROUND · ${CITY.length} MEMBERS · ${MASSED} MASSED · ${ANNEXES} SPEC ANNEXES · 4 DISTRICTS · ORBIT SNAPS TO THE FOUR TRUE DIAGONALS · REV C: A SECOND LANE RELIGHTS THE CITY FROM SHEET 7A'S SHADOW SURVEY · REV D: THAT SURVEY IS NOW A FILED PLATE, METERED AT THE CITY'S OWN REF</p>
  <div class="cs-bar">
    <div class="cs-legend">
      ${DATA.legend.tier}
    </div>
    <div class="cs-ctl">
      <span id="cs-hint">DRAG TO ORBIT · RELEASE SNAPS TO THE NEAREST DIAGONAL</span>
      <label><input type="checkbox" id="cs-lane"> TEST LIGHT</label>
      <button type="button" id="cs-reset">RESET</button>
    </div>
  </div>
  <div class="cs-stage">
    <div class="cs-canvas" id="cs-canvas" role="img" aria-label="A real three-dimensional isometric model of the census city: ${MASSED} massed workspace members, each a translucent box with its girding frame showing through, footprint proportional to the square root of its authored lines and height three units per authored file, with ${ANNEXES} dashed spec annexes beside them and four district plates on the ground. The camera orbits and lands on one of the four isometric diagonals. Each mass carries a numbered chip matching sheet 7's schedule, and each district plate carries its name lettered flat on the ground. A TEST LIGHT switch relights the same city from sheet 7A's shadow survey: each metered member's mass splits along its footprint, the share its own suite loads glowing from the annex side and the rest washed toward black, with the spec annexes burning as the lamps that throw the light."></div>
    <aside class="cs-info" id="cs-info"></aside>
  </div>
  <p class="cs-basis">BASIS — the same geometry sheet 7 draws: every footprint, height and position here is <code>generator/sheet7.mjs</code>'s computed <code>CITY</code> export, embedded verbatim as JSON, massed from <code>diagrams/data/census-city.json</code> — ${BASIS}. Nothing is re-derived, so a mass in the model cannot drift from the mass on the plate. Walls are semi-opaque over a girding frame per the pinned sprite note; gate severity is colour, never height; the <code>off</code> tier is drawn frame-only because there is nothing to mass. Camera is orthographic at the true isometric elevation, atan(1/√2) ≈ 35.264°; the azimuth is free under the pointer and eased onto the nearest diagonal on release — instantly under <code>prefers-reduced-motion</code>. Each src mass carries a billboarded number chip — sheet 7's own numbering, drawn at runtime into a canvas in the page's own mono stack and redrawn when the theme turns, dropped below zoom ${DATA.chip.min} so a pulled-back plan stays a plan. District names are lettered FLAT on their ground plates, turned onto the opening diagonal so they read level at rest and foreshorten with the ground as a site plan's lettering does. Hovering or tapping a mass lights that member and fills the reading panel from the same row the schedule prints.  three.js ${THREE_URL.match(/three\.js\/([\d.]+)\//)[1]} is imported only once the plate scrolls into view, and the scene renders on demand — nothing runs while you read.  REV C adds a SECOND MATERIAL LANE over the same geometry: <code>TEST LIGHT</code> relights the city from <code>generator/sheet7a.mjs</code>'s exported <code>SURVEY</code>, so the model and the flat shadow plate cannot drift either. Its polarity is sheet 7A's — covered source is LIT, source no suite loads is SHADOW, and the spec annex is the LAMP that throws the light; a metered member's mass splits along its footprint, the lit slab being side × the extent the meter recorded, taken from the annex (east) side, its tint stepping down through the line-coverage bands. Shadow lerps toward BLACK rather than the ink, because <code>--ink</code> is light in the cyanotype theme and a shadow that brightens in the dark is not a shadow.  REV D re-lights the lane from a PLATE: sheet 7A's light is no longer a transcribed one-off but <code>diagrams/data/census-shadow.json</code>, ${SURVEY_META.basis} — the same ref the geometry is massed at, with ${SURVEY_META.metered} members metered under their own suites' meters. Every mass in this model therefore has a survey row (a mass without one is a build error), so the blank-paper case for a member the old metering predated is gone along with the metering that needed it.</p>
</section>
<script type="application/json" id="cs-city">${json(DATA)}</script>
<script type="module">${INIT}</script>`;
}

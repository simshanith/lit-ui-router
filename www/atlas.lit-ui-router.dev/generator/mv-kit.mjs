// The <model-viewer> plates' shared runtime: the camera's iso corners, and the script
// pieces every generated plate module inlines (ES5, like the bodies they join).

/** The true isometric polar angle, 90° − atan(1/√2), as model-viewer's camera-orbit phi. */
export const ISO_POLAR = +(90 - (Math.atan(1 / Math.SQRT2) * 180) / Math.PI).toFixed(3);

/** A camera-orbit at azimuth `az` on the isometric polar, at `radius`. */
export const orbitAt = (az, radius = 'auto') => `${az}deg ${ISO_POLAR}deg ${radius}`;

/** A plate's numbered pin, `size` px across, ringed in its `--hue`. */
export const pinCss = (cls, size, font) => `
.${cls} { width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid var(--hue, var(--ink)); background: var(--paper);
  color: var(--ink); font-family: var(--data); font-size: ${font}px; font-weight: 600; padding: 0; cursor: pointer;
  display: grid; place-items: center; }
.${cls}.on { background: var(--hue, var(--accent)); color: #F1F0E7; }
.${cls}:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`;

/** A model plate's `.fillable` frame: stage, bar and `read` panel in `areas` order; filled, the stage takes what the rest leave. */
export const frameCss = (p, read, areas) => {
  const on = (s = '') => `.${p}-frame:fullscreen${s}, .${p}-frame.is-filled${s}`;
  return `
.${p}-frame { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-areas: ${areas.map((a) => `"${a}"`).join(' ')}; }
.${p}-stage { grid-area: stage; min-width: 0; }
.${p}-bar { grid-area: bar; }
.${p}-frame > .${read} { grid-area: read; }
/* positioned inside its grid area, the button keeps the stage's corner wherever the stage stands */
.${p}-frame > .fill { grid-area: stage; }
${on()} { box-sizing: border-box; overflow: auto; padding: 8px; grid-template-rows: minmax(min(62vh, 520px), 1fr) auto auto;
  grid-template-areas: "stage" "bar" "read"; }
${on(` .${p}-stage`)} { position: relative; min-height: 0; border: 1.5px solid var(--ink); }
${on(` .${p}-view`)} { position: absolute; inset: 0; height: 100%; }
${on(` .${p}-bar`)}, ${on(` .${read}`)} { border: 1.5px solid var(--ink); border-top: none; }
@media (min-width: 1100px) {
  ${on()} { grid-template-columns: minmax(0, 1fr) clamp(320px, 30vw, 460px); grid-template-rows: minmax(0, 1fr) auto;
    grid-template-areas: "stage stage" "bar read"; }
  ${on(` .${read}`)} { border-left: none; }
}`;
};

// The script pieces. Each is a run of function declarations, so a body can call them anywhere.
export const MV_JS = `  // setBaseColorFactor takes linear values, so a token's sRGB bytes are linearised first
  function lin(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  // a colour token as linear rgb: #rrggbb, or rgb() and rgba() with the alpha dropped; null for anything else
  function tokenRgb(value) {
    var v = String(value).trim(), m = /^rgba?\\(\\s*([\\d.]+)[\\s,]+([\\d.]+)[\\s,]+([\\d.]+)/.exec(v);
    if (m) return [m[1], m[2], m[3]].map(function (c) { return lin(Number(c) / 255); });
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) return null;
    return [1, 3, 5].map(function (i) { return lin(parseInt(v.slice(i, i + 2), 16) / 255); });
  }
  // rows of [material, linear rgb, alpha]; a material only an inactive variant or a line wears loads lazily
  function paint(mv, rows) {
    if (!mv.model) return Promise.resolve();
    return Promise.all(rows.map(function (row) {
      var m = mv.model.getMaterialByName(row[0]);
      if (!m || !row[1]) return undefined;
      return m.ensureLoaded().then(function () {
        m.pbrMetallicRoughness.setBaseColorFactor([row[1][0], row[1][1], row[1][2], row[2] === undefined ? 1 : row[2]]);
      });
    })).then(function () { return undefined; });
  }
  // calls fn on every theme turn, the attribute's or the colour scheme's; returns the disconnect
  function onTheme(fn, on) {
    var mo = new MutationObserver(function () { fn(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    on(window.matchMedia('(prefers-color-scheme: dark)'), 'change', function () { fn(); });
    return function () { mo.disconnect(); };
  }
  function nextFrames(n) {
    return new Promise(function (resolve) {
      (function tick(k) { if (k <= 0) resolve(); else requestAnimationFrame(function () { tick(k - 1); }); })(n);
    });
  }
  // the model stays behind its poster until the theme's colours are on it, so nobody sees the baked ones
  function revealPainted(mv, painted) {
    return painted().then(function () { mv.dismissPoster(); return nextFrames(2); });
  }
  // model-viewer takes every wheel over it: the page scrolls on until a pointer engages the stage, or on a pinch
  function wheelGate(stage, on) {
    var engaged = false;
    on(stage, 'pointerdown', function () { engaged = true; }, true);
    on(stage, 'pointerleave', function () { engaged = false; });
    on(stage, 'wheel', function (e) { if (!engaged && !e.ctrlKey) e.stopPropagation(); }, true);
  }
  // the next member along \`order\` from \`at\` in direction d, wrapping; from nothing, the first or the last
  function walk(order, at, d) {
    var i = order.indexOf(at);
    return order[i < 0 ? (d > 0 ? 0 : order.length - 1) : (i + d + order.length) % order.length];
  }
  // captured on the way down, so the viewer's own arrow-key orbit never sees ← →; ↑ ↓ stay the viewer's;
  // escape and enter answer whether they acted, so an unanswered key goes on to the page
  function pinKeys(stage, on, act) {
    on(stage, 'keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      var done = d ? act.step(d) !== false
        : e.key === 'Escape' ? act.escape()
          : (e.key === 'Enter' || e.key === ' ') && act.enter ? act.enter(e) : false;
      if (!done) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }
`;

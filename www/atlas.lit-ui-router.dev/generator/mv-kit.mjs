// The <model-viewer> plates' shared runtime: the camera's iso corners, and the script
// pieces every generated plate module inlines (ES5, like the bodies they join).

/** The true isometric polar angle, 90° − atan(1/√2), as model-viewer's camera-orbit phi. */
export const ISO_POLAR = +(90 - (Math.atan(1 / Math.SQRT2) * 180) / Math.PI).toFixed(3);

/**
 * The field of view, in degrees: home, and the wheel's zoom-in and zoom-out limits. The viewer
 * frames its auto and percent radii from this angle, so a narrow field stands the camera far back
 * at the same framing, and at 3° the verticals stand parallel: the plates' isometric, in the round.
 */
export const FOV = { home: 3, min: 1, max: 4.5 };
/** The three field-of-view attributes of a plate's <model-viewer>. */
export const fovAttrs = `field-of-view="${FOV.home}deg" min-field-of-view="${FOV.min}deg" max-field-of-view="${FOV.max}deg"`;

/** A camera-orbit at azimuth `az` on the isometric polar, at `radius`. */
export const orbitAt = (az, radius = 'auto') => `${az}deg ${ISO_POLAR}deg ${radius}`;

/** A plate's numbered pin, `size` px across, ringed in its `--hue`. */
export const pinCss = (cls, size, font) => `
.${cls} { width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid var(--hue, var(--ink)); background: var(--paper);
  color: var(--ink); font-family: var(--data); font-size: ${font}px; font-weight: 600; padding: 0; cursor: pointer;
  display: grid; place-items: center; }
.${cls}.on { background: var(--hue, var(--accent)); color: oklch(95.3% 0.012 101.5); }
.${cls}:focus-visible { outline: max(2px, 0.08em) solid var(--accent); outline-offset: 0.25em; }
.${cls}:active { transform: scale(0.97); }
@media (prefers-reduced-motion: no-preference) { .${cls} { transition: opacity 0.3s, transform 160ms var(--ease-out, ease-out); } }`;

/**
 * THE PARTS PANEL: the plate's members as chips inside the viewer, one corner of the stage, on the
 * key row's translucent paper. Each chip is an anchor on `?focus=n`, the no-script path; the scene's
 * script takes the click through the hotspot's own tap, and its pin() lights the chip. Under 720px
 * the panel folds to a PARTS toggle in the same corner. A `fit` panel is the grouped one: folding
 * groups under a header bar, its list sized by the stage's `container` query.
 */
export const partsCss = (cls, { side, top, cols, font, fit }) => `
.${cls} { position: absolute; inset-block-start: ${top}px; inset-inline-${side}: 8px; z-index: 3; max-width: calc(100% - 16px);
  max-height: calc(100% - ${top + 8}px); display: flex; flex-direction: column; align-items: flex-${side}; }
.${cls} .pt-toggle { display: none; font-family: var(--data); font-size: 9.5px; font-weight: 600; letter-spacing: 0.16em; line-height: 1;
  color: var(--ink); background: var(--paper); border: 1px solid var(--ink); padding: 6px 8px; cursor: pointer; opacity: 0.72; }
.${cls} .pt-toggle[aria-expanded="true"] { opacity: 1; background: var(--paper-2); }
.${cls} .pt-toggle:focus-visible { opacity: 1; outline: max(2px, 0.08em) solid var(--accent); outline-offset: 0.25em; }
.${cls} .pts { display: grid; grid-template-columns: repeat(${cols}, auto); gap: 2px 4px; min-height: 0; overflow: auto; overscroll-behavior: contain;
  padding: 5px; border: 1px solid var(--line); background: color-mix(in oklab, var(--paper) 70%, transparent);
  font-family: var(--data); font-size: ${font}px; letter-spacing: 0.1em; }
.${cls} .pt { display: inline-flex; align-items: center; gap: 6px; padding-block: 2px; padding-inline: 2px 7px; border: 1px solid transparent;
  color: var(--ink-soft); text-decoration: none; white-space: nowrap; }
.${cls} .pt .n { display: grid; place-items: center; width: 16px; height: 16px; border: 1.5px solid var(--hue, var(--ink-soft)); border-radius: 50%;
  font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: 0; color: var(--ink); }
@media (hover: hover) and (pointer: fine) { .${cls} .pt:hover { border-color: var(--ink); background: var(--paper-2); color: var(--ink); } }
.${cls} .pt:focus-visible { outline: max(2px, 0.08em) solid var(--accent); outline-offset: 0; }
.${cls} .pt:active { transform: scale(0.97); }
@media (prefers-reduced-motion: no-preference) { .${cls} .pt { transition: transform 160ms var(--ease-out, ease-out); } }
.${cls} .pt.on { border-color: var(--hue, var(--accent)); background: var(--hue, var(--accent)); color: oklch(95.3% 0.012 101.5); }
.${cls} .pt.on .n { border-color: currentColor; color: inherit; }
@media (max-width: 719px) {
  .${cls} { gap: 4px; }
  .${cls} .pt-toggle { display: block; }
  .${cls}:not(.open) .pts { display: none; }
  .${cls} .pts { grid-template-columns: auto; }
}${fit ? `${groupCss(cls)}${barCss(cls, top)}${fitCss(cls, fit)}` : ''}`;

// the header bar: a drag handle that snaps to a corner, a fold at every width, and a corner step
const barCss = (cls, top) => `
.${cls}[data-corner] { inset: auto; }
.${cls}[data-corner="ne"] { inset-block-start: ${top}px; inset-inline-end: 8px; align-items: flex-end; }
.${cls}[data-corner="se"] { inset-block-end: 8px; inset-inline-end: 8px; align-items: flex-end; }
.${cls}[data-corner="sw"] { inset-block-end: 8px; inset-inline-start: 8px; align-items: flex-start; }
.${cls}[data-corner="nw"] { inset-block-start: 8px; inset-inline-start: 8px; align-items: flex-start; }
.${cls} .pt-bar { display: flex; align-items: center; gap: 4px; align-self: stretch; padding-block: 3px; padding-inline: 8px 3px;
  border: 1px solid var(--line); border-block-end: none; background: color-mix(in oklab, var(--paper-2) 88%, transparent);
  font-family: var(--data); font-size: 9.5px; font-weight: 600; letter-spacing: 0.16em; color: var(--ink);
  cursor: grab; touch-action: none; user-select: none; }
.${cls}:not(.open) .pt-bar { border-block-end: 1px solid var(--line); }
.${cls}.drag .pt-bar { cursor: grabbing; }
.${cls} .pt-bar .t { flex: 1; white-space: nowrap; padding-inline-end: 6px; }
.${cls} .pt-bar button { display: grid; place-items: center; inline-size: 20px; block-size: 20px; padding: 0; cursor: pointer;
  font: inherit; letter-spacing: 0; color: var(--ink); background: transparent; border: 1px solid transparent; opacity: 1; }
.${cls} .pt-bar .pt-toggle { display: grid; }
.${cls} .pt-bar .pt-toggle::before { content: "−"; }
.${cls}:not(.open) .pt-bar .pt-toggle::before { content: "+"; }
.${cls} .pt-move i { position: relative; inline-size: 10px; block-size: 10px; border: 1.5px solid currentColor; box-sizing: border-box; }
.${cls} .pt-move i::after { content: ""; position: absolute; inline-size: 3px; block-size: 3px; background: currentColor; inset-block-start: 1px; inset-inline-end: 1px; }
.${cls}[data-corner^="s"] .pt-move i::after { inset-block: auto 1px; }
.${cls}[data-corner$="w"] .pt-move i::after { inset-inline: 1px auto; }
@media (hover: hover) and (pointer: fine) { .${cls} .pt-bar button:hover { border-color: var(--ink); background: var(--paper); } }
.${cls} .pt-bar button:focus-visible { outline: max(2px, 0.08em) solid var(--accent); outline-offset: 0; }
.${cls} .pt-bar button:active { transform: scale(0.94); }
.${cls}:not(.open) .pts { display: none; }
.${cls} .pts { resize: both; min-inline-size: 9rem; min-block-size: 5rem; max-inline-size: min(28rem, 100%); }
.${cls} .pts::-webkit-resizer { background: linear-gradient(135deg, transparent 50%, var(--ink-soft) 50% 60%, transparent 60% 72%, var(--ink-soft) 72% 82%, transparent 82%); }
@media (max-width: 719px) { .${cls} .pt-bar .pt-toggle { display: grid; } }
@media (prefers-reduced-motion: no-preference) { .${cls} .pt-bar button { transition: transform 160ms var(--ease-out, ease-out); } }`;

// sized by the stage, a size container: one capped scrolling column, two uncapped on a stage that is `wide`
const fitCss = (cls, { container, cap, wide }) => `
.${cls} .pts { max-block-size: ${cap}cqh; background: color-mix(in oklab, var(--paper) 88%, transparent); scrollbar-width: thin; scrollbar-gutter: stable; scrollbar-color: var(--line) transparent; }
.${cls} .pt.on { color: var(--paper); }
@container ${container} ${wide} {
  .${cls} .pts { max-block-size: none; }
  .${cls} .pg-l { grid-template-columns: repeat(2, auto); }
}`;

// each group is a <details name>: the platform keeps one open and folds it without script
const groupCss = (cls) => `
.${cls} .pts { grid-template-columns: auto; gap: 0; }
.${cls} .pg + .pg { border-block-start: 1px solid var(--line); }
.${cls} .pg > summary { display: flex; justify-content: space-between; gap: 12px; list-style: none; cursor: pointer;
  padding-block: 5px; padding-inline: 4px 3px; font-size: 9.5px; font-weight: 600; letter-spacing: 0.16em; color: var(--ink-soft); }
.${cls} .pg > summary::-webkit-details-marker { display: none; }
.${cls} .pg > summary::after { content: "+"; letter-spacing: 0; }
.${cls} .pg[open] > summary { color: var(--ink); }
.${cls} .pg[open] > summary::after { content: "−"; }
@media (hover: hover) and (pointer: fine) { .${cls} .pg > summary:hover { background: var(--paper-2); color: var(--ink); } }
.${cls} .pg > summary:focus-visible { outline: max(2px, 0.08em) solid var(--accent); outline-offset: -2px; }
.${cls} .pg-l { display: grid; gap: 2px; padding-block: 1px 6px; }`;

const chip = (it, pad) => `${pad}<a class="pt" href="${it.href ?? `?focus=${it.n}`}" data-focus="${it.n}"${it.hue ? ` style="--hue:${it.hue}"` : ''}${it.attrs ?? ''}><span class="n">${it.n}</span>${it.name}</a>`;

const groupMarkup = (cls, g, open) => `          <details class="pg" name="${cls}-group" data-group="${g.group}"${open ? ' open' : ''}>
            <summary>${g.label} · ${g.items.length}</summary>
            <div class="pg-l">
${g.items.map((it) => chip(it, '              ')).join('\n')}
            </div>
          </details>`;

/**
 * The panel's markup: `items` are `{ n, name, hue? }` in the plate's own order, or
 * `{ group, label, items }` groups, each folding, the first open. A `count` writes the header bar
 * counting that many members in place of the PARTS toggle, opened, in the `ne` corner.
 */
export const partsMarkup = (cls, label, items, count) => `      <nav class="${cls}${count ? ' open" data-corner="ne' : ''}" aria-label="${label}">
${count ? `        <div class="pt-bar"><span class="t">${label.toUpperCase()} · ${count}</span><button type="button" class="pt-toggle" aria-expanded="true" aria-controls="${cls}-list" aria-label="${label}"></button><button type="button" class="pt-move" aria-label="Move to the next corner"><i></i></button></div>`
    : `        <button type="button" class="pt-toggle" aria-expanded="false" aria-controls="${cls}-list">PARTS</button>`}
        <div class="pts" id="${cls}-list">
${items.map((it, i) => (it.group ? groupMarkup(cls, it, i === 0) : chip(it, '          '))).join('\n')}
        </div>
      </nav>`;

/**
 * A model plate's `.fillable` frame: stage, bar and `read` panel in `areas` order; filled, the stage
 * takes what the rest leave, and the `read` panel the content block size its `--read-reserve` names.
 */
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
${on(` .${p}-bar`)}, ${on(` .${read}`)} { border: 1.5px solid var(--ink); border-block-start: none; }
/* the reading holds the block size its scene reserves, so a longer one scrolls inside and the stage never reflows */
${on(` .${read}`)} { box-sizing: content-box; block-size: var(--read-reserve); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
@media (min-width: 1100px) {
  ${on()} { grid-template-columns: minmax(0, 1fr) clamp(320px, 1rem + 29vw, 460px); grid-template-rows: minmax(0, 1fr) auto;
    grid-template-areas: "stage stage" "bar read"; }
  ${on(` .${read}`)} { border-inline-start: none; }
}`;
};

/**
 * The parts panel's runtime. A `fit` panel brings the lit chip into its list's view and opens
 * the group holding it, and wires the header bar's fold, corner step and drag, snapping to
 * `corners` in that clockwise order; `fold` is the stage's [inline, block] size under which it
 * opens folded, and the corner it opens in there. Open on a stage at least `fold[0]` wide, it writes its own width to the stage's
 * `--parts-start` or `--parts-end`, so the viewer can stand clear of it. Bare, it is the flat panel.
 */
const partsJs = (fit, text) => `  // the parts panel: a chip click takes the hotspot's own tap (the href stays the no-script path); light(n) lights the pinned chip
  function partsPanel(root, cls, on, tap) {
    var nav = root.querySelector('.' + cls);
    if (!nav) return { light: function () {}, hide: function () {}, dispose: function () {} };
    var chips = Array.prototype.slice.call(nav.querySelectorAll('a.pt'));
    var toggle = nav.querySelector('.pt-toggle');
${fit ? `    var smooth = window.matchMedia('(prefers-reduced-motion: no-preference)');
    var list = nav.querySelector('.pts');
    // the list's own scroll only, never the page's: scrollIntoView would also move the document
    function reveal(a) {
      if (!list.getClientRects().length) return;
      var r = a.getBoundingClientRect(), b = list.getBoundingClientRect();
      var d = r.top < b.top ? r.top - b.top - 6 : r.bottom > b.bottom ? r.bottom - b.bottom + 6 : 0;
      if (d) list.scrollBy({ top: d, behavior: smooth.matches ? 'smooth' : 'auto' });
    }
` : ''}    on(nav, 'click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a.pt') : null;
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      tap(${text ? "a.getAttribute('data-focus')" : "Number(a.getAttribute('data-focus'))"});
    });
${fit ? `    var stage = nav.parentNode, bar = nav.querySelector('.pt-bar'), move = nav.querySelector('.pt-move'), drag = null, shown = true;
    var CORNERS = ${JSON.stringify(fit.corners)};
    // an open panel on a stage past the fold keeps its own strip: the stage's --parts-start or --parts-end, which the viewer's margin takes
    function reserve() {
      var w = shown && nav.classList.contains('open') && stage.clientWidth >= ${fit.fold[0]} ? Math.ceil(nav.getBoundingClientRect().width) + 16 : 0;
      var west = (nav.getAttribute('data-corner') || '').charAt(1) === 'w';
      stage.style.setProperty('--parts-start', (west ? w : 0) + 'px');
      stage.style.setProperty('--parts-end', (west ? 0 : w) + 'px');
    }
    var sized = new ResizeObserver(reserve);
    sized.observe(nav);
    sized.observe(stage);
` : ''}    on(toggle, 'click', function () {
      var open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
${fit ? '      reserve();\n' : ''}    });
${fit ? `    // a small stage opens on the bar alone in the fold's corner, so the model starts unobstructed
    if (stage.clientWidth < ${fit.fold[0]} || stage.clientHeight < ${fit.fold[1]}) {
      nav.setAttribute('data-corner', '${fit.fold[2]}');
      toggle.click();
    }
    // FLIP: the panel lands in its corner, then glides there from where it stood
    function place(c, from) {
      nav.style.transition = 'none';
      nav.style.transform = '';
      nav.setAttribute('data-corner', c);
      reserve();
      if (!from || !smooth.matches) return;
      var to = nav.getBoundingClientRect();
      nav.style.transform = 'translate(' + (from.left - to.left) + 'px, ' + (from.top - to.top) + 'px)';
      nav.getBoundingClientRect();
      nav.style.transition = 'transform 240ms var(--ease-out, ease-out)';
      nav.style.transform = '';
    }
    on(nav, 'transitionend', function (e) { if (e.target === nav) nav.style.transition = ''; });
    on(move, 'click', function () {
      place(CORNERS[(CORNERS.indexOf(nav.getAttribute('data-corner')) + 1) % CORNERS.length], nav.getBoundingClientRect());
    });
    on(bar, 'pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('button')) return;
      bar.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      nav.style.transition = 'none';
      nav.classList.add('drag');
    });
    on(bar, 'pointermove', function (e) {
      if (drag && e.pointerId === drag.id) nav.style.transform = 'translate(' + (e.clientX - drag.x) + 'px, ' + (e.clientY - drag.y) + 'px)';
    });
    // on release the panel snaps to the open corner nearest its centre, never a free placement
    function drop(e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      nav.classList.remove('drag');
      var r = nav.getBoundingClientRect(), s = stage.getBoundingClientRect(), x = (r.left + r.right) / 2 - s.left, y = (r.top + r.bottom) / 2 - s.top;
      var best = CORNERS.reduce(function (b, c) {
        var d = Math.hypot(x - (c.charAt(1) === 'e' ? s.width : 0), y - (c.charAt(0) === 's' ? s.height : 0));
        return d < b.d ? { c: c, d: d } : b;
      }, { c: nav.getAttribute('data-corner'), d: Infinity });
      place(best.c, r);
    }
    on(bar, 'pointerup', drop);
    on(bar, 'pointercancel', drop);
` : ''}    return {
      light: function (n) {
${fit ? '        var at = null;\n' : ''}        chips.forEach(function (a) {
          var hit = ${text ? "a.getAttribute('data-focus') === n" : "Number(a.getAttribute('data-focus')) === n"};
          a.classList.toggle('on', hit);
          if (hit) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
${fit ? '          if (hit) at = a;\n' : ''}        });
${fit ? `        // the group's name keeps one open, so opening this one folds the rest
        var g = at && at.closest('details');
        if (g && !g.open) g.open = true;
        if (at) reveal(at);
` : ''}      },
      hide: function () {
        nav.style.visibility = 'hidden';
${fit ? `        shown = false;
        reserve();
` : ''}      },
      dispose: function () {${fit ? ' sized.disconnect(); ' : ''}},
    };
  }
`;

// The script pieces, with the parts panel's runtime for `fit` as partsJs takes it, its chips keyed by text when `text`. Each is a run of
// function declarations, so a body can call them anywhere.
export const mvJs = (fit, text) => `  // a token's colour as the page resolves it for its scheme: a probe element wears var(--name) and its computed colour is read back
  function tokColor(name) {
    var el = document.getElementById('tok-probe');
    if (!el) { el = document.createElement('i'); el.id = 'tok-probe'; el.hidden = true; document.body.appendChild(el); }
    el.style.color = 'var(' + name + ')';
    return getComputedStyle(el).color;
  }
  // setBaseColorFactor takes linear values, so a colour's sRGB bytes are linearised first
  function lin(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function gam(v) { return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
  // a computed colour as linear rgb: #rrggbb, rgb()/rgba(), color(srgb …) or oklch() with the alpha dropped; null for anything else
  function tokenRgb(value) {
    var v = String(value).trim(), m = /^rgba?\\(\\s*([\\d.]+)[\\s,]+([\\d.]+)[\\s,]+([\\d.]+)/.exec(v);
    if (m) return [m[1], m[2], m[3]].map(function (c) { return lin(Number(c) / 255); });
    m = /^color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)/.exec(v);
    if (m) return [m[1], m[2], m[3]].map(function (c) { return lin(Number(c)); });
    m = /^oklch\\(\\s*([\\d.]+)(%?)\\s+([\\d.]+)\\s+([\\d.]+|none)/.exec(v);
    if (m) {
      var L = Number(m[1]) / (m[2] ? 100 : 1), C = Number(m[3]), H = m[4] === 'none' ? 0 : Number(m[4]) * Math.PI / 180;
      var a = C * Math.cos(H), b = C * Math.sin(H);
      var l_ = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m_ = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s_ = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
      return [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_]
        .map(function (c) { return Math.min(1, Math.max(0, c)); });
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) return null;
    return [1, 3, 5].map(function (i) { return lin(parseInt(v.slice(i, i + 2), 16) / 255); });
  }
  // the same colour as an rgb() string, for a consumer that reads only legacy colour syntax
  function tokenCss(value) {
    var c = tokenRgb(value);
    return c ? 'rgb(' + c.map(function (v) { return Math.round(gam(v) * 255); }).join(', ') + ')' : String(value).trim();
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
${partsJs(fit, text)}  // captured on the way down, so the viewer's own arrow-key orbit never sees ← →; ↑ ↓ stay the viewer's;
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

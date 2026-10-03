import { chipBreaks } from './chrome.mjs';

// The chrome every cytoscape lane shares — key bar, stage with its rail, basis strip — under the lane's class prefix.
// `wrap` is how the rail breaks its names: package names break at words, file and task ids anywhere.
export const laneCss = (p, wrap = 'break-word') => `
.${p} { --lane-measure: 750px; }
.${p} .nw { white-space: nowrap; }
.${p}-bar { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; justify-content: space-between;
  border: 1.5px solid var(--ink); border-bottom: none; background: var(--paper-2); padding: 12px 22px; }
.${p}-legend { display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: center; }
.${p}-bar .lg { display: inline-flex; align-items: center; gap: 8px; font-family: var(--data); font-size: 11.5px;
  letter-spacing: 0.06em; color: var(--ink-soft); }
.${p}-bar .lg svg { display: block; }
.${p}-bar .lg .sw-dark { display: none; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .${p}-bar .lg .sw-light { display: none; }
  :root:not([data-theme="light"]) .${p}-bar .lg .sw-dark { display: block; }
}
:root[data-theme="dark"] .${p}-bar .lg .sw-light { display: none; }
:root[data-theme="dark"] .${p}-bar .lg .sw-dark { display: block; }
.${p}-bar .lg i { display: block; width: 26px; height: 0; border-top-width: 2px; border-top-style: solid; }
.${p}-ctl .hints { display: inline-flex; flex-wrap: wrap; gap: 8px 12px; }
.${p}-ctl .touch { display: none; }
@media (pointer: coarse) { .${p}-ctl .mouse { display: none; } .${p}-ctl .touch { display: inline; } }
.${p}-ctl { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; font-family: var(--data); font-size: 11px;
  letter-spacing: 0.12em; color: var(--ink-soft); }
.${p}-ctl button { font: inherit; letter-spacing: inherit; color: var(--ink); background: var(--paper);
  border: 1px solid var(--ink); padding: 6px 12px; cursor: pointer; }
.${p}-ctl button:hover { background: var(--paper-2); }
.${p}-ctl label { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
.${p}-ctl input[type=checkbox] { appearance: none; width: 13px; height: 13px; margin: 0; border: 1px solid var(--ink);
  background: var(--paper); display: grid; place-content: center; cursor: pointer; }
.${p}-ctl input[type=checkbox]:checked::before { content: ""; width: 7px; height: 7px; background: var(--ink); }
.${p}-ctl input[type=checkbox]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.${p}-stage { display: grid; grid-template-columns: minmax(0, 1fr) clamp(300px, 26vw, 400px); border: 1.5px solid var(--ink);
  background: var(--paper); }
.${p}-stage:focus-visible, .${p}-cy:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.${p}-cy { height: clamp(560px, 70vh, 960px); min-width: 0; touch-action: pan-y; }
.${p}-info { border-left: 1.5px solid var(--ink); background: var(--paper-2); padding: 20px 22px 22px;
  font-family: var(--data); font-size: 12.5px; letter-spacing: 0.04em; line-height: 1.5; color: var(--ink);
  overflow-y: auto; max-height: clamp(560px, 70vh, 960px); }
.${p}-info h4 { font-family: var(--code); font-size: 16px; font-weight: 600; letter-spacing: 0.04em; line-height: 1.3;
  margin: 0 0 10px; word-break: ${wrap}; }
.${p}-info .f { display: block; font-size: 11px; letter-spacing: 0.14em; color: var(--ink-soft); margin: 16px 0 6px; }
.${p}-info h4 + .f { margin-top: 0; }
.${p}-info ul { list-style: none; padding: 0; margin: 0; }
.${p}-info li { padding: 2px 0; line-height: 1.45; color: var(--ink-soft); word-break: ${wrap}; }
.${p}-info .hint { font-family: var(--prose); font-size: 16px; font-style: normal; letter-spacing: 0; line-height: 1.5;
  color: var(--ink-soft); max-width: 66ch; margin: 0; }
.${p}-basis { font-family: var(--prose); font-size: 15px; letter-spacing: 0; line-height: 1.8; color: var(--ink-soft);
  border: 1.5px solid var(--ink); border-top: none; background: var(--paper-2); padding: 20px 22px 24px; margin: 0 0 22px; }
.${p}-basis > span { max-width: var(--lane-measure); display: block; }
.${p}-basis .k { display: block; font-family: var(--data); font-size: 11px; font-weight: 600; letter-spacing: 0.16em;
  line-height: 1; color: var(--accent); margin: 0 0 10px; }
.${p}-basis code { font-family: var(--code); font-size: 0.9em; color: var(--ink); white-space: nowrap; }
@media (max-width: 860px) {
  .${p}-stage { grid-template-columns: 1fr; }
  .${p}-info { border-left: none; border-top: 1.5px solid var(--ink); max-height: 50vh;
    mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent); }
}`;

// The hint pair a lane's bar shows: the mouse's under a fine pointer, the finger's under a coarse one.
export const laneHints = (mouse) => `<span class="mouse">${mouse}</span><span class="nw touch">PINCH TO ZOOM · ZOOMED, A FINGER PANS · DOUBLE-TAP FITS</span>`;

// The provenance strip under a lane's stage; a path-shaped chip breaks after its slash, never mid-name.
export const basisStrip = (p, html) => `<p class="${p}-basis"><span><b class="k">BASIS</b>${chipBreaks(html)}</span></p>`;

import { chipBreaks } from './chrome.mjs';

// The chrome every cytoscape lane shares — key bar, stage with its rail, basis strip — under the lane's class prefix.
// `wrap` is how the rail breaks its names: package names break at words, file and task ids anywhere.
export const laneCss = (p, wrap = 'break-word') => `
.${p} { --lane-measure: 750px; }
.${p} .nw { white-space: nowrap; }
.${p}-bar { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; justify-content: space-between;
  border: 1.5px solid var(--ink); border-block-end: none; background: var(--paper-2); padding: 12px 22px; }
.${p}-legend { display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: center; }
.${p}-bar .lg { display: inline-flex; align-items: center; gap: 8px; font-family: var(--data); font-size: 11.5px;
  letter-spacing: 0.06em; color: var(--ink-soft); }
.${p}-bar .lg svg { display: block; flex: none; }
.${p}-bar .lg .sw-dark { display: none; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .${p}-bar .lg .sw-light { display: none; }
  :root:not([data-theme="light"]) .${p}-bar .lg .sw-dark { display: block; }
}
:root[data-theme="dark"] .${p}-bar .lg .sw-light { display: none; }
:root[data-theme="dark"] .${p}-bar .lg .sw-dark { display: block; }
.${p}-bar .lg i { display: block; flex: none; width: 26px; height: 0; border-block-start-width: 2px; border-block-start-style: solid; }
.${p}-ctl .hints { display: inline-flex; flex-wrap: wrap; gap: 8px 12px; }
.${p}-ctl .mouse { display: inline-flex; flex-wrap: wrap; gap: 8px 12px; }
.${p}-ctl .touch { display: none; }
@media (pointer: coarse) { .${p}-ctl .mouse { display: none; } .${p}-ctl .touch { display: inline; } }
.${p}-ctl { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; font-family: var(--data); font-size: 11px;
  letter-spacing: 0.12em; color: var(--ink-soft); }
.${p}-ctl button { font: inherit; letter-spacing: inherit; color: var(--ink); background: var(--paper);
  border: 1px solid var(--ink); padding: 6px 12px; cursor: pointer; }
@media (hover: hover) and (pointer: fine) { .${p}-ctl button:hover { background: var(--paper-2); } }
.${p}-ctl button:not(:disabled):active { transform: scale(0.97); }
@media (prefers-reduced-motion: no-preference) { .${p}-ctl button { transition: transform 160ms var(--ease-out, ease-out); } }
.${p}-ctl label { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
.${p}-ctl input[type=checkbox] { appearance: none; flex: none; width: 13px; height: 13px; margin: 0; border: 1px solid var(--ink);
  background: var(--paper); display: grid; place-content: center; cursor: pointer; }
.${p}-ctl input[type=checkbox]:checked::before { content: ""; width: 7px; height: 7px; background: var(--ink); }
.${p}-ctl input[type=checkbox]:focus-visible { outline: max(2px, 0.08em) solid var(--accent); outline-offset: 0.25em; }
.${p}-stage { display: grid; grid-template-columns: minmax(0, 1fr) clamp(300px, 1rem + 25vw, 400px); border: 1.5px solid var(--ink);
  background: var(--paper); }
.${p}-stage:focus-visible, .${p}-cy:focus-visible { outline: max(2px, 0.08em) solid var(--accent); outline-offset: -2px; }
.${p}-cy { height: clamp(560px, 70vh, 960px); min-width: 0; touch-action: pan-y; }
.${p}-stage:fullscreen .${p}-cy, .${p}-stage.is-filled .${p}-cy { height: 100vh; }
.${p}-stage:fullscreen .${p}-info, .${p}-stage.is-filled .${p}-info { max-height: 100vh; }
.${p}-info { border-inline-start: 1.5px solid var(--ink); background: var(--paper-2); padding-block: 20px 22px; padding-inline: 22px;
  font-family: var(--data); font-size: 12.5px; letter-spacing: 0.04em; line-height: 1.5; color: var(--ink);
  overflow-y: auto; max-height: clamp(560px, 70vh, 960px); }
.${p}-info h3 { font-family: var(--code); font-size: 16px; font-weight: 600; letter-spacing: 0.04em; line-height: 1.3;
  margin-block: 0 10px; margin-inline: 0; word-break: ${wrap}; }
.${p}-info .f { display: block; font-size: 11px; letter-spacing: 0.14em; color: var(--ink-soft); margin-block: 16px 6px; margin-inline: 0; }
.${p}-info h3 + .f { margin-block-start: 0; }
.${p}-info ul { list-style: none; padding: 0; margin: 0; }
.${p}-info li { padding: 2px 0; line-height: 1.45; color: var(--ink-soft); word-break: ${wrap}; }
.${p}-info .hint { font-family: var(--prose); font-size: 16px; font-style: normal; letter-spacing: 0; line-height: 1.5;
  color: var(--ink-soft); max-width: 66ch; margin: 0; }
.${p}-basis { font-family: var(--prose); font-size: 15px; letter-spacing: 0; line-height: 1.8; color: var(--ink-soft);
  border: 1.5px solid var(--ink); border-block-start: none; background: var(--paper-2); padding-block: 20px 24px; padding-inline: 22px;
  margin-block: 0 22px; margin-inline: 0; }
.${p}-basis > span { max-width: var(--lane-measure); display: block; }
.${p}-basis .k { display: block; font-family: var(--data); font-size: 11px; font-weight: 600; letter-spacing: 0.16em;
  line-height: 1; color: var(--accent); margin-block: 0 10px; margin-inline: 0; }
.${p}-basis code { font-family: var(--code); font-size: 0.9em; color: var(--ink); white-space: nowrap; }
@media (max-width: 860px) {
  .${p}-stage { grid-template-columns: 1fr; }
  .${p}-info { border-inline-start: none; border-block-start: 1.5px solid var(--ink); max-height: 50vh;
    mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent); }
}`;

// The hint pair a lane's bar shows: the mouse's and the keys' under a fine pointer, the finger's under a coarse one.
export const laneHints = (mouse) => `<span class="mouse">${mouse} <span class="nw">← → STEP THE PIN</span> <span class="nw">ESC CLEARS</span></span><span class="nw touch">PINCH TO ZOOM · ZOOMED, A FINGER PANS · DOUBLE-TAP FITS</span>`;

// The provenance strip under a lane's stage; a path-shaped chip breaks after its slash, never mid-name.
export const basisStrip = (p, html) => `<p class="${p}-basis"><span><b class="k">BASIS</b>${chipBreaks(html)}</span></p>`;

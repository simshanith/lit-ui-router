// The chrome every cytoscape lane shares — key bar, stage with its rail, basis strip — under the lane's class prefix.
// `wrap` is how the rail breaks its names: package names break at words, file and task ids anywhere.
export const laneCss = (p, wrap = 'break-word') => `
.${p} { max-width: 1300px; margin: 0 auto 40px; }
.${p}-bar { display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; justify-content: space-between;
  border: 1.5px solid var(--ink); border-bottom: none; background: var(--paper-2); padding: 10px 16px; }
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
.${p}-ctl { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; font-family: var(--data); font-size: 11px;
  letter-spacing: 0.12em; color: var(--ink-soft); }
.${p}-ctl button { font: inherit; letter-spacing: inherit; color: var(--ink); background: var(--paper);
  border: 1px solid var(--ink); padding: 6px 12px; cursor: pointer; }
.${p}-ctl button:hover { background: var(--paper-2); }
.${p}-ctl label { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
.${p}-stage { display: grid; grid-template-columns: minmax(0, 1fr) clamp(300px, 26vw, 400px); border: 1.5px solid var(--ink);
  background: var(--paper); }
.${p}-stage:focus-visible, .${p}-cy:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.${p}-cy { height: clamp(560px, 70vh, 960px); min-width: 0; }
.${p}-info { border-left: 1.5px solid var(--ink); background: var(--paper-2); padding: 18px 20px 20px;
  font-family: var(--data); font-size: 12.5px; letter-spacing: 0.04em; line-height: 1.5; color: var(--ink);
  overflow-y: auto; max-height: clamp(560px, 70vh, 960px); }
.${p}-info h4 { font-family: var(--code); font-size: 16px; font-weight: 600; letter-spacing: 0.04em; line-height: 1.3;
  margin: 0 0 10px; word-break: ${wrap}; }
.${p}-info .f { display: block; font-size: 10px; letter-spacing: 0.16em; color: var(--ink-soft); margin: 14px 0 4px; }
.${p}-info h4 + .f { margin-top: 0; }
.${p}-info ul { list-style: none; padding: 0; margin: 0; }
.${p}-info li { padding: 2px 0; line-height: 1.45; color: var(--ink-soft); word-break: ${wrap}; }
.${p}-info .hint { font-family: var(--prose); font-size: 16px; font-style: normal; letter-spacing: 0; line-height: 1.5;
  color: var(--ink-soft); max-width: 66ch; margin: 0; }
.${p}-basis { font-family: var(--data); font-size: 11px; letter-spacing: 0.06em; line-height: 1.6; color: var(--ink-soft);
  border: 1.5px solid var(--ink); border-top: none; background: var(--paper-2); padding: 10px 16px 11px; }
@media (max-width: 860px) {
  .${p}-stage { grid-template-columns: 1fr; }
  .${p}-info { border-left: none; border-top: 1.5px solid var(--ink); max-height: 50vh; }
}`;

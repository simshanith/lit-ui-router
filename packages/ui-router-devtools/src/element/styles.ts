import { css, type CSSResult } from 'lit';

export const styles: CSSResult = css`
  :host {
    color-scheme: light dark;
    --uird-surface: light-dark(oklch(99% 0 none), oklch(19% 0 none));
    --uird-surface-raised: light-dark(oklch(96% 0 none), oklch(24% 0 none));
    --uird-ink: light-dark(oklch(18% 0 none), oklch(95% 0 none));
    --uird-muted: light-dark(oklch(47% 0 none), oklch(74% 0 none));
    --uird-rule: light-dark(oklch(88% 0 none), oklch(33% 0 none));
    --uird-rule-strong: light-dark(oklch(58% 0 none), oklch(60% 0 none));
    --uird-red: light-dark(oklch(53% 0.2 28), oklch(72% 0.17 28));
    --uird-on-red: var(--uird-surface);
    --uird-unit: 4px;
    --uird-font:
      'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', 'Nimbus Sans',
      sans-serif;
    --uird-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --uird-size: 12px;
    --uird-size-small: 11px;
    --uird-line: 16px;
    --uird-row: 24px;
    --uird-margin: 12px;
    --uird-indent: 24px;
    --uird-gap: 12px;
    --uird-dock-height: 336px;
    --uird-sheet-width: 360px;
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);

    font: 400 var(--uird-size) / var(--uird-line) var(--uird-font);
    color: var(--uird-ink);
  }

  @media (pointer: coarse) {
    :host {
      --uird-row: 32px;
    }
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    text-align: start;
    cursor: pointer;
  }

  :focus-visible {
    outline: 2px solid var(--uird-ink);
    outline-offset: -2px;
  }

  h2,
  h3,
  p,
  dl,
  dd,
  ol,
  ul {
    margin: 0;
    padding: 0;
  }

  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .num {
    font-variant-numeric: tabular-nums;
    text-align: end;
    white-space: nowrap;
  }

  .muted {
    color: var(--uird-muted);
  }

  .tag {
    font-size: var(--uird-size-small);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--uird-muted);
    white-space: nowrap;
  }

  /* Glyphs */

  .glyph {
    inline-size: 12px;
    block-size: 12px;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: butt;
    stroke-linejoin: miter;
    overflow: visible;
  }

  .glyph .sign {
    stroke-width: 2;
  }

  .glyph .solid {
    fill: currentColor;
    stroke: none;
  }

  .glyph .fault {
    fill: var(--uird-red);
    stroke: none;
  }

  .glyph .knock {
    stroke: var(--uird-on-red);
  }

  .glyph.role-inactive,
  .glyph.role-future {
    color: var(--uird-rule-strong);
  }

  .glyph.slow {
    inline-size: 8px;
    block-size: 8px;
  }

  .status-running .arc {
    transform-origin: 6px 6px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .status-running .arc {
      animation: spin 800ms linear infinite;
    }

    .glyph,
    .glyph *,
    .rail,
    .row,
    .map-node {
      transition:
        color 200ms var(--ease-out),
        stroke 200ms var(--ease-out),
        fill 200ms var(--ease-out),
        opacity 200ms var(--ease-out);
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Pill */

  .pill {
    position: fixed;
    inset: auto;
    inset-block-end: var(--uird-margin);
    inset-inline-end: var(--uird-margin);
    margin: 0;
    display: flex;
    align-items: center;
    gap: var(--uird-gap);
    block-size: var(--uird-row);
    inline-size: max-content;
    max-inline-size: 240px;
    padding: 0 12px;
    border: 1px solid var(--uird-rule-strong);
    border-radius: 2px;
    background: var(--uird-surface);
    color: var(--uird-ink);
    overflow: hidden;
  }

  .pill:not(:popover-open) {
    display: none;
  }

  .pill-name {
    white-space: nowrap;
  }

  @media (hover: hover) and (pointer: fine) {
    .pill:hover {
      border-color: var(--uird-ink);
    }
  }

  /* Panel */

  .panel {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 0;
    border: 1px solid var(--uird-rule-strong);
    border-radius: 2px;
    background: var(--uird-surface);
    color: var(--uird-ink);
    box-shadow: 0 8px 32px -8px oklch(0% 0 none / 0.28);
    overflow: hidden;
  }

  .panel:popover-open {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }

  @media (width < 480px) {
    .panel {
      inset-inline: 0;
      inset-block-end: 0;
      inline-size: 100%;
      block-size: 60svh;
      border-inline: 0;
      border-block-end: 0;
    }
  }

  @media (480px <= width <= 880px) {
    .panel {
      inset-block: var(--uird-margin);
      inset-inline-end: var(--uird-margin);
      inline-size: var(--uird-sheet-width);
      block-size: auto;
    }
  }

  @media (width > 880px) {
    .panel {
      inset-inline: var(--uird-margin);
      inset-block-end: var(--uird-margin);
      inline-size: auto;
      block-size: var(--uird-dock-height);
    }
  }

  .titlestrip {
    display: flex;
    align-items: center;
    gap: 16px;
    block-size: calc(var(--uird-row) + 2px);
    padding-inline: var(--uird-margin) 0;
    border-block-end: 2px solid var(--uird-ink);
  }

  .brand,
  .switch button,
  .tabs button,
  .session button,
  .section {
    font-size: var(--uird-size-small);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .brand {
    block-size: var(--uird-row);
    font-weight: 700;
  }

  .brand[aria-pressed='true'],
  .session button:focus-visible {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
  }

  .session {
    display: flex;
    gap: 12px;
  }

  .session button {
    block-size: var(--uird-row);
    min-inline-size: 48px;
    color: var(--uird-muted);
    text-align: center;
  }

  .inspector-pane .scroll,
  .router-pane .scroll {
    container-type: inline-size;
  }

  @container (width >= 380px) {
    .router-card .facts {
      grid-template-columns: 108px minmax(0, 1fr) 84px minmax(0, 1fr);
    }

    .router-card .facts dt:nth-of-type(even) {
      padding-inline-start: 0;
    }
  }

  .card-actions {
    display: none;
    margin-block-start: 12px;
    padding-inline-start: 24px;
  }

  .imported {
    color: var(--uird-ink);
    font-weight: 700;
  }

  .titlestrip .imported::before {
    content: '';
    display: inline-block;
    inline-size: 6px;
    block-size: 6px;
    margin-inline-end: 8px;
    border: 1px solid currentColor;
    vertical-align: 1px;
  }

  .switch,
  .tabs {
    display: none;
    gap: 12px;
  }

  .switch button,
  .tabs button {
    block-size: var(--uird-row);
    color: var(--uird-muted);
  }

  .tabs .num {
    margin-inline-end: 8px;
  }

  .tabs button[aria-selected='true'] {
    color: var(--uird-ink);
  }

  .switch button[aria-pressed='true'],
  .tabs button[aria-selected='true'] .label {
    color: var(--uird-ink);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
  }

  .spacer {
    flex: 1;
  }

  .counts {
    display: flex;
    gap: 12px;
  }

  .count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .icon {
    display: grid;
    place-items: center;
    inline-size: calc(var(--uird-row) + 4px);
    block-size: var(--uird-row);
  }

  .body {
    display: grid;
    min-block-size: 0;
    padding-block-start: 12px;
  }

  .pane {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-block-size: 0;
    min-inline-size: 0;
  }

  .scroll {
    overflow: auto;
    min-block-size: 0;
    padding-block-end: 12px;
  }

  .section {
    display: flex;
    align-items: center;
    block-size: var(--uird-row);
    margin-block-end: 8px;
    padding-inline: var(--uird-margin);
    font-weight: 700;
  }

  .section .num {
    min-inline-size: 24px;
    color: var(--uird-muted);
    font-weight: 400;
    text-align: start;
  }

  .section .aside {
    margin-inline-start: var(--uird-gap);
    font-variant-numeric: tabular-nums;
  }

  .section.sub {
    margin-block-start: 12px;
    margin-block-end: 0;
    padding-inline: 0;
  }

  .section.sub:first-child {
    margin-block-start: 0;
  }

  .map-scroll {
    display: none;
  }

  .inspector-pane,
  .router-pane {
    display: none;
  }

  .router-pane .inspector {
    padding-inline: var(--uird-margin);
  }

  .empty {
    padding-inline: var(--uird-margin);
    color: var(--uird-muted);
  }

  .inspector .empty {
    padding-inline: 24px 0;
  }

  /* Narrow: one pane at a time */
  @media (width < 480px) {
    .tabs {
      display: flex;
    }

    .brand,
    .counts,
    .titlestrip .session,
    .pane > .section,
    .panel[data-tab='tree'] .log-pane,
    .panel[data-tab='log'] .tree-pane,
    .panel[data-inspect='router'] .tree-pane,
    .panel[data-inspect='router'] .log-pane {
      display: none;
    }

    .panel[data-inspect='router'] .router-pane {
      display: grid;
    }

    .card-actions {
      display: flex;
    }

    .pane {
      grid-template-rows: minmax(0, 1fr);
    }

    .body {
      grid-template-rows: minmax(0, 1fr);
    }
  }

  /* Side sheet: outline above log */
  @media (480px <= width <= 880px) {
    .body {
      grid-template-rows: auto minmax(0, 1fr);
    }

    .tree-pane {
      max-block-size: 40svh;
      border-block-end: 1px solid var(--uird-rule);
    }

    .log-pane {
      padding-block-start: 12px;
    }

    .panel[data-inspect='router'] .body {
      grid-template-rows: minmax(0, 1fr);
    }

    .panel[data-inspect='router'] .tree-pane,
    .panel[data-inspect='router'] .log-pane {
      display: none;
    }

    .panel[data-inspect='router'] .router-pane {
      display: grid;
    }
  }

  /* Dock: three columns, rules centred in 24px gutters */
  @media (width > 880px) {
    .switch {
      display: flex;
    }

    .body {
      grid-template-columns: 240px minmax(264px, 1fr) minmax(312px, 1fr);
    }

    .inspector-pane {
      display: grid;
    }

    .log-pane,
    .inspector-pane {
      border-inline-start: 1px solid var(--uird-rule);
    }

    .panel[data-view='map'] .body {
      grid-template-columns:
        minmax(240px, 1fr) minmax(264px, 0.8fr)
        minmax(312px, 1fr);
    }

    .panel[data-view='map'] .outline-scroll {
      display: none;
    }

    .panel[data-view='map'] .map-scroll {
      display: block;
    }

    .log .detail {
      display: none;
    }

    .inspector {
      padding-inline: var(--uird-margin);
    }
  }

  /* Outline */

  .outline {
    position: relative;
  }

  .rails {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    pointer-events: none;
  }

  /* Rails and edges are drawn left to right; mirroring the layer puts them on the inline-start side. */
  .rails:dir(rtl),
  .edges:dir(rtl) {
    scale: -1 1;
  }

  :dir(rtl) .selected,
  :dir(rtl) .tx.selected {
    box-shadow: inset -2px 0 0 var(--uird-ink);
  }

  .rail {
    fill: none;
    stroke: var(--uird-rule-strong);
    stroke-width: 1;
  }

  /* Hairlines sit on the pixel grid at 1x; 2px rails already do. */
  .rail.role-inactive,
  .rail.role-future,
  .rail.role-retained {
    translate: 0.5px 0.5px;
  }

  .rail.role-current,
  .rail.role-ancestor,
  .rail.role-entering {
    stroke: var(--uird-ink);
    stroke-width: 2;
  }

  .rail.role-exiting {
    stroke: var(--uird-ink);
    stroke-width: 2;
    stroke-dasharray: 4 4;
  }

  .rail.role-retained {
    stroke: var(--uird-ink);
  }

  .rail.role-errored {
    stroke: var(--uird-red);
    stroke-width: 2;
  }

  .knockout {
    fill: none;
    stroke: var(--uird-surface);
    stroke-width: 4;
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--uird-gap);
    block-size: var(--uird-row);
    padding-inline: calc(
        var(--uird-margin) + (var(--depth) - 1) * var(--uird-indent)
      )
      var(--uird-margin);
    cursor: default;
    white-space: nowrap;
  }

  .row.current .name {
    font-weight: 700;
  }

  .row.role-exiting .name,
  .row.role-future .name {
    color: var(--uird-muted);
  }

  .row.future .name {
    font-style: italic;
  }

  .row.role-errored .name {
    color: var(--uird-red);
  }

  .row .tag {
    margin-inline-start: auto;
  }

  .selected {
    background: var(--uird-surface-raised);
    box-shadow: inset 2px 0 0 var(--uird-ink);
  }

  @media (hover: hover) and (pointer: fine) {
    .row:hover,
    .tx .line:hover,
    .map-node:hover {
      background: var(--uird-surface-raised);
    }
  }

  /* Map */

  .map {
    position: relative;
    margin-inline: var(--uird-margin);
  }

  .edges {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .map-root {
    position: absolute;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--uird-rule-strong);
  }

  .map-node {
    position: absolute;
    display: flex;
    align-items: center;
    gap: var(--uird-gap);
    block-size: 24px;
    white-space: nowrap;
  }

  .map-node.selected {
    box-shadow: none;
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  .map-node.current .name {
    font-weight: 700;
  }

  .map-node.future .name {
    font-style: italic;
  }

  .map-node.role-future .name {
    color: var(--uird-muted);
  }

  /* Transition log */

  .log {
    list-style: none;
  }

  .tx .line {
    display: grid;
    grid-template-columns: 24px 12px minmax(0, 1fr) auto;
    column-gap: var(--uird-gap);
    align-items: center;
    inline-size: 100%;
    min-block-size: var(--uird-row);
    padding-inline: var(--uird-margin);
  }

  .tx.selected {
    background: var(--uird-surface-raised);
    box-shadow: inset 2px 0 0 var(--uird-ink);
  }

  .tx.selected > .line .seq {
    color: var(--uird-ink);
    font-weight: 700;
  }

  .seq {
    font-variant-numeric: tabular-nums;
    color: var(--uird-muted);
  }

  .tx .line.chain {
    grid-template-columns: 24px 24px 12px minmax(0, 1fr) auto;
    cursor: default;
  }

  .elbow {
    justify-self: end;
    inline-size: 18px;
    block-size: 12px;
    margin-block-start: -12px;
    border-inline-start: 1px solid var(--uird-ink);
    border-block-end: 1px solid var(--uird-ink);
  }

  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .path .op {
    color: var(--uird-muted);
    margin-inline: 8px 4px;
  }

  .path > .op:first-child {
    margin-inline-start: 0;
  }

  .path .exited {
    color: var(--uird-muted);
  }

  .tx.muted .path,
  .tx.ignored .path {
    color: var(--uird-muted);
  }

  .tx.muted .path .retained,
  .tx.muted .path .entered {
    color: var(--uird-muted);
  }

  .tx.muted > .line .glyph {
    color: var(--uird-muted);
  }

  .reason {
    padding-inline: 72px var(--uird-margin);
    padding-block-end: 4px;
    margin-block-start: -4px;
    color: var(--uird-muted);
  }

  .reason.fault,
  .insp-reason.fault {
    color: var(--uird-red);
  }

  .insp-reason {
    padding-inline-start: 24px;
    color: var(--uird-muted);
  }

  .tx .value {
    gap: 12px;
  }

  .num-start {
    font-variant-numeric: tabular-nums;
  }

  .detail {
    padding-block: 12px;
    padding-inline: 48px var(--uird-margin);
  }

  /* Phase ruler: ordinal, one tick per phase, real offsets beneath */

  .ruler {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
    row-gap: 8px;
    margin-block-start: 8px;
    padding-inline-start: 24px;
    list-style: none;
  }

  .ruler li {
    position: relative;
    display: grid;
    padding-block-start: 8px;
    border-block-start: 1px solid var(--uird-rule-strong);
  }

  .ruler li::before {
    content: '';
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    inline-size: 1px;
    block-size: 4px;
    background: var(--uird-ink);
  }

  .ruler .num {
    text-align: start;
  }

  .ruler .fault .tag,
  .ruler .fault .num {
    color: var(--uird-red);
  }

  /* Resolve bars: proportional to the transition */

  .wf {
    display: grid;
    grid-template-columns: 12px 84px minmax(0, 1fr) 84px;
    column-gap: var(--uird-gap);
    align-items: center;
    margin-block-start: 8px;
  }

  .wf > .glyph {
    grid-column: 1;
    margin-block-start: 8px;
  }

  .wf-state {
    grid-column: 2 / -1;
    margin-block-start: 8px;
  }

  .wf-key {
    grid-column: 2;
    color: var(--uird-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track {
    position: relative;
    block-size: 16px;
  }

  .bar {
    position: absolute;
    inset-block-start: 4px;
    block-size: 8px;
    background: var(--uird-ink);
  }

  .bar.failed {
    background: var(--uird-red);
  }

  .params dd,
  .literal {
    font-family: var(--uird-font-mono);
    font-size: var(--uird-size-small);
  }

  .wf > .tag,
  .value {
    justify-self: end;
  }

  .value {
    display: inline-flex;
    gap: 8px;
    align-items: baseline;
  }

  .axis {
    grid-column: 3;
    display: flex;
    justify-content: space-between;
    margin-block-start: 4px;
    padding-block-start: 4px;
    border-block-start: 1px solid var(--uird-rule-strong);
    font-size: var(--uird-size-small);
    color: var(--uird-muted);
  }

  /* Params and inspector */

  .params {
    display: grid;
    grid-template-columns: 108px minmax(0, 1fr);
    column-gap: var(--uird-gap);
    row-gap: 4px;
    margin-block-start: 8px;
  }

  .params .op {
    display: inline-block;
    inline-size: 12px;
    margin-inline-end: var(--uird-gap);
    color: var(--uird-muted);
  }

  .params dd {
    overflow-wrap: anywhere;
  }

  .insp-title {
    display: flex;
    align-items: center;
    gap: var(--uird-gap);
    min-block-size: var(--uird-row);
  }

  .insp-title .name {
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .go {
    margin-inline-start: auto;
    padding: 0 8px;
    block-size: 20px;
    border: 1px solid var(--uird-rule-strong);
    border-radius: 2px;
    font-size: var(--uird-size-small);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .facts {
    display: grid;
    grid-template-columns: 108px minmax(0, 1fr);
    column-gap: var(--uird-gap);
    row-gap: 4px;
    margin-block-start: 8px;
  }

  .facts dt {
    padding-inline-start: 24px;
    color: var(--uird-muted);
  }

  .plain {
    list-style: none;
    margin-block-start: 8px;
    padding-inline-start: 24px;
  }

  @media (forced-colors: active) {
    .glyph,
    .glyph.role-inactive,
    .glyph.role-future {
      color: CanvasText;
    }

    .glyph .fault {
      fill: CanvasText;
    }

    .glyph .knock {
      stroke: Canvas;
    }

    .rail {
      stroke: CanvasText;
    }

    .knockout {
      stroke: Canvas;
    }

    .bar {
      background: CanvasText;
    }

    .selected,
    .tx.selected {
      background: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }

    .selected *,
    .tx.selected > .line *,
    .tx.selected > .line .seq {
      color: HighlightText;
    }

    .ruler li::before {
      background: CanvasText;
    }
  }
`;

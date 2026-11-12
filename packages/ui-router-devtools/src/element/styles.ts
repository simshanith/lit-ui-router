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
    --uird-active: light-dark(oklch(50% 0.15 255), oklch(76% 0.11 250));
    --uird-exit: light-dark(oklch(62% 0.12 80), oklch(83% 0.13 85));
    --uird-active-wash: color-mix(
      in oklch,
      var(--uird-active) 12%,
      var(--uird-surface)
    );
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

  /* Two hues with fixed jobs: active for the path and what a transition enters or retains, exit for what it leaves. */
  :is(.row, .map-node, .head, .insp-title)
    > .glyph:is(
      .role-current,
      .role-ancestor,
      .role-entering,
      .role-retained,
      .pivot
    ) {
    color: var(--uird-active);
  }

  :is(.row, .map-node, .head, .insp-title) > .glyph.role-exiting {
    color: var(--uird-exit);
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
    .box,
    .map-node {
      transition:
        color 200ms var(--ease-out),
        stroke 200ms var(--ease-out),
        fill 200ms var(--ease-out),
        border-color 200ms var(--ease-out),
        background-color 200ms var(--ease-out),
        opacity 200ms var(--ease-out);
    }

    .nedge {
      animation: fade-in 200ms var(--ease-out);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
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

  .strip-switch,
  .tabs {
    display: none;
    gap: 12px;
  }

  .switch {
    display: flex;
    gap: 12px;
  }

  .strip-switch,
  .pane-switch {
    gap: 24px;
  }

  .pane-switch {
    display: flex;
    grid-column: 2;
    justify-content: end;
    block-size: var(--uird-row);
    padding-inline: var(--uird-margin);
  }

  .switch button:disabled {
    cursor: default;
    opacity: 0.5;
    text-decoration: line-through;
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

  .tree-pane {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .tree-pane > .scroll {
    grid-column: 1 / -1;
  }

  .map-scroll {
    padding-inline: var(--uird-margin);
  }

  .icon.max {
    display: none;
    margin-inline-end: -16px;
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

    .tree-pane {
      grid-template-rows: auto minmax(0, 1fr);
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
    .strip-switch {
      display: flex;
    }

    .pane-switch {
      display: none;
    }

    .icon.max {
      display: grid;
    }

    .panel[data-max] {
      inset-block-start: var(--uird-margin);
      block-size: auto;
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

    .log .detail {
      display: none;
    }

    .inspector {
      padding-inline: var(--uird-margin);
    }

    /* On the Map the diagram owns the panel: the log is a strip and the inspector a popover. */
    .panel[data-view='map'] .body {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) auto;
    }

    .panel[data-view='map'] .tree-pane {
      grid-template-rows: minmax(0, 1fr);
    }

    .panel[data-view='map'] .tree-pane > .section,
    .panel[data-view='map']:not([data-max]) .log-pane {
      display: none;
    }

    .panel[data-view='map']:not([data-max]) .scrubber {
      display: flex;
    }

    .panel[data-view='map']:not([data-max]) .inspector-pane {
      position: absolute;
      z-index: 2;
      display: none;
      inline-size: 296px;
      min-block-size: 136px;
      max-block-size: calc(var(--uird-dock-height) - 76px);
      padding-block-start: 4px;
      border: 1px solid var(--uird-rule-strong);
      border-radius: 2px;
      background: var(--uird-surface);
      box-shadow: 0 8px 32px -8px oklch(0% 0 none / 0.28);
    }

    .panel[data-view='map']:not([data-max]):is(
        [data-inspect='state'],
        [data-inspect='tx'],
        [data-inspect='router']
      )
      .inspector-pane {
      display: grid;
    }

    /* Chrome skips layout of a size container inside an element placed by a position-try fallback. */
    .panel[data-view='map']:not([data-max]) .inspector-pane .scroll {
      container-type: normal;
    }

    /* The popover sits beside the selection: anchored where CSS can, else from measured rects. */
    .panel[data-view='map'][data-pop='anchored']:not([data-max])
      .inspector-pane {
      position-anchor: --uird-selection;
      position-area: inline-end span-block-end;
      position-try-fallbacks:
        --uird-above-end, --uird-below-start, --uird-above-start, --uird-corner;
      inset-block: 0 32px;
      max-block-size: calc(100% - 32px);
      margin-inline: 8px;
    }

    .panel[data-view='map'][data-pop='measured']:not([data-max])
      .inspector-pane {
      inset-block-start: var(--uird-pop-y, 38px);
      left: var(--uird-pop-x, 12px);
    }

    /* Maximised: the diagram above the full log and inspector. */
    .panel[data-view='map'][data-max] .body {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      grid-template-rows: minmax(0, 1.1fr) minmax(0, 1fr);
    }

    .panel[data-view='map'][data-max] .tree-pane {
      grid-column: 1 / -1;
      border-block-end: 1px solid var(--uird-rule);
    }

    .panel[data-view='map'][data-max] .log-pane {
      border-inline-start: 0;
    }

    .panel[data-view='map'][data-max] :is(.log-pane, .inspector-pane) {
      padding-block-start: 12px;
    }
  }

  .anchor {
    anchor-name: --uird-selection;
  }

  /* Beside the selection, growing down from its top or up from its bottom, clear of the title strip and the scrubber. */
  @position-try --uird-above-end {
    position-area: inline-end span-block-start;
    inset-block: 32px 0;
  }

  @position-try --uird-below-start {
    position-area: inline-start span-block-end;
  }

  @position-try --uird-above-start {
    position-area: inline-start span-block-start;
    inset-block: 32px 0;
  }

  @position-try --uird-corner {
    position-area: none;
    inset: auto 12px 40px auto;
    margin: 0;
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
  .rail.role-retained,
  .rail-initial:is(.role-inactive, .role-future, .role-retained) {
    translate: 0.5px 0.5px;
  }

  .rail.role-current,
  .rail.role-ancestor,
  .rail.role-entering {
    stroke: var(--uird-active);
    stroke-width: 2;
  }

  .rail.role-exiting {
    stroke: var(--uird-exit);
    stroke-width: 2;
    stroke-dasharray: 4 4;
  }

  .rail.role-retained {
    stroke: var(--uird-active);
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

  .marks {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--uird-muted);
  }

  .mark {
    display: inline-flex;
  }

  .row .marks,
  .row .tag {
    margin-inline-start: auto;
  }

  .row .marks + .tag {
    margin-inline-start: 0;
  }

  .rail-initial {
    fill: var(--uird-rule-strong);
  }

  .rail-initial:is(
    .role-current,
    .role-ancestor,
    .role-entering,
    .role-retained
  ) {
    fill: var(--uird-active);
  }

  .rail-initial.role-exiting {
    fill: var(--uird-exit);
  }

  .rail-initial.role-errored {
    fill: var(--uird-red);
  }

  .selected {
    background: var(--uird-surface-raised);
    box-shadow: inset 2px 0 0 var(--uird-ink);
  }

  @media (hover: hover) and (pointer: fine) {
    .row:hover,
    .tx .line:hover,
    .tick:hover,
    .map-node:hover {
      background: var(--uird-surface-raised);
    }
  }

  /* Map */

  .map {
    position: relative;
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

  /* Nested Map: a box per state, child states inside their parent */

  .nested {
    --nest-head: 20px;
    --nest-pad: 12px;
    --nest-gap: 16px;

    position: relative;
    display: flex;
    inline-size: max-content;
    block-size: max-content;
  }

  .nested.small {
    --nest-head: 16px;
    --nest-pad: 8px;
    --nest-gap: 12px;

    font-size: var(--uird-size-small);
  }

  .nstack,
  .kids {
    display: flex;
    flex-direction: column;
    gap: var(--nest-gap);
    justify-content: space-around;
  }

  .nstack,
  .nrow,
  .box {
    flex-basis: auto;
    flex-shrink: 0;
  }

  .nrow {
    display: flex;
    gap: var(--nest-gap);
  }

  .box {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 1px;
    border: 1px solid var(--uird-rule-strong);
    border-radius: 3px;
    background: var(--uird-surface);
    cursor: default;
  }

  .box.leaf,
  .box.collapsed {
    align-self: start;
  }

  .box.collapsed {
    box-shadow:
      3px 3px 0 -1px var(--uird-surface),
      3px 3px 0 0 var(--uird-rule-strong);
  }

  .box.led {
    margin-inline-start: 20px;
  }

  .head:focus-visible {
    border-radius: 2px;
  }

  .box.selected {
    background: var(--uird-surface);
    box-shadow: none;
    outline: 1px solid var(--uird-ink);
    outline-offset: 2px;
  }

  .box.role-retained {
    border-color: var(--uird-active);
  }

  .box:is(.role-ancestor, .role-entering, .role-current) {
    padding: 0;
    border: 2px solid var(--uird-active);
  }

  .box.role-current {
    background: var(--uird-active-wash);
  }

  .box.role-exiting {
    padding: 0;
    border: 2px dashed var(--uird-exit);
  }

  .box.role-future {
    border-style: dashed;
  }

  .box.role-errored {
    padding: 0;
    border: 2px solid var(--uird-red);
  }

  .head {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    block-size: var(--nest-head);
    padding-inline: 8px;
    white-space: nowrap;
  }

  .box.current > .head .name {
    font-weight: 700;
  }

  .box.future > .head .name {
    font-style: italic;
  }

  .box:is(.role-exiting, .role-future) > .head .name,
  .head .count {
    color: var(--uird-muted);
  }

  .box.role-errored > .head .name {
    color: var(--uird-red);
  }

  .head :is(.marks, .tag) {
    margin-inline-start: auto;
  }

  .kids {
    flex: 1;
    padding: var(--nest-pad);
  }

  /* A compound and its only child, also a compound, share one header row. */
  .box.merging > .head {
    position: relative;
    z-index: 1;
    inline-size: max-content;
  }

  .box.merging > .head::after {
    content: '›';
    color: var(--uird-muted);
  }

  .box.merging > .kids {
    flex-direction: row;
    margin-block-start: calc(-1 * var(--nest-head));
    padding: 0;
  }

  .nested .box.merged {
    flex: 1;
    padding: 0;
    border: 0;
    background: none;
  }

  .box.merged > .head {
    padding-inline-start: var(--indent);
  }

  .initial {
    position: absolute;
    inset-block-start: calc(var(--nest-head) / 2 - 5px);
    inset-inline-start: -22px;
    fill: var(--uird-ink);
    stroke: var(--uird-ink);
  }

  .initial .tip {
    stroke: none;
  }

  .initial:dir(rtl) {
    scale: -1 1;
  }

  .nedges {
    position: absolute;
    z-index: 1;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
    pointer-events: none;
  }

  .nedge .line,
  .nedge .halo,
  .nedge .cap {
    fill: none;
    stroke: var(--uird-ink);
  }

  .nedge .halo {
    stroke: var(--uird-surface);
    stroke-width: 6;
  }

  .nedge:is(.w2, .edge-redirect) :is(.line, .cap) {
    stroke-width: 2;
  }

  .nedge.w3 .line {
    stroke-width: 3;
  }

  .nedge .head {
    display: inline;
    fill: var(--uird-ink);
  }

  .nedge.edge-redirect .line {
    stroke-dasharray: 5 4;
  }

  .nedge.edge-redirect .head {
    fill: none;
    stroke: var(--uird-ink);
    stroke-width: 2;
  }

  .nedge.edge-fault :is(.line, .cap) {
    stroke: var(--uird-red);
  }

  .nedge.edge-fault .head {
    fill: var(--uird-red);
  }

  /* No route was found, so the line is straight and dotted. */
  .nedge.fallback .line {
    stroke-dasharray: 1 3;
  }

  /* Scrubber: the Map's transition log, one outcome glyph each */

  .scrubber {
    display: none;
    align-items: center;
    gap: var(--uird-gap);
    min-inline-size: 0;
    block-size: 28px;
    padding-inline: var(--uird-margin);
    border-block-start: 1px solid var(--uird-rule);
  }

  .scrubber .section {
    flex: none;
    margin: 0;
    padding: 0;
  }

  .ticks {
    display: flex;
    flex: 0 1 auto;
    min-inline-size: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tick {
    display: grid;
    flex: none;
    place-items: center;
    inline-size: 20px;
    block-size: 27px;
    color: var(--uird-muted);
    cursor: pointer;
  }

  .tick.origin,
  .tick.on {
    background: var(--uird-surface-raised);
  }

  .tick.on {
    box-shadow: inset 0 2px 0 var(--uird-ink);
    color: var(--uird-ink);
  }

  .now {
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    gap: var(--uird-gap);
    min-inline-size: 0;
    margin-inline-start: auto;
    white-space: nowrap;
  }

  .link {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
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

  .facts .marked {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .facts .marked .glyph {
    color: var(--uird-muted);
  }

  .plain {
    list-style: none;
    margin-block-start: 8px;
    padding-inline-start: 24px;
  }

  @media (forced-colors: active) {
    :host {
      --uird-active: CanvasText;
      --uird-exit: CanvasText;
      --uird-active-wash: Canvas;
    }

    .nedge :is(.line, .cap),
    .nedge.edge-redirect .head {
      stroke: CanvasText;
    }

    .nedge .halo {
      stroke: Canvas;
    }

    .nedge .head,
    .initial {
      fill: CanvasText;
    }

    .nedge.edge-redirect .head {
      fill: none;
    }

    .box.selected,
    .tick.on {
      outline: 2px solid Highlight;
    }

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

    .rail-initial {
      fill: CanvasText;
    }

    .knockout {
      stroke: Canvas;
    }

    .bar {
      background: CanvasText;
    }

    .selected:not(.box),
    .tx.selected {
      background: Highlight;
      color: HighlightText;
      forced-color-adjust: none;
    }

    .selected:not(.box) *,
    .tx.selected > .line *,
    .tx.selected > .line .seq {
      color: HighlightText;
    }

    .ruler li::before {
      background: CanvasText;
    }
  }
`;

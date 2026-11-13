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
    --uird-depth-1: light-dark(oklch(46% 0.19 275), oklch(70% 0.15 275));
    --uird-depth-2: light-dark(oklch(57% 0.1 185), oklch(86% 0.12 185));
    --uird-depth-3: light-dark(oklch(64% 0.125 85), oklch(82% 0.13 85));
    --uird-depth-4: light-dark(oklch(46% 0.17 345), oklch(68% 0.13 345));
    --uird-select: var(--uird-ink);
    --uird-unit: 4px;
    --uird-font:
      'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', 'Nimbus Sans',
      sans-serif;
    --uird-font-mono:
      ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono',
      monospace;
    --uird-size: 12px;
    --uird-size-small: 11px;
    --uird-line: 16px;
    --uird-row: 24px;
    --uird-band: 28px;
    --uird-margin: 12px;
    --uird-indent: 24px;
    --uird-gap: 12px;
    --uird-dock-height: 336px;
    --uird-sheet-width: 360px;
    --uird-ease-out: cubic-bezier(0.23, 1, 0.32, 1);

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
    overflow: clip;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* What the router says is set in the monospace face: names, notation, ids, times and values. The panel's own labels stay sans. */
  .name,
  .path,
  .seq,
  .num,
  .num-start,
  .link,
  .reason,
  .aside,
  .pill-name,
  .plain,
  .wf-key,
  .wf-state,
  .traffic,
  dd,
  .params dt {
    font-family: var(--uird-font-mono);
    font-variant-ligatures: none;
    font-variant-numeric: tabular-nums;
  }

  .num {
    text-align: end;
    white-space: nowrap;
  }

  .muted {
    color: var(--uird-muted);
  }

  /* A duration's unit follows its number at a third of a space, and recedes. */
  .unit {
    margin-inline-start: 0.3ch;
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

  /* Identity: a state's colour follows its depth in the declared tree, on every surface that shows it. */
  .d1 {
    --uird-id: var(--uird-depth-1);
  }

  .d2 {
    --uird-id: var(--uird-depth-2);
  }

  .d3 {
    --uird-id: var(--uird-depth-3);
  }

  .d4 {
    --uird-id: var(--uird-depth-4);
  }

  :is(.d1, .d2, .d3, .d4) {
    --uird-line: var(--uird-id);
  }

  /* While a transition is in focus colour says what it does, so identity recedes toward the neutral rule. */
  .panel[data-mode='tx']
    :is(.row, .map-node, .box, .rail, .rail-initial):is(.d1, .d2, .d3, .d4) {
    --uird-line: color-mix(
      in oklch,
      var(--uird-id) 30%,
      var(--uird-rule-strong)
    );
  }

  .glyph.role-inactive,
  .glyph.role-future {
    color: var(--uird-rule-strong);
  }

  :is(.row, .map-node, .head, .insp-title) > .glyph {
    color: var(--uird-line, currentColor);
  }

  /* Two status hues, read only while a transition is in focus: active for what it enters or retains, exit for what it leaves. */
  .panel[data-mode='tx']
    :is(.row, .map-node, .head)
    > .glyph:is(.role-entering, .role-retained, .pivot) {
    color: var(--uird-active);
  }

  .panel[data-mode='tx'] :is(.row, .map-node, .head) > .glyph.role-exiting {
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
    .box::before,
    .map-node {
      transition:
        color 200ms var(--uird-ease-out),
        stroke 200ms var(--uird-ease-out),
        fill 200ms var(--uird-ease-out),
        border-color 200ms var(--uird-ease-out),
        background-color 200ms var(--uird-ease-out),
        opacity 200ms var(--uird-ease-out);
    }

    button {
      transition: scale 160ms var(--uird-ease-out);
    }

    /* An edge draws in from its start once the boxes have settled, and withdraws toward its end. */
    .nedge .reveal {
      animation: draw 240ms var(--uird-ease-out) var(--uird-edge-delay, 0ms)
        backwards;
    }

    .nedge.leaving .reveal {
      animation: withdraw 160ms var(--uird-ease-out) forwards;
    }

    /* A count appears once its line has drawn. */
    .chip {
      animation: fade-in 160ms var(--uird-ease-out)
        calc(var(--uird-edge-delay, 0ms) + 200ms) backwards;
    }

    /* A transition that is still running marches along its line. */
    .nedge.running .line {
      stroke-dasharray: 6 4;
      animation: march 500ms linear infinite;
    }
  }

  /* Without motion nothing moves or draws: an edge and a new box only fade. */
  @media (prefers-reduced-motion: reduce) {
    .nedge {
      animation: fade-in 200ms var(--uird-ease-out);
    }

    .nedge.leaving {
      animation: fade-out 160ms var(--uird-ease-out) forwards;
    }
  }

  .box,
  .map-node {
    animation: fade-in 200ms var(--uird-ease-out);
  }

  button:active {
    scale: 0.97;
  }

  @keyframes draw {
    from {
      stroke-dashoffset: 1;
    }
  }

  @keyframes march {
    to {
      stroke-dashoffset: -10;
    }
  }

  @keyframes withdraw {
    to {
      stroke-dashoffset: -1;
    }
  }

  @keyframes fade-out {
    to {
      opacity: 0;
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
    overflow: clip;
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
    overflow: clip;
  }

  .panel:popover-open {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
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

  .titlestrip > .session {
    align-items: center;
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
    align-items: center;
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
    min-inline-size: 0;
  }

  .counts {
    display: flex;
    gap: 12px;
  }

  .count {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  /* An outcome that has not happened recedes, so a red mark always means a fault. */
  .count.zero,
  .count.zero .glyph {
    color: var(--uird-muted);
  }

  .count.zero .fault {
    fill: currentColor;
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
    padding-inline: var(--uird-margin);
    font-weight: 700;
  }

  /* Column headings share one band, so their hairlines meet across the panel. */
  .pane > .section,
  .pane-switch {
    block-size: var(--uird-band);
    margin-block-end: 4px;
    border-block-end: 1px solid var(--uird-rule);
  }

  .section .num {
    min-inline-size: 24px;
    color: var(--uird-muted);
    font-family: var(--uird-font);
    font-weight: 400;
    text-align: start;
  }

  .section .aside {
    margin-inline-start: auto;
    color: var(--uird-muted);
    font-size: var(--uird-size);
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
  }

  .section.sub {
    margin-block-start: 8px;
    padding-block-start: 4px;
    padding-inline: 0;
    border-block-start: 1px solid var(--uird-rule);
    block-size: calc(var(--uird-band) + 4px);
  }

  .section.sub:first-child {
    margin-block-start: 0;
    padding-block-start: 0;
    border-block-start: 0;
    block-size: var(--uird-row);
  }

  .tree-pane {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .tree-pane > .scroll {
    grid-column: 1 / -1;
  }

  .map-scroll {
    padding-block-start: 12px;
    padding-inline: var(--uird-margin);
  }

  /* The diagram keeps its natural size; the viewport places it with one translation and clips what it does not show. */
  .map-scroll:has(> .nested) {
    position: relative;
    display: grid;
    place-content: start;
    overflow: clip;
    user-select: none;
  }

  /* A layout larger than its room is panned by a drag, which a touch does in place of scrolling the page. */
  .map-scroll[data-pan] {
    cursor: grab;
    touch-action: pinch-zoom;
  }

  .map-scroll[data-panning] {
    cursor: grabbing;
    user-select: none;
  }

  /* The whole layout in small, drawn while it overflows, in the corner the inspector popover never takes. */
  .minimap {
    position: absolute;
    inset-block-end: 8px;
    inset-inline-start: var(--uird-margin);
    box-sizing: content-box;
    padding: 4px;
    border: 1px solid var(--uird-rule);
    border-radius: 4px;
    background: var(--uird-surface);
    cursor: crosshair;
    touch-action: none;
  }

  .minimap rect {
    fill: var(--uird-id);
    stroke: none;
  }

  .minimap rect.open {
    fill: none;
    stroke: var(--uird-id);
    stroke-width: 1;
  }

  .minimap rect.current {
    fill: var(--uird-ink);
  }

  .minimap rect.window {
    fill: color-mix(in oklch, var(--uird-ink) 8%, transparent);
    stroke: var(--uird-ink);
    stroke-width: 1;
  }

  .view-tools {
    gap: 8px;
  }

  .view-tools .step {
    inline-size: 16px;
    font-size: 14px;
    letter-spacing: 0;
    text-align: center;
  }

  .view-tools button:disabled {
    text-decoration: none;
  }

  .icon.max {
    display: none;
    margin-inline: -12px -16px;
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

  /* Quiet chrome: what the recorder discarded, and what an import said. */
  .dropped {
    padding-block: 8px;
    padding-inline: 72px var(--uird-margin);
    border-block-start: 1px dashed var(--uird-rule);
    color: var(--uird-muted);
    font-size: var(--uird-size-small);
  }

  .notice {
    display: block;
    overflow: clip;
    color: var(--uird-muted);
    font-size: var(--uird-size-small);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .notice.fault {
    color: var(--uird-red);
  }

  .router-card > .switch {
    padding-inline-start: 24px;
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
      padding-block-start: 4px;
    }
  }

  /* Side sheet: outline above log */
  @media (480px <= width <= 880px) {
    .body {
      grid-template-rows: auto minmax(0, 1fr);
    }

    .titlestrip {
      gap: 12px;
    }

    .tree-pane {
      max-block-size: 40svh;
      border-block-end: 1px solid var(--uird-rule);
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

    /* The strip's end reads as three groups: counts, session, window. */
    .titlestrip > .session {
      align-self: stretch;
      padding-inline: 12px;
      border-inline: 1px solid var(--uird-rule);
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

    .log .tx.selected .reason.fault {
      overflow: clip;
      white-space: nowrap;
    }

    .log .tx.selected .reason .more {
      display: inline;
      margin-inline-start: 1ch;
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
      border: 1px solid var(--uird-rule-strong);
      border-radius: 2px;
      background: var(--uird-surface);
      box-shadow: 0 8px 32px -8px oklch(0% 0 none / 0.28);
      /* Placed from measured rects, clear of the drawn edges; the inline offset is physical because the rects are. */
      inset-block-start: var(--uird-pop-y, 38px);
      left: var(--uird-pop-x, 12px);
      /* It fades in where it is placed and never moves, so the fade needs no reduced-motion gate. */
      transition: opacity 160ms var(--uird-ease-out);
    }

    .panel[data-view='map']:not([data-max]):is(
        [data-inspect='state'],
        [data-inspect='tx'],
        [data-inspect='router']
      )
      .inspector-pane {
      display: grid;
    }

    @starting-style {
      .panel[data-view='map']:not([data-max]):is(
          [data-inspect='state'],
          [data-inspect='tx'],
          [data-inspect='router']
        )
        .inspector-pane {
        opacity: 0;
      }
    }

    /* Maximised: the diagram above the full log and inspector. */
    .panel[data-view='map'][data-max] .body {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      grid-template-rows: minmax(0, 3fr) minmax(0, 2fr);
    }

    .panel[data-view='map'][data-max] .tree-pane {
      grid-column: 1 / -1;
      border-block-end: 1px solid var(--uird-rule);
    }

    .panel[data-view='map'][data-max] .log-pane {
      border-inline-start: 0;
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

  /* A rail takes the identity colour of the state it leads into; weight marks the active path. */
  .rail {
    fill: none;
    stroke: var(--uird-line, var(--uird-rule-strong));
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
    stroke-width: 2;
  }

  .rail.role-exiting {
    stroke: var(--uird-exit);
    stroke-width: 2;
    stroke-dasharray: 4 4;
  }

  .panel[data-mode='tx'] .rail:is(.role-entering, .role-retained) {
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
    fill: var(--uird-line, var(--uird-rule-strong));
  }

  .panel[data-mode='tx'] .rail-initial:is(.role-entering, .role-retained) {
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

  /* Nested Map: a box per state, child states inside their parent. The packer sets every box's place and size. */

  .nested {
    --nest-head: 24px;
    --nest-scale: 1;

    position: relative;
  }

  .nested.small {
    --nest-head: 20px;

    font-size: var(--uird-size-small);
  }

  /* The maximised panel's steps: the header's type, glyphs and spacing grow together, on the packer's metrics. */
  .nested.roomy {
    --nest-head: 32px;
    --nest-scale: 1.3333;

    font-size: 16px;
    line-height: 1.3333;
  }

  .nested.large {
    --nest-head: 40px;
    --nest-scale: 1.6667;

    font-size: 20px;
    line-height: 1.3333;
  }

  .nested .glyph {
    inline-size: calc(12px * var(--nest-scale));
    block-size: calc(12px * var(--nest-scale));
  }

  .nested .marks {
    gap: calc(4px * var(--nest-scale));
  }

  .nested .tag {
    font-size: calc(var(--uird-size-small) * var(--nest-scale));
  }

  .box {
    position: absolute;
    border-radius: calc(4px * var(--nest-scale));
    background: var(--uird-surface);
    cursor: default;
  }

  /* The border is a layer of its own, so a heavier or dashed one moves nothing inside the box. */
  .box::before {
    content: '';
    position: absolute;
    inset: 0;
    border: 1px solid var(--uird-line, var(--uird-rule-strong));
    border-radius: inherit;
    pointer-events: none;
  }

  .box.collapsed {
    box-shadow:
      3px 3px 0 -1px var(--uird-surface),
      3px 3px 0 0 var(--uird-line, var(--uird-rule-strong));
  }

  /* Focus is drawn inside the border and selection outside it, so the two are told apart and neither covers the border. */
  .head:focus-visible {
    outline-offset: -5px;
    border-radius: inherit;
  }

  /* Selection is a layer of its own: a ring outside the box, in a colour that is neither a depth nor a status, so the border keeps saying what it said. */
  .box.selected {
    outline: 1px solid var(--uird-select);
    outline-offset: 2px;
  }

  /* Weight, wash and dash say where a state stands; hue stays with identity until a transition is in focus. */
  .box:is(.role-ancestor, .role-entering, .role-current)::before {
    border-width: 2px;
  }

  .box.role-current {
    background: color-mix(
      in oklch,
      var(--uird-line, var(--uird-ink)) 12%,
      var(--uird-surface)
    );
  }

  .box.role-future::before {
    border-style: dashed;
  }

  .panel[data-mode='tx'] .box:is(.role-entering, .role-retained)::before {
    border-color: var(--uird-active);
  }

  .panel[data-mode='tx'] .box.role-entering.leaf {
    background: var(--uird-active-wash);
  }

  .box.role-exiting::before {
    border: 2px dashed var(--uird-exit);
  }

  .box.role-errored::before {
    border: 2px solid var(--uird-red);
  }

  .head {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--nest-scale));
    block-size: var(--nest-head);
    padding-inline: calc(8px * var(--nest-scale));
    border-radius: inherit;
    white-space: nowrap;
  }

  .head .name {
    min-inline-size: 0;
    overflow: clip;
    text-overflow: ellipsis;
  }

  .head:active {
    background: color-mix(in oklch, var(--uird-ink) 8%, transparent);
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

  .head :is(.marks, .tag, .fold) {
    margin-inline-start: auto;
  }

  .head :is(.marks, .tag) + .fold {
    margin-inline-start: 0;
  }

  /* The pointer's way to close or open a compound. */
  .fold {
    display: grid;
    flex: none;
    place-items: center;
    inline-size: calc(16px * var(--nest-scale));
    block-size: var(--nest-head);
    margin-inline-end: calc(-4px * var(--nest-scale));
    color: var(--uird-muted);
  }

  .fold:dir(rtl) .glyph.fold-closed {
    scale: -1 1;
  }

  @media (hover: hover) and (pointer: fine) {
    .head:hover {
      background: color-mix(in oklch, var(--uird-ink) 5%, transparent);
    }

    .fold:hover {
      color: var(--uird-ink);
    }
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

  .box.merged {
    background: none;
  }

  .box.merged::before {
    content: none;
  }

  .box.merged > .head {
    padding-inline-start: var(--indent);
  }

  .initial {
    position: absolute;
    inset-block-start: calc(var(--nest-head) / 2 - 6px);
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

  /* A mask's luminance decides what shows, so its stroke is white whatever the scheme. */
  .nedge .reveal {
    fill: none;
    stroke: oklch(100% 0 none);
    stroke-width: 24;
    stroke-dasharray: 1;
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

  /* A redirect's line is dashed and its head is an open chevron, so the two read apart without colour. */
  .nedge.edge-redirect .line {
    stroke-dasharray: 5 4;
  }

  .nedge.edge-redirect .head {
    fill: none;
    stroke: var(--uird-ink);
    stroke-width: 1.5;
  }

  .nedge.edge-fault :is(.line, .cap) {
    stroke: var(--uird-red);
  }

  .nedge.edge-fault .head {
    fill: var(--uird-red);
  }

  /* A count chip sits on its line, on the surface colour, and is drawn left to right whatever the page's direction. */
  .chip {
    direction: ltr;
  }

  .chip rect {
    fill: var(--uird-surface);
  }

  .chip text {
    fill: var(--uird-ink);
    font: 500 11px / 1 var(--uird-font-mono);
    font-variant-numeric: tabular-nums;
    dominant-baseline: central;
  }

  .chip path {
    fill: var(--uird-ink);
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

  /* A state named in words is underlined, thinly, in its identity colour. */
  .link {
    text-decoration: underline;
    text-decoration-color: var(--uird-id, var(--uird-rule-strong));
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }

  .link:focus-visible {
    text-decoration-thickness: 2px;
  }

  @media (hover: hover) and (pointer: fine) {
    .link:hover {
      text-decoration-thickness: 2px;
    }
  }

  .traffic {
    display: flex;
    flex-wrap: wrap;
    column-gap: 16px;
  }

  .hop {
    white-space: nowrap;
  }

  .times {
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

  /* A redirect's successor keeps the row grid; a thread joins the two outcome glyphs. */
  .tx .line.chain {
    position: relative;
    cursor: default;
  }

  .tx .line.chain::before {
    content: '';
    position: absolute;
    inset-block-start: -5px;
    inset-inline-start: calc(var(--uird-margin) + 24px + var(--uird-gap) + 5px);
    block-size: 10px;
    border-inline-start: 1px solid var(--uird-rule-strong);
  }

  .path {
    overflow: clip;
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
    font-size: var(--uird-size-small);
    overflow-wrap: anywhere;
  }

  .reason.fault .msg {
    color: var(--uird-red);
  }

  /* A fault is one line in the log; the inspector, or the selected row where there is none, holds all of it. */
  .tx .reason.fault {
    overflow: clip;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reason .more {
    margin-inline-start: 1ch;
  }

  .tx.selected .reason.fault {
    overflow: visible;
    white-space: normal;
  }

  .tx.selected .reason .more {
    display: block;
    margin-inline-start: 0;
  }

  .inspector .reason {
    margin-block: 4px 8px;
    margin-inline-start: 5px;
    padding-block: 0;
    padding-inline: 17px 0;
    border-inline-start: 2px solid var(--uird-rule);
  }

  .inspector .reason.fault {
    border-inline-start-color: var(--uird-red);
  }

  .inspector .reason .more {
    display: block;
    margin-block-start: 4px;
    margin-inline-start: 0;
    color: var(--uird-ink);
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
    font-size: var(--uird-size-small);
    overflow: clip;
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
    margin-block-start: 4px;
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
      --uird-depth-1: CanvasText;
      --uird-depth-2: CanvasText;
      --uird-depth-3: CanvasText;
      --uird-depth-4: CanvasText;
      --uird-select: Highlight;
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

    .box.selected {
      outline-width: 2px;
    }

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

    .tx.selected .reason.fault .msg,
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

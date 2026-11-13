import { css, type CSSResult } from 'lit';

// The Timeline's own rules, adopted by the panel when the Timeline's chunk loads; the tokens are the panel's.
export const timelineStyles: CSSResult = css`
  /* Timeline: one transition's waterfall, a row per bar on a shared axis */

  /* The waterfall and a bar's details scroll apart, so the details stay beside the bar they describe. */
  .timeline-scroll {
    display: grid;
    padding-block-end: 0;
    overflow: clip;
    container-type: inline-size;
  }

  .timeline {
    --tl-name: clamp(176px, 32%, 320px);

    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    min-block-size: 0;
  }

  .timeline[data-detail] {
    grid-template-rows: minmax(0, 3fr) minmax(0, 2fr);
  }

  .tl-main {
    min-inline-size: 0;
    min-block-size: 0;
    padding-block-end: 12px;
    overflow: auto;
  }

  .tl-row {
    display: grid;
    grid-template-columns: var(--tl-name) minmax(0, 1fr) 48px 64px;
    column-gap: var(--uird-gap);
    align-items: center;
    block-size: var(--uird-row);
    padding-inline: var(--uird-margin);
    cursor: default;
    white-space: nowrap;
  }

  /* The axis stays in view above the rows; its gridlines run down every row's track. */
  .tl-axis {
    position: sticky;
    inset-block-start: 0;
    z-index: 1;
    margin-block-end: 4px;
    border-block-end: 1px solid var(--uird-rule);
    background: var(--uird-surface);
    color: var(--uird-muted);
    font-size: var(--uird-size-small);
  }

  .tl-axis > :is(.tl-name, .tl-at, .tl-took) {
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .tl-name {
    display: flex;
    align-items: center;
    gap: 8px;
    min-inline-size: 0;
    padding-inline-start: calc(var(--level, 0) * 16px);
  }

  .tl-name .name {
    min-inline-size: 0;
    overflow: clip;
    text-overflow: ellipsis;
  }

  .tl-name :is(.glyph, .seq) {
    flex: none;
  }

  /* Short of room a tag gives way before the name does; the item's name still says it. */
  .tl-name .tag {
    flex: 0 100 auto;
    min-inline-size: 0;
    overflow: clip;
    text-overflow: ellipsis;
  }

  .tl-fold {
    display: inline-grid;
    flex: none;
    place-items: center;
    inline-size: 12px;
    color: var(--uird-muted);
    cursor: pointer;
  }

  .tl-at,
  .tl-took {
    text-align: end;
  }

  .tl-row:not(.tl-axis) .tl-at {
    color: var(--uird-muted);
  }

  .tl-track {
    position: relative;
    align-self: stretch;
    background: linear-gradient(to right, var(--uird-rule) 1px, transparent 1px)
      0 0 / calc(var(--tick) * 100%) 100% repeat-x;
  }

  .tl-track:dir(rtl) {
    background-image: linear-gradient(
      to left,
      var(--uird-rule) 1px,
      transparent 1px
    );
    background-position: 100% 0;
  }

  .tl-axis .tl-track {
    overflow: clip;
  }

  .tl-tick {
    position: absolute;
    inset-block-start: 4px;
    inset-inline-start: calc(var(--s) * 100%);
    padding-inline-start: 4px;
  }

  .tl-bar {
    position: absolute;
    inset-block: 9px;
    inset-inline-start: calc(var(--s) * 100%);
    inline-size: max(2px, calc(var(--w) * 100%));
    border: 0 solid var(--uird-rule-strong);
    background: var(--uird-rule-strong);
  }

  .tl-bar.bar-transition {
    inset-block: 6px;
    border-width: 1px;
    border-color: var(--uird-ink);
    background: var(--uird-active-wash);
  }

  /* A transition the router replaced or stopped did not finish: its outline is dashed and nothing fills it. */
  .tl-bar.bar-transition:is(
      .status-redirected,
      .status-superseded,
      .status-aborted,
      .status-ignored
    ) {
    border-style: dashed;
    border-color: var(--uird-muted);
    background: none;
  }

  .tl-bar.bar-resolve,
  .tl-bar.per-state:is(.phase-enter, .phase-retain) {
    background: var(--uird-active);
  }

  .tl-bar.phase-exit {
    background: var(--uird-exit);
  }

  .tl-bar.bar-span {
    background: var(--uird-muted);
  }

  /* Only overlapping in time is not belonging: such a span is an outline, never a fill. */
  .tl-bar.rel-during {
    inset-block: 8px;
    border-width: 1px;
    border-style: dashed;
    border-color: var(--uird-ink);
    background: none;
  }

  .tl-bar.fault {
    border-color: var(--uird-red);
    background: var(--uird-red);
  }

  /* A failed transition keeps its outline, so the red fill is left to the part that failed. */
  .tl-bar.bar-transition.fault {
    background: color-mix(in oklch, var(--uird-red) 12%, var(--uird-surface));
  }

  .tl-bar.rel-during.fault {
    background: none;
  }

  .tl-bar.running {
    background-image: repeating-linear-gradient(
      -45deg,
      transparent 0 3px,
      color-mix(in oklch, var(--uird-surface) 60%, transparent) 3px 6px
    );
  }

  .tl-detail {
    min-inline-size: 0;
    padding-block: 4px 12px;
    padding-inline: var(--uird-margin);
    overflow: auto;
    border-block-start: 1px solid var(--uird-rule);
  }

  .tl-detail .insp-title .name {
    overflow-wrap: anywhere;
  }

  .tl-detail .facts {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .tl-detail .facts dt {
    padding-inline-start: 0;
  }

  .tl-detail .facts dd {
    overflow-wrap: anywhere;
  }

  .tl-detail .attributes {
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    padding-block-start: 8px;
    border-block-start: 1px dashed var(--uird-rule);
  }

  .tl-detail .attributes dt {
    overflow: clip;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* With room, a bar's details stand beside the waterfall rather than under it. */
  @container (width >= 720px) {
    .timeline[data-detail] {
      grid-template-columns: minmax(0, 1fr) 296px;
      grid-template-rows: minmax(0, 1fr);
    }

    .tl-detail {
      border-block-start: 0;
      border-inline-start: 1px solid var(--uird-rule);
    }
  }

  /* In a sheet the track needs the room: the name narrows and the start column goes, its number staying in each item's name and the details. */
  @container (width < 480px) {
    .timeline {
      --tl-name: 40%;
    }

    .tl-row {
      grid-template-columns: var(--tl-name) minmax(0, 1fr) 56px;
    }

    .tl-at,
    .tl-tick.odd {
      display: none;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .tl-row:not(.tl-axis):hover {
      background: var(--uird-surface-raised);
    }
  }

  @media (forced-colors: active) {
    .tl-bar {
      border-color: CanvasText;
      background: CanvasText;
    }

    .tl-bar.rel-during {
      background: Canvas;
    }
  }
`;

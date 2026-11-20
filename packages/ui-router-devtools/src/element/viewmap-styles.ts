import { css, type CSSResult } from 'lit';

// The Views' own rules, adopted by the panel when the Views' chunk loads; the boxes are the nested Map's.
export const viewMapStyles: CSSResult = css`
  /* Views: a box per ui-view, nested views inside the view their content holds */

  .views-scroll {
    display: grid;
    padding-block-end: 0;
    overflow: clip;
    container-type: inline-size;
  }

  .viewmap {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    min-block-size: 0;
  }

  .viewmap[data-detail] {
    grid-template-rows: minmax(0, 3fr) minmax(0, 2fr);
  }

  /* The drawing is placed by its margins in whole pixels; the list of configs no view took keeps to the room's foot. */
  .vm-main {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    min-block-size: 0;
    padding-block: 12px;
    padding-inline: var(--uird-margin);
    overflow: auto;
  }

  .vm-boxes {
    flex: none;
  }

  .vm-boxes .head {
    cursor: pointer;
  }

  .vm-boxes .head > .name {
    flex: 0 1 auto;
  }

  .vm-fill {
    color: var(--uird-line, var(--uird-muted));
  }

  .vm-boxes .head > .tag {
    margin-inline-start: 0;
  }

  /* An empty view is a dashed outline in the neutral rule: no state fills it, so it has no identity. */
  .box.vacant {
    --uird-line: var(--uird-rule-strong);
  }

  .box.vacant::before {
    border-style: dashed;
  }

  .box.vacant > .head > .name,
  .box.inactive > .head > .name {
    color: var(--uird-muted);
  }

  /* A view a state left filled, as a sticky state does, keeps its identity at a dash. */
  .box.inactive::before {
    border-style: dashed;
  }

  .vm-unmatched {
    flex: none;
    max-inline-size: 480px;
    margin-block-start: auto;
    padding-block-start: 16px;
  }

  .vm-unmatched .plain {
    padding-inline-start: 0;
  }

  .vm-unmatched li {
    overflow-wrap: anywhere;
  }

  .vm-detail {
    min-inline-size: 0;
    padding-block: 4px 12px;
    padding-inline: var(--uird-margin);
    overflow: auto;
    border-block-start: 1px solid var(--uird-rule);
  }

  .vm-detail .facts {
    grid-template-columns: 88px minmax(0, 1fr);
  }

  .vm-detail .facts dt {
    padding-inline-start: 0;
  }

  :is(.vm-detail, .vm-inspector) .facts dd {
    overflow-wrap: anywhere;
  }

  /* The view path under the Map: nested boxes in the sheet, one row of items in the dock. */
  .tree-pane > .vp {
    grid-column: 1 / -1;
  }

  .vp {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-inline-size: 0;
    padding-block: 4px 8px;
    padding-inline: var(--uird-margin);
    border-block-start: 1px solid var(--uird-rule);
    font: 400 var(--uird-size) / var(--uird-line) var(--uird-font-mono);
  }

  .vp-caption {
    flex: none;
    font: 700 var(--uird-size-small) / var(--uird-row) var(--uird-font);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .vp-of {
    font: 400 var(--uird-size) / var(--uird-line) var(--uird-font-mono);
    letter-spacing: 0;
    text-transform: none;
    color: var(--uird-muted);
  }

  .vp-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-inline-size: 0;
    padding-block-end: 6px;
    padding-inline: 6px;
    border: 1px solid var(--uird-line, var(--uird-rule-strong));
    border-radius: 2px;
  }

  .vp-inner {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .vp-sep {
    display: none;
    color: var(--uird-muted);
  }

  .vp-chip {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-inline-size: 0;
    padding-block: 2px;
    white-space: nowrap;
    border-radius: 2px;
  }

  .vp-chip > .name:not(.vm-fill) {
    flex: none;
  }

  /* Names are code, read left to right in either direction, so a leading dollar sign stays at the start. */
  :is(.vp-chip, .vp-of) > .name,
  .vp-of {
    direction: ltr;
    unicode-bidi: isolate;
  }

  .vp-chip > .vm-fill {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Selected: the selection's ring, clear of the focus ring inside it. */
  .vp-chip[aria-pressed='true'] {
    box-shadow:
      0 0 0 2px var(--uird-surface),
      0 0 0 4px var(--uird-select);
  }

  .vp-more,
  .vp-none {
    flex: none;
    align-self: flex-start;
    font: 400 var(--uird-size-small) / var(--uird-row) var(--uird-font);
    color: var(--uird-muted);
    white-space: nowrap;
  }

  /* In the dock the path is one row; a path longer than the room scrolls, and a focused item scrolls into view. */
  @media (width > 880px) {
    .vp {
      flex-direction: row;
      align-items: center;
      gap: 6px;
      padding-block: 4px;
      overflow-x: auto;
      scrollbar-width: thin;
    }

    .vp-item,
    .vp-inner {
      display: contents;
    }

    .vp-sep {
      display: inline;
      flex: none;
    }

    .vp-more,
    .vp-none {
      align-self: center;
    }

    .vp-chip {
      flex: none;
      padding-block: 1px;
      padding-inline: 6px;
      border: 1px solid var(--uird-line, var(--uird-rule-strong));
    }

    .vp-chip > .vm-fill {
      overflow: visible;
    }
  }

  @media (forced-colors: active) {
    .vp-chip[aria-pressed='true'] {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }

  /* A state tied to the view selected from the path: the selection's ring, dashed. */
  .box.linked {
    outline: 1px dashed var(--uird-select);
    outline-offset: 2px;
  }

  @media (forced-colors: active) {
    .box.linked {
      outline: 2px dashed Highlight;
    }
  }

  @media (width > 880px) {
    .panel[data-view='map']:not([data-max])[data-inspect='view']
      .inspector-pane {
      display: grid;
    }
  }

  /* With room, a view's details stand beside the boxes rather than under them. */
  @container (width >= 720px) {
    .viewmap[data-detail] {
      grid-template-columns: minmax(0, 1fr) 296px;
      grid-template-rows: minmax(0, 1fr);
    }

    .vm-detail {
      border-block-start: 0;
      border-inline-start: 1px solid var(--uird-rule);
    }
  }
`;

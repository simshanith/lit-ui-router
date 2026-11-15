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

  .vm-main {
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
    max-inline-size: 480px;
    margin-block-start: 16px;
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

  .vm-detail .facts dd {
    overflow-wrap: anywhere;
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

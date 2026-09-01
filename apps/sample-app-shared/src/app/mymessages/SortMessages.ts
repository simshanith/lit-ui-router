import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export function changeEvent(sort: string) {
  return new CustomEvent('change', { detail: { sort } });
}

export type ChangeEvent = ReturnType<typeof changeEvent>;

@customElement('sample-sort-messages')
export class SortMessages extends LitElement {
  @property({ attribute: false })
  label = '';

  /** Names the button when `label` is deliberately empty (an icon column). */
  @property({ attribute: false })
  accessibleLabel = '';

  @property({ attribute: false })
  col = '';

  @property({ attribute: false })
  sort = '';

  createRenderRoot() {
    return this;
  }

  handleClick = () => {
    const { col, sort } = this;
    const newSort = sort === `+${col}` ? `-${col}` : `+${col}`;
    this.dispatchEvent(changeEvent(newSort));
  };

  render() {
    const { col, label, sort } = this;
    let sortClass = '';

    if (sort == `+${col}`) sortClass = 'fa-sort-asc';
    else if (sort == `-${col}`) sortClass = 'fa-sort-desc';
    const chevron = html`<i
      style="padding-left:0.25em"
      class="fa ${sortClass}"
    ></i>`;
    return html`<button
      type="button"
      aria-label=${label || this.accessibleLabel}
      @click=${this.handleClick}
    >
      ${label} ${chevron}
    </button>`;
  }
}

export default SortMessages;

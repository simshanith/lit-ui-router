import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export function changeEvent(sort: string) {
  return new CustomEvent('change', { detail: { sort } });
}

export type ChangeEvent = ReturnType<typeof changeEvent>;

@customElement('sample-sort-messages')
export class SortMessages extends LitElement {
  @property({ attribute: false })
  label: string;

  @property({ attribute: false })
  col: string;

  @property({ attribute: false })
  sort: string;

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
    return html`<span @click=${this.handleClick}>${label} ${chevron}</span>`;
  }
}

export default SortMessages;

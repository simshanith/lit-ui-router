import { html } from './html.js';

export class ACard extends HTMLElement {
  label = '';
}

customElements.define('light-card', ACard);

export const a = html`<light-card .label=${'a'}></light-card>`;

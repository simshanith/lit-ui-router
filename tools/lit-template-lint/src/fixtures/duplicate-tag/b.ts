import { html } from './html.js';

export class BCard extends HTMLElement {
  label = '';
  compact = false;
}

customElements.define('light-card', BCard);

export const b = html`<light-card .compact=${true}></light-card>`;

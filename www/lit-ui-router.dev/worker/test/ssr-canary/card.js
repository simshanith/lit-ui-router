import { LitElement, css, html } from 'lit';

class CanaryCard extends LitElement {
  static properties = { heading: {} };

  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    return html`<h2>${this.heading}</h2>
      <slot></slot>`;
  }
}

customElements.define('canary-card', CanaryCard);

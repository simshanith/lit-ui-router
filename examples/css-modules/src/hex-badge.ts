import { LitElement, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

// A shadow root already scopes its styles, so this sheet is plain CSS, not a module.
import sheet from './hex-badge.css?inline';

@customElement('hex-badge')
export class HexBadge extends LitElement {
  static styles = unsafeCSS(sheet);

  @property() hex = '';

  render() {
    return html`<span style="--swatch: ${this.hex}">${this.hex}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hex-badge': HexBadge;
  }
}

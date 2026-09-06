// The app's own design-system link element: it declares `href`, so uiSref's
// `true` default is right for it — which `settings.linkElements` tells the rules.
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('my-link')
export class MyLink extends LitElement {
  @property() href = '';

  render() {
    return html`<a href=${this.href}><slot></slot></a>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'my-link': MyLink;
  }
}

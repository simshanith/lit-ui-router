// Defines <ui-router> and carries its tag-map entry; import for the side effect.
import { UIRouterLitElement } from './ui-router.js';

declare global {
  interface HTMLElementTagNameMap {
    'ui-router': UIRouterLitElement;
  }
}

// Guarded so a duplicate package copy degrades to first-definition-wins instead of a define() throw.
if (!customElements.get('ui-router')) {
  customElements.define('ui-router', UIRouterLitElement);
} else {
  console.warn(
    'lit-ui-router: <ui-router> is already defined; skipping registration. Multiple copies of lit-ui-router may be loaded.',
  );
}

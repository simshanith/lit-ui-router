// Registration entry: the runtime global mutation and its type-level counterpart live together here.
import { UIRouterLitElement } from './ui-router.js';
import { UiView } from './ui-view.js';

declare global {
  interface HTMLElementTagNameMap {
    'ui-router': UIRouterLitElement;
    'ui-view': UiView;
  }
}

// Guarded so a duplicate package copy degrades to first-definition-wins instead of a define() throw.
if (!customElements.get('ui-router')) {
  customElements.define('ui-router', UIRouterLitElement);
}
if (!customElements.get('ui-view')) {
  customElements.define('ui-view', UiView);
}

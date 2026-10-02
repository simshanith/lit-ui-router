// Defines <ui-router> and carries its tag-map entry; import for the side effect.
import { UIRouterLitElement } from './ui-router.js';

declare global {
  interface HTMLElementTagNameMap {
    'ui-router': UIRouterLitElement;
  }
}

// Guarded so another definition of the tag degrades to first-definition-wins instead of a define() throw; a subclass is a deliberate extension and passes silently.
const defined = customElements.get('ui-router');

if (!defined) {
  customElements.define('ui-router', UIRouterLitElement);
} else if (
  defined !== UIRouterLitElement &&
  !(defined.prototype instanceof UIRouterLitElement)
) {
  console.warn(
    `lit-ui-router: <ui-router> is already defined by ${defined.name || 'an anonymous class'}; lit-ui-router did not register its own. ` +
      'Import names from lit-ui-router/pure if another package is meant to own the tag, otherwise two copies of lit-ui-router may be loaded.',
  );
}

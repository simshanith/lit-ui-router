// Defines <ui-view> and carries its tag-map entry; import for the side effect.
import { UiView } from './ui-view.js';

declare global {
  interface HTMLElementTagNameMap {
    'ui-view': UiView;
  }
}

// Guarded so another definition of the tag degrades to first-definition-wins instead of a define() throw; a subclass is a deliberate extension and passes silently.
const defined = customElements.get('ui-view');

if (!defined) {
  customElements.define('ui-view', UiView);
} else if (defined !== UiView && !(defined.prototype instanceof UiView)) {
  console.warn(
    `lit-ui-router: <ui-view> is already defined by ${defined.name || 'an anonymous class'}; lit-ui-router did not register its own. ` +
      'Import names from lit-ui-router/pure if another package is meant to own the tag, otherwise two copies of lit-ui-router may be loaded.',
  );
}

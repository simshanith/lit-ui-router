// Defines <ui-view> and carries its tag-map entry; import for the side effect.
import { UiView } from './ui-view.js';

declare global {
  interface HTMLElementTagNameMap {
    'ui-view': UiView;
  }
}

// Guarded so a duplicate package copy degrades to first-definition-wins instead of a define() throw.
if (!customElements.get('ui-view')) {
  customElements.define('ui-view', UiView);
} else {
  console.warn(
    'lit-ui-router: <ui-view> is already defined; skipping registration. Multiple copies of lit-ui-router may be loaded.',
  );
}

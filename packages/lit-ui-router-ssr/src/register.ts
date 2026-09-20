// Defines <ui-router> and the served <ui-view>; import for the side effect, in place of `lit-ui-router/register`.
import { UiView } from 'lit-ui-router/pure';
import 'lit-ui-router/ui-router.register';

import { isServedViewClass, withServedRender } from './served-view.js';

declare global {
  interface HTMLElementTagNameMap {
    // The served class extends core's, so this is the same entry `lit-ui-router/register` declares.
    'ui-view': UiView;
  }
}

const defined = customElements.get('ui-view');

if (!defined) {
  customElements.define('ui-view', withServedRender(UiView));
} else if (!isServedViewClass(defined)) {
  throw new Error(
    'lit-ui-router-ssr: <ui-view> is already defined by another class, so this page cannot serve a prerendered render into it. ' +
      'Import lit-ui-router-ssr/register in place of lit-ui-router or lit-ui-router/register, and import it before anything that registers <ui-view>. ' +
      'To keep both, import lit-ui-router/pure — which registers nothing — and define withServedRender(UiView) under a tag of your own.',
  );
}

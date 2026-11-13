import { UIRouterDevtools } from './ui-router-devtools.ts';

export { UIRouterDevtools };

if (!customElements.get('ui-router-devtools'))
  customElements.define('ui-router-devtools', UIRouterDevtools);

declare global {
  interface HTMLElementTagNameMap {
    'ui-router-devtools': UIRouterDevtools;
  }
}

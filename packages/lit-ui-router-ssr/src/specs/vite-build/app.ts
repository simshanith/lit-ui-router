import { html, LitElement } from 'lit';
import type { TemplateResult } from 'lit';
import type { LitStateDeclaration, UIRouterLit } from 'lit-ui-router/pure';
import { uiViewSlot } from 'lit-ui-router-ssr/client';
// As the client imports it; in the prerender worker the plugin's preload has already run it.
import 'lit-ui-router-ssr/register';

/** A LitElement the home view holds, defined at import as an app's elements are. */
export class HelloCard extends LitElement {
  override render(): TemplateResult {
    return html`<p>hello</p>`;
  }
}

customElements.define('hello-card', HelloCard);

export const states: LitStateDeclaration[] = [
  {
    name: 'home',
    url: '/',
    component: () =>
      html`<h1>Home</h1>
        <hello-card></hello-card>`,
  },
  { name: 'about', url: '/about', component: () => html`<h1>About</h1>` },
  { name: 'legacy', url: '/legacy', redirectTo: 'about' },
  { name: 'notFound', component: () => html`<h1>Not found</h1>` },
];

/** The page: one `<ui-view>`, with the slot the server render fills. */
export const page = (router: UIRouterLit): TemplateResult =>
  html`<ui-router .uiRouter=${router}
    ><ui-view>${uiViewSlot()}</ui-view></ui-router
  >`;

/** The same page without `uiViewSlot()`: the server render has no part to fill. */
export const slotlessPage = (router: UIRouterLit): TemplateResult =>
  html`<ui-router .uiRouter=${router}><ui-view></ui-view></ui-router>`;

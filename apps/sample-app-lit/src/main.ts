import { html, render } from 'lit';
import '@api-viewer/docs';
import { UIRouterLit, UIRouterLitElement } from 'lit-ui-router';
import customElementsJsonUrl from 'lit-ui-router/dist/custom-elements.json?url';

import { configureRouter } from './router.config.js';

let router: UIRouterLit;
const handleUiRouterContext = {
  handleEvent(e: CustomEvent<{ uiRouter: UIRouterLit }>) {
    router = e.detail.uiRouter;
    console.info('obtained ui-router from event');
  },
  once: true,
};

// Typical usage provides uiRouter as a property;
// router = configureRouter();
// html`<ui-router .uiRouter=${router}>...`

// However, here we are demonstrating creation of its own instance,
// which can be accessed through the `ui-router-context` event detail,
// or the element property.

const root = document.getElementById('root')!;

render(
  html`
    <ui-router @ui-router-context=${handleUiRouterContext}>
      <div>
        <ui-view></ui-view>
      </div>
    </ui-router>
    <api-docs src=${customElementsJsonUrl}></api-docs>
  `,
  root,
);

const element: UIRouterLitElement = root.querySelector('ui-router');
const routerFromElement = element.uiRouter;
router = router || routerFromElement;

if (routerFromElement === router) {
  console.info('obtained ui-router from element');
  configureRouter(router);
}

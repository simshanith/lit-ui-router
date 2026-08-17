import './styles.css';
import { html, render } from 'lit';
// type-only: keeps <api-docs> known to lit-analyzer, emits no runtime import
import type {} from '@api-viewer/docs';
import { UIRouterLit } from 'lit-ui-router';
import customElementsJsonUrl from 'lit-ui-router/dist/custom-elements.json?url';

import { configureRouter } from './router.config.js';
import { featureFlags } from './app/util/featureDetection.js';

let router: UIRouterLit | undefined;
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

const apiDocsEnabled = featureFlags.get('enable-api-docs');
// <api-docs> upgrades in place when the definition lands, so the tag renders now
if (apiDocsEnabled) void import('@api-viewer/docs');

render(
  html` <ui-router @ui-router-context=${handleUiRouterContext}>
      <div>
        <ui-view></ui-view>
      </div>
    </ui-router>
    ${
      apiDocsEnabled
        ? html`<api-docs src=${customElementsJsonUrl}></api-docs>`
        : ''
    }`,
  root,
);

const element = root.querySelector('ui-router');
const routerFromElement = element?.uiRouter;
router = router || routerFromElement!;

if (routerFromElement === router) {
  console.info('obtained ui-router from element');
  configureRouter(router);
}

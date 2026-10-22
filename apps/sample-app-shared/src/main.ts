import './styles.css';
import { ContextEvent } from '@lit/context';
import { html, render } from 'lit';
// type-only: keeps <api-docs> known to lit-analyzer, emits no runtime import
import type {} from '@api-viewer/docs';
// defines <ui-router> before render, so its connectedCallback mints the router synchronously
import 'lit-ui-router';
import type { UIRouterLit } from 'lit-ui-router';
import { routerContext } from 'lit-ui-router/context';
import customElementsJsonUrl from 'lit-ui-router/custom-elements.json?url';

import { configureRouter } from './router.config.js';
import { featureFlags } from './app/util/featureDetection.js';

// Typical usage provides uiRouter as a property;
// router = configureRouter();
// html`<ui-router .uiRouter=${router}>...`

// However, here we are demonstrating creation of its own instance,
// which can be requested over the community context protocol,
// or accessed through the element property.

const root = document.getElementById('root')!;

const apiDocsEnabled = featureFlags.get('enable-api-docs');

// <api-docs> upgrades in place when the definition lands, so the tag renders now
if (apiDocsEnabled) void import('@api-viewer/docs');

render(
  html`<ui-router>
      <div>
        <ui-view></ui-view>
      </div>
    </ui-router>
    ${
      apiDocsEnabled
        ? html`<aside aria-label="API documentation">
            <api-docs src=${customElementsJsonUrl}></api-docs>
          </aside>`
        : ''
    }`,
  root,
);

const view = root.querySelector('ui-view')!;

let router: UIRouterLit | undefined;

view.dispatchEvent(
  new ContextEvent(routerContext, view, (provided) => {
    router = provided;
    console.info('obtained ui-router from context');
  }),
);

const routerFromElement = root.querySelector('ui-router')?.uiRouter;

if (!router || router !== routerFromElement) {
  throw new Error('<ui-router> did not provide its router');
}

console.info('obtained ui-router from element');

configureRouter(router);

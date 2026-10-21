import './styles.css';
import { html, render } from 'lit';
// type-only: keeps <api-docs> known to lit-analyzer, emits no runtime import
import type {} from '@api-viewer/docs';
// defines <ui-router> before render, so its connectedCallback mints the router synchronously
import 'lit-ui-router';
import customElementsJsonUrl from 'lit-ui-router/custom-elements.json?url';

import { configureRouter } from './router.config.js';
import { featureFlags } from './app/util/featureDetection.js';

// Typical usage provides uiRouter as a property;
// router = configureRouter();
// html`<ui-router .uiRouter=${router}>...`

// However, here we are demonstrating creation of its own instance,
// which can be accessed through the element property.

const root = document.getElementById('root')!;

const apiDocsEnabled = featureFlags.get('enable-api-docs');

// <api-docs> upgrades in place when the definition lands, so the tag renders now
if (apiDocsEnabled) void import('@api-viewer/docs');

render(
  html` <ui-router>
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

const router = root.querySelector('ui-router')?.uiRouter;

if (!router) {
  throw new Error('<ui-router> did not create a router');
}

console.info('obtained ui-router from element');

configureRouter(router);

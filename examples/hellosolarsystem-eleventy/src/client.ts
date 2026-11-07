import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import { pushStateLocationPlugin } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router/pure';
import { bootstrap } from 'lit-ui-router-ssr/client';

import { configure, page } from './app.ts';

const router = configure(new UIRouterLit());

router.plugin(pushStateLocationPlugin);

const container = document.getElementById('app');

if (container) {
  const result = await bootstrap(router, container, page(router));
  Object.assign(globalThis, { __bootstrap: result });
}

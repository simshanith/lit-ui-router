import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import { pushStateLocationPlugin } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router/pure';
import { bootstrap } from 'lit-ui-router-ssr/client';

import { configure, page } from './app.ts';

const router = configure(new UIRouterLit());

router.plugin(pushStateLocationPlugin);

// Logs each transition to the console: after the first page, navigation is client-side, with no request.
router.trace.enable('TRANSITION');

const container = document.getElementById('app');

if (container) await bootstrap(router, container, page(router));

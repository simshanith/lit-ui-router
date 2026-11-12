// First: lit's hydrate support has to load before any element defines itself.
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

if (!container) throw new Error('index.html has no #app element to hydrate');

void bootstrap(router, container, page(router));

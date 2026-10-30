import 'lit-ui-router-ssr/register';
import { pushStateLocationPlugin } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router/pure';
import { bootstrap } from 'lit-ui-router-ssr/client';

import {
  BOOT_EVENT,
  BOOTED_MARK,
  INPUT_ID,
  QUERY_MARK,
  QUERY_PARAM,
  TYPED_MARK,
} from './pre-paint.ts';
import { registerStates } from './states.ts';
import { page, searchFor } from './views.ts';

const router = new UIRouterLit();

router.plugin(pushStateLocationPlugin);

registerStates(router);

router.urlService.rules.otherwise('/domain-search');

// index.html carries the root container.
const root = document.getElementById('root')!;

const { outcome, signature } = await bootstrap(router, root, page(router));

document.dispatchEvent(new Event(BOOT_EVENT));

document.documentElement.removeAttribute(QUERY_MARK);

document.documentElement.setAttribute(BOOTED_MARK, outcome);

performance.mark(BOOT_EVENT, { detail: { outcome, signature } });

// Text typed after the router started and before the input's listener attached is the visitor's latest query.
// SAFETY: the page template writes this id on the one search input.
const input = document.getElementById(INPUT_ID) as HTMLInputElement | null;

const routed = String(router.globals.params[QUERY_PARAM] ?? '');

if (input?.hasAttribute(TYPED_MARK) && input.value !== routed) {
  searchFor(router, input.value);
}

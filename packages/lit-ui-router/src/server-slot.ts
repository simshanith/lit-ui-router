// The sref directives' private server-router lookup; not a package export.
import type { UIRouter } from '@uirouter/core';

import { getScopedRouter, requestRouter } from './context.js';

/**
 * The router a server render offers: the call-scoped slot
 * (`withRouterSync`) first, then the `context-request` provider on
 * `@lit-labs/ssr`'s root event target.
 *
 * Both are `undefined` in a browser — nothing scoped a router and there is no
 * `litServerRoot` — so a client directive falls through to its element seek.
 *
 * @internal
 */
export const seekServerRouter = (): UIRouter | undefined => {
  const scoped = getScopedRouter();
  if (scoped) return scoped;
  const root = (globalThis as { litServerRoot?: EventTarget }).litServerRoot;
  return root ? requestRouter(root) : undefined;
};

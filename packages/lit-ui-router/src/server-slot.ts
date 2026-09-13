// The sref directives' server seek. The call-scoped slot itself lives in
// `./context.js`; this file is the directives' private lookup, kept out of the
// public entries so the browser bundle carries only the seek. Not a package export.
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

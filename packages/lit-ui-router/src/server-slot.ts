// The per-render router slot, split out of `./server.js` so the sref
// directives read it without pulling the server entry — and its memory
// location plugin — into the browser bundle. Not a package export.
import type { UIRouter } from '@uirouter/core';

import { requestRouter } from './context.js';

/** The per-render router. A plain module slot, never an async context. */
let currentRouter: UIRouter | undefined;

/**
 * The router the innermost enclosing `withServerRouter` call set.
 *
 * @internal
 */
export const getServerRouter = (): UIRouter | undefined => currentRouter;

/**
 * Publishes `router` in the slot, or clears it with `undefined`.
 *
 * @internal
 */
export const setServerRouter = (router: UIRouter | undefined): void => {
  currentRouter = router;
};

/**
 * The router a server render offers: the slot first, then the
 * `context-request` provider on `@lit-labs/ssr`'s root event target.
 *
 * Both are `undefined` in a browser — there is no slot to set and no
 * `litServerRoot` — so a client directive falls through to its element seek.
 *
 * @internal
 */
export const seekServerRouter = (): UIRouter | undefined => {
  if (currentRouter) return currentRouter;
  const root = (globalThis as { litServerRoot?: EventTarget }).litServerRoot;
  return root ? requestRouter(root) : undefined;
};

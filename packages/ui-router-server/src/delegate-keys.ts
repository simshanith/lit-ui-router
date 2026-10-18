// The delegate keys each createServerRouter router names, shared by index.ts and the adapters; no package entry exports it.

import type { ServerRouter } from './index.ts';

const declaredKeys = new WeakMap<ServerRouter, ReadonlySet<string>>();

/**
 * Records the delegate keys a new router's states name.
 *
 * @internal
 */
export function registerDelegateKeys(
  router: ServerRouter,
  keys: ReadonlySet<string>,
): void {
  declaredKeys.set(router, keys);
}

/**
 * The delegate keys a router's states name, for an adapter's construction-time
 * check. Undefined for a router `createServerRouter` did not build.
 *
 * @internal
 */
export function delegateKeysOf(
  router: ServerRouter,
): ReadonlySet<string> | undefined {
  return declaredKeys.get(router);
}

// What each createServerRouter router delegates, shared by index.ts and the adapters; no package entry exports it.

import type { ServerRouter, Verdict } from './index.ts';

/**
 * A WeakMap stored on `globalThis` under `Symbol.for(name)`, so duplicate
 * copies of the package share one store.
 *
 * @internal
 */
export function sharedWeakMap<K extends object, V>(
  name: string,
): WeakMap<K, V> {
  // SAFETY: the symbol is registered only by this function, always with a WeakMap.
  const store = globalThis as typeof globalThis &
    Partial<Record<symbol, WeakMap<K, V>>>;

  const key = Symbol.for(name);

  return (store[key] ??= new WeakMap<K, V>());
}

/**
 * The delegate keys and response states a router's states name, and its
 * matcher for those marked states.
 *
 * @internal
 */
export interface DelegateRegistration {
  /** Every key the router's states name. */
  readonly keys: ReadonlySet<string>;
  /** Every response state's name. */
  readonly responses: ReadonlySet<string>;
  /** The delegate or response verdict for a pathname or url, or null; url matching only, never a transition. */
  markedFor(
    pathnameOrUrl: string,
  ): Promise<Extract<Verdict, { kind: 'delegate' | 'response' }> | null>;
}

const registrations = sharedWeakMap<ServerRouter, DelegateRegistration>(
  'ui-router-server/delegate-keys',
);

/**
 * Records what a new router delegates.
 *
 * @internal
 */
export function registerDelegates(
  router: ServerRouter,
  registration: DelegateRegistration,
): void {
  registrations.set(router, registration);
}

/**
 * What a router delegates, for an adapter's construction-time check and its
 * non-navigation requests. Undefined for a router `createServerRouter` did not build.
 *
 * @internal
 */
export function registeredDelegates(
  router: ServerRouter,
): DelegateRegistration | undefined {
  return registrations.get(router);
}

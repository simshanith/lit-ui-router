import { Effect, SubscriptionRef } from 'effect';
import { UIRouter } from '@uirouter/core';

import { RouteSnapshot, snapshotRoute } from './shared/route-snapshot.js';

const routeRefs = new WeakMap<
  UIRouter,
  SubscriptionRef.SubscriptionRef<RouteSnapshot>
>();

/**
 * The route ref for a router — one per router instance, attached lazily.
 *
 * No plugin and no router-configuration wiring: the first caller creates the
 * ref and registers the single `onSuccess` hook that feeds it, and both live
 * as long as the router does. `onSuccess` is the only hook a later transition
 * cannot supersede, so every value the ref ever holds is a settled route.
 */
export function routeRef(
  router: UIRouter,
): SubscriptionRef.SubscriptionRef<RouteSnapshot> {
  const existing = routeRefs.get(router);

  if (existing) return existing;
  const ref = Effect.runSync(SubscriptionRef.make(snapshotRoute(router)));
  routeRefs.set(router, ref);
  router.transitionService.onSuccess({}, (transition) => {
    Effect.runSync(SubscriptionRef.set(ref, snapshotRoute(router, transition)));
  });

  return ref;
}

import { Effect, SubscriptionRef } from 'effect';
import { Transition, UIRouter } from '@uirouter/core';

import { trackTransitionStatus } from '@repo/transition-status';

const pendingRefs = new WeakMap<
  UIRouter,
  SubscriptionRef.SubscriptionRef<Transition | undefined>
>();

/**
 * The pending-transition ref for a router — one per router instance,
 * attached lazily.
 *
 * It holds the newest transition still in flight, and `undefined` when none
 * is. The first caller creates the ref and registers the single `onStart`
 * hook that feeds it; the transition's promise clears it when that
 * transition settles, whether it succeeds, errors or is aborted, unless a
 * newer one has started. A transition already running on first use counts
 * as pending. Kept out of `RouteSnapshot`, whose every value is a settled
 * route.
 */
export function pendingRef(
  router: UIRouter,
): SubscriptionRef.SubscriptionRef<Transition | undefined> {
  const existing = pendingRefs.get(router);

  if (existing) return existing;

  const ref = Effect.runSync(
    SubscriptionRef.make<Transition | undefined>(undefined),
  );

  pendingRefs.set(router, ref);
  trackTransitionStatus(router, ({ pending }) => {
    Effect.runSync(SubscriptionRef.set(ref, pending));
  });

  return ref;
}

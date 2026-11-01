import { Effect, SubscriptionRef } from 'effect';
import { Rejection, Transition, UIRouter } from '@uirouter/core';

import { trackTransitionStatus } from '@repo/transition-status';

interface TransitionRefs {
  readonly pending: SubscriptionRef.SubscriptionRef<Transition | undefined>;
  readonly error: SubscriptionRef.SubscriptionRef<Rejection | undefined>;
}

const transitionRefs = new WeakMap<UIRouter, TransitionRefs>();

/** Both refs for a router, fed by one `onStart` hook registered on first use. */
function refsFor(router: UIRouter): TransitionRefs {
  const existing = transitionRefs.get(router);

  if (existing) return existing;

  const refs: TransitionRefs = {
    pending: Effect.runSync(
      SubscriptionRef.make<Transition | undefined>(undefined),
    ),
    error: Effect.runSync(
      SubscriptionRef.make<Rejection | undefined>(undefined),
    ),
  };

  let error: Rejection | undefined;

  const setError = (next: Rejection | undefined): void => {
    if (next === error) return;
    error = next;
    Effect.runSync(SubscriptionRef.set(refs.error, next));
  };

  transitionRefs.set(router, refs);
  // `pending` is set before `error` clears, and `error` before `pending` clears, so no read between the two looks idle.
  trackTransitionStatus(router, (status) => {
    if (status.pending) {
      Effect.runSync(SubscriptionRef.set(refs.pending, status.pending));
      setError(status.error);
    } else {
      setError(status.error);
      Effect.runSync(SubscriptionRef.set(refs.pending, undefined));
    }
  });

  return refs;
}

/**
 * The pending-transition ref for a router — one per router instance,
 * attached lazily.
 *
 * It holds the newest transition still in flight, and `undefined` when none
 * is. The first caller of this or {@link errorRef} creates both refs and
 * registers the single `onStart` hook that feeds them; the transition's
 * promise clears it when that transition settles, whether it succeeds,
 * errors or is aborted, unless a newer one has started. A transition already
 * running on first use counts as pending. Kept out of `RouteSnapshot`, whose
 * every value is a settled route.
 */
export function pendingRef(
  router: UIRouter,
): SubscriptionRef.SubscriptionRef<Transition | undefined> {
  return refsFor(router).pending;
}

/**
 * The failed-transition ref for a router — one per router instance,
 * attached lazily, sharing {@link pendingRef}'s `onStart` hook.
 *
 * It holds the newest transition's failure as core's `Rejection`, and
 * `undefined` otherwise. Only a `RejectType.ERROR` rejection, such as a
 * resolve that throws, sets it; superseded, redirected, aborted and ignored
 * transitions leave it `undefined`, as does a success. The next transition
 * clears it as it starts, and a superseded transition that fails late never
 * sets it. Kept out of `RouteSnapshot`.
 */
export function errorRef(
  router: UIRouter,
): SubscriptionRef.SubscriptionRef<Rejection | undefined> {
  return refsFor(router).error;
}

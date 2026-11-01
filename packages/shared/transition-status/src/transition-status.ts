import { Rejection, RejectType, Transition, UIRouter } from '@uirouter/core';

/** The router's newest transition: in flight, or how it last failed. */
export interface TransitionStatus {
  /** The newest transition still in flight; `undefined` when none is. */
  readonly pending: Transition | undefined;
  /**
   * The newest transition's `RejectType.ERROR` rejection; `undefined` while
   * one is in flight, after a success, and after any other rejection.
   */
  readonly error: Rejection | undefined;
}

/**
 * Mirrors the status of the router's newest transition into `set`, one
 * whole {@link TransitionStatus} per change: `{ pending: transition }` when
 * it starts, then `{ pending: undefined, error }` once it settles, however it
 * settles. `error` is the transition's `error()` only for a
 * `RejectType.ERROR` rejection; superseded, redirected, aborted and ignored
 * transitions leave it `undefined`. Invalid transitions are rejected before
 * `onStart`, so they never reach the tracker.
 *
 * `onStart` records each transition as the newest. Its promise settles the
 * status only while it is still the newest, so a superseded transition never
 * clears or fails its successor. `onFinish` would miss failures: it never
 * fires for a transition that errors or is aborted.
 *
 * A transition already running when this attaches is picked up too, so a
 * mirror created mid-navigation reads it as pending.
 *
 * @returns the `onStart` hook's deregistration function. A transition
 * already pending still settles when it does.
 */
export function trackTransitionStatus(
  router: UIRouter,
  set: (status: TransitionStatus) => void,
): () => void {
  let newest: Transition | undefined;

  const start = (transition: Transition): void => {
    newest = transition;
    set({ pending: transition, error: undefined });

    const settle = (): void => {
      if (newest !== transition) return;
      newest = undefined;
      // SAFETY: `error()` is undefined after a success; core types it as `Rejection`.
      const error = transition.error() as Rejection | undefined;
      set({
        pending: undefined,
        error: error?.type === RejectType.ERROR ? error : undefined,
      });
    };

    // Handled here, the rejection still reaches the transition's own callers and onError hooks.
    void transition.promise.then(settle, settle);
  };

  const running = router.globals.transition;

  // SAFETY: `success` stays undefined until the transition settles; core types it as `boolean`.
  if (running && (running.success as boolean | undefined) === undefined) {
    start(running);
  }

  // SAFETY: `onStart` returns its deregistration function, typed only as `Function`.
  return router.transitionService.onStart({}, start) as () => void;
}

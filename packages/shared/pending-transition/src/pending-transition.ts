import { Transition, UIRouter } from '@uirouter/core';

/**
 * Mirrors the router's newest in-flight transition into `set`: the
 * transition when it starts, `undefined` once it settles, however it
 * settles.
 *
 * `onStart` records each transition as the newest. Its promise clears the
 * value only while it is still the newest, so a superseded transition never
 * clears its successor. `onFinish` would miss failures: it never fires for a
 * transition that errors or is aborted.
 *
 * A transition already running when this attaches is picked up too, so a
 * mirror created mid-navigation reads it as pending.
 *
 * @returns the `onStart` hook's deregistration function. A transition
 * already pending still clears when it settles.
 */
export function trackPending(
  router: UIRouter,
  set: (transition: Transition | undefined) => void,
): () => void {
  let newest: Transition | undefined;

  const start = (transition: Transition): void => {
    newest = transition;
    set(transition);
    transition.promise
      .finally(() => {
        if (newest !== transition) return;
        newest = undefined;
        set(undefined);
      })
      // The rejection belongs to the transition's own callers and onError hooks.
      .catch(() => {});
  };

  const running = router.globals.transition;

  // SAFETY: `success` stays undefined until the transition settles; core types it as `boolean`.
  if (running && (running.success as boolean | undefined) === undefined) {
    start(running);
  }

  // SAFETY: `onStart` returns its deregistration function, typed only as `Function`.
  return router.transitionService.onStart({}, start) as () => void;
}

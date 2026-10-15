/**
 * A per-mount pool of headless routers for the simulate tier. Each router is
 * checked out by at most one request at a time, so concurrent requests never
 * share one; release restores a fresh router's globals before reuse.
 *
 * Type-only core imports: index.ts imports this statically, and matcher-only
 * configs must never load @uirouter/core.
 */

import type { UIRouter } from '@uirouter/core';

// Idle routers kept per mount; a burst past it builds extras and drops them.
const POOL_MAX_IDLE = 16;

/**
 * A checked-out router: one request owns it until {@link PooledRouter.release}.
 *
 * @internal
 */
export interface PooledRouter {
  /** The headless router. */
  readonly router: UIRouter;
  /**
   * Resolves once the next transition settles: true on success, false on a
   * real failure. Redirected rejections hand off to their successor.
   */
  nextSettled(): Promise<boolean>;
  /**
   * Returns the router to the pool, reset. A router still mid-transition,
   * one whose transition failed, or one past the idle cap is dropped instead.
   */
  release(): void;
}

/**
 * One mount's idle routers.
 *
 * @internal
 */
export interface RouterPool {
  /** An idle router, or a new one from `build` when none is idle. */
  checkOut(build: () => UIRouter): PooledRouter;
}

// Restores the globals the UIRouter constructor leaves: the url-rule handler and transitionTo read them.
const reset = (router: UIRouter): void => {
  const { globals, stateRegistry } = router;
  globals.transitionHistory.clear();
  globals.successfulTransitions.clear();
  globals.$current = stateRegistry.root();
  globals.current = globals.$current.self;

  for (const key of Object.keys(globals.params)) delete globals.params[key];
};

const pooledRouter = (router: UIRouter, idle: PooledRouter[]): PooledRouter => {
  let settle: ((succeeded: boolean) => void) | null = null;
  let failed = false;

  // onceSettled's outcome, hooked once: per-request hooks would pile up on a reused router.
  router.transitionService.onSuccess({}, () => settle?.(true));
  router.transitionService.onError({}, (transition) => {
    if (transition.error().redirected) return;

    failed = true;
    settle?.(false);
  });

  const pooled: PooledRouter = {
    router,
    nextSettled: () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
    release() {
      settle = null;

      if (failed || router.globals.transition || idle.length >= POOL_MAX_IDLE)
        return;

      reset(router);
      idle.push(pooled);
    },
  };

  return pooled;
};

/**
 * A lazily grown pool, empty until the first check-out.
 *
 * @internal
 */
export function createRouterPool(): RouterPool {
  const idle: PooledRouter[] = [];

  return {
    checkOut: (build) => idle.pop() ?? pooledRouter(build(), idle),
  };
}

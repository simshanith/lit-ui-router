/**
 * A per-mount pool of headless routers for the simulate tier. Each router is
 * checked out by at most one request at a time, so concurrent requests never
 * share one; release restores a fresh router's globals before reuse.
 *
 * Type-only core imports: the root entry reaches this statically through
 * simulate-tier.ts, and matcher-only configs must never load @uirouter/core.
 */

import { resetRouter } from '@repo/router-reset';
import type { UIRouter } from '@uirouter/core';

import { POOL_MAX_IDLE } from './server-router.ts';

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
  /** Builds idle routers until `count` (at most the idle cap) sit idle; a throwing `build` stops it. */
  warm(build: () => UIRouter, count: number): void;
}

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

      resetRouter(router);
      idle.push(pooled);
    },
  };

  return pooled;
};

/**
 * A lazily grown pool, empty until the first check-out or warm.
 *
 * @internal
 */
export function createRouterPool(): RouterPool {
  const idle: PooledRouter[] = [];

  return {
    checkOut: (build) => idle.pop() ?? pooledRouter(build(), idle),
    warm(build, count) {
      while (idle.length < Math.min(count, POOL_MAX_IDLE))
        idle.push(pooledRouter(build(), idle));
    },
  };
}

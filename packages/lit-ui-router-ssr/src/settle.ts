// Drives a server router's url sync to a landed transition, since `start()` and `urlService.sync()` drop the promise.
import { RejectType } from '@uirouter/core';
import type {
  RawParams,
  Rejection,
  StateRule,
  Transition,
  UIRouter,
} from '@uirouter/core';

/** Options for {@link settle | `settle`}. */
export interface SettleOptions {
  /**
   * How long to wait for the transition to land, in milliseconds, before
   * rejecting. Defaults to `10_000`; `0` or `Infinity` waits without a limit.
   */
  timeout?: number;
}

// Bounds a chain of url rules that rewrite the url to another url.
const maxRewrites = 10;

/**
 * Moves `router` to `path` and resolves once the transition the url starts
 * has landed, resolves included, so a synchronous render reads the router
 * after it.
 *
 * It never calls `router.start()`, which runs once per router: it sets the
 * url and syncs the router to it, whether or not the router is listening.
 * A page loop calls it once per path on the same router. A `redirectTo`
 * chain settles on its final state, and a path the router already stands on
 * resolves with the transition that brought it there.
 *
 * A failed transition still reaches `stateService.defaultErrorHandler`,
 * which logs it unless replaced.
 *
 * @param router - the server router, its location installed with `installServerLocation`
 * @param path - the url to settle on, relative to the mount, query included
 * @param options - how long to wait
 * @returns the transition that landed
 * @throws an `Error` when no url rule matches `path` and the router declares no `otherwise`
 * @throws the transition's `Rejection` when it fails, a failed resolve's error in its `detail`
 * @throws an `Error` when nothing lands within {@link SettleOptions.timeout | `timeout`}
 *
 * @example
 * ```ts
 * import { prerender, settle } from 'lit-ui-router-ssr';
 *
 * await prerender({
 *   mounts,
 *   router,
 *   outDir: 'dist',
 *   paths: ['/', '/sheet/7B'],
 *   renderShell: async (verdict, { path }) => {
 *     await settle(router, path);
 *     return page();
 *   },
 * });
 * ```
 */
export const settle = (
  router: UIRouter,
  path: string,
  options: SettleOptions = {},
): Promise<Transition> => {
  const { timeout = 10_000 } = options;
  const { globals, stateService, transitionService, urlService } = router;
  return new Promise<Transition>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done = (): void => {
      offSuccess();
      offError();
      clearTimeout(timer);
    };
    const land = (transition: Transition): void => {
      done();
      resolve(transition);
    };
    const fail = (reason: Error | Rejection): void => {
      done();
      // eslint-disable-next-line typescript/prefer-promise-reject-errors -- a failed transition rejects with core's Rejection, as transitionTo() does
      reject(reason);
    };
    const offSuccess = transitionService.onSuccess({}, land) as () => void;
    const offError = transitionService.onError({}, (transition) => {
      const rejection = transition.error();
      if (rejection.type === RejectType.SUPERSEDED) return;
      if (rejection.type === RejectType.IGNORED) {
        // Ignored with nothing in flight: the router already stands where the url points.
        if (!globals.transition && globals.successfulTransitions.size() > 0)
          land(globals.successfulTransitions.peekTail());
        return;
      }
      fail(rejection);
    }) as () => void;
    if (timeout > 0 && timeout !== Infinity)
      timer = setTimeout(
        () =>
          fail(new Error(`settle: ${path} did not land within ${timeout}ms`)),
        timeout,
      );

    urlService.url(path);
    for (let rewrites = 0; rewrites <= maxRewrites; rewrites++) {
      const best = urlService.match({
        path: urlService.path(),
        search: urlService.search(),
        hash: urlService.hash(),
      });
      if (!best)
        return fail(
          new Error(
            `settle: no url rule matches ${urlService.url()} and the router declares no otherwise`,
          ),
        );
      // Core's state rule starts nothing when the url's href is the current one.
      if (
        best.rule.type === 'STATE' &&
        globals.successfulTransitions.size() > 0 &&
        stateService.href(
          (best.rule as StateRule).state,
          best.match as RawParams,
        ) === stateService.href(globals.current, globals.params)
      )
        return land(globals.successfulTransitions.peekTail());
      const before = urlService.url();
      urlService.sync();
      // A rule that rewrote the url to another url needs its own sync when the router is not listening.
      if (urlService.url() === before) return;
    }
    fail(
      new Error(
        `settle: ${path} rewrote its url more than ${maxRewrites} times`,
      ),
    );
  });
};

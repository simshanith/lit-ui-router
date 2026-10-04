import { SubscriptionRef } from 'effect';
import { ReactiveControllerHost } from 'lit';
import { UIRouter } from '@uirouter/core';
import { getScopedRouter } from 'lit-ui-router/context';
import { UIRouterLitElement } from 'lit-ui-router/pure';

import { warnMissingRouter } from './dev-warn.js';
import { RefController, RefControllerOptions } from './ref-controller.js';
import { routeRef, RouteSnapshot } from './route-ref.js';

/** Options for {@link RouterRefController}. */
export interface RouterRefControllerOptions<T> extends RefControllerOptions<T> {
  /**
   * Explicit router instance, or a thunk returning one. When omitted (or the
   * thunk returns `undefined`), the controller takes the router an enclosing
   * [`withRouterSync`](https://lit-ui-router.dev/api/reference/core/withRouterSync)
   * scoped at construction (a server render), and otherwise discovers the
   * router from the nearest enclosing `<ui-router>` element on
   * `hostConnected` (via
   * [UIRouterLitElement.seekRouter](https://lit-ui-router.dev/api/reference/components/UIRouterLitElement#seekrouter)).
   * An explicit or scoped router is read at construction, so `.value` is live
   * before the host connects. A thunk is resolved at construction and again on
   * each `hostConnected`; a router it returns replaces the one followed, as
   * {@link RouterRefController.setRouter} does.
   *
   * A host on a page served by `lit-ui-router-ssr` must be handed its router,
   * here or through {@link RouterRefController.setRouter}: discovery binds the
   * placeholder router `<ui-router>` holds until `hydrateRoot()` sets the
   * app's.
   */
  router?: UIRouter | (() => UIRouter | undefined);
}

/**
 * A {@link RefController} preselected on the router: follows the
 * {@link routeRef} of the host's `<ui-router>` context.
 *
 * ```ts
 * class App extends LitElement {
 *   private active = new RouterRefController(
 *     this,
 *     (route) => route.includes('admin.**'),
 *   );
 *
 *   render() {
 *     return html`...${this.active.value ? 'admin' : ''}...`;
 *   }
 * }
 * ```
 *
 * Same lifecycle as the base: seeded synchronously on every (re)connect, one
 * forked fiber while connected, interrupted on disconnect. A host outside any
 * `<ui-router>` (with no explicit or scoped router) warns once in development
 * and is a no-op until it reconnects under one or is handed a router with
 * {@link RouterRefController.setRouter}; `.value` stays at
 * `options.initialValue`.
 */
export class RouterRefController<T> extends RefController<
  readonly [SubscriptionRef.SubscriptionRef<RouteSnapshot>],
  T
> {
  // Shared with the discovery thunk, which can run before this constructor's body.
  private readonly followed: { router: UIRouter | undefined };
  private readonly resolveRouter: (() => UIRouter | undefined) | undefined;

  constructor(
    host: ReactiveControllerHost & Element,
    selector: (route: RouteSnapshot) => T,
    options: RouterRefControllerOptions<T> = {},
  ) {
    const option = options.router;
    const followed = {
      router:
        (typeof option === 'function' ? option() : option) ?? getScopedRouter(),
    };
    super(
      host,
      followed.router
        ? [routeRef(followed.router)]
        : () => {
            const sought = UIRouterLitElement.seekRouter(host);
            if (!sought) {
              warnMissingRouter(
                host,
                'RouterRefController',
                'will not observe the router',
              );
              return undefined;
            }
            followed.router = sought;
            return [routeRef(sought)];
          },
      selector,
      options,
    );
    this.followed = followed;
    this.resolveRouter = typeof option === 'function' ? option : undefined;
  }

  /**
   * Follows `router` from now on. A connected host interrupts its fiber,
   * re-seeds `.value` from the new router's {@link routeRef}, re-forks, and
   * updates; a disconnected one takes the router on its next `hostConnected`.
   * The router already followed is a no-op.
   */
  setRouter(router: UIRouter): void {
    if (router === this.followed.router) return;
    this.followed.router = router;
    this.setRefs([routeRef(router)]);
  }

  override hostConnected(): void {
    // Unset while the base constructor connects an already-connected host.
    const router = this.resolveRouter?.();
    if (router) this.setRouter(router);
    super.hostConnected();
  }
}

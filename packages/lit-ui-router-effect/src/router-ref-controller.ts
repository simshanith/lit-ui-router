import { SubscriptionRef } from 'effect';
import { ReactiveControllerHost } from 'lit';
import { UIRouter } from '@uirouter/core';
import { UIRouterLitElement } from 'lit-ui-router/pure';

import { warnMissingRouter } from './dev-warn.js';
import { RefController, RefControllerOptions } from './ref-controller.js';
import { routeRef, RouteSnapshot } from './route-ref.js';

/** Options for {@link RouterRefController}. */
export interface RouterRefControllerOptions<T> extends RefControllerOptions<T> {
  /**
   * Explicit router instance. When omitted, the controller discovers the
   * router from the nearest enclosing `<ui-router>` element on
   * `hostConnected` (via
   * [UIRouterLitElement.seekRouter](https://lit-ui-router.dev/api/reference/components/UIRouterLitElement#seekrouter)).
   * Given, the route is read at construction, so `.value` is live before the
   * host connects.
   */
  router?: UIRouter;
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
 * `<ui-router>` (with no explicit `router` option) warns once in development
 * and is a no-op until it reconnects under one; `.value` stays at
 * `options.initialValue`.
 */
export class RouterRefController<T> extends RefController<
  readonly [SubscriptionRef.SubscriptionRef<RouteSnapshot>],
  T
> {
  constructor(
    host: ReactiveControllerHost & Element,
    selector: (route: RouteSnapshot) => T,
    options: RouterRefControllerOptions<T> = {},
  ) {
    super(
      host,
      options.router
        ? [routeRef(options.router)]
        : () => {
            const router = UIRouterLitElement.seekRouter(host);
            if (!router) {
              warnMissingRouter(
                host,
                'RouterRefController',
                'will not observe the router',
              );
              return undefined;
            }
            return [routeRef(router)];
          },
      selector,
      options,
    );
  }
}

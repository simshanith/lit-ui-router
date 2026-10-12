import { SubscriptionRef } from 'effect';
import { ReactiveControllerHost } from 'lit';
import { isFunction, UIRouter } from '@uirouter/core';
import { getScopedRouter, requestRouter } from 'lit-ui-router/context';
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
   * scoped at construction (a server render), and otherwise requests the
   * router from the nearest enclosing `<ui-router>` element on
   * `hostConnected` (via
   * [requestRouter](https://lit-ui-router.dev/api/reference/core/requestRouter)
   * with `subscribe: true`), and follows the router that provider hands it
   * later, such as the app's router replacing a served page's placeholder.
   * An explicit or scoped router is read at construction, so `.value` is live
   * before the host connects. A thunk is resolved at construction and again on
   * each `hostConnected`; a router it returns replaces the one followed, as
   * {@link RouterRefController.setRouter} does. An explicit router is never
   * replaced by one a provider hands over. A `lit-ui-router` that does not
   * hand subscribers the router replacing its placeholder leaves a served
   * page's host on the placeholder; hand such a host its router.
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
  private readonly followed: Followed;
  private readonly resolveRouter: (() => UIRouter | undefined) | undefined;

  constructor(
    host: ReactiveControllerHost & Element,
    selector: (route: RouteSnapshot) => T,
    options: RouterRefControllerOptions<T> = {},
  ) {
    const option = options.router;

    const followed: Followed = {
      router: (isFunction(option) ? option() : option) ?? getScopedRouter(),
    };

    const discover = (): Route | undefined => {
      const delivered = followed.delivered;
      followed.delivered = undefined;
      const sought = delivered ?? subscribe(host, followed);

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
    };

    super(
      host,
      followed.router ? [routeRef(followed.router)] : discover,
      selector,
      options,
    );
    this.followed = followed;
    this.resolveRouter = isFunction(option) ? option : undefined;
    followed.deliver = (router) => {
      if (router === followed.router) return;
      followed.delivered = router;
      this.setRefs(discover);
    };
  }

  /**
   * Follows `router` from now on. A connected host interrupts its fiber,
   * re-seeds `.value` from the new router's {@link routeRef}, re-forks, and
   * updates; a disconnected one takes the router on its next `hostConnected`.
   * The router already followed is a no-op.
   */
  setRouter(router: UIRouter): void {
    if (router === this.followed.router) return;
    unsubscribe(this.followed);
    this.followed.router = router;
    this.setRefs([routeRef(router)]);
  }

  override hostConnected(): void {
    // Unset while the base constructor connects an already-connected host.
    const router = this.resolveRouter?.();

    if (router) this.setRouter(router);
    super.hostConnected();
  }

  override hostDisconnected(): void {
    unsubscribe(this.followed);
    super.hostDisconnected();
  }
}

type Route = readonly [SubscriptionRef.SubscriptionRef<RouteSnapshot>];

/** The router a {@link RouterRefController} follows, and its discovery subscription. */
interface Followed {
  router: UIRouter | undefined;
  /** Drops the live subscription; a later answer's no-op never replaces it. */
  unsubscribe?: () => void;
  /** Rebinds to a router the provider hands over after the first answer. */
  deliver?: (router: UIRouter) => void;
  /** A handed-over router the next discovery binds instead of asking again. */
  delivered?: UIRouter;
}

function subscribe(host: Element, followed: Followed): UIRouter | undefined {
  unsubscribe(followed);
  let live = true;
  let answering = true;
  let offered: (() => void) | undefined;

  const router = requestRouter(host, {
    subscribe: true,
    callback: (next, drop) => {
      if (answering) offered ??= drop;
      else if (live && next) followed.deliver?.(next);
    },
  });

  answering = false;
  // A provider that ignores unsubscribe must not reach a dropped subscription.
  followed.unsubscribe = () => {
    live = false;
    offered?.();
  };

  return router ?? UIRouterLitElement.seekRouter(host);
}

function unsubscribe(followed: Followed): void {
  followed.unsubscribe?.();
  followed.unsubscribe = undefined;
}

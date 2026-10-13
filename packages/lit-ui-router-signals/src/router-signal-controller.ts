import { ReactiveController, ReactiveControllerHost } from 'lit';
import { isFunction, UIRouter } from '@uirouter/core';
import { getScopedRouter, requestRouter } from 'lit-ui-router/context';
import { UIRouterLitElement } from 'lit-ui-router/pure';
import { RouterSignals, watchSelection } from 'ui-router-signals';

import { warnMissingRouter } from './dev-warn.js';
import { SignalControllerOptions } from './signal-controller.js';

/** Options for {@link RouterSignalController}. */
export interface RouterSignalControllerOptions<
  T,
> extends SignalControllerOptions<T> {
  /**
   * Explicit router instance, or a thunk returning one. When omitted (or the
   * thunk returns `undefined`), the controller takes the router an enclosing
   * [`withRouterSync`](https://lit-ui-router.dev/api/reference/core/withRouterSync)
   * scoped at construction (a server render), and otherwise asks the nearest
   * router provider on `hostConnected`: over `context-request` first (via
   * [requestRouter](https://lit-ui-router.dev/api/reference/core/requestRouter)
   * with `subscribe: true`), then over the `ui-router-context` event (via
   * [UIRouterLitElement.seekRouter](https://lit-ui-router.dev/api/reference/components/UIRouterLitElement))
   * when nobody answers. A discovered router is rebound when a subscribed
   * provider hands over the router that replaces its placeholder.
   *
   * An explicit or scoped router is read at construction, so `.value` is live
   * before the host connects. A thunk is resolved at construction and again on
   * each `hostConnected`; a router it returns replaces the one followed, as
   * {@link RouterSignalController.setRouter} does. An explicit router is never
   * replaced by one a provider hands over.
   */
  router?: UIRouter | (() => UIRouter | undefined);
}

/**
 * A {@link SignalController} preselected on the router: watches the
 * {@link RouterSignals} of the router the host's nearest provider supplies.
 *
 * Router discovery matches `lit-ui-router-effect`'s `RouterRefController`:
 * `<ui-router>`, `<ui-view>`, a `@lit/context` `ContextProvider` of
 * `routerContext` and `provideRouter` all answer, and
 * {@link RouterSignals.for} attaches lazily on first use:
 *
 * ```ts
 * class App extends LitElement {
 *   private active = new RouterSignalController(
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
 * If no provider answers (and no explicit or scoped router is given), the
 * controller warns once in development and is a no-op until it reconnects
 * under one or is handed a router with
 * {@link RouterSignalController.setRouter}; `.value` stays at
 * `options.initialValue`.
 */
export class RouterSignalController<T> implements ReactiveController {
  /** The selected value, for use in `render()`. */
  value: T;

  /** The watched router signals; set once a router is known. */
  signals?: RouterSignals;

  /** A router given directly; discovery is skipped while one is set. */
  private pinned?: UIRouter;

  /** The router whose signals the controller reads. */
  private followed?: UIRouter;

  private connected = false;

  private unwatch?: () => void;

  private unsubscribe?: () => void;

  private readonly resolveRouter?: () => UIRouter | undefined;

  constructor(
    private readonly host: ReactiveControllerHost & Element,
    private readonly selector: (route: RouterSignals) => T,
    private readonly options: RouterSignalControllerOptions<T> = {},
  ) {
    const option = options.router;

    if (isFunction(option)) this.resolveRouter = option;
    this.pinned = (isFunction(option) ? option() : option) ?? getScopedRouter();

    if (this.pinned) {
      this.followed = this.pinned;
      this.signals = RouterSignals.for(this.pinned);
      this.value = selector(this.signals);
    } else {
      // SAFETY: undefined unless `initialValue` is given, the pre-connect shape either way; `.value` stays `T` for render code.
      this.value = options.initialValue as T;
    }

    host.addController(this);
  }

  /**
   * Follows `router` from now on, without asking a provider again. A
   * connected host re-reads `.value` from the new router's
   * {@link RouterSignals} and updates; a disconnected one takes the router
   * on its next `hostConnected`. The router already followed is a no-op.
   */
  setRouter(router: UIRouter): void {
    if (router === this.followed) return;
    this.dropSubscription();
    this.pinned = this.followed = router;

    if (!this.connected) return;
    this.unwatch?.();
    this.watch(router);
  }

  hostConnected(): void {
    this.connected = true;
    const resolved = this.resolveRouter?.();

    if (resolved) this.pinned = resolved;
    const router = this.pinned ?? this.seekRouter();

    if (!router) {
      warnMissingRouter(
        this.host,
        'RouterSignalController',
        'will not watch the router',
      );

      return;
    }

    this.watch(router);
  }

  hostDisconnected(): void {
    this.connected = false;
    this.dropSubscription();
    this.unwatch?.();
    this.unwatch = undefined;
  }

  private seekRouter(): UIRouter | undefined {
    let live = true;
    let seeking = true;
    let offered: (() => void) | undefined;

    const router = requestRouter(this.host, {
      subscribe: true,
      callback: (next, unsubscribe) => {
        if (seeking) {
          offered ??= unsubscribe;
        } else if (live && next !== this.followed) {
          this.unwatch?.();
          this.watch(next);
        }
      },
    });

    seeking = false;
    // A provider that ignores unsubscribe must not reach a dropped subscription.
    this.unsubscribe = () => {
      live = false;
      offered?.();
    };

    return router ?? UIRouterLitElement.seekRouter(this.host);
  }

  private dropSubscription(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private watch(router: UIRouter): void {
    this.followed = router;
    const signals = (this.signals = RouterSignals.for(router));
    this.unwatch = watchSelection(
      () => this.selector(signals),
      this.options.equals,
      (value) => {
        this.value = value;
        this.options.onChange?.(value);
        this.host.requestUpdate();
      },
    );
  }
}

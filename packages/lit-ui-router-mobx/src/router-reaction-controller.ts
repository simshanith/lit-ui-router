import { ReactiveController, ReactiveControllerHost } from 'lit';
import { IReactionDisposer, reaction } from 'mobx';
import { UIRouter } from '@uirouter/core';
import { requestRouter } from 'lit-ui-router/context';
import { UIRouterLitElement } from 'lit-ui-router/pure';

import { warnMissingRouter } from './dev-warn.js';
import { RouterStore } from './router-store.js';
import { ReactionControllerOptions } from './reaction-controller.js';

/** Options for {@link RouterReactionController}. */
export interface RouterReactionControllerOptions<
  T,
> extends ReactionControllerOptions<T> {
  /**
   * Explicit router instance. When omitted, the controller asks the nearest
   * router provider on `hostConnected`: over `context-request` first (via
   * [requestRouter](https://lit-ui-router.dev/api/reference/core/requestRouter)
   * with `subscribe: true`), then over the `ui-router-context` event (via
   * [UIRouterLitElement.seekRouter](https://lit-ui-router.dev/api/reference/components/UIRouterLitElement))
   * when nobody answers. It rebinds when a subscribed provider hands it the
   * router that replaces its placeholder.
   */
  router?: UIRouter;
}

/**
 * A {@link ReactionController} preselected on the router: observes the
 * {@link RouterStore} of the router the host's nearest provider supplies.
 *
 * On `hostConnected` it requests the router over the `context-request`
 * protocol, falling back to the `ui-router-context` event, so `<ui-router>`,
 * `<ui-view>`, a `@lit/context` `ContextProvider` of `routerContext` and
 * `provideRouter` all answer. There is no prop drilling and no store wiring in
 * router configuration: {@link RouterStore.for} attaches lazily on first use.
 * It then runs a MobX `reaction` over the selector while the host is
 * connected. When the provider hands it a new router, it rebinds to that
 * router's store:
 *
 * ```ts
 * class App extends LitElement {
 *   private active = new RouterReactionController(
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
 * The reaction fires immediately on every (re)connect, so sticky routed
 * components resynchronize with the current route instead of rendering
 * stale values. If no provider answers (and no explicit `router` option is
 * given), the controller is a no-op until reconnected under one.
 */
export class RouterReactionController<T> implements ReactiveController {
  /** The selected value, for use in `render()`. */
  value: T;

  /** The observed store; set while connected to a router context. */
  store?: RouterStore;

  private dispose?: IReactionDisposer;

  private unsubscribe?: () => void;

  constructor(
    private readonly host: ReactiveControllerHost & Element,
    private readonly selector: (store: RouterStore) => T,
    private readonly options: RouterReactionControllerOptions<T> = {},
  ) {
    // SAFETY: undefined unless `initialValue` is given, the pre-connect shape either way; `.value` stays `T` for render code.
    this.value = options.initialValue as T;
    host.addController(this);
  }

  hostConnected(): void {
    const router = this.options.router ?? this.seekRouter();

    if (!router) {
      warnMissingRouter(
        this.host,
        'RouterReactionController',
        'will not observe the router',
      );

      return;
    }

    this.react(router);
  }

  hostDisconnected(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.dispose?.();
    this.dispose = undefined;
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
        } else if (live) {
          this.dispose?.();
          this.react(next);
        }
      },
    });

    seeking = false;
    // A provider that ignores unsubscribe must not reach a disconnected host.
    this.unsubscribe = () => {
      live = false;
      offered?.();
    };

    return router ?? UIRouterLitElement.seekRouter(this.host);
  }

  private react(router: UIRouter): void {
    const store = (this.store = RouterStore.for(router));
    this.dispose = reaction(
      () => this.selector(store),
      (value) => {
        this.value = value;
        this.options.onChange?.(value);
        this.host.requestUpdate();
      },
      { fireImmediately: true, equals: this.options.equals },
    );
  }
}

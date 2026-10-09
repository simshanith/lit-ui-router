import { ReactiveController, ReactiveControllerHost } from 'lit';
import { UIRouter } from '@uirouter/core';
import { requestRouter } from 'lit-ui-router/context';
import { UIRouterLitElement } from 'lit-ui-router/pure';

import { warnMissingRouter } from './dev-warn.js';
import { RouterSignals } from './router-signals.js';
import { SignalControllerOptions } from './signal-controller.js';
import { watchSelection } from './watch.js';

/** Options for {@link RouterSignalController}. */
export interface RouterSignalControllerOptions<
  T,
> extends SignalControllerOptions<T> {
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
 * A {@link SignalController} preselected on the router: watches the
 * {@link RouterSignals} of the router the host's nearest provider supplies.
 *
 * Router discovery matches `lit-ui-router-mobx`'s `RouterReactionController`:
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
 * If no provider answers (and no explicit `router` option is given), the
 * controller is a no-op until reconnected under one.
 */
export class RouterSignalController<T> implements ReactiveController {
  /** The selected value, for use in `render()`. */
  value: T;

  /** The watched router signals; set while connected to a router context. */
  signals?: RouterSignals;

  private unwatch?: () => void;

  private unsubscribe?: () => void;

  constructor(
    private readonly host: ReactiveControllerHost & Element,
    private readonly selector: (route: RouterSignals) => T,
    private readonly options: RouterSignalControllerOptions<T> = {},
  ) {
    // Undefined unless `initialValue` is given, which is the pre-connect
    // shape either way; the cast keeps `.value` typed `T` for render code.
    this.value = options.initialValue as T;
    host.addController(this);
  }

  hostConnected(): void {
    const router = this.options.router ?? this.seekRouter();
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
    this.unsubscribe?.();
    this.unsubscribe = undefined;
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
        } else if (live) {
          this.unwatch?.();
          this.watch(next);
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

  private watch(router: UIRouter): void {
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

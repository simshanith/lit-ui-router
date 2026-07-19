import { ReactiveController, ReactiveControllerHost } from 'lit';
import { IReactionDisposer, reaction } from 'mobx';
import { UIRouter } from '@uirouter/core';
import { UIRouterLitElement } from 'lit-ui-router';

import { RouterStore } from './router-store.js';
import { ReactionControllerOptions } from './reaction-controller.js';

export interface RouterReactionControllerOptions<
  T,
> extends ReactionControllerOptions<T> {
  /**
   * Explicit router instance. When omitted, the controller discovers the
   * router from the nearest enclosing `<ui-router>` element on
   * `hostConnected` (via
   * [UIRouterLitElement.seekRouter](https://lit-ui-router.dev/api/reference/components/UIRouterLitElement#seekrouter)).
   */
  router?: UIRouter;
}

/**
 * A {@link ReactionController} preselected on the router: observes the
 * {@link RouterStore} of the host's `<ui-router>` context.
 *
 * On `hostConnected` it discovers the router through the
 * `ui-router-context` event (no prop drilling, no store wiring in router
 * configuration — {@link RouterStore.for} attaches lazily on first use), then
 * runs a MobX `reaction` over the selector while the host is connected:
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
 * stale values. If the host is not inside a `<ui-router>` (and no explicit
 * `router` option is given), the controller is a no-op until reconnected
 * under one.
 */
export class RouterReactionController<T> implements ReactiveController {
  /** The selected value, for use in `render()`. */
  value!: T;

  /** The observed store; set while connected to a router context. */
  store?: RouterStore;

  private dispose?: IReactionDisposer;

  constructor(
    private readonly host: ReactiveControllerHost & Element,
    private readonly selector: (store: RouterStore) => T,
    private readonly options: RouterReactionControllerOptions<T> = {},
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    const router =
      this.options.router ?? UIRouterLitElement.seekRouter(this.host);
    if (!router) {
      console.warn(
        'RouterReactionController: no <ui-router> context found for host',
        this.host,
      );
      return;
    }
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

  hostDisconnected(): void {
    this.dispose?.();
    this.dispose = undefined;
  }
}

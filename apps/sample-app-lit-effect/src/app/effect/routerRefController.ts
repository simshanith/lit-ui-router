import { Effect, Fiber, Stream, SubscriptionRef } from 'effect';
import { ReactiveController, ReactiveControllerHost } from 'lit';
import { RawParams, StateOrName, UIRouter } from '@uirouter/core';
import { UIRouterLitElement } from 'lit-ui-router';

import { RefControllerOptions } from './refController.js';
import { runtime } from './runtime.js';

/** The router's current state, as a value a `SubscriptionRef` can hold. */
export interface RouteSnapshot {
  /** The current state's name (`globals.current.name`). */
  name: string | undefined;

  /** The current parameter values, snapshotted per transition. */
  params: RawParams;

  /**
   * `StateService.includes`: is the state (or glob pattern, e.g.
   * `'admin.**'`) included in the current active state? Reads through to the
   * router — the snapshot fixes *when* it is asked, not what it asks.
   */
  includes(stateOrName: StateOrName, params?: RawParams): boolean;
}

export interface RouterRefControllerOptions<T> extends RefControllerOptions<T> {
  /**
   * Explicit router instance. When omitted, the controller discovers the
   * router from the nearest enclosing `<ui-router>` on `hostConnected`.
   */
  router?: UIRouter;
}

const routeRefs = new WeakMap<
  UIRouter,
  SubscriptionRef.SubscriptionRef<RouteSnapshot>
>();

const snapshot = (router: UIRouter): RouteSnapshot => ({
  name: router.globals.current.name,
  // eslint-disable-next-line typescript/no-misused-spread -- snapshot StateParams' own props as a fresh plain object per transition
  params: { ...router.globals.params },
  includes: (stateOrName, params) =>
    router.stateService.includes(stateOrName, params),
});

/**
 * The route ref for a router — one per router instance, attached lazily.
 *
 * No plugin and no router-configuration wiring: the first caller creates the
 * ref and registers the single `onSuccess` hook that feeds it, and both live
 * as long as the router does.
 */
export function routeRef(
  router: UIRouter,
): SubscriptionRef.SubscriptionRef<RouteSnapshot> {
  const existing = routeRefs.get(router);
  if (existing) return existing;
  const ref = runtime.runSync(SubscriptionRef.make(snapshot(router)));
  routeRefs.set(router, ref);
  // onSuccess is the only hook a later transition cannot supersede.
  router.transitionService.onSuccess({}, () => {
    runtime.runSync(SubscriptionRef.set(ref, snapshot(router)));
  });
  return ref;
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
 * }
 * ```
 *
 * The router is discovered on `hostConnected`, so the ref cannot be handed to
 * a {@link RefController} at construction — hence the near-duplicate
 * subscription here. Same lifecycle otherwise: seeded synchronously on every
 * (re)connect, one forked fiber while connected, interrupted on disconnect.
 * A host outside any `<ui-router>` (with no explicit `router` option) is a
 * no-op until it reconnects under one.
 */
export class RouterRefController<T> implements ReactiveController {
  /** The selected value, for use in `render()`. */
  value!: T;

  private fiber?: Fiber.RuntimeFiber<void>;
  private initialized = false;

  constructor(
    private readonly host: ReactiveControllerHost & Element,
    private readonly selector: (route: RouteSnapshot) => T,
    private readonly options: RouterRefControllerOptions<T> = {},
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    const router =
      this.options.router ?? UIRouterLitElement.seekRouter(this.host);
    if (!router) {
      console.warn(
        'RouterRefController: no <ui-router> found for',
        this.host,
        '— it will not observe the router',
      );
      return;
    }
    const ref = routeRef(router);
    this.emit(runtime.runSync(SubscriptionRef.get(ref)));
    this.fiber = runtime.runFork(
      Stream.runForEach(ref.changes, (route) =>
        Effect.sync(() => this.emit(route)),
      ),
    );
  }

  hostDisconnected(): void {
    if (this.fiber) runtime.runFork(Fiber.interrupt(this.fiber));
    this.fiber = undefined;
    this.initialized = false;
  }

  private emit(route: RouteSnapshot): void {
    const selected = this.selector(route);
    const equals = this.options.equals ?? Object.is;
    if (this.initialized && equals(selected, this.value)) return;
    this.initialized = true;
    this.value = selected;
    this.options.onChange?.(selected);
    this.host.requestUpdate();
  }
}

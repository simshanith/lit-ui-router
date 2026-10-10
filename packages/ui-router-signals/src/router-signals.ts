import { Signal } from 'signal-polyfill';
import {
  RawParams,
  StateDeclaration,
  StateOrName,
  Transition,
  UIRouter,
} from '@uirouter/core';
import { snapshotRoute, type RouteSnapshot } from './shared/route-snapshot.js';

const detached: RouteSnapshot = {
  current: undefined,
  params: {},
  transition: undefined,
  includes: () => false,
};

/**
 * A signal mirror of a router's current state.
 *
 * A single `transitionService.onSuccess` hook (registered by
 * {@link RouterSignals.attach | attach}) writes one `RouteSnapshot` per
 * successful transition into a `Signal.State`. The public fields are
 * read-only `Signal.Computed`s over it, so any signal consumer — a
 * `watchSelection` callback, a framework binding such as
 * lit-ui-router-signals, or a `@lit-labs/signals` `SignalWatcher` render —
 * tracks exactly the fields it reads. `onSuccess` is the only hook a later transition cannot supersede, so
 * every value is a settled route.
 *
 * Use the {@link RouterSignals.for | for} factory to get the signals for a
 * router: it memoizes one instance (and one transition hook) per router.
 */
export class RouterSignals {
  private readonly state = new Signal.State<RouteSnapshot>(detached);

  /** The whole route as one value, replaced per transition. */
  readonly route: Signal.Computed<RouteSnapshot> = new Signal.Computed(() =>
    this.state.get(),
  );

  /** The current state declaration (`globals.current`). */
  readonly current: Signal.Computed<StateDeclaration | undefined> =
    new Signal.Computed(() => this.state.get().current);

  /** The current parameter values (`globals.params`), replaced per transition. */
  readonly params: Signal.Computed<RawParams> = new Signal.Computed(
    () => this.state.get().params,
  );

  /** The most recent successful transition. */
  readonly transition: Signal.Computed<Transition | undefined> =
    new Signal.Computed(() => this.state.get().transition);

  private router?: UIRouter = undefined;

  private deregister?: () => void = undefined;

  private static readonly instances = new WeakMap<UIRouter, RouterSignals>();

  /**
   * The signals for the given router — one instance per router. The first
   * call attaches the transition hook; the hook (and the instance) live as
   * long as the router itself.
   */
  static for(router: UIRouter): RouterSignals {
    let signals = this.instances.get(router);

    if (!signals) {
      signals = new RouterSignals();
      signals.attach(router);
      this.instances.set(router, signals);
    }

    return signals;
  }

  /**
   * Starts mirroring the given router. Called by
   * {@link RouterSignals.for | for}; call directly only when managing the
   * instance yourself.
   *
   * Idempotent per router: attaching again to the router already being
   * mirrored returns the same deregistration function instead of
   * registering a second hook. Calling that function detaches, after which
   * the instance can be attached again.
   *
   * @throws if already attached to a *different* router — one instance
   * mirrors one router; use {@link RouterSignals.for | for} to get that
   * router's own signals.
   * @returns the hook's deregistration function.
   */
  attach(router: UIRouter): () => void {
    if (this.deregister) {
      if (this.router === router) return this.deregister;
      throw new Error(
        'RouterSignals.attach: already attached to a different router. Use RouterSignals.for(router).',
      );
    }

    this.router = router;
    this.state.set(snapshotRoute(router));

    // SAFETY: `onSuccess` returns its deregistration function, typed only as `Function`.
    const deregister = router.transitionService.onSuccess({}, (transition) =>
      this.state.set(snapshotRoute(router, transition)),
    ) as () => void;

    this.deregister = () => {
      deregister();
      this.deregister = undefined;
      this.router = undefined;
    };

    return this.deregister;
  }

  /**
   * Tracked `StateService.includes`, evaluated against the current
   * {@link RouterSignals.route | route}: is the state (or glob pattern, e.g.
   * `'admin.**'`) included in the settled active state? Reading it inside a
   * computed or watcher subscribes to every transition.
   */
  includes(stateOrName: StateOrName, params?: RawParams): boolean {
    return this.state.get().includes(stateOrName, params);
  }
}

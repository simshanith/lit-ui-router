import { makeAutoObservable } from 'mobx';
import { RawParams, StateOrName, Transition, UIRouter } from '@uirouter/core';
import { trackPending } from '@repo/pending-transition';

import type {
  TypedStoreName,
  TypedStoreNarrowing,
  TypedStoreState,
  TypedStoreTarget,
} from './route-types.js';

/**
 * An observable mirror of a router's current state.
 *
 * A single `transitionService.onSuccess` hook (registered by
 * {@link RouterStore.attach | attach}) pushes the current state, params, and
 * transition into MobX observables. Any MobX `reaction`, `autorun` or
 * `computed` that reads the store re-runs when the values it reads change,
 * with no per-consumer transition hooks. An `onStart` hook feeds the one
 * in-flight field, {@link RouterStore.pending | pending}.
 *
 * Use the {@link RouterStore.for | for} factory to get the store for a
 * router: it memoizes one store (and its transition hooks) per router
 * instance.
 */
export class RouterStore {
  /** The current state declaration (`globals.current`). */
  current?: TypedStoreState['current'] = undefined;

  /** The current parameter values (`globals.params`), replaced per transition. */
  params: TypedStoreState['params'] = {};

  /** The most recent successful transition. */
  transition?: Transition = undefined;

  /**
   * The newest transition still in flight; `undefined` when none is. A
   * superseded transition never clears its successor, and an error or abort
   * clears it like a success does.
   */
  pending?: Transition = undefined;

  private router?: UIRouter = undefined;

  private deregister?: () => void = undefined;

  private static readonly stores = new WeakMap<UIRouter, RouterStore>();

  /**
   * The observable store for the given router — one per router instance.
   * The first call attaches the store's transition hooks; the hooks (and
   * the store) live as long as the router itself.
   */
  static for(router: UIRouter): RouterStore {
    let store = this.stores.get(router);

    if (!store) {
      store = new RouterStore();
      store.attach(router);
      this.stores.set(router, store);
    }

    return store;
  }

  constructor() {
    makeAutoObservable<RouterStore, 'router' | 'deregister'>(
      this,
      {
        router: false,
        deregister: false,
        // Not an action: reads inside actions are untracked, and this must
        // be trackable from observer renders.
        includes: false,
      },
      // deep:false gives every observable field reference semantics; it is the
      // only spelling both mobx majors accept (6's `observable.ref` annotation
      // became 7's `observableRef` export). Store-wide, so a future field that
      // wants deep observability needs an explicit annotation here.
      { autoBind: true, deep: false },
    );
  }

  /**
   * Starts mirroring the given router. Called by
   * {@link RouterStore.for | for}; call directly only when managing the
   * store instance yourself.
   *
   * Idempotent per router: attaching again to the router already being
   * mirrored returns the same deregistration function instead of
   * registering the hooks again. Calling that function detaches the store,
   * after which it can be attached again.
   *
   * @throws if the store is already attached to a *different* router — one
   * store mirrors one router; use {@link RouterStore.for | for} to get that
   * router's own store.
   * @returns the hooks' deregistration function.
   */
  attach(router: UIRouter): () => void {
    if (this.deregister) {
      if (this.router === router) return this.deregister;
      throw new Error(
        'RouterStore.attach: already attached to a different router. Use RouterStore.for(router).',
      );
    }

    this.router = router;
    this.update();

    // SAFETY: `onSuccess` returns its deregistration function, typed only as `Function`.
    const deregister = router.transitionService.onSuccess(
      {},
      this.update,
    ) as () => void;

    const untrack = trackPending(router, this.setPending);

    this.deregister = () => {
      deregister();
      untrack();
      this.deregister = undefined;
      this.router = undefined;
    };

    return this.deregister;
  }

  private setPending(transition: Transition | undefined) {
    this.pending = transition;
  }

  private update(transition?: Transition) {
    const globals = this.router?.globals;
    this.current = globals?.current;
    // eslint-disable-next-line typescript/no-misused-spread -- snapshot StateParams' own props as a fresh plain object per transition
    this.params = { ...globals?.params };
    this.transition = transition ?? globals?.successfulTransitions.peekTail();
  }

  /**
   * Observable version of `StateService.includes`: is the state (or glob
   * pattern, e.g. `'admin.**'`) included in the current active state? A
   * state name `RouteTypes` registers narrows `current` and `params`.
   */
  includes<N extends TypedStoreName>(
    state: N,
    params?: RawParams,
  ): this is TypedStoreNarrowing<N>;
  includes(stateOrName: TypedStoreTarget, params?: RawParams): boolean;
  includes(stateOrName: StateOrName, params?: RawParams): boolean {
    // Touch the observables so MobX tracks this read in observer renders.
    void this.current;
    void this.params;

    return this.router?.stateService.includes(stateOrName, params) ?? false;
  }
}

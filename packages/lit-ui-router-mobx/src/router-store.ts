import { makeAutoObservable, observable } from 'mobx';
import {
  RawParams,
  StateDeclaration,
  StateOrName,
  Transition,
  UIRouter,
} from '@uirouter/core';

/**
 * An observable mirror of a router's current state.
 *
 * A single `transitionService.onSuccess` hook (registered by
 * {@link RouterStore.attach | attach}) pushes the current state, params, and
 * transition into MobX observables. Components observe the store through
 * {@link ReactionController} / {@link RouterReactionController} selectors
 * and re-render automatically when the values they select change — no manual
 * `requestUpdate()` calls and no per-component hook subscriptions.
 *
 * Use the {@link RouterStore.for | for} factory to get the store for a
 * router: it memoizes one store (and one transition hook) per router
 * instance.
 */
export class RouterStore {
  /** The current state declaration (`globals.current`). */
  current?: StateDeclaration = undefined;

  /** The current parameter values (`globals.params`), replaced per transition. */
  params: RawParams = {};

  /** The most recent successful transition. */
  transition?: Transition = undefined;

  private router?: UIRouter = undefined;

  private static stores = new WeakMap<UIRouter, RouterStore>();

  /**
   * The observable store for the given router — one per router instance.
   * The first call attaches the store's transition hook; the hook (and the
   * store) live as long as the router itself.
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
    makeAutoObservable<RouterStore, 'router'>(
      this,
      {
        current: observable.ref,
        params: observable.ref,
        transition: observable.ref,
        router: false,
        // Not an action: reads inside actions are untracked, and this must
        // be trackable from observer renders.
        includes: false,
      },
      { autoBind: true },
    );
  }

  /**
   * Starts mirroring the given router. Called by
   * {@link RouterStore.for | for}; call directly only when managing the
   * store instance yourself, and at most once per store.
   * @returns the hook's deregistration function.
   */
  attach(router: UIRouter): () => void {
    this.router = router;
    this.update();
    return router.transitionService.onSuccess({}, this.update) as () => void;
  }

  private update(transition?: Transition) {
    const globals = this.router?.globals;
    this.current = globals?.current;
    this.params = { ...globals?.params };
    this.transition = transition ?? globals?.successfulTransitions.peekTail();
  }

  /**
   * Observable version of `StateService.includes`: is the state (or glob
   * pattern, e.g. `'admin.**'`) included in the current active state?
   */
  includes(stateOrName: StateOrName, params?: RawParams): boolean {
    // Touch the observables so MobX tracks this read in observer renders.
    void this.current;
    void this.params;
    return this.router?.stateService.includes(stateOrName, params) ?? false;
  }
}

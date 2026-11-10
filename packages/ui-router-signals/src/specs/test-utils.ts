import {
  memoryLocationPlugin,
  servicesPlugin,
  StateDeclaration,
  UIRouter,
} from '@uirouter/core';

export { routerGo, testStates, tick } from '@tools/lit-test-env/router.ts';

/** A DOM-free router on the memory location plugin. */
export function createTestRouter(states: StateDeclaration[] = []): UIRouter {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  // Copies: registration binds a declaration to one router, and specs share testStates.
  states.forEach((state) => router.stateRegistry.register({ ...state }));

  return router;
}

/** Holds every transition entering `state` until the returned function runs. */
export function hold(router: UIRouter, state: string): () => void {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  router.transitionService.onEnter({ entering: state }, () => held);

  return release;
}

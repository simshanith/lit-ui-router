import { memoryLocationPlugin } from '@uirouter/core';
import { UIRouterLit, LitStateDeclaration } from 'lit-ui-router';
import {
  tick,
  type GoParams,
  type GoRouter,
  type Updatable,
} from '@tools/lit-test-env/router.ts';

export { testStates, tick } from '@tools/lit-test-env/router.ts';

/**
 * Creates a test router instance with memory location plugin.
 * This allows testing without affecting browser URL.
 */
export function createTestRouter(
  states: LitStateDeclaration[] = [],
): UIRouterLit {
  const router = new UIRouterLit();
  router.plugin(memoryLocationPlugin);
  // Copies: registration binds a declaration to one router, and specs share testStates.
  states.forEach((state) => router.stateRegistry.register({ ...state }));

  return router;
}

/**
 * Navigates to a state and waits for the transition to complete.
 */
export async function routerGo(
  router: GoRouter,
  state: string,
  params?: GoParams,
): Promise<void> {
  await router.stateService.go(state, params);
  await settle();
}

/**
 * Waits for a LitElement to complete its update cycle.
 */
export async function waitForUpdate(element: Updatable): Promise<void> {
  await settle();
  await element.updateComplete;
  await tick();
}

/** Lets forked fibers run: effect 4 schedules on macrotasks, effect 3 on microtasks. */
async function settle(turns = 10): Promise<void> {
  for (let turn = 0; turn < turns; turn++) await tick();
}

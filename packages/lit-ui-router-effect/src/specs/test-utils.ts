import { LitElement } from 'lit';
import { memoryLocationPlugin } from '@uirouter/core';
import { UIRouterLit, LitStateDeclaration } from 'lit-ui-router';

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
 * States shared by the specs.
 */
export const testStates: LitStateDeclaration[] = [
  { name: 'a', url: '/a' },
  { name: 'b', url: '/b/:id' },
  { name: 'b.child', url: '/child' },
];

/**
 * Navigates to a state and waits for the transition to complete.
 */
export async function routerGo(
  router: UIRouterLit,
  state: string,
  params?: Record<string, unknown>,
): Promise<void> {
  await router.stateService.go(state, params);
  await settle();
}

/**
 * Wait for microtasks and pending promises to flush.
 */
export function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for a LitElement to complete its update cycle.
 */
export async function waitForUpdate(element: LitElement): Promise<void> {
  await settle();
  await element.updateComplete;
  await tick();
}

/** Lets forked fibers run: effect 4 schedules on macrotasks, effect 3 on microtasks. */
export async function settle(turns = 10): Promise<void> {
  for (let turn = 0; turn < turns; turn++) await tick();
}

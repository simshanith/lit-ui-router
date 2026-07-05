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
  states.forEach((state) => router.stateRegistry.register(state));
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
  await tick();
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
  await element.updateComplete;
  await tick();
}

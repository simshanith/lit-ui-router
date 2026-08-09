import * as mobx from 'mobx';
import { LitElement } from 'lit';
import { memoryLocationPlugin } from '@uirouter/core';
import { UIRouterLit, LitStateDeclaration } from 'lit-ui-router';

/**
 * Structural comparer for `options.equals`, resolved across mobx majors:
 * 6 spells it `comparer.structural`, 7 spells it `compareStructural`. The
 * specs run against both (see `test:mobx6-compat`), so neither name can be a
 * static import. Library code never needs this — `equals` takes any
 * `(a, b) => boolean`.
 */
type StructuralComparer = <T>(a: T, b: T) => boolean;

export const structural: StructuralComparer =
  (
    mobx as unknown as {
      compareStructural?: StructuralComparer;
      comparer?: { structural: StructuralComparer };
    }
  ).compareStructural ??
  (mobx as unknown as { comparer: { structural: StructuralComparer } }).comparer
    .structural;

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

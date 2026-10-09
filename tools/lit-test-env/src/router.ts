/**
 * Router spec helpers shared by the lit-ui-router suites.
 *
 * Structural types only: a runtime `lit` or `@uirouter/core` import issued
 * from here resolves against this package, not the consumer's (see
 * `setup.ts`). Helpers that construct a router stay in each package.
 */

/** The slice of a `UIRouter` that {@link routerGo} drives. */
export interface GoRouter {
  stateService: {
    go(state: string, params?: Record<string, unknown>): PromiseLike<unknown>;
  };
}

/** The slice of a `ReactiveElement` that {@link waitForUpdate} awaits. */
export interface Updatable {
  updateComplete: PromiseLike<unknown>;
}

/**
 * Wait for microtasks and pending promises to flush.
 */
export function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Navigates to a state and waits for the transition to complete.
 */
export async function routerGo(
  router: GoRouter,
  state: string,
  params?: Record<string, unknown>,
): Promise<void> {
  await router.stateService.go(state, params);
  await tick();
}

/**
 * Waits for a LitElement to complete its update cycle.
 */
export async function waitForUpdate(element: Updatable): Promise<void> {
  await element.updateComplete;
  await tick();
}

/**
 * States shared by the adapter specs.
 */
export const testStates: { name: string; url: string }[] = [
  { name: 'a', url: '/a' },
  { name: 'b', url: '/b/:id' },
  { name: 'b.child', url: '/child' },
];

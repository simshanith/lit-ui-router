import { memoryLocationPlugin } from '@uirouter/core';
import { UIRouterLit, LitStateDeclaration } from 'lit-ui-router';

export {
  routerGo,
  testStates,
  tick,
  waitForUpdate,
} from '@tools/lit-test-env/router.ts';

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

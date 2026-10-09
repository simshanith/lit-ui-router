import * as mobx from 'mobx';
import { memoryLocationPlugin } from '@uirouter/core';
import { UIRouterLit, LitStateDeclaration } from 'lit-ui-router';

export {
  routerGo,
  testStates,
  tick,
  waitForUpdate,
} from '@tools/lit-test-env/router.ts';

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

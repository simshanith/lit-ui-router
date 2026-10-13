import { describe, expect, it } from 'vitest';
import * as uiRouterEffect from 'ui-router-effect';

// This file imports the package alone: a spec that also loads `lit-ui-router` would define the elements itself.
// Static so the cold transform runs at collection, outside the test timeout.
import { routeRef, snapshotRoute } from '../index.js';

describe('importing the package', () => {
  it('defines no custom elements', () => {
    expect(customElements.get('ui-router')).toBeUndefined();
    expect(customElements.get('ui-view')).toBeUndefined();
  });

  it("re-exports ui-router-effect's route ref, so both share one ref per router", () => {
    expect(routeRef).toBe(uiRouterEffect.routeRef);
    expect(snapshotRoute).toBe(uiRouterEffect.snapshotRoute);
  });
});

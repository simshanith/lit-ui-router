import { describe, expect, it } from 'vitest';
import * as uiRouterMobx from 'ui-router-mobx';

// This file imports the package alone: a spec that also loads `lit-ui-router` would define the elements itself.
// Static so the cold transform runs at collection, outside the test timeout.
import { RouterStore } from '../index.js';
import { RouterStore as deepRouterStore } from '../router-store.js';

describe('importing the package', () => {
  it('defines no custom elements', () => {
    expect(customElements.get('ui-router')).toBeUndefined();
    expect(customElements.get('ui-view')).toBeUndefined();
  });

  it("re-exports ui-router-mobx's RouterStore, so both share one store per router", () => {
    expect(RouterStore).toBe(uiRouterMobx.RouterStore);
    expect(deepRouterStore).toBe(uiRouterMobx.RouterStore);
  });
});

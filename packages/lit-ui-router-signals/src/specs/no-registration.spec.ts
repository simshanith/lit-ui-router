import { describe, expect, it } from 'vitest';

// This file imports the package alone: a spec that also loads `lit-ui-router` would define the elements itself.
// Static so the cold transform runs at collection, outside the test timeout.
import '../index.js';

describe('importing the package', () => {
  it('defines no custom elements', () => {
    expect(customElements.get('ui-router')).toBeUndefined();
    expect(customElements.get('ui-view')).toBeUndefined();
  });
});

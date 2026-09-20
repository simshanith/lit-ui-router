import { describe, expect, it } from 'vitest';

// This file imports the package alone: a spec that also loads `lit-ui-router` would define the elements itself.
describe('importing the package', () => {
  it('defines no custom elements', async () => {
    await import('../index.js');
    expect(customElements.get('ui-router')).toBeUndefined();
    expect(customElements.get('ui-view')).toBeUndefined();
  });
});

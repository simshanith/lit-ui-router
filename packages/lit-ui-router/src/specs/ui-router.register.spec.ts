import '../ui-router.register.js';

import { UIRouterLitElement } from '../ui-router.js';

describe('per-element registration (ui-router)', () => {
  it('defines only the imported element', () => {
    expect(customElements.get('ui-router')).toBe(UIRouterLitElement);
    expect(customElements.get('ui-view')).toBeUndefined();
  });

  it('upgrades createElement to the class', () => {
    expect(document.createElement('ui-router')).toBeInstanceOf(
      UIRouterLitElement,
    );
  });
});

import '../ui-view.register.js';

import { UiView } from '../ui-view.js';

describe('per-element registration', () => {
  it('defines only the imported element', () => {
    expect(customElements.get('ui-view')).toBe(UiView);
    expect(customElements.get('ui-router')).toBeUndefined();
  });

  it('upgrades createElement to the class', () => {
    expect(document.createElement('ui-view')).toBeInstanceOf(UiView);
  });
});

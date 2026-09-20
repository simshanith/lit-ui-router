import {
  isRenderLightDirective,
  renderLight,
} from '@lit-labs/ssr-client/directives/render-light.js';
import { getDirectiveClass } from 'lit/directive-helpers.js';
import { describe, expect, it } from 'vitest';

import { uiViewSlot } from '../client.js';

// The flag is minified to another name in the production build of `@lit-labs/ssr-client`, so these assert inheritance and ssr's own reader, never the name.
describe('the renderLight flag', () => {
  it('inherits the flag from the class ssr-client itself carries it on', () => {
    const light = getDirectiveClass(renderLight());
    const slot = getDirectiveClass(uiViewSlot());
    if (!light || !slot) throw new Error('a directive result carried no class');
    expect(slot.prototype instanceof light).toBe(true);
  });

  it('answers the reader `@lit-labs/ssr` dispatches on', () => {
    expect(isRenderLightDirective(uiViewSlot())).toBeTruthy();
  });
});

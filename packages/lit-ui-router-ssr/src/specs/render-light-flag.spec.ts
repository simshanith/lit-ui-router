import {
  isRenderLightDirective,
  renderLight,
} from '@lit-labs/ssr-client/directives/render-light.js';
import { noChange } from 'lit';
import { PartType } from 'lit/directive.js';
import type { ChildPart, PartInfo } from 'lit/directive.js';
import { getDirectiveClass } from 'lit/directive-helpers.js';
import { describe, expect, it, vi } from 'vitest';

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

  // `@lit-labs/ssr` patches a rendered class to resolve through `render()`, so the update lit's own walk calls is reached here by hand.
  it('commits nothing on the client, where the base class would call the host renderLight()', () => {
    const Slot = getDirectiveClass(uiViewSlot());
    if (!Slot) throw new Error('a directive result carried no class');
    const parentNode = { renderLight: vi.fn() };
    const part = { type: PartType.CHILD, parentNode } as unknown as PartInfo;
    const slot = new Slot(part);
    expect(slot.update(part as unknown as ChildPart, [])).toBe(noChange);
    expect(slot.render()).toBe(noChange);
    expect(parentNode.renderLight).not.toHaveBeenCalled();
  });
});

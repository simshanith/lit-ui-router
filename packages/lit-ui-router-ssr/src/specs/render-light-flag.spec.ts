import {
  isRenderLightDirective,
  renderLight,
} from '@lit-labs/ssr-client/directives/render-light.js';
import { noChange } from 'lit';
import { PartType } from 'lit/directive.js';
import type { ChildPart } from 'lit/directive.js';
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
  describe('the update lit calls on the client', () => {
    const slotOn = (parentNode: object) => {
      const Slot = getDirectiveClass(uiViewSlot());
      if (!Slot) throw new Error('a directive result carried no class');
      const part = { type: PartType.CHILD, parentNode } as unknown as ChildPart;
      return { slot: new Slot(part), part };
    };

    it('keeps the nodes of a host with no renderLight()', () => {
      const { slot, part } = slotOn({});
      expect(slot.update(part, [])).toBe(noChange);
      expect(slot.render()).toBe(noChange);
    });

    it('commits what a host renderLight() answers', () => {
      const answer = Symbol('light');
      const renderLight = vi.fn(() => answer);
      const { slot, part } = slotOn({ renderLight });
      expect(slot.update(part, [])).toBe(answer);
      expect(renderLight).toHaveBeenCalledOnce();
    });
  });
});

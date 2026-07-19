import { describe, it, expect } from 'vitest';

/**
 * Canary for the happy-dom infidelity worked around in exactly one place —
 * appendParentFirst in ../append.ts, beside this spec: happy-dom fires
 * connectedCallback child-before-parent when an assembled subtree is
 * inserted; real browsers upgrade in shadow-including tree order, parent
 * first (so real browsers fail this spec by design — it runs only under the
 * happy-dom environment). When this spec FAILS, happy-dom fixed the ordering
 * upstream: inline plain appends at appendParentFirst's call sites, then
 * delete the helper and this canary.
 */
describe('happy-dom conformance canary', () => {
  it('still connects subtree children before their parent', () => {
    const order: string[] = [];
    customElements.define(
      'canary-parent',
      class extends HTMLElement {
        connectedCallback() {
          order.push('parent');
        }
      },
    );
    customElements.define(
      'canary-child',
      class extends HTMLElement {
        connectedCallback() {
          order.push('child');
        }
      },
    );

    const parent = document.createElement('canary-parent');
    parent.appendChild(document.createElement('canary-child'));
    document.body.appendChild(parent);

    expect(order).toEqual(['child', 'parent']);
  });
});

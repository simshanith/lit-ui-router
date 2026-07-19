import { describe, it, expect } from 'vitest';

/**
 * Canary for the happy-dom infidelity worked around in exactly one place —
 * mountElementInRouter in @tools/router-test-utils: happy-dom fires connectedCallback
 * child-before-parent when an assembled subtree is inserted; real browsers
 * upgrade in shadow-including tree order, parent first. Runs only in the
 * happy-dom project — real browsers fail it by design. When this spec FAILS,
 * happy-dom fixed the ordering upstream: remove the parent-first ordering in
 * that helper and delete this canary.
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

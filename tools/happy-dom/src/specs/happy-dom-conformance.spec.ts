import { describe, it, expect } from 'vitest';
import { setInnerHTMLDetached } from '../inner-html.ts';

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

/**
 * Canary for the happy-dom infidelity worked around in exactly one place —
 * setInnerHTMLDetached in ../inner-html.ts, beside this spec: happy-dom's
 * `innerHTML` setter on a connected parent connects a newly-parsed custom
 * element before its own children are parsed in; real browsers connect it
 * with its subtree already present, via the fragment parsing algorithm (so
 * real browsers fail the first assertion here by design — it runs only
 * under the happy-dom environment). When this spec FAILS, happy-dom fixed
 * the ordering upstream: inline plain innerHTML at setInnerHTMLDetached's
 * call sites, then delete the helper and this canary.
 */
class CanaryInnerHTML extends HTMLElement {
  childCountAtConnect = -1;
  connectedCallback() {
    this.childCountAtConnect = this.childNodes.length;
  }
}
customElements.define('canary-inner-html', CanaryInnerHTML);

describe('happy-dom innerHTML conformance canary', () => {
  it('connects a custom element parsed by innerHTML with 0 children', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    parent.innerHTML =
      '<canary-inner-html><span>child</span></canary-inner-html>';

    const child = parent.firstElementChild as CanaryInnerHTML;
    expect(child.childCountAtConnect).toBe(0);
  });

  it('setInnerHTMLDetached connects it with its children present', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    setInnerHTMLDetached(
      parent,
      '<canary-inner-html><span>child</span></canary-inner-html>',
    );

    const child = parent.firstElementChild as CanaryInnerHTML;
    expect(child.childCountAtConnect).toBe(1);
  });
});

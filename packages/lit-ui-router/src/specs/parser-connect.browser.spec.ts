import { describe, it, expect } from 'vitest';

// Browser-only: pins the real ordering that tools/happy-dom's
// setInnerHTMLDetached (@tools/happy-dom/inner-html.ts) works around —
// happy-dom connects a custom element parsed by `innerHTML` before its
// children are parsed in, but real browsers connect it with its subtree
// already present. A `document.write`-streamed case, where the element is
// already defined at its start tag with no children yet, has no clean
// equivalent under vitest browser mode (no `document.write`) and is left
// out.

class ParserConnectProbe extends HTMLElement {
  childCountAtConnect = -1;
  connectedCallback() {
    // eslint-disable-next-line wc/no-child-traversal-in-connectedcallback
    this.childCountAtConnect = this.childNodes.length;
  }
}
customElements.define('parser-connect-probe', ParserConnectProbe);

describe('custom element connect order in a real browser', () => {
  it('innerHTML on a connected parent connects it with its children present', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    parent.innerHTML =
      '<parser-connect-probe><span>child</span></parser-connect-probe>';

    const child = parent.firstElementChild as ParserConnectProbe;
    expect(child.childCountAtConnect).toBe(1);

    parent.remove();
  });

  it('createElement plus appending an assembled subtree connects it with its children present', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);

    const probe = document.createElement('parser-connect-probe');
    probe.appendChild(document.createElement('span'));
    parent.appendChild(probe);

    expect((probe as ParserConnectProbe).childCountAtConnect).toBe(1);

    parent.remove();
  });
});

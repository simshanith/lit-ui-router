import { describe, it, expect } from 'vitest';

import {
  contextRequestEventName,
  isRouterContextRequest,
  requestRouter,
} from '../context.js';
import { UIRouterLit } from '../core.js';

// Node under the @lit-labs/ssr DOM shim: no document, no elements — the shape
// the sref directives meet on the server, where the only thing to ask is an
// event target. `globalThis.litServerRoot` is the one @lit-labs/ssr puts at the
// bottom of its event-target stack, so a provider attached there answers every
// request a server render makes.
const litServerRoot = (globalThis as { litServerRoot?: EventTarget })
  .litServerRoot;

/** The provider a server-side router hand-off will install (#829). */
function provideRouter(host: EventTarget, router: UIRouterLit): () => void {
  const listener = (event: Event) => {
    if (!isRouterContextRequest(event)) return;
    event.stopImmediatePropagation();
    event.callback(router);
  };
  host.addEventListener(contextRequestEventName, listener);
  return () => host.removeEventListener(contextRequestEventName, listener);
}

describe('requestRouter without a DOM', () => {
  it('answers from a provider on a plain EventTarget', () => {
    const root = new EventTarget();
    const router = new UIRouterLit();
    const remove = provideRouter(root, router);

    expect(requestRouter(root)).toBe(router);

    remove();
    expect(requestRouter(root)).toBeUndefined();
  });

  it('answers from a provider on globalThis.litServerRoot', () => {
    expect(litServerRoot).toBeDefined();
    const router = new UIRouterLit();
    const remove = provideRouter(litServerRoot!, router);

    // the exact call a server-side directive hand-off will make
    expect(requestRouter(litServerRoot!)).toBe(router);

    remove();
  });

  it('returns undefined when the server render installed no provider', () => {
    expect(requestRouter(new EventTarget())).toBeUndefined();
  });
});

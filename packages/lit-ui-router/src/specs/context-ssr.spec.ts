import { describe, it, expect } from 'vitest';

import {
  contextRequestEventName,
  isRouterContextRequest,
  requestRouter,
} from '../context.js';
import { UIRouterLit } from '../core.js';

// The @lit-labs/ssr DOM shim: no elements, so a provider on its root answers every request.
const litServerRoot = (globalThis as { litServerRoot?: EventTarget })
  .litServerRoot;

/** a provider on the server root, speaking the protocol alone */
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

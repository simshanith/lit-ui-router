import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

import {
  contextRequestEventName,
  isRouterContextRequest,
  requestRouter,
} from '../context.js';
import { UIRouterLit } from '../core.js';
import { UIRouterLitElement } from '../ui-router.js';
import '../ui-router.register.js';
import { createTestRouter, waitForUpdate } from './test-utils.js';

// Browser-only: happy-dom does not retarget composed events at shadow roots,
// so a request from behind one never exercises the real path there.

/** a plain element behind a shadow root, standing in for a consumer */
@customElement('test-context-shadow-host')
class ContextShadowHost extends LitElement {
  render() {
    return html`<div id="inner"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-context-shadow-host': ContextShadowHost;
  }
}

/** a provider speaking the protocol alone — no @lit/context */
function provideRouter(host: EventTarget, router: UIRouterLit): void {
  host.addEventListener(contextRequestEventName, (event: Event) => {
    if (!isRouterContextRequest(event)) return;
    event.stopImmediatePropagation();
    event.callback(router);
  });
}

describe('lit-ui-router/context across a shadow boundary', () => {
  let container: HTMLElement;
  let router: UIRouterLit;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    router = createTestRouter();
  });

  afterEach(() => {
    container.remove();
  });

  async function shadowChild(parent: HTMLElement): Promise<Element> {
    const host = document.createElement('test-context-shadow-host');
    parent.appendChild(host);
    await waitForUpdate(host);
    return host.shadowRoot!.querySelector('#inner')!;
  }

  it('<ui-router> answers a request from inside a descendant shadow root', async () => {
    const element = document.createElement('ui-router');
    element.uiRouter = router;
    container.appendChild(element);
    await waitForUpdate(element);

    expect(requestRouter(await shadowChild(element))).toBe(router);
  });

  it('a hand-written provider on an ancestor is found through the shadow root', async () => {
    provideRouter(container, router);

    expect(requestRouter(await shadowChild(container))).toBe(router);
  });

  it('seekRouter falls back to that provider from inside the shadow root', async () => {
    provideRouter(container, router);

    expect(UIRouterLitElement.seekRouter(await shadowChild(container))).toBe(
      router,
    );
  });
});

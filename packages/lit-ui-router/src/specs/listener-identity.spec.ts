import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

import { UIRouterLitElement } from '../ui-router.js';
import '../ui-router.register.js';
import '../ui-view.register.js';
import { UIRouterLit } from '../core.js';
import { createTestRouter, waitForUpdate, tick } from './test-utils.js';

/**
 * `<ui-router>` and `<ui-view>` both add a `ui-router-context` listener on
 * connect and never remove it. That is safe only because each handler is a
 * `readonly` class-field arrow: re-connecting passes an identical
 * (type, callback, capture) triple, which `addEventListener` ignores per spec.
 *
 * Rewriting either registration to take a fresh function — an inline arrow, a
 * `.bind(this)`, a wrapper closure — stacks a handler per connect with no
 * other visible symptom. `wc/require-listener-teardown` cannot see these sites
 * (it needs a string-literal event name; these read `this.constructor` statics),
 * so this spec is the only thing guarding the idiom.
 */

/** Reconnects an element in place, driving disconnect/connect `times` over. */
async function reconnect(element: HTMLElement, times: number): Promise<void> {
  const parent = element.parentElement!;
  for (let i = 0; i < times; i++) {
    element.remove();
    parent.appendChild(element);
    await tick();
  }
}

// Control fixture: the mistake this spec exists to catch. Registers a fresh
// arrow on every connect, so its handler count grows with reconnects.
let inlineArrowInvocations = 0;

@customElement('test-inline-arrow-listener')
class TestInlineArrowListener extends LitElement {
  createRenderRoot() {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // The fixture is the leak: this element exists to prove an inline arrow
    // cannot be removed.
    // eslint-disable-next-line wc/require-listener-teardown
    this.addEventListener(UIRouterLitElement.uiRouterContextEventName, () => {
      inlineArrowInvocations++;
    });
  }

  render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-inline-arrow-listener': TestInlineArrowListener;
  }
}

describe('context listener identity across reconnect', () => {
  let container: HTMLElement;
  let router: UIRouterLit;
  let onContextEvent: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    router = createTestRouter([{ name: 'home', url: '/home' }]);
    inlineArrowInvocations = 0;
    // The instance handlers on both elements delegate to this static on every
    // dispatch, so spying on it counts handler invocations without reaching
    // into private fields. `vi.spyOn` calls through, so behaviour is unchanged.
    onContextEvent = vi.spyOn(UIRouterLitElement, 'onUiRouterContextEvent');
  });

  afterEach(() => {
    onContextEvent.mockRestore();
    container.remove();
  });

  it('control: an inline-arrow registration does stack, one handler per connect', async () => {
    const element = document.createElement('test-inline-arrow-listener');
    container.appendChild(element);
    await waitForUpdate(element);

    await reconnect(element, 3);
    element.dispatchEvent(UIRouterLitElement.uiRouterContextEvent(router));

    // 4 connects (initial + 3), 4 distinct callbacks, all invoked by one
    // dispatch. If this ever reads 1, the assertions below prove nothing.
    expect(inlineArrowInvocations).toBe(4);
  });

  it('<ui-router> answers a context event once after repeated reconnects', async () => {
    const element = document.createElement('ui-router');
    element.uiRouter = router;
    container.appendChild(element);
    await waitForUpdate(element);

    const child = document.createElement('div');
    element.appendChild(child);

    await reconnect(element, 3);

    // Reconnecting re-dispatches through seekRouter; only the final probe counts.
    onContextEvent.mockClear();
    const seen = UIRouterLitElement.seekRouter(child);

    expect(onContextEvent).toHaveBeenCalledTimes(1);
    expect(seen).toBe(router);
  });

  it('<ui-view> answers a context event once after repeated reconnects', async () => {
    const routerElement = document.createElement('ui-router');
    routerElement.uiRouter = router;
    container.appendChild(routerElement);
    await waitForUpdate(routerElement);

    const view = document.createElement('ui-view');
    routerElement.appendChild(view);
    await waitForUpdate(view);

    await reconnect(view, 3);

    onContextEvent.mockClear();
    const seen = UIRouterLitElement.seekRouter(view);

    // Exactly one: <ui-view> handles it and stops propagation before it
    // reaches <ui-router>. Two would mean <ui-view> stacked a handler.
    expect(onContextEvent).toHaveBeenCalledTimes(1);
    expect(seen).toBe(router);
  });

  it('<ui-view> keeps answering after a disconnect, having kept its listener', async () => {
    const routerElement = document.createElement('ui-router');
    routerElement.uiRouter = router;
    container.appendChild(routerElement);
    await waitForUpdate(routerElement);

    const view = document.createElement('ui-view');
    routerElement.appendChild(view);
    await waitForUpdate(view);

    view.remove();
    await tick();

    onContextEvent.mockClear();
    UIRouterLitElement.seekRouter(view);

    // Documents the asymmetry deliberately left in place: disconnect drains the
    // transition hooks but keeps this listener. Nothing leaks — the handler is
    // bound to the element and collected with it.
    expect(onContextEvent).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { UIRouterLit, UIRouterLitElement } from 'lit-ui-router';

import { RouterReactionController } from '../router-reaction-controller.js';
import { appendParentFirst } from '@tools/happy-dom/append.ts';
import {
  createTestRouter,
  routerGo,
  structural,
  testStates,
  waitForUpdate,
} from './test-utils.js';

@customElement('router-reaction-host')
class RouterReactionHost extends LitElement {
  renderCount = 0;

  render() {
    this.renderCount++;
    return html`<span>${this.renderCount}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'router-reaction-host': RouterReactionHost;
  }
}

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.shift()?.();
});

function createHost(): RouterReactionHost {
  return document.createElement('router-reaction-host');
}

/** Mounts the host inside a <ui-router> providing the given router. */
async function mountInRouter(
  host: RouterReactionHost,
  router: UIRouterLit,
): Promise<UIRouterLitElement> {
  const uiRouterEl = document.createElement('ui-router');
  uiRouterEl.uiRouter = router;
  appendParentFirst(document.body, uiRouterEl, host);
  cleanups.push(() => uiRouterEl.remove());
  await waitForUpdate(host);
  return uiRouterEl;
}

describe('RouterReactionController', () => {
  it('discovers the router from the <ui-router> context', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');

    const host = createHost();
    const controller = new RouterReactionController(
      host,
      (route) => route.current?.name,
    );
    await mountInRouter(host, router);

    expect(controller.store).toBeDefined();
    expect(controller.value).toBe('a');
  });

  it('accepts an explicit router instead of context discovery', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');

    const host = createHost();
    const controller = new RouterReactionController(
      host,
      (route) => route.current?.name,
      { router },
    );
    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    await waitForUpdate(host);

    expect(controller.value).toBe('a');
  });

  it('warns once per host and no-ops without a router context', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    cleanups.push(() => warn.mockRestore());

    const host = createHost();
    const controller = new RouterReactionController(
      host,
      (route) => route.current?.name,
    );
    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    await waitForUpdate(host);

    expect(controller.store).toBeUndefined();
    expect(controller.value).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe(
      'lit-ui-router-mobx: RouterReactionController found no <ui-router> ' +
        'ancestor, so it will not observe the router. Wrap this subtree in ' +
        '<ui-router>, or pass a router explicitly.',
    );
    expect(warn.mock.calls[0]?.[1]).toBe(host);

    // reconnecting the same host repeats the failed seek, not the message
    host.remove();
    document.body.appendChild(host);
    await waitForUpdate(host);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('updates the host when the selected value changes', async () => {
    const router = createTestRouter(testStates);
    const host = createHost();
    const controller = new RouterReactionController(
      host,
      (route) => route.current?.name,
    );
    await mountInRouter(host, router);
    const rendersBefore = host.renderCount;

    await routerGo(router, 'a');
    await waitForUpdate(host);

    expect(controller.value).toBe('a');
    expect(host.renderCount).toBeGreaterThan(rendersBefore);
  });

  it('shares one store per router across hosts', async () => {
    const router = createTestRouter(testStates);
    const hostA = createHost();
    const hostB = createHost();
    const controllerA = new RouterReactionController(
      hostA,
      (route) => route.current?.name,
    );
    const controllerB = new RouterReactionController(
      hostB,
      (route) => route.params.id,
    );
    const uiRouterEl = await mountInRouter(hostA, router);
    uiRouterEl.appendChild(hostB);
    await waitForUpdate(hostB);

    expect(controllerA.store).toBeDefined();
    expect(controllerB.store).toBe(controllerA.store);
  });

  it('supports structural equality and onChange for params selectors', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'b', { id: '1' });

    const host = createHost();
    const onChange = vi.fn();
    new RouterReactionController(host, (route) => ({ id: route.params.id }), {
      equals: structural,
      onChange,
    });
    await mountInRouter(host, router);
    onChange.mockClear();

    // Child transition: `id` is unchanged, the selection is structurally
    // equal, so the effect must not re-fire.
    await routerGo(router, 'b.child', { id: '1' });
    await waitForUpdate(host);
    expect(onChange).not.toHaveBeenCalled();

    await routerGo(router, 'b', { id: '2' });
    await waitForUpdate(host);
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ id: '2' });
  });

  it('stops observing on disconnect and resynchronizes on reconnect', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');

    const host = createHost();
    const controller = new RouterReactionController(
      host,
      (route) => route.current?.name,
    );
    const uiRouterEl = await mountInRouter(host, router);
    expect(controller.value).toBe('a');

    host.remove();
    await routerGo(router, 'b', { id: '1' });
    expect(controller.value).toBe('a');

    uiRouterEl.appendChild(host);
    await waitForUpdate(host);
    expect(controller.value).toBe('b');
  });
});

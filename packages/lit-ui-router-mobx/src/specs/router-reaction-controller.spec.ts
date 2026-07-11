import { describe, it, expect, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { comparer } from 'mobx';
import { UIRouterLit, UIRouterLitElement } from 'lit-ui-router';

import { RouterReactionController } from '../router-reaction-controller.js';
import {
  createTestRouter,
  routerGo,
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
  uiRouterEl.appendChild(host);
  document.body.appendChild(uiRouterEl);
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

  it('warns and no-ops without a router context', async () => {
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
    expect(warn).toHaveBeenCalled();
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
      equals: comparer.structural,
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

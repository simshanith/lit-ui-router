import { describe, it, expect, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Data, Equal } from 'effect';
import { UIRouterLit, UIRouterLitElement } from 'lit-ui-router';

import { RouterRefController } from '../router-ref-controller.js';
import { appendParentFirst } from '@tools/happy-dom/append.ts';
import {
  createTestRouter,
  routerGo,
  testStates,
  waitForUpdate,
} from './test-utils.js';

@customElement('router-ref-host')
class RouterRefHost extends LitElement {
  renderCount = 0;

  render() {
    this.renderCount++;
    return html`<span>${this.renderCount}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'router-ref-host': RouterRefHost;
  }
}

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.shift()?.();
});

function createHost(): RouterRefHost {
  return document.createElement('router-ref-host');
}

/** Mounts the host inside a <ui-router> providing the given router. */
async function mountInRouter(
  host: RouterRefHost,
  router: UIRouterLit,
): Promise<UIRouterLitElement> {
  const uiRouterEl = document.createElement('ui-router');
  uiRouterEl.uiRouter = router;
  appendParentFirst(document.body, uiRouterEl, host);
  cleanups.push(() => uiRouterEl.remove());
  await waitForUpdate(host);
  return uiRouterEl;
}

describe('RouterRefController', () => {
  it('discovers the router from the <ui-router> context', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');

    const host = createHost();
    const controller = new RouterRefController(
      host,
      (route) => route.current?.name,
    );
    expect(controller.value).toBeUndefined();

    await mountInRouter(host, router);

    expect(controller.value).toBe('a');
  });

  it('reads an explicit router at construction, before connect', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');

    const host = createHost();
    const controller = new RouterRefController(
      host,
      (route) => route.current?.name,
      { router },
    );

    expect(controller.value).toBe('a');

    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    await waitForUpdate(host);

    expect(controller.value).toBe('a');
  });

  it('warns once per host and no-ops without a router context', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    cleanups.push(() => warn.mockRestore());

    const host = createHost();
    const controller = new RouterRefController(
      host,
      (route) => route.current?.name,
    );
    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    await waitForUpdate(host);

    expect(controller.value).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe(
      'lit-ui-router-effect: RouterRefController found no <ui-router> ' +
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

  it('falls back to initialValue before connect and without a context', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    cleanups.push(() => warn.mockRestore());

    const host = createHost();
    const controller = new RouterRefController(
      host,
      (route) => route.current?.name,
      { initialValue: 'none' },
    );

    expect(controller.value).toBe('none');

    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    await waitForUpdate(host);

    expect(controller.value).toBe('none');
  });

  it('updates the host when the selected value changes', async () => {
    const router = createTestRouter(testStates);
    const host = createHost();
    const controller = new RouterRefController(
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

  it('shares one ref per router across hosts', async () => {
    const router = createTestRouter(testStates);
    const first = createHost();
    const second = createHost();
    const a = new RouterRefController(first, (route) => route);
    const b = new RouterRefController(second, (route) => route);
    await mountInRouter(first, router);
    await mountInRouter(second, router);

    await routerGo(router, 'a');
    await waitForUpdate(first);
    await waitForUpdate(second);

    expect(a.value).toBe(b.value);
    expect(a.value.current?.name).toBe('a');
  });

  it('supports value equality and onChange for params selectors', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'b', { id: '1' });
    const host = createHost();
    const onChange = vi.fn();
    const controller = new RouterRefController(
      host,
      (route) => Data.struct({ id: route.params.id as string | undefined }),
      { equals: Equal.equals, onChange },
    );
    await mountInRouter(host, router);
    expect(onChange).toHaveBeenCalledTimes(1);

    // a child transition keeps the same id: same value, no change
    await routerGo(router, 'b.child', { id: '1' });
    await waitForUpdate(host);
    expect(onChange).toHaveBeenCalledTimes(1);

    await routerGo(router, 'b', { id: '2' });
    await waitForUpdate(host);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(controller.value.id).toBe('2');
  });

  it('stops following on disconnect and resynchronizes on reconnect', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');
    const host = createHost();
    const controller = new RouterRefController(
      host,
      (route) => route.current?.name,
    );
    const uiRouterEl = await mountInRouter(host, router);

    host.remove();
    await routerGo(router, 'b', { id: '1' });
    expect(controller.value).toBe('a');

    uiRouterEl.appendChild(host);
    await waitForUpdate(host);
    expect(controller.value).toBe('b');
  });
});

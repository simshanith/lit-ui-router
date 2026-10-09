import { describe, it, expect, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { UIRouterLit, UIRouterLitElement } from 'lit-ui-router';
import { isRouterContextRequest } from 'lit-ui-router/context';

import { RouterSignalController } from '../router-signal-controller.js';
import { RouterSignals } from '../router-signals.js';
import { appendParentFirst } from '@tools/happy-dom/append.ts';
import {
  createTestRouter,
  routerGo,
  testStates,
  waitForUpdate,
} from './test-utils.js';

const structural = <T>(a: T, b: T): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

@customElement('router-signal-host')
class RouterSignalHost extends LitElement {
  renderCount = 0;

  render() {
    this.renderCount++;
    return html`<span>${this.renderCount}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'router-signal-host': RouterSignalHost;
  }
}

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.shift()?.();
});

function createHost(): RouterSignalHost {
  return document.createElement('router-signal-host');
}

/** Mounts the host inside a <ui-router> providing the given router. */
async function mountInRouter(
  host: RouterSignalHost,
  router: UIRouterLit,
): Promise<UIRouterLitElement> {
  const uiRouterEl = document.createElement('ui-router');
  uiRouterEl.uiRouter = router;
  appendParentFirst(document.body, uiRouterEl, host);
  cleanups.push(() => uiRouterEl.remove());
  await waitForUpdate(host);
  return uiRouterEl;
}

describe('RouterSignalController', () => {
  it('discovers the router from the <ui-router> context', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');

    const host = createHost();
    const controller = new RouterSignalController(
      host,
      (route) => route.current.get()?.name,
    );
    await mountInRouter(host, router);

    expect(controller.signals).toBeDefined();
    expect(controller.value).toBe('a');
  });

  it('accepts an explicit router instead of context discovery', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');

    const host = createHost();
    const controller = new RouterSignalController(
      host,
      (route) => route.current.get()?.name,
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
    const controller = new RouterSignalController(
      host,
      (route) => route.current.get()?.name,
    );
    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    await waitForUpdate(host);

    expect(controller.signals).toBeUndefined();
    expect(controller.value).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe(
      'lit-ui-router-signals: RouterSignalController found no <ui-router> ' +
        'ancestor, so it will not watch the router. Wrap this subtree in ' +
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
    const controller = new RouterSignalController(
      host,
      (route) => route.current.get()?.name,
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
    const controller = new RouterSignalController(
      host,
      (route) => route.current.get()?.name,
    );
    await mountInRouter(host, router);
    const rendersBefore = host.renderCount;

    await routerGo(router, 'a');
    await waitForUpdate(host);

    expect(controller.value).toBe('a');
    expect(host.renderCount).toBeGreaterThan(rendersBefore);
  });

  it('shares one RouterSignals per router across hosts', async () => {
    const router = createTestRouter(testStates);
    const hostA = createHost();
    const hostB = createHost();
    const controllerA = new RouterSignalController(
      hostA,
      (route) => route.current.get()?.name,
    );
    const controllerB = new RouterSignalController(
      hostB,
      (route) => route.params.get().id,
    );
    const uiRouterEl = await mountInRouter(hostA, router);
    uiRouterEl.appendChild(hostB);
    await waitForUpdate(hostB);

    expect(controllerA.signals).toBeDefined();
    expect(controllerB.signals).toBe(controllerA.signals);
  });

  it('supports structural equality and onChange for params selectors', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'b', { id: '1' });

    const host = createHost();
    const onChange = vi.fn();
    new RouterSignalController(
      host,
      (route) => ({ id: route.params.get().id }),
      {
        equals: structural,
        onChange,
      },
    );
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

  it('stops watching on disconnect and resynchronizes on reconnect', async () => {
    const router = createTestRouter(testStates);
    await routerGo(router, 'a');

    const host = createHost();
    const controller = new RouterSignalController(
      host,
      (route) => route.current.get()?.name,
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

/**
 * A provider holding a provisional router, as `<ui-router>` holds its
 * placeholder on a served page: a subscriber gets an unsubscribe that drops
 * it, then at most one more call with the replacement and a no-op.
 */
class StubRouterProvider extends HTMLElement {
  readonly subscribers = new Set<(router: UIRouterLit) => void>();

  /** Keeps subscribers past their unsubscribe, as a careless provider might. */
  ignoreUnsubscribe = false;

  router?: UIRouterLit;

  constructor() {
    super();
    this.addEventListener('context-request', (event) => {
      if (!this.router || !isRouterContextRequest(event)) return;
      event.stopImmediatePropagation();
      const { callback, subscribe } = event;
      if (!subscribe) {
        callback(this.router);
        return;
      }
      const deliver = (next: UIRouterLit) => callback(next, () => {});
      this.subscribers.add(deliver);
      callback(this.router, () => {
        if (!this.ignoreUnsubscribe) this.subscribers.delete(deliver);
      });
    });
  }

  upgrade(router: UIRouterLit): void {
    this.router = router;
    const subscribers = [...this.subscribers];
    this.subscribers.clear();
    for (const deliver of subscribers) deliver(router);
  }
}
customElements.define('signal-stub-router-provider', StubRouterProvider);

/** Answers only the house `ui-router-context` event, which cannot subscribe. */
class HouseEventProvider extends HTMLElement {
  constructor(router: UIRouterLit) {
    super();
    this.addEventListener(
      UIRouterLitElement.uiRouterContextEventName,
      UIRouterLitElement.onUiRouterContextEvent(router) as EventListener,
    );
  }
}
customElements.define('signal-house-event-provider', HouseEventProvider);

describe('RouterSignalController router upgrade', () => {
  // core links each declaration to its registry, so every router needs its own copies
  const createOwnRouter = () =>
    createTestRouter(testStates.map((state) => ({ ...state })));

  async function mountInStub(
    host: RouterSignalHost,
    router: UIRouterLit,
  ): Promise<StubRouterProvider> {
    const provider = new StubRouterProvider();
    provider.router = router;
    appendParentFirst(document.body, provider, host);
    cleanups.push(() => provider.remove());
    await waitForUpdate(host);
    return provider;
  }

  it('rebinds to the router the provider hands it next', async () => {
    const placeholder = createOwnRouter();
    const router = createOwnRouter();
    await routerGo(placeholder, 'a');
    await routerGo(router, 'b', { id: '1' });

    const host = createHost();
    const onChange = vi.fn();
    const controller = new RouterSignalController(
      host,
      (route) => route.current.get()?.name,
      { onChange },
    );
    const provider = await mountInStub(host, placeholder);
    expect(controller.value).toBe('a');
    expect(controller.signals).toBe(RouterSignals.for(placeholder));
    const rendersBefore = host.renderCount;
    onChange.mockClear();

    provider.upgrade(router);
    await waitForUpdate(host);

    expect(controller.signals).toBe(RouterSignals.for(router));
    expect(controller.value).toBe('b');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('b');
    expect(host.renderCount).toBeGreaterThan(rendersBefore);

    // the placeholder's watcher is gone
    onChange.mockClear();
    await routerGo(placeholder, 'b.child', { id: '2' });
    expect(onChange).not.toHaveBeenCalled();
    expect(controller.value).toBe('b');

    await routerGo(router, 'a');
    await waitForUpdate(host);
    expect(controller.value).toBe('a');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('a');
  });

  it('unsubscribes on disconnect', async () => {
    const placeholder = createOwnRouter();
    const router = createOwnRouter();
    await routerGo(placeholder, 'a');
    await routerGo(router, 'b', { id: '1' });

    const host = createHost();
    const controller = new RouterSignalController(
      host,
      (route) => route.current.get()?.name,
    );
    const provider = await mountInStub(host, placeholder);
    expect(provider.subscribers.size).toBe(1);

    host.remove();
    expect(provider.subscribers.size).toBe(0);

    provider.upgrade(router);
    expect(controller.signals).toBe(RouterSignals.for(placeholder));
    expect(controller.value).toBe('a');
  });

  it('ignores a delivery that reaches a disconnected host', async () => {
    const placeholder = createOwnRouter();
    const router = createOwnRouter();
    await routerGo(placeholder, 'a');
    await routerGo(router, 'b', { id: '1' });

    const host = createHost();
    const controller = new RouterSignalController(
      host,
      (route) => route.current.get()?.name,
    );
    const provider = await mountInStub(host, placeholder);
    provider.ignoreUnsubscribe = true;

    host.remove();
    provider.upgrade(router);

    expect(controller.signals).toBe(RouterSignals.for(placeholder));
    expect(controller.value).toBe('a');
  });

  it('subscribes afresh on reconnect and follows that upgrade', async () => {
    const placeholder = createOwnRouter();
    const router = createOwnRouter();
    await routerGo(placeholder, 'a');
    await routerGo(router, 'b', { id: '1' });

    const host = createHost();
    const controller = new RouterSignalController(
      host,
      (route) => route.current.get()?.name,
    );
    const provider = await mountInStub(host, placeholder);
    host.remove();
    provider.appendChild(host);
    await waitForUpdate(host);
    expect(provider.subscribers.size).toBe(1);

    provider.upgrade(router);
    await waitForUpdate(host);
    expect(controller.value).toBe('b');
  });

  it('leaves an explicit router alone', async () => {
    const placeholder = createOwnRouter();
    const router = createOwnRouter();
    const other = createOwnRouter();
    await routerGo(router, 'a');
    await routerGo(other, 'b', { id: '1' });

    const host = createHost();
    const controller = new RouterSignalController(
      host,
      (route) => route.current.get()?.name,
      { router },
    );
    const provider = await mountInStub(host, placeholder);
    expect(provider.subscribers.size).toBe(0);

    provider.upgrade(other);
    expect(controller.signals).toBe(RouterSignals.for(router));
    expect(controller.value).toBe('a');
  });

  it('falls back to the house ui-router-context event', async () => {
    const router = createOwnRouter();
    await routerGo(router, 'a');

    const host = createHost();
    const controller = new RouterSignalController(
      host,
      (route) => route.current.get()?.name,
    );
    const provider = new HouseEventProvider(router);
    appendParentFirst(document.body, provider, host);
    cleanups.push(() => provider.remove());
    await waitForUpdate(host);

    expect(controller.signals).toBe(RouterSignals.for(router));
    expect(controller.value).toBe('a');
  });
});

/** The served-page window: `<ui-router>` mints its placeholder, a host binds to it, then the app's router arrives. */
describe('RouterSignalController placeholder router upgrade', () => {
  async function mountPlaceholder(): Promise<{
    uiRouterEl: UIRouterLitElement;
    placeholder: UIRouterLit;
  }> {
    const uiRouterEl = document.createElement('ui-router');
    document.body.appendChild(uiRouterEl);
    cleanups.push(() => uiRouterEl.remove());
    await waitForUpdate(uiRouterEl);
    const placeholder = uiRouterEl.uiRouter!;
    cleanups.push(() => placeholder.dispose());
    return { uiRouterEl, placeholder };
  }

  function createAppRouter(): UIRouterLit {
    // core links each declaration to its registry, so every router needs its own copies
    const router = createTestRouter(testStates.map((state) => ({ ...state })));
    cleanups.push(() => router.dispose());
    return router;
  }

  async function upgrade(
    uiRouterEl: UIRouterLitElement,
    router: UIRouterLit,
  ): Promise<void> {
    uiRouterEl.uiRouter = router;
    await waitForUpdate(uiRouterEl);
  }

  function watch(host: RouterSignalHost) {
    return new RouterSignalController(
      host,
      (route) => route.current.get()?.name,
    );
  }

  it('follows the upgrade on a host under <ui-router>', async () => {
    const { uiRouterEl, placeholder } = await mountPlaceholder();
    const router = createAppRouter();
    const host = createHost();
    const controller = watch(host);
    uiRouterEl.appendChild(host);
    await waitForUpdate(host);
    expect(controller.signals).toBe(RouterSignals.for(placeholder));

    await upgrade(uiRouterEl, router);
    expect(controller.signals).toBe(RouterSignals.for(router));
    const rendersBefore = host.renderCount;

    await routerGo(router, 'b', { id: '1' });
    await waitForUpdate(host);
    expect(controller.value).toBe('b');
    expect(host.renderCount).toBeGreaterThan(rendersBefore);
  });

  it('follows the upgrade on a host under a <ui-view>', async () => {
    const { uiRouterEl, placeholder } = await mountPlaceholder();
    const router = createAppRouter();
    const view = uiRouterEl.appendChild(document.createElement('ui-view'));
    await waitForUpdate(view);
    const host = createHost();
    const controller = watch(host);
    view.appendChild(host);
    await waitForUpdate(host);
    expect(controller.signals).toBe(RouterSignals.for(placeholder));

    await upgrade(uiRouterEl, router);
    expect(controller.signals).toBe(RouterSignals.for(router));
    const rendersBefore = host.renderCount;

    await routerGo(router, 'a');
    await waitForUpdate(host);
    expect(controller.value).toBe('a');
    expect(host.renderCount).toBeGreaterThan(rendersBefore);
  });

  it('keeps the placeholder once the host disconnects', async () => {
    const { uiRouterEl, placeholder } = await mountPlaceholder();
    const router = createAppRouter();
    await routerGo(router, 'a');
    const host = createHost();
    const controller = watch(host);
    uiRouterEl.appendChild(host);
    await waitForUpdate(host);
    const placeholderValue = controller.value;
    host.remove();

    await upgrade(uiRouterEl, router);

    expect(controller.signals).toBe(RouterSignals.for(placeholder));
    expect(controller.value).toBe(placeholderValue);
    expect(placeholderValue).not.toBe('a');
  });
});

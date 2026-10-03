import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

import { requestRouter } from '../context.js';
import { UIRouterLit } from '../core.js';
import { LitStateDeclaration } from '../interface.js';
import { SrefStatusController } from '../sref-status-controller.js';
import { TransitionController } from '../transition-controller.js';
import { UIRouterLitElement } from '../ui-router.js';
import '../ui-router.register.js';
import '../ui-view.register.js';
import {
  createTestRouter,
  routerGo,
  tick,
  waitForUpdate,
} from './test-utils.js';

@customElement('test-router-upgrade-host')
class RouterUpgradeHost extends LitElement {
  readonly transitions = new TransitionController(this);

  readonly status = new SrefStatusController(this, { state: 'b' });

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<span>${this.transitions.current?.name ?? ''}</span
      ><a class=${this.status.active ? 'active' : ''}>b</a>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-router-upgrade-host': RouterUpgradeHost;
  }
}

const states: LitStateDeclaration[] = [
  { name: 'a', url: '/a' },
  { name: 'b', url: '/b' },
];

/** The served-page window: `<ui-router>` mints its placeholder, a host binds to it, then the app's router arrives. */
describe('placeholder router upgrade', () => {
  let container: HTMLElement;
  let router: UIRouterLit;
  let uiRouter: UIRouterLitElement;
  let placeholder: UIRouterLit;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    router = createTestRouter(states);
    uiRouter = document.createElement('ui-router');
    container.appendChild(uiRouter);
    await waitForUpdate(uiRouter);
    placeholder = uiRouter.uiRouter!;
  });

  afterEach(async () => {
    container.remove();
    await tick(10);
    router.dispose();
    placeholder.dispose();
  });

  async function upgrade(): Promise<void> {
    uiRouter.uiRouter = router;
    await waitForUpdate(uiRouter);
    router.start();
    await tick();
  }

  describe('<ui-router> context-request', () => {
    it('calls a subscriber again with the router that replaces the placeholder', async () => {
      const child = uiRouter.appendChild(document.createElement('div'));
      const callback = vi.fn();
      expect(requestRouter(child, { subscribe: true, callback })).toBe(
        placeholder,
      );

      await upgrade();

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback.mock.calls[1]?.[0]).toBe(router);
    });

    it('keeps a throwing subscriber from the others, rethrown on a microtask', async () => {
      const child = uiRouter.appendChild(document.createElement('div'));
      const failure = new Error('subscriber failed');
      requestRouter(child, {
        subscribe: true,
        callback: (value) => {
          if (value === router) throw failure;
        },
      });
      const callback = vi.fn();
      requestRouter(child, { subscribe: true, callback });
      const microtasks = vi.fn<(callback: () => void) => void>();
      vi.stubGlobal('queueMicrotask', microtasks);

      try {
        uiRouter.uiRouter = router;
        await waitForUpdate(uiRouter);
      } finally {
        vi.unstubAllGlobals();
      }

      expect(callback.mock.calls[1]?.[0]).toBe(router);
      const rethrows = microtasks.mock.calls.filter(([task]) => {
        try {
          task();
        } catch (thrown) {
          return thrown === failure;
        }
        return false;
      });
      expect(rethrows).toHaveLength(1);
    });

    it('delivers the upgrade once, and never a later swap', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const child = uiRouter.appendChild(document.createElement('div'));
        const callback = vi.fn();
        requestRouter(child, { subscribe: true, callback });
        await upgrade();

        uiRouter.uiRouter = createTestRouter();
        await waitForUpdate(uiRouter);

        expect(callback).toHaveBeenCalledTimes(2);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('drops a subscriber that unsubscribed', async () => {
      const child = uiRouter.appendChild(document.createElement('div'));
      const callback = vi.fn();
      requestRouter(child, { subscribe: true, callback });
      const unsubscribe = callback.mock.calls[0]?.[1] as () => void;
      unsubscribe();

      await upgrade();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('keeps no subscriber once the app router stands', async () => {
      await upgrade();
      const child = uiRouter.appendChild(document.createElement('div'));
      const callback = vi.fn();
      requestRouter(child, { subscribe: true, callback });

      uiRouter.uiRouter = createTestRouter();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await waitForUpdate(uiRouter);
      } finally {
        warn.mockRestore();
      }

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0]?.[0]).toBe(router);
    });
  });

  describe('<ui-view> context-request', () => {
    it('follows the upgrade and passes it to its own subscribers', async () => {
      const view = uiRouter.appendChild(document.createElement('ui-view'));
      await waitForUpdate(view);
      expect(view.uiRouter).toBe(placeholder);
      const child = view.appendChild(document.createElement('div'));
      const callback = vi.fn();
      requestRouter(child, { subscribe: true, callback });
      expect(callback.mock.calls[0]?.[0]).toBe(placeholder);

      await upgrade();

      expect(view.uiRouter).toBe(router);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback.mock.calls[1]?.[0]).toBe(router);
    });
  });

  describe('controllers', () => {
    it('follow the upgrade on a host under <ui-router>', async () => {
      const host = uiRouter.appendChild(
        document.createElement('test-router-upgrade-host'),
      );
      await waitForUpdate(host);
      expect(host.transitions.router).toBe(placeholder);
      expect(host.status.router).toBe(placeholder);

      await upgrade();
      expect(host.transitions.router).toBe(router);
      expect(host.status.router).toBe(router);

      await routerGo(router, 'b');
      await waitForUpdate(host);
      expect(host.querySelector('span')!.textContent).toBe('b');
      expect(host.querySelector('a')!.className).toBe('active');
    });

    it('follow the upgrade on a host under a <ui-view>', async () => {
      const view = uiRouter.appendChild(document.createElement('ui-view'));
      await waitForUpdate(view);
      const host = document.createElement('test-router-upgrade-host');
      view.appendChild(host);
      await waitForUpdate(host);
      expect(host.transitions.router).toBe(placeholder);

      await upgrade();
      await routerGo(router, 'b');
      await waitForUpdate(host);

      expect(host.transitions.router).toBe(router);
      expect(host.status.active).toBe(true);
    });

    it('stop listening once the host disconnects', async () => {
      const host = uiRouter.appendChild(
        document.createElement('test-router-upgrade-host'),
      );
      await waitForUpdate(host);
      host.remove();

      await upgrade();

      expect(host.transitions.router).toBe(placeholder);
    });
  });
});

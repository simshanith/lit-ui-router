import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Transition } from '@uirouter/core';

import {
  TransitionController,
  TransitionControllerOptions,
} from '../transition-controller.js';
import '../ui-router.register.js';
import { UIRouterLit } from '../core.js';
import { LitStateDeclaration } from '../interface.js';
import {
  createTestRouter,
  routerGo,
  tick,
  waitForUpdate,
} from './test-utils.js';

@customElement('test-transition-controller-host')
class TransitionControllerHost extends LitElement {
  controller?: TransitionController;

  renderCount = 0;

  createRenderRoot() {
    return this;
  }

  render() {
    this.renderCount++;
    return html`<span>${this.controller?.current?.name ?? ''}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-transition-controller-host': TransitionControllerHost;
  }
}

const testStates: LitStateDeclaration[] = [
  { name: 'a', url: '/a' },
  { name: 'b', url: '/b/:id' },
  { name: 'b.child', url: '/child' },
];

describe('TransitionController', () => {
  let container: HTMLElement;
  let router: UIRouterLit;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    router = createTestRouter(testStates);
  });

  afterEach(() => {
    container.remove();
  });

  async function mountHost(
    options?: TransitionControllerOptions,
    { withContext = true }: { withContext?: boolean } = {},
  ) {
    const host = document.createElement('test-transition-controller-host');
    host.controller = new TransitionController(host, options);

    if (withContext) {
      const uiRouterEl = document.createElement('ui-router');
      uiRouterEl.uiRouter = router;
      container.appendChild(uiRouterEl);
      await waitForUpdate(uiRouterEl);
      uiRouterEl.appendChild(host);
    } else {
      container.appendChild(host);
    }

    await waitForUpdate(host);
    return host;
  }

  describe('router discovery', () => {
    it('should discover the router from an ancestor ui-router', async () => {
      const host = await mountHost();
      expect(host.controller!.router).toBe(router);
    });

    it('should use an explicitly provided router without context', async () => {
      const host = await mountHost({ router }, { withContext: false });
      expect(host.controller!.router).toBe(router);

      await routerGo(router, 'a');
      await waitForUpdate(host);
      expect(host.textContent).toContain('a');
    });

    it('should be a no-op without a router', async () => {
      const host = await mountHost(undefined, { withContext: false });

      expect(host.controller!.router).toBeUndefined();
      expect(host.controller!.params).toEqual({});
      expect(host.controller!.current).toBeUndefined();
      expect(host.controller!.includes('a')).toBe(false);
    });
  });

  describe('host updates', () => {
    it('should request a host update on every successful transition', async () => {
      const host = await mountHost();
      const initialRenderCount = host.renderCount;

      await routerGo(router, 'a');
      await waitForUpdate(host);

      expect(host.renderCount).toBeGreaterThan(initialRenderCount);
      expect(host.textContent).toContain('a');

      await routerGo(router, 'b', { id: '42' });
      await waitForUpdate(host);

      expect(host.textContent).toContain('b');
    });

    it('should synchronize once when the host connects', async () => {
      await routerGo(router, 'a');

      const callback = vi.fn();
      const host = await mountHost({ callback });

      expect(callback).toHaveBeenCalledTimes(1);
      const [transition, reason] = callback.mock.calls[0];
      expect(reason).toBe('hostConnected');
      expect(transition).toBeInstanceOf(Transition);
      expect(host.textContent).toContain('a');
    });
  });

  describe('callback', () => {
    it('should invoke the callback with the transition and reason', async () => {
      const callback = vi.fn();
      await mountHost({ callback });
      callback.mockClear();

      await routerGo(router, 'a');

      expect(callback).toHaveBeenCalledTimes(1);
      const [transition, reason] = callback.mock.calls[0];
      expect(reason).toBe('onSuccess');
      expect((transition as Transition).to().name).toBe('a');
    });

    it('should respect hook match criteria', async () => {
      const callback = vi.fn();
      await mountHost({ callback, criteria: { to: 'b' } });
      callback.mockClear();

      await routerGo(router, 'a');
      expect(callback).not.toHaveBeenCalled();

      await routerGo(router, 'b', { id: '1' });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should observe additional transition events', async () => {
      const callback = vi.fn();
      await mountHost({ callback, events: ['onStart', 'onSuccess'] });
      callback.mockClear();

      await routerGo(router, 'a');

      const reasons = callback.mock.calls.map(([, reason]) => reason);
      expect(reasons).toEqual(['onStart', 'onSuccess']);
    });

    it('should allow onBefore callbacks to cancel a transition', async () => {
      await routerGo(router, 'a');

      await mountHost({
        events: ['onBefore'],
        criteria: { to: 'b' },
        callback: () => false,
      });

      await router.stateService.go('b', { id: '1' }).catch(() => {});
      await tick();

      expect(router.globals.current.name).toBe('a');
    });
  });

  describe('lifecycle cleanup', () => {
    it('should deregister hooks when the host disconnects', async () => {
      const callback = vi.fn();
      const host = await mountHost({ callback });
      callback.mockClear();

      host.remove();
      await tick();

      await routerGo(router, 'a');
      expect(callback).not.toHaveBeenCalled();
    });

    it('should re-register hooks and synchronize when the host reconnects', async () => {
      const callback = vi.fn();
      const host = await mountHost({ callback });
      const parent = host.parentElement!;

      host.remove();
      await tick();
      await routerGo(router, 'a');
      callback.mockClear();

      parent.appendChild(host);
      await waitForUpdate(host);

      // Synchronized with the transition that completed while disconnected
      expect(callback).toHaveBeenCalledTimes(1);
      const [transition, reason] = callback.mock.calls[0];
      expect(reason).toBe('hostConnected');
      expect((transition as Transition).to().name).toBe('a');

      callback.mockClear();
      await routerGo(router, 'b', { id: '7' });
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessors', () => {
    it('should expose current state, params, and transition', async () => {
      const host = await mountHost();

      await routerGo(router, 'b', { id: '42' });

      const controller = host.controller!;
      expect(controller.current?.name).toBe('b');
      expect(controller.params.id).toBe('42');
      expect(controller.transition).toBeInstanceOf(Transition);
      expect(controller.transition!.to().name).toBe('b');
      expect(controller.globals).toBe(router.globals);
    });

    it('should delegate includes() to the state service', async () => {
      const host = await mountHost();

      await routerGo(router, 'b.child', { id: '42' });

      const controller = host.controller!;
      expect(controller.includes('b')).toBe(true);
      expect(controller.includes('b.**')).toBe(true);
      expect(controller.includes('a')).toBe(false);
    });
  });
});

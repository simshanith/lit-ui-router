import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

import { requestRouter, type ContextCallback } from '../context.js';
import { UIRouterLit } from '../core.js';
import { LitStateDeclaration } from '../interface.js';
import { RouterSubscribers } from '../router-subscription.js';
import { srefActiveClass } from '../sref-active.js';
import { srefHref } from '../sref-href.js';
import { SrefStatusController } from '../sref-status-controller.js';
import { TransitionController } from '../transition-controller.js';
import { UIRouterLitElement } from '../ui-router.js';
import { uiSref } from '../ui-sref.js';
import { uiSrefActive } from '../ui-sref-active.js';
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

@customElement('test-router-upgrade-links')
class RouterUpgradeLinks extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`<a id="ui-sref" ${uiSref('b')}>b</a
      ><span
        id="ui-sref-active"
        ${uiSrefActive({ state: 'b', activeClasses: ['active'] })}
      ></span
      ><a id="sref-href" href=${srefHref('b')}>b</a
      ><span
        id="sref-active-class"
        class=${srefActiveClass({ state: 'b', activeClasses: ['active'] })}
      ></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-router-upgrade-host': RouterUpgradeHost;
    'test-router-upgrade-links': RouterUpgradeLinks;
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

    it('keeps a throwing subscriber from the others, through reportError', async () => {
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
      const reportError = vi.fn<typeof globalThis.reportError>();
      vi.stubGlobal('reportError', reportError);

      try {
        uiRouter.uiRouter = router;
        await waitForUpdate(uiRouter);
      } finally {
        vi.unstubAllGlobals();
      }

      expect(callback.mock.calls[1]?.[0]).toBe(router);
      expect(reportError.mock.calls).toEqual([[failure]]);
    });

    it('skips a subscriber that an earlier one unsubscribed during the upgrade', async () => {
      const child = uiRouter.appendChild(document.createElement('div'));

      const later =
        vi.fn<(value: UIRouterLit, unsubscribe?: () => void) => void>();

      requestRouter(child, {
        subscribe: true,
        callback: (value) => {
          if (value === router) later.mock.calls[0]?.[1]?.();
        },
      });
      requestRouter(child, { subscribe: true, callback: later });

      await upgrade();

      expect(later).toHaveBeenCalledTimes(1);
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
      const callback = vi.fn<ContextCallback<UIRouterLit>>();
      requestRouter(child, { subscribe: true, callback });
      const unsubscribe = callback.mock.calls[0]?.[1];
      unsubscribe!();

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

  describe('directives', () => {
    let links: RouterUpgradeLinks;

    beforeEach(async () => {
      links = uiRouter.appendChild(
        document.createElement('test-router-upgrade-links'),
      );
      await waitForUpdate(links);
      // the deferred router lookup has run and found the placeholder
      await tick();
    });

    const link = (id: string): Element => links.querySelector(`#${id}`)!;

    it('uiSref writes the href of the router that replaces the placeholder', async () => {
      expect(link('ui-sref').getAttribute('href')).toBeNull();

      await upgrade();

      expect(link('ui-sref').getAttribute('href')).toBe('#/b');
    });

    it('uiSrefActive follows the router that replaces the placeholder', async () => {
      await upgrade();
      await routerGo(router, 'b');

      expect(link('ui-sref-active').classList.contains('active')).toBe(true);
    });

    it('srefHref writes the href of the router that replaces the placeholder', async () => {
      expect(link('sref-href').hasAttribute('href')).toBe(false);

      await upgrade();

      expect(link('sref-href').getAttribute('href')).toBe('#/b');
    });

    it('srefActiveClass follows the router that replaces the placeholder', async () => {
      await upgrade();
      await routerGo(router, 'b');

      expect(link('sref-active-class').classList.contains('active')).toBe(true);
    });

    it('stop listening once the host disconnects', async () => {
      const onStatesChanged = vi.spyOn(router.stateRegistry, 'onStatesChanged');
      links.remove();

      await upgrade();

      expect(onStatesChanged).not.toHaveBeenCalled();
      expect(link('ui-sref').hasAttribute('href')).toBe(false);
    });
  });
});

describe('RouterSubscribers without reportError', () => {
  let provisional: UIRouterLit;
  let upgraded: UIRouterLit;
  let provider: HTMLElement;
  let subscribers: RouterSubscribers;

  beforeEach(() => {
    provisional = createTestRouter();
    upgraded = createTestRouter();
    subscribers = new RouterSubscribers();
    provider = document.createElement('div');
    provider.addEventListener('context-request', (event) =>
      subscribers.answer(event, provisional, true),
    );
    vi.stubGlobal('reportError', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    provisional.dispose();
    upgraded.dispose();
  });

  function subscribe(callback: (value: UIRouterLit) => void): void {
    requestRouter(provider, { subscribe: true, callback });
  }

  function failOnUpgrade(failure: Error): void {
    subscribe((value) => {
      if (value === upgraded) throw failure;
    });
  }

  it('throws the one failure once every subscriber has the router', () => {
    const failure = new Error('subscriber failed');
    failOnUpgrade(failure);
    const callback = vi.fn();
    subscribe(callback);

    expect(() => subscribers.deliver(upgraded)).toThrow(failure);
    expect(callback.mock.calls[1]?.[0]).toBe(upgraded);
  });

  it('throws an AggregateError of several failures', () => {
    const first = new Error('first');
    const second = new Error('second');
    failOnUpgrade(first);
    failOnUpgrade(second);

    expect(() => subscribers.deliver(upgraded)).toThrow(
      expect.objectContaining({
        constructor: AggregateError,
        errors: [first, second],
      }),
    );
  });
});

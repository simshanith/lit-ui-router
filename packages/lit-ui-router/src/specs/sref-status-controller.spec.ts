import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, LitElement, nothing, ReactiveController, render } from 'lit';
import { customElement } from 'lit/decorators.js';
import { cache } from 'lit/directives/cache.js';
import { classMap } from 'lit/directives/class-map.js';

import {
  SrefStatusController,
  SrefStatusControllerOptions,
} from '../sref-status-controller.js';
import { srefHref } from '../sref-href.js';
import '../ui-router.register.js';
import '../ui-view.register.js';
import { UIRouterLit } from '../core.js';
import { LitStateDeclaration } from '../interface.js';
import {
  createTestRouter,
  defer,
  routerGo,
  tick,
  waitForUpdate,
} from './test-utils.js';

/** the host of the brief's example: classMap plus aria-current, light DOM */
@customElement('test-sref-status-host')
class SrefStatusHost extends LitElement {
  controller?: SrefStatusController;

  locked = false;

  renderCount = 0;

  createRenderRoot() {
    return this;
  }

  render() {
    this.renderCount++;
    const status = this.controller;
    return html`<a
      class=${classMap({
        'nav-link': true,
        active: status?.active ?? false,
        disabled: this.locked,
      })}
      aria-current=${status?.ariaCurrent() ?? nothing}
      >Users</a
    >`;
  }
}

/** a host that builds its own controller, for template-driven lifecycles */
@customElement('test-sref-status-link')
class SrefStatusLink extends LitElement {
  readonly status = new SrefStatusController(this, { state: 'users' });

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<a class=${classMap({ active: this.status.active })}>Users</a>`;
  }
}

/** container mode inside a shadow root: the links below feed the controller */
@customElement('test-sref-status-section')
class SrefStatusSection extends LitElement {
  readonly status = new SrefStatusController(this);

  render() {
    return html`<a href=${srefHref('users')}>Users</a>
      <span class=${classMap({ active: this.status.active })}></span>`;
  }
}

/** routed into a `<ui-view>`, so `relative` defaults to the view's state */
@customElement('test-sref-status-relative')
class SrefStatusRelative extends LitElement {
  readonly status = new SrefStatusController(this, { state: '.detail' });

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<a class=${classMap({ active: this.status.active })}
      >Detail</a
    >`;
  }
}

/** a host that is not a LitElement: no render root, updates counted by hand */
class PlainHost extends HTMLElement {
  // declared before the controller: its constructor calls addController
  private readonly controllers: ReactiveController[] = [];

  readonly status = new SrefStatusController(this);

  updates = 0;

  addController(controller: ReactiveController): void {
    this.controllers.push(controller);
  }

  removeController(): void {}

  requestUpdate(): void {
    this.updates++;
  }

  get updateComplete(): Promise<boolean> {
    return Promise.resolve(true);
  }

  connectedCallback(): void {
    this.controllers.forEach((controller) => controller.hostConnected?.());
  }
}
customElements.define('test-sref-status-plain', PlainHost);

declare global {
  interface HTMLElementTagNameMap {
    'test-sref-status-plain': PlainHost;
    'test-sref-status-host': SrefStatusHost;
    'test-sref-status-link': SrefStatusLink;
    'test-sref-status-section': SrefStatusSection;
    'test-sref-status-relative': SrefStatusRelative;
  }
}

let slowGate = defer();

const states: LitStateDeclaration[] = [
  { name: 'home', url: '/home' },
  {
    name: 'users',
    url: '/users',
    component: () =>
      html`<test-sref-status-relative></test-sref-status-relative>`,
  },
  { name: 'users.detail', url: '/:userId' },
  {
    name: 'slow',
    url: '/slow',
    resolve: [{ token: 'gate', resolveFn: () => slowGate.promise }],
  },
  {
    name: 'broken',
    url: '/broken',
    resolve: [{ token: 'nope', resolveFn: () => Promise.reject(new Error()) }],
  },
];

describe('SrefStatusController', () => {
  let container: HTMLElement;
  let router: UIRouterLit;

  beforeEach(() => {
    slowGate = defer();
    container = document.createElement('div');
    document.body.appendChild(container);
    router = createTestRouter(states);
  });

  afterEach(async () => {
    container.remove();
    await tick(10);
    router?.dispose();
    await tick();
  });

  /** a `<ui-router>` with the router already provided */
  async function mountRouter(): Promise<HTMLElement> {
    const uiRouter = document.createElement('ui-router');
    uiRouter.uiRouter = router;
    container.appendChild(uiRouter);
    await waitForUpdate(uiRouter);
    router.start();
    await tick();
    return uiRouter;
  }

  async function mountHost(
    options?: SrefStatusControllerOptions,
    { withContext = true }: { withContext?: boolean } = {},
  ): Promise<SrefStatusHost> {
    const host = document.createElement('test-sref-status-host');
    host.controller = new SrefStatusController(host, options);

    if (withContext) {
      (await mountRouter()).appendChild(host);
    } else {
      container.appendChild(host);
    }
    await waitForUpdate(host);
    return host;
  }

  const anchor = (host: Element) => host.querySelector('a')!;

  async function goTo(state: string, params?: Record<string, unknown>) {
    await routerGo(router, state, params);
    await tick(20);
  }

  describe('status', () => {
    it('tracks active and exact through transitions', async () => {
      const host = await mountHost({ state: 'users' });
      const controller = host.controller!;
      expect(controller.router).toBe(router);
      expect(controller.active).toBe(false);
      expect(controller.exact).toBe(false);

      await goTo('users');
      await waitForUpdate(host);
      expect(controller.active).toBe(true);
      expect(controller.exact).toBe(true);
      expect(controller.status!.targetStates).toHaveLength(1);
      expect(controller.targetStates[0].name()).toBe('users');
      expect(anchor(host).classList.contains('active')).toBe(true);
      expect(anchor(host).getAttribute('aria-current')).toBe('page');

      await goTo('users.detail', { userId: 1 });
      await waitForUpdate(host);
      expect(controller.active).toBe(true);
      expect(controller.exact).toBe(false);
      expect(anchor(host).hasAttribute('aria-current')).toBe(false);

      await goTo('home');
      await waitForUpdate(host);
      expect(controller.active).toBe(false);
      expect(anchor(host).classList.contains('active')).toBe(false);
      expect(anchor(host).classList.contains('nav-link')).toBe(true);
    });

    it('reports entering while a transition is pending', async () => {
      const host = await mountHost({ state: 'slow' });
      const controller = host.controller!;

      const navigation = router.stateService.go('slow');
      await tick(5);
      expect(controller.entering).toBe(true);
      expect(controller.exiting).toBe(false);
      expect(controller.active).toBe(false);

      slowGate.resolve();
      await navigation;
      await tick(20);
      expect(controller.entering).toBe(false);
      expect(controller.exact).toBe(true);
    });

    it('reports exiting while a transition is pending', async () => {
      const host = await mountHost({ state: 'users' });
      const controller = host.controller!;
      await goTo('users');

      const navigation = router.stateService.go('slow');
      await tick(5);
      expect(controller.exiting).toBe(true);
      expect(controller.entering).toBe(false);

      slowGate.resolve();
      await navigation;
      await tick(20);
      expect(controller.exiting).toBe(false);
      expect(controller.active).toBe(false);
    });

    it('settles again after a transition fails', async () => {
      const host = await mountHost({ state: 'users' });
      const controller = host.controller!;
      await goTo('users');

      await router.stateService.go('broken').catch(() => {});
      await tick(20);
      expect(controller.active).toBe(true);
      expect(controller.entering).toBe(false);
      expect(controller.exiting).toBe(false);
    });

    it('follows a state registered after the host connected', async () => {
      const host = await mountHost({ state: 'late' });
      const controller = host.controller!;
      expect(controller.active).toBe(false);

      router.stateRegistry.register({ name: 'late', url: '/late' });
      await tick();
      await goTo('late');
      expect(controller.exact).toBe(true);
    });

    it('matches params', async () => {
      const host = await mountHost({
        state: 'users.detail',
        params: { userId: 1 },
      });
      const controller = host.controller!;

      await goTo('users.detail', { userId: 2 });
      expect(controller.active).toBe(false);

      await goTo('users.detail', { userId: 1 });
      expect(controller.active).toBe(true);
    });
  });

  describe('router discovery', () => {
    it('computes the status at construction with an explicit router', async () => {
      router.start();
      await goTo('users');

      const host = document.createElement('test-sref-status-host');
      const controller = new SrefStatusController(host, {
        state: 'users',
        router,
      });
      // no <ui-router> ancestor, no DOM: the status is there already
      expect(controller.status).toBeDefined();
      expect(controller.exact).toBe(true);
      expect(controller.router).toBe(router);

      host.controller = controller;
      container.appendChild(host);
      await waitForUpdate(host);
      expect(anchor(host).classList.contains('active')).toBe(true);

      await goTo('home');
      await waitForUpdate(host);
      expect(controller.active).toBe(false);
    });

    it('warns once and stays inert without a router', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const host = await mountHost(
          { state: 'users' },
          { withContext: false },
        );
        const controller = host.controller!;

        expect(controller.router).toBeUndefined();
        expect(controller.status).toBeUndefined();
        expect(controller.active).toBe(false);
        expect(controller.exact).toBe(false);
        expect(controller.entering).toBe(false);
        expect(controller.exiting).toBe(false);
        expect(controller.targetStates).toEqual([]);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toBe(
          'lit-ui-router: new SrefStatusController() on <test-sref-status-host> ' +
            'found no <ui-router> ancestor, so it will never be marked active. ' +
            'Wrap this subtree in <ui-router>, or pass a router explicitly.',
        );

        host.remove();
        await tick();
        container.appendChild(host);
        await waitForUpdate(host);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('defaults `relative` to the enclosing view state', async () => {
      const uiRouter = await mountRouter();
      const uiView = document.createElement('ui-view');
      uiRouter.appendChild(uiView);
      await waitForUpdate(uiView);

      await goTo('users');
      const routed = uiView.querySelector('test-sref-status-relative')!;
      // `.detail` resolved against the view's `users` context
      expect(routed.status.targetStates[0].name()).toBe('users.detail');
      expect(routed.status.active).toBe(false);

      await goTo('users.detail', { userId: 1 });
      await waitForUpdate(routed);
      expect(routed.status.exact).toBe(true);
      expect(anchor(routed).classList.contains('active')).toBe(true);
    });
  });

  describe('container mode', () => {
    it('watches the srefHref links in the host template', async () => {
      const uiRouter = await mountRouter();
      const section = document.createElement('test-sref-status-section');
      uiRouter.appendChild(section);
      await waitForUpdate(section);
      await tick(20);

      expect(section.status.targetStates[0].name()).toBe('users');
      expect(section.status.active).toBe(false);

      await goTo('users.detail', { userId: 1 });
      await waitForUpdate(section);
      expect(section.status.active).toBe(true);
      expect(
        section.shadowRoot!.querySelector('span')!.classList.contains('active'),
      ).toBe(true);

      await goTo('home');
      await waitForUpdate(section);
      expect(section.status.active).toBe(false);
    });

    it('gathers links from a host that has no render root', async () => {
      const uiRouter = await mountRouter();
      const host = document.createElement('test-sref-status-plain');
      uiRouter.appendChild(host);
      render(html`<a href=${srefHref('users')}>Users</a>`, host);
      await tick(20);

      expect(host.updates).toBeGreaterThan(0);
      expect(host.status.targetStates[0].name()).toBe('users');

      await goTo('users');
      expect(host.status.exact).toBe(true);
    });
  });

  describe('retarget', () => {
    it('replaces the watched state', async () => {
      const host = await mountHost({ state: 'users' });
      const controller = host.controller!;
      await goTo('home');
      expect(controller.active).toBe(false);

      controller.retarget({ state: 'home' });
      await waitForUpdate(host);
      expect(controller.active).toBe(true);
      expect(controller.targetStates[0].name()).toBe('home');
      expect(anchor(host).classList.contains('active')).toBe(true);

      controller.retarget({ state: 'users.detail', params: { userId: 1 } });
      await goTo('users.detail', { userId: 1 });
      expect(controller.exact).toBe(true);
    });
  });

  describe('ariaCurrent', () => {
    it('writes page on exact by default and nothing otherwise', async () => {
      const host = await mountHost({ state: 'users' });
      const controller = host.controller!;
      expect(controller.ariaCurrent()).toBe(nothing);

      await goTo('users');
      expect(controller.ariaCurrent()).toBe('page');

      await goTo('users.detail', { userId: 1 });
      expect(controller.ariaCurrent()).toBe(nothing);
    });

    it('takes a token or a per-state object', async () => {
      const host = await mountHost({ state: 'users' });
      const controller = host.controller!;

      await goTo('users');
      expect(controller.ariaCurrent('step')).toBe('step');
      expect(
        controller.ariaCurrent({ exact: 'true', active: 'location' }),
      ).toBe('true');
      expect(controller.ariaCurrent({ exact: false })).toBe(nothing);
      // the object form still defaults `exact`
      expect(controller.ariaCurrent({ active: 'location' })).toBe('page');

      await goTo('users.detail', { userId: 1 });
      expect(
        controller.ariaCurrent({ exact: 'page', active: 'location' }),
      ).toBe('location');
      expect(controller.ariaCurrent('step')).toBe(nothing);
    });
  });

  describe('host updates', () => {
    it('does not re-render when a transition leaves the status alone', async () => {
      const host = await mountHost({ state: 'users' });
      const requestUpdate = vi.spyOn(host, 'requestUpdate');

      await goTo('home');
      expect(requestUpdate).not.toHaveBeenCalled();

      await goTo('users');
      expect(requestUpdate).toHaveBeenCalled();
      requestUpdate.mockRestore();
    });
  });

  describe('lifecycle', () => {
    it('deregisters on disconnect and resumes on reconnect', async () => {
      const host = await mountHost({ state: 'users' });
      const controller = host.controller!;
      const parent = host.parentElement!;

      host.remove();
      await tick();
      const requestUpdate = vi.spyOn(host, 'requestUpdate');
      await goTo('users');
      expect(requestUpdate).not.toHaveBeenCalled();
      // the last status survives the disconnect
      expect(controller.active).toBe(false);
      requestUpdate.mockRestore();

      parent.appendChild(host);
      await waitForUpdate(host);
      expect(controller.exact).toBe(true);
      expect(anchor(host).classList.contains('active')).toBe(true);

      await goTo('home');
      await waitForUpdate(host);
      expect(controller.active).toBe(false);
    });

    it('stops and restarts with a cached fragment', async () => {
      const uiRouter = await mountRouter();
      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      const template = (show: boolean) =>
        html`${cache(
          show
            ? html`<test-sref-status-link></test-sref-status-link>`
            : nothing,
        )}`;
      render(template(true), wrapper);
      const link = wrapper.querySelector('test-sref-status-link')!;
      await waitForUpdate(link);

      render(template(false), wrapper);
      await tick();
      await goTo('users');
      expect(link.status.active).toBe(false);

      render(template(true), wrapper);
      await waitForUpdate(link);
      expect(wrapper.querySelector('test-sref-status-link')).toBe(link);
      expect(link.status.exact).toBe(true);
      expect(anchor(link).classList.contains('active')).toBe(true);
    });
  });
});

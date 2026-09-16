import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ActiveUIView, Transition } from '@uirouter/core';

import { UiView } from '../ui-view.js';
import { adoptUiViewContext, provideContext } from '../context.js';
import '../ui-view.register.js';
import { UIRouterLitElement } from '../ui-router.js';
import { UIRouterLit } from '../core.js';
import {
  UIViewInjectedProps,
  LitStateDeclaration,
  UiOnParamsChanged,
  UiOnExit,
} from '../interface.js';
import {
  createTestRouter,
  mountElementInRouter,
  tick,
  waitForUpdate,
  routerGo,
} from './test-utils.js';

// Module-scope fixtures delegate to these handles, reassigned per test so each
// test keeps its own spy/state.
let canExit: UiOnExit['uiCanExit'];
let paramsChanged: UiOnParamsChanged['uiOnParamsChanged'];
let receiveParams: UiOnParamsChanged['uiOnParamsChanged'];

@customElement('test-exit-component')
class TestExitComponent extends LitElement implements UiOnExit {
  uiCanExit = (trans?: Transition) => canExit(trans);
  render() {
    return html`<div>Exit Component</div>`;
  }
}

@customElement('test-block-exit-component')
class TestBlockExitComponent extends LitElement implements UiOnExit {
  uiCanExit() {
    return false;
  }
  render() {
    return html`<div>Block Exit</div>`;
  }
}

@customElement('test-params-component')
class TestParamsComponent extends LitElement implements UiOnParamsChanged {
  uiOnParamsChanged(
    ...args: Parameters<UiOnParamsChanged['uiOnParamsChanged']>
  ) {
    paramsChanged(...args);
  }
  render() {
    return html`<div>Params Component</div>`;
  }
}

/** Instance/connection counters, reset per test by `resetCounts`. */
const counts: Record<
  string,
  { constructed: number; connected: number; disconnected: number }
> = {};

function countsFor(tag: string) {
  return (counts[tag] ??= { constructed: 0, connected: 0, disconnected: 0 });
}

function resetCounts() {
  for (const key of Object.keys(counts)) delete counts[key];
}

/** Base fixture that records its own lifecycle, so specs can assert churn. */
class CountedElement extends LitElement {
  static tag = 'counted-element';
  declare _uiViewProps?: UIViewInjectedProps;

  constructor() {
    super();
    countsFor((this.constructor as typeof CountedElement).tag).constructed++;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    countsFor((this.constructor as typeof CountedElement).tag).connected++;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    countsFor((this.constructor as typeof CountedElement).tag).disconnected++;
  }
}

@customElement('test-retained-shell')
class TestRetainedShell extends CountedElement {
  static tag = 'test-retained-shell';
  render() {
    return html`<div class="shell"><ui-view></ui-view></div>`;
  }
}

@customElement('test-retained-leaf')
class TestRetainedLeaf extends CountedElement implements UiOnParamsChanged {
  static tag = 'test-retained-leaf';
  @state() accessor starId = '';
  readonly propsSeen: (UIViewInjectedProps | undefined)[] = [];

  uiOnParamsChanged(params: { [key: string]: unknown }) {
    if (typeof params.starId === 'string') {
      this.starId = params.starId;
    }
  }

  render() {
    this.propsSeen.push(this._uiViewProps);
    return html`<div class="leaf">${this.starId}</div>`;
  }
}

@customElement('test-retained-other')
class TestRetainedOther extends CountedElement {
  static tag = 'test-retained-other';
  render() {
    return html`<div class="other">Other</div>`;
  }
}

@customElement('test-sticky-component')
class TestStickyComponent extends CountedElement {
  static tag = 'test-sticky-component';
  static sticky = true;
  render() {
    return html`<div class="sticky">Sticky</div>`;
  }
}

@customElement('test-params-receive-component')
class TestParamsReceiveComponent
  extends LitElement
  implements UiOnParamsChanged
{
  uiOnParamsChanged(
    ...args: Parameters<UiOnParamsChanged['uiOnParamsChanged']>
  ) {
    receiveParams(...args);
  }
  render() {
    return html`<div>Params Component</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-exit-component': TestExitComponent;
    'test-block-exit-component': TestBlockExitComponent;
    'test-params-component': TestParamsComponent;
    'test-params-receive-component': TestParamsReceiveComponent;
    'test-retained-shell': TestRetainedShell;
    'test-retained-leaf': TestRetainedLeaf;
    'test-retained-other': TestRetainedOther;
    'test-sticky-component': TestStickyComponent;
  }
}

describe('UiView', () => {
  let container: HTMLElement;
  let router: UIRouterLit;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    // Fresh, inert defaults so no handle leaks between tests.
    canExit = () => true;
    paramsChanged = () => {};
    receiveParams = () => {};
    resetCounts();
  });

  afterEach(() => {
    container.remove();
  });

  // What a deferred view holds: another render's nodes, opaque to core.
  const heldMarkup =
    '<div class="wrap"><p class="held">held</p></div>' +
    '<ui-view defer-hydration><p class="nested">nested</p></ui-view>';

  /** Parses a deferred `<ui-view>` inside a connected `<ui-router>`, the way the document arrives. */
  function mountHeld(
    attributes = 'defer-hydration',
    markup = heldMarkup,
  ): UiView {
    const uiRouterEl = document.createElement('ui-router');
    uiRouterEl.uiRouter = router;
    container.appendChild(uiRouterEl);
    uiRouterEl.innerHTML = `<ui-view ${attributes}>${markup}</ui-view>`;
    return uiRouterEl.querySelector('ui-view')!;
  }

  const homeStates: LitStateDeclaration[] = [
    {
      name: 'home',
      url: '/home',
      component: () => html`<div class="home-content">Home</div>`,
    },
  ];

  async function setupRouter(
    states: LitStateDeclaration[],
    options: { configure?: (uiView: UiView) => void; start?: boolean } = {},
  ): Promise<{ uiRouter: UIRouterLitElement; uiView: UiView }> {
    router = createTestRouter(states);

    const uiView = document.createElement('ui-view');
    options.configure?.(uiView);
    const { uiRouterEl: uiRouter } = await mountElementInRouter(
      uiView,
      router,
      container,
    );

    if (options.start !== false) {
      router.start();
      await tick();
    }

    return { uiRouter, uiView };
  }

  describe('initialization', () => {
    it('should be defined as a custom element', () => {
      expect(customElements.get('ui-view')).toBe(UiView);
    });

    // The @lit-labs/ssr DOM shim has no `createDocumentFragment` and never connects (#803).
    it('should construct and render before connection without a fragment API', () => {
      const createFragment = vi
        .spyOn(document, 'createDocumentFragment')
        .mockImplementation(() => {
          throw new TypeError(
            'document.createDocumentFragment is not a function',
          );
        });
      try {
        const uiView = document.createElement('ui-view');
        const result = uiView.render();

        expect(createFragment).not.toHaveBeenCalled();
        expect(result).toMatchObject({ strings: ['<slot></slot>'] });
      } finally {
        createFragment.mockRestore();
      }
    });

    it('should render without router context', async () => {
      // no ancestor provider, so this trips the dev-mode missing-router warning
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const uiView = document.createElement('ui-view');
      container.appendChild(uiView);
      await waitForUpdate(uiView);

      expect(uiView).toBeInstanceOf(UiView);
      warn.mockRestore();
    });

    it('should seek router from ancestor', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home', component: () => html`<div>Home</div>` },
      ];
      const { uiView } = await setupRouter(states);

      expect(uiView.uiRouter).toBe(router);
    });
  });

  describe('default view name', () => {
    it('should use $default as name when not specified', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home', component: () => html`<div>Home</div>` },
      ];
      await setupRouter(states);

      expect(router.viewService.available()).toContain('$default');
    });

    it('should use provided name attribute', async () => {
      const { uiView } = await setupRouter(
        [
          {
            name: 'home',
            url: '/home',
            views: {
              sidebar: { component: () => html`<div>Sidebar</div>` },
            },
          },
        ],
        {
          configure: (el) => el.setAttribute('name', 'sidebar'),
          start: false,
        },
      );

      expect(uiView.name).toBe('sidebar');
    });
  });

  describe('component rendering', () => {
    it('should render component when state is active', async () => {
      const states: LitStateDeclaration[] = [
        {
          name: 'home',
          url: '/home',
          component: () => html`<div class="home-content">Home Content</div>`,
        },
      ];
      const { uiView } = await setupRouter(states);

      await routerGo(router, 'home');
      await waitForUpdate(uiView);

      expect(uiView.innerHTML).toContain('home-content');
    });

    it('should pass router prop to component', async () => {
      let receivedProps: UIViewInjectedProps | undefined;

      const states: LitStateDeclaration[] = [
        {
          name: 'home',
          url: '/home',
          component: (props) => {
            receivedProps = props;
            return html`<div>Home</div>`;
          },
        },
      ];
      const { uiView } = await setupRouter(states);

      await routerGo(router, 'home');
      await waitForUpdate(uiView);

      expect(receivedProps?.router).toBe(router);
    });

    it('should pass transition prop to component', async () => {
      let receivedProps: UIViewInjectedProps | undefined;

      const states: LitStateDeclaration[] = [
        {
          name: 'home',
          url: '/home',
          component: (props) => {
            receivedProps = props;
            return html`<div>Home</div>`;
          },
        },
      ];
      const { uiView } = await setupRouter(states);

      await routerGo(router, 'home');
      await waitForUpdate(uiView);

      expect(receivedProps?.transition).toBeInstanceOf(Transition);
    });

    it('should pass resolves to component', async () => {
      let receivedProps: UIViewInjectedProps | undefined;

      const states: LitStateDeclaration[] = [
        {
          name: 'home',
          url: '/home',
          resolve: [
            {
              token: 'data',
              resolveFn: () => ({ message: 'Hello' }),
            },
          ],
          component: (props) => {
            receivedProps = props;
            return html`<div>Home</div>`;
          },
        },
      ];
      const { uiView } = await setupRouter(states);

      await routerGo(router, 'home');
      await waitForUpdate(uiView);

      expect(receivedProps?.resolves?.data).toEqual({ message: 'Hello' });
    });

    it('should clear component when navigating away', async () => {
      const states: LitStateDeclaration[] = [
        {
          name: 'home',
          url: '/home',
          component: () => html`<div class="home">Home</div>`,
        },
        {
          name: 'about',
          url: '/about',
          component: () => html`<div class="about">About</div>`,
        },
      ];
      const { uiView } = await setupRouter(states);

      await routerGo(router, 'home');
      await waitForUpdate(uiView);
      expect(uiView.innerHTML).toContain('home');

      await routerGo(router, 'about');
      await waitForUpdate(uiView);
      expect(uiView.innerHTML).toContain('about');
      expect(uiView.innerHTML).not.toContain('class="home"');
    });
  });

  describe('nested views', () => {
    it('should render nested views', async () => {
      const states: LitStateDeclaration[] = [
        {
          name: 'parent',
          url: '/parent',
          component: () =>
            html`<div class="parent">Parent<ui-view></ui-view></div>`,
        },
        {
          name: 'parent.child',
          url: '/child',
          component: () => html`<div class="child">Child</div>`,
        },
      ];
      const { uiView } = await setupRouter(states);

      await routerGo(router, 'parent.child');
      await tick(50);

      expect(uiView.innerHTML).toContain('parent');
      expect(uiView.innerHTML).toContain('child');
    });

    it('should track parent-child view relationship', async () => {
      const states: LitStateDeclaration[] = [
        {
          name: 'parent',
          url: '/parent',
          component: () =>
            html`<div class="parent">
              Parent<ui-view name="nested"></ui-view>
            </div>`,
        },
        {
          name: 'parent.child',
          url: '/child',
          views: {
            'nested@parent': { component: () => html`<div>Nested</div>` },
          },
        },
      ];
      await setupRouter(states);

      await routerGo(router, 'parent.child');
      await tick(50);

      // Verify nested view is properly registered
      const views = router.viewService['_uiViews'];
      const nestedView = views.find(
        (v: { name: string }) => v.name === 'nested',
      );
      expect(nestedView).toBeDefined();
    });
  });

  describe('fallback content', () => {
    it('should render slot content when no component is active', async () => {
      const { uiView } = await setupRouter([], {
        configure: (el) => {
          el.innerHTML = '<div class="fallback">Loading...</div>';
        },
        start: false,
      });

      expect(uiView.innerHTML).toContain('fallback');
    });
  });

  // `defer-hydration` is lit's own attribute: @lit-labs/ssr writes it on every
  // nested custom element, and a `<ui-view>` carrying it holds server content
  // between part markers rather than authored hold content.
  describe('defer-hydration', () => {
    it('should capture authored hold content when the attribute is absent', async () => {
      const { uiView } = await setupRouter([], {
        configure: (el) => {
          el.innerHTML = '<p class="hold">hold</p>';
        },
        start: false,
      });

      // Swept into `inner`: the authored <p> is gone from the light DOM and the
      // hold render replays a clone of it.
      const captured = uiView.render() as DocumentFragment;
      expect(captured).toBeInstanceOf(DocumentFragment);
      expect(captured.firstElementChild!.className).toBe('hold');
      expect(uiView.querySelectorAll('p.hold')).toHaveLength(1);
    });

    it('should read the attribute the parser wrote, before connect', async () => {
      router = createTestRouter([]);
      const uiRouterEl = document.createElement('ui-router');
      uiRouterEl.uiRouter = router;
      container.appendChild(uiRouterEl);
      // Parsed with the attribute already on it, the way server output arrives.
      uiRouterEl.innerHTML =
        '<ui-view defer-hydration><p class="server">server</p></ui-view>';
      const uiView = uiRouterEl.querySelector('ui-view')!;
      await waitForUpdate(uiView);

      expect(uiView.deferHydration).toBe(true);
      // Capture skipped, so the hold render is the bare slot template.
      expect(uiView.render()).toMatchObject({ strings: ['<slot></slot>'] });
      expect(uiView.querySelector('p.server')).not.toBeNull();
    });

    it('should not capture server content when the attribute is present', async () => {
      const { uiView } = await setupRouter([], {
        configure: (el) => {
          el.setAttribute('defer-hydration', '');
          el.innerHTML = '<p class="server">server</p>';
        },
        start: false,
      });

      expect(uiView.deferHydration).toBe(true);

      // Never captured, so `inner` was never created and the hold render is the
      // bare slot template rather than a clone: markerless content is not ours.
      expect(uiView.render()).toMatchObject({ strings: ['<slot></slot>'] });
      const server = uiView.querySelector('p.server')!;
      expect(server.parentElement).toBe(uiView);
      expect(uiView.firstElementChild).toBe(server);
    });

    it('should not run any update while the attribute is present', async () => {
      router = createTestRouter([]);
      const uiView = mountHeld();
      const before = [...uiView.childNodes];

      await tick();

      expect(uiView.hasUpdated).toBe(false);
      expect([...uiView.childNodes]).toEqual(before);
    });
  });

  describe('waking from defer-hydration', () => {
    it('should re-register on the provided router when the attribute is removed', async () => {
      // No router on <ui-router>, so it provides a placeholder of its own and
      // the view registers against that — the prerendered upgrade order.
      const uiRouterEl = document.createElement('ui-router');
      const uiView = document.createElement('ui-view');
      uiView.setAttribute('defer-hydration', '');
      container.appendChild(uiRouterEl);
      uiRouterEl.appendChild(uiView);
      await waitForUpdate(uiView);

      router = createTestRouter([
        {
          name: 'home',
          url: '/home',
          component: () => html`<div class="home-content">Home</div>`,
        },
      ]);
      uiRouterEl.uiRouter = router;

      uiView.removeAttribute('defer-hydration');
      await waitForUpdate(uiView);

      expect(uiView.deferHydration).toBe(false);
      expect(uiView.uiRouter).toBe(router);

      router.start();
      await tick();

      await routerGo(router, 'home');
      await waitForUpdate(uiView);

      expect(uiView.querySelector('.home-content')).not.toBeNull();
    });

    it('should re-seek before a first update, where lit records no old value', async () => {
      const uiRouterEl = document.createElement('ui-router');
      const uiView = document.createElement('ui-view');
      uiView.setAttribute('defer-hydration', '');
      container.appendChild(uiRouterEl);
      uiRouterEl.appendChild(uiView);

      router = createTestRouter([
        {
          name: 'home',
          url: '/home',
          component: () => html`<div class="home-content">Home</div>`,
        },
      ]);
      uiRouterEl.uiRouter = router;
      // Same task as the connect: the wake update is the view's first update.
      uiView.removeAttribute('defer-hydration');
      await waitForUpdate(uiView);

      expect(uiView.deferHydration).toBe(false);
      expect(uiView.uiRouter).toBe(router);
    });

    it('should leave a view already registered on the real router alone', async () => {
      const { uiView } = await setupRouter([
        { name: 'home', url: '/home', component: () => html`<div>Home</div>` },
      ]);
      const registerUIView = vi.spyOn(router.viewService, 'registerUIView');

      uiView.setAttribute('defer-hydration', '');
      await waitForUpdate(uiView);
      uiView.removeAttribute('defer-hydration');
      await waitForUpdate(uiView);

      expect(registerUIView).not.toHaveBeenCalled();
      expect(uiView.uiRouter).toBe(router);
      expect(router.viewService.available()).toHaveLength(1);
    });

    it('should hand the woken view to an adopter, re-sought and unrendered', async () => {
      // No router on <ui-router>, so it provides a placeholder of its own and
      // the view registers against that — the prerendered upgrade order.
      const uiRouterEl = document.createElement('ui-router');
      container.appendChild(uiRouterEl);
      uiRouterEl.innerHTML = `<ui-view defer-hydration>${heldMarkup}</ui-view>`;
      const uiView = uiRouterEl.querySelector('ui-view')!;
      await waitForUpdate(uiView);

      router = createTestRouter(homeStates);
      uiRouterEl.uiRouter = router;

      let seenRouter: unknown;
      let seenHasUpdated: boolean | undefined;
      let seenHeld: Element | null = null;
      const adopt = vi.fn((view: UiView) => {
        seenRouter = view.uiRouter;
        seenHasUpdated = view.hasUpdated;
        seenHeld = view.querySelector('p.held');
      });
      const uninstall = provideContext(container, adoptUiViewContext, adopt);
      try {
        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);
      } finally {
        uninstall();
      }

      expect(adopt).toHaveBeenCalledTimes(1);
      expect(adopt.mock.calls[0]?.[0]).toBe(uiView);
      // The re-seek runs first, so the adopter renders against the real router.
      expect(seenRouter).toBe(router);
      // And it runs before this update's render, so the adopter owns that render.
      expect(seenHasUpdated).toBe(false);
      // The held nodes are still there for the adopter to take.
      expect(seenHeld).not.toBeNull();
    });

    it('should keep its held nodes for the adopter when it reconnects after the wake is queued', async () => {
      const uiRouterEl = document.createElement('ui-router');
      container.appendChild(uiRouterEl);
      uiRouterEl.innerHTML = `<ui-view defer-hydration>${heldMarkup}</ui-view>`;
      const uiView = uiRouterEl.querySelector('ui-view')!;
      await waitForUpdate(uiView);

      router = createTestRouter(homeStates);
      uiRouterEl.uiRouter = router;

      let seenHeld: Element | null = null;
      let seenNested: Element | null = null;
      const adopt = vi.fn((view: UiView) => {
        seenHeld = view.querySelector('p.held');
        seenNested = view.querySelector('ui-view');
      });
      const uninstall = provideContext(container, adoptUiViewContext, adopt);
      try {
        // Detach, wake, re-attach in one task: the connect runs before the queued update.
        uiView.remove();
        uiView.removeAttribute('defer-hydration');
        uiRouterEl.append(uiView);
        await waitForUpdate(uiView);
      } finally {
        uninstall();
      }

      expect(adopt).toHaveBeenCalledTimes(1);
      expect(adopt.mock.calls[0]?.[0]).toBe(uiView);
      // The reconnect must not sweep the served nodes aside as authored hold content.
      expect(seenHeld).not.toBeNull();
      expect(seenNested).not.toBeNull();
      expect(uiView.querySelector('p.held')).not.toBeNull();
      expect(uiView.querySelector('.home-content')).toBeNull();
    });

    it('should not request an adopter again on a later update', async () => {
      router = createTestRouter(homeStates);
      const uiView = mountHeld();
      const adopt = vi.fn();
      const uninstall = provideContext(container, adoptUiViewContext, adopt);
      try {
        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);
        expect(adopt).toHaveBeenCalledTimes(1);

        router.start();
        await routerGo(router, 'home');
        await waitForUpdate(uiView);

        expect(adopt).toHaveBeenCalledTimes(1);
        expect(uiView.hasUpdated).toBe(true);
      } finally {
        uninstall();
      }
    });

    it('should not reach a provider installed off the path it requests on', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const elsewhere = document.createElement('div');
      container.appendChild(elsewhere);
      const adopt = vi.fn();
      const uninstall = provideContext(elsewhere, adoptUiViewContext, adopt);
      try {
        router = createTestRouter(homeStates);
        const uiView = mountHeld();

        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);

        expect(adopt).not.toHaveBeenCalled();
        expect(uiView.querySelector('p.held')).toBeNull();
      } finally {
        uninstall();
        warn.mockRestore();
      }
    });

    it('should stop being answered once the provider is uninstalled', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const adopt = vi.fn();
      const uninstall = provideContext(container, adoptUiViewContext, adopt);
      uninstall();
      try {
        router = createTestRouter(homeStates);
        const uiView = mountHeld();

        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);

        expect(adopt).not.toHaveBeenCalled();
        expect(uiView.querySelector('p.held')).toBeNull();
      } finally {
        warn.mockRestore();
      }
    });

    it('should drop the held nodes and warn when nothing answers', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        router = createTestRouter(homeStates);
        const uiView = mountHeld();
        router.start();
        await routerGo(router, 'home');
        await tick();

        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);

        // Dropped, not rendered over: a cold render on top would double them.
        expect(uiView.querySelector('p.held')).toBeNull();
        expect(uiView.querySelector('ui-view')).toBeNull();
        expect(uiView.querySelector('.home-content')).not.toBeNull();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toBe(
          'lit-ui-router: this <ui-view> woke from defer-hydration and ' +
            'nothing answered its adoptUiViewContext request, so its held ' +
            'nodes were dropped and it rendered cold. Provide an adopter ' +
            'before the wake.',
        );
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('uiCanExit hook', () => {
    it('should call uiCanExit on component before exiting', async () => {
      const uiCanExitSpy = vi.fn().mockReturnValue(true);
      canExit = uiCanExitSpy;

      const states: LitStateDeclaration[] = [
        {
          name: 'home',
          url: '/home',
          component: TestExitComponent,
        },
        {
          name: 'about',
          url: '/about',
          component: () => html`<div>About</div>`,
        },
      ];
      const { uiView } = await setupRouter(states);

      await routerGo(router, 'home');
      await waitForUpdate(uiView);
      await tick(50);

      await routerGo(router, 'about');
      await tick(50);

      expect(uiCanExitSpy).toHaveBeenCalled();
    });

    it('should prevent navigation when uiCanExit returns false', async () => {
      const states: LitStateDeclaration[] = [
        {
          name: 'home',
          url: '/home',
          component: TestBlockExitComponent,
        },
        {
          name: 'about',
          url: '/about',
          component: () => html`<div>About</div>`,
        },
      ];
      const { uiView } = await setupRouter(states);

      await routerGo(router, 'home');
      await waitForUpdate(uiView);
      await tick(50);

      try {
        await router.stateService.go('about');
      } catch {
        // Transition rejected
      }
      await tick(50);

      // Should still be on home
      expect(router.globals.current.name).toBe('home');
    });
  });

  describe('uiOnParamsChanged hook', () => {
    it('should call uiOnParamsChanged when params change', async () => {
      const onParamsChangedSpy = vi.fn();
      paramsChanged = onParamsChangedSpy;

      const states: LitStateDeclaration[] = [
        {
          name: 'user',
          url: '/user/:id',
          params: {
            id: { dynamic: true },
          },
          component: TestParamsComponent,
        },
      ];
      const { uiView } = await setupRouter(states);

      await routerGo(router, 'user', { id: '1' });
      await waitForUpdate(uiView);
      await tick(50);

      await routerGo(router, 'user', { id: '2' });
      await tick(50);

      expect(onParamsChangedSpy).toHaveBeenCalled();
    });

    it('should pass changed params to uiOnParamsChanged', async () => {
      let receivedParams: Record<string, unknown> | undefined;
      receiveParams = (newParams) => {
        receivedParams = newParams;
      };

      const states: LitStateDeclaration[] = [
        {
          name: 'user',
          url: '/user/:id',
          params: {
            id: { dynamic: true },
          },
          component: TestParamsReceiveComponent,
        },
      ];
      const { uiView } = await setupRouter(states);

      await routerGo(router, 'user', { id: '1' });
      await waitForUpdate(uiView);
      await tick(50);

      await routerGo(router, 'user', { id: '2' });
      await tick(50);

      expect(receivedParams).toBeDefined();
      expect(receivedParams?.id).toBe('2');
    });
  });

  describe('cleanup', () => {
    it('should deregister view on disconnect', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home', component: () => html`<div>Home</div>` },
      ];
      const { uiView } = await setupRouter(states);

      const initialViewCount = router.viewService['_uiViews'].length;

      uiView.remove();
      await tick();

      const afterViewCount = router.viewService['_uiViews'].length;
      expect(afterViewCount).toBeLessThan(initialViewCount);
    });

    it('should deregister transition hooks on disconnect', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home', component: () => html`<div>Home</div>` },
      ];
      const { uiView } = await setupRouter(states);

      await routerGo(router, 'home');
      await waitForUpdate(uiView);

      // Get initial hook count
      const initialHookCount =
        router.transitionService.getHooks('onBefore').length;

      uiView.remove();
      await tick();

      const afterHookCount =
        router.transitionService.getHooks('onBefore').length;
      expect(afterHookCount).toBeLessThan(initialHookCount);
    });
  });

  describe('seekParentView static method', () => {
    it('should find parent ui-view', async () => {
      const states: LitStateDeclaration[] = [
        {
          name: 'parent',
          url: '/parent',
          component: () => html`<div class="parent"><ui-view></ui-view></div>`,
        },
        {
          name: 'parent.child',
          url: '/child',
          component: () => html`<div class="child">Child</div>`,
        },
      ];
      const { uiView } = await setupRouter(states);

      await routerGo(router, 'parent.child');
      await tick(50);

      const nestedView = uiView.querySelector('ui-view');
      if (nestedView) {
        const parentView = UiView.seekParentView(nestedView);
        expect(parentView).toBe(uiView);
      }
    });

    it('should return null when no parent view exists', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home', component: () => html`<div>Home</div>` },
      ];
      await setupRouter(states);

      const orphan = document.createElement('div');
      container.appendChild(orphan);

      const parentView = UiView.seekParentView(orphan);
      expect(parentView).toBeNull();
    });
  });
  describe('re-registration while detached', () => {
    const detachedStates: LitStateDeclaration[] = [
      {
        name: 'galaxy',
        url: '/galaxy',
        component: () => html`<div class="shell"><ui-view></ui-view></div>`,
      },
      {
        name: 'galaxy.star',
        url: '/star',
        component: () => html`<div class="star">Star</div>`,
      },
    ];

    /** An outer view rendering a state whose component nests a second `<ui-view>`. */
    async function mountNested() {
      const { uiRouter, uiView } = await setupRouter(detachedStates);
      await routerGo(router, 'galaxy.star');
      await tick(50);

      const nested = uiView.querySelector('ui-view')!;
      expect(nested).toBeTruthy();
      expect(nested['_uiViewData'].fqn).toBe('$default.$default');
      return { uiRouter, uiView, nested };
    }

    function registeredIds(target: UIRouterLit) {
      return target.viewService['_uiViews'].map(
        (view: ActiveUIView) => view.id,
      );
    }

    /** The wake's own path: a real router replaces the one the view registered with. */
    function adoptUpgraded(view: UiView, upgraded: UIRouterLit) {
      view['routerFromProvider'] = false;
      view.uiRouter = upgraded;
      view['adoptProvidedRouter']();
    }

    it('should not re-register a detached nested view at the root context', async () => {
      const { uiRouter, uiView, nested } = await mountNested();
      const upgraded = createTestRouter(detachedStates);

      uiRouter.remove();
      await tick();
      adoptUpgraded(nested, upgraded);

      expect(nested['_uiViewData'].fqn).toBe('$default.$default');
      expect(nested['parentView']).toBe(uiView);
      expect(registeredIds(upgraded)).not.toContain(nested['viewId']);
    });

    it('should re-register with the parent found once the subtree re-attaches', async () => {
      const { uiView, nested } = await mountNested();
      const shell = uiView.querySelector('.shell')!;
      const upgraded = createTestRouter(detachedStates);

      shell.remove();
      await tick();
      expect(registeredIds(router)).not.toContain(nested['viewId']);

      uiView.appendChild(shell);
      await tick();

      expect(nested['_uiViewData'].fqn).toBe('$default.$default');
      expect(nested['parentView']).toBe(uiView);
      expect(registeredIds(router)).toContain(nested['viewId']);

      // Connected, the upgraded router is adopted: same parent, same fqn, registered on the new router.
      adoptUpgraded(nested, upgraded);

      expect(nested['_uiViewData'].fqn).toBe('$default.$default');
      expect(nested['parentView']).toBe(uiView);
      expect(registeredIds(upgraded)).toContain(nested['viewId']);
    });
  });
  describe('missing <ui-router> ancestor', () => {
    it('should warn once when a view updates with no router', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const uiView = document.createElement('ui-view');
        uiView.textContent = 'fallback';
        container.appendChild(uiView);
        await waitForUpdate(uiView);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toBe(
          'lit-ui-router: <ui-view> found no <ui-router> ancestor, so it ' +
            'will never render a routed view. Wrap this subtree in ' +
            '<ui-router>, or pass a router explicitly.',
        );

        // the no-op is unchanged: still a UiView, still no throw
        expect(uiView).toBeInstanceOf(UiView);

        // and a further update does not repeat itself: `firstUpdated` runs
        // once, and the shared WeakSet backstops it
        uiView.requestUpdate();
        await waitForUpdate(uiView);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('should stay silent outside lit dev mode', async () => {
      // ReactiveElement.enableWarning exists only in lit's development build,
      // which is what production consumers resolve away from
      const enableWarning = UIRouterLitElement.enableWarning;
      UIRouterLitElement.enableWarning = undefined;
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const uiView = document.createElement('ui-view');
        container.appendChild(uiView);
        await waitForUpdate(uiView);

        expect(warn).not.toHaveBeenCalled();
        // only the warning is gated, never the behaviour
        expect(uiView).toBeInstanceOf(UiView);
      } finally {
        warn.mockRestore();
        UIRouterLitElement.enableWarning = enableWarning;
      }
    });

    it('should confirm the specs run against lit dev mode', () => {
      // the guard above is only meaningful if the suite sees dev lit; without
      // this, every warning spec could pass vacuously
      expect(typeof UIRouterLitElement.enableWarning).toBe('function');
    });

    it('should not warn when a router ancestor is present', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { uiView } = await setupRouter([
          {
            name: 'home',
            url: '/home',
            component: () => html`<div>Home</div>`,
          },
        ]);
        await routerGo(router, 'home');

        expect(uiView.uiRouter).toBe(router);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  });
  // https://github.com/simshanith/lit-ui-router/issues/723
  describe('routed element identity', () => {
    const nestedStates: LitStateDeclaration[] = [
      { name: 'galaxy', url: '/galaxy', component: TestRetainedShell },
      {
        name: 'galaxy.star',
        url: '/star/:starId',
        component: TestRetainedLeaf,
      },
      { name: 'other', url: '/other', component: TestRetainedOther },
    ];

    // A dynamic param leaves the state in `retained`, which is the case this
    // gate is about. A non-dynamic param re-enters the state, and rebuilding
    // the element there is correct — see the nested spec below.
    const dynamicStar: LitStateDeclaration = {
      name: 'star',
      url: '/star/:starId',
      params: { starId: { dynamic: true } },
      component: TestRetainedLeaf,
    };

    it('should keep the same element when only params change', async () => {
      const { uiView } = await setupRouter([dynamicStar]);

      await routerGo(router, 'star', { starId: 'sun' });
      const first = uiView.firstElementChild;
      expect(first).toBeInstanceOf(TestRetainedLeaf);

      await routerGo(router, 'star', { starId: 'rigel' });

      expect(uiView.firstElementChild).toBe(first);
      expect(countsFor('test-retained-leaf').constructed).toBe(1);
      expect(countsFor('test-retained-leaf').disconnected).toBe(0);
    });

    it('should deliver fresh props and params to the retained element', async () => {
      const { uiView } = await setupRouter([dynamicStar]);

      await routerGo(router, 'star', { starId: 'sun' });
      const leaf = uiView.firstElementChild as TestRetainedLeaf;
      const firstProps = leaf._uiViewProps;
      expect(firstProps?.router).toBe(router);

      await routerGo(router, 'star', { starId: 'rigel' });
      await waitForUpdate(leaf);

      // Same element, new props object, and `uiOnParamsChanged` observed on the
      // instance that held the previous params — which only reuse makes true.
      expect(uiView.firstElementChild).toBe(leaf);
      expect(leaf._uiViewProps).not.toBe(firstProps);
      expect(leaf._uiViewProps?.router).toBe(router);
      expect(leaf.starId).toBe('rigel');
      expect(leaf.textContent).toContain('rigel');
      expect(leaf.propsSeen.length).toBeGreaterThan(1);
    });

    it('should not rebuild a retained parent when a child param changes', async () => {
      const { uiView } = await setupRouter(nestedStates);

      await routerGo(router, 'galaxy.star', { starId: 'sun' });
      const shell = uiView.firstElementChild as TestRetainedShell;
      expect(shell).toBeInstanceOf(TestRetainedShell);
      const nestedView = shell.querySelector('ui-view');
      expect(nestedView).toBeTruthy();

      await routerGo(router, 'galaxy.star', { starId: 'rigel' });

      // The retained shell, its nested <ui-view>, and the leaf all survive: the
      // rebuild cascade that clamped scroll position in #723 never starts.
      expect(uiView.firstElementChild).toBe(shell);
      expect(shell.querySelector('ui-view')).toBe(nestedView);
      expect(countsFor('test-retained-shell').constructed).toBe(1);
      expect(countsFor('test-retained-shell').disconnected).toBe(0);
      // The leaf's own param is not dynamic, so `galaxy.star` really re-enters
      // and a fresh leaf is correct. Only the retained ancestor must survive.
      expect(countsFor('test-retained-leaf').constructed).toBe(2);
    });

    it('should mint a new element when the state changes', async () => {
      const { uiView } = await setupRouter(nestedStates);

      await routerGo(router, 'galaxy.star', { starId: 'sun' });
      const shell = uiView.firstElementChild;

      await routerGo(router, 'other');

      expect(uiView.firstElementChild).toBeInstanceOf(TestRetainedOther);
      expect(uiView.firstElementChild).not.toBe(shell);
      expect(countsFor('test-retained-shell').disconnected).toBe(1);
    });

    it('should build a fresh element when a non-sticky state is re-entered', async () => {
      const { uiView } = await setupRouter(nestedStates);

      await routerGo(router, 'galaxy.star', { starId: 'sun' });
      const first = uiView.firstElementChild;

      await routerGo(router, 'other');
      await routerGo(router, 'galaxy.star', { starId: 'sun' });

      expect(uiView.firstElementChild).toBeInstanceOf(TestRetainedShell);
      expect(uiView.firstElementChild).not.toBe(first);
      expect(countsFor('test-retained-shell').constructed).toBe(2);
    });

    it('should reuse a sticky instance across exit and re-entry', async () => {
      const { uiView } = await setupRouter([
        { name: 'sticky', url: '/sticky', component: TestStickyComponent },
        { name: 'other', url: '/other', component: TestRetainedOther },
      ]);

      await routerGo(router, 'sticky');
      const first = uiView.firstElementChild;
      expect(first).toBeInstanceOf(TestStickyComponent);

      await routerGo(router, 'other');
      await routerGo(router, 'sticky');

      expect(uiView.firstElementChild).toBe(first);
      expect(countsFor('test-sticky-component').constructed).toBe(1);
    });
  });
});

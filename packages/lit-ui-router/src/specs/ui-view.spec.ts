import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { Transition } from '@uirouter/core';

import { UiView } from '../ui-view.js';
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

    // The @lit-labs/ssr DOM shim constructs elements but has no
    // `createDocumentFragment`, and never connects them (#803).
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

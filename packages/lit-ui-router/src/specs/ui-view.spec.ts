import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, LitElement, nothing } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ActiveUIView, Transition } from '@uirouter/core';

import { UiView } from '../ui-view.js';
import {
  ContextRequestEvent,
  parentUiViewContext,
  provideRouter,
  requestContext,
  routerContext,
} from '../context.js';
import type { ParentUiView } from '../context.js';
import '../ui-view.register.js';
import { UIRouterLitElement } from '../ui-router.js';
import type { UiViewContextEvent } from '../events.js';
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
  @state() starId = '';
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

/** Authors the fallback from an enclosing lit template, so the nodes are a TemplateInstance's own: a `<slot>` plus a live binding. */
@customElement('test-fallback-host')
class TestFallbackHost extends LitElement {
  @state() label = 'first';
  render() {
    return html`<ui-view
      ><slot></slot>
      <p class="fallback">${this.label}</p></ui-view
    >`;
  }
}

/**
 * The hooks a subclass that fills the element itself overrides: no capture at
 * connect, and the capture taken in place on the first update instead.
 */
class TestInPlaceView extends UiView {
  protected override captureContent(): void {}

  protected override willUpdate(changed: PropertyValues<this>): void {
    this.captureContentInPlace();
    super.willUpdate(changed);
  }
}

customElements.define('test-in-place-view', TestInPlaceView);

declare global {
  interface HTMLElementTagNameMap {
    'test-in-place-view': TestInPlaceView;
    'test-fallback-host': TestFallbackHost;
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

  // A render's nodes between the part markers that render wrote, opaque to core.
  const heldMarkup =
    '<!--lit-part vXOrb1NPBFc=-->' +
    '<div class="wrap"><p class="held">held</p></div>' +
    '<ui-view><p class="nested">nested</p></ui-view>' +
    '<!--/lit-part-->';

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

    it('should capture authored hold content when the attribute is absent', async () => {
      const { uiView } = await setupRouter([], {
        configure: (el) => {
          el.innerHTML = '<p class="hold">hold</p>';
        },
        start: false,
      });

      // Taken as the fallback set: the authored <p> stands in the light DOM as
      // itself, ahead of lit's marker, and the hold render adds nothing over it.
      expect(uiView.render()).toBe(nothing);
      expect(uiView.querySelectorAll('p.hold')).toHaveLength(1);
      expect(uiView.firstElementChild!.className).toBe('hold');
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

  // A re-attached ancestor runs `connectedCallback` again on views that have
  // already rendered: lit's own nodes and part markers are not hold content.
  describe('reconnecting a rendered view', () => {
    const reconnectStates: LitStateDeclaration[] = [
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
      { name: 'blank', url: '/blank' },
    ];

    it('should keep rendering its state after its router is re-attached', async () => {
      const { uiRouter, uiView } = await setupRouter(reconnectStates);

      await routerGo(router, 'home');
      await waitForUpdate(uiView);
      expect(uiView.innerHTML).toContain('class="home"');

      uiRouter.remove();
      await tick();
      container.appendChild(uiRouter);
      await waitForUpdate(uiView);

      expect(uiView.innerHTML).toContain('class="home"');

      await routerGo(router, 'about');
      await waitForUpdate(uiView);
      expect(uiView.innerHTML).toContain('class="about"');
    });

    it('should replay the hold content captured at first connect after a reconnect', async () => {
      const { uiRouter, uiView } = await setupRouter(reconnectStates, {
        configure: (el) => {
          el.innerHTML = '<p class="hold">hold</p>';
        },
      });

      await routerGo(router, 'home');
      await waitForUpdate(uiView);
      expect(uiView.querySelector('p.hold')).toBeNull();

      uiRouter.remove();
      await tick();
      container.appendChild(uiRouter);
      await waitForUpdate(uiView);

      await routerGo(router, 'blank');
      await waitForUpdate(uiView);

      expect(uiView.querySelectorAll('p.hold')).toHaveLength(1);
      expect(uiView.innerHTML).not.toContain('class="home"');
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

    /** The re-seek hook's own path: a real router the app assigned replaces the one the view sought. */
    function adoptUpgraded(view: UiView, upgraded: UIRouterLit) {
      view.uiRouter = upgraded;
      (
        view as unknown as { adoptProvidedRouter(): void }
      ).adoptProvidedRouter();
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

  // Which router a view holds is provenance, not a value: one a seek produced
  // can be superseded by a provider that upgraded late or by the
  // `<ui-router>` the view has just been attached under, while one the app
  // assigned is final.
  describe('router provenance', () => {
    function registeredCount(target: UIRouterLit) {
      return target.viewService['_uiViews'].length;
    }

    it('should register once a provider answers after it connected', async () => {
      router = createTestRouter(homeStates);
      // Connected with nothing to answer the seek: the upgrade-order case.
      const uiView = document.createElement('ui-view');
      container.appendChild(uiView);
      // Installed in the same task, so the provider is there by the first update.
      const uninstall = provideRouter(container, router);
      try {
        await waitForUpdate(uiView);

        expect(uiView.uiRouter).toBe(router);
        expect(router.viewService.available()).toContain('$default');

        router.start();
        await routerGo(router, 'home');
        await waitForUpdate(uiView);

        expect(uiView.querySelector('.home-content')).not.toBeNull();
      } finally {
        uninstall();
      }
    });

    it('should re-register with the <ui-router> it is moved under', async () => {
      // Its own declarations per router: registering one twice rebinds it to the later registry.
      const ownHomeStates = (): LitStateDeclaration[] => [
        {
          name: 'home',
          url: '/home',
          component: () => html`<div class="home-content">Home</div>`,
        },
      ];
      const routerA = createTestRouter(ownHomeStates());
      const routerB = createTestRouter(ownHomeStates());
      const elementA = document.createElement('ui-router');
      elementA.uiRouter = routerA;
      const elementB = document.createElement('ui-router');
      elementB.uiRouter = routerB;
      container.append(elementA, elementB);

      const uiView = document.createElement('ui-view');
      elementA.appendChild(uiView);
      routerA.start();
      routerB.start();
      await routerGo(routerA, 'home');
      await waitForUpdate(uiView);
      expect(uiView.querySelector('.home-content')).not.toBeNull();

      elementB.appendChild(uiView);
      await waitForUpdate(uiView);

      expect(uiView.uiRouter).toBe(routerB);
      expect(registeredCount(routerA)).toBe(0);
      expect(registeredCount(routerB)).toBe(1);

      // Views below ask this one for the router, so they must be told the same.
      const nested = document.createElement('div');
      uiView.appendChild(nested);
      expect(UIRouterLitElement.seekRouter(nested)).toBe(routerB);
    });
  });

  describe('parent-view seek across a shadow boundary', () => {
    /** A `ui-view-context` event as a listener outside the source's shadow root sees it: `target` retargeted to the host. */
    function retargeted(host: UiView, source: Node): UiViewContextEvent {
      const event = new CustomEvent(UIRouterLitElement.uiViewContextEventName, {
        bubbles: true,
        composed: true,
        detail: { parentView: null },
      }) as UiViewContextEvent;
      Object.defineProperty(event, 'target', { value: host });
      Object.defineProperty(event, 'composedPath', {
        value: () => [source, host],
      });
      return event;
    }

    it('should answer for a view inside its own shadow root', async () => {
      const { uiView } = await setupRouter(homeStates);
      const inner = document.createElement('ui-view');

      const event = retargeted(uiView, inner);
      uiView['onUiViewContextEvent'](event);

      expect(event.detail.parentView).toBe(uiView);
    });

    it('should still decline the seek it dispatched itself', async () => {
      const { uiView } = await setupRouter(homeStates);

      const event = retargeted(uiView, uiView);
      uiView['onUiViewContextEvent'](event);

      expect(event.detail.parentView).toBeNull();
    });

    /** A `context-request` for {@link parentUiViewContext} as a listener outside the source's shadow root sees it: `target` retargeted to the host. */
    function retargetedRequest(
      host: UiView,
      source: Node,
      callback: (value: ParentUiView | undefined) => void,
    ): Event {
      const event = new ContextRequestEvent(parentUiViewContext, callback);
      Object.defineProperty(event, 'target', { value: host });
      Object.defineProperty(event, 'composedPath', {
        value: () => [source, host],
      });
      return event;
    }

    it('should answer a request from a view inside its own shadow root', async () => {
      const { uiView } = await setupRouter(homeStates);
      const inner = document.createElement('ui-view');
      const callback = vi.fn();

      const event = retargetedRequest(uiView, inner, callback);
      uiView['onParentViewContextRequest'](event);

      expect(callback).toHaveBeenCalledWith(uiView, undefined);
    });

    it('should still decline the request it dispatched itself', async () => {
      const { uiView } = await setupRouter(homeStates);
      const callback = vi.fn();

      const event = retargetedRequest(uiView, uiView, callback);
      uiView['onParentViewContextRequest'](event);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('capturing hold content', () => {
    const holdStates: LitStateDeclaration[] = [
      ...homeStates,
      { name: 'blank', url: '/blank' },
    ];

    it('should not capture a rendered view’s own nodes from a clone', async () => {
      const { uiRouter, uiView } = await setupRouter(holdStates);
      await routerGo(router, 'home');
      await waitForUpdate(uiView);
      expect(uiView.querySelector('.home-content')).not.toBeNull();

      // A clone carries lit's nodes and part markers with `hasUpdated` false.
      const clone = uiView.cloneNode(true) as UiView;
      uiRouter.appendChild(clone);
      await waitForUpdate(clone);

      expect(clone['fallback']).toBeUndefined();

      await routerGo(router, 'blank');
      await waitForUpdate(clone);

      // Nothing was captured, so the hold render is the bare slot template
      // rather than a replay of the routed markup the clone carried.
      expect(clone.render()).toMatchObject({ strings: ['<slot></slot>'] });
    });

    it('should capture at most once across a re-attach before its first update', async () => {
      router = createTestRouter(holdStates);
      const uiRouterEl = document.createElement('ui-router');
      uiRouterEl.uiRouter = router;
      container.appendChild(uiRouterEl);

      const uiView = document.createElement('ui-view');
      uiView.innerHTML = '<p class="hold">hold</p>';
      uiRouterEl.appendChild(uiView);
      // Detached and re-attached in the same task, with content arriving in between.
      uiView.remove();
      uiView.innerHTML = '<p class="late">late</p>';
      uiRouterEl.appendChild(uiView);
      await waitForUpdate(uiView);

      // One capture: the fallback set is the first attach's node, taken once,
      // and `<p class="late">` arrived too late to join it.
      const fallbackNodes = uiView['fallbackNodes'] as Element[];
      expect(fallbackNodes.map((node) => node.className)).toEqual(['hold']);
      expect(uiView.querySelectorAll('p.hold')).toHaveLength(1);
    });

    it('should capture only what stands ahead of a render it connects with', async () => {
      router = createTestRouter(holdStates);
      const uiRouterEl = document.createElement('ui-router');
      uiRouterEl.uiRouter = router;
      container.appendChild(uiRouterEl);

      const uiView = document.createElement('ui-view');
      uiView.innerHTML = `<p class="hold">hold</p>${heldMarkup}`;
      uiRouterEl.appendChild(uiView);
      await waitForUpdate(uiView);

      // Never deferred, so the capture is the connect's: the render's nodes and
      // markers behind the authored <p> are no part of the fallback set.
      const fallbackNodes = uiView['fallbackNodes'] as Element[];
      expect(fallbackNodes).toHaveLength(1);
      expect(fallbackNodes[0]).toBe(uiView.querySelector('p.hold'));
      expect(uiView.querySelector('p.held')).not.toBeNull();
    });
  });

  // The fallback set is moved, never copied, so the nodes on screen are the
  // authored ones and any binding inside them stays live.
  describe('fallback content identity', () => {
    const fallbackStates: LitStateDeclaration[] = [
      ...homeStates,
      { name: 'blank', url: '/blank' },
    ];

    /** Mounts a host whose shadow template authors the fallback, so the nodes are lit's own. */
    async function mountFallbackHost() {
      router = createTestRouter(fallbackStates);
      const host = document.createElement('test-fallback-host');
      await mountElementInRouter(host, router, container);
      router.start();
      await tick();
      const uiView = host.shadowRoot!.querySelector('ui-view')!;
      await waitForUpdate(uiView);
      return { host, uiView };
    }

    /** Mounts static fallback markup, present on the element before it connects. */
    async function mountAuthoredFallback() {
      const { uiView } = await setupRouter(fallbackStates, {
        configure: (el) => {
          el.innerHTML = '<p class="hold">hold</p>';
        },
      });
      await waitForUpdate(uiView);
      return uiView;
    }

    async function cycle(uiView: UiView) {
      await routerGo(router, 'home');
      await waitForUpdate(uiView);
      await routerGo(router, 'blank');
      await waitForUpdate(uiView);
    }

    it('should keep the same authored <slot> across component transitions', async () => {
      const { uiView } = await mountFallbackHost();
      const slot = uiView.querySelector('slot');
      expect(slot).not.toBeNull();

      await cycle(uiView);
      expect(uiView.querySelector('slot')).toBe(slot);

      await cycle(uiView);
      expect(uiView.querySelector('slot')).toBe(slot);
    });

    it('should keep a binding inside the fallback live', async () => {
      const { host, uiView } = await mountFallbackHost();
      expect(uiView.querySelector('p.fallback')!.textContent).toBe('first');

      host.label = 'second';
      await waitForUpdate(host);
      expect(uiView.querySelector('p.fallback')!.textContent).toBe('second');

      await cycle(uiView);

      host.label = 'third';
      await waitForUpdate(host);
      expect(uiView.querySelector('p.fallback')!.textContent).toBe('third');
    });

    it('should show the same static nodes again after a component comes and goes', async () => {
      const uiView = await mountAuthoredFallback();
      const hold = uiView.querySelector('p.hold');
      expect(hold).not.toBeNull();

      await routerGo(router, 'home');
      await waitForUpdate(uiView);
      expect(uiView.querySelector('p.hold')).toBeNull();

      await routerGo(router, 'blank');
      await waitForUpdate(uiView);
      expect(uiView.querySelector('p.hold')).toBe(hold);
    });

    it('should stand ahead of lit’s marker without doubling', async () => {
      const uiView = await mountAuthoredFallback();
      const markerAt = () =>
        [...uiView.childNodes].findIndex((node) => node.nodeType === 8);
      const holdAt = () =>
        [...uiView.childNodes].indexOf(uiView.querySelector('p.hold')!);

      expect(markerAt()).toBeGreaterThan(-1);
      expect(holdAt()).toBeLessThan(markerAt());

      await cycle(uiView);
      await cycle(uiView);

      expect(uiView.querySelectorAll('p.hold')).toHaveLength(1);
      expect(holdAt()).toBeLessThan(markerAt());
    });
  });

  // The two protected hooks a subclass renders its own content through.
  describe('capturing content in place', () => {
    /** Mounts the subclass with `markup` already in it, the way a filled element arrives. */
    async function mountInPlace(markup: string): Promise<TestInPlaceView> {
      const uiRouterEl = document.createElement('ui-router');
      uiRouterEl.uiRouter = router;
      container.appendChild(uiRouterEl);
      uiRouterEl.innerHTML = `<test-in-place-view>${markup}</test-in-place-view>`;
      const view = uiRouterEl.querySelector('test-in-place-view')!;
      await waitForUpdate(view);
      return view;
    }

    beforeEach(() => {
      router = createTestRouter(homeStates);
    });

    it('should take what stands ahead of a render, and leave it standing', async () => {
      const view = await mountInPlace(`<p class="hold">hold</p>${heldMarkup}`);

      const fallbackNodes = view['fallbackNodes'] as Element[];
      expect(fallbackNodes.map((node) => node.className)).toEqual(['hold']);
      // Not parked: the nodes were already in the document when they were taken.
      expect(view['fallbackParked']).toBe(false);
      expect(view.querySelector('p.hold')).toBe(fallbackNodes[0]);
    });

    it('should take nothing from an element holding a render from its first child', async () => {
      const view = await mountInPlace(heldMarkup);

      expect(view['fallback']).toBeUndefined();
      expect(view['fallbackNodes']).toHaveLength(0);
    });

    it('should keep the set it took when content arrives in front of it', async () => {
      const view = await mountInPlace('<p class="hold">hold</p>');
      const hold = view.querySelector('p.hold')!;

      view.insertAdjacentHTML('afterbegin', '<p class="late">late</p>');
      view.requestUpdate();
      await waitForUpdate(view);

      const fallbackNodes = view['fallbackNodes'] as Element[];
      expect(fallbackNodes).toEqual([hold]);
    });
  });

  describe('context-request for the router', () => {
    it('should answer a descendant of a view fed by .uiRouter alone', async () => {
      router = createTestRouter(homeStates);
      const uiView = document.createElement('ui-view');
      uiView.uiRouter = router;
      container.appendChild(uiView);
      await waitForUpdate(uiView);

      const child = document.createElement('div');
      uiView.appendChild(child);

      expect(requestContext(child, routerContext)).toBe(router);
    });
  });
});

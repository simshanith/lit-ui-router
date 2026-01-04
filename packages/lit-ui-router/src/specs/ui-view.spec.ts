import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Transition } from '@uirouter/core';

import { UiView } from '../ui-view.js';
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
  tick,
  waitForUpdate,
  routerGo,
} from './test-utils.js';

describe('UiView', () => {
  let container: HTMLElement;
  let router: UIRouterLit;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  async function setupRouter(
    states: LitStateDeclaration[],
  ): Promise<{ uiRouter: UIRouterLitElement; uiView: UiView }> {
    router = createTestRouter(states);

    const uiRouter = document.createElement('ui-router') as UIRouterLitElement;
    uiRouter.uiRouter = router;

    const uiView = document.createElement('ui-view') as UiView;
    uiRouter.appendChild(uiView);
    container.appendChild(uiRouter);

    await waitForUpdate(uiRouter);
    await waitForUpdate(uiView);

    router.start();
    await tick();

    return { uiRouter, uiView };
  }

  describe('initialization', () => {
    it('should be defined as a custom element', () => {
      expect(customElements.get('ui-view')).toBe(UiView);
    });

    it('should render without router context', async () => {
      const uiView = document.createElement('ui-view') as UiView;
      container.appendChild(uiView);
      await waitForUpdate(uiView);

      expect(uiView).toBeInstanceOf(UiView);
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
      router = createTestRouter([
        {
          name: 'home',
          url: '/home',
          views: {
            sidebar: { component: () => html`<div>Sidebar</div>` },
          },
        },
      ]);

      const uiRouter = document.createElement(
        'ui-router',
      ) as UIRouterLitElement;
      uiRouter.uiRouter = router;

      const uiView = document.createElement('ui-view') as UiView;
      uiView.setAttribute('name', 'sidebar');
      uiRouter.appendChild(uiView);
      container.appendChild(uiRouter);

      await waitForUpdate(uiRouter);
      await waitForUpdate(uiView);

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
      const nestedView = views.find((v) => v.name === 'nested');
      expect(nestedView).toBeDefined();
    });
  });

  describe('fallback content', () => {
    it('should render slot content when no component is active', async () => {
      router = createTestRouter([]);

      const uiRouter = document.createElement(
        'ui-router',
      ) as UIRouterLitElement;
      uiRouter.uiRouter = router;

      const uiView = document.createElement('ui-view') as UiView;
      uiView.innerHTML = '<div class="fallback">Loading...</div>';
      uiRouter.appendChild(uiView);
      container.appendChild(uiRouter);

      await waitForUpdate(uiRouter);
      await waitForUpdate(uiView);

      expect(uiView.innerHTML).toContain('fallback');
    });
  });

  describe('uiCanExit hook', () => {
    it('should call uiCanExit on component before exiting', async () => {
      const uiCanExitSpy = vi.fn().mockReturnValue(true);

      @customElement('test-exit-component')
      class TestExitComponent extends LitElement implements UiOnExit {
        uiCanExit = uiCanExitSpy;
        render() {
          return html`<div>Exit Component</div>`;
        }
      }

      const states: LitStateDeclaration[] = [
        {
          name: 'home',
          url: '/home',
          component: TestExitComponent as any,
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
      @customElement('test-block-exit-component')
      class TestBlockExitComponent extends LitElement implements UiOnExit {
        uiCanExit() {
          return false;
        }
        render() {
          return html`<div>Block Exit</div>`;
        }
      }

      const states: LitStateDeclaration[] = [
        {
          name: 'home',
          url: '/home',
          component: TestBlockExitComponent as any,
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
      expect(router.stateService.current.name).toBe('home');
    });
  });

  describe('uiOnParamsChanged hook', () => {
    it('should call uiOnParamsChanged when params change', async () => {
      const onParamsChangedSpy = vi.fn();

      @customElement('test-params-component')
      class TestParamsComponent
        extends LitElement
        implements UiOnParamsChanged
      {
        uiOnParamsChanged = onParamsChangedSpy;
        render() {
          return html`<div>Params Component</div>`;
        }
      }

      const states: LitStateDeclaration[] = [
        {
          name: 'user',
          url: '/user/:id',
          params: {
            id: { dynamic: true },
          },
          component: TestParamsComponent as any,
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

      @customElement('test-params-receive-component')
      class TestParamsReceiveComponent
        extends LitElement
        implements UiOnParamsChanged
      {
        uiOnParamsChanged(newParams: Record<string, unknown>) {
          receivedParams = newParams;
        }
        render() {
          return html`<div>Params Component</div>`;
        }
      }

      const states: LitStateDeclaration[] = [
        {
          name: 'user',
          url: '/user/:id',
          params: {
            id: { dynamic: true },
          },
          component: TestParamsReceiveComponent as any,
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
});

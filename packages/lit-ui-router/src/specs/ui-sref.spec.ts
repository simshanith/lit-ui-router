import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, render } from 'lit';
import { TargetState } from '@uirouter/core';

import {
  uiSref,
  UiSrefDirective,
  UI_SREF_TARGET_EVENT,
  uiSrefTargetEvent,
  UiSrefTargetEvent,
} from '../ui-sref.js';
import { UIRouterLitElement } from '../ui-router.js';
import '../ui-view.register.js';
import { UIRouterLit } from '../core.js';
import { LitStateDeclaration } from '../interface.js';
import {
  createTestRouter,
  tick,
  waitForUpdate,
  routerGo,
  clickElement,
} from './test-utils.js';
import {
  clickLocatedElement,
  suppressNativeClickNavigation,
  NativeClickSuppression,
} from './browser-test-utils.js';

describe('uiSref directive', () => {
  let container: HTMLElement;
  let router: UIRouterLit | undefined;
  let suppression: NativeClickSuppression;

  beforeEach(async () => {
    // acquires the browser-project default (module singleton); clear its
    // recordings so each test asserts only its own suppressed events
    suppression = suppressNativeClickNavigation();
    suppression.events.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    await tick();
  });

  afterEach(async () => {
    // Remove DOM first to trigger directive disconnection
    container.remove();
    await tick(10);

    // Dispose router to clean up internal subscriptions
    if (router) {
      router.dispose();
      router = undefined;
    }
    await tick();
  });

  async function setupWithSref(
    states: LitStateDeclaration[],
    srefState: string,
    params?: Record<string, unknown>,
  ): Promise<{ anchor: HTMLAnchorElement; uiRouter: UIRouterLitElement }> {
    router = createTestRouter(states);

    const uiRouter = document.createElement('ui-router');
    uiRouter.uiRouter = router;
    container.appendChild(uiRouter);

    await waitForUpdate(uiRouter);

    // Create anchor with uiSref
    const wrapper = document.createElement('div');
    uiRouter.appendChild(wrapper);

    render(html`<a ${uiSref(srefState, params)}>Link</a>`, wrapper);
    await tick(50);

    const anchor = wrapper.querySelector('a')!;

    router.start();
    await tick(50);

    return { anchor, uiRouter };
  }

  describe('href generation', () => {
    it('should set href attribute for state with URL', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { anchor } = await setupWithSref(states, 'home');

      expect(anchor.hasAttribute('href')).toBe(true);
      expect(anchor.getAttribute('href')).toContain('/home');
    });

    it('should include params in href', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'user', url: '/user/:id' },
      ];
      const { anchor } = await setupWithSref(states, 'user', { id: '123' });

      expect(anchor.getAttribute('href')).toContain('/user/123');
    });

    it('should include query params in href', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'search', url: '/search?query' },
      ];
      const { anchor } = await setupWithSref(states, 'search', {
        query: 'test',
      });

      expect(anchor.getAttribute('href')).toContain('query=test');
    });

    it('should update href when state params change', async () => {
      router = createTestRouter([{ name: 'user', url: '/user/:id' }]);

      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);

      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      // Initial render with id=1
      render(html`<a ${uiSref('user', { id: '1' })}>Link</a>`, wrapper);
      await tick(50);

      let anchor = wrapper.querySelector('a')!;
      expect(anchor.getAttribute('href')).toContain('/user/1');

      // Re-render with id=2
      render(html`<a ${uiSref('user', { id: '2' })}>Link</a>`, wrapper);
      await tick(50);

      anchor = wrapper.querySelector('a')!;
      expect(anchor.getAttribute('href')).toContain('/user/2');
    });

    it('should handle state without URL', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'abstract', abstract: true },
      ];

      router = createTestRouter(states);
      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);

      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      render(html`<a ${uiSref('abstract')}>Link</a>`, wrapper);
      await tick(50);

      const anchor = wrapper.querySelector('a')!;
      // Should not have href or have empty href
      const href = anchor.getAttribute('href');
      expect(href === null || href === '').toBe(true);
    });
  });

  describe('click navigation', () => {
    it('should navigate on click', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home' },
        { name: 'about', url: '/about' },
      ];
      const { anchor } = await setupWithSref(states, 'about');

      const goSpy = vi.spyOn(router!.stateService, 'go');
      clickElement(anchor);
      await tick();

      expect(goSpy).toHaveBeenCalledWith('about', {}, expect.any(Object));
    });

    it('should prevent default on click', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { anchor } = await setupWithSref(states, 'home');

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      anchor.dispatchEvent(event);
      await tick();

      expect(preventDefaultSpy).toHaveBeenCalled();
      // the event reached default-action stage already cancelled by the router
      expect(suppression.events).toContainEqual(
        expect.objectContaining({ type: 'click', defaultPrevented: true }),
      );
    });

    it('should pass params to navigation', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'user', url: '/user/:id' },
      ];
      const { anchor } = await setupWithSref(states, 'user', { id: '456' });

      const goSpy = vi.spyOn(router!.stateService, 'go');
      clickElement(anchor);
      await tick();

      expect(goSpy).toHaveBeenCalledWith(
        'user',
        { id: '456' },
        expect.any(Object),
      );
    });
  });

  describe('click modifiers', () => {
    it('should ignore click with ctrl key', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { anchor } = await setupWithSref(states, 'home');

      const goSpy = vi.spyOn(router!.stateService, 'go');
      // clickElement(anchor, { ctrlKey: true });
      await clickLocatedElement(anchor, { modifiers: ['Control'] });
      await tick();

      expect(goSpy).not.toHaveBeenCalled();
      // delivery is platform-split (macOS turns ctrl-click into contextmenu);
      // whatever arrived must still have its default intact
      expect(suppression.events.filter((e) => e.defaultPrevented)).toEqual([]);
    });

    it('should ignore click with meta key', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { anchor } = await setupWithSref(states, 'home');

      const goSpy = vi.spyOn(router!.stateService, 'go');
      // clickElement(anchor, { metaKey: true });
      await clickLocatedElement(anchor, { modifiers: ['Meta'] });

      await tick();

      expect(goSpy).not.toHaveBeenCalled();
      // positive proof: the click reached default-action stage with its
      // default intact — the suppression helper was the only preventer
      expect(suppression.events).toEqual([
        expect.objectContaining({
          type: 'click',
          tag: 'a',
          defaultPrevented: false,
        }),
      ]);
    });

    it('should ignore middle button click', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { anchor } = await setupWithSref(states, 'home');

      const goSpy = vi.spyOn(router!.stateService, 'go');
      // clickElement(anchor, { button: 1 });
      await clickLocatedElement(anchor, { button: 'middle' });

      await tick();

      expect(goSpy).not.toHaveBeenCalled();
      // middle clicks arrive as auxclick (never click); its default — open
      // in a new tab — must reach us intact
      expect(suppression.events).toEqual([
        expect.objectContaining({
          type: 'auxclick',
          tag: 'a',
          defaultPrevented: false,
        }),
      ]);
    });

    it('should ignore right button click', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { anchor } = await setupWithSref(states, 'home');

      const goSpy = vi.spyOn(router!.stateService, 'go');
      await clickLocatedElement(anchor, { button: 'right' });

      await tick();

      expect(goSpy).not.toHaveBeenCalled();
      // right clicks surface as contextmenu (and browser-dependent auxclick);
      // whatever arrived must still have its default intact
      expect(suppression.events.filter((e) => e.defaultPrevented)).toEqual([]);
    });
  });

  describe('target attribute', () => {
    it('should ignore click with target="_blank"', async () => {
      router = createTestRouter([{ name: 'home', url: '/home' }]);

      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);

      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      render(html`<a ${uiSref('home')} target="_blank">Link</a>`, wrapper);
      await tick(50);

      router.start();

      const anchor = wrapper.querySelector('a')!;
      const goSpy = vi.spyOn(router.stateService, 'go');
      await clickLocatedElement(anchor);
      await tick();

      expect(goSpy).not.toHaveBeenCalled();
      // positive proof: the click reached default-action stage with its
      // default (open the href in a new tab) intact
      expect(suppression.events).toEqual([
        expect.objectContaining({
          type: 'click',
          tag: 'a',
          defaultPrevented: false,
        }),
      ]);
    });

    it('should ignore click with rel="external"', async () => {
      router = createTestRouter([{ name: 'home', url: '/home' }]);

      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);

      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      render(html`<a ${uiSref('home')} rel="external">Link</a>`, wrapper);
      await tick(50);

      router.start();

      const anchor = wrapper.querySelector('a')!;
      const goSpy = vi.spyOn(router.stateService, 'go');
      await clickLocatedElement(anchor);
      await tick();

      expect(goSpy).not.toHaveBeenCalled();
      expect(suppression.events).toEqual([
        expect.objectContaining({
          type: 'click',
          tag: 'a',
          defaultPrevented: false,
        }),
      ]);
    });
  });

  describe('uiSrefTarget event', () => {
    it('should dispatch uiSrefTarget event on href change', async () => {
      router = createTestRouter([
        { name: 'home', url: '/home' },
        { name: 'about', url: '/about' },
      ]);

      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);

      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      const eventSpy = vi.fn();
      wrapper.addEventListener(UI_SREF_TARGET_EVENT, eventSpy);

      // Initial render - should dispatch event
      render(html`<a ${uiSref('home')}>Link</a>`, wrapper);
      await tick(50);

      expect(eventSpy).toHaveBeenCalled();

      // Change to different state - should dispatch again
      eventSpy.mockClear();
      render(html`<a ${uiSref('about')}>Link</a>`, wrapper);
      await tick(50);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should include targetState in event detail', async () => {
      router = createTestRouter([{ name: 'home', url: '/home' }]);

      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);

      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      let receivedTargetState: TargetState | undefined;
      wrapper.addEventListener(UI_SREF_TARGET_EVENT, ((
        event: UiSrefTargetEvent,
      ) => {
        receivedTargetState = event.detail.targetState;
      }) as EventListener);

      // Render - should dispatch event with targetState
      render(html`<a ${uiSref('home')}>Link</a>`, wrapper);
      await tick(50);

      expect(receivedTargetState).toBeDefined();
      expect(receivedTargetState?.name()).toBe('home');
    });
  });

  describe('uiSrefTargetEvent factory', () => {
    it('should create event with correct type', () => {
      const targetState = {} as TargetState;
      const event = uiSrefTargetEvent(targetState);

      expect(event.type).toBe(UI_SREF_TARGET_EVENT);
    });

    it('should create event that bubbles', () => {
      const event = uiSrefTargetEvent({} as TargetState);
      expect(event.bubbles).toBe(true);
    });

    it('should create event that is composed', () => {
      const event = uiSrefTargetEvent({} as TargetState);
      expect(event.composed).toBe(true);
    });

    it('should include targetState in detail', () => {
      const targetState = { name: () => 'test' } as TargetState;
      const event = uiSrefTargetEvent(targetState);

      expect(event.detail.targetState).toBe(targetState);
    });
  });

  describe('relative state references', () => {
    it('should resolve relative state from parent view', async () => {
      router = createTestRouter([
        {
          name: 'parent',
          url: '/parent',
          component: () => html`<div><ui-view></ui-view></div>`,
        },
        {
          name: 'parent.child',
          url: '/child',
          component: () => html`<div>Child</div>`,
        },
        {
          name: 'parent.sibling',
          url: '/sibling',
          component: () => html`<div>Sibling</div>`,
        },
      ]);

      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;

      const uiView = document.createElement('ui-view');
      uiRouter.appendChild(uiView);
      container.appendChild(uiRouter);

      await waitForUpdate(uiRouter);
      await waitForUpdate(uiView);

      router.start();
      await routerGo(router, 'parent.child');
      await tick(50);

      // The nested view should be able to use relative references
      const nestedView = uiView.querySelector('ui-view');
      if (nestedView) {
        const wrapper = document.createElement('div');
        nestedView.appendChild(wrapper);

        render(html`<a ${uiSref('^.sibling')}>Sibling</a>`, wrapper);
        await tick(50);

        const anchor = wrapper.querySelector('a')!;
        expect(anchor.getAttribute('href')).toContain('/sibling');
      }
    });
  });

  describe('cleanup', () => {
    it('should remove click listener on disconnect', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { anchor } = await setupWithSref(states, 'home');
      anchor.remove();
      await tick();

      const goSpy = vi.spyOn(router!.stateService, 'go');

      // The directive should be disconnected, so click won't work
      // until it's re-connected properly
      clickElement(anchor);
      expect(goSpy).not.toHaveBeenCalled();
    });
  });

  describe('transition options', () => {
    it('should pass transition options', async () => {
      router = createTestRouter([
        { name: 'home', url: '/home' },
        { name: 'about', url: '/about' },
      ]);

      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);

      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      render(
        html`<a ${uiSref('about', {}, { reload: true })}>About</a>`,
        wrapper,
      );
      await tick(50);

      router.start();

      const anchor = wrapper.querySelector('a')!;
      const goSpy = vi.spyOn(router.stateService, 'go');
      clickElement(anchor);
      await tick();

      expect(goSpy).toHaveBeenCalledWith(
        'about',
        {},
        expect.objectContaining({ reload: true }),
      );
    });
  });
});

describe('UiSrefDirective', () => {
  it('should throw when used on non-element part', () => {
    expect(() => {
      // Simulate attribute part type
      new UiSrefDirective({ type: 1 } as any);
    }).toThrow('The `uiSref` directive must be used as an element');
  });

  it('should not throw when used on element part', () => {
    expect(() => {
      // Simulate element part type (type 1)
      new UiSrefDirective({ type: 1 } as any);
    }).toThrow(); // Still throws because type 1 is ATTRIBUTE, not ELEMENT

    expect(() => {
      // Correct element part type (type 6)
      new UiSrefDirective({ type: 6 } as any);
    }).not.toThrow();
  });
});

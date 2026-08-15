import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, render, TemplateResult } from 'lit';
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

  /** renders an arbitrary template inside a started router */
  async function setupWithTemplate(
    states: LitStateDeclaration[],
    template: TemplateResult,
  ): Promise<HTMLElement> {
    router = createTestRouter(states);

    const uiRouter = document.createElement('ui-router');
    uiRouter.uiRouter = router;
    container.appendChild(uiRouter);
    await waitForUpdate(uiRouter);

    const wrapper = document.createElement('div');
    uiRouter.appendChild(wrapper);

    render(template, wrapper);
    await tick(50);

    router.start();
    await tick(50);

    return wrapper;
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

    it('should remove href when the target loses its url', async () => {
      router = createTestRouter([
        { name: 'home', url: '/home' },
        { name: 'abstract', abstract: true },
      ]);

      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);

      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      // one literal, so the part and the directive instance are reused
      const link = (state: string) => html`<a ${uiSref(state)}>Link</a>`;

      render(link('home'), wrapper);
      await tick(50);
      expect(wrapper.querySelector('a')!.hasAttribute('href')).toBe(true);

      render(link('abstract'), wrapper);
      await tick(50);
      expect(wrapper.querySelector('a')!.hasAttribute('href')).toBe(false);
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

    it('should ignore click with shift key', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { anchor } = await setupWithSref(states, 'home');

      const goSpy = vi.spyOn(router!.stateService, 'go');
      // shift-click opens the href in a new window
      await clickLocatedElement(anchor, { modifiers: ['Shift'] });
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

    it('should ignore click with alt key', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { anchor } = await setupWithSref(states, 'home');

      const goSpy = vi.spyOn(router!.stateService, 'go');
      // alt-click downloads the href on most platforms
      await clickLocatedElement(anchor, { modifiers: ['Alt'] });
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

    it('should ignore click with rel="external noopener"', async () => {
      // rel is a token list; an exact-string comparison misses every anchor
      // that pairs external with another token
      const wrapper = await setupWithTemplate(
        [{ name: 'home', url: '/home' }],
        html`<a ${uiSref('home')} rel="external noopener">Link</a>`,
      );

      const goSpy = vi.spyOn(router!.stateService, 'go');
      await clickLocatedElement(wrapper.querySelector('a')!);
      await tick();

      expect(goSpy).not.toHaveBeenCalled();
      expect(suppression.events).toEqual([
        expect.objectContaining({ type: 'click', defaultPrevented: false }),
      ]);
    });

    it('should ignore click on an anchor with download', async () => {
      const wrapper = await setupWithTemplate(
        [{ name: 'home', url: '/home' }],
        html`<a ${uiSref('home')} download>Link</a>`,
      );

      const goSpy = vi.spyOn(router!.stateService, 'go');
      await clickLocatedElement(wrapper.querySelector('a')!);
      await tick();

      expect(goSpy).not.toHaveBeenCalled();
      expect(suppression.events).toEqual([
        expect.objectContaining({ type: 'click', defaultPrevented: false }),
      ]);
    });
  });

  describe('assignHref', () => {
    const home: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];

    it('should write href to a non-link by default', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const wrapper = await setupWithTemplate(
        home,
        html`<button ${uiSref('home')}>Go</button>`,
      );

      expect(wrapper.querySelector('button')!.getAttribute('href')).toContain(
        '/home',
      );
      // the 1.x default is unchanged behaviour, but it names the fix
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("{ assignHref: 'auto' }"),
      );
      warn.mockRestore();
    });

    it('should warn once per element, not once per render', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      router = createTestRouter([{ name: 'user', url: '/user/:id' }]);

      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);

      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      const link = (id: string) =>
        html`<button ${uiSref('user', { id })}>Go</button>`;
      render(link('1'), wrapper);
      await tick(50);
      render(link('2'), wrapper);
      await tick(50);

      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('should not write href to a non-link under auto', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const wrapper = await setupWithTemplate(
        home,
        html`<button ${uiSref('home', {}, { assignHref: 'auto' })}>Go</button>`,
      );

      expect(wrapper.querySelector('button')!.hasAttribute('href')).toBe(false);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('should still write href to an anchor under auto', async () => {
      const wrapper = await setupWithTemplate(
        home,
        html`<a ${uiSref('home', {}, { assignHref: 'auto' })}>Link</a>`,
      );

      expect(wrapper.querySelector('a')!.getAttribute('href')).toContain(
        '/home',
      );
    });

    it('should write href to an SVG anchor under auto', async () => {
      const wrapper = await setupWithTemplate(
        home,
        html`<svg><a ${uiSref('home', {}, { assignHref: 'auto' })}>x</a></svg>`,
      );

      // localName is 'a' for the SVG element too, so no namespace check
      expect(wrapper.querySelector('svg a')!.getAttribute('href')).toContain(
        '/home',
      );
    });

    it('should never write href under false', async () => {
      const wrapper = await setupWithTemplate(
        home,
        html`<a ${uiSref('home', {}, { assignHref: false })}>Link</a>`,
      );

      expect(wrapper.querySelector('a')!.hasAttribute('href')).toBe(false);
    });

    it('should still dispatch uiSrefTarget under false', async () => {
      // the href is never written, so an href-keyed dispatch guard would
      // suppress the event for every sref (the #588 split is what makes
      // this option possible)
      router = createTestRouter(home);

      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);

      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      const eventSpy = vi.fn();
      wrapper.addEventListener(UI_SREF_TARGET_EVENT, eventSpy);

      render(
        html`<a ${uiSref('home', {}, { assignHref: false })}>Link</a>`,
        wrapper,
      );
      await tick(50);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should remove an href it wrote when the option is flipped', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      router = createTestRouter(home);

      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);

      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      const link = (assignHref: boolean | 'auto') =>
        html`<button ${uiSref('home', {}, { assignHref })}>Go</button>`;

      render(link(true), wrapper);
      await tick(50);
      expect(wrapper.querySelector('button')!.hasAttribute('href')).toBe(true);

      render(link('auto'), wrapper);
      await tick(50);
      expect(wrapper.querySelector('button')!.hasAttribute('href')).toBe(false);
      warn.mockRestore();
    });

    it('should leave an href it did not write alone', async () => {
      const wrapper = await setupWithTemplate(
        home,
        html`<a ${uiSref('home', {}, { assignHref: false })} href="/authored"
          >Link</a
        >`,
      );

      expect(wrapper.querySelector('a')!.getAttribute('href')).toBe(
        '/authored',
      );
    });

    it('should still navigate on click under auto on a button', async () => {
      // the option governs the href only; it is never the switch for clicks
      const wrapper = await setupWithTemplate(
        home,
        html`<button ${uiSref('home', {}, { assignHref: 'auto' })}>Go</button>`,
      );

      const goSpy = vi.spyOn(router!.stateService, 'go');
      await clickLocatedElement(wrapper.querySelector('button')!);
      await tick();

      expect(goSpy).toHaveBeenCalledWith('home', {}, expect.any(Object));
    });

    it('should not leak assignHref into the transition options', async () => {
      const wrapper = await setupWithTemplate(
        home,
        html`<a ${uiSref('home', {}, { assignHref: true, reload: true })}
          >Link</a
        >`,
      );

      const goSpy = vi.spyOn(router!.stateService, 'go');
      await clickLocatedElement(wrapper.querySelector('a')!);
      await tick();

      const options = goSpy.mock.calls[0][2]!;
      expect(options).not.toHaveProperty('assignHref');
      expect(options).toHaveProperty('reload', true);
    });
  });

  describe('descendant clicks (currentTarget)', () => {
    // event.target is the deepest node clicked, so every guard that reads an
    // attribute off it is dead whenever a link wraps its label

    it('should ignore a descendant click on target="_blank"', async () => {
      const wrapper = await setupWithTemplate(
        [{ name: 'home', url: '/home' }],
        html`<a ${uiSref('home')} target="_blank"><span>Link</span></a>`,
      );

      const goSpy = vi.spyOn(router!.stateService, 'go');
      await clickLocatedElement(wrapper.querySelector('span')!);
      await tick();

      expect(goSpy).not.toHaveBeenCalled();
      expect(suppression.events).toEqual([
        expect.objectContaining({
          type: 'click',
          tag: 'span',
          defaultPrevented: false,
        }),
      ]);
    });

    it('should ignore a descendant click on rel="external"', async () => {
      const wrapper = await setupWithTemplate(
        [{ name: 'home', url: '/home' }],
        html`<a ${uiSref('home')} rel="external"><span>Link</span></a>`,
      );

      const goSpy = vi.spyOn(router!.stateService, 'go');
      await clickLocatedElement(wrapper.querySelector('span')!);
      await tick();

      expect(goSpy).not.toHaveBeenCalled();
      expect(suppression.events).toEqual([
        expect.objectContaining({ type: 'click', defaultPrevented: false }),
      ]);
    });

    it('should still navigate on a plain descendant click', async () => {
      const wrapper = await setupWithTemplate(
        [{ name: 'home', url: '/home' }],
        html`<a ${uiSref('home')}><span>Link</span></a>`,
      );

      const goSpy = vi.spyOn(router!.stateService, 'go');
      await clickLocatedElement(wrapper.querySelector('span')!);
      await tick();

      expect(goSpy).toHaveBeenCalledWith('home', {}, expect.any(Object));
    });
  });

  describe('defaultPrevented', () => {
    it('should not navigate when another handler cancelled the event', async () => {
      const wrapper = await setupWithTemplate(
        [{ name: 'home', url: '/home' }],
        html`<a ${uiSref('home')}>Link</a>`,
      );

      // capture phase on an ancestor runs before the element's own listener,
      // which is the only way a consumer can get in front of the router
      wrapper.addEventListener('click', (event) => event.preventDefault(), {
        capture: true,
      });

      const goSpy = vi.spyOn(router!.stateService, 'go');
      await clickLocatedElement(wrapper.querySelector('a')!);
      await tick();

      expect(goSpy).not.toHaveBeenCalled();
    });
  });

  describe('non-link elements', () => {
    // the guards defer to native click behaviour; an element that has none
    // has nothing to defer to, so bailing drops the click instead of
    // handing it back to the browser

    it('should navigate on a shift-click on a button', async () => {
      const wrapper = await setupWithTemplate(
        [{ name: 'home', url: '/home' }],
        html`<button ${uiSref('home')}>Go</button>`,
      );

      const goSpy = vi.spyOn(router!.stateService, 'go');
      await clickLocatedElement(wrapper.querySelector('button')!, {
        modifiers: ['Shift'],
      });
      await tick();

      expect(goSpy).toHaveBeenCalledWith('home', {}, expect.any(Object));
    });

    it('should navigate on a meta-click on a button', async () => {
      const wrapper = await setupWithTemplate(
        [{ name: 'home', url: '/home' }],
        html`<button ${uiSref('home')}>Go</button>`,
      );

      const goSpy = vi.spyOn(router!.stateService, 'go');
      await clickLocatedElement(wrapper.querySelector('button')!, {
        modifiers: ['Meta'],
      });
      await tick();

      expect(goSpy).toHaveBeenCalledWith('home', {}, expect.any(Object));
    });

    it('should still honour defaultPrevented on a button', async () => {
      const wrapper = await setupWithTemplate(
        [{ name: 'home', url: '/home' }],
        html`<button ${uiSref('home')}>Go</button>`,
      );

      wrapper.addEventListener('click', (event) => event.preventDefault(), {
        capture: true,
      });

      const goSpy = vi.spyOn(router!.stateService, 'go');
      await clickLocatedElement(wrapper.querySelector('button')!);
      await tick();

      expect(goSpy).not.toHaveBeenCalled();
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

    it('should dispatch for a state whose navigable has no url', async () => {
      router = createTestRouter([{ name: 'abstract', abstract: true }]);

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

      // core returns null from href(): the old guard compared that to the
      // absent attribute, matched, and returned before dispatching
      render(html`<a ${uiSref('abstract')}>Link</a>`, wrapper);
      await tick(50);

      expect(receivedTargetState?.name()).toBe('abstract');
    });

    it('should dispatch when only a non-url param changes', async () => {
      router = createTestRouter([
        {
          name: 'compose',
          url: '/compose',
          params: { message: { value: null, dynamic: true } },
        },
      ]);

      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);

      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      // one template literal, so lit reuses the part and the directive
      // instance; two literals would be two templates and a fresh element
      const link = (message: string) =>
        html`<a ${uiSref('compose', { message })}>Link</a>`;

      render(link('a'), wrapper);
      await tick(50);

      const hrefBefore = wrapper.querySelector('a')!.getAttribute('href');

      const eventSpy = vi.fn();
      wrapper.addEventListener(UI_SREF_TARGET_EVENT, eventSpy);

      render(link('b'), wrapper);
      await tick(50);

      // the param never reaches the url, so the old href-change guard held
      expect(wrapper.querySelector('a')!.getAttribute('href')).toBe(hrefBefore);
      expect(eventSpy).toHaveBeenCalled();
      const { targetState } = (eventSpy.mock.calls[0][0] as UiSrefTargetEvent)
        .detail;
      expect(targetState.params().message).toBe('b');
    });

    it('should not re-dispatch when the target is unchanged', async () => {
      router = createTestRouter([{ name: 'home', url: '/home' }]);

      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);

      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);

      const link = () => html`<a ${uiSref('home')}>Link</a>`;

      render(link(), wrapper);
      await tick(50);

      const eventSpy = vi.fn();
      wrapper.addEventListener(UI_SREF_TARGET_EVENT, eventSpy);

      render(link(), wrapper);
      await tick(50);

      expect(eventSpy).not.toHaveBeenCalled();
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

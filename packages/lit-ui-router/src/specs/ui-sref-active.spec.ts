import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, render } from 'lit';
import { PartInfo, PartType } from 'lit/directive.js';
import { TargetState, Transition } from '@uirouter/core';

import {
  uiSrefActive,
  UiSrefActiveDirective,
  SrefStatus,
  TransitionStateChange,
  TRANSITION_STATE_CHANGE_EVENT,
  mergeSrefStatus,
} from '../ui-sref-active.js';
import { uiSref, UI_SREF_TARGET_EVENT } from '../ui-sref.js';
import { UIRouterLitElement } from '../ui-router.js';
import '../ui-view.register.js';
import { UIRouterLit } from '../core.js';
import { LitStateDeclaration } from '../interface.js';
import {
  createTestRouter,
  tick,
  waitForUpdate,
  routerGo,
} from './test-utils.js';

function createPartInfo(type: PartType): PartInfo {
  return { type } as PartInfo;
}

describe('uiSrefActive directive', () => {
  let container: HTMLElement;
  let router: UIRouterLit;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  async function setupWithStates(
    states: LitStateDeclaration[],
  ): Promise<{ wrapper: HTMLElement; uiRouter: UIRouterLitElement }> {
    router = createTestRouter(states);

    const uiRouter = document.createElement('ui-router');
    uiRouter.uiRouter = router;
    container.appendChild(uiRouter);

    await waitForUpdate(uiRouter);

    const wrapper = document.createElement('div');
    uiRouter.appendChild(wrapper);

    router.start();
    await tick();

    return { wrapper, uiRouter };
  }

  describe('class application', () => {
    it('should apply active class when state is active', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home' },
        { name: 'about', url: '/about' },
      ];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<a
          ${uiSref('home')}
          ${uiSrefActive({ activeClasses: ['active'], exactClasses: [] })}
          >Home</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'home');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('active')).toBe(true);
    });

    it('should remove active class when state is not active', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home' },
        { name: 'about', url: '/about' },
      ];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<a
          ${uiSref('home')}
          ${uiSrefActive({ activeClasses: ['active'], exactClasses: [] })}
          >Home</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'home');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('active')).toBe(true);

      await routerGo(router, 'about');
      await tick(100);

      expect(anchor.classList.contains('active')).toBe(false);
    });

    it('should apply exact class when state matches exactly', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'parent', url: '/parent' },
        { name: 'parent.child', url: '/child' },
      ];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<a
          ${uiSref('parent')}
          ${uiSrefActive({
            activeClasses: ['active'],
            exactClasses: ['exact'],
          })}
          >Parent</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('active')).toBe(true);
      expect(anchor.classList.contains('exact')).toBe(true);
    });

    it('should apply active but not exact when child state is active', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'parent', url: '/parent' },
        { name: 'parent.child', url: '/child' },
      ];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<a
          ${uiSref('parent')}
          ${uiSrefActive({
            activeClasses: ['active'],
            exactClasses: ['exact'],
          })}
          >Parent</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent.child');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('active')).toBe(true);
      expect(anchor.classList.contains('exact')).toBe(false);
    });
  });

  describe('multiple classes', () => {
    it('should apply multiple active classes', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<a
          ${uiSref('home')}
          ${uiSrefActive({
            activeClasses: ['active', 'is-active', 'nav-active'],
            exactClasses: [],
          })}
          >Home</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'home');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('active')).toBe(true);
      expect(anchor.classList.contains('is-active')).toBe(true);
      expect(anchor.classList.contains('nav-active')).toBe(true);
    });

    it('should apply multiple exact classes', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<a
          ${uiSref('home')}
          ${uiSrefActive({
            activeClasses: [],
            exactClasses: ['exact', 'is-exact'],
          })}
          >Home</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'home');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('exact')).toBe(true);
      expect(anchor.classList.contains('is-exact')).toBe(true);
    });

    it('should remove all classes when inactive', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home' },
        { name: 'about', url: '/about' },
      ];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<a
          ${uiSref('home')}
          ${uiSrefActive({
            activeClasses: ['active', 'is-active'],
            exactClasses: ['exact'],
          })}
          >Home</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'home');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('active')).toBe(true);
      expect(anchor.classList.contains('is-active')).toBe(true);
      expect(anchor.classList.contains('exact')).toBe(true);

      await routerGo(router, 'about');
      await tick(100);

      expect(anchor.classList.contains('active')).toBe(false);
      expect(anchor.classList.contains('is-active')).toBe(false);
      expect(anchor.classList.contains('exact')).toBe(false);
    });
  });

  describe('state with params', () => {
    it('should be active when params match', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'user', url: '/user/:id' },
      ];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<a
          ${uiSref('user', { id: '123' })}
          ${uiSrefActive({ activeClasses: ['active'], exactClasses: [] })}
          >User 123</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'user', { id: '123' });
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('active')).toBe(true);
    });

    it('should not be exact when params differ', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'user', url: '/user/:id' },
      ];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<a
          ${uiSref('user', { id: '123' })}
          ${uiSrefActive({
            activeClasses: ['active'],
            exactClasses: ['exact'],
          })}
          >User 123</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'user', { id: '456' });
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      // Different param value, should not be active
      expect(anchor.classList.contains('active')).toBe(false);
      expect(anchor.classList.contains('exact')).toBe(false);
    });
  });

  describe('standalone state targeting', () => {
    it('should work with explicit state parameter', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<div
          ${uiSrefActive({
            activeClasses: ['active'],
            exactClasses: [],
            state: 'home',
            params: {},
            options: {},
          })}
        >
          Home Container
        </div>`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'home');
      await tick(100);

      const div = wrapper.querySelector('div')!;
      expect(div.classList.contains('active')).toBe(true);
    });
  });

  describe('watching child uiSref elements', () => {
    it('should apply active class when child sref is active', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<li
          ${uiSrefActive({ activeClasses: ['active'], exactClasses: [] })}
        >
          <a ${uiSref('home')}>Home</a>
        </li>`,
        wrapper,
      );
      await tick(100);

      await routerGo(router, 'home');
      await tick(100);

      const li = wrapper.querySelector('li')!;
      expect(li.classList.contains('active')).toBe(true);
    });

    it('should apply active class when any child sref is active', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home' },
        { name: 'about', url: '/about' },
      ];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<nav
          ${uiSrefActive({ activeClasses: ['has-active'], exactClasses: [] })}
        >
          <a ${uiSref('home')}>Home</a>
          <a ${uiSref('about')}>About</a>
        </nav>`,
        wrapper,
      );
      await tick(100);

      await routerGo(router, 'about');
      await tick(100);

      const nav = wrapper.querySelector('nav')!;
      expect(nav.classList.contains('has-active')).toBe(true);
    });

    // a re-targeted link replaces its old target, and the wrapper reflects it
    // at once rather than on the next transition
    it('should follow a child sref that re-targets', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'item', url: '/item/:id' },
      ];
      const { wrapper } = await setupWithStates(states);
      const nav = (id: number) =>
        html`<li ${uiSrefActive({ activeClasses: ['active'] })}>
          <a ${uiSref('item', { id })}>Item</a>
        </li>`;

      render(nav(1), wrapper);
      await tick(100);
      await routerGo(router, 'item', { id: 2 });
      await tick(100);

      const li = wrapper.querySelector('li')!;
      expect(li.classList.contains('active'), 'other item').toBe(false);

      render(nav(2), wrapper);
      await tick(100);
      expect(li.classList.contains('active'), 'now targets this item').toBe(
        true,
      );

      await routerGo(router, 'item', { id: 1 });
      await tick(100);
      expect(li.classList.contains('active'), 'old target retired').toBe(false);
    });
  });

  // the sample apps' nav bar: target from a child uiSref, router on a descendant
  describe('watching child uiSref elements, under a nested state', () => {
    it('should stay active on the wrapper when a child state is entered', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'parent', url: '/parent' },
        { name: 'parent.child', url: '/child' },
      ];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<li
          ${uiSrefActive({ activeClasses: ['active'], exactClasses: ['exact'] })}
        >
          <a ${uiSref('parent')}>Parent</a>
        </li>`,
        wrapper,
      );
      await tick(100);

      await routerGo(router, 'parent');
      await tick(100);

      const li = wrapper.querySelector('li')!;
      expect(li.classList.contains('active'), 'active on the parent').toBe(
        true,
      );

      await routerGo(router, 'parent.child');
      await tick(100);

      expect(li.classList.contains('active'), 'still active on the child').toBe(
        true,
      );
      expect(li.classList.contains('exact'), 'no longer the exact match').toBe(
        false,
      );
    });

    it('should go active when a child state is entered directly', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'parent', url: '/parent' },
        { name: 'parent.child', url: '/child' },
        { name: 'elsewhere', url: '/elsewhere' },
      ];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<li ${uiSrefActive({ activeClasses: ['active'] })}>
          <a ${uiSref('parent')}>Parent</a>
        </li>`,
        wrapper,
      );
      await tick(100);

      await routerGo(router, 'elsewhere');
      await tick(100);

      const li = wrapper.querySelector('li')!;
      expect(li.classList.contains('active'), 'inactive elsewhere').toBe(false);

      // never visiting `parent` first: the wrapper has to match the ancestor
      // in the destination path, not remember a previous exact hit
      await routerGo(router, 'parent.child');
      await tick(100);

      expect(li.classList.contains('active'), 'active on the child').toBe(true);
    });
  });

  // the sample apps' nav bar renders before its lazy modules load, so each
  // uiSref resolved its target to a `.**` placeholder that lazyLoad replaces
  describe('targeting a future state', () => {
    it('should go active once the lazy-loaded state is entered', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home' },
        {
          name: 'contacts.**',
          url: '/contacts',
          lazyLoad: () =>
            Promise.resolve({
              states: [{ name: 'contacts', url: '/contacts' }],
            }),
        },
      ];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<li ${uiSrefActive({ activeClasses: ['active'] })}>
          <a ${uiSref('contacts')}>Contacts</a>
        </li>`,
        wrapper,
      );
      await tick(100);

      await routerGo(router, 'home');
      await tick(100);

      const li = wrapper.querySelector('li')!;
      expect(li.classList.contains('active'), 'inactive at home').toBe(false);

      await routerGo(router, 'contacts');
      await tick(100);

      expect(router.globals.current.name, 'lazy load landed').toBe('contacts');
      expect(li.classList.contains('active'), 'active after lazy load').toBe(
        true,
      );
    });
  });

  // a nav bar behind a conditional: same element, which update() alone never re-arms
  describe('after a disconnect and reconnect', () => {
    it('should keep tracking transitions on the same element', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home' },
        { name: 'about', url: '/about' },
      ];
      const { wrapper } = await setupWithStates(states);

      const part = render(
        html`<a
          ${uiSref('about')}
          ${uiSrefActive({ activeClasses: ['active'] })}
          >About</a
        >`,
        wrapper,
      );
      await tick(100);

      await routerGo(router, 'about');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('active'), 'active before').toBe(true);

      part.setConnected(false);
      await tick(50);
      part.setConnected(true);
      await tick(50);

      await routerGo(router, 'home');
      await tick(100);
      expect(anchor.classList.contains('active'), 'cleared after leaving').toBe(
        false,
      );

      await routerGo(router, 'about');
      await tick(100);
      expect(
        anchor.classList.contains('active'),
        'active again after returning',
      ).toBe(true);
    });

    // the re-arm replays what update() was given, not the array as mutated since
    it('should replay the seeded targets as given', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home' },
        { name: 'about', url: '/about' },
      ];
      const { wrapper } = await setupWithStates(states);
      const seeded = [router.stateService.target('about')];

      const part = render(
        html`<span
          ${uiSrefActive({ activeClasses: ['active'], targetStates: seeded })}
          >About</span
        >`,
        wrapper,
      );
      await tick(100);
      const span = wrapper.querySelector('span')!;

      await routerGo(router, 'about');
      await tick(100);
      expect(span.classList.contains('active'), 'active before').toBe(true);

      seeded.length = 0;
      part.setConnected(false);
      await tick(50);
      part.setConnected(true);
      await tick(50);

      await routerGo(router, 'home');
      await tick(100);
      expect(span.classList.contains('active'), 'cleared after leaving').toBe(
        false,
      );
    });

    // started while detached, so nothing was subscribed to it
    it('should pick up a transition that started while disconnected', async () => {
      let open!: () => void;
      const gate = new Promise<void>((resolve) => (open = resolve));
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home' },
        {
          name: 'about',
          url: '/about',
          resolve: [{ token: 'gate', resolveFn: () => gate }],
        },
      ];
      const { wrapper } = await setupWithStates(states);

      const part = render(
        html`<a
          ${uiSref('about')}
          ${uiSrefActive({ activeClasses: ['active'] })}
          >About</a
        >`,
        wrapper,
      );
      await tick(100);
      const anchor = wrapper.querySelector('a')!;

      part.setConnected(false);
      await tick(50);
      const pending = router.stateService.go('about');
      await tick(50);
      part.setConnected(true);
      await tick(50);
      expect(anchor.classList.contains('active'), 'still in flight').toBe(
        false,
      );

      open();
      await pending;
      await tick(100);
      expect(anchor.classList.contains('active'), 'active once it lands').toBe(
        true,
      );
    });

    // the pre-disconnect subscription is dropped, so the settlement lands once
    it('should report an in-flight settlement once after a reconnect', async () => {
      let open!: () => void;
      const gate = new Promise<void>((resolve) => (open = resolve));
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home' },
        {
          name: 'about',
          url: '/about',
          resolve: [{ token: 'gate', resolveFn: () => gate }],
        },
      ];
      const { wrapper } = await setupWithStates(states);

      const part = render(
        html`<a
          ${uiSref('about')}
          ${uiSrefActive({ activeClasses: ['active'] })}
          >About</a
        >`,
        wrapper,
      );
      await tick(100);
      const anchor = wrapper.querySelector('a')!;

      const pending = router.stateService.go('about');
      await tick(50);
      part.setConnected(false);
      await tick(50);
      part.setConnected(true);
      await tick(50);
      const settled: TransitionStateChange[] = [];
      anchor.addEventListener(TRANSITION_STATE_CHANGE_EVENT, (e) => {
        settled.push((e as CustomEvent).detail.evt);
      });

      open();
      await pending;
      await tick(100);

      expect(settled).toEqual([TransitionStateChange.success]);
      expect(anchor.classList.contains('active')).toBe(true);
    });
  });

  // the other reconnected() branch: an explicit state resolves its own target
  it('should keep tracking when the target comes from an explicit state', async () => {
    const states: LitStateDeclaration[] = [
      { name: 'home', url: '/home' },
      { name: 'about', url: '/about' },
    ];
    const { wrapper } = await setupWithStates(states);

    const part = render(
      html`<span ${uiSrefActive({ activeClasses: ['active'], state: 'about' })}
        >About</span
      >`,
      wrapper,
    );
    await tick(100);

    await routerGo(router, 'about');
    await tick(100);

    const span = wrapper.querySelector('span')!;
    expect(span.classList.contains('active'), 'active before').toBe(true);

    part.setConnected(false);
    await tick(50);
    part.setConnected(true);
    await tick(50);

    await routerGo(router, 'home');
    await tick(100);
    expect(span.classList.contains('active'), 'cleared after leaving').toBe(
      false,
    );
  });

  describe('transition state tracking', () => {
    it('should update on state changes', async () => {
      const states: LitStateDeclaration[] = [
        { name: 'home', url: '/home' },
        { name: 'about', url: '/about' },
      ];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<a
            ${uiSref('home')}
            ${uiSrefActive({ activeClasses: ['active'], exactClasses: [] })}
            >Home</a
          >
          <a
            ${uiSref('about')}
            ${uiSrefActive({ activeClasses: ['active'], exactClasses: [] })}
            >About</a
          >`,
        wrapper,
      );
      await tick(100);

      await routerGo(router, 'home');
      await tick(100);

      const [homeLink, aboutLink] = wrapper.querySelectorAll('a');

      expect(homeLink.classList.contains('active')).toBe(true);
      expect(aboutLink.classList.contains('active')).toBe(false);

      await routerGo(router, 'about');
      await tick(100);

      expect(homeLink.classList.contains('active')).toBe(false);
      expect(aboutLink.classList.contains('active')).toBe(true);
    });
  });

  describe('aria-current', () => {
    const parentChildStates: LitStateDeclaration[] = [
      { name: 'parent', url: '/parent' },
      { name: 'parent.child', url: '/child' },
    ];

    it('should set aria-current="page" on an anchor when the exact state is active', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<a
          ${uiSref('parent')}
          ${uiSrefActive({ activeClasses: ['active'] })}
          >Parent</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.getAttribute('aria-current')).toBe('page');
    });

    it('should remove aria-current when the state becomes inactive', async () => {
      const { wrapper } = await setupWithStates([
        { name: 'home', url: '/home' },
        { name: 'about', url: '/about' },
      ]);

      render(
        html`<a ${uiSref('home')} ${uiSrefActive({ activeClasses: ['active'] })}
          >Home</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'home');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.getAttribute('aria-current')).toBe('page');

      await routerGo(router, 'about');
      await tick(100);

      expect(anchor.hasAttribute('aria-current')).toBe(false);
    });

    it('should not set aria-current on an ancestor link that is active but not exact', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<a
          ${uiSref('parent')}
          ${uiSrefActive({ activeClasses: ['active'] })}
          >Parent</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent.child');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('active')).toBe(true);
      expect(anchor.hasAttribute('aria-current')).toBe(false);
    });

    it('should apply a configured aria-current value', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<a
          ${uiSref('parent')}
          ${uiSrefActive({
            activeClasses: ['active'],
            ariaCurrentValue: 'step',
          })}
          >Parent</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.getAttribute('aria-current')).toBe('step');
    });

    it('should leave aria-current untouched when disabled', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<a
          ${uiSref('parent')}
          ${uiSrefActive({
            activeClasses: ['active'],
            ariaCurrentValue: false,
          })}
          >Parent</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('active')).toBe(true);
      expect(anchor.hasAttribute('aria-current')).toBe(false);
    });

    it('should not default aria-current on for non-link elements', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<li ${uiSrefActive({ activeClasses: ['active'] })}>
          <a ${uiSref('parent')}>Parent</a>
        </li>`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent');
      await tick(100);

      const item = wrapper.querySelector('li')!;
      expect(item.classList.contains('active')).toBe(true);
      expect(item.hasAttribute('aria-current')).toBe(false);
    });

    it('should apply an explicit aria-current value to a non-link element', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<li
          ${uiSrefActive({
            activeClasses: ['active'],
            ariaCurrentValue: 'location',
          })}
        >
          <a ${uiSref('parent')}>Parent</a>
        </li>`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent');
      await tick(100);

      const item = wrapper.querySelector('li')!;
      expect(item.getAttribute('aria-current')).toBe('location');
    });

    it('should combine a wrapper for classes with an inner link for aria-current', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<li ${uiSrefActive({ activeClasses: ['active'] })}>
          <a ${uiSref('parent')} ${uiSrefActive({})}>Parent</a>
        </li>`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent');
      await tick(100);

      const item = wrapper.querySelector('li')!;
      const anchor = wrapper.querySelector('a')!;
      expect(item.classList.contains('active')).toBe(true);
      expect(item.hasAttribute('aria-current')).toBe(false);
      expect(anchor.getAttribute('aria-current')).toBe('page');
    });

    it('should default aria-current on for role="link" elements', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<span
          role="link"
          ${uiSref('parent', {}, { assignHref: 'auto' })}
          ${uiSrefActive({})}
          >Parent</span
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent');
      await tick(100);

      const span = wrapper.querySelector('span')!;
      expect(span.getAttribute('aria-current')).toBe('page');
      // aria-current follows the role, href follows the tag: under auto the
      // span takes the first and not the second
      expect(span.hasAttribute('href')).toBe(false);
    });

    it('should default aria-current on for an SVG anchor', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      // `tagName` is 'a' for SVG and 'A' for HTML, so a tag check written
      // against `tagName` silently skips this one; `isNativeLink` reads
      // `localName`, which is lowercase for both
      render(
        html`<svg>
          <a ${uiSref('parent')} ${uiSrefActive({})}>
            <text>Parent</text>
          </a>
        </svg>`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent');
      await tick(100);

      const anchor = wrapper.querySelector('svg a')!;
      expect(anchor.namespaceURI).toBe('http://www.w3.org/2000/svg');
      expect(anchor.getAttribute('aria-current')).toBe('page');
    });

    it('should mark an ancestor when given a per-state value', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<a
          ${uiSref('parent')}
          ${uiSrefActive({
            activeClasses: ['active'],
            ariaCurrentValue: { exact: 'page', active: 'location' },
          })}
          >Parent</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent.child');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.getAttribute('aria-current')).toBe('location');
    });

    it('should take the exact value, not the active one, when exactly active', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<a
          ${uiSref('parent')}
          ${uiSrefActive({
            activeClasses: ['active'],
            ariaCurrentValue: { exact: 'page', active: 'location' },
          })}
          >Parent</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent');
      await tick(100);

      // exact is a branch, not an addition: `active` is not consulted here.
      const anchor = wrapper.querySelector('a')!;
      expect(anchor.getAttribute('aria-current')).toBe('page');
    });

    it('should keep the ancestor state off when asked for explicitly', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<a
          ${uiSref('parent')}
          ${uiSrefActive({
            activeClasses: ['active'],
            ariaCurrentValue: { exact: 'page', active: false },
          })}
          >Parent</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent.child');
      await tick(100);

      // `active` already defaults to false, so this is the same behaviour as
      // omitting the key. Pinned so that giving `active` a non-false default
      // later cannot silently start marking ancestors that opted out.
      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('active')).toBe(true);
      expect(anchor.hasAttribute('aria-current')).toBe(false);

      await routerGo(router, 'parent');
      await tick(100);
      expect(anchor.getAttribute('aria-current')).toBe('page');
    });

    it('should keep the exact default when only the active value is given', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<a
          ${uiSref('parent')}
          ${uiSrefActive({
            activeClasses: ['active'],
            ariaCurrentValue: { active: 'location' },
          })}
          >Parent</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent.child');
      await tick(100);
      const anchor = wrapper.querySelector('a')!;
      expect(anchor.getAttribute('aria-current')).toBe('location');

      // The keys default independently: supplying `active` must not cost the
      // link its `exact` default, which the object form otherwise passes
      // through untouched.
      await routerGo(router, 'parent');
      await tick(100);
      expect(anchor.getAttribute('aria-current')).toBe('page');
    });

    it('should not clear an aria-current it did not set', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<a
          aria-current="location"
          ${uiSref('parent')}
          ${uiSrefActive({ activeClasses: ['active'] })}
          >Parent</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent.child');
      await tick(100);

      // Active but not exact, so the directive has nothing to write — and must
      // not treat the template's own value as its to remove.
      const anchor = wrapper.querySelector('a')!;
      expect(anchor.getAttribute('aria-current')).toBe('location');
    });

    it('should warn once per element when taking over an authored value', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { wrapper } = await setupWithStates(parentChildStates);

        render(
          html`<a
            aria-current="location"
            ${uiSref('parent')}
            ${uiSrefActive({ activeClasses: ['active'] })}
            >Parent</a
          >`,
          wrapper,
        );
        await tick(50);

        // Nothing written yet, so nothing taken over yet.
        await routerGo(router, 'parent.child');
        await tick(100);
        expect(warn).not.toHaveBeenCalled();

        await routerGo(router, 'parent');
        await tick(100);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toContain('aria-current="location"');

        // The destruction it warned about.
        await routerGo(router, 'parent.child');
        await tick(100);
        const anchor = wrapper.querySelector('a')!;
        expect(anchor.hasAttribute('aria-current')).toBe(false);

        // Re-author the attribute so the directive faces a genuine second
        // takeover — otherwise the "not written yet" branch would carry this
        // assertion and the once-per-element guard would never be exercised.
        anchor.setAttribute('aria-current', 'location');
        await routerGo(router, 'parent');
        await tick(100);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('should stay silent outside lit dev mode, but still take over', async () => {
      // ReactiveElement.enableWarning exists only in lit's development build,
      // which is what production consumers resolve away from
      const enableWarning = UIRouterLitElement.enableWarning;
      UIRouterLitElement.enableWarning = undefined;
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const { wrapper } = await setupWithStates(parentChildStates);

        render(
          html`<a
            aria-current="location"
            ${uiSref('parent')}
            ${uiSrefActive({ activeClasses: ['active'] })}
            >Parent</a
          >`,
          wrapper,
        );
        await tick(50);

        await routerGo(router, 'parent');
        await tick(100);

        expect(warn).not.toHaveBeenCalled();
        // only the warning is gated; the takeover itself still happens
        const anchor = wrapper.querySelector('a')!;
        expect(anchor.getAttribute('aria-current')).toBe('page');
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

    it('should not warn when there was no authored value to take over', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { wrapper } = await setupWithStates(parentChildStates);

        render(
          html`<a
            ${uiSref('parent')}
            ${uiSrefActive({ activeClasses: ['active'] })}
            >Parent</a
          >`,
          wrapper,
        );
        await tick(50);

        await routerGo(router, 'parent');
        await tick(100);

        const anchor = wrapper.querySelector('a')!;
        expect(anchor.getAttribute('aria-current')).toBe('page');
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('should not warn when aria-current is disabled', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { wrapper } = await setupWithStates(parentChildStates);

        render(
          html`<a
            aria-current="page"
            ${uiSref('parent')}
            ${uiSrefActive({
              activeClasses: ['active'],
              ariaCurrentValue: false,
            })}
            >Parent</a
          >`,
          wrapper,
        );
        await tick(50);

        await routerGo(router, 'parent');
        await tick(100);

        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('should leave a consumer-managed value alone when disabled', async () => {
      const { wrapper } = await setupWithStates(parentChildStates);

      render(
        html`<a
          aria-current="page"
          ${uiSref('parent')}
          ${uiSrefActive({
            activeClasses: ['active'],
            ariaCurrentValue: false,
          })}
          >Parent</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'parent');
      await tick(100);

      // `false` is the full opt-out: the directive neither writes nor clears,
      // even in the state where it would otherwise be authoritative.
      const anchor = wrapper.querySelector('a')!;
      expect(anchor.getAttribute('aria-current')).toBe('page');
      expect(anchor.classList.contains('active')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on disconnect', async () => {
      const states: LitStateDeclaration[] = [{ name: 'home', url: '/home' }];
      const { wrapper } = await setupWithStates(states);

      render(
        html`<a
          ${uiSref('home')}
          ${uiSrefActive({ activeClasses: ['active'], exactClasses: [] })}
          >Home</a
        >`,
        wrapper,
      );
      await tick(50);

      await routerGo(router, 'home');
      await tick(100);

      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('active')).toBe(true);

      // Remove the element
      anchor.remove();
      await tick();

      // Navigate should not throw
      await routerGo(router, 'home');
      await tick(100);
    });
  });

  describe('missing <ui-router> ancestor', () => {
    // one template factory, so a re-render reuses the element rather than
    // producing a fresh one with a fresh directive
    const link = () =>
      html`<a ${uiSrefActive({ activeClasses: ['active'], state: 'home' })}
        >Home</a
      >`;

    it('should warn once when an update finds no router', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(link(), container);
        await tick(50);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toBe(
          'lit-ui-router: <a uiSrefActive> found no <ui-router> ancestor, ' +
            'so it will never be marked active. Wrap this subtree in ' +
            '<ui-router>, or pass a router explicitly.',
        );

        // the no-op is unchanged: no classes, no throw
        const anchor = container.querySelector('a')!;
        expect(anchor.classList.contains('active')).toBe(false);

        // and a re-render does not repeat itself
        render(link(), container);
        await tick(50);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('should warn once for an element carrying both directives', async () => {
      // one missing provider trips uiSref's render and uiSrefActive's update on
      // the same element; the shared registry keeps that to one message
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          html`<a
            ${uiSref('home')}
            ${uiSrefActive({ activeClasses: ['active'] })}
            >Home</a
          >`,
          container,
        );
        await tick(100);

        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('should stay silent outside lit dev mode, but still no-op', async () => {
      // ReactiveElement.enableWarning exists only in lit's development build,
      // which is what production consumers resolve away from
      const enableWarning = UIRouterLitElement.enableWarning;
      UIRouterLitElement.enableWarning = undefined;
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        render(link(), container);
        await tick(50);

        expect(warn).not.toHaveBeenCalled();
        // only the warning is gated, never the behaviour
        expect(container.querySelector('a')!.classList.contains('active')).toBe(
          false,
        );
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

    it('should not warn when a correctly wired app renders', async () => {
      // the whole surface at once: provider, view, link and active link
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { wrapper } = await setupWithStates([
          { name: 'home', url: '/home' },
          { name: 'about', url: '/about' },
        ]);

        wrapper.appendChild(document.createElement('ui-view'));
        const nav = () =>
          html`<a
            ${uiSref('home')}
            ${uiSrefActive({ activeClasses: ['active'] })}
            >Home</a
          >`;
        render(nav(), wrapper);
        await tick(50);
        render(nav(), wrapper);
        await tick(50);

        await routerGo(router, 'home');
        await tick(100);

        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  });
});

describe('UiSrefActiveDirective', () => {
  it('should throw when used on non-element part', () => {
    expect(() => {
      new UiSrefActiveDirective(createPartInfo(PartType.ATTRIBUTE));
    }).toThrow('The `uiSrefActive` directive must be used as an element');
  });

  it('should not throw when used on element part', () => {
    expect(() => {
      new UiSrefActiveDirective(createPartInfo(PartType.ELEMENT));
    }).not.toThrow();
  });
});

describe('SrefStatus interface', () => {
  it('should have correct shape', () => {
    const status: SrefStatus = {
      active: true,
      exact: false,
      entering: false,
      exiting: false,
      targetStates: [],
    };

    expect(status.active).toBe(true);
    expect(status.exact).toBe(false);
    expect(status.entering).toBe(false);
    expect(status.exiting).toBe(false);
    expect(status.targetStates).toEqual([]);
  });
});

describe('TransitionStateChange enum', () => {
  it('should have start value', () => {
    expect(TransitionStateChange.start).toBe('start');
  });

  it('should have success value', () => {
    expect(TransitionStateChange.success).toBe('success');
  });

  it('should have error value', () => {
    expect(TransitionStateChange.error).toBe('error');
  });
});

describe('TRANSITION_STATE_CHANGE_EVENT constant', () => {
  it('should be defined', () => {
    expect(TRANSITION_STATE_CHANGE_EVENT).toBe('transitionStateChange');
  });
});

describe('mergeSrefStatus helper', () => {
  it('should merge active with OR logic', () => {
    const left: SrefStatus = {
      active: true,
      exact: false,
      entering: false,
      exiting: false,
      targetStates: [],
    };
    const right: SrefStatus = {
      active: false,
      exact: false,
      entering: false,
      exiting: false,
      targetStates: [],
    };
    const result = mergeSrefStatus(left, right);
    expect(result.active).toBe(true);
  });

  it('should merge exact with OR logic', () => {
    const left: SrefStatus = {
      active: false,
      exact: true,
      entering: false,
      exiting: false,
      targetStates: [],
    };
    const right: SrefStatus = {
      active: false,
      exact: false,
      entering: false,
      exiting: false,
      targetStates: [],
    };
    const result = mergeSrefStatus(left, right);
    expect(result.exact).toBe(true);
  });

  it('should merge entering with OR logic', () => {
    const left: SrefStatus = {
      active: false,
      exact: false,
      entering: true,
      exiting: false,
      targetStates: [],
    };
    const right: SrefStatus = {
      active: false,
      exact: false,
      entering: false,
      exiting: false,
      targetStates: [],
    };
    const result = mergeSrefStatus(left, right);
    expect(result.entering).toBe(true);
  });

  it('should merge exiting with OR logic', () => {
    const left: SrefStatus = {
      active: false,
      exact: false,
      entering: false,
      exiting: true,
      targetStates: [],
    };
    const right: SrefStatus = {
      active: false,
      exact: false,
      entering: false,
      exiting: false,
      targetStates: [],
    };
    const result = mergeSrefStatus(left, right);
    expect(result.exiting).toBe(true);
  });

  it('should combine targetStates from both sides', () => {
    const targetState = {} as TargetState;
    const left: SrefStatus = {
      active: false,
      exact: false,
      entering: false,
      exiting: false,
      targetStates: [targetState],
    };
    const right: SrefStatus = {
      active: false,
      exact: false,
      entering: false,
      exiting: false,
      targetStates: [targetState],
    };
    const result = mergeSrefStatus(left, right);
    expect(result.targetStates).toHaveLength(2);
  });
});

describe('UiSrefActiveDirective methods', () => {
  let container: HTMLElement;
  let router: UIRouterLit;
  let directive: UiSrefActiveDirective;
  let element: HTMLDivElement;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    router = createTestRouter([{ name: 'home', url: '/home' }]);

    const uiRouter = document.createElement('ui-router');
    uiRouter.uiRouter = router;
    container.appendChild(uiRouter);
    await waitForUpdate(uiRouter);

    element = document.createElement('div');
    uiRouter.appendChild(element);

    directive = new UiSrefActiveDirective(createPartInfo(PartType.ELEMENT));
    directive.element = element;
    directive.uiRouter = router;

    router.start();
    await tick();
  });

  afterEach(async () => {
    container.remove();
    await tick();
  });

  describe('getOptions', () => {
    it('should return default options when no custom options set', () => {
      const options = directive.getOptions();
      expect(options.relative).toBeUndefined();
    });

    it('should override with custom options', () => {
      directive.options = { reload: true, inherit: false };
      const options = directive.getOptions();
      expect(options.reload).toBe(true);
      expect(options.inherit).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return undefined when targetStates is empty', () => {
      directive.targetStates.clear();
      const status = directive.getStatus();
      expect(status).toBeUndefined();
    });

    it('should return merged status when targetStates has entries', async () => {
      const targetState = router.stateService.target('home', {}, {});
      directive.targetStates.add(targetState);
      await routerGo(router, 'home');
      await tick();
      const status = directive.getStatus();
      expect(status).toBeDefined();
      expect(status?.active).toBe(true);
    });
  });

  describe('getSrefStatus', () => {
    it('should handle transition event with empty treeChanges result', async () => {
      await routerGo(router, 'home');
      await tick();

      const targetState = router.stateService.target('home', {}, {});
      const trans = {
        treeChanges: () => ({
          to: [],
          from: [],
          retained: [],
          entering: [],
          exiting: [],
        }),
        promise: Promise.resolve(),
      } as unknown as Transition;

      const event: any = { evt: 'start', trans, status: undefined };
      const status = directive.getSrefStatus(event, targetState);
      expect(status).toBeDefined();
      expect(status?.targetStates).toHaveLength(1);
    });

    it('should handle multiple target states', async () => {
      router.stateRegistry.register({ name: 'about', url: '/about' });
      await tick();

      await routerGo(router, 'home');
      await tick();

      const targetState1 = router.stateService.target('home', {}, {});
      const targetState2 = router.stateService.target('about', {}, {});

      directive.targetStates.add(targetState1);
      directive.targetStates.add(targetState2);

      const status = directive.getStatus();
      expect(status).toBeDefined();
      expect(status?.targetStates).toHaveLength(2);
    });
  });

  describe('disconnected', () => {
    it('should remove UI_SREF_TARGET_EVENT listener', () => {
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
      directive.disconnected();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        UI_SREF_TARGET_EVENT,
        expect.any(Function),
      );
    });

    it('should remove TRANSITION_STATE_CHANGE_EVENT listener', () => {
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
      directive.disconnected();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        TRANSITION_STATE_CHANGE_EVENT,
        expect.any(Function),
      );
    });

    // hold the spy locally: disconnected() drops the reference after calling it
    it('should call _deregisterOnStart', () => {
      const deregister = vi.fn();
      directive._deregisterOnStart = deregister;
      directive.disconnected();
      expect(deregister).toHaveBeenCalled();
    });

    it('should call _deregisterOnStatesChanged', () => {
      const deregister = vi.fn();
      directive._deregisterOnStatesChanged = deregister;
      directive.disconnected();
      expect(deregister).toHaveBeenCalled();
    });

    it('should set element to null', () => {
      directive.disconnected();
      expect(directive.element).toBeNull();
    });
  });

  describe('reconnected', () => {
    // update() never ran, so there is no part element to re-arm against
    it('should do nothing when no part element was ever seen', () => {
      directive.disconnected();
      directive.reconnected();
      expect(directive.element).toBeNull();
      expect(directive._firstUpdated).toBe(false);
    });
  });

  describe('onTransitionStart', () => {
    it('should dispatch start event', () => {
      const dispatchEventSpy = vi.spyOn(element, 'dispatchEvent');
      const trans = {
        treeChanges: () => ({}),
        promise: Promise.resolve(),
      } as unknown as Transition;
      directive.onTransitionStart(trans);
      expect(dispatchEventSpy).toHaveBeenCalled();
    });

    it('should dispatch an error event when the transition rejects', async () => {
      const trans = {
        treeChanges: () => ({}),
        promise: Promise.reject(new Error('aborted')),
      } as unknown as Transition;
      // the directive handles it; this keeps the spec's own read handled too
      trans.promise.catch(() => {});

      directive.onTransitionStart(trans);
      const dispatchEventSpy = vi.spyOn(element, 'dispatchEvent');
      await tick();

      const [event] = dispatchEventSpy.mock.calls[0] as [CustomEvent];
      expect(event.detail.evt).toBe(TransitionStateChange.error);
    });

    // deregistering stops the next onStart, not a settlement already subscribed
    it('should stay quiet when the transition settles after a disconnect', async () => {
      let settle!: () => void;
      const trans = {
        treeChanges: () => ({}),
        promise: new Promise<void>((resolve) => (settle = resolve)),
      } as unknown as Transition;

      directive.onTransitionStart(trans);
      const dispatchEventSpy = vi.spyOn(element, 'dispatchEvent');
      // the settlement reaches for `element` to dispatch on; without the guard
      // it builds the event, then throws on the null. Watching the build is
      // what separates "skipped" from "threw on the way".
      const buildEventSpy = vi.spyOn(
        directive,
        'createTransitionStateChangeEvent',
      );

      directive.disconnected();
      settle();
      await expect(trans.promise).resolves.toBeUndefined();
      await tick();

      expect(buildEventSpy).not.toHaveBeenCalled();
      expect(dispatchEventSpy).not.toHaveBeenCalled();
    });
  });

  describe('onTransitionStateChange', () => {
    it('should process transition state change event without throwing', async () => {
      await routerGo(router, 'home');
      await tick();

      const targetState = router.stateService.target('home', {}, {});
      directive.targetStates.add(targetState);
      directive.uiRouter = router;
      directive.active = false;
      directive.exact = false;

      const stateObj = targetState.$state();
      const pathNode: any = {
        state: stateObj,
        paramSchema: [],
        resolves: [],
        ownParams: [],
        paramValues: {},
      };
      const trans = {
        treeChanges: () => ({
          to: [pathNode],
          from: [],
          retained: [],
          entering: [],
          exiting: [],
        }),
        promise: Promise.resolve(),
      } as unknown as Transition;

      const event: any = {
        evt: 'success',
        trans,
        status: undefined,
      };
      directive.onTransitionStateChange({ detail: event } as any);
      await tick();
      expect(directive.active).toBeDefined();
    });

    it('should return early when status is undefined', () => {
      const event: any = {
        evt: 'success',
        trans: {} as Transition,
        status: undefined,
      };
      directive.active = undefined;
      directive.onTransitionStateChange({ detail: event } as any);
      expect(directive.active).toBeUndefined();
    });
  });

  describe('onUiSrefTargetEvent', () => {
    it('should add targetState to targetStates set', () => {
      const targetState = router.stateService.target('home', {}, {}) as any;
      const event: any = {
        detail: { targetState },
        target: element,
      };
      directive.onUiSrefTargetEvent(event);
      expect(directive.targetStates.has(targetState)).toBe(true);
    });
  });

  describe('onStatesChanged', () => {
    it('should update active and exact flags when states change', async () => {
      await routerGo(router, 'home');
      await tick();

      const targetState = router.stateService.target('home', {}, {});
      directive.targetStates.add(targetState);
      directive.uiRouter = router;

      const doRenderSpy = vi.spyOn(directive, 'doRender');

      directive.onStatesChanged();

      expect(directive.active).toBe(true);
      expect(doRenderSpy).toHaveBeenCalled();
    });

    it('should call onStatesChanged callback when state is registered', async () => {
      const targetState = router.stateService.target('home', {}, {});
      directive.targetStates.add(targetState);
      directive.uiRouter = router;
      directive.active = undefined;
      directive.exact = undefined;
      directive.isConnected = true;
      const onStatesChangedSpy = vi.spyOn(directive, 'onStatesChanged');
      const onStatesChangedRegistrySpy = vi.spyOn(
        router.stateRegistry,
        'onStatesChanged',
      );
      directive.firstUpdated({});
      await tick();
      expect(onStatesChangedRegistrySpy).toHaveBeenCalled();
      router.stateRegistry.register({ name: 'about', url: '/about' });
      await tick();
      expect(onStatesChangedSpy).toHaveBeenCalled();
    });
  });
});

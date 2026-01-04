import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, render } from 'lit';
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
import { UiView } from '../ui-view.js';
import { UIRouterLit } from '../core.js';
import { LitStateDeclaration } from '../interface.js';
import {
  createTestRouter,
  tick,
  waitForUpdate,
  routerGo,
} from './test-utils.js';

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

    const uiRouter = document.createElement('ui-router') as UIRouterLitElement;
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

      const anchor = wrapper.querySelector('a') as HTMLAnchorElement;
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

      const anchor = wrapper.querySelector('a') as HTMLAnchorElement;
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

      const anchor = wrapper.querySelector('a') as HTMLAnchorElement;
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

      const anchor = wrapper.querySelector('a') as HTMLAnchorElement;
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

      const anchor = wrapper.querySelector('a') as HTMLAnchorElement;
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

      const anchor = wrapper.querySelector('a') as HTMLAnchorElement;
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

      const anchor = wrapper.querySelector('a') as HTMLAnchorElement;
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

      const anchor = wrapper.querySelector('a') as HTMLAnchorElement;
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

      const anchor = wrapper.querySelector('a') as HTMLAnchorElement;
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

      const div = wrapper.querySelector('div') as HTMLDivElement;
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

      const li = wrapper.querySelector('li') as HTMLLIElement;
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

      const nav = wrapper.querySelector('nav') as HTMLElement;
      expect(nav.classList.contains('has-active')).toBe(true);
    });
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

      const anchor = wrapper.querySelector('a') as HTMLAnchorElement;
      expect(anchor.classList.contains('active')).toBe(true);

      // Remove the element
      anchor.remove();
      await tick();

      // Navigate should not throw
      await routerGo(router, 'home');
      await tick(100);
    });
  });
});

describe('UiSrefActiveDirective', () => {
  it('should throw when used on non-element part', () => {
    expect(() => {
      // Simulate attribute part type (type 1)
      new UiSrefActiveDirective({ type: 1 } as any);
    }).toThrow('The `uiSrefActive` directive must be used as an element');
  });

  it('should not throw when used on element part', () => {
    expect(() => {
      // Correct element part type (type 6)
      new UiSrefActiveDirective({ type: 6 } as any);
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

    const uiRouter = document.createElement('ui-router') as UIRouterLitElement;
    uiRouter.uiRouter = router;
    container.appendChild(uiRouter);
    await waitForUpdate(uiRouter);

    element = document.createElement('div');
    uiRouter.appendChild(element);

    const partInfo = { type: 6 } as any;
    directive = new UiSrefActiveDirective(partInfo);
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
    it('should remove UI_SREF_TARGET_EVENT listener', async () => {
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
      directive.disconnected();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        UI_SREF_TARGET_EVENT,
        expect.any(Function),
      );
    });

    it('should remove TRANSITION_STATE_CHANGE_EVENT listener', async () => {
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');
      directive.disconnected();
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        TRANSITION_STATE_CHANGE_EVENT,
        expect.any(Function),
      );
    });

    it('should call _deregisterOnStart', async () => {
      directive._deregisterOnStart = vi.fn();
      directive.disconnected();
      expect(directive._deregisterOnStart).toHaveBeenCalled();
    });

    it('should call _deregisterOnStatesChanged', async () => {
      directive._deregisterOnStatesChanged = vi.fn();
      directive.disconnected();
      expect(directive._deregisterOnStatesChanged).toHaveBeenCalled();
    });

    it('should set element to null', async () => {
      directive.disconnected();
      expect(directive.element).toBeNull();
    });
  });

  describe('onTransitionStart', () => {
    it('should dispatch start event', async () => {
      const dispatchEventSpy = vi.spyOn(element, 'dispatchEvent');
      const trans = {
        treeChanges: () => ({}),
        promise: Promise.resolve(),
      } as unknown as Transition;
      directive.onTransitionStart(trans);
      expect(dispatchEventSpy).toHaveBeenCalled();
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

    it('should return early when status is undefined', async () => {
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
    it('should add targetState to targetStates set', async () => {
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

    it('should update flags when new state is registered', async () => {
      const targetState = router.stateService.target('home', {}, {});
      directive.targetStates.add(targetState);
      directive.uiRouter = router;
      directive.active = undefined;
      directive.exact = undefined;

      router.stateRegistry.register({ name: 'about', url: '/about' });
      await tick();

      const doRenderSpy = vi.spyOn(directive, 'doRender');
      directive.onStatesChanged();

      expect(directive.active).toBeDefined();
      expect(doRenderSpy).toHaveBeenCalled();
    });
  });
});

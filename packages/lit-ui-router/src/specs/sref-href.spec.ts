import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, nothing, render, TemplateResult } from 'lit';
import { cache } from 'lit/directives/cache.js';
import { AttributePartInfo, PartInfo, PartType } from 'lit/directive.js';

import { srefHref, SrefHrefDirective } from '../sref-href.js';
import { uiSrefActive } from '../ui-sref-active.js';
import { UI_SREF_TARGET_EVENT, UiSrefTargetEvent } from '../ui-sref.js';
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

const states: LitStateDeclaration[] = [
  { name: 'home', url: '/home' },
  { name: 'users', url: '/users' },
  { name: 'users.detail', url: '/:userId' },
  { name: 'nourl' },
];

/** a stand-in for the part info lit hands a directive bound in an attribute */
function attributePart(name: string, strings?: string[]): PartInfo {
  const info: AttributePartInfo = {
    type: PartType.ATTRIBUTE,
    name,
    tagName: 'a',
    strings,
  };
  return info;
}

describe('srefHref directive', () => {
  let container: HTMLElement;
  let router: UIRouterLit;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    container.remove();
    await tick(10);
    router?.dispose();
    await tick();
  });

  async function mount(
    template: TemplateResult,
    routerStates = states,
  ): Promise<HTMLElement> {
    router = createTestRouter(routerStates);
    const uiRouter = document.createElement('ui-router');
    uiRouter.uiRouter = router;
    container.appendChild(uiRouter);
    await waitForUpdate(uiRouter);

    const wrapper = document.createElement('div');
    uiRouter.appendChild(wrapper);
    router.start();
    await tick();

    render(template, wrapper);
    await tick(20);
    return wrapper;
  }

  describe('href', () => {
    it('writes the href once the router is found', async () => {
      const wrapper = await mount(html`<a href=${srefHref('users')}>Users</a>`);
      expect(wrapper.querySelector('a')!.getAttribute('href')).toBe('#/users');
    });

    it('writes params into the href', async () => {
      const wrapper = await mount(
        html`<a href=${srefHref('users.detail', { userId: 42 })}>User</a>`,
      );
      expect(wrapper.querySelector('a')!.getAttribute('href')).toBe(
        '#/users/42',
      );
    });

    it('leaves the attribute off for a state without a url', async () => {
      const wrapper = await mount(
        html`<a href=${srefHref('nourl')}>No url</a>`,
      );
      expect(wrapper.querySelector('a')!.hasAttribute('href')).toBe(false);
    });

    it('follows a re-render that changes the params', async () => {
      const link = (userId: number) =>
        html`<a href=${srefHref('users.detail', { userId })}>User</a>`;
      const wrapper = await mount(link(1));
      const anchor = wrapper.querySelector('a')!;
      expect(anchor.getAttribute('href')).toBe('#/users/1');

      render(link(2), wrapper);
      await tick();
      expect(anchor.getAttribute('href')).toBe('#/users/2');
    });

    it('follows a state registered after the first render', async () => {
      const wrapper = await mount(html`<a href=${srefHref('late')}>Late</a>`);
      const anchor = wrapper.querySelector('a')!;
      expect(anchor.hasAttribute('href')).toBe(false);

      router.stateRegistry.register({ name: 'late', url: '/late' });
      await tick();
      expect(anchor.getAttribute('href')).toBe('#/late');
    });
  });

  describe('click', () => {
    /**
     * Records whether the directive claimed the click, then claims it anyway
     * so happy-dom does not follow the href for real.
     */
    function claimAfter(element: Element): () => boolean {
      let claimed = false;
      element.addEventListener('click', (event) => {
        claimed = event.defaultPrevented;
        event.preventDefault();
      });
      return () => claimed;
    }

    it('navigates to the state and claims the click', async () => {
      const wrapper = await mount(html`<a href=${srefHref('users')}>Users</a>`);
      const go = vi.spyOn(router.stateService, 'go');
      const anchor = wrapper.querySelector('a')!;

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      anchor.dispatchEvent(event);
      await tick(20);

      expect(event.defaultPrevented).toBe(true);
      expect(go).toHaveBeenCalledWith(
        'users',
        {},
        expect.objectContaining({ inherit: true, source: 'sref' }),
      );
      expect(router.globals.current.name).toBe('users');
    });

    it('leaves a modified click to the browser', async () => {
      const wrapper = await mount(html`<a href=${srefHref('users')}>Users</a>`);
      const go = vi.spyOn(router.stateService, 'go');
      const claimed = claimAfter(wrapper);

      clickElement(wrapper.querySelector('a')!, { ctrlKey: true });
      await tick();

      expect(claimed()).toBe(false);
      expect(go).not.toHaveBeenCalled();
    });

    it('leaves a click on an off-app link to the browser', async () => {
      const wrapper = await mount(
        html`<a href=${srefHref('users')} target="_blank">Users</a>`,
      );
      const go = vi.spyOn(router.stateService, 'go');
      const claimed = claimAfter(wrapper);

      clickElement(wrapper.querySelector('a')!);
      await tick();

      expect(claimed()).toBe(false);
      expect(go).not.toHaveBeenCalled();
    });

    it('stops navigating once disconnected', async () => {
      const wrapper = await mount(html`<a href=${srefHref('users')}>Users</a>`);
      const anchor = wrapper.querySelector('a')!;
      render(html``, wrapper);
      await tick();

      const go = vi.spyOn(router.stateService, 'go');
      const claimed = claimAfter(anchor);

      clickElement(anchor);
      await tick();

      expect(claimed()).toBe(false);
      expect(go).not.toHaveBeenCalled();
    });
  });

  describe('target event', () => {
    it('announces its target so an enclosing uiSrefActive tracks it', async () => {
      const wrapper = await mount(
        html`<li ${uiSrefActive({ activeClasses: ['active'] })}>
          <a href=${srefHref('users')}>Users</a>
        </li>`,
      );
      await tick(50);
      const item = wrapper.querySelector('li')!;

      await routerGo(router, 'users.detail', { userId: 1 });
      await tick(50);
      expect(item.classList.contains('active')).toBe(true);

      await routerGo(router, 'home');
      await tick(50);
      expect(item.classList.contains('active')).toBe(false);
    });

    it('re-announces when the target changes, not when only the href would', async () => {
      const link = (userId: number) =>
        html`<a href=${srefHref('users.detail', { userId })}>User</a>`;
      const targets: unknown[] = [];
      container.addEventListener(UI_SREF_TARGET_EVENT, ((
        event: UiSrefTargetEvent,
      ) => {
        targets.push(event.detail.targetState.params().userId);
      }) as EventListener);

      const wrapper = await mount(link(1));
      expect(targets).toEqual([1]);

      render(link(1), wrapper);
      await tick();
      expect(targets).toEqual([1]);

      render(link(2), wrapper);
      await tick();
      expect(targets).toEqual([1, 2]);
    });
  });

  describe('part position', () => {
    const at = (partInfo: PartInfo) => () => new SrefHrefDirective(partInfo);

    it('rejects an element part', () => {
      expect(at({ type: PartType.ELEMENT })).toThrow(
        /only expression in an attribute/,
      );
    });

    it('rejects sharing the attribute with other expressions', () => {
      expect(at(attributePart('href', ['', '#frag']))).toThrow(
        /only expression in an attribute/,
      );
    });

    it('accepts an attribute part it has to itself', () => {
      expect(at(attributePart('href'))).not.toThrow();
    });
  });

  describe('lifecycle', () => {
    it('lets go when disconnected and picks up again when reconnected', async () => {
      const link = (show: boolean) =>
        html`${cache(
          show ? html`<a href=${srefHref('users')}>Users</a>` : nothing,
        )}`;
      const wrapper = await mount(link(true));
      const anchor = wrapper.querySelector('a')!;
      expect(anchor.getAttribute('href')).toBe('#/users');

      render(link(false), wrapper);
      await tick();
      expect(wrapper.querySelector('a')).toBeNull();

      render(link(true), wrapper);
      await tick(20);
      expect(wrapper.querySelector('a')).toBe(anchor);

      const go = vi.spyOn(router.stateService, 'go');
      clickElement(anchor);
      await tick();
      expect(go).toHaveBeenCalledTimes(1);
    });

    it('does nothing when removed before its first seek', async () => {
      const wrapper = await mount(html``);
      render(html`<a href=${srefHref('users')}>Users</a>`, wrapper);
      const anchor = wrapper.querySelector('a')!;
      render(html``, wrapper);
      await tick(20);
      expect(anchor.hasAttribute('href')).toBe(false);
    });
  });

  describe('missing <ui-router> ancestor', () => {
    const link = () => html`<a href=${srefHref('home')}>Home</a>`;

    it('warns once and writes nothing', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(link(), container);
        await tick(50);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toBe(
          "lit-ui-router: <a href=${srefHref('home')}> found no <ui-router> ancestor, " +
            'so it will not navigate. Wrap this subtree in ' +
            '<ui-router>, or pass a router explicitly.',
        );
        const anchor = container.querySelector('a')!;
        expect(anchor.hasAttribute('href')).toBe(false);

        clickElement(anchor);
        render(link(), container);
        await tick(50);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });
  });
});

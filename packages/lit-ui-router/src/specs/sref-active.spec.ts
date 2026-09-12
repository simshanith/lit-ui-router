import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, nothing, render, TemplateResult } from 'lit';
import { cache } from 'lit/directives/cache.js';
import { AttributePartInfo, PartInfo, PartType } from 'lit/directive.js';

import {
  srefActiveClass,
  SrefActiveClassDirective,
  srefAriaCurrent,
  SrefAriaCurrentDirective,
} from '../sref-active.js';
import { srefHref } from '../sref-href.js';
import '../ui-view.register.js';
import { UIRouterLit } from '../core.js';
import { LitStateDeclaration } from '../interface.js';
import {
  createTestRouter,
  tick,
  waitForUpdate,
  routerGo,
} from './test-utils.js';

const states: LitStateDeclaration[] = [
  { name: 'home', url: '/home' },
  { name: 'users', url: '/users' },
  { name: 'users.detail', url: '/:userId' },
  {
    name: 'broken',
    url: '/broken',
    resolve: [{ token: 'nope', resolveFn: () => Promise.reject(new Error()) }],
  },
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

describe('attribute-part active directives', () => {
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

  async function mount(template: TemplateResult): Promise<HTMLElement> {
    router = createTestRouter(states);
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

  async function goTo(state: string, params?: Record<string, unknown>) {
    await routerGo(router, state, params);
    await tick(20);
  }

  describe('srefActiveClass', () => {
    it('toggles the active class with the state, keeping static classes', async () => {
      const wrapper = await mount(
        html`<a
          href=${srefHref('users')}
          class="nav-link ${srefActiveClass({
            state: 'users',
            activeClasses: ['active'],
          })}"
          >Users</a
        >`,
      );
      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('nav-link')).toBe(true);
      expect(anchor.classList.contains('active')).toBe(false);

      await goTo('users');
      expect(anchor.classList.contains('active')).toBe(true);
      expect(anchor.classList.contains('nav-link')).toBe(true);

      await goTo('home');
      expect(anchor.classList.contains('active')).toBe(false);
      expect(anchor.classList.contains('nav-link')).toBe(true);
    });

    it('tells active from exact', async () => {
      const wrapper = await mount(
        html`<a
          class=${srefActiveClass({
            state: 'users',
            activeClasses: ['active'],
            exactClasses: ['exact'],
          })}
          >Users</a
        >`,
      );
      const anchor = wrapper.querySelector('a')!;

      await goTo('users');
      expect(anchor.className.split(/\s+/).filter(Boolean).sort()).toEqual([
        'active',
        'exact',
      ]);

      await goTo('users.detail', { userId: 1 });
      expect(anchor.className.split(/\s+/).filter(Boolean)).toEqual(['active']);
    });

    it('leaves classes added by others alone', async () => {
      const wrapper = await mount(
        html`<a
          class=${srefActiveClass({ state: 'users', activeClasses: ['active'] })}
          >Users</a
        >`,
      );
      const anchor = wrapper.querySelector('a')!;
      anchor.classList.add('focus-visible');

      await goTo('users');
      expect(anchor.classList.contains('focus-visible')).toBe(true);
      expect(anchor.classList.contains('active')).toBe(true);

      await goTo('home');
      expect(anchor.classList.contains('focus-visible')).toBe(true);
      expect(anchor.classList.contains('active')).toBe(false);
    });

    it('watches the srefHref links inside it when no state is named', async () => {
      const wrapper = await mount(
        html`<li class=${srefActiveClass({ activeClasses: ['active'] })}>
          <a href=${srefHref('users')}>Users</a>
        </li>`,
      );
      const item = wrapper.querySelector('li')!;
      expect(item.classList.contains('active')).toBe(false);

      await goTo('users.detail', { userId: 1 });
      expect(item.classList.contains('active')).toBe(true);

      await goTo('home');
      expect(item.classList.contains('active')).toBe(false);
    });

    it('follows a re-render that names another state', async () => {
      const link = (state: string) =>
        html`<a class=${srefActiveClass({ state, activeClasses: ['active'] })}
          >Link</a
        >`;
      const wrapper = await mount(link('users'));
      const anchor = wrapper.querySelector('a')!;

      await goTo('home');
      expect(anchor.classList.contains('active')).toBe(false);

      render(link('home'), wrapper);
      await tick();
      expect(anchor.classList.contains('active')).toBe(true);
    });

    it('accepts params for the target', async () => {
      const wrapper = await mount(
        html`<a
          class=${srefActiveClass({
            state: 'users.detail',
            params: { userId: 1 },
            activeClasses: ['active'],
          })}
          >User 1</a
        >`,
      );
      const anchor = wrapper.querySelector('a')!;

      await goTo('users.detail', { userId: 2 });
      expect(anchor.classList.contains('active')).toBe(false);

      await goTo('users.detail', { userId: 1 });
      expect(anchor.classList.contains('active')).toBe(true);
    });

    describe('part position', () => {
      const at = (partInfo: PartInfo) => () =>
        new SrefActiveClassDirective(partInfo);

      it('rejects an element part', () => {
        expect(at({ type: PartType.ELEMENT })).toThrow(/used in an attribute/);
      });

      it('rejects an attribute other than class', () => {
        expect(at(attributePart('href'))).toThrow(/`class` attribute/);
      });

      it('rejects a second expression in class', () => {
        expect(at(attributePart('class', ['a ', ' b ', '']))).toThrow(
          /only expression/,
        );
      });

      it('accepts static classes around it', () => {
        expect(at(attributePart('class', ['nav-link ', '']))).not.toThrow();
      });
    });
  });

  describe('srefAriaCurrent', () => {
    it('writes page while exact and removes it otherwise', async () => {
      const wrapper = await mount(
        html`<a
          href=${srefHref('users')}
          aria-current=${srefAriaCurrent({ state: 'users' })}
          >Users</a
        >`,
      );
      const anchor = wrapper.querySelector('a')!;
      expect(anchor.hasAttribute('aria-current')).toBe(false);

      await goTo('users');
      expect(anchor.getAttribute('aria-current')).toBe('page');

      await goTo('users.detail', { userId: 1 });
      expect(anchor.hasAttribute('aria-current')).toBe(false);

      await goTo('home');
      expect(anchor.hasAttribute('aria-current')).toBe(false);
    });

    it('takes any element, since binding the attribute is the opt-in', async () => {
      const wrapper = await mount(
        html`<tr
          aria-current=${srefAriaCurrent({ state: 'users', value: 'true' })}
        >
          <td>Users</td>
        </tr>`,
      );
      const row = wrapper.querySelector('tr')!;

      await goTo('users');
      expect(row.getAttribute('aria-current')).toBe('true');
    });

    it('marks an active ancestor with the object form', async () => {
      const wrapper = await mount(
        html`<a
          aria-current=${srefAriaCurrent({
            state: 'users',
            value: { exact: 'page', active: 'location' },
          })}
          >Users</a
        >`,
      );
      const anchor = wrapper.querySelector('a')!;

      await goTo('users');
      expect(anchor.getAttribute('aria-current')).toBe('page');

      await goTo('users.detail', { userId: 1 });
      expect(anchor.getAttribute('aria-current')).toBe('location');
    });

    it('watches the srefHref links inside it when no state is named', async () => {
      const wrapper = await mount(
        html`<li aria-current=${srefAriaCurrent({})}>
          <a href=${srefHref('users')}>Users</a>
        </li>`,
      );
      const item = wrapper.querySelector('li')!;

      await goTo('users');
      expect(item.getAttribute('aria-current')).toBe('page');

      await goTo('home');
      expect(item.hasAttribute('aria-current')).toBe(false);
    });

    describe('part position', () => {
      const at = (partInfo: PartInfo) => () =>
        new SrefAriaCurrentDirective(partInfo);

      it('rejects an element part', () => {
        expect(at({ type: PartType.ELEMENT })).toThrow(/used in an attribute/);
      });

      it('rejects sharing the attribute', () => {
        expect(at(attributePart('aria-current', ['', ' x']))).toThrow(
          /only expression/,
        );
      });
    });
  });

  describe('lifecycle', () => {
    it('stops and restarts with its part', async () => {
      const link = (show: boolean) =>
        html`${cache(
          show
            ? html`<a
                class=${srefActiveClass({
                  state: 'users',
                  activeClasses: ['active'],
                })}
                >Users</a
              >`
            : nothing,
        )}`;
      const wrapper = await mount(link(true));
      const anchor = wrapper.querySelector('a')!;

      render(link(false), wrapper);
      await tick();
      await goTo('users');
      expect(anchor.classList.contains('active')).toBe(false);

      render(link(true), wrapper);
      await tick(20);
      expect(wrapper.querySelector('a')).toBe(anchor);
      expect(anchor.classList.contains('active')).toBe(true);
    });

    it('does nothing when removed before its first seek', async () => {
      const wrapper = await mount(html``);
      render(
        html`<a
          class=${srefActiveClass({ state: 'users', activeClasses: ['active'] })}
          >Users</a
        >`,
        wrapper,
      );
      const anchor = wrapper.querySelector('a')!;
      render(html``, wrapper);
      await goTo('users');
      expect(anchor.classList.contains('active')).toBe(false);
    });

    it('settles again after a transition fails', async () => {
      const wrapper = await mount(
        html`<a
          class=${srefActiveClass({ state: 'users', activeClasses: ['active'] })}
          >Users</a
        >`,
      );
      const anchor = wrapper.querySelector('a')!;
      await goTo('users');
      expect(anchor.classList.contains('active')).toBe(true);

      await router.stateService.go('broken').catch(() => {});
      await tick(20);
      expect(anchor.classList.contains('active')).toBe(true);
    });

    it('follows a state registered after the first render', async () => {
      const wrapper = await mount(
        html`<a
          class=${srefActiveClass({ state: 'late', activeClasses: ['active'] })}
          >Late</a
        >`,
      );
      const anchor = wrapper.querySelector('a')!;

      router.stateRegistry.register({ name: 'late', url: '/late' });
      await tick();
      await goTo('late');
      expect(anchor.classList.contains('active')).toBe(true);
    });

    it('forgets a link that left the container', async () => {
      const links = (users: boolean) =>
        html`<li class=${srefActiveClass({ activeClasses: ['active'] })}>
          ${users ? html`<a href=${srefHref('users')}>Users</a>` : nothing}
          <a href=${srefHref('home')}>Home</a>
        </li>`;
      const wrapper = await mount(links(true));
      const item = wrapper.querySelector('li')!;

      await goTo('users');
      expect(item.classList.contains('active')).toBe(true);

      render(links(false), wrapper);
      await tick();
      await goTo('home');
      await goTo('users');
      expect(item.classList.contains('active')).toBe(false);
    });

    it('drops a class a re-render no longer names', async () => {
      const link = (classes: string[]) =>
        html`<a
          class=${srefActiveClass({ state: 'users', activeClasses: classes })}
          >Users</a
        >`;
      const wrapper = await mount(link(['active', 'current']));
      const anchor = wrapper.querySelector('a')!;

      await goTo('users');
      expect(anchor.classList.contains('current')).toBe(true);

      render(link(['active']), wrapper);
      await tick();
      expect(anchor.classList.contains('current')).toBe(false);
      expect(anchor.classList.contains('active')).toBe(true);
    });
    it('starts out active when mounted on the current state', async () => {
      router = createTestRouter(states);
      const uiRouter = document.createElement('ui-router');
      uiRouter.uiRouter = router;
      container.appendChild(uiRouter);
      await waitForUpdate(uiRouter);
      const wrapper = document.createElement('div');
      uiRouter.appendChild(wrapper);
      router.start();
      await goTo('users');

      render(
        html`<a
          class="nav ${srefActiveClass({ state: 'users', activeClasses: ['active'] })}"
          >Users</a
        >`,
        wrapper,
      );
      await tick(20);
      const anchor = wrapper.querySelector('a')!;
      expect(anchor.classList.contains('active')).toBe(true);
      expect(anchor.classList.contains('nav')).toBe(true);

      await goTo('home');
      expect(anchor.classList.contains('active')).toBe(false);
    });

    it('stops listening for links once the container is gone', async () => {
      const wrapper = await mount(
        html`<li class=${srefActiveClass({ activeClasses: ['active'] })}>
          <a href=${srefHref('users')}>Users</a>
        </li>`,
      );
      const item = wrapper.querySelector('li')!;
      render(html``, wrapper);
      await tick();
      await goTo('users');
      expect(item.classList.contains('active')).toBe(false);
    });

    it('follows a link whose state registers after the first render', async () => {
      const wrapper = await mount(
        html`<li class=${srefActiveClass({ activeClasses: ['active'] })}>
          <a href=${srefHref('late')}>Late</a>
        </li>`,
      );
      const item = wrapper.querySelector('li')!;

      router.stateRegistry.register({ name: 'late', url: '/late' });
      await tick();
      await goTo('late');
      expect(item.classList.contains('active')).toBe(true);
    });
  });

  describe('missing <ui-router> ancestor', () => {
    it('warns once and applies nothing', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const link = () =>
          html`<a
            class=${srefActiveClass({ state: 'home', activeClasses: ['active'] })}
            >Home</a
          >`;
        render(link(), container);
        await tick(50);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toBe(
          'lit-ui-router: <a class=${srefActiveClass(...)}> found no <ui-router> ancestor, ' +
            'so it will never be marked active. Wrap this subtree in ' +
            '<ui-router>, or pass a router explicitly.',
        );
        expect(container.querySelector('a')!.classList.contains('active')).toBe(
          false,
        );

        render(link(), container);
        await tick(50);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });
  });
});

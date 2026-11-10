import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { html, LitElement, render } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { uiSref } from '../ui-sref.js';
import { uiSrefActive } from '../ui-sref-active.js';
import '../ui-router.register.js';
import { UIRouterLit } from '../core.js';
import { LitStateDeclaration } from '../interface.js';
import {
  createTestRouter,
  routerGo,
  tick,
  waitForUpdate,
} from './test-utils.js';

// Browser-only: happy-dom does not retarget composed events at shadow roots.

/** two uiSref links behind one shadow root: their uiSrefTarget events retarget to the host */
@customElement('test-ui-sref-active-nested-links')
class UiSrefActiveNestedLinks extends LitElement {
  @property({ type: Boolean }) showHome = true;

  render() {
    return html`<a ${uiSref('users')}>Users</a>
      ${this.showHome ? html`<a ${uiSref('home')}>Home</a>` : null}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-ui-sref-active-nested-links': UiSrefActiveNestedLinks;
  }
}

const states: LitStateDeclaration[] = [
  { name: 'home', url: '/home' },
  { name: 'users', url: '/users' },
  { name: 'other', url: '/other' },
];

describe('uiSrefActive container in a real shadow DOM', () => {
  let container: HTMLElement;
  let router: UIRouterLit;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    router = createTestRouter(states);
  });

  afterEach(async () => {
    container.remove();
    await tick(10);
    router?.dispose();
    await tick();
  });

  async function mount(shadow: boolean): Promise<HTMLElement> {
    const uiRouter = document.createElement('ui-router');
    uiRouter.uiRouter = router;
    container.appendChild(uiRouter);
    await waitForUpdate(uiRouter);
    router.start();
    await tick();

    const wrapper = document.createElement('div');
    uiRouter.appendChild(wrapper);

    const active = uiSrefActive({
      activeClasses: ['active'],
      exactClasses: [],
    });

    render(
      shadow
        ? html`<nav ${active}>
            <test-ui-sref-active-nested-links></test-ui-sref-active-nested-links>
          </nav>`
        : html`<nav ${active}>
            <a ${uiSref('users')}>Users</a>
            <a ${uiSref('home')}>Home</a>
          </nav>`,
      wrapper,
    );

    const links = wrapper.querySelector('test-ui-sref-active-nested-links');

    if (links) {
      await waitForUpdate(links);
    }

    await tick(20);

    return wrapper.querySelector('nav')!;
  }

  it('control: keeps every light-DOM link', async () => {
    const nav = await mount(false);
    await routerGo(router, 'users');
    await tick(20);
    expect(nav.classList.contains('active'), 'first link (users)').toBe(true);
    await routerGo(router, 'home');
    await tick(20);
    expect(nav.classList.contains('active'), 'second link (home)').toBe(true);
  });

  it('forgets only the removed link behind a shared shadow host', async () => {
    const nav = await mount(true);
    const links = nav.querySelector('test-ui-sref-active-nested-links')!;
    links.showHome = false;
    await waitForUpdate(links);
    await tick(20);

    await routerGo(router, 'home');
    await tick(20);
    expect(nav.classList.contains('active'), 'removed link (home)').toBe(false);

    await routerGo(router, 'users');
    await tick(20);
    expect(nav.classList.contains('active'), 'kept link (users)').toBe(true);
  });

  it('keeps every link behind a shared shadow host', async () => {
    const nav = await mount(true);
    await routerGo(router, 'users');
    await tick(20);
    expect(nav.classList.contains('active'), 'first link (users)').toBe(true);

    await routerGo(router, 'other');
    await tick(20);
    expect(nav.classList.contains('active'), 'no link (other)').toBe(false);

    await routerGo(router, 'home');
    await tick(20);
    expect(nav.classList.contains('active'), 'second link (home)').toBe(true);
  });
});

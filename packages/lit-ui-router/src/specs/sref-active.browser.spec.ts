import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { html, LitElement, render } from 'lit';
import { customElement } from 'lit/decorators.js';

import { srefActiveClass } from '../sref-active.js';
import { srefHref } from '../sref-href.js';
import '../ui-router.register.js';
import { UIRouterLit } from '../core.js';
import { LitStateDeclaration } from '../interface.js';
import {
  createTestRouter,
  routerGo,
  tick,
  waitForUpdate,
} from './test-utils.js';

// Browser-only: happy-dom does not retarget composed events at shadow roots,
// so `event.target` there is already the link and the case never reproduces.

/** two links behind a shadow root: composed events retarget them */
@customElement('test-sref-active-nested-links')
class SrefActiveNestedLinks extends LitElement {
  render() {
    return html`<a href=${srefHref('users')}>Users</a>
      <a href=${srefHref('home')}>Home</a>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-sref-active-nested-links': SrefActiveNestedLinks;
  }
}

const states: LitStateDeclaration[] = [
  { name: 'home', url: '/home' },
  { name: 'users', url: '/users' },
];

describe('srefActiveClass in a real shadow DOM', () => {
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

  it('keeps every link behind a nested shadow root', async () => {
    const uiRouter = document.createElement('ui-router');
    uiRouter.uiRouter = router;
    container.appendChild(uiRouter);
    await waitForUpdate(uiRouter);
    router.start();
    await tick();

    const wrapper = document.createElement('div');
    uiRouter.appendChild(wrapper);
    render(
      html`<nav class=${srefActiveClass({ activeClasses: ['active'] })}>
        <test-sref-active-nested-links></test-sref-active-nested-links>
      </nav>`,
      wrapper,
    );
    const links = wrapper.querySelector('test-sref-active-nested-links')!;
    await waitForUpdate(links);
    await tick(20);

    const nav = wrapper.querySelector('nav')!;
    await routerGo(router, 'users');
    await tick(20);
    expect(nav.classList.contains('active'), 'first link').toBe(true);

    await routerGo(router, 'home');
    await tick(20);
    expect(nav.classList.contains('active'), 'second link').toBe(true);
  });
});

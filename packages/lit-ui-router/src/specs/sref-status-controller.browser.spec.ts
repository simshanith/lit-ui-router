import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

import { SrefStatusController } from '../sref-status-controller.js';
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

/** two links behind a nested shadow root: composed events retarget them */
@customElement('test-sref-status-nested-links')
class SrefStatusNestedLinks extends LitElement {
  render() {
    return html`<a href=${srefHref('users')}>Users</a>
      <a href=${srefHref('home')}>Home</a>`;
  }
}

/** container mode over a child that hides its links in its own shadow root */
@customElement('test-sref-status-outer')
class SrefStatusOuter extends LitElement {
  readonly status = new SrefStatusController(this);

  render() {
    return html`<test-sref-status-nested-links></test-sref-status-nested-links>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-sref-status-nested-links': SrefStatusNestedLinks;
    'test-sref-status-outer': SrefStatusOuter;
  }
}

const states: LitStateDeclaration[] = [
  { name: 'home', url: '/home' },
  { name: 'users', url: '/users' },
];

describe('SrefStatusController in a real shadow DOM', () => {
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

    const outer = document.createElement('test-sref-status-outer');
    uiRouter.appendChild(outer);
    await waitForUpdate(outer);
    await tick(20);

    expect(outer.status.targetStates.map((t) => t.name()).sort()).toEqual([
      'home',
      'users',
    ]);

    await routerGo(router, 'home');
    await tick(20);
    expect(outer.status.active).toBe(true);
  });
});

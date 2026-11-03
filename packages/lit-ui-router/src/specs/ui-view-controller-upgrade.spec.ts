import { describe, it, expect, afterEach } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

import type { LitStateDeclaration } from '../interface.js';
import { UIRouterLitElement } from '../ui-router.js';
import { UiViewController } from '../ui-view-controller.js';
import { viewRendered } from '../view-rendered.js';
import {
  createTestRouter,
  routerGo,
  tick,
  waitForUpdate,
} from './test-utils.js';

@customElement('test-outlet-late-host')
class LateOutletHost extends LitElement {
  readonly view = new UiViewController(this);

  render() {
    return html`<main>${this.view.outlet()}</main>`;
  }
}

/** A `<ui-router>` under a tag this spec defines once the host has connected. */
class LateUiRouter extends UIRouterLitElement {}

declare global {
  interface HTMLElementTagNameMap {
    'test-outlet-late-host': LateOutletHost;
    'test-late-ui-router': LateUiRouter;
  }
}

const states: LitStateDeclaration[] = [
  {
    name: 'home',
    url: '/home',
    component: () => html`<h1 class="home">Home</h1>`,
  },
];

describe('UiViewController under a router provider defined after it connects', () => {
  let container: HTMLElement | undefined;

  afterEach(() => {
    container?.remove();
  });

  it('takes the placeholder on its first update, then follows the router that replaces it', async () => {
    container = document.body.appendChild(document.createElement('div'));

    const uiRouter = container.appendChild(
      document.createElement('test-late-ui-router'),
    );

    const host = uiRouter.appendChild(
      document.createElement('test-outlet-late-host'),
    );

    expect(host.view.fqn).toBe('$default');

    customElements.define('test-late-ui-router', LateUiRouter);
    await waitForUpdate(host);

    const provider = uiRouter;
    const placeholder = provider.uiRouter!;
    expect(
      placeholder.viewService._pluginapi._registeredUIViews(),
    ).toHaveLength(1);

    const router = createTestRouter(states);
    provider.uiRouter = router;
    await waitForUpdate(provider);
    router.start();
    await tick();

    expect(router.viewService._pluginapi._registeredUIViews()).toHaveLength(1);

    await routerGo(router, 'home');
    await viewRendered(router);

    expect(host.shadowRoot!.querySelector('main h1.home')).not.toBeNull();

    container.remove();
    container = undefined;
    await tick(10);
    router.dispose();
    placeholder.dispose();
  });
});

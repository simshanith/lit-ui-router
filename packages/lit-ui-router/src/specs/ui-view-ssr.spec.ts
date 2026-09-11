import { describe, it, expect, afterEach } from 'vitest';
import { html } from 'lit';

import '../ui-view.register.js';
import '../ui-router.register.js';
import { UIRouterLit } from '../core.js';
import { LitStateDeclaration } from '../interface.js';
import {
  createTestRouter,
  routerGo,
  tick,
  waitForUpdate,
} from './test-utils.js';

// Verbatim @lit-labs/ssr output: an empty declarative shadow root would hide the light DOM (#803).
const serverMarkup =
  '<ui-router><template shadowroot="open" shadowrootmode="open"><slot></slot></template>' +
  '<ui-view><template shadowroot="open" shadowrootmode="open"><slot></slot></template>' +
  '<p class="fallback">fallback</p></ui-view></ui-router>';

// Composed and painted, not merely present in the light DOM.
function isLaidOut(element: Element): boolean {
  const { width, height } = element.getBoundingClientRect();
  return (
    width > 0 && height > 0 && (element as HTMLElement).offsetParent !== null
  );
}

describe('<ui-view> server-rendered shape', () => {
  let container: HTMLElement;
  let router: UIRouterLit;

  afterEach(() => {
    container?.remove();
    router?.dispose();
  });

  it('should compose light-DOM content through the declarative shadow root', async () => {
    const states: LitStateDeclaration[] = [
      {
        name: 'home',
        url: '/home',
        component: () => html`<div class="home-content">Home Content</div>`,
      },
    ];
    router = createTestRouter(states);

    // Parse detached so the router is set before <ui-router> upgrades and its views seek it.
    container = document.createElement('div');
    container.setHTMLUnsafe(serverMarkup);
    container.querySelector('ui-router')!.uiRouter = router;
    document.body.append(container);

    const uiView = container.querySelector('ui-view')!;
    await waitForUpdate(uiView);
    router.start();
    await tick();

    expect(uiView.shadowRoot).not.toBeNull();
    const slot = uiView.shadowRoot!.querySelector('slot');
    expect(slot).toBeInstanceOf(HTMLSlotElement);

    const fallback = uiView.querySelector('p.fallback')!;
    expect(fallback.assignedSlot).toBe(slot);
    expect(isLaidOut(fallback)).toBe(true);

    await routerGo(router, 'home');
    await waitForUpdate(uiView);

    const routed = uiView.firstElementChild!;
    expect(routed.classList.contains('home-content')).toBe(true);
    expect(routed.assignedSlot).toBe(slot);
    expect(isLaidOut(routed)).toBe(true);
    expect(uiView.querySelector('p.fallback')).toBeNull();
  });
});

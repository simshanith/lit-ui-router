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

// @lit-labs/ssr wraps every LitElement in a declarative shadow root, so
// <ui-view> must emit a <slot> or the DSR hides the light DOM the client
// renders into (#803). This is the verbatim server output for one view.
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

    // Element.setHTMLUnsafe (Chrome 124+) is the parsing API that honours
    // declarative shadow roots; parse detached so the router is assigned
    // before <ui-router> upgrades and its descendants seek it on connect.
    container = document.createElement('div');
    container.setHTMLUnsafe(serverMarkup);
    container.querySelector('ui-router')!.uiRouter = router;
    document.body.append(container);

    const uiView = container.querySelector('ui-view')!;
    await waitForUpdate(uiView);
    router.start();
    await tick();

    // The DSR is what distinguishes the server shape from a normal mount.
    expect(uiView.shadowRoot).not.toBeNull();
    // An empty DSR would hide everything; assert the slot before comparing to it.
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

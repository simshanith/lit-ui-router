import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import '../ui-view.register.js';
import { viewRendered } from '../pure.js';
import { UIRouterLit } from '../core.js';
import type { UiView } from '../ui-view.js';
import { LitStateDeclaration } from '../interface.js';
import {
  createTestRouter,
  defer,
  mountElementInRouter,
  suppressConsoleErrors,
  tick,
} from './test-utils.js';

@customElement('test-rendered-leaf')
class TestRenderedLeaf extends LitElement {
  @property() label = 'leaf';

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<p class="leaf">${this.label}</p>`;
  }
}

@customElement('test-rendered-other')
class TestRenderedOther extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`<p class="other">other</p>`;
  }
}

/** Opens its nested view one update late, as an element that loads before it routes does. */
@customElement('test-rendered-parent')
class TestRenderedParent extends LitElement {
  static {
    this.disableWarning?.('change-in-update');
  }

  @property({ type: Boolean }) open = false;

  createRenderRoot() {
    return this;
  }

  updated() {
    this.open = true;
  }

  render() {
    return this.open
      ? html`<section class="parent"><ui-view></ui-view></section>`
      : html`<section class="parent"></section>`;
  }
}

describe('viewRendered', () => {
  let container: HTMLElement;
  let router: UIRouterLit;

  const states: LitStateDeclaration[] = [
    { name: 'home', url: '/home', component: () => html`<p>home</p>` },
    { name: 'leaf', url: '/leaf', component: TestRenderedLeaf },
    { name: 'other', url: '/other', component: TestRenderedOther },
    { name: 'parent', url: '/parent', component: TestRenderedParent },
    { name: 'parent.child', url: '/child', component: TestRenderedLeaf },
    {
      name: 'slow',
      url: '/slow',
      component: TestRenderedLeaf,
      resolve: [{ token: 'gate', resolveFn: () => gate.promise }],
    },
  ];

  let gate = defer();

  async function start(): Promise<UiView> {
    router = createTestRouter(states);
    const uiView = document.createElement('ui-view');
    await mountElementInRouter(uiView, router, container);
    router.start();
    await router.stateService.go('home');
    await tick();

    return uiView;
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    gate = defer();
  });

  afterEach(() => {
    container.remove();
  });

  it('resolves after the routed element has rendered, which the transition promise does not', async () => {
    const uiView = await start();
    const { transition } = router.stateService.go('leaf');

    await transition.promise;
    expect(uiView.querySelector('.leaf')).toBeNull();

    await viewRendered(router, transition);
    expect(
      uiView.querySelector<TestRenderedLeaf>('test-rendered-leaf')!.hasUpdated,
    ).toBe(true);
    expect(uiView.querySelector('.leaf')!.textContent).toBe('leaf');
  });

  it('resolves only once a swap has rendered the incoming element and retired the outgoing one', async () => {
    const uiView = await start();
    await router.stateService.go('leaf');
    await viewRendered(router);
    const outgoing = uiView.routedElement!;

    const { transition } = router.stateService.go('other');
    await viewRendered(router, transition);

    expect(outgoing.isConnected).toBe(false);
    expect(uiView.children).toHaveLength(1);
    expect(uiView.routedElement).toBeInstanceOf(TestRenderedOther);
    expect(uiView.querySelector('.other')!.textContent).toBe('other');
  });

  it('waits for nested views connected by the parent view', async () => {
    const uiView = await start();
    const { transition } = router.stateService.go('parent.child');

    await viewRendered(router, transition);

    expect(uiView.querySelector('.parent ui-view .leaf')!.textContent).toBe(
      'leaf',
    );
  });

  it('waits for a transition still in flight', async () => {
    const uiView = await start();
    const pending = router.stateService.go('slow');
    const rendered = viewRendered(router, pending.transition);

    gate.resolve();
    await rendered;

    expect(uiView.querySelector('.leaf')).not.toBeNull();
    await pending;
  });

  it('defaults to the last successful transition', async () => {
    const uiView = await start();

    await router.stateService.go('parent.child');
    await viewRendered(router);

    expect(uiView.querySelector('.parent ui-view .leaf')).not.toBeNull();
  });

  it('resolves for a transition that fails', async () => {
    const uiView = await start();
    const restoreConsole = suppressConsoleErrors();
    const failed = router.stateService.go('slow');
    const rendered = viewRendered(router, failed.transition);

    gate.reject(new Error('denied'));
    await rendered;

    await expect(failed).rejects.toBeDefined();
    restoreConsole();
    expect(uiView.textContent).toContain('home');
  });

  it('resolves with no transition and no views', async () => {
    await expect(viewRendered(createTestRouter())).resolves.toBeUndefined();
  });
});

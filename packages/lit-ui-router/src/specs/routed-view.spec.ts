import { describe, it, expect, afterEach } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ResolveContext } from '@uirouter/core';

import '../ui-view.register.js';
import { UiView } from '../ui-view.js';
import { UIRouterLit } from '../core.js';
import type { LitStateDeclaration, UIViewInjectedProps } from '../interface.js';
import {
  adoptServedElement,
  routedElementOf,
  routedViewTemplate,
} from '../pure.js';
import { createTestRouter, routerGo, waitForUpdate } from './test-utils.js';

/** Waits out `defer-hydration` the way lit's hydrate support does, and records what its first update saw. */
class DeferredCard extends LitElement {
  declare _uiViewProps?: UIViewInjectedProps;

  @property({ type: Boolean, attribute: 'defer-hydration' })
  deferHydration = false;

  propsAtFirstUpdate?: UIViewInjectedProps;

  protected shouldUpdate(): boolean {
    return !this.deferHydration;
  }

  protected firstUpdated(): void {
    this.propsAtFirstUpdate = this._uiViewProps;
  }

  render() {
    return html`<p>${this._uiViewProps?.resolves.detail ?? 'unrouted'}</p>`;
  }
}

@customElement('routed-view-card')
class RoutedViewCard extends DeferredCard {
  static tag = 'routed-view-card';
}

@customElement('routed-view-sticky')
class RoutedViewSticky extends DeferredCard {
  static tag = 'routed-view-sticky';
  static sticky = true;
}

@customElement('routed-view-other')
class RoutedViewOther extends LitElement {
  static tag = 'routed-view-other';
  render() {
    return html`<p class="other">other</p>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'routed-view-card': RoutedViewCard;
    'routed-view-sticky': RoutedViewSticky;
    'routed-view-other': RoutedViewOther;
  }
}

const states: LitStateDeclaration[] = [
  {
    name: 'card',
    url: '/card',
    component: RoutedViewCard,
    resolve: [{ token: 'detail', resolveFn: () => 'card leaf' }],
  },
  {
    name: 'sticky',
    url: '/sticky',
    component: RoutedViewSticky,
    resolve: [{ token: 'detail', resolveFn: () => 'sticky leaf' }],
  },
  { name: 'other', url: '/other', component: RoutedViewOther },
  {
    name: 'template',
    url: '/template',
    component: () => html`<p class="template">template</p>`,
  },
];

/** What the server writes for a class view: the element in slot 0's pair, slot 1 empty. */
const servedView = (tag: string): string =>
  '<ui-view><!--lit-part BRUAAAUVAAA=--><!--lit-part-->' +
  `<${tag} defer-hydration></${tag}>` +
  '<!--/lit-part--><!--lit-part--><!--/lit-part--><!--/lit-part--></ui-view>';

let router: UIRouterLit;

let container: HTMLElement;

afterEach(() => {
  container?.remove();
  router?.dispose();
});

/**
 * Mounts a served view for `state`, with the router already settled there, as
 * a wake finds it, handing the view the served element unless told not to.
 */
const wake = async (
  state: string,
  tag: string,
  handOver = true,
): Promise<{ view: UiView; served: Element }> => {
  router = createTestRouter(states);
  router.start();
  await routerGo(router, state);

  container = document.createElement('div');
  container.innerHTML = servedView(tag);
  const view = container.querySelector('ui-view')!;
  const served = view.querySelector(tag)!;
  view.uiRouter = router;

  if (handOver) {
    adoptServedElement(view, served);
  }

  document.body.append(container);
  await waitForUpdate(view);

  return { view, served };
};

/** Releases a served element after its view's hydrate, as `lit-ui-router-ssr/client` does. */
const release = async (element: DeferredCard): Promise<void> => {
  element.removeAttribute('defer-hydration');
  await element.updateComplete;
};

describe('routedViewTemplate', () => {
  const settled = async (state: string) => {
    router = createTestRouter(states);
    router.start();
    await routerGo(router, state);

    return new ResolveContext(
      router.globals.successfulTransitions.peekTail().treeChanges('to'),
    );
  };

  it('places a class element in the first of two empty slots', async () => {
    const context = await settled('card');
    const result = routedViewTemplate(RoutedViewCard, router, context);
    const element = routedElementOf(result);

    expect([...result.strings]).toEqual(['', '', '']);
    expect(element).toBeInstanceOf(RoutedViewCard);
    expect(result.values[0]).toBe(element);
    // SAFETY: checked to be a RoutedViewCard above
    expect((element as RoutedViewCard)._uiViewProps?.resolves.detail).toBe(
      'card leaf',
    );
  });

  it('adopts an element of the class, and constructs past anything else', async () => {
    const context = await settled('card');
    const served = new RoutedViewCard();
    const adopted = routedViewTemplate(RoutedViewCard, router, context, served);

    const foreign = routedViewTemplate(
      RoutedViewCard,
      router,
      context,
      new RoutedViewOther(),
    );

    expect(routedElementOf(adopted)).toBe(served);
    expect(routedElementOf(foreign)).toBeInstanceOf(RoutedViewCard);
  });

  it('hands a template component the props alone, and carries no element', async () => {
    const context = await settled('template');
    const calls: unknown[][] = [];

    const component = (...args: [UIViewInjectedProps]) => {
      calls.push(args);

      return html`<p></p>`;
    };

    const result = routedViewTemplate(
      component,
      router,
      context,
      new RoutedViewCard(),
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(1);
    expect(routedElementOf(result)).toBeUndefined();
  });
});

describe('<ui-view> handed a served class element', () => {
  it('adopts it, with its props before its first update', async () => {
    const { view, served } = await wake('card', 'routed-view-card');
    // SAFETY: the served tag is a RoutedViewCard
    const card = served as RoutedViewCard;

    expect(view.routedElement).toBe(card);
    expect(card.hasUpdated).toBe(false);
    // the release is the client's, after the view's hydrate
    expect(card.hasAttribute('defer-hydration')).toBe(true);

    await release(card);

    expect(card.propsAtFirstUpdate?.resolves.detail).toBe('card leaf');
    expect(card.hasAttribute('routed')).toBe(true);
  });

  it('adopts a sticky class through its declaration-bound renderer', async () => {
    const { view, served } = await wake('sticky', 'routed-view-sticky');
    // SAFETY: the served tag is a RoutedViewSticky
    const card = served as RoutedViewSticky;
    await release(card);

    expect(view.routedElement).toBe(card);
    expect(card.propsAtFirstUpdate?.resolves.detail).toBe('sticky leaf');

    await routerGo(router, 'other');
    await waitForUpdate(view);
    await routerGo(router, 'sticky');
    await waitForUpdate(view);

    expect(view.routedElement).toBe(card);
  });

  it('replaces the adopted element on a later swap', async () => {
    const { view, served } = await wake('card', 'routed-view-card');
    // SAFETY: the served tag is a RoutedViewCard
    await release(served as RoutedViewCard);

    await routerGo(router, 'other');
    await waitForUpdate(view);
    // SAFETY: the incoming element is a RoutedViewOther, a LitElement
    await (view.routedElement as LitElement).updateComplete;
    await waitForUpdate(view);

    expect(view.routedElement).toBeInstanceOf(RoutedViewOther);
    expect(served.isConnected).toBe(false);
  });

  it('refuses an element of another class', async () => {
    const { view, served } = await wake('card', 'routed-view-other');

    expect(view.routedElement).toBeInstanceOf(RoutedViewCard);
    expect(view.routedElement).not.toBe(served);
  });

  it('adopts nothing when no element is handed over', async () => {
    const { view, served } = await wake('card', 'routed-view-card', false);

    expect(view.routedElement).toBeInstanceOf(RoutedViewCard);
    expect(view.routedElement).not.toBe(served);
  });
});

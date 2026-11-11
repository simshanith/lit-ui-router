import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import '../ui-view.register.js';
import type { UIRouterLit } from '../core.js';
import type { LitStateDeclaration, UIViewInjectedProps } from '../interface.js';
import {
  createTestRouter,
  mountElementInRouter,
  routerGo,
  tick,
  waitForUpdate,
} from './test-utils.js';

/** Renders the star its props name, so a spec sees which props the last update read. */
abstract class StarView extends LitElement {
  abstract readonly props: UIViewInjectedProps | undefined;

  createRenderRoot() {
    return this;
  }

  render() {
    return html`<p>
      ${this.props?.transition?.params().starId ?? 'unrouted'}
    </p>`;
  }
}

/** Declares only the name 1.20 introduces. */
@customElement('props-named-view')
class NamedView extends StarView {
  @property({ attribute: false }) uiViewProps?: UIViewInjectedProps;

  get props() {
    return this.uiViewProps;
  }
}

/** Declares only the name earlier 1.x releases wrote. */
@customElement('props-underscore-view')
class UnderscoreView extends StarView {
  @property({ attribute: false }) _uiViewProps?: UIViewInjectedProps;

  get props() {
    return this._uiViewProps;
  }
}

/** Declares neither name, as a class that takes its props some other way does. */
@customElement('props-undeclared-view')
class UndeclaredView extends LitElement {}

const star = (
  name: string,
  component: LitStateDeclaration['component'],
): LitStateDeclaration => ({
  name,
  url: `/${name}/:starId`,
  params: { starId: { dynamic: true } },
  component,
});

const states = [
  star('named', NamedView),
  star('underscore', UnderscoreView),
  star('undeclared', UndeclaredView),
];

describe('the props a routed element receives', () => {
  let router: UIRouterLit;
  let container: HTMLElement;
  let uiView: HTMLElement;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.append(container);
    router = createTestRouter(states);
    uiView = document.createElement('ui-view');
    await mountElementInRouter(uiView, router, container);
    router.start();
    await tick();
  });

  afterEach(() => {
    container.remove();
    router.dispose();
  });

  it.each(['named', 'underscore'])(
    'reach a class declaring only the %s member, on first render and after a transition',
    async (state) => {
      await routerGo(router, state, { starId: 'sun' });
      // SAFETY: both states render a StarView as the view's child
      const view = uiView.firstElementChild as StarView;
      await waitForUpdate(view);

      expect(view.props?.router).toBe(router);
      expect(view.textContent?.trim()).toBe('sun');
      const first = view.props;

      await routerGo(router, state, { starId: 'rigel' });
      await waitForUpdate(view);

      expect(uiView.firstElementChild).toBe(view);
      expect(view.props).not.toBe(first);
      expect(view.props?.transition).toBe(
        router.globals.successfulTransitions.peekTail(),
      );
      expect(view.textContent?.trim()).toBe('rigel');
    },
  );

  it('are one object under both names', async () => {
    await routerGo(router, 'undeclared', { starId: 'sun' });

    // SAFETY: the routed class constrains its instance to both optional members
    const view = uiView.firstElementChild as UndeclaredView & {
      uiViewProps?: UIViewInjectedProps;
      _uiViewProps?: UIViewInjectedProps;
    };

    expect(view.uiViewProps?.router).toBe(router);
    expect(view._uiViewProps).toBe(view.uiViewProps);

    await routerGo(router, 'undeclared', { starId: 'rigel' });
    await tick();

    expect(view.uiViewProps?.transition?.params().starId).toBe('rigel');
    expect(view._uiViewProps).toBe(view.uiViewProps);
  });
});

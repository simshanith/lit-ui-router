import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { ActiveUIView, RawParams } from '@uirouter/core';

import { UIRouterLit } from '../core.js';
import type {
  LitStateDeclaration,
  UiOnExit,
  UiOnParamsChanged,
  UIViewInjectedProps,
} from '../interface.js';
import { UiView } from '../ui-view.js';
import '../ui-view.register.js';
import { UiViewController } from '../ui-view-controller.js';
import { viewRendered } from '../view-rendered.js';
import {
  createTestRouter,
  mountElementInRouter,
  routerGo,
  tick,
} from './test-utils.js';

@customElement('test-outlet-host')
class OutletHost extends LitElement {
  readonly view = new UiViewController(this);

  render() {
    return html`<main>${this.view.outlet()}</main>`;
  }
}

@customElement('test-named-outlet-host')
class NamedOutletHost extends LitElement {
  readonly header = new UiViewController(this, { name: 'header' });

  render() {
    return html`<header>${this.header.outlet()}</header>`;
  }
}

let canExit: () => boolean = () => true;

let paramsChanged: (params: RawParams) => void = () => {};

@customElement('test-outlet-detail')
class OutletDetail extends LitElement implements UiOnExit, UiOnParamsChanged {
  _uiViewProps?: UIViewInjectedProps<{ item: string }>;

  uiCanExit() {
    return canExit();
  }

  uiOnParamsChanged(params: RawParams) {
    paramsChanged(params);
  }

  render() {
    return html`<p class="detail">${this._uiViewProps?.resolves.item}</p>`;
  }
}

@customElement('test-outlet-nested-host')
class NestedOutletHost extends LitElement {
  readonly view = new UiViewController(this);

  render() {
    return html`<section class="nested-outlet">${this.view.outlet()}</section>`;
  }
}

@customElement('test-outlet-own-router-host')
class OwnRouterHost extends LitElement {
  view?: UiViewController;

  render() {
    return html`${this.view?.outlet()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-outlet-host': OutletHost;
    'test-named-outlet-host': NamedOutletHost;
    'test-outlet-detail': OutletDetail;
    'test-outlet-nested-host': NestedOutletHost;
    'test-outlet-own-router-host': OwnRouterHost;
  }
}

const states: LitStateDeclaration[] = [
  {
    name: 'home',
    url: '/home',
    component: () => html`<h1 class="home">Home</h1>`,
  },
  {
    name: 'detail',
    url: '/detail/:id',
    params: { id: { dynamic: true } },
    component: OutletDetail,
    resolve: [
      {
        token: 'item',
        deps: ['$transition$'],
        resolveFn: (trans: { params: () => RawParams }) =>
          `item ${trans.params().id}`,
      },
    ],
  },
  {
    name: 'shell',
    url: '/shell',
    component: () => html`<div class="shell"><ui-view></ui-view></div>`,
  },
  {
    name: 'shell.child',
    url: '/child',
    component: () => html`<p class="child">Child</p>`,
  },
  {
    name: 'outer',
    url: '/outer',
    component: NestedOutletHost,
  },
  {
    name: 'outer.inner',
    url: '/inner',
    component: () => html`<p class="inner">Inner</p>`,
  },
  {
    name: 'layout',
    url: '/layout',
    views: {
      header: () => html`<span class="title">Title</span>`,
      $default: () => html`<p class="content">Content</p>`,
    },
  },
];

const registeredFqns = (router: UIRouterLit): string[] =>
  router.viewService._pluginapi
    ._registeredUIViews()
    .map((view: ActiveUIView) => view.fqn);

describe('UiViewController', () => {
  let router: UIRouterLit;
  let cleanup: () => void;

  beforeEach(() => {
    canExit = () => true;
    paramsChanged = () => {};

    router = createTestRouter(states);
  });

  afterEach(() => {
    cleanup?.();
  });

  async function mount<E extends LitElement>(element: E): Promise<E> {
    ({ cleanup } = await mountElementInRouter(element, router));

    return element;
  }

  async function go(name: string, params?: RawParams): Promise<void> {
    await routerGo(router, name, params);
    await viewRendered(router);
  }

  it('renders nothing until a state fills the view', async () => {
    const host = await mount(document.createElement('test-outlet-host'));

    expect(host.shadowRoot!.querySelector('main')!.children).toHaveLength(0);
    expect(registeredFqns(router)).toContain('$default');
  });

  it('renders a template component in the host template, with no <ui-view>', async () => {
    const host = await mount(document.createElement('test-outlet-host'));

    await go('home');

    const main = host.shadowRoot!.querySelector('main')!;
    expect(main.querySelector('h1.home')?.textContent).toBe('Home');
    expect(host.shadowRoot!.querySelector('ui-view')).toBeNull();
    expect(host.view.routedElement).toBeNull();
  });

  it('renders a class component with its resolves, and exposes it as routedElement', async () => {
    const host = await mount(document.createElement('test-outlet-host'));

    await go('detail', { id: '1' });

    const detail = host.shadowRoot!.querySelector('test-outlet-detail')!;
    expect(detail).toBeInstanceOf(OutletDetail);
    expect(host.view.routedElement).toBe(detail);
    await detail.updateComplete;
    expect(detail.shadowRoot!.querySelector('.detail')?.textContent).toBe(
      'item 1',
    );
  });

  it('swaps the routed component on a state change', async () => {
    const host = await mount(document.createElement('test-outlet-host'));

    await go('detail', { id: '1' });
    await go('home');

    const main = host.shadowRoot!.querySelector('main')!;
    expect(main.querySelector('test-outlet-detail')).toBeNull();
    expect(main.querySelector('h1.home')).not.toBeNull();
    expect(host.view.routedElement).toBeNull();
  });

  it("calls the routed element's uiOnParamsChanged with the changed params", async () => {
    const host = await mount(document.createElement('test-outlet-host'));
    const spy = vi.fn();
    paramsChanged = spy;

    await go('detail', { id: '1' });
    const detail = host.view.routedElement;
    await go('detail', { id: '2' });

    expect(spy).toHaveBeenCalledWith({ id: '2' });
    expect(host.view.routedElement).toBe(detail);
  });

  it("lets the routed element's uiCanExit cancel a transition", async () => {
    await mount(document.createElement('test-outlet-host'));

    await go('detail', { id: '1' });
    canExit = () => false;
    await routerGo(router, 'home').catch(() => {});
    await tick();

    expect(router.globals.current.name).toBe('detail');
  });

  it('is the parent of a <ui-view> the routed component renders', async () => {
    const host = await mount(document.createElement('test-outlet-host'));

    await go('shell.child');

    const nested = host.shadowRoot!.querySelector<UiView>('.shell ui-view')!;
    expect(UiView.seekParentView(nested)).toBe(host.view);
    expect(nested.querySelector('p.child')?.textContent).toBe('Child');
    expect(registeredFqns(router)).toContain('$default.$default');
  });

  it("is the parent of another outlet in the routed component's host", async () => {
    const host = await mount(document.createElement('test-outlet-host'));

    await go('outer.inner');

    const inner = host.shadowRoot!.querySelector('test-outlet-nested-host')!;
    expect(inner.view.fqn).toBe('$default.$default');
    expect(
      inner.shadowRoot!.querySelector('.nested-outlet p.inner')?.textContent,
    ).toBe('Inner');
  });

  it('fills a named view', async () => {
    const host = await mount(document.createElement('test-named-outlet-host'));

    await go('layout');

    expect(host.shadowRoot!.querySelector('header .title')?.textContent).toBe(
      'Title',
    );
    expect(host.header.fqn).toBe('header');
  });

  it('throws on a second outlet on the same host, naming the host', () => {
    const host = document.createElement('test-outlet-host');

    expect(() => new UiViewController(host, { name: 'header' })).toThrow(
      /<test-outlet-host> already has a UiViewController.*<ui-view name="…">/,
    );
  });

  it('keeps one outlet across disconnect and reconnect', async () => {
    const host = await mount(document.createElement('test-outlet-host'));
    const parent = host.parentElement!;

    host.remove();
    parent.appendChild(host);
    await go('home');

    expect(host.shadowRoot!.querySelector('h1.home')).not.toBeNull();
    expect(() => new UiViewController(host)).toThrow(/already has/);
  });

  it('deregisters on disconnect and registers again on reconnect', async () => {
    const host = await mount(document.createElement('test-outlet-host'));
    await go('home');
    const parent = host.parentElement!;

    host.remove();
    expect(registeredFqns(router)).not.toContain('$default');

    parent.appendChild(host);
    await viewRendered(router);
    await host.updateComplete;

    expect(registeredFqns(router)).toContain('$default');
    expect(host.shadowRoot!.querySelector('h1.home')).not.toBeNull();
  });

  it('renders for a router passed in the options, outside any provider', async () => {
    const own = createTestRouter(states);
    const host = new OwnRouterHost();
    host.view = new UiViewController(host, { router: own });
    document.body.appendChild(host);
    cleanup = () => host.remove();

    await routerGo(own, 'home');
    await viewRendered(own);

    expect(host.shadowRoot!.querySelector('h1.home')).not.toBeNull();
  });
});

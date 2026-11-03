import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, LitElement, render } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ActiveUIView, RawParams } from '@uirouter/core';

import { UIRouterLit } from '../core.js';
import type {
  LitStateDeclaration,
  UiOnExit,
  UiOnParamsChanged,
  UIViewInjectedProps,
} from '../interface.js';
import { TransitionController } from '../transition-controller.js';
import { uiSref } from '../ui-sref.js';
import { UiView } from '../ui-view.js';
import '../ui-view.register.js';
import { UiViewController } from '../ui-view-controller.js';
import { viewRendered } from '../view-rendered.js';
import {
  createTestRouter,
  defer,
  type Deferred,
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

@customElement('test-outlet-gated-host')
class GatedOutletHost extends LitElement {
  readonly view = new UiViewController(this);

  gate?: Deferred<void>;

  protected override async scheduleUpdate(): Promise<void> {
    await this.gate?.promise;
    await super.scheduleUpdate();
  }

  render() {
    return html`<main>${this.view.outlet()}</main>`;
  }
}

@customElement('test-outlet-own-router-observer')
class OwnRouterObserver extends LitElement {
  readonly view: UiViewController;

  readonly transitions: TransitionController;

  constructor(router: UIRouterLit) {
    super();
    this.view = new UiViewController(this, { router });
    this.transitions = new TransitionController(this);
  }

  render() {
    return html`${this.view.outlet()}`;
  }
}

@customElement('test-outlet-movable-host')
class MovableOutletHost extends LitElement {
  readonly view = new UiViewController(this);

  @property({ type: Boolean }) footed = false;

  render() {
    return this.footed
      ? html`<section>
          ${this.view.outlet()}
          <footer></footer>
        </section>`
      : html`<main>${this.view.outlet()}</main>`;
  }
}

@customElement('test-outlet-sibling-host')
class SiblingOutletHost extends LitElement {
  readonly view = new UiViewController(this);

  render() {
    return html`<aside>
        <ui-view name="sidebar"></ui-view>
        <a class="sibling-link" ${uiSref('.child')}>Child</a>
      </aside>
      <main>${this.view.outlet()}</main>`;
  }
}

@customElement('test-outlet-class-shell')
class ClassShell extends LitElement {
  render() {
    return html`<div class="class-shell"><ui-view></ui-view></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'test-outlet-host': OutletHost;
    'test-named-outlet-host': NamedOutletHost;
    'test-outlet-detail': OutletDetail;
    'test-outlet-nested-host': NestedOutletHost;
    'test-outlet-own-router-host': OwnRouterHost;
    'test-outlet-gated-host': GatedOutletHost;
    'test-outlet-own-router-observer': OwnRouterObserver;
    'test-outlet-movable-host': MovableOutletHost;
    'test-outlet-sibling-host': SiblingOutletHost;
    'test-outlet-class-shell': ClassShell;
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
    name: 'detail.extra',
    url: '/extra',
    component: () => html`<p class="extra">Extra</p>`,
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
    name: 'frame',
    url: '/frame',
    component: SiblingOutletHost,
  },
  {
    name: 'frame.child',
    url: '/child',
    component: () => html`<div class="shell"><ui-view></ui-view></div>`,
  },
  {
    name: 'frame.child.leaf',
    url: '/leaf',
    component: () => html`<p class="leaf">Leaf</p>`,
  },
  {
    name: 'frame.classy',
    url: '/classy',
    component: ClassShell,
  },
  {
    name: 'frame.classy.leaf',
    url: '/leaf',
    component: () => html`<p class="leaf">Leaf</p>`,
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

  it('skips uiOnParamsChanged when a transition to a child state changes no params', async () => {
    const host = await mount(document.createElement('test-outlet-host'));
    const spy = vi.fn();
    paramsChanged = spy;

    await go('detail', { id: '1' });
    const detail = host.view.routedElement;
    await go('detail.extra');

    expect(router.globals.current.name).toBe('detail.extra');
    expect(spy).not.toHaveBeenCalled();
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

  describe('beside a sibling <ui-view> and relative uiSref in the host template', () => {
    async function mountFrame(): Promise<SiblingOutletHost> {
      const root = await mount(document.createElement('ui-view'));
      await go('frame.child.leaf');
      // uiSref seeks its router a task after the first render
      await tick();

      return root.querySelector('test-outlet-sibling-host')!;
    }

    it('leaves the siblings to the view above', async () => {
      const host = await mountFrame();
      const root = host.parentElement!.closest('ui-view')!;

      const aside = host.shadowRoot!.querySelector('aside')!;
      const sidebar = aside.querySelector<UiView>('ui-view')!;
      const link = aside.querySelector('a.sibling-link')!;
      expect(host.view.fqn).toBe('$default.$default');
      expect(UiView.seekParentView(sidebar)).toBe(root);
      expect(UiView.seekParentView(link)).toBe(root);
      expect(link.getAttribute('href')).toBe('#/frame/child');
      expect(registeredFqns(router)).toContain('$default.sidebar');
      expect(registeredFqns(router)).not.toContain('$default.$default.sidebar');
    });

    it('is the parent of a <ui-view> a template component renders', async () => {
      const host = await mountFrame();

      const nested = host.shadowRoot!.querySelector<UiView>('.shell ui-view')!;
      expect(UiView.seekParentView(nested)).toBe(host.view);
      expect(nested.querySelector('p.leaf')?.textContent).toBe('Leaf');
      expect(registeredFqns(router)).toContain('$default.$default.$default');
    });

    it('is the parent of a <ui-view> a class component renders', async () => {
      const host = await mountFrame();
      await go('frame.classy.leaf');

      const shell = host.shadowRoot!.querySelector('test-outlet-class-shell')!;
      const nested = shell.shadowRoot!.querySelector<UiView>('ui-view')!;
      expect(UiView.seekParentView(nested)).toBe(host.view);
      expect(nested.querySelector('p.leaf')?.textContent).toBe('Leaf');
      expect(registeredFqns(router)).toContain('$default.$default.$default');
    });
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

  it('throws when outlet() is bound outside child position', () => {
    const host = document.createElement('test-outlet-host');
    const container = document.createElement('div');

    expect(() =>
      render(html`<p class=${host.view.outlet()}></p>`, container),
    ).toThrow('UiViewController.outlet() must be used in child position');
  });

  it("makes viewRendered wait for the host's update", async () => {
    const host = await mount(document.createElement('test-outlet-gated-host'));
    const gate = defer();
    host.gate = gate;

    await routerGo(router, 'home');
    let rendered = false;

    const done = viewRendered(router).then(() => {
      rendered = true;
    });

    await tick();

    expect(rendered).toBe(false);
    expect(host.shadowRoot!.querySelector('h1.home')).toBeNull();

    gate.resolve();
    await done;

    expect(host.shadowRoot!.querySelector('h1.home')).not.toBeNull();
  });

  it("leaves the host's own router requests to the provider above", async () => {
    const host = await mount(new OwnRouterObserver(createTestRouter(states)));

    expect(host.transitions.router).toBe(router);
  });

  it('stays the parent of views its output renders after the host moves the outlet', async () => {
    const host = await mount(
      document.createElement('test-outlet-movable-host'),
    );

    await go('shell.child');

    host.footed = true;
    await host.updateComplete;
    await viewRendered(router);

    const nested = host.shadowRoot!.querySelector<UiView>(
      'section .shell ui-view',
    )!;

    expect(UiView.seekParentView(nested)).toBe(host.view);
    expect(nested.querySelector('p.child')?.textContent).toBe('Child');
    expect(host.shadowRoot!.querySelector('main')).toBeNull();
  });
});

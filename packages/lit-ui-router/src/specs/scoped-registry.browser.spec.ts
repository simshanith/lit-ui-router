import { describe, it, expect, afterEach } from 'vitest';
import { html, LitElement } from 'lit';
import { memoryLocationPlugin } from '@uirouter/core';
import { fixture } from '@tools/lit-test-env/fixture.ts';

import { UIRouterLit } from '../core.js';
import { UIRouterLitElement } from '../ui-router.js';
import { UiView } from '../ui-view.js';
import { uiSref } from '../ui-sref.js';
import type { LitStateDeclaration } from '../interface.js';

// No `.register` module and no test-utils import: nothing here may reach the
// global registry. Browser-only: happy-dom has no scoped registries.

const supported = (() => {
  try {
    return !!document.createElement('div').attachShadow({
      mode: 'open',
      customElementRegistry: new CustomElementRegistry(),
    }).customElementRegistry;
  } catch {
    return false;
  }
})();

const skipReason = '(skipped: no native scoped custom element registries)';

class ScopedHome extends LitElement {
  render() {
    return html`<p id="home">home</p>`;
  }
}

interface Tags {
  router: string;
  view: string;
  home: string;
}

const usualTags: Tags = {
  router: 'ui-router',
  view: 'ui-view',
  home: 'scoped-home',
};

const alternateTags: Tags = {
  router: 'app-router',
  view: 'app-outlet',
  home: 'app-home',
};

const templateStates: LitStateDeclaration[] = [
  {
    name: 'home',
    url: '/home',
    component: () => html`<p id="home">home</p>`,
  },
  {
    name: 'about',
    url: '/about',
    component: () =>
      html`<p id="about">about</p>
        <a id="home-link" ${uiSref('home')}>Home</a>`,
  },
];

const routers: UIRouterLit[] = [];

function createRouter(states: LitStateDeclaration[]): UIRouterLit {
  const router = new UIRouterLit();
  router.plugin(memoryLocationPlugin);
  states.forEach((state) => router.stateRegistry.register(state));
  routers.push(router);

  return router;
}

function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function routerGo(router: UIRouterLit, state: string): Promise<void> {
  await router.stateService.go(state);
  await tick();
}

/** keeps a failed render off the unhandled-rejection path, which WebKit reports */
class RecordingView extends UiView {
  updateError: unknown;

  protected override performUpdate(): void {
    try {
      super.performUpdate();
    } catch (error) {
      this.updateError = error;
    }
  }
}

/**
 * Mounts `<router><view>` in a shadow root whose own registry alone defines
 * the pure classes under `tags`; the parser resolves them through it.
 */
async function scopedRoutes(
  tags: Tags,
  router: UIRouterLit,
): Promise<RecordingView> {
  const registry = new CustomElementRegistry();
  registry.define(tags.router, UIRouterLitElement);
  registry.define(tags.view, RecordingView);
  registry.define(tags.home, ScopedHome);
  const host = await fixture(document.createElement('div'));

  const root = host.attachShadow({
    mode: 'open',
    customElementRegistry: registry,
  });

  root.innerHTML = `<${tags.router}><${tags.view}></${tags.view}></${tags.router}>`;

  const routerChild = root.firstElementChild;
  expect(routerChild).toBeInstanceOf(UIRouterLitElement);
  // SAFETY: a UIRouterLitElement, asserted above
  const uiRouter = routerChild as UIRouterLitElement;
  uiRouter.uiRouter = router;
  await uiRouter.updateComplete;
  const view = uiRouter.firstElementChild;
  expect(view).toBeInstanceOf(RecordingView);
  router.start();
  await tick();

  // SAFETY: a RecordingView, asserted above
  return view as RecordingView;
}

function expectNotGloballyDefined(tags: Tags): void {
  for (const tag of Object.values(tags)) {
    expect(customElements.get(tag), tag).toBeUndefined();
  }
}

describe.each([
  ['the usual tag names', usualTags],
  ['alternate tag names', alternateTags],
])('lit-ui-router in a scoped registry, with %s', (_, tags) => {
  afterEach(() => {
    routers.splice(0).forEach((router) => router.dispose());
  });

  it.skipIf(!supported)(
    `routes template components and writes uiSref hrefs ${skipReason}`,
    async () => {
      const router = createRouter(templateStates);
      const view = await scopedRoutes(tags, router);

      await routerGo(router, 'home');
      await view.updateComplete;
      expect(view.querySelector('#home')).not.toBeNull();

      await routerGo(router, 'about');
      await view.updateComplete;
      expect(view.querySelector('#home')).toBeNull();
      expect(view.querySelector('#home-link')!.getAttribute('href')).toBe(
        '#/home',
      );
      expect(view.updateError).toBeUndefined();

      expectNotGloballyDefined(tags);
    },
  );

  // routed-element.ts constructs the class with `new`, which resolves only a
  // global definition: the HTMLElement constructor throws a TypeError.
  it.skipIf(!supported).fails(
    `routes an element class defined only in the scoped registry ${skipReason}`,
    async () => {
      const router = createRouter([
        { name: 'home', url: '/home', component: ScopedHome },
      ]);

      const view = await scopedRoutes(tags, router);
      expectNotGloballyDefined(tags);

      await routerGo(router, 'home');
      await view.updateComplete;
      expect(view.updateError).toBeUndefined();
      expect(view.querySelector(tags.home)).toBeInstanceOf(ScopedHome);
    },
  );

  // lit-html clones templates with `document.importNode`, so a ui-view template
  // creates its custom elements in the global registry, not the scoped one.
  it.skipIf(!supported).fails(
    `upgrades a scoped tag written in a routed template ${skipReason}`,
    async () => {
      const router = createRouter([
        {
          name: 'home',
          url: '/home',
          // lit-analyzer reads the global tag map; these tags are scoped
          component: () =>
            tags === usualTags
              ? html`<!-- @ts-ignore --><scoped-home
                  ></scoped-home>`
              : html`<!-- @ts-ignore --><app-home
                  ></app-home>`,
        },
      ]);

      const view = await scopedRoutes(tags, router);
      expectNotGloballyDefined(tags);

      await routerGo(router, 'home');
      await view.updateComplete;
      expect(view.updateError).toBeUndefined();
      expect(view.querySelector(tags.home)).toBeInstanceOf(ScopedHome);
    },
  );
});

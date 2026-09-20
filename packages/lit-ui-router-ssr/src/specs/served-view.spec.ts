// The element half of the seam: what a served `<ui-view>` does between the
// server's markup arriving and an adopter taking it.
import { html, noChange, nothing } from 'lit';
import { memoryLocationPlugin } from '@uirouter/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideContext } from 'lit-ui-router/context';
import { UIRouterLit } from 'lit-ui-router/pure';
import type { LitElement } from 'lit';
import type { LitStateDeclaration, UiView } from 'lit-ui-router/pure';

import { adoptUiViewContext } from '../adopt-context.js';
import type { AdoptableView } from '../adopt-context.js';
import type { ServedUiView } from '../served-view.js';
import '../register.js';

/** The `<ui-view>` these specs drive: core's element with the served half on it. */
type View = ServedUiView;

/** `document.createElement`, typed as the class `lit-ui-router-ssr/register` defined. */
const makeView = (): View => document.createElement('ui-view') as View;

const tick = (ms = 0): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const waitForUpdate = async (element: LitElement): Promise<void> => {
  await element.updateComplete;
  await tick();
};

const createTestRouter = (states: LitStateDeclaration[] = []): UIRouterLit => {
  const router = new UIRouterLit();
  router.plugin(memoryLocationPlugin);
  for (const state of states) router.stateRegistry.register(state);
  return router;
};

const routerGo = async (router: UIRouterLit, state: string): Promise<void> => {
  await router.stateService.go(state);
  await tick();
};

describe('the served <ui-view>', () => {
  let container: HTMLElement;
  let router: UIRouterLit;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  const homeStates: LitStateDeclaration[] = [
    {
      name: 'home',
      url: '/home',
      component: () => html`<div class="home-content">Home</div>`,
    },
  ];

  // A render's nodes between the part markers that render wrote, opaque to the element.
  const heldMarkup =
    '<!--lit-part vXOrb1NPBFc=-->' +
    '<div class="wrap"><p class="held">held</p></div>' +
    '<ui-view defer-hydration><p class="nested">nested</p></ui-view>' +
    '<!--/lit-part-->';

  /** Parses a deferred `<ui-view>` inside a connected `<ui-router>`, the way the document arrives. */
  function mountHeld(
    attributes = 'defer-hydration',
    markup = heldMarkup,
  ): View {
    const uiRouterEl = document.createElement('ui-router');
    uiRouterEl.uiRouter = router;
    container.append(uiRouterEl);
    uiRouterEl.innerHTML = `<ui-view ${attributes}>${markup}</ui-view>`;
    return uiRouterEl.querySelector('ui-view') as View;
  }

  /** Mounts one view under a `<ui-router>`, parent first, the way an upgrade order allows. */
  async function setupRouter(
    states: LitStateDeclaration[],
    options: { configure?: (view: View) => void; start?: boolean } = {},
  ): Promise<{ uiRouterEl: HTMLElementTagNameMap['ui-router']; uiView: View }> {
    router = createTestRouter(states);
    const uiRouterEl = document.createElement('ui-router');
    uiRouterEl.uiRouter = router;
    container.append(uiRouterEl);
    const uiView = makeView();
    options.configure?.(uiView);
    uiRouterEl.append(uiView);
    await waitForUpdate(uiRouterEl);
    await waitForUpdate(uiView);

    if (options.start !== false) {
      router.start();
      await tick();
    }

    return { uiRouterEl, uiView };
  }

  // `defer-hydration` is lit's own attribute: @lit-labs/ssr writes it on every
  // nested custom element, and a `<ui-view>` carrying it holds server content
  // between part markers, behind whatever the author wrote ahead of them.
  describe('the slot the enclosing render reaches', () => {
    it('answers with noChange, so that render leaves this view alone', () => {
      expect(makeView().renderLight()).toBe(noChange);
    });
  });

  describe('sleeping under defer-hydration', () => {
    it('should capture authored hold content when the attribute is absent', async () => {
      const { uiView } = await setupRouter([], {
        configure: (el) => {
          el.innerHTML = '<p class="hold">hold</p>';
        },
        start: false,
      });

      // Taken as the fallback set: the authored <p> stands in the light DOM as
      // itself, ahead of lit's marker, and the hold render adds nothing over it.
      expect(uiView.render()).toBe(nothing);
      expect(uiView.querySelectorAll('p.hold')).toHaveLength(1);
      expect(uiView.firstElementChild!.className).toBe('hold');
    });

    it('should read the attribute the parser wrote, before connect', async () => {
      router = createTestRouter([]);
      const uiRouterEl = document.createElement('ui-router');
      uiRouterEl.uiRouter = router;
      container.appendChild(uiRouterEl);
      // Parsed with the attribute already on it, the way server output arrives.
      uiRouterEl.innerHTML =
        '<ui-view defer-hydration><p class="server">server</p></ui-view>';
      const uiView = uiRouterEl.querySelector('ui-view') as View;
      await waitForUpdate(uiView);

      expect(uiView.deferHydration).toBe(true);
      // Capture waits for the wake, so nothing is taken while the view sleeps.
      expect(uiView.render()).toMatchObject({ strings: ['<slot></slot>'] });
      expect(uiView.querySelector('p.server')).not.toBeNull();
    });

    it('should not capture anything while the attribute is present', async () => {
      const { uiView } = await setupRouter([], {
        configure: (el) => {
          el.setAttribute('defer-hydration', '');
          el.innerHTML = '<p class="server">server</p>';
        },
        start: false,
      });

      expect(uiView.deferHydration).toBe(true);

      // A sleeping view holds its children as they stand, whoever wrote them:
      // the capture is the wake's, and the hold render is the bare slot template.
      expect(uiView['fallback']).toBeUndefined();
      expect(uiView.render()).toMatchObject({ strings: ['<slot></slot>'] });
      const server = uiView.querySelector('p.server')!;
      expect(server.parentElement).toBe(uiView);
      expect(uiView.firstElementChild).toBe(server);
    });

    it('should not run any update while the attribute is present', async () => {
      router = createTestRouter([]);
      const uiView = mountHeld();
      const before = [...uiView.childNodes];

      await tick();

      expect(uiView.hasUpdated).toBe(false);
      expect([...uiView.childNodes]).toEqual(before);
    });
  });

  describe('waking from defer-hydration', () => {
    it('should re-register on the provided router when the attribute is removed', async () => {
      // No router on <ui-router>, so it provides a placeholder of its own and
      // the view registers against that — the prerendered upgrade order.
      const uiRouterEl = document.createElement('ui-router');
      const uiView = makeView();
      uiView.setAttribute('defer-hydration', '');
      container.appendChild(uiRouterEl);
      uiRouterEl.appendChild(uiView);
      await waitForUpdate(uiView);

      router = createTestRouter([
        {
          name: 'home',
          url: '/home',
          component: () => html`<div class="home-content">Home</div>`,
        },
      ]);
      uiRouterEl.uiRouter = router;

      uiView.removeAttribute('defer-hydration');
      await waitForUpdate(uiView);

      expect(uiView.deferHydration).toBe(false);
      expect(uiView.uiRouter).toBe(router);

      router.start();
      await tick();

      await routerGo(router, 'home');
      await waitForUpdate(uiView);

      expect(uiView.querySelector('.home-content')).not.toBeNull();
    });

    it('should re-seek before a first update, where lit records no old value', async () => {
      const uiRouterEl = document.createElement('ui-router');
      const uiView = makeView();
      uiView.setAttribute('defer-hydration', '');
      container.appendChild(uiRouterEl);
      uiRouterEl.appendChild(uiView);

      router = createTestRouter([
        {
          name: 'home',
          url: '/home',
          component: () => html`<div class="home-content">Home</div>`,
        },
      ]);
      uiRouterEl.uiRouter = router;
      // Same task as the connect: the wake update is the view's first update.
      uiView.removeAttribute('defer-hydration');
      await waitForUpdate(uiView);

      expect(uiView.deferHydration).toBe(false);
      expect(uiView.uiRouter).toBe(router);
    });

    it('should leave a view already registered on the real router alone', async () => {
      const { uiView } = await setupRouter([
        { name: 'home', url: '/home', component: () => html`<div>Home</div>` },
      ]);
      const registerUIView = vi.spyOn(router.viewService, 'registerUIView');

      uiView.setAttribute('defer-hydration', '');
      await waitForUpdate(uiView);
      uiView.removeAttribute('defer-hydration');
      await waitForUpdate(uiView);

      expect(registerUIView).not.toHaveBeenCalled();
      expect(uiView.uiRouter).toBe(router);
      expect(router.viewService.available()).toHaveLength(1);
    });

    it('should hand the woken view to an adopter, re-sought and unrendered', async () => {
      // No router on <ui-router>, so it provides a placeholder of its own and
      // the view registers against that — the prerendered upgrade order.
      const uiRouterEl = document.createElement('ui-router');
      container.appendChild(uiRouterEl);
      uiRouterEl.innerHTML = `<ui-view defer-hydration>${heldMarkup}</ui-view>`;
      const uiView = uiRouterEl.querySelector('ui-view')!;
      await waitForUpdate(uiView);

      router = createTestRouter(homeStates);
      uiRouterEl.uiRouter = router;

      let seenRouter: unknown;
      let seenHasUpdated: boolean | undefined;
      let seenHeld: Element | null = null;
      const adopt = vi.fn((view: AdoptableView) => {
        const woken = view as UiView;
        seenRouter = woken.uiRouter;
        seenHasUpdated = woken.hasUpdated;
        seenHeld = view.querySelector('p.held');
      });
      const uninstall = provideContext(container, adoptUiViewContext, adopt);
      try {
        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);
      } finally {
        uninstall();
      }

      expect(adopt).toHaveBeenCalledTimes(1);
      expect(adopt.mock.calls[0]?.[0]).toBe(uiView);
      // The re-seek runs first, so the adopter renders against the real router.
      expect(seenRouter).toBe(router);
      // And it runs before this update's render, so the adopter owns that render.
      expect(seenHasUpdated).toBe(false);
      // The held nodes are still there for the adopter to take.
      expect(seenHeld).not.toBeNull();
    });

    it('should keep its held nodes for the adopter when it reconnects after the wake is queued', async () => {
      const uiRouterEl = document.createElement('ui-router');
      container.appendChild(uiRouterEl);
      uiRouterEl.innerHTML = `<ui-view defer-hydration>${heldMarkup}</ui-view>`;
      const uiView = uiRouterEl.querySelector('ui-view')!;
      await waitForUpdate(uiView);

      router = createTestRouter(homeStates);
      uiRouterEl.uiRouter = router;

      let seenHeld: Element | null = null;
      let seenNested: Element | null = null;
      const adopt = vi.fn((view: AdoptableView) => {
        seenHeld = view.querySelector('p.held');
        seenNested = view.querySelector('ui-view');
      });
      const uninstall = provideContext(container, adoptUiViewContext, adopt);
      try {
        // Detach, wake, re-attach in one task: the connect runs before the queued update.
        uiView.remove();
        uiView.removeAttribute('defer-hydration');
        uiRouterEl.append(uiView);
        await waitForUpdate(uiView);
      } finally {
        uninstall();
      }

      expect(adopt).toHaveBeenCalledTimes(1);
      expect(adopt.mock.calls[0]?.[0]).toBe(uiView);
      // The reconnect must not sweep the served nodes aside as authored hold content.
      expect(seenHeld).not.toBeNull();
      expect(seenNested).not.toBeNull();
      expect(uiView.querySelector('p.held')).not.toBeNull();
      expect(uiView.querySelector('.home-content')).toBeNull();
    });

    it('should stay asleep when it is detached before the wake update flushes', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const uiRouterEl = document.createElement('ui-router');
      container.appendChild(uiRouterEl);
      uiRouterEl.innerHTML = `<ui-view defer-hydration>${heldMarkup}</ui-view>`;
      const uiView = uiRouterEl.querySelector('ui-view')!;
      // Microtasks only: a task boundary here is the never-woken check, a different case.
      await uiView.updateComplete;

      router = createTestRouter(homeStates);
      uiRouterEl.uiRouter = router;
      const registerUIView = vi.spyOn(router.viewService, 'registerUIView');

      let seenHeld: Element | null = null;
      let seenParent: unknown;
      const adopt = vi.fn((view: AdoptableView) => {
        seenHeld = view.querySelector('p.held');
        seenParent = view.parentElement;
      });
      const uninstall = provideContext(container, adoptUiViewContext, adopt);
      const held = uiView.querySelector('p.held');
      try {
        // Wake, then detach the enclosing subtree in the same task: the queued update runs detached.
        uiView.removeAttribute('defer-hydration');
        uiRouterEl.remove();
        await waitForUpdate(uiView);

        expect(adopt).not.toHaveBeenCalled();
        expect(uiView.querySelector('p.held')).toBe(held);
        expect(uiView.hasUpdated).toBe(false);
        expect(warn).not.toHaveBeenCalled();
        expect(registerUIView).not.toHaveBeenCalled();

        container.appendChild(uiRouterEl);
        await waitForUpdate(uiView);
      } finally {
        uninstall();
        warn.mockRestore();
      }

      expect(adopt).toHaveBeenCalledTimes(1);
      expect(adopt.mock.calls[0]?.[0]).toBe(uiView);
      expect(seenHeld).toBe(held);
      expect(seenParent).toBe(uiRouterEl);
      expect(uiView.uiRouter).toBe(router);
    });

    it('should not request an adopter again on a later update', async () => {
      router = createTestRouter(homeStates);
      const uiView = mountHeld();
      const adopt = vi.fn();
      const uninstall = provideContext(container, adoptUiViewContext, adopt);
      try {
        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);
        expect(adopt).toHaveBeenCalledTimes(1);

        router.start();
        await routerGo(router, 'home');
        await waitForUpdate(uiView);

        expect(adopt).toHaveBeenCalledTimes(1);
        expect(uiView.hasUpdated).toBe(true);
      } finally {
        uninstall();
      }
    });

    it('should not reach a provider installed off the path it requests on', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const elsewhere = document.createElement('div');
      container.appendChild(elsewhere);
      const adopt = vi.fn();
      const uninstall = provideContext(elsewhere, adoptUiViewContext, adopt);
      try {
        router = createTestRouter(homeStates);
        const uiView = mountHeld();

        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);

        expect(adopt).not.toHaveBeenCalled();
        expect(uiView.querySelector('p.held')).toBeNull();
      } finally {
        uninstall();
        warn.mockRestore();
      }
    });

    it('should stop being answered once the provider is uninstalled', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const adopt = vi.fn();
      const uninstall = provideContext(container, adoptUiViewContext, adopt);
      uninstall();
      try {
        router = createTestRouter(homeStates);
        const uiView = mountHeld();

        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);

        expect(adopt).not.toHaveBeenCalled();
        expect(uiView.querySelector('p.held')).toBeNull();
      } finally {
        warn.mockRestore();
      }
    });

    it('should drop the held nodes and warn when nothing answers', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        router = createTestRouter(homeStates);
        router.start();
        await routerGo(router, 'home');
        // Mounted and woken in one task: a task asleep is the never-woken check, a different case.
        const uiView = mountHeld();
        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);

        // Dropped, not rendered over: a cold render on top would double them.
        expect(uiView.querySelector('p.held')).toBeNull();
        expect(uiView.querySelector('ui-view')).toBeNull();
        expect(uiView.querySelector('.home-content')).not.toBeNull();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toBe(
          'lit-ui-router-ssr: this <ui-view> woke from defer-hydration and nothing answered its adoptUiViewContext request, so its held nodes were dropped and it rendered cold. Provide an adopter before the wake.',
        );
      } finally {
        warn.mockRestore();
      }
    });

    it('should drop the held render and keep the authored nodes ahead of it', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        router = createTestRouter(homeStates);
        router.start();
        await routerGo(router, 'home');
        const uiView = mountHeld(
          'defer-hydration',
          `<p class="hold">hold</p>${heldMarkup}`,
        );
        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);

        // The held render goes whole: an authored node ahead of it is no reason to keep it.
        expect(uiView.querySelector('p.held')).toBeNull();
        expect(uiView.querySelector('ui-view')).toBeNull();
        expect(uiView.querySelector('.home-content')).not.toBeNull();

        // And what stood ahead of it is the fallback set, parked while a component renders.
        const fallbackNodes = uiView['fallbackNodes'] as Element[];
        expect(fallbackNodes).toHaveLength(1);
        expect(fallbackNodes[0].className).toBe('hold');
        expect(uiView['fallbackParked']).toBe(true);
        expect(fallbackNodes[0].parentNode).toBe(uiView['fallback']);
        expect(uiView.querySelectorAll('p.hold')).toHaveLength(0);

        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('never waking from defer-hydration', () => {
    /** Served output with no nested view, so one sleeping element is one warning. */
    const servedMarkup =
      '<!--lit-part vXOrb1NPBFc=-->' +
      '<p class="held">held</p>' +
      '<!--/lit-part-->';

    const asleepMessage =
      'lit-ui-router-ssr: this <ui-view> is still asleep after the task it connected in, because nothing removed defer-hydration. ' +
      'It renders nothing and holds the served markup as it stands. ' +
      'Usual causes: a clone of a served view, which copies the attribute but not the hydrate walk that clears it, ' +
      'and a document whose hydrate walk threw before reaching this view or never ran. ' +
      'Hydrate the document, or remove defer-hydration from the clone.';

    /** The never-woken calls only: waking without an adopter warns on the same channel. */
    function asleepWarnings(warn: {
      mock: { calls: unknown[][] };
    }): unknown[][] {
      return warn.mock.calls.filter((call) => call[0] === asleepMessage);
    }

    it('should warn once when nothing ever removes the attribute', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        router = createTestRouter(homeStates);
        const uiView = mountHeld('defer-hydration', servedMarkup);

        await tick();

        expect(asleepWarnings(warn)).toHaveLength(1);
        expect(asleepWarnings(warn)[0]?.[1]).toBe(uiView);
        expect(uiView.hasUpdated).toBe(false);

        await tick();

        expect(asleepWarnings(warn)).toHaveLength(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('should warn for a clone of a served view the walk already passed', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const adopt = vi.fn();
      const uninstall = provideContext(container, adoptUiViewContext, adopt);
      try {
        router = createTestRouter(homeStates);
        const uiView = mountHeld('defer-hydration', servedMarkup);
        const clone = uiView.cloneNode(true) as View;
        // The walk wakes the served view in the task it connected in, and never sees the clone.
        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);

        container.appendChild(clone);
        await tick();

        expect(adopt).toHaveBeenCalledTimes(1);
        expect(clone.deferHydration).toBe(true);
        expect(clone.hasUpdated).toBe(false);
        expect(asleepWarnings(warn)).toHaveLength(1);
        expect(asleepWarnings(warn)[0]?.[1]).toBe(clone);
      } finally {
        uninstall();
        warn.mockRestore();
      }
    });

    it('should not warn for a view the walk wakes in the same task', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const adopt = vi.fn();
      const uninstall = provideContext(container, adoptUiViewContext, adopt);
      try {
        router = createTestRouter(homeStates);
        const uiView = mountHeld('defer-hydration', servedMarkup);
        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);

        expect(adopt).toHaveBeenCalledTimes(1);
        expect(asleepWarnings(warn)).toHaveLength(0);
      } finally {
        uninstall();
        warn.mockRestore();
      }
    });

    it('should not warn for a view detached at the check and woken on its re-attach', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const adopt = vi.fn();
      const uninstall = provideContext(container, adoptUiViewContext, adopt);
      try {
        router = createTestRouter(homeStates);
        const uiView = mountHeld('defer-hydration', servedMarkup);
        const uiRouterEl = uiView.parentElement!;
        uiView.remove();

        await tick();

        expect(asleepWarnings(warn)).toHaveLength(0);

        // Back in the document and woken in that same task, the way the pin wakes it.
        uiRouterEl.appendChild(uiView);
        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);

        expect(adopt).toHaveBeenCalledTimes(1);
        expect(asleepWarnings(warn)).toHaveLength(0);
      } finally {
        uninstall();
        warn.mockRestore();
      }
    });
  });

  describe('the router a sleeping view holds', () => {
    it('should keep the router the app assigned to a sleeping view', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        // No router on <ui-router>, so it provides a placeholder the view latches at connect.
        const uiRouterEl = document.createElement('ui-router');
        const uiView = makeView();
        uiView.setAttribute('defer-hydration', '');
        container.appendChild(uiRouterEl);
        uiRouterEl.appendChild(uiView);
        await waitForUpdate(uiView);
        expect(uiView.uiRouter).toBe(uiRouterEl.uiRouter);

        router = createTestRouter(homeStates);
        // The app hands this view its own router; <ui-router> keeps the placeholder.
        uiView.uiRouter = router;
        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);

        expect(uiView.uiRouter).toBe(router);
        expect(router.viewService.available()).toContain('$default');

        router.start();
        await routerGo(router, 'home');
        await waitForUpdate(uiView);

        expect(uiView.querySelector('.home-content')).not.toBeNull();
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('capturing hold content at the wake', () => {
    const holdStates: LitStateDeclaration[] = [
      ...homeStates,
      { name: 'blank', url: '/blank' },
    ];

    it('should capture a deferred view’s authored content without parking it', async () => {
      router = createTestRouter(holdStates);
      const uiView = mountHeld('defer-hydration', '<p class="hold">hold</p>');
      const hold = uiView.querySelector('p.hold')!;

      // Asleep: the document keeps showing what the server drew.
      await uiView.updateComplete;
      expect(uiView.hasUpdated).toBe(false);
      expect(uiView.querySelector('p.hold')).toBe(hold);

      const adopt = vi.fn();
      const uninstall = provideContext(container, adoptUiViewContext, adopt);
      try {
        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);

        expect(adopt).toHaveBeenCalledTimes(1);
        expect(uiView.querySelector('p.hold')).toBe(hold);

        router.start();
        await routerGo(router, 'home');
        await waitForUpdate(uiView);

        expect(uiView.querySelector('p.hold')).toBeNull();
        expect(uiView.querySelector('.home-content')).not.toBeNull();

        await routerGo(router, 'blank');
        await waitForUpdate(uiView);

        expect(uiView.querySelector('p.hold')).toBe(hold);
      } finally {
        uninstall();
      }
    });

    /** Wakes a deferred view under an adopter that takes nothing, so what it holds is what the capture saw. */
    async function wakeHolding(markup: string): Promise<View> {
      router = createTestRouter(holdStates);
      const uiView = mountHeld('defer-hydration', markup);
      const uninstall = provideContext(container, adoptUiViewContext, () => {});
      try {
        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);
      } finally {
        uninstall();
      }
      return uiView;
    }

    it('should capture nothing from a deferred view holding a render’s nodes', async () => {
      const uiView = await wakeHolding(heldMarkup);

      expect(uiView['fallback']).toBeUndefined();
      expect(uiView['fallbackNodes']).toHaveLength(0);
      expect(uiView.querySelector('p.held')).not.toBeNull();
    });

    it('should capture only what stands ahead of the render it holds', async () => {
      const uiView = await wakeHolding(`<p class="hold">hold</p>${heldMarkup}`);

      const fallbackNodes = uiView['fallbackNodes'] as Element[];
      expect(fallbackNodes.map((node) => node.className)).toEqual(['hold']);
      expect(uiView.querySelector('p.held')).not.toBeNull();
    });

    it('should capture nothing from a view holding another render’s prefixed markers', async () => {
      const uiView = await wakeHolding(
        '<!--ui-view:lit-part--><p class="held">held</p><!--ui-view:/lit-part-->',
      );

      expect(uiView['fallback']).toBeUndefined();
      expect(uiView['fallbackNodes']).toHaveLength(0);
    });

    it('should keep the fallback set it captured when it is re-deferred and woken again', async () => {
      const uiView = await wakeHolding(`<p class="hold">hold</p>${heldMarkup}`);
      const hold = uiView.querySelector('p.hold')!;
      const uiRouterEl = uiView.parentElement!;

      // Put back to sleep with content arriving in front of the set it already holds.
      uiView.remove();
      uiView.setAttribute('defer-hydration', '');
      uiView.insertAdjacentHTML('afterbegin', '<p class="late">late</p>');
      uiRouterEl.appendChild(uiView);

      const uninstall = provideContext(container, adoptUiViewContext, () => {});
      try {
        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);
      } finally {
        uninstall();
      }

      const fallbackNodes = uiView['fallbackNodes'] as Element[];
      expect(fallbackNodes).toHaveLength(1);
      expect(fallbackNodes[0]).toBe(hold);
      expect(uiView.querySelectorAll('p.hold')).toHaveLength(1);
    });
  });

  describe('waking with authored hold content', () => {
    it('should keep it when nothing answers', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        router = createTestRouter(homeStates);
        // Hand-written and markerless: no render put these here, so they are not ours to drop.
        const uiView = mountHeld(
          'defer-hydration',
          '<p class="authored">authored</p>',
        );

        uiView.removeAttribute('defer-hydration');
        await waitForUpdate(uiView);

        expect(uiView.querySelector('p.authored')).not.toBeNull();
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });
  });
});

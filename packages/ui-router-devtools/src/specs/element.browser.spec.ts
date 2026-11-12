import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import {
  getAllByRole,
  getByRole,
  queryAllByRole,
  queryByRole,
  waitFor,
  within,
} from '@testing-library/dom';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';

import '../define.ts';
import { DevtoolsPlugin } from '../plugin.ts';
import { UIRouterDevtools } from '../ui-router-devtools.ts';

const routers: UIRouter[] = [];

const bareRouter = (): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  routers.push(router);

  return router;
};

const makeRouter = (): UIRouter => {
  const router = bareRouter();
  router.stateRegistry.register({ name: 'home', url: '/home' });

  return router;
};

// SAFETY: testing-library types its container as HTMLElement and only calls querySelectorAll on it
const shadow = (element: UIRouterDevtools): HTMLElement =>
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- a ShadowRoot is a DocumentFragment, never an HTMLElement
  element.renderRoot as unknown as HTMLElement;

afterEach(() => {
  for (const router of routers.splice(0)) router.dispose();
  document.body.replaceChildren();
  localStorage.clear();
});

it('defines <ui-router-devtools>', () => {
  expect(customElements.get('ui-router-devtools')).toBe(UIRouterDevtools);
});

it('shows the pill with the current state and opens the panel', async () => {
  const router = makeRouter();
  const devtools = router.plugin(DevtoolsPlugin);
  const element = devtools.element;
  await router.stateService.go('home');
  await element.updateComplete;

  const pill = await waitFor(() =>
    getByRole(shadow(element), 'button', { name: /Router .*home/ }),
  );

  expect(pill.matches(':popover-open')).toBe(true);

  pill.click();
  await element.updateComplete;

  const panel = getByRole(shadow(element), 'region', {
    name: 'Router devtools',
  });

  expect(panel.matches(':popover-open')).toBe(true);
  expect(pill.matches(':popover-open')).toBe(false);
  await waitFor(() =>
    expect(
      getByRole(shadow(element), 'button', { name: 'Collapse devtools' }),
    ).toBe(element.shadowRoot?.activeElement),
  );
});

it('removes the element when the plugin is disposed', () => {
  const router = makeRouter();
  const devtools = router.plugin(DevtoolsPlugin);
  expect(document.body.contains(devtools.element)).toBe(true);
  router.dispose(devtools);
  expect(document.body.contains(devtools.element)).toBe(false);
});

const pending = (router: UIRouter) => {
  router.stateRegistry.register({
    name: 'slow',
    url: '/slow',
    resolve: [{ token: 'never', resolveFn: () => new Promise(() => {}) }],
  });
  void router.stateService.go('slow').catch(() => {});
};

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

it('stops ticking when removed mid-transition', async () => {
  const router = makeRouter();
  const devtools = router.plugin(DevtoolsPlugin);
  const element = devtools.element;
  pending(router);
  await waitFor(() => expect(element._runningTx?.to).toBe('slow'));

  const ticking = element._now;
  await waitFor(() => expect(element._now).not.toBe(ticking));

  element.remove();
  await element.updateComplete;
  const removed = element._now;
  await tick(350);

  expect(element._now).toBe(removed);
});

it('shows no duration for an imported transition that never finished', async () => {
  const router = makeRouter();
  const devtools = router.plugin(DevtoolsPlugin);
  const element = devtools.element;
  pending(router);
  await waitFor(() => expect(element._runningTx?.to).toBe('slow'));

  // The exporting page's clock ran far ahead of this one.
  const session = element.session()!;
  element.importSession({
    ...session,
    events: session.events.map((event) => ({ ...event, t: event.t + 1e7 })),
  });
  await element.updateComplete;

  const pill = getByRole(shadow(element), 'button', { name: /Router .*slow/ });

  expect(element._duration(element._runningTx!)).toBeUndefined();
  expect(pill.querySelector('.num')).toBeNull();
});

it('draws the default-child arrow to a lazy child', async () => {
  const router = makeRouter();
  router.stateRegistry.register({ name: 'admin', redirectTo: 'admin.users' });
  router.stateRegistry.register({
    name: 'admin.users.**',
    url: '/users',
    lazyLoad: () => new Promise(() => {}),
  });
  const element = router.plugin(DevtoolsPlugin).element;
  await element.updateComplete;

  await waitFor(() =>
    expect(shadow(element).querySelectorAll('.rail-initial')).toHaveLength(1),
  );
});

describe('the nested Map', () => {
  // The sample app's tree: one root, two compounds, three levels under mymessages.
  const sampleRouter = (): UIRouter => {
    const router = bareRouter();

    for (const name of [
      'app',
      'app.welcome',
      'app.login',
      'app.notFound',
      'app.contacts',
      'app.contacts.contact',
      'app.contacts.contact.edit',
      'app.contacts.new',
      'app.mymessages',
      'app.mymessages.compose',
      'app.mymessages.messagelist',
      'app.mymessages.messagelist.message',
    ])
      router.stateRegistry.register({ name, abstract: name === 'app' });

    return router;
  };

  const MESSAGE = 'app.mymessages.messagelist.message';

  const openMap = async (width: number, height = 800, sheet = '') => {
    await page.viewport(width, height);

    const router = sampleRouter();
    const { element } = router.plugin(DevtoolsPlugin);
    element.style.cssText = sheet;

    for (const state of [
      'app.login',
      'app.mymessages.messagelist',
      MESSAGE,
      'app.contacts.contact',
      MESSAGE,
      'app.mymessages.messagelist',
      MESSAGE,
    ])
      await router.stateService.go(state);

    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: /Router/ }).click();
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: 'map' }).click();
    await element.updateComplete;

    return element;
  };

  const tree = (element: UIRouterDevtools) =>
    waitFor(() => getByRole(shadow(element), 'tree', { name: 'State map' }));

  const edges = (element: UIRouterDevtools) =>
    element.renderRoot.querySelectorAll('.nedge');

  // The room left around the diagram inside the Map viewport's content box, per side.
  const margins = (element: UIRouterDevtools) => {
    const scroller = element.renderRoot.querySelector('.map-scroll')!;
    const style = getComputedStyle(scroller);
    const outer = scroller.getBoundingClientRect();

    const rect = element.renderRoot
      .querySelector('.nested > .box')!
      .getBoundingClientRect();

    return {
      left: rect.left - outer.left - parseFloat(style.paddingLeft),
      right: outer.right - parseFloat(style.paddingRight) - rect.right,
      top: rect.top - outer.top - parseFloat(style.paddingTop),
      bottom: outer.bottom - parseFloat(style.paddingBottom) - rect.bottom,
    };
  };

  const settled = (element: UIRouterDevtools) =>
    waitFor(() =>
      expect(
        [...element.renderRoot.querySelectorAll('.nested, .box')].flatMap(
          (box) => box.getAnimations().filter((a) => a.id.startsWith('uird-')),
        ),
      ).toHaveLength(0),
    );

  it('is a tree of treeitems holding groups, named by header', async () => {
    const element = await openMap(1280);
    const map = await tree(element);
    const app = getByRole(map, 'treeitem', { name: 'app' });
    const messages = getByRole(map, 'treeitem', { name: 'mymessages' });
    const message = getByRole(map, 'treeitem', { name: 'message' });

    expect(app.getAttribute('aria-expanded')).toBe('true');
    expect(message.hasAttribute('aria-expanded')).toBe(false);
    expect(message.getAttribute('aria-current')).toBe('true');
    expect(message.getAttribute('aria-selected')).toBe('false');

    // Each header owns the group in its box, and that group holds the child items.
    const owned = (item: HTMLElement) =>
      element.renderRoot.querySelector<HTMLElement>(
        `#${item.getAttribute('aria-owns')}`,
      )!;

    expect(owned(app).getAttribute('role')).toBe('group');
    expect(owned(app).parentElement).toBe(app.parentElement);
    expect(owned(app).contains(messages)).toBe(true);
    expect(
      within(owned(messages)).getByRole('treeitem', { name: 'messagelist' }),
    ).toBeTruthy();
    expect(message.hasAttribute('aria-owns')).toBe(false);
    expect(
      getAllByRole(map, 'treeitem').filter((item) => item.tabIndex === 0),
    ).toEqual([message]);
    expect(map.querySelector('svg.nedges')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('loads the Map on first use of the Map tab', async () => {
    const router = sampleRouter();
    const { element } = router.plugin(DevtoolsPlugin);
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: /Router/ }).click();
    await element.updateComplete;

    expect(element._map).toBeUndefined();
    getByRole(shadow(element), 'button', { name: 'map' }).click();
    await waitFor(() => expect(element._map).toBeDefined());
    expect(await tree(element)).toBeTruthy();
  });

  it("keeps boxes at their natural size in the dock, with the popover's column free, and enlarges them maximised", async () => {
    const element = await openMap(1280);
    const map = await tree(element);

    const pills = (height: number, widest: number) => {
      for (const name of ['login', 'message', 'edit']) {
        const pill = getByRole(map, 'treeitem', { name }).parentElement!;
        const rect = pill.getBoundingClientRect();
        const text = pill.querySelector('.name')!;

        expect(rect.height).toBe(height);
        expect(rect.width).toBeLessThanOrEqual(widest);
        // A pill is its label and padding, so its text is never clipped and never has slack beside it.
        expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth);
        expect(rect.right - text.getBoundingClientRect().right).toBeLessThan(
          height,
        );
      }
    };

    await settled(element);
    const dock = margins(element);

    // The diagram is centred when a column is free either side, and otherwise as near the middle as leaves one free at the end.
    expect(Math.abs(dock.top - dock.bottom)).toBeLessThanOrEqual(1);
    expect(dock.left).toBeGreaterThanOrEqual(0);
    expect(dock.left).toBeLessThanOrEqual(dock.right + 1);
    expect(dock.right).toBeGreaterThanOrEqual(320);
    pills(24, 208);

    getByRole(shadow(element), 'button', { name: 'Maximise devtools' }).click();
    await waitFor(() => {
      const scroller = element.renderRoot.querySelector('.map-scroll')!;
      expect(scroller.clientHeight).toBeGreaterThan(300);
    });
    await settled(element);
    const max = margins(element);

    expect(Math.abs(max.left - max.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(max.top - max.bottom)).toBeLessThanOrEqual(1);
    // Maximised, the diagram takes a larger step and still keeps a margin.
    expect(max.left).toBeGreaterThan(40);
    expect(max.top).toBeGreaterThan(12);
    expect(
      getComputedStyle(element.renderRoot.querySelector('.nested')!).fontSize,
    ).not.toBe('12px');

    const { height } = getByRole(map, 'treeitem', {
      name: 'login',
    }).parentElement!.getBoundingClientRect();

    expect([32, 40]).toContain(height);
    pills(height, 348);
    // Maximised, the full log and the inspector sit below the diagram.
    expect(
      getByRole(shadow(element), 'heading', { name: /Inspector/ }),
    ).toBeTruthy();
    expect(queryByRole(shadow(element), 'listbox')).toBeNull();
  });

  it('moves nothing when a state is selected, and keeps the popover off the selected box', async () => {
    for (const width of [1280, 1000]) {
      const element = await openMap(width);
      const map = await tree(element);
      await settled(element);

      const rects = () =>
        [...element.renderRoot.querySelectorAll('.box')].map((box) => {
          const { x, y, width: w, height: h } = box.getBoundingClientRect();

          return [x, y, w, h];
        });

      const before = rects();

      for (const name of ['message', 'login', 'contacts']) {
        const item = getByRole(map, 'treeitem', { name });
        item.click();
        await waitFor(() =>
          expect(item.getAttribute('aria-selected')).toBe('true'),
        );
        await element.updateComplete;

        expect(rects()).toEqual(before);

        const box = item.parentElement!.getBoundingClientRect();

        await waitFor(() => {
          const popover = element.renderRoot
            .querySelector('.inspector-pane')!
            .getBoundingClientRect();

          expect(popover.width).toBeGreaterThan(0);
          expect(
            popover.left >= box.right ||
              popover.right <= box.left ||
              popover.top >= box.bottom ||
              popover.bottom <= box.top,
          ).toBe(true);
        });
      }

      element.remove();
    }
  });

  it('closes and opens a compound from its fold button', async () => {
    const element = await openMap(1280);
    const map = await tree(element);

    getByRole(map, 'button', { name: 'Collapse contacts' }).click();
    await waitFor(() =>
      expect(
        getByRole(map, 'treeitem', { name: 'contacts 3' }).getAttribute(
          'aria-expanded',
        ),
      ).toBe('false'),
    );

    // The collapsing box and the root that shrinks around it ease their size as well as their place.
    const sized = (name: string) =>
      element.renderRoot
        .querySelector(`.box[data-name="${name}"]`)!
        .getAnimations()
        .flatMap((animation) =>
          animation.id === 'uird-flip' &&
          animation.effect instanceof KeyframeEffect
            ? animation.effect.getKeyframes()
            : [],
        )
        .some((frame) => 'width' in frame && 'height' in frame);

    expect(sized('app.contacts')).toBe(true);
    expect(sized('app')).toBe(true);
    await settled(element);
    expect(queryByRole(map, 'treeitem', { name: 'edit' })).toBeNull();
    expect(
      getByRole(map, 'treeitem', { name: 'contacts 3' }).getAttribute(
        'aria-selected',
      ),
    ).toBe('false');

    getByRole(map, 'button', { name: 'Expand contacts' }).click();
    await waitFor(() =>
      expect(getByRole(map, 'treeitem', { name: 'edit' })).toBeTruthy(),
    );
  });

  it('colours a state by its depth on the Map and in the Outline, and by status while a transition is in focus', async () => {
    const element = await openMap(1280);
    const map = await tree(element);

    const box = (name: string) =>
      getByRole(map, 'treeitem', { name }).parentElement!;

    const border = (name: string) =>
      getComputedStyle(box(name), '::before').borderTopColor;

    // Siblings share a colour, a child differs from its parent, and the cycle comes round after four levels.
    expect(box('app').classList.contains('d1')).toBe(true);
    expect(box('message').classList.contains('d4')).toBe(true);
    expect(border('login')).toBe(border('contacts'));
    expect(border('mymessages')).not.toBe(border('app'));
    expect(border('messagelist')).not.toBe(border('mymessages'));
    expect(getComputedStyle(box('message'), '::before').borderTopWidth).toBe(
      '2px',
    );

    const resting = border('messagelist');

    const options = getAllByRole(
      getByRole(shadow(element), 'listbox', { name: /Transitions/ }),
      'option',
    );

    // The second transition enters mymessages and messagelist.
    options[1].click();
    await waitFor(() =>
      expect(
        getByRole(shadow(element), 'region', { name: 'Router devtools' })
          .dataset.mode,
      ).toBe('tx'),
    );
    await waitFor(() => {
      expect(border('messagelist')).not.toBe(resting);
      expect(border('messagelist')).toBe(border('mymessages'));
    });
    expect(border('contacts')).not.toBe(border('messagelist'));
  });

  it('moves focus in tree order with the arrow keys', async () => {
    const element = await openMap(1280);
    const map = await tree(element);
    const item = (name: string) => getByRole(map, 'treeitem', { name });

    const press = (key: string) =>
      element.shadowRoot?.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, composed: true }),
      );

    item('message').focus();
    press('ArrowUp');
    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(item('messagelist')),
    );
    press('ArrowLeft');
    await waitFor(() =>
      // collapsed, its label carries the count of the states inside
      expect(item('messagelist 1').getAttribute('aria-expanded')).toBe('false'),
    );
    expect(queryByRole(map, 'treeitem', { name: 'message' })).toBeNull();
    press('ArrowRight');
    await waitFor(() => expect(item('message')).toBeTruthy());
  });

  it("draws no edge at rest and a state's traffic once it is selected", async () => {
    const element = await openMap(1280);
    const map = await tree(element);
    expect(edges(element)).toHaveLength(0);

    getByRole(map, 'treeitem', { name: 'message' }).click();
    // messagelist to message, contact to message, message to contact and message to messagelist
    await waitFor(() => expect(edges(element)).toHaveLength(4));
    expect(
      getByRole(map, 'treeitem', { name: 'message' }).getAttribute(
        'aria-selected',
      ),
    ).toBe('true');
    expect(element.renderRoot.querySelectorAll('.nedge.w2')).toHaveLength(1);
    expect(element.renderRoot.querySelectorAll('.nedge.fallback')).toHaveLength(
      0,
    );

    // The inspector names the same relations in words; each one selects and focuses its box.
    const inspector = getByRole(shadow(element), 'group', {
      name: /Inspector/,
    });

    expect(inspector.textContent).toMatch(/Arrived/);
    expect(inspector.textContent).toMatch(/Left/);
    within(inspector).getAllByRole('button', { name: 'contact' })[0].click();

    const contact = await waitFor(() => {
      const box = getByRole(map, 'treeitem', { name: 'contact' });
      expect(box.getAttribute('aria-selected')).toBe('true');

      return box;
    });

    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(contact),
    );
  });

  it('shows a selected transition from the scrubber as an edge', async () => {
    const element = await openMap(1280);
    await tree(element);

    const listbox = getByRole(shadow(element), 'listbox', {
      name: /Transitions/,
    });

    const options = getAllByRole(listbox, 'option');
    expect(options).toHaveLength(7);

    options[3].click();
    await waitFor(() => expect(edges(element)).toHaveLength(1));
    expect(options[3].getAttribute('aria-selected')).toBe('true');
    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[3].id);

    listbox.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    await waitFor(() =>
      expect(
        getAllByRole(listbox, 'option')[4].getAttribute('aria-selected'),
      ).toBe('true'),
    );
  });

  it('places the inspector popover clear of the selection, its edges and the boxes they end at', async () => {
    // Wide enough that the popover has room beside the diagram.
    const element = await openMap(1680);
    const map = await tree(element);
    getByRole(map, 'treeitem', { name: 'message' }).click();
    await waitFor(() => expect(edges(element)).toHaveLength(4));

    await waitFor(() => {
      const panel = getByRole(shadow(element), 'region', {
        name: 'Router devtools',
      });

      const popover = element.renderRoot
        .querySelector('.inspector-pane')!
        .getBoundingClientRect();

      const bounds = panel.getBoundingClientRect();

      expect(popover.width).toBeGreaterThan(0);
      expect(popover.left).toBeGreaterThanOrEqual(bounds.left);
      expect(popover.right).toBeLessThanOrEqual(bounds.right);
      expect(popover.bottom).toBeLessThanOrEqual(bounds.bottom);

      for (const name of ['message', 'messagelist', 'contact']) {
        const box = getByRole(map, 'treeitem', {
          name,
        }).parentElement!.getBoundingClientRect();

        expect(popover.left >= box.right || popover.right <= box.left).toBe(
          true,
        );
      }
    });
  });

  it('remembers the chosen layout', async () => {
    const element = await openMap(1280);
    await tree(element);
    getByRole(shadow(element), 'button', { name: 'Tree' }).click();

    await waitFor(() =>
      expect(
        queryByRole(shadow(element), 'tree', { name: 'State map' }),
      ).toBeNull(),
    );
    expect(
      getByRole(shadow(element), 'group', { name: 'State map' }),
    ).toBeTruthy();
    expect(localStorage.getItem('ui-router-devtools:map-layout')).toBe('tree');

    element.remove();

    const next = await openMap(1280);
    await waitFor(() =>
      expect(
        getByRole(shadow(next), 'group', { name: 'State map' }),
      ).toBeTruthy(),
    );
    expect(queryAllByRole(shadow(next), 'tree')).toHaveLength(0);
  });

  it('shows the node-link tree, and does not offer nested boxes, under 560px', async () => {
    const element = await openMap(800, 800, '--uird-sheet-width: 480px');

    const nodeLink = await waitFor(() =>
      getByRole(shadow(element), 'group', { name: 'State map' }),
    );

    expect(nodeLink.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(
      queryByRole(shadow(element), 'tree', { name: 'State map' }),
    ).toBeNull();

    const nested = getByRole(shadow(element), 'button', { name: 'Nested' });
    expect(nested).toHaveProperty('disabled', true);
    expect(
      getByRole(shadow(element), 'button', { name: 'Tree' }).getAttribute(
        'aria-pressed',
      ),
    ).toBe('true');
  });
});

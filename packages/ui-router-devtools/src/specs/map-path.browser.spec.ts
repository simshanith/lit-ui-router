import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { commands, page } from 'vitest/browser';
import {
  configure,
  getAllByRole,
  getByRole,
  getConfig,
  queryByRole,
  waitFor,
  within,
} from '@testing-library/dom';
import { memoryLocationPlugin, type StateDeclaration } from '@uirouter/core';
import { html, LitElement, render } from 'lit';
import { UIRouterLit, type LitStateDeclaration } from 'lit-ui-router';

import { DevtoolsPlugin } from '../plugin.ts';
import { litViewLocator } from '../lit-ui-router.ts';
import type { DevtoolsPanel } from '../element/panel.ts';
import type { UIRouterDevtools } from '../ui-router-devtools.ts';

declare module 'vitest/browser' {
  interface BrowserCommands {
    reduceMotion: (reduce: boolean) => Promise<void>;
  }
}

const { getElementError } = getConfig();

// prettyDOM takes no ShadowRoot, so a failed query in one names its host instead of throwing a TypeError.
configure({
  getElementError: (message, container) =>
    getElementError(
      message,
      container instanceof ShadowRoot ? container.host : container,
    ),
});

// Boxes are measured where they stand, so none is caught moving.
beforeAll(() => commands.reduceMotion(true));

// Both drawings are lazy chunks; loaded once here, a cold transform never counts against a wait in a spec.
beforeAll(() =>
  Promise.all([import('../element/map.ts'), import('../element/viewmap.ts')]),
);

afterAll(() => commands.reduceMotion(false));

// What the viewer's next panel starts with.
const nextPanel = () =>
  // SAFETY: the element `./define` registers is a DevtoolsPanel
  document.createElement('ui-router-devtools') as DevtoolsPanel;

class PathMail extends LitElement {
  render() {
    return html`<ui-view name="list"></ui-view
      ><ui-view name="content"></ui-view>`;
  }
}

customElements.define('path-mail', PathMail);

// Each level holds one unnamed view the next level fills, so the path goes as deep as the states.
class PathLevel extends LitElement {
  render() {
    return html`<ui-view></ui-view>`;
  }
}

customElements.define('path-level', PathLevel);

const routers: UIRouterLit[] = [];

afterEach(() => {
  for (const router of routers.splice(0)) router.dispose();
  document.body.replaceChildren();
  localStorage.clear();
});

// SAFETY: testing-library types its container as HTMLElement and only calls querySelectorAll on it
const shadow = (element: UIRouterDevtools): HTMLElement =>
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- a ShadowRoot is a DocumentFragment, never an HTMLElement
  element.renderRoot as unknown as HTMLElement;

// SAFETY: the element `./define` registers is a DevtoolsPanel
const panelOf = (element: UIRouterDevtools) => element as DevtoolsPanel;

const overlay = () =>
  document.body.querySelector<HTMLElement>('[data-ui-router-devtools-view]');

const STATES: LitStateDeclaration[] = [
  { name: 'mail', url: '/mail', component: PathMail },
  {
    name: 'mail.list',
    url: '/list',
    views: { list: () => html`<p>messages</p>` },
  },
  // Drawn into the list view's parent, so it fills no view of its own.
  { name: 'mail.list.read', url: '/read' },
  {
    name: 'mail.both',
    url: '/both',
    views: {
      list: () => html`<p>list</p>`,
      content: () => html`<p>content</p>`,
    },
  },
  { name: 'home', url: '/home', component: () => html`<p>home</p>` },
];

const LEVELS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];

// A path seven views deep, each filled by a long-named state.
const DEEP: LitStateDeclaration[] = LEVELS.map((n, index) => ({
  name: LEVELS.slice(0, index + 1)
    .map((each) => `level-${each}-of-the-archive`)
    .join('.'),
  url: `/${n}`,
  component: PathLevel,
}));

/** The panel open on the Map over a small mail app at a viewport this wide, on `start`. */
const mailMap = async (
  width = 1280,
  start = 'mail.list',
  extra: readonly StateDeclaration[] = [],
  prepare: (panel: DevtoolsPanel) => void = () => {},
) => {
  await page.viewport(width, 800);

  const router = new UIRouterLit();
  routers.push(router);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});

  for (const state of [...STATES, ...extra])
    router.stateRegistry.register(state);

  const host = document.createElement('main');
  document.body.append(host);
  render(html`<ui-view .uiRouter=${router}></ui-view>`, host);

  const { element } = router.plugin(DevtoolsPlugin, {
    viewLocator: litViewLocator,
  });

  prepare(panelOf(element));

  await router.stateService.go(start);
  await element.updateComplete;
  getByRole(shadow(element), 'button', { name: /Router/ }).click();
  await element.updateComplete;
  getByRole(shadow(element), 'button', { name: 'map' }).click();
  await waitFor(() => toggle(element));

  return { router, element };
};

/** The view path under the Map, once it is drawn. */
const pathOf = (
  element: UIRouterDevtools,
  name: RegExp | string = /^Views of/,
) => waitFor(() => getByRole(shadow(element), 'toolbar', { name }));

const noPath = async (element: UIRouterDevtools) => {
  await waitFor(() => expect(panelOf(element)._viewMap).toBeDefined());
  await element.updateComplete;
  expect(
    queryByRole(shadow(element), 'toolbar', { name: /^Views/ }),
  ).toBeNull();
};

const items = (path: HTMLElement) =>
  getAllByRole(path, 'button').map(
    (item) => item.getAttribute('aria-label') ?? item.textContent?.trim(),
  );

const item = (path: HTMLElement, name: RegExp) =>
  getByRole(path, 'button', { name });

const head = (tree: HTMLElement, name: RegExp | string) =>
  getByRole(tree, 'treeitem', { name });

const states = (element: UIRouterDevtools) =>
  getByRole(shadow(element), 'tree', { name: 'State map' });

// The toggle draws before the lazy Map does, so a spec that starts on the Map waits for it.
const drawnStates = (element: UIRouterDevtools) =>
  waitFor(() => states(element));

const boxOf = (element: HTMLElement) => element.closest<HTMLElement>('.box');

const rects = (elements: readonly (Element | null)[]) =>
  elements.map((each) =>
    JSON.stringify(each?.getBoundingClientRect().toJSON()),
  );

// Where every box of the Map is, so a selection can be shown to move none of them.
const boxes = (element: UIRouterDevtools) =>
  rects(getAllByRole(states(element), 'treeitem').map((each) => boxOf(each)));

// The Map's boxes and every item of the path.
const places = (element: UIRouterDevtools) => [
  ...boxes(element),
  ...rects([...shadow(element).querySelectorAll('.vp button')]),
];

const toggle = (element: UIRouterDevtools) =>
  getByRole(shadow(element), 'button', { name: 'View path' });

const inspector = (element: UIRouterDevtools) =>
  getByRole(shadow(element), 'region', { name: /Inspector/ });

const press = (element: UIRouterDevtools, key: string) =>
  element.shadowRoot?.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true }),
  );

const focused = (element: UIRouterDevtools) =>
  element.shadowRoot?.activeElement;

describe('the view path under the Map', () => {
  it('draws the active state’s views inside the views that hold them, docked and maximised', async () => {
    const { element } = await mailMap();
    const path = await pathOf(element, 'Views of mail.list');

    expect(items(path)).toEqual([
      '$default view, filled by mail',
      'list view, filled by mail.list',
      '+1 other view',
    ]);

    // Under the Map, across its width.
    // SAFETY: the Map is drawn in its scroller
    const map = states(element).closest<HTMLElement>('.map-scroll')!;

    expect(path.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      map.getBoundingClientRect().bottom,
    );
    expect(path.ariaOrientation).toBe('horizontal');

    getByRole(shadow(element), 'button', { name: 'Maximise devtools' }).click();
    await waitFor(() => expect(panelOf(element)._max).toBe(true));
    await pathOf(element, 'Views of mail.list');
  });

  it('stacks the path as nested boxes in the side sheet, under the node-link tree', async () => {
    const { element } = await mailMap(700);
    const path = await pathOf(element, 'Views of mail.list');

    expect(path.ariaOrientation).toBe('vertical');

    const outer = item(path, /^\$default view/).getBoundingClientRect();
    const inner = item(path, /^list view/).getBoundingClientRect();

    expect(inner.top).toBeGreaterThan(outer.bottom - 1);
    expect(inner.left).toBeGreaterThan(outer.left);
  });

  it('draws a selected state’s path in place of the active one, and moves nothing', async () => {
    const { element } = await mailMap();

    await drawnStates(element);
    const before = boxes(element);

    head(states(element), 'mail').click();

    const path = await pathOf(element, 'Views of mail');

    expect(items(path)).toEqual([
      '$default view, filled by mail',
      '+2 other views',
    ]);
    expect(boxes(element)).toEqual(before);
  });

  it('takes the nearest ancestor’s path for an active state that fills no view, and says so', async () => {
    const { element } = await mailMap(1280, 'mail.list.read');
    const path = await pathOf(element, 'Views of mail.list');

    expect(within(path).getByText(/^of mail\.list$/)).toBeTruthy();
    expect(items(path)).toContain('list view, filled by mail.list');
  });

  it('draws each view a state fills, the second after the first', async () => {
    const { element } = await mailMap(1280, 'mail.both');
    const path = await pathOf(element, 'Views of mail.both');

    expect(items(path)).toEqual([
      '$default view, filled by mail',
      'list view, filled by mail.both',
      'content view, filled by mail.both',
    ]);
    expect(
      [...path.querySelectorAll('.vp-sep')].map((sep) => sep.textContent),
    ).toEqual(['›', '+']);
  });

  // A future state stands in for a tree its lazy load registers, and the load takes the placeholder away.
  const FUTURE: LitStateDeclaration[] = [
    {
      name: 'later.**',
      url: '/later',
      lazyLoad: () =>
        Promise.resolve({
          states: [
            {
              name: 'later',
              url: '/later',
              component: () => html`<p>later</p>`,
            },
          ],
        }),
    },
  ];

  it('follows a selected future state to the state its lazy load registered', async () => {
    const { element, router } = await mailMap(1280, 'mail.list', FUTURE);

    head(states(element), /^later/).click();
    await waitFor(() =>
      expect(panelOf(element)._selectedState).toBe('later.**'),
    );

    // As a double-click does: go to it, which loads it.
    await router.stateService.go('later');

    const path = await pathOf(element, 'Views of later');

    expect(items(path)).toContain('$default view, filled by later');
  });

  it('draws the active state’s path once a selected state is gone with nothing in its place', async () => {
    const { element, router } = await mailMap(1280, 'mail.list', FUTURE);

    head(states(element), /^later/).click();
    await waitFor(() =>
      expect(panelOf(element)._selectedState).toBe('later.**'),
    );

    router.stateRegistry.deregister('later.**');
    await pathOf(element, 'Views of mail.list');
    expect(
      queryByRole(shadow(element), 'group', { name: /^Views of later/ }),
    ).toBeNull();
  });

  it('says a selected state that is not active fills no view', async () => {
    const { element } = await mailMap();

    head(await drawnStates(element), 'home').click();

    const path = await waitFor(() =>
      getByRole(shadow(element), 'group', { name: 'Views of home' }),
    );

    expect(path.textContent).toMatch(/home fills no view now/);
  });

  it('hides and shows with its toggle, which the viewer’s next panel remembers', async () => {
    const { element } = await mailMap();

    await pathOf(element);
    expect(toggle(element).ariaPressed).toBe('true');
    expect(toggle(element).title).toBe('Hide the view path under the Map');

    toggle(element).click();
    await noPath(element);
    expect(toggle(element).ariaPressed).toBe('false');
    expect(toggle(element).title).toBe('Show the view path under the Map');
    expect(nextPanel()._mapViews).toBe(false);

    toggle(element).click();
    await pathOf(element);
    expect(nextPanel()._mapViews).toBe(true);
  });

  it('keeps the whole room for the Map in the node-link tree and on a zoom, the path still drawn', async () => {
    const { element } = await mailMap();

    await pathOf(element);
    getByRole(shadow(element), 'button', { name: 'Zoom in' }).click();
    await pathOf(element);
    getByRole(shadow(element), 'button', { name: 'Tree' }).click();
    await pathOf(element);
  });

  it('shows a selected view in the panel’s inspector, marks its states and drops the state selection', async () => {
    const { element } = await mailMap();
    const path = await pathOf(element);

    head(await drawnStates(element), 'mail').click();
    await element.updateComplete;

    const before = places(element);
    const list = await pathOf(element, 'Views of mail');

    item(list, /^\$default view/).click();
    await element.updateComplete;

    expect(
      within(inspector(element)).getAllByText('$default').length,
    ).toBeGreaterThan(0);
    expect(head(states(element), 'mail').ariaSelected).toBe('false');
    expect(item(list, /^\$default view/).ariaPressed).toBe('true');

    // The state that fills it, marked on the Map.
    expect(boxOf(head(states(element), 'mail'))?.classList).toContain('linked');
    expect(
      head(states(element), 'mail').getAttribute('aria-description'),
    ).toMatch(/fills the selected view$/);
    expect(places(element)).toEqual(before);

    // The path stays the one the view was picked from.
    expect(
      getByRole(shadow(element), 'toolbar', { name: 'Views of mail' }),
    ).toBeTruthy();
    expect(path.isConnected).toBe(true);

    // The page outlines the selected view, as the Views tab does.
    await waitFor(() =>
      expect(overlay()?.dataset.uiRouterDevtoolsView).toBe('$default'),
    );

    // Selecting a state takes the view's place.
    head(states(element), 'home').click();
    await element.updateComplete;
    expect(panelOf(element)._viewSelected).toBeNull();
    await waitFor(() => expect(overlay()).toBeNull());
  });

  it('marks a selected view’s states in the node-link tree too', async () => {
    const { element } = await mailMap();
    const path = await pathOf(element);

    getByRole(shadow(element), 'button', { name: 'Tree' }).click();
    await element.updateComplete;
    item(path, /^list view/).click();
    await element.updateComplete;

    const node = (name: RegExp) =>
      getByRole(shadow(element), 'button', { name });

    await waitFor(() =>
      expect(node(/^mail\.list,/).classList).toContain('linked'),
    );
    expect(node(/^mail\.list,/).getAttribute('aria-description')).toBe(
      'fills the selected view',
    );
    expect(node(/^mail,/).getAttribute('aria-description')).toBe(
      'created the selected view',
    );
    expect(node(/^home,/).classList).not.toContain('linked');
    expect(node(/^home,/).hasAttribute('aria-description')).toBe(false);
  });

  it('clears a view selection every way a selection clears', async () => {
    const { element, router } = await mailMap();
    const panel = panelOf(element);
    const path = await pathOf(element);

    const select = async () => {
      item(path, /^list view/).click();
      await element.updateComplete;
      expect(panel._inspect).toBe('view');
    };

    // Clicking it again.
    await select();
    item(path, /^list view/).click();
    await element.updateComplete;
    expect(panel._inspect).toBe('none');

    // Escape on the path or the Map.
    await select();
    item(path, /^list view/).focus();
    press(element, 'Escape');
    await element.updateComplete;
    expect(panel._inspect).toBe('none');

    await select();
    head(states(element), 'mail').focus();
    press(element, 'Escape');
    await element.updateComplete;
    expect(panel._inspect).toBe('none');
    expect(panel._viewSelected).toBeNull();

    // The Router card, and a transition.
    await select();
    getByRole(shadow(element), 'button', { name: 'Router' }).click();
    await element.updateComplete;
    expect(panel._viewSelected).toBeNull();

    await select();
    panel._selectTx(panel._model.txs.at(-1)!.id);
    await element.updateComplete;
    expect(panel._viewSelected).toBeNull();

    // A state named in the view's details is selected on the Map.
    await select();
    within(inspector(element))
      .getByRole('button', { name: 'mail.list' })
      .click();
    await element.updateComplete;
    expect(panel._view).toBe('map');
    expect(head(states(element), 'list').ariaSelected).toBe('true');
    expect(panel._inspect).toBe('state');

    // A view that leaves the snapshot.
    head(states(element), 'list').click();
    await element.updateComplete;
    await select();
    await router.stateService.go('home');
    await waitFor(() => expect(panel._inspect).toBe('none'));
  });

  it.each([
    ['the toggle', (element: UIRouterDevtools) => toggle(element).click()],
    [
      'the Outline',
      (element: UIRouterDevtools) =>
        getByRole(shadow(element), 'button', { name: 'outline' }).click(),
    ],
  ] as const)(
    'drops a view selected from the path when %s takes the path away',
    async (_, leave) => {
      const { element } = await mailMap();
      const panel = panelOf(element);
      const path = await pathOf(element);

      item(path, /^list view/).click();
      await waitFor(() =>
        expect(overlay()?.dataset.uiRouterDevtoolsView).toBe('$default.list'),
      );

      leave(element);
      await element.updateComplete;
      await waitFor(() => expect(panel._inspect).toBe('none'));
      expect(panel._viewSelected).toBeNull();
      expect(overlay()).toBeNull();
    },
  );

  it('returns focus from the inspector to the selected view when Escape clears it', async () => {
    const { element } = await mailMap();
    const path = await pathOf(element);

    item(path, /^list view/).click();
    await element.updateComplete;
    within(inspector(element))
      .getByRole('button', { name: 'mail.list' })
      .focus();
    press(element, 'Escape');

    await waitFor(() =>
      expect(focused(element)).toBe(item(path, /^list view/)),
    );
    expect(panelOf(element)._inspect).toBe('none');
  });

  it('is one tab stop, stepped through by the arrow keys, mirrored right to left', async () => {
    const { element } = await mailMap();
    const path = await pathOf(element);
    const all = getAllByRole(path, 'button');

    // The state's own view takes Tab.
    expect(all.filter((each) => each.tabIndex === 0)).toEqual([
      item(path, /^list view/),
    ]);

    item(path, /^list view/).focus();
    press(element, 'ArrowLeft');
    await waitFor(() =>
      expect(focused(element)).toBe(item(path, /^\$default view/)),
    );
    await element.updateComplete;
    expect(item(path, /^\$default view/).tabIndex).toBe(0);
    expect(item(path, /^list view/).tabIndex).toBe(-1);

    press(element, 'End');
    expect(focused(element)).toBe(all.at(-1));
    press(element, 'Home');
    expect(focused(element)).toBe(item(path, /^\$default view/));
    press(element, 'ArrowDown');
    expect(focused(element)).toBe(item(path, /^list view/));

    element.dir = 'rtl';
    await element.updateComplete;
    press(element, 'ArrowLeft');
    expect(focused(element)).toBe(all.at(-1));
    press(element, 'ArrowRight');
    expect(focused(element)).toBe(item(path, /^list view/));

    // Names and the count keep their order in a right-to-left panel.
    expect(getComputedStyle(all.at(-1)!).direction).toBe('ltr');
    expect(
      getComputedStyle(item(path, /^\$default view/).querySelector('.name')!)
        .direction,
    ).toBe('ltr');

    // Enter or Space presses the focused item, which is a button.
    expect(item(path, /^list view/).tagName).toBe('BUTTON');
  });

  it('keeps one tab stop when a transition changes the path', async () => {
    const { element, router } = await mailMap();
    const path = await pathOf(element);

    item(path, /^list view/).focus();
    await router.stateService.go('home');

    const home = await pathOf(element, 'Views of home');

    await waitFor(() =>
      expect(
        getAllByRole(home, 'button').filter((each) => each.tabIndex === 0),
      ).toEqual([item(home, /^\$default view, filled by home/)]),
    );

    // Focus stays in the path, on its tab stop.
    await waitFor(() =>
      expect(focused(element)).toBe(
        item(home, /^\$default view, filled by home/),
      ),
    );
  });

  it('lets go of the path’s focus once the path is taken away', async () => {
    const { element } = await mailMap();
    const panel = panelOf(element);
    const path = await pathOf(element);

    item(path, /^list view/).focus();
    panel._mapViews = false;
    await noPath(element);

    // Drawn again later, the path does not take focus back.
    panel._mapViews = true;

    const again = await pathOf(element);

    await element.updateComplete;
    expect(again.contains(focused(element) ?? null)).toBe(false);
  });

  it('leaves focus outside the path where it is when the path changes', async () => {
    const { element, router } = await mailMap();

    await pathOf(element);
    toggle(element).focus();
    await router.stateService.go('home');
    await pathOf(element, 'Views of home');
    await element.updateComplete;

    expect(focused(element)).toBe(toggle(element));
  });

  it('outlines the view under the pointer on the page', async () => {
    const { element } = await mailMap();
    const path = await pathOf(element);
    const root = item(path, /^\$default view/);

    root.dispatchEvent(new PointerEvent('pointerenter'));
    expect(overlay()?.dataset.uiRouterDevtoolsView).toBe('$default');
    root.dispatchEvent(new PointerEvent('pointerleave'));
    expect(overlay()).toBeNull();
  });

  it('places a selected view’s popover off its item and the path’s other items', async () => {
    const { element } = await mailMap();
    const path = await pathOf(element);
    const chosen = item(path, /^list view/);

    chosen.click();

    const popover = await waitFor(() => {
      const found = inspector(element);

      expect(found.getBoundingClientRect().width).toBeGreaterThan(0);

      return found;
    });

    const over = popover.getBoundingClientRect();

    for (const each of getAllByRole(path, 'button')) {
      const under = each.getBoundingClientRect();

      expect(
        over.right <= under.left ||
          over.left >= under.right ||
          over.bottom <= under.top ||
          over.top >= under.bottom,
      ).toBe(true);
    }
  });

  it('scrolls a path longer than the dock, bringing the focused item into view', async () => {
    const { element } = await mailMap(1000, DEEP.at(-1)!.name, DEEP);
    const path = await pathOf(element);

    expect(getAllByRole(path, 'button')).toHaveLength(LEVELS.length + 1);
    expect(path.scrollWidth).toBeGreaterThan(path.clientWidth);
    expect(path.scrollLeft).toBe(0);

    getAllByRole(path, 'button')[0].focus();
    press(element, 'End');

    await waitFor(() => expect(path.scrollLeft).toBeGreaterThan(0));

    const last = focused(element)!.getBoundingClientRect();
    const room = path.getBoundingClientRect();

    expect(last.right).toBeLessThanOrEqual(room.right + 1);
  });

  it('opens the Views tab from its count of other views', async () => {
    const { element } = await mailMap();
    const path = await pathOf(element);

    getByRole(path, 'button', { name: '+1 other view' }).click();
    await waitFor(() => expect(panelOf(element)._view).toBe('views'));
  });

  it('shows the path when storage is blocked, and still toggles', async () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);

    try {
      const { element } = await mailMap();

      await pathOf(element);
      toggle(element).click();
      await noPath(element);
      expect(toggle(element).ariaPressed).toBe('false');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it.each([
    [
      'holds no views',
      (events: readonly { type: string }[]) =>
        events.filter((event) => event.type !== 'views'),
    ],
    [
      'holds a views snapshot with no view in it',
      (events: readonly { type: string }[]) =>
        events.map((event) =>
          event.type === 'views'
            ? { ...event, views: [], unmatched: [] }
            : event,
        ),
    ],
  ] as const)('offers no view path for a session that %s', async (_, edit) => {
    const { element } = await mailMap();
    const panel = panelOf(element);
    const session = panel.session()!;

    await pathOf(element);
    // SAFETY: the edit keeps every event's shape, only dropping or emptying the views snapshot
    panel.importSession({
      ...session,
      events: edit(session.events) as typeof session.events,
    });

    await element.updateComplete;
    expect(
      queryByRole(shadow(element), 'toolbar', { name: /^Views/ }),
    ).toBeNull();
    expect(
      queryByRole(shadow(element), 'button', { name: 'View path' }),
    ).toBeNull();
  });

  it('draws the path once the views’ module loads', async () => {
    let release = () => {};

    const { element } = await mailMap(1280, 'mail.list', [], (panel) => {
      const load = panel._importViews;

      panel._importViews = () =>
        new Promise((resolve) => {
          release = () => resolve(load());
        });
    });

    await element.updateComplete;
    expect(toggle(element).ariaPressed).toBe('true');
    expect(toggle(element).hasAttribute('disabled')).toBe(false);
    expect(
      queryByRole(shadow(element), 'toolbar', { name: /^Views/ }),
    ).toBeNull();

    release();
    await pathOf(element);
    expect(toggle(element).ariaPressed).toBe('true');
  });

  it('says the views did not load when their module fails', async () => {
    const { element } = await mailMap(1280, 'mail.list', [], (panel) => {
      panel._importViews = () => Promise.reject(new Error('chunk failed'));
    });

    await waitFor(() =>
      expect(toggle(element).title).toBe(
        'The Views did not load. Switch views to retry.',
      ),
    );
    expect(toggle(element).hasAttribute('disabled')).toBe(true);
    expect(toggle(element).ariaPressed).toBe('false');
  });

  it('loads the views again when the path is turned on after the Views tab failed to load them', async () => {
    let attempts = 0;

    const { element } = await mailMap(1280, 'mail.list', [], (panel) => {
      panel._mapViews = false;
      panel._importViews = () => {
        attempts += 1;

        return Promise.reject(new Error('chunk failed'));
      };
    });

    getByRole(shadow(element), 'button', { name: 'views' }).click();
    await waitFor(() => expect(panelOf(element)._viewsFailed).toBe(true));
    getByRole(shadow(element), 'button', { name: 'map' }).click();
    await element.updateComplete;
    expect(attempts).toBe(1);
    expect(toggle(element).hasAttribute('disabled')).toBe(false);

    toggle(element).click();
    await waitFor(() => expect(attempts).toBe(2));
    await waitFor(() =>
      expect(toggle(element).title).toBe(
        'The Views did not load. Switch views to retry.',
      ),
    );
  });

  it('keeps a view selected from the path for the Views tab’s own details', async () => {
    const { element } = await mailMap();
    const panel = panelOf(element);
    const path = await pathOf(element);

    item(path, /^list view/).click();
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: 'views' }).click();
    await element.updateComplete;

    expect(panel._inspect).toBe('none');
    expect(getByRole(shadow(element), 'region', { name: 'list' })).toBeTruthy();
  });
});

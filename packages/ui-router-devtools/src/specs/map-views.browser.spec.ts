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

import { stressStates } from '../../demo/stress.ts';
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

class SplitMail extends LitElement {
  render() {
    return html`<ui-view name="list"></ui-view
      ><ui-view name="content"></ui-view>`;
  }
}

customElements.define('split-mail', SplitMail);

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
  { name: 'mail', url: '/mail', component: SplitMail },
  {
    name: 'mail.list',
    url: '/list',
    views: { list: () => html`<p>messages</p>` },
  },
  { name: 'home', url: '/home', component: () => html`<p>home</p>` },
];

const NUMBERS = ['one', 'two', 'three', 'four', 'five', 'six'];

// Long-named top-level states and empty views beside the root one, so the two drawings need a wide dock.
const WIDE_STATES: LitStateDeclaration[] = NUMBERS.map((n) => ({
  name: `settings-and-preferences-${n}`,
  url: `/${n}`,
  component: () => html`<p>${n}</p>`,
}));

const SIDEBARS = NUMBERS.slice(0, 4).map((n) => `sidebar-navigation-${n}`);

// More long-named states, so the maximised panel cannot enlarge the states past the dock's rung.
const WIDER_STATES: StateDeclaration[] = NUMBERS.map((n) => ({
  name: `archive-and-retention-policies-${n}`,
  url: `/archive-${n}`,
}));

/** The panel open on the Map over a small mail app, or a wide one, at a viewport this wide. */
const mailMap = async (
  width = 1280,
  wide = false,
  extra: readonly StateDeclaration[] = [],
  height = 800,
  prepare: (panel: DevtoolsPanel) => void = () => {},
) => {
  await page.viewport(width, height);

  const router = new UIRouterLit();
  routers.push(router);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});

  for (const state of [...STATES, ...(wide ? WIDE_STATES : []), ...extra])
    router.stateRegistry.register(state);

  const host = document.createElement('main');
  document.body.append(host);
  render(
    html`<ui-view .uiRouter=${router}></ui-view>${(wide ? SIDEBARS : []).map(
        (name) => html`<ui-view name=${name} .uiRouter=${router}></ui-view>`,
      )}`,
    host,
  );

  const { element } = router.plugin(DevtoolsPlugin, {
    viewLocator: litViewLocator,
  });

  prepare(panelOf(element));

  await router.stateService.go('mail.list');
  await element.updateComplete;
  getByRole(shadow(element), 'button', { name: /Router/ }).click();
  await element.updateComplete;
  getByRole(shadow(element), 'button', { name: 'map' }).click();
  await waitFor(() =>
    getByRole(shadow(element), 'tree', { name: 'State map' }),
  );

  return { router, element };
};

// SAFETY: the views' module is what weighs the split, so once it is in and drawn the split is decided
const settled = async (element: UIRouterDevtools) => {
  await waitFor(() => expect(panelOf(element)._viewMap).toBeDefined());
  await element.updateComplete;
};

/** Both trees of the split, once it shows. */
const split = (element: UIRouterDevtools) =>
  waitFor(() => ({
    states: getByRole(shadow(element), 'tree', { name: 'State map' }),
    views: getByRole(shadow(element), 'tree', { name: 'Views' }),
  }));

// The Map's room is measured by a ResizeObserver, whose entry waits on the next rendering update after a resize.
const resize = async (
  element: UIRouterDevtools,
  width: number,
  height = 800,
) => {
  const panel = panelOf(element);
  const was = panel._mapSize.width;

  await page.viewport(width, height);
  await waitFor(() => expect(panel._mapSize.width).not.toBe(was));
  await element.updateComplete;
};

// What the shown split leaves past both drawings at its rung: the popover's column it keeps, and twice the states' room
// past their narrowest, less the shared 48px.
const extraOf = (panel: DevtoolsPanel) => {
  const { split: rooms } = panel._mapLayout()!;
  const whole = panel._map!.layoutNested(panel);

  const narrowest = panel._map!.narrowest(
    panel,
    whole,
    rooms!.states.height,
    rooms!.rung,
  );

  return rooms!.views.reserve + 2 * (rooms!.states.width - narrowest) - 48;
};

// The rung the states are drawn at beside the views, once the split shows.
const rungOf = async (element: UIRouterDevtools) => {
  await split(element);

  return panelOf(element)._mapLayout()?.split?.rung;
};

// Two frames: the ResizeObserver's, and the one after it.
const frames = () =>
  new Promise((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setTimeout(resolve)),
    ),
  );

const noSplit = async (element: UIRouterDevtools) => {
  await settled(element);
  expect(queryByRole(shadow(element), 'tree', { name: 'Views' })).toBeNull();
  expect(queryByRole(shadow(element), 'region', { name: 'Views' })).toBeNull();
};

const press = (element: UIRouterDevtools, key: string) =>
  element.shadowRoot?.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true }),
  );

const boxOf = (item: HTMLElement) => item.closest<HTMLElement>('.box');

const head = (tree: HTMLElement, name: RegExp | string) =>
  getByRole(tree, 'treeitem', { name });

// Where every box of both drawings is, so a selection can be shown to move none of them.
const places = (element: UIRouterDevtools) =>
  getAllByRole(shadow(element), 'treeitem').map((item) =>
    JSON.stringify(boxOf(item)?.getBoundingClientRect().toJSON()),
  );

const toggle = (element: UIRouterDevtools) =>
  getByRole(shadow(element), 'button', { name: 'View map' });

const inspector = (element: UIRouterDevtools) =>
  getByRole(shadow(element), 'region', { name: /Inspector/ });

// The drawing's distance from the start and the end of the room it is centred in.
const margins = (drawn: Element, room: DOMRect, reserve = 0) => {
  const rect = drawn.getBoundingClientRect();

  return [rect.left - room.left, room.right - reserve - rect.right];
};

describe('the view map beside the Map', () => {
  it('shows in a wide dock and maximised, each side in its own labelled region', async () => {
    const { element } = await mailMap();
    const { states, views } = await split(element);

    expect(
      getByRole(shadow(element), 'region', { name: 'States' }).contains(states),
    ).toBe(true);
    expect(
      getByRole(shadow(element), 'region', { name: 'Views' }).contains(views),
    ).toBe(true);
    expect(
      getAllByRole(views, 'treeitem').map((item) => item.ariaLabel),
    ).toEqual([
      '$default view, filled by mail',
      'list view, filled by mail.list',
      'content view, empty',
    ]);

    // The views sit after the states, clear of the popover's column at the dock's end.
    // SAFETY: the trees are drawn inside the Map's room
    const room = states.closest<HTMLElement>('.map-scroll')!;

    expect(views.getBoundingClientRect().left).toBeGreaterThan(
      states.getBoundingClientRect().right,
    );
    expect(views.getBoundingClientRect().right).toBeLessThanOrEqual(
      room.getBoundingClientRect().right - 320,
    );

    getByRole(shadow(element), 'button', { name: 'Maximise devtools' }).click();
    await waitFor(() =>
      expect(panelOf(element)._mapLayout()?.nested.rung).toBe('large'),
    );
    await split(element);
  });

  it('leaves the Map to the states in a narrow dock, a side sheet, and the node-link tree', async () => {
    const { element } = await mailMap(1000, true, WIDER_STATES);

    await noSplit(element);

    await resize(element, 1600);
    await split(element);

    await resize(element, 800);
    await noSplit(element);
    expect(
      queryByRole(shadow(element), 'button', { name: 'View map' }),
    ).toBeNull();

    await resize(element, 1600);
    await split(element);
    getByRole(shadow(element), 'button', { name: 'Tree' }).click();
    await noSplit(element);
  });

  it('holds a split first weighed without room to the same margin when the dock widens', async () => {
    const probe = await mailMap(1400, true, WIDER_STATES);

    expect(await rungOf(probe.element)).toBe('small');

    const extra = extraOf(panelOf(probe.element));

    routers.splice(routers.indexOf(probe.router), 1);
    probe.router.dispose();
    document.body.replaceChildren();

    // A new panel whose first weigh leaves no room even at the floor, widened to less than a tenth of the room spare.
    const { element } = await mailMap(1400 - extra - 8, true, WIDER_STATES);

    await noSplit(element);
    await resize(element, 1400 - extra + 8);
    await noSplit(element);
    await resize(element, 1400);
    expect(await rungOf(element)).toBe('small');
  });

  it('takes a milder rung back after a resize only with room to spare', async () => {
    const { element } = await mailMap(1700, true, WIDER_STATES);
    const panel = panelOf(element);

    expect(await rungOf(element)).toBe('expanded');

    const extra = extraOf(panel);

    const dock = async (width: number) => {
      await resize(element, width);
      expect(panel._mapSize.width).toBe(width - 50);
    };

    expect(extra).toBeGreaterThan(170);

    // Just short of room the states step down, and just past it they stay down until a tenth of the room is spare.
    await dock(1700 - extra - 8);
    expect(await rungOf(element)).toBe('small');
    await dock(1700 - extra + 8);
    expect(await rungOf(element)).toBe('small');
    await dock(1700);
    expect(await rungOf(element)).toBe('expanded');

    // Back up, they stay until there is no room at all.
    await dock(1700 - extra + 8);
    expect(await rungOf(element)).toBe('expanded');
  });

  it('steps the states down to the Map’s floor before it hides the views', async () => {
    const { element } = await mailMap(1200, true, WIDER_STATES);
    const panel = panelOf(element);

    expect(await rungOf(element)).toBe('small');

    // The whole room still draws the states at their natural size; beside the views they are drawn at the floor.
    expect(panel._map!.layoutNested(panel).rung).toBe('expanded');
    expect(panel._mapLayout()?.nested.rung).toBe('small');

    const { states, views } = await split(element);

    expect(views.getBoundingClientRect().left).toBeGreaterThan(
      states.getBoundingClientRect().right,
    );
  });

  it('gives up the popover’s column before a rung, and moves nothing for a view selected under it', async () => {
    const { element } = await mailMap(1600, true, WIDER_STATES);
    const panel = panelOf(element);

    expect(await rungOf(element)).toBe('expanded');

    const reserve = panel._mapLayout()!.split!.views.reserve;

    expect(reserve).toBeGreaterThan(0);
    expect(reserve).toBeLessThan(320);

    const { views } = await split(element);
    const before = places(element);
    const chosen = head(views, /^sidebar-navigation-four view/);

    chosen.click();

    const popover = await waitFor(() => {
      const found = inspector(element);

      expect(found.getBoundingClientRect().width).toBeGreaterThan(0);

      return found;
    });

    expect(places(element)).toEqual(before);

    // Without a column of its own the popover stands beside the selected view, not over it.
    const over = popover.getBoundingClientRect();
    const under = chosen.getBoundingClientRect();

    expect(
      over.right <= under.left ||
        over.left >= under.right ||
        over.bottom <= under.top ||
        over.top >= under.bottom,
    ).toBe(true);
  });

  it('hides and shows with its toggle, which the viewer’s next panel remembers', async () => {
    const { element } = await mailMap();

    await split(element);
    expect(toggle(element).ariaPressed).toBe('true');

    toggle(element).click();
    await noSplit(element);
    expect(toggle(element).ariaPressed).toBe('false');
    expect(nextPanel()._mapViews).toBe(false);

    toggle(element).click();
    await split(element);
    expect(nextPanel()._mapViews).toBe(true);
  });

  it('keeps the states at the rung the whole room gives them, each drawing centred in its own room', async () => {
    const { element } = await mailMap();
    const panel = panelOf(element);

    await split(element);

    const beside = panel._mapLayout()!;

    toggle(element).click();
    await noSplit(element);

    const alone = panel._mapLayout()!;

    expect(beside.split).not.toBeNull();
    expect(alone.split).toBeNull();
    expect(beside.nested.rung).toBe(alone.nested.rung);
    expect(beside.nested.metrics).toBe(alone.nested.metrics);

    toggle(element).click();

    const { states, views } = await split(element);

    const [start, end] = margins(
      states,
      getByRole(shadow(element), 'region', {
        name: 'States',
      }).getBoundingClientRect(),
    );

    expect(Math.abs(start - end)).toBeLessThanOrEqual(1);

    // The views are centred in theirs, less the popover's column.
    const [left, right] = margins(
      views,
      getByRole(shadow(element), 'region', {
        name: 'Views',
      }).getBoundingClientRect(),
      320,
    );

    expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
  });

  it('marks the views a selected state fills, and moves nothing', async () => {
    const { element } = await mailMap();
    const { states, views } = await split(element);
    const before = places(element);

    head(states, 'list').click();
    await element.updateComplete;

    expect(boxOf(head(views, /^list view/))?.classList).toContain('linked');
    expect(boxOf(head(views, /^\$default view/))?.classList).not.toContain(
      'linked',
    );
    expect(boxOf(head(views, /^content view/))?.classList).not.toContain(
      'linked',
    );
    expect(places(element)).toEqual(before);
  });

  it('shows a selected view in the panel’s inspector, marks its states and drops the state selection', async () => {
    const { element } = await mailMap();
    const { states, views } = await split(element);
    const before = places(element);

    head(states, 'home').click();
    await element.updateComplete;
    expect(head(states, 'home').ariaSelected).toBe('true');

    head(views, /^list view/).click();
    await element.updateComplete;

    expect(within(inspector(element)).getByText('list@mail')).toBeTruthy();
    expect(within(inspector(element)).getByText('$default.list')).toBeTruthy();
    expect(head(states, 'home').ariaSelected).toBe('false');
    expect(head(views, /^list view/).ariaSelected).toBe('true');

    // The state that fills it and the one whose content created it.
    expect(boxOf(head(states, 'list'))?.classList).toContain('linked');
    expect(boxOf(head(states, 'mail'))?.classList).toContain('linked');
    expect(head(states, 'list').getAttribute('aria-description')).toMatch(
      /fills the selected view$/,
    );
    expect(head(states, 'mail').getAttribute('aria-description')).toMatch(
      /created the selected view$/,
    );
    expect(boxOf(head(states, 'home'))?.classList).not.toContain('linked');
    expect(places(element)).toEqual(before);

    // The page outlines the selected view, as the Views tab does.
    await waitFor(() =>
      expect(overlay()?.dataset.uiRouterDevtoolsView).toBe('$default.list'),
    );

    // Selecting a state takes the view's place.
    head(states, 'home').click();
    await element.updateComplete;
    expect(head(views, /^list view/).ariaSelected).toBe('false');
    expect(boxOf(head(states, 'list'))?.classList).not.toContain('linked');
    await waitFor(() => expect(overlay()).toBeNull());
  });

  it('clears a view selection every way a selection clears', async () => {
    const { element, router } = await mailMap();
    const { states, views } = await split(element);
    const panel = panelOf(element);

    const select = async () => {
      head(views, /^list view/).click();
      await element.updateComplete;
      expect(panel._inspect).toBe('view');
    };

    // Clicking it again.
    await select();
    head(views, /^list view/).click();
    await element.updateComplete;
    expect(panel._inspect).toBe('none');

    // Escape in either tree.
    await select();
    head(views, /^list view/).focus();
    press(element, 'Escape');
    await element.updateComplete;
    expect(panel._inspect).toBe('none');

    await select();
    head(states, 'mail').focus();
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
    expect(head(states, 'list').ariaSelected).toBe('true');
    expect(head(views, /^list view/).ariaSelected).toBe('false');

    // A view that leaves the snapshot.
    await select();
    await router.stateService.go('home');
    await waitFor(() => expect(panel._inspect).toBe('none'));
  });

  it('returns focus from the inspector to the selected view when Escape clears it', async () => {
    const { element } = await mailMap();
    const { views } = await split(element);

    head(views, /^list view/).click();
    await element.updateComplete;
    within(inspector(element))
      .getByRole('button', { name: 'mail.list' })
      .focus();
    press(element, 'Escape');

    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(head(views, /^list view/)),
    );
    expect(panelOf(element)._inspect).toBe('none');
  });

  it('keeps the arrow keys in one tree, and outlines the view under the pointer', async () => {
    const { element } = await mailMap();
    const { states, views } = await split(element);

    head(views, /^\$default view/).focus();
    press(element, 'ArrowDown');
    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(head(views, /^list view/)),
    );

    // Each tree is one tab stop.
    expect(
      getAllByRole(states, 'treeitem').filter((item) => item.tabIndex === 0),
    ).toHaveLength(1);
    expect(
      getAllByRole(views, 'treeitem').filter((item) => item.tabIndex === 0),
    ).toHaveLength(1);

    const root = head(views, /^\$default view/);

    root.dispatchEvent(new PointerEvent('pointerenter'));
    expect(overlay()?.dataset.uiRouterDevtoolsView).toBe('$default');
    root.dispatchEvent(new PointerEvent('pointerleave'));
    expect(overlay()).toBeNull();
  });

  it('keeps focus in the Views tree when a transition removes the focused view', async () => {
    const { element, router } = await mailMap();
    const { views } = await split(element);

    head(views, /^list view/).focus();
    await router.stateService.go('home');

    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(
        head(views, /^\$default view, filled by home/),
      ),
    );
  });

  it('places the popover in its own column for a selected view', async () => {
    const { element } = await mailMap();
    const { views } = await split(element);

    head(views, /^list view/).click();

    const popover = await waitFor(() => {
      const found = inspector(element);

      expect(found.getBoundingClientRect().width).toBeGreaterThan(0);

      return found;
    });

    expect(popover.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      views.getBoundingClientRect().right,
    );
  });

  it('marks a state hidden in a collapsed compound on the box that holds it', async () => {
    const { element } = await mailMap();
    const { states, views } = await split(element);

    getByRole(states, 'button', { name: 'Collapse mail' }).click();
    await element.updateComplete;
    head(views, /^list view/).click();
    await element.updateComplete;

    expect(boxOf(head(states, /^mail/))?.classList).toContain('linked');
  });

  it('marks only the state that created an empty view', async () => {
    const { element } = await mailMap();
    const { states, views } = await split(element);

    head(views, /^content view/).click();
    await element.updateComplete;

    expect(boxOf(head(states, 'mail'))?.classList).toContain('linked');
    expect(boxOf(head(states, 'list'))?.classList).not.toContain('linked');
    expect(within(inspector(element)).getByText('nothing; empty')).toBeTruthy();
  });

  it('shows the views beside the Map when storage is blocked, and still toggles', async () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);

    try {
      const { element } = await mailMap();

      await split(element);
      toggle(element).click();
      await noSplit(element);
      expect(toggle(element).ariaPressed).toBe('false');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('shows states only for a session that holds no views', async () => {
    const { element } = await mailMap();
    const panel = panelOf(element);
    const session = panel.session()!;

    await split(element);
    panel.importSession({
      ...session,
      events: session.events.filter((event) => event.type !== 'views'),
    });

    await noSplit(element);
    expect(
      queryByRole(shadow(element), 'button', { name: 'View map' }),
    ).toBeNull();

    // Nor for one that holds nothing at all.
    panel.importSession({ ...session, events: [] });
    await noSplit(element);
  });

  it('maximises the panel from its toggle where the dock has no room, and claims nothing pressed', async () => {
    const { element } = await mailMap(1000, true, WIDER_STATES);
    const panel = panelOf(element);

    await noSplit(element);
    expect(toggle(element).ariaPressed).toBe('false');
    expect(toggle(element).hasAttribute('disabled')).toBe(false);
    expect(toggle(element).title).toBe(
      'Maximise the panel to draw the view map beside the states',
    );

    toggle(element).click();
    await split(element);
    expect(panel._max).toBe(true);
    expect(toggle(element).ariaPressed).toBe('true');
    expect(toggle(element).title).toBe('Hide the view map beside the states');

    // Turned off, it stays enabled, so the views can be asked for again.
    toggle(element).click();
    await noSplit(element);
    expect(toggle(element).ariaPressed).toBe('false');
    expect(toggle(element).hasAttribute('disabled')).toBe(false);
    expect(toggle(element).title).toBe('Show the view map beside the states');
  });

  it('maximises the panel when the views are turned on in a dock with no room', async () => {
    const { element } = await mailMap(1400, true, WIDER_STATES);
    const panel = panelOf(element);

    await split(element);
    toggle(element).click();
    await noSplit(element);
    await resize(element, 1000);
    expect(toggle(element).title).toBe('Show the view map beside the states');
    expect(panel._max).toBe(false);

    toggle(element).click();
    await split(element);
    expect(panel._max).toBe(true);
    expect(panel._mapViews).toBe(true);
  });

  it('fits a zoomed Map from its toggle', async () => {
    const { element } = await mailMap(1600, true);
    const panel = panelOf(element);

    await split(element);
    getByRole(shadow(element), 'button', { name: 'Zoom in' }).click();
    await noSplit(element);
    expect(toggle(element).hasAttribute('disabled')).toBe(false);
    expect(toggle(element).ariaPressed).toBe('false');
    expect(toggle(element).title).toBe(
      'Fit the Map to draw the view map beside the states',
    );

    toggle(element).click();
    await split(element);
    expect(panel._mapZoom).toBeNull();
    expect(panel._max).toBe(false);
  });

  it('says the states pan, once maximised, when that keeps the views away', async () => {
    const { element } = await mailMap(900, false, stressStates());
    const panel = panelOf(element);

    // Every compound opened by hand, so no rung can close one to fit.
    panel._mapOpen = new Map(stressStates().map(({ name }) => [name!, true]));
    await noSplit(element);
    expect(panel._nested()?.rung).toBe('pan');
    expect(toggle(element).title).toMatch(/^Maximise/);

    toggle(element).click();
    await waitFor(() => expect(toggle(element).title).toMatch(/states pan/));
    expect(panel._max).toBe(true);
    expect(panel._nested()?.rung).toBe('pan');
    expect(toggle(element).hasAttribute('disabled')).toBe(true);
    expect(toggle(element).ariaPressed).toBe('false');
  });

  const leaves = [
    ['the toggle', (element: UIRouterDevtools) => toggle(element).click()],
    [
      'a zoom',
      (element: UIRouterDevtools) =>
        getByRole(shadow(element), 'button', { name: 'Zoom in' }).click(),
    ],
    [
      'the node-link tree',
      (element: UIRouterDevtools) =>
        getByRole(shadow(element), 'button', { name: 'Tree' }).click(),
    ],
    [
      'a resize with no room left',
      (element: UIRouterDevtools) => resize(element, 900),
    ],
    [
      'the Outline',
      (element: UIRouterDevtools) =>
        getByRole(shadow(element), 'button', { name: 'outline' }).click(),
    ],
  ] as const;

  it.each(leaves)(
    'drops a view selected beside the Map when %s takes the split away',
    async (_, leave) => {
      const { element } = await mailMap(1600, true);
      const panel = panelOf(element);
      const { views } = await split(element);

      head(views, /^list view/).click();
      await waitFor(() =>
        expect(overlay()?.dataset.uiRouterDevtoolsView).toBe('$default.list'),
      );

      await leave(element);
      await element.updateComplete;
      await waitFor(() => expect(panel._inspect).toBe('none'));
      expect(panel._viewSelected).toBeNull();
      expect(overlay()).toBeNull();
    },
  );

  it('holds a resize after a mode change that keeps the Map pane’s size to the same margin', async () => {
    // At this viewport the dock's Map pane and the maximised one measure the same, so no ResizeObserver entry follows.
    const { element } = await mailMap(1800, true, WIDER_STATES, 521);
    const panel = panelOf(element);

    const switchMode = async () => {
      getByRole(shadow(element), 'button', {
        name: /^(Maximise devtools|Restore the dock)$/,
      }).click();
      await element.updateComplete;
      await frames();
    };

    await switchMode();
    expect(await rungOf(element)).toBe('expanded');

    const extra = extraOf(panel);

    await switchMode();
    await resize(element, 1800 - extra - 8, 521);

    const size = { ...panel._mapSize };

    await switchMode();
    expect(await rungOf(element)).toBe('small');
    expect(panel._mapSize).toEqual(size);

    // Widened to less than a tenth of the room spare, as any resize that took a rung away.
    await resize(element, 1800 - extra + 8, 521);
    expect(await rungOf(element)).toBe('small');
  });

  it('weighs the popover’s column afresh for the dock and the maximised panel, though their Map panes are one size', async () => {
    // At this viewport the dock's Map pane and the maximised one measure the same; only the popover's column differs.
    const { element } = await mailMap(1800, true, WIDER_STATES, 521);
    const panel = panelOf(element);

    const maximise = () =>
      getByRole(shadow(element), 'button', {
        name: 'Maximise devtools',
      }).click();

    const rung = await rungOf(element);
    const dock = { ...panel._mapSize };
    const reserve = panel._mapLayout()!.split!.views.reserve;

    expect(reserve).toBeGreaterThan(0);
    expect(reserve).toBeLessThan(320);

    maximise();

    await waitFor(() =>
      expect(panel._mapLayout()?.split?.views.reserve).toBe(0),
    );
    expect(panel._mapSize).toEqual(dock);
    expect(await rungOf(element)).toBe(rung);

    maximise();
    await waitFor(() =>
      expect(panel._mapLayout()?.split?.views.reserve).toBe(reserve),
    );
    expect(panel._mapSize).toEqual(dock);
    expect(await rungOf(element)).toBe(rung);
  });

  it('weighs a maximised split by the maximised room once it is measured, not by the dock’s', async () => {
    const { element } = await mailMap(2400, true);
    const panel = panelOf(element);

    // The Map's room is measured for the new mode only after its first render in it.
    const switchMode = async () => {
      const was = { ...panel._mapSize };

      getByRole(shadow(element), 'button', {
        name: /^(Maximise devtools|Restore the dock)$/,
      }).click();
      await waitFor(() => expect(panel._mapSize).not.toEqual(was));
      await element.updateComplete;
    };

    await switchMode();
    await split(element);

    const { split: rooms } = panel._mapLayout()!;
    const whole = panel._map!.layoutNested(panel);
    const narrowest = panel._map!.narrowest(panel, whole, rooms!.states.height);
    const spare = 2 * (rooms!.states.width - narrowest) - 48;

    // Narrowed so the maximised split fits with far less than a tenth of the room spare, and the dock's shorter room
    // would leave it none.
    await switchMode();
    await resize(element, 2400 - spare + 8);
    await switchMode();
    await split(element);
  });

  it('offers no view map for a session whose views snapshot holds no view', async () => {
    const { element } = await mailMap();
    const panel = panelOf(element);
    const session = panel.session()!;

    await split(element);
    panel.importSession({
      ...session,
      events: session.events.map((event) =>
        event.type === 'views' ? { ...event, views: [], unmatched: [] } : event,
      ),
    });

    await noSplit(element);
    expect(panel._model.views?.views).toEqual([]);
    expect(
      queryByRole(shadow(element), 'button', { name: 'View map' }),
    ).toBeNull();
  });

  it('names no cause while the views’ module is still loading', async () => {
    let release = () => {};

    const { element } = await mailMap(1280, false, [], 800, (panel) => {
      const load = panel._importViews;

      panel._importViews = () =>
        new Promise((resolve) => {
          release = () => resolve(load());
        });
    });

    await element.updateComplete;
    expect(toggle(element).hasAttribute('disabled')).toBe(true);
    expect(toggle(element).ariaPressed).toBe('false');
    expect(toggle(element).hasAttribute('title')).toBe(false);

    release();
    await split(element);
    expect(toggle(element).title).toBe('Hide the view map beside the states');
  });

  it('says the views did not load when their module fails', async () => {
    const { element } = await mailMap(1280, false, [], 800, (panel) => {
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

  it('keeps a view selected beside the Map for the Views tab’s own details', async () => {
    const { element } = await mailMap();
    const panel = panelOf(element);
    const { views } = await split(element);

    head(views, /^list view/).click();
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: 'views' }).click();
    await element.updateComplete;

    expect(panel._inspect).toBe('none');
    expect(getByRole(shadow(element), 'region', { name: 'list' })).toBeTruthy();
  });
});

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
import { memoryLocationPlugin } from '@uirouter/core';
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

/** The panel open on the Map over a small mail app, or a wide one, at a viewport this wide. */
const mailMap = async (width = 1280, wide = false) => {
  await page.viewport(width, 800);

  const router = new UIRouterLit();
  routers.push(router);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});

  for (const state of [...STATES, ...(wide ? WIDE_STATES : [])])
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
const split = async (element: UIRouterDevtools) => {
  const views = await waitFor(() =>
    getByRole(shadow(element), 'tree', { name: 'Views' }),
  );

  return {
    states: getByRole(shadow(element), 'tree', { name: 'State map' }),
    views,
  };
};

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
    const room = states.closest('.map-scroll') as HTMLElement;

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
    const { element } = await mailMap(1200, true);

    await noSplit(element);

    await page.viewport(1600, 800);
    await split(element);

    await page.viewport(800, 800);
    await waitFor(() =>
      expect(
        queryByRole(shadow(element), 'tree', { name: 'Views' }),
      ).toBeNull(),
    );
    expect(
      queryByRole(shadow(element), 'button', { name: 'View map' }),
    ).toBeNull();

    await page.viewport(1600, 800);
    await split(element);
    getByRole(shadow(element), 'button', { name: 'Tree' }).click();
    await noSplit(element);
  });

  it('comes back after a resize only with room to spare', async () => {
    const { element } = await mailMap(1600, true);
    const panel = panelOf(element);

    await split(element);

    // The room the states have past their narrowest is half of what both spare, and half the gap between them.
    const { split: rooms } = panel._mapLayout()!;
    const whole = panel._map!.layoutNested(panel);
    const narrowest = panel._map!.narrowest(panel, whole, rooms!.states.height);
    const spare = 2 * (rooms!.states.width - narrowest) - 48;

    const resize = async (width: number) => {
      await page.viewport(width, 800);
      await waitFor(() => expect(panel._mapSize.width).toBe(width - 50));
    };

    expect(spare).toBeGreaterThan(160);

    // Just short of room for both the views go, and just past it they stay away until a tenth of the room is spare.
    await resize(1600 - spare - 8);
    await noSplit(element);
    await resize(1600 - spare + 8);
    await noSplit(element);
    await resize(1600);
    await split(element);

    // Shown, they stay until there is no room at all.
    await resize(1600 - spare + 8);
    await split(element);
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
});

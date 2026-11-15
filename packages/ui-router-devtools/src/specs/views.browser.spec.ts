import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import {
  getAllByRole,
  getByRole,
  getByText,
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

// A routed element with a shadow root, so a nested view is found across it.
class TestMail extends LitElement {
  render() {
    return html`<ui-view name="list"></ui-view
      ><ui-view name="content"></ui-view>`;
  }
}

customElements.define('test-mail', TestMail);

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

interface MailApp {
  locate?: boolean;
  /** Names of empty views drawn beside the root view. */
  asides?: readonly string[];
  width?: number;
}

const mailApp = async ({
  locate = true,
  asides = [],
  width = 1280,
}: MailApp = {}) => {
  await page.viewport(width, 800);

  const router = new UIRouterLit();
  routers.push(router);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});

  const states: LitStateDeclaration[] = [
    {
      name: 'mail',
      url: '/mail',
      views: {
        $default: TestMail,
        // No `<ui-view name="side">` exists at the root, so no view takes it.
        side: () => html`<p>side</p>`,
      },
    },
    {
      name: 'mail.list',
      url: '/list',
      views: { list: () => html`<p>messages</p>` },
    },
    { name: 'home', url: '/home', component: () => html`<p>home</p>` },
  ];

  for (const state of states) router.stateRegistry.register(state);

  const host = document.createElement('main');
  document.body.append(host);
  render(
    html`<ui-view .uiRouter=${router}></ui-view>${asides.map(
        (name) => html`<ui-view name=${name} .uiRouter=${router}></ui-view>`,
      )}`,
    host,
  );

  const { element } = router.plugin(DevtoolsPlugin, {
    ...(locate && { viewLocator: litViewLocator }),
  });

  await router.stateService.go('mail.list');
  await element.updateComplete;
  getByRole(shadow(element), 'button', { name: /Router/ }).click();
  await element.updateComplete;
  getByRole(shadow(element), 'button', { name: 'views' }).click();

  const tree = await waitFor(() =>
    getByRole(shadow(element), 'tree', { name: /Views/ }),
  );

  return { router, element, tree };
};

const press = (element: UIRouterDevtools, key: string) =>
  element.shadowRoot?.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true }),
  );

describe('the Views', () => {
  it('draws each ui-view inside the view that holds it, named with what fills it', async () => {
    const { element, tree } = await mailApp();

    const items = await waitFor(() => {
      const found = getAllByRole(tree, 'treeitem');

      expect(found).toHaveLength(3);

      return found;
    });

    expect(
      items.map((item) => [
        item.getAttribute('aria-label'),
        item.getAttribute('aria-level'),
      ]),
    ).toEqual([
      ['$default view, filled by mail', '1'],
      ['list view, filled by mail.list', '2'],
      ['content view, empty', '2'],
    ]);
    expect(within(items[2]).getByText('Empty')).toBeTruthy();

    // The config no view took is listed with the state that declared it.
    const unmatched = getByRole(shadow(element), 'region', {
      name: 'No view took',
    });

    expect(unmatched.textContent).toMatch(/views\.side → side@/);
  });

  it('moves with the tree keys, shows a view’s details, and opens its state in the Outline', async () => {
    const { element, tree } = await mailApp();
    const items = () => getAllByRole(tree, 'treeitem');

    await waitFor(() => expect(items()).toHaveLength(3));
    items()[0]?.focus();
    press(element, 'ArrowRight');
    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(items()[1]),
    );
    press(element, 'End');
    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(items()[2]),
    );
    press(element, 'ArrowUp');
    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(items()[1]),
    );
    press(element, 'ArrowLeft');
    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(items()[0]),
    );
    press(element, 'End');
    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(items()[2]),
    );
    press(element, 'Home');
    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(items()[0]),
    );

    // A key the tree does not use is left to the page.
    const typed = new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    items()[0]?.dispatchEvent(typed);
    expect(typed.defaultPrevented).toBe(false);

    press(element, 'ArrowDown');
    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(items()[1]),
    );
    press(element, 'Enter');

    const details = await waitFor(() =>
      getByRole(shadow(element), 'region', { name: 'list' }),
    );

    expect(within(details).getByText('$default.list')).toBeTruthy();
    expect(within(details).getByText('list@mail')).toBeTruthy();
    expect(
      within(details).getByText('<ui-view name="list"> in <test-mail>'),
    ).toBeTruthy();

    // Selecting outlines the view on the page, and Escape takes the outline away with the details.
    await waitFor(() =>
      expect(overlay()?.dataset.uiRouterDevtoolsView).toBe('$default.list'),
    );
    press(element, 'Escape');
    await waitFor(() => expect(overlay()).toBeNull());
    expect(queryByRole(shadow(element), 'region', { name: 'list' })).toBeNull();

    items()[1]?.click();
    await element.updateComplete;
    within(getByRole(shadow(element), 'region', { name: 'list' }))
      .getByRole('button', { name: 'mail.list' })
      .click();

    const row = await waitFor(() =>
      getByRole(shadow(element), 'treeitem', { name: 'list', selected: true }),
    );

    expect(panelOf(element)._view).toBe('outline');
    expect(element.shadowRoot?.activeElement).toBe(row);
    expect(overlay()).toBeNull();
  });

  it('drops the outline and the details of a selected view that goes away', async () => {
    const { router, element, tree } = await mailApp();

    const list = await waitFor(() =>
      getByRole(tree, 'treeitem', { name: /^list view/ }),
    );

    list.click();
    await waitFor(() =>
      expect(overlay()?.dataset.uiRouterDevtoolsView).toBe('$default.list'),
    );

    // Home replaces the mail element, and the views inside it with it.
    await router.stateService.go('home');
    await waitFor(() =>
      getByRole(shadow(element), 'treeitem', {
        name: '$default view, filled by home',
      }),
    );

    expect(overlay()).toBeNull();
    expect(panelOf(element)._viewSelected).toBeNull();
    expect(queryByRole(shadow(element), 'region', { name: 'list' })).toBeNull();
  });

  it('outlines the view under the pointer, and stops when the panel closes', async () => {
    const { element, tree } = await mailApp();

    const root = await waitFor(() =>
      getByRole(tree, 'treeitem', { name: /^\$default view/ }),
    );

    root.dispatchEvent(new PointerEvent('pointerenter'));
    expect(overlay()?.dataset.uiRouterDevtoolsView).toBe('$default');
    expect(overlay()?.getBoundingClientRect().height).toBeGreaterThan(0);

    // The outline follows its view when the page moves under it.
    const top = overlay()?.getBoundingClientRect().top ?? 0;

    document.querySelector('main')?.style.setProperty('margin-top', '40px');
    window.dispatchEvent(new Event('resize'));
    expect(overlay()?.getBoundingClientRect().top).toBeGreaterThan(top);

    root.dispatchEvent(new PointerEvent('pointerleave'));
    expect(overlay()).toBeNull();

    root.dispatchEvent(new PointerEvent('pointerenter'));
    getByRole(shadow(element), 'button', { name: 'Collapse devtools' }).click();
    expect(overlay()).toBeNull();
  });

  it('draws each top-level view, and gives an empty view’s details', async () => {
    const { element, tree } = await mailApp({ asides: ['aside'] });

    const aside = await waitFor(() =>
      getByRole(tree, 'treeitem', { name: 'aside view, empty' }),
    );

    expect(aside.getAttribute('aria-level')).toBe('1');
    expect(
      getByRole(tree, 'treeitem', { name: /^\$default view/ }).getAttribute(
        'aria-level',
      ),
    ).toBe('1');

    aside.click();

    const details = await waitFor(() =>
      getByRole(shadow(element), 'region', { name: 'aside' }),
    );

    expect(within(details).getByText('nothing; empty')).toBeTruthy();
    expect(within(details).queryByText('Declared')).toBeNull();
    // An empty `<ui-view>` has no box, so the page has nothing to outline.
    expect(
      within(details).getByText('<ui-view name="aside">, not displayed'),
    ).toBeTruthy();
    expect(overlay()).toBeNull();
  });

  const SIDEBARS = ['one', 'two', 'three', 'four', 'five', 'six'].map(
    (n) => `sidebar-navigation-${n}`,
  );

  // The dock puts the details beside the boxes; the side sheet, 360px wide, puts them below.
  it.each([
    ['beside', 1280, SIDEBARS],
    ['below', 700, []],
  ] as const)(
    'packs the boxes into the room left with the details %s them',
    async (where, width, asides) => {
      const { element, tree } = await mailApp({ asides, width });

      getByRole(tree, 'treeitem', { name: /^\$default view/ }).click();

      const details = await waitFor(() =>
        getByRole(shadow(element), 'region', { name: '$default' }),
      );

      // SAFETY: the tree is drawn inside the Views' main area
      const main = tree.closest('.vm-main') as HTMLElement;
      const style = getComputedStyle(main);

      const room = () => ({
        width:
          main.clientWidth -
          parseFloat(style.paddingInlineStart) -
          parseFloat(style.paddingInlineEnd),
        height:
          main.clientHeight -
          parseFloat(style.paddingBlockStart) -
          parseFloat(style.paddingBlockEnd),
      });

      // The packing is made for that room, and the drawing stays inside it.
      await waitFor(() => {
        const packed = panelOf(element)._mapSize;

        expect(Math.abs(packed.width - room().width)).toBeLessThanOrEqual(1);
        expect(Math.abs(packed.height - room().height)).toBeLessThanOrEqual(1);
      });

      const drawn = tree.getBoundingClientRect();

      expect(drawn.width).toBeLessThanOrEqual(room().width);
      expect(drawn.height).toBeLessThanOrEqual(room().height);

      const box = details.getBoundingClientRect();
      const area = main.getBoundingClientRect();

      expect(where === 'beside' ? box.left : box.top).toBeGreaterThanOrEqual(
        where === 'beside' ? area.right : area.bottom,
      );
    },
  );

  it('draws without a locator, and leaves the page alone', async () => {
    const { element, tree } = await mailApp({ locate: false });

    const root = await waitFor(() =>
      getByRole(tree, 'treeitem', { name: /^\$default view/ }),
    );

    root.click();

    const details = await waitFor(() =>
      getByRole(shadow(element), 'region', { name: '$default' }),
    );

    expect(within(details).queryByText('On page')).toBeNull();
    expect(overlay()).toBeNull();
  });

  it('shows an imported session’s views, and says when a session has none', async () => {
    const { element, tree } = await mailApp();
    await waitFor(() => expect(getAllByRole(tree, 'treeitem')).toHaveLength(3));
    const session = element.session({ params: 'all' })!;

    element.importSession(session);
    await element.updateComplete;

    const imported = getByRole(shadow(element), 'tree', { name: /Views/ });
    const root = getByRole(imported, 'treeitem', { name: /^\$default view/ });

    // The page is not the recorded one, so nothing on it is outlined.
    root.dispatchEvent(new PointerEvent('pointerenter'));
    expect(overlay()).toBeNull();

    element.importSession({
      ...session,
      events: session.events.filter((event) => event.type !== 'views'),
    });
    await element.updateComplete;
    expect(
      getByText(shadow(element), 'This session holds no views.'),
    ).toBeTruthy();
  });

  it('says so when the router has no ui-view, and when the Views fail to load', async () => {
    await page.viewport(1280, 800);
    const router = new UIRouterLit();
    routers.push(router);
    router.plugin(memoryLocationPlugin);
    const { element } = router.plugin(DevtoolsPlugin);
    const panel = panelOf(element);
    await element.updateComplete;

    panel._importViews = () => Promise.reject(new Error('chunk failed'));
    getByRole(shadow(element), 'button', { name: /Router/ }).click();
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: 'views' }).click();
    await waitFor(() =>
      getByText(
        shadow(element),
        'The Views did not load. Switch views to retry.',
        {
          selector: '.empty',
        },
      ),
    );

    panel._importViews = () => import('../element/viewmap.ts');
    getByRole(shadow(element), 'button', { name: 'outline' }).click();
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: 'views' }).click();
    await waitFor(() =>
      getByText(shadow(element), 'No ui-view is registered with the router.'),
    );
  });
});

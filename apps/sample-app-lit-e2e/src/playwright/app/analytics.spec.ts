import { expect, syncUrl, test, type LocationPlugin } from './fixtures.ts';

/**
 * The manual page_view budget per location plugin. gtag's enhanced measurement
 * patches history.pushState/replaceState and listens for popstate, so the app
 * must send exactly what those hooks cannot see, and nothing else:
 *
 * - pushState — nothing at all; gtag sees load, pushes and traversals itself.
 * - navigation — `navigation.navigate()` never touches history, so a forward
 *   move is ours. The cold load has no `navigate` event (gtag's own config call
 *   counts it) and a back still fires popstate (gtag counts that too).
 * - hash — history is never touched, so every transition is ours.
 *
 * Counts are cumulative from load, which keeps the assertions free of any
 * mid-test reset that could race a transition's onSuccess.
 *
 * Runs per project, which is the point: this is the guard that the sample
 * apps' Navigation API default cannot silently drop page views.
 */
interface PageViewBudget {
  load: number;
  forward: number;
  back: number;
}

interface PageView {
  page_location?: string;
}

const EXPECTED = {
  // unseeded projects run the app default, which is the Navigation API (#656)
  '': { load: 0, forward: 1, back: 1 },
  hash: { load: 1, forward: 2, back: 3 },
  pushState: { load: 0, forward: 0, back: 0 },
} satisfies Record<LocationPlugin, PageViewBudget>;

declare global {
  interface Window {
    pageViews?: PageView[];
  }
}

const pageViews = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.pageViews ?? []);

test.describe("gtag page_view under the project's location plugin", () => {
  test.beforeEach(async ({ page, visit }) => {
    // before load: ga.js only reports to a gtag the page already has, and the
    // e2e build sets no tracking id, so nothing overwrites this stub.
    await page.addInitScript(() => {
      window.pageViews = [];
      Object.assign(window, {
        gtag: (command: string, name: string, params: PageView) => {
          if (command === 'event' && name === 'page_view')
            window.pageViews!.push(params);
        },
      });
    });
    await visit('/welcome');
    await expect(page.locator('ui-router')).toBeAttached();
  });

  test('counts the cold load and a forward navigation', async ({
    page,
    locationPlugin,
  }) => {
    const expected = EXPECTED[locationPlugin];

    expect(await pageViews(page), 'manual page_views on load').toHaveLength(
      expected.load,
    );
    // the router's own url() push, the same move an in-app link makes
    await syncUrl(page, '/home');
    await expect(page).toHaveURL(/home/);
    expect(
      await pageViews(page),
      'manual page_views after a push',
    ).toHaveLength(expected.forward);
  });

  test('still counts after a back traversal', async ({
    page,
    locationPlugin,
  }) => {
    await syncUrl(page, '/home');
    await expect(page).toHaveURL(/home/);
    await page.goBack();
    await expect(page).toHaveURL(/welcome/);
    expect(
      await pageViews(page),
      'manual page_views after a back',
    ).toHaveLength(EXPECTED[locationPlugin].back);
  });

  test('reports the route it actually landed on, undoubled', async ({
    page,
    locationPlugin,
  }) => {
    await syncUrl(page, '/home');
    await expect(page).toHaveURL(/home/);

    const sent = await pageViews(page);

    // the loop below must cover every manual page_view the project sends
    expect(sent).toHaveLength(EXPECTED[locationPlugin].forward);

    // /app/home, never /app/home/home — location.pathname already carries the
    // route under pushState and the Navigation API.
    for (const { page_location: location } of sent) {
      expect(location, 'page_location').not.toMatch(/\/home\/home$/);
    }
  });
});

import {
  test as base,
  expect,
  type Page,
  type Response,
} from '@playwright/test';

export { expect };

/** The suite-wide location plugin a project seeds; empty runs the app's own resolution. */
export type LocationPlugin = '' | 'hash' | 'pushState';

export type Visit = (
  path: string,
  features?: Record<string, string>,
) => Promise<Response | null>;

interface UIRouterElement extends HTMLElement {
  uiRouter?: {
    urlService: { url: (newUrl: string, replace?: boolean) => void };
  };
}

export const test = base.extend<{
  locationPlugin: LocationPlugin;
  visit: Visit;
  visitRoot: (features?: Record<string, string>) => Promise<Response | null>;
}>({
  locationPlugin: ['', { option: true }],

  // hash routing never rewrites location.search, so a query param would pin the flag as URL-overridden
  page: async ({ page, locationPlugin }, use) => {
    if (locationPlugin) {
      await page.addInitScript((plugin) => {
        // SAFETY: the app's featureFlags.save writes this key as JSON of the flags
        const flags = JSON.parse(
          sessionStorage.getItem('featureFlags') ?? '{}',
        ) as Record<string, string>;

        flags['location-plugin'] = plugin;
        sessionStorage.setItem('featureFlags', JSON.stringify(flags));
      }, locationPlugin);
    }

    await use(page);
  },

  // Hash-mode visits target the bare mount, which serves the shell with no redirect, so consecutive visits differ only by hash.
  visit: async ({ page, locationPlugin, baseURL }, use) => {
    const root = (baseURL ?? '').replace(/\/+$/, '');

    await use((path, features = {}) => {
      const query = featureQuery(features);

      const isHashMode =
        (features['location-plugin'] || locationPlugin) === 'hash';

      const search = query ? `?${query}` : '';

      return page.goto(
        isHashMode ? `${root}${search}#${path}` : `${root}${path}${search}`,
      );
    });
  },

  // the app root with no trailing slash (`/app`, not `/app/`): the entry the docs site links to
  visitRoot: async ({ page, baseURL }, use) => {
    const root = (baseURL ?? '').replace(/\/+$/, '');

    await use((features = {}) => {
      const query = featureQuery(features);

      return page.goto(query ? `${root}?${query}` : root);
    });
  },
});

function featureQuery(features: Record<string, string>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(features)) {
    params.set(`feature-${key}`, value);
  }

  return params.toString();
}

export const EMAIL_ADDRESS = 'myself@angular.dev';

export const readAppConfig = (page: Page) =>
  page.evaluate(() => sessionStorage.getItem('appConfig'));

export const logIn = async (page: Page) => {
  await page.getByLabel('Username').selectOption(EMAIL_ADDRESS);
  await page.getByRole('button', { name: 'Log in' }).click();
};

/** Logs in once per worker, then seeds that appConfig before the app boots in every later test. */
export const authenticate = (): void => {
  let appConfig: string | null = null;

  test.beforeEach(async ({ page, visit }) => {
    if (appConfig !== null) {
      await page.addInitScript((value) => {
        sessionStorage.setItem('appConfig', value);
      }, appConfig);

      return;
    }

    await visit('/login');
    await logIn(page);
    await expect(page).toHaveURL(/\/home/);

    appConfig = await readAppConfig(page);
    expect(appConfig).not.toBeNull();
  });
};

/**
 * Drives a client-side URL change through the running app's router, like an
 * in-app link. Direct loads of unmatched URLs get the static server 404, so
 * the in-router 404 is only reachable this way.
 */
export const syncUrl = async (page: Page, path: string): Promise<void> => {
  await page.waitForFunction(
    () => !!document.querySelector<UIRouterElement>('ui-router')?.uiRouter,
  );
  await page.evaluate((url) => {
    // a push, not url()'s default replace: the hash service's replaceState fires no hashchange
    document
      .querySelector<UIRouterElement>('ui-router')!
      .uiRouter!.urlService.url(url, false);
  }, path);
};

// The backdrop carries no role, and while it exists it swallows clicks.
export const backdrop = (page: Page) => page.locator('#backdrop');

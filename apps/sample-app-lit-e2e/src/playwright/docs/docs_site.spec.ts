import { expect, test, type Page } from '@playwright/test';

// A browser smoke of the deployed docs site. The worker's HTTP contract
// (statuses, redirects, noindex, shell aliasing, 404-page policy) lives in
// www/lit-ui-router.dev/worker/test/worker.test.ts, run against the worker module itself; the
// two request specs kept here assert built-asset/assets-binding behavior
// that has no lower-level home.

// Vue sets __vue_app__ on #app once it mounts, so waiting on it keeps a click from racing hydration.
const hydrated = (page: Page) =>
  page.waitForFunction(
    () =>
      !!document.querySelector('#app') &&
      '__vue_app__' in document.querySelector('#app')!,
  );

declare global {
  interface Window {
    hydrationProbe?: boolean;
    embedMarker?: number;
  }
}

const embed = (page: Page, name: string) =>
  page.getByRole('dialog', { name, exact: true });

// An iframe has no role; its embed dialog is the named handle.
const embedFrame = (page: Page, name: string) =>
  embed(page, name).locator('iframe');

const embedMarker = (page: Page) =>
  embedFrame(page, 'Hello World example').evaluate(
    (frame: HTMLIFrameElement) => frame.contentWindow?.embedMarker,
  );

const solarSystemLink = (page: Page, name: string) =>
  page.getByRole('link', { name });

const backToSolarSystem = (page: Page) =>
  // exact: the duplicate top link, phone-only (display: none here), leads with a chevron
  page.getByRole('link', { name: 'Back to the solar system', exact: true });

// The trail list carries no name, and the planet list beside it is a list too.
const trailStops = (page: Page) => page.locator('.path').getByRole('listitem');

const crumb = (page: Page) =>
  page.getByRole('paragraph').filter({ hasText: /of \d+ visited/ });

test.describe('docs site', () => {
  test('renders the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Lit UI Router/);
    await expect(
      page.getByRole('navigation', { name: 'Main Navigation' }),
    ).toBeVisible();
    // the VitePress mount point has no role
    await expect(page.locator('#app')).not.toBeEmpty();
  });

  test('navigates without a full page load', async ({ page }) => {
    await page.goto('/tutorial/live-examples');
    await hydrated(page);
    await page.evaluate(() => {
      window.hydrationProbe = true;
    });
    // "Guides" lives in the "Docs" nav flyout, which opens on the button's
    // mouse `pointerenter` since VitePress 2.0.0-alpha.20.
    const nav = page.getByRole('navigation', { name: 'Main Navigation' });

    await nav.getByRole('button', { name: 'Docs' }).hover();
    await nav.getByRole('link', { name: 'Guides', exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/guides/');
    // A full reload drops the probe; surviving it proves the client router
    // took the navigation, so the page hydrated.
    expect(await page.evaluate(() => window.hydrationProbe)).toBe(true);
  });

  test('renders the generated api reference', async ({ page }) => {
    await page.goto('/api/');
    await expect(page).toHaveTitle(/^API \| /);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // A typedoc-authored page must list real exports; an empty or stale
    // generation would render the shell without them.
    await page.goto('/api/reference/');
    // Scoped to main: the sidebar also links UIRouterLit, but collapsed.
    await expect(
      page
        .getByRole('main')
        .getByRole('link', { name: 'UIRouterLit', exact: true }),
    ).toBeVisible();
  });

  test('mounts the ExampleEmbed theme component', async ({ page }) => {
    await page.goto('/tutorial/live-examples');
    await expect(embedFrame(page, 'Hello World example')).toHaveAttribute(
      'src',
      '/examples/helloworld/',
    );
    // The iframe, the restart button and its icon are server-rendered; they
    // are still there once Vue has mounted.
    await hydrated(page);

    const restart = embed(page, 'Hello World example').getByRole('button', {
      name: 'Restart',
    });

    // the icon is aria-hidden, so only its class finds it; visible means its CSS shipped
    await expect(restart.locator('.vpi-lucide-rotate-cw')).toBeVisible();
  });

  test('expands an ExampleEmbed in place without reloading its iframe', async ({
    page,
  }) => {
    await page.goto('/tutorial/live-examples');
    await hydrated(page);

    const dialog = embed(page, 'Hello World example');
    const frame = embedFrame(page, 'Hello World example');

    // A marker set in the loaded example survives only if the frame never reloads.
    await frame.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        frame.evaluate((el: HTMLIFrameElement) => [
          el.contentDocument?.readyState,
          el.contentWindow?.location.pathname.startsWith('/examples/'),
        ]),
      )
      .toEqual(['complete', true]);
    await frame.evaluate((el: HTMLIFrameElement) => {
      el.contentWindow!.embedMarker = 42;
    });

    await dialog.getByRole('button', { name: 'Expand' }).click();
    await expect
      .poll(() => dialog.evaluate((el) => el.matches(':modal')))
      .toBe(true);
    expect(await embedMarker(page)).toBe(42);

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toHaveAttribute('open');
    expect(await embedMarker(page)).toBe(42);
  });

  test('serves the embedded example apps same-origin', async ({ request }) => {
    // Built-asset coverage, not worker logic: only embed-unique content
    // proves the asset deployed, not a fallback.
    const response = await request.get('/examples/helloworld/');

    expect(await response.text()).toContain(
      'Hello World - lit-ui-router Tutorial',
    );
  });

  test('mounts the MobX solar system example on the bindings page', async ({
    page,
  }) => {
    await page.goto('/packages/lit-ui-router-mobx');
    // an iframe has no role, and its src is the claim under test
    await expect(
      page.locator('iframe[src="/examples/hellosolarsystem-mobx/"]'),
    ).toBeAttached();
  });

  test('records every stop and derives the visited set from that history', async ({
    page,
  }) => {
    // The trail is written by a plain MobX reaction on the bindings' own
    // RouterStore — no component involved — and `visited` is a computed over
    // it, so revisiting the list does not inflate the count.
    await page.goto('/examples/hellosolarsystem-mobx/');
    await expect(trailStops(page)).toHaveCount(1);

    await solarSystemLink(page, 'Mars').click();
    await backToSolarSystem(page).click();
    await solarSystemLink(page, 'Venus').click();

    await expect(trailStops(page)).toHaveCount(4);
    await expect(crumb(page)).toContainText('2 of 10 visited');
    // the tab title is driven by a reaction with no host to re-render
    await expect(page).toHaveTitle(/Venus/);
  });

  test('rejects a non-integer planet id rather than rounding it', async ({
    page,
  }) => {
    // parseInt('4x') is 4. One strict parser keeps Earth out of the detail
    // view, the breadcrumb and the visited set alike.
    await page.goto('/examples/hellosolarsystem-mobx/#/planets/4x');
    await expect(page.getByText('Body not found')).toBeVisible();
    await expect(crumb(page)).toContainText('0 of 10 visited');
    await expect(crumb(page).getByRole('strong')).toHaveCount(0);
  });

  test('drives the MobX example: reactions keep the un-routed shell in sync', async ({
    page,
  }) => {
    // The embed is same-origin, so the spec drives the example itself. Unlike
    // the sample apps, its components keep their own shadow roots, which
    // Playwright locators pierce.
    await page.goto('/examples/hellosolarsystem-mobx/');
    await expect(crumb(page)).toContainText('0 of 10 visited');
    await solarSystemLink(page, 'Mars').click();
    // <app-root> is outside every <ui-view>, so a transition never re-creates
    // it: the breadcrumb and the counter can only come from the reactions.
    // 'planet' is not a child of 'planets', so the nav stays lit only because
    // the route controller says so.
    await expect(
      page
        .getByRole('navigation', { name: 'Hello Solar System (MobX)' })
        .getByRole('link', { name: 'Planets' }),
    ).toHaveAttribute('data-detail');
    await expect(crumb(page).getByRole('strong')).toHaveText('Mars');
    await backToSolarSystem(page).click();
    await expect(crumb(page)).toContainText('1 of 10 visited');
    // the link, not the trail's <li>, which also lists 'Mars'
    await expect(solarSystemLink(page, 'Mars')).toContainText('visited');
  });

  test('serves a real 404 for unknown urls', async ({ request }) => {
    // Assets-binding behavior (not_found_handling: "404-page"), not worker
    // logic: the worker never runs for paths outside the mounts.
    const response = await request.get('/definitely-missing');

    expect(response.status()).toBe(404);
    // The title proves the vitepress 404 page rendered, not a null body.
    expect(await response.text()).toContain(
      '<title>404 | Lit UI Router</title>',
    );
  });

  test('renders real routes client-side under every aliased exhibit', async ({
    page,
  }) => {
    // Each aliased exhibit serves the one base-agnostic vanilla shell, whose
    // client derives its base from location.pathname at boot and renders the
    // real route — where the shared /app shell used to resolve every foreign
    // prefix to the in-app 404 (e.g. "No state matched the URL
    // /simulated-routing/welcome").
    for (const mount of [
      '/not-found-spa',
      '/simulated-routing',
      '/not-found-naive',
    ]) {
      await page.goto(`${mount}/welcome`);
      await expect(page.getByText('Welcome to the sample app!')).toBeVisible();
      await expect(page).toHaveURL(
        (url) => url.pathname === `${mount}/welcome`,
      );
    }
  });

  test('shows the soft-404: the client renders its 404 view on a naive miss', async ({
    page,
  }) => {
    // The naive rung's whole lesson: the server answers 200 for a path that
    // does not exist (pinned in the worker's node tests), yet the client —
    // correctly based at /not-found-naive/ — resolves it to the in-app 404
    // view. Server and client disagree; that gap IS the anti-pattern.
    await page.goto('/not-found-naive/definitely-not-a-route');
    await expect(
      page.getByRole('heading', { name: '404 Page Not Found' }),
    ).toBeVisible();
  });

  test('boots the in-app 404 state on a direct miss under the shell-404 exhibit', async ({
    page,
  }) => {
    await page.goto('/not-found-spa/definitely-not-a-route');
    await expect(
      page.getByRole('heading', { name: '404 Page Not Found' }),
    ).toBeVisible();
    // The unmatched url stays in the address bar (the 404 state is url-less).
    await expect(page).toHaveURL(
      (url) => url.pathname === '/not-found-spa/definitely-not-a-route',
    );
  });
});

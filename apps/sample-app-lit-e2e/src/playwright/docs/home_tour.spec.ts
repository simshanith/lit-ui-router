import { expect, test, type Page } from '@playwright/test';

// The home page runs the features tour inside the page, on a fragment it shares with the page's anchors:
// `#see-it-run` is the section, `#see-it-run/views` the section showing a card.

// Vue sets __vue_app__ on #app once it mounts, so waiting on it keeps a click from racing hydration.
const hydrated = (page: Page) =>
  page.waitForFunction(
    () =>
      !!document.querySelector('#app') &&
      '__vue_app__' in document.querySelector('#app')!,
  );

const section = (page: Page) =>
  page.getByRole('region', { name: 'See it run' });

// The tour renders in shadow roots, which role queries pierce; its hidden sizing copies are inert.
const card = (page: Page) =>
  section(page).getByRole('article').getByRole('heading');

const pager = (page: Page) =>
  section(page).getByRole('navigation', { name: 'Feature cards' });

const chip = (page: Page, id: string) =>
  section(page)
    .getByRole('group', { name: 'cardId values' })
    .getByRole('link', { name: id });

const permalink = (page: Page) =>
  section(page).getByRole('link', { name: 'Permalink to “See it run”' });

const entries = (page: Page) => page.evaluate(() => history.length);

const scrollTop = (page: Page) => page.evaluate(() => Math.round(scrollY));

/** The tour shows `title`, the diagram marks its chip, and the address bar holds `url`. */
async function expectCard(page: Page, title: string, url: string) {
  await expect(card(page)).toHaveText(title);
  await expect(
    section(page).getByRole('group', { name: 'cardId values' }).locator(
      // aria-current is the claim; no role query selects by it
      '[aria-current]',
    ),
  ).toHaveText(title.toLowerCase());
  // The page announces the card; the app's own view is not a live region.
  await expect(section(page).getByRole('status')).toHaveText(
    `The app shows the ${title.toLowerCase()} card.`,
  );
  await expect(page).toHaveURL(url);
}

test.describe('home page tour', () => {
  test('opens on the state a deep link names, with the section in view', async ({
    page,
  }) => {
    await page.goto('/#see-it-run/views');

    await expectCard(page, 'Views', '/#see-it-run/views');
    await expect(section(page)).toBeInViewport();
    await expect(chip(page, 'views')).toHaveAttribute('aria-current', 'true');
    // A page that opens on an anchor moves no focus; only a followed link does.
    await expect(section(page)).not.toBeFocused();
  });

  test("leaves the page's own anchor alone and opens on the first card", async ({
    page,
  }) => {
    await page.goto('/#see-it-run');

    await expectCard(page, 'States', '/#see-it-run');
    await expect(section(page)).toBeInViewport();
  });

  test('redirects an unknown card in place', async ({ page }) => {
    await page.goto('/introduction');
    await page.goto('/#see-it-run/nope');

    await expectCard(page, 'States', '/#see-it-run/states');
    await page.goBack();
    await expect(page).toHaveURL('/introduction');
  });

  test('follows a state link from elsewhere on the page and scrolls to the tour', async ({
    page,
  }) => {
    await page.goto('/');
    await hydrated(page);
    await expect(section(page)).not.toBeInViewport();

    const before = await entries(page);

    await page
      .getByRole('link', { name: 'Open views in the app below' })
      .click();

    await expectCard(page, 'Views', '/#see-it-run/views');
    await expect(section(page)).toBeInViewport();
    expect(await entries(page)).toBe(before + 1);
  });

  test('rings the section when a keyboard user follows a state link, not a pointer user', async ({
    page,
  }) => {
    await page.goto('/');
    await hydrated(page);

    const link = page.getByRole('link', {
      name: 'Open resolves in the app below',
    });

    await link.click();
    await expectCard(page, 'Resolves', '/#see-it-run/resolves');
    await expect(section(page)).toBeFocused();
    await expect(section(page)).toHaveCSS('outline-style', 'none');

    await link.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(section(page)).toBeFocused();
    await expect(section(page)).toHaveCSS('outline-style', 'solid');
  });

  test('moves from links inside the section without scrolling the page', async ({
    page,
  }) => {
    await page.goto('/#see-it-run');
    await hydrated(page);
    await expectCard(page, 'States', '/#see-it-run');

    const top = await scrollTop(page);
    const before = await entries(page);

    await chip(page, 'resolves').click();
    await expectCard(page, 'Resolves', '/#see-it-run/resolves');

    await section(page)
      .getByRole('link', { name: '#see-it-run/views', exact: true })
      .click();
    await expectCard(page, 'Views', '/#see-it-run/views');

    // Links push, as any fragment link does.
    expect(await entries(page)).toBe(before + 2);
    expect(await scrollTop(page)).toBe(top);
  });

  test('pages in place: the address bar follows and history does not grow', async ({
    page,
  }) => {
    await page.goto('/');
    await hydrated(page);
    await section(page).scrollIntoViewIfNeeded();
    await expect(card(page)).toHaveText('States');
    // The first card is the default, not a state the page was asked for.
    await expect(page).toHaveURL('/');

    const top = await scrollTop(page);
    const before = await entries(page);

    for (const [control, title] of [
      ['Next card', 'Views'],
      ['Next card', 'Resolves'],
      ['Previous card', 'Views'],
      ['States, card 1 of 3', 'States'],
    ]) {
      await pager(page).getByRole('link', { name: control }).click();
      await expectCard(page, title, `/#see-it-run/${title.toLowerCase()}`);
    }

    expect(await entries(page)).toBe(before);
    expect(await scrollTop(page)).toBe(top);

    // The address bar is the card's deep link: opened fresh, it shows the same card.
    const copied = page.url();
    const fresh = await page.context().newPage();

    await fresh.goto(copied);
    await expectCard(fresh, 'States', '/#see-it-run/states');
    await expect(section(fresh)).toBeInViewport();
  });

  test('keeps the card across Back and Forward through anchors and states', async ({
    page,
  }) => {
    await page.goto('/');
    await hydrated(page);
    await section(page).scrollIntoViewIfNeeded();
    await expect(card(page)).toHaveText('States');

    // anchor → state → anchor
    await permalink(page).click();
    await expectCard(page, 'States', '/#see-it-run');
    await chip(page, 'views').click();
    await expectCard(page, 'Views', '/#see-it-run/views');
    await permalink(page).click();
    await expectCard(page, 'Views', '/#see-it-run');

    const length = await entries(page);

    // An anchor says nothing about the state, so the tour stays on Views all the way back.
    await page.goBack();
    await expectCard(page, 'Views', '/#see-it-run/views');
    await page.goBack();
    await expectCard(page, 'Views', '/#see-it-run');
    await page.goBack();
    await expectCard(page, 'Views', '/');

    await page.goForward();
    await expectCard(page, 'Views', '/#see-it-run');
    await page.goForward();
    await expectCard(page, 'Views', '/#see-it-run/views');
    await page.goForward();
    await expectCard(page, 'Views', '/#see-it-run');
    await expect(section(page)).toBeInViewport();

    expect(await entries(page)).toBe(length);

    // Paging on an anchor's entry takes the entry over; Back then finds the state before it.
    await pager(page).getByRole('link', { name: 'Next card' }).click();
    await expectCard(page, 'Resolves', '/#see-it-run/resolves');
    expect(await entries(page)).toBe(length);
    await page.goBack();
    await expectCard(page, 'Views', '/#see-it-run/views');
  });

  test('follows a state link from another page', async ({ page }) => {
    await page.goto('/examples/live');
    await hydrated(page);

    await page.getByRole('link', { name: 'open it on its Views card' }).click();

    await expectCard(page, 'Views', '/#see-it-run/views');
    await expect(section(page)).toBeInViewport();
  });

  test('stops with the page and resumes from the URL on the way back', async ({
    page,
  }) => {
    await page.goto('/introduction');
    await hydrated(page);
    // The site title is the link home.
    await page
      .getByRole('link', { name: 'Lit UI Router', exact: true })
      .click();
    await expect(page).toHaveURL('/');

    await section(page).scrollIntoViewIfNeeded();
    await pager(page).getByRole('link', { name: 'Next card' }).click();
    await expectCard(page, 'Views', '/#see-it-run/views');

    await section(page)
      .getByRole('link', { name: 'Read the introduction' })
      .click();
    await expect(page).toHaveURL('/introduction');
    await expect(page.getByRole('region', { name: 'See it run' })).toHaveCount(
      0,
    );

    await page.goBack();
    await expectCard(page, 'Views', '/#see-it-run/views');
    await expect(section(page)).toBeInViewport();

    // Forward from another page into the entry the pager replaced: the host router still owns it.
    await page.goBack();
    await expect(page).toHaveURL('/introduction');
    await page.goForward();
    await expectCard(page, 'Views', '/#see-it-run/views');
  });
});

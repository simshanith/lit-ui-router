import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';
import { workspaceRoot } from '@tools/bootstrap/root.ts';

// The home page's annotated listing: a code sample whose regions are boxed, numbered and explained.
// Beside the code each explanation is a card with a toggle; where the cards do not fit, tabs choose the one shown above it.

// The page shows the sample module below its import block, which ends at the first blank line.
const source = readFileSync(
  join(workspaceRoot, 'www/lit-ui-router.dev/catalog/home-sample/app.ts'),
  'utf8',
);

const listing = source.slice(source.indexOf('\n\n') + 2).trimEnd();

const lines = listing.split('\n');

const LABELS = ['States', 'URL parameters', 'Resolves', 'Views', 'State links'];

const PHONE = { width: 390, height: 844 };

// Vue sets __vue_app__ on #app once it mounts, so waiting on it keeps a click from racing hydration.
const hydrated = (page: Page) =>
  page.waitForFunction(
    () =>
      !!document.querySelector('#app') &&
      '__vue_app__' in document.querySelector('#app')!,
  );

const section = (page: Page) =>
  page.getByRole('region', { name: 'Read the code' });

// The listing's own <code>; the explanations set code in theirs.
const code = (page: Page) => section(page).locator('pre').getByRole('code');

const toggle = (page: Page, label: string) =>
  section(page).getByRole('button', { name: new RegExp(`^\\d ${label}$`) });

const tab = (page: Page, label: string) =>
  section(page).getByRole('tab', { name: new RegExp(`^\\d ${label}$`) });

const panel = (page: Page) => section(page).getByRole('tabpanel');

// data-active is the claim: it is what draws a region and its explanation as a pair.
const activeRegion = (page: Page) => section(page).locator('mark[data-active]');

const pageOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

/** The lines of the listing a card names in "Line 2" or "Lines 5 to 12". */
async function linesNamedBy(control: Locator): Promise<string[]> {
  const description = await control.evaluate((element) =>
    (element.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      .join(' '),
  );

  const [first, last = first] = [...description.matchAll(/\d+/g)].map(Number);

  return lines.slice(first - 1, last);
}

test.describe('home page listing', () => {
  test('shows the sample as one plain listing', async ({ page }) => {
    await page.goto('/');

    await expect(code(page)).toHaveText(listing, { useInnerText: true });

    // Selecting it takes the code alone: no gutter number, no region number.
    const selected = await code(page).evaluate((element) => {
      getSelection()?.selectAllChildren(element);

      return getSelection()?.toString();
    });

    expect(selected).toBe(listing);
  });

  test('copies exactly the listing', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await hydrated(page);

    await section(page).getByRole('button', { name: 'Copy code' }).click();

    await expect(
      section(page).getByRole('status').filter({ hasText: 'Copied' }),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      listing,
    );
  });

  test('pairs each explanation with the lines it names', async ({ page }) => {
    await page.goto('/');
    await hydrated(page);

    // One connector a region, drawn once the page has measured itself.
    await expect(section(page).locator('svg path')).toHaveCount(LABELS.length);
    await expect(activeRegion(page)).toHaveCount(0);

    for (const label of LABELS) {
      const control = toggle(page, label);
      const named = await linesNamedBy(control);

      await control.click();
      await expect(control).toHaveAttribute('aria-pressed', 'true');

      // The marks are the region, a line each, and each sits on the line the card names.
      const marked = await activeRegion(page).allTextContents();

      expect(marked).toHaveLength(named.length);

      for (const [index, text] of marked.entries())
        expect(named[index]).toContain(text);

      await control.click();
      await expect(control).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('draws the pair from the keyboard and from the code', async ({
    page,
  }) => {
    await page.goto('/');
    await hydrated(page);

    // Focus alone draws it; nothing is pressed.
    await toggle(page, 'States').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(toggle(page, 'States')).toBeFocused();
    await expect(toggle(page, 'States')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(activeRegion(page)).toHaveText("name: 'card'");

    // A region answers the pointer too, and marks its card.
    await section(page).locator('mark', { hasText: '<ui-view>' }).hover();
    await expect(activeRegion(page)).toHaveText('<ui-view></ui-view>');
    await expect(
      section(page)
        .locator('[data-active]')
        .getByRole('heading', { name: 'Views' }),
    ).toBeVisible();

    await section(page).locator('mark', { hasText: '<ui-view>' }).click();
    await expect(toggle(page, 'Views')).toHaveAttribute('aria-pressed', 'true');
  });

  test('opens the tour card an explanation links to', async ({ page }) => {
    await page.goto('/');
    await hydrated(page);

    const tour = page.getByRole('region', { name: 'See it run' });

    await expect(tour).not.toBeInViewport();

    const before = await page.evaluate(() => history.length);

    await section(page)
      .getByRole('link', { name: 'Open the Resolves card below' })
      .click();

    await expect(page).toHaveURL('/#see-it-run/resolves');
    await expect(tour.getByRole('article').getByRole('heading')).toHaveText(
      'Resolves',
    );
    await expect(tour).toBeInViewport();
    // A link from outside the tour is a step the visitor can go back over.
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
  });

  test('reads complete without scripting', async ({ browser }) => {
    for (const viewport of [{ width: 1280, height: 720 }, PHONE]) {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport,
      });

      const page = await context.newPage();

      await page.goto('/');

      await expect(code(page)).toHaveText(listing, { useInnerText: true });
      await expect(section(page).getByRole('heading', { level: 3 })).toHaveText(
        LABELS.map((label, index) => `${index + 1} ${label}`),
      );
      // Tabs that cannot choose are not offered.
      await expect(section(page).getByRole('tab')).toHaveCount(0);
      expect(await pageOverflow(page)).toBe(0);

      await context.close();
    }
  });
});

test.describe('home page listing on a narrow screen', () => {
  test.use({ viewport: PHONE });

  test('shows one explanation, chosen by tabs and by the keyboard', async ({
    page,
  }) => {
    await page.goto('/');
    await hydrated(page);

    const tabs = section(page).getByRole('tablist', { name: 'Annotations' });

    await expect(tabs.getByRole('tab')).toHaveCount(LABELS.length);
    await expect(tab(page, 'States')).toHaveAttribute('aria-selected', 'true');
    await expect(panel(page)).toHaveCount(1);
    await expect(panel(page)).toHaveAccessibleName('1 States');
    await expect(activeRegion(page)).toHaveText("name: 'card'");

    // One tab stop; the arrows move through the tabs and wrap, and selection follows focus.
    await tab(page, 'States').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'URL parameters')).toBeFocused();
    await expect(tab(page, 'URL parameters')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(panel(page)).toHaveAccessibleName('2 URL parameters');
    await expect(panel(page)).toContainText('is a parameter');

    await page.keyboard.press('End');
    await expect(tab(page, 'State links')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'States')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(tab(page, 'State links')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(tab(page, 'States')).toHaveAttribute('aria-selected', 'true');

    // Tab leaves the list: past Previous and Next, to the panel's own link.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(
      panel(page).getByRole('link', { name: 'Open the States card below' }),
    ).toBeFocused();

    // A panel with no link takes focus itself.
    await tab(page, 'URL parameters').click();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(panel(page)).toBeFocused();
  });

  test('steps with Previous and Next, and says where it landed', async ({
    page,
  }) => {
    await page.goto('/');
    await hydrated(page);

    const status = section(page).getByRole('status').first();

    await expect(status).toBeEmpty();

    await section(page)
      .getByRole('button', { name: 'Previous annotation' })
      .click();
    await expect(tab(page, 'State links')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(status).toHaveText('State links, 5 of 5');

    await section(page)
      .getByRole('button', { name: 'Next annotation' })
      .press('Enter');
    await expect(panel(page)).toHaveAccessibleName('1 States');
    await expect(status).toHaveText('States, 1 of 5');
  });

  test('keeps the page still while the code scrolls under its pinned numbers', async ({
    page,
  }) => {
    await page.goto('/');
    await hydrated(page);
    expect(await pageOverflow(page)).toBe(0);

    // The gutter is hidden from the tree, so its numbers are found by text.
    const number = section(page)
      .locator('[aria-hidden="true"]')
      .getByText('5', { exact: true })
      .first();

    const before = await number.boundingBox();

    // Choosing a region the screen cuts off scrolls the code to it, and only the code.
    const edges = async () => {
      const region = await activeRegion(page).boundingBox();
      const pinned = await number.boundingBox();

      return {
        clearOfGutter: region!.x >= pinned!.x + pinned!.width,
        insideScreen: region!.x + region!.width <= PHONE.width,
      };
    };

    await tab(page, 'State links').click();
    await expect(activeRegion(page)).toContainText('uiSref');
    // It did not fit where the code stood.
    expect((await edges()).insideScreen).toBe(false);
    await expect
      .poll(edges)
      .toEqual({ clearOfGutter: true, insideScreen: true });

    // The click may scroll the page down to the tab; the number has not moved sideways.
    expect((await number.boundingBox())?.x).toBe(before?.x);
    expect(await pageOverflow(page)).toBe(0);
    expect(await page.evaluate(() => scrollX)).toBe(0);
  });
});

import { expect, test } from '@playwright/test';

// The uirouter-react example runs this family's agnostic packages on
// @uirouter/react with no Lit installed; these are the claims the
// staying-on-UI-Router guide makes for React.
const EXAMPLE = '/examples/uirouter-react/';

test.describe('uirouter-react example', () => {
  test('runs on @uirouter/react without a page error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(EXAMPLE);
    await expect(page.getByRole('heading', { name: 'Planets' })).toBeVisible();
    await page.getByRole('link', { name: 'Mars' }).click();
    await expect(page.getByRole('heading', { name: 'Mars' })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('commits router urls through the Navigation API plugin', async ({
    page,
  }) => {
    await page.goto(EXAMPLE);
    const entries = await page.evaluate(() => navigation.entries().length);

    const mars = page.getByRole('link', { name: 'Mars' });
    // the plugin writes hrefs under the page's <base href>
    await expect(mars).toHaveAttribute('href', `${EXAMPLE}planets/mars`);
    await mars.click();

    await expect(page).toHaveURL(`${EXAMPLE}planets/mars`);
    await expect(mars).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => navigation.entries().length)).toBe(
      entries + 1,
    );

    await page.goBack();
    await expect(page).toHaveURL(EXAMPLE);
    await expect(page.getByRole('heading', { name: 'Planets' })).toBeVisible();
  });

  test('follows the route outside <UIView> through ui-router-signals', async ({
    page,
  }) => {
    await page.goto(EXAMPLE);
    const status = page.getByRole('status');
    await expect(status).toHaveText('Viewing the list');

    await page.getByRole('link', { name: 'Venus' }).click();
    // the planet resolve is still loading: RouterSignals.pending
    await expect(status).toHaveText('Loading…');
    // then the settled snapshot, narrowed to the planet state's params
    await expect(status).toHaveText('Viewing venus');
  });

  test('navigates with the typed StateService', async ({ page }) => {
    await page.goto(EXAMPLE);
    await page.getByRole('button', { name: 'Pick one at random' }).click();

    await expect(page).toHaveURL(new RegExp(`${EXAMPLE}planets/\\w+$`));
    await expect(page.getByRole('status')).toHaveText(/^Viewing \w+$/);
  });
});

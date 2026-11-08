import { expect, test } from './fixtures.ts';

// @api-viewer/docs is imported dynamically behind `enable-api-docs`, so the
// element upgrades a tick after the template renders; the web-first assertions retry over it.
test.describe('api docs viewer', () => {
  test('lazy-loads the element definition and renders its tabs', async ({
    page,
    visit,
  }) => {
    await visit('/home', { 'enable-api-docs': 'true' });

    const apiDocs = page.locator('api-docs');

    await expect(apiDocs.getByRole('tab').first()).toBeVisible();
    await expect(
      apiDocs.getByRole('tab', { name: 'Properties' }),
    ).toBeVisible();
    // api-viewer hides the tab of an empty section; the documented element has no attributes
    await expect(
      apiDocs.getByRole('tab', { name: 'Attributes', includeHidden: true }),
    ).toBeAttached();
  });

  test('never loads the element when the flag is off', async ({
    page,
    visit,
  }) => {
    await visit('/home', { 'enable-api-docs': 'false' });

    await expect(page.getByRole('link', { name: 'Contacts' })).toHaveAttribute(
      'href',
      /./,
    );
    // <api-docs> has no role until it upgrades, and never upgrades here
    await expect(page.locator('api-docs')).toHaveCount(0);
    expect(
      await page.evaluate(() => customElements.get('api-docs')),
      'api-docs not defined',
    ).toBeUndefined();
  });
});

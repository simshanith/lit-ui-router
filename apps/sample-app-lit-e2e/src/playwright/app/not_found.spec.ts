import type { Page } from '@playwright/test';

import { expect, syncUrl, test } from './fixtures.ts';

// the 404 view's own paragraph: other views render <code> too
const attemptedPath = (page: Page) =>
  page
    .getByRole('paragraph')
    .filter({ hasText: 'No state matched the URL' })
    .getByRole('code');

const WELCOME = 'Welcome to the sample app!';

const NOT_FOUND = '404 Page Not Found';

test.describe('404 not found', () => {
  test('routes the app root to welcome, not the 404 page', async ({
    page,
    visitRoot,
  }) => {
    await visitRoot();
    await expect(page.getByText(WELCOME)).toBeVisible();
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0);
    await expect(page).toHaveURL(/\/welcome/);
  });

  test('does not 404 when navigating back to the app root', async ({
    page,
    visit,
    visitRoot,
  }) => {
    await visit('/login');
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
    await visitRoot();
    await expect(page.getByText(WELCOME)).toBeVisible();

    // The root replaced its history entry, so Back skips it for the login page.
    // Without that, Back re-syncs the root, where otherwise() renders the 404.
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0);
  });

  // Direct loads of unmatched URLs get the static server 404 (the worker
  // only serves the shell for real routes), so client-side navigation is the
  // way to reach the in-router 404 page here.
  test('shows the 404 page for an unmatched URL', async ({
    page,
    visitRoot,
  }) => {
    await visitRoot();
    await expect(page.getByText(WELCOME)).toBeVisible();
    await syncUrl(page, '/no/such/page');
    await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible();
    await expect(attemptedPath(page)).toHaveText('/no/such/page');
    // The unmatched URL stays in the address bar (the 404 state has no url)
    await expect(page).toHaveURL(/\/no\/such\/page/);
  });

  test('links back to the welcome page', async ({ page, visitRoot }) => {
    await visitRoot();
    await expect(page.getByText(WELCOME)).toBeVisible();
    await syncUrl(page, '/no/such/page');
    await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible();
    await page.getByRole('link', { name: 'Return to Welcome' }).click();
    await expect(page).toHaveURL(/\/welcome/);
    await expect(page.getByText(WELCOME)).toBeVisible();
  });

  test('does not intercept future state URLs (lazy loading still works)', async ({
    page,
    visit,
  }) => {
    // /mymessages matches the mymessages.** future state's wildcard rule, so
    // it must lazy load (then redirect to login via requiresAuth), not 404
    await visit('/mymessages');
    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0);
  });

  test('shows the 404 page for URLs unmatched after a future state lazy loads', async ({
    page,
    visitRoot,
  }) => {
    // matches the contacts.** wildcard prefix, so the module lazy loads;
    // after the re-sync no contacts state matches this URL, so otherwise fires
    await visitRoot();
    await expect(page.getByText(WELCOME)).toBeVisible();
    await syncUrl(page, '/contacts/no/such/contact');
    await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible();
    await expect(attemptedPath(page)).toHaveText('/contacts/no/such/contact');
  });
});

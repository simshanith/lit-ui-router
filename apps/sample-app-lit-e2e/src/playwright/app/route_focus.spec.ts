import type { Page } from '@playwright/test';

import { authenticate, expect, test } from './fixtures.ts';
import { messageRows } from './messages.ts';

const APP_TITLE = 'UI-Router Lit sample app';

const subjectLink = (page: Page, row: number) =>
  messageRows(page).nth(row).getByRole('link');

/**
 * Focus stays on what the user activated within a section, and moves to the
 * new view's h1 on a section change — in every location mode, so the Navigation
 * API's default focus reset must not leak through.
 */
test.describe('focus and titles across route changes', () => {
  authenticate();

  test('keeps focus on a message subject opened with Enter', async ({
    page,
    visit,
  }) => {
    await visit('/mymessages');
    await expect(page).toHaveURL(/\/mymessages\/inbox/);
    await expect(page).toHaveTitle(`Inbox — ${APP_TITLE}`);

    await subjectLink(page, 0).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/inbox\/.+/);

    const subject = page.getByRole('heading', { level: 2 });

    await expect(subject).toBeVisible();
    await expect(page).toHaveTitle(
      `${(await subject.innerText()).trim()} — ${APP_TITLE}`,
    );
    await expect(subjectLink(page, 0)).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(subjectLink(page, 1)).toBeFocused();
  });

  test('focuses the heading of a section opened from the nav tabs', async ({
    page,
    visit,
  }) => {
    await visit('/mymessages');
    await expect(page).toHaveURL(/\/mymessages\/inbox/);

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Contacts' })
      .focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/contacts/);
    await expect(
      page
        .getByRole('main')
        .getByRole('heading', { level: 1, name: 'Contacts', exact: true }),
    ).toBeFocused();
    await expect(page).toHaveTitle(`Contacts — ${APP_TITLE}`);
  });
});

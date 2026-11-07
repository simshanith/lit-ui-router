import type { Page } from '@playwright/test';

import { authenticate, expect, test } from './fixtures.ts';
import { messageRows } from './messages.ts';

// The unread dot is an unnamed icon, so CSS is the only handle on it.
const UNREAD_DOT = 'i.fa-circle';

const unreadRows = (page: Page) =>
  messageRows(page).filter({ has: page.locator(UNREAD_DOT) });

const activeRow = (page: Page) =>
  messageRows(page).and(page.locator('[aria-current="true"]'));

const table = (page: Page) => page.locator('sample-message-table');

// the list stays mounted across message opens (#755), so the read column must re-render off the store commit
test.describe('unread dots in the message list', () => {
  authenticate();

  test('clears the unread dot of an opened message while the list stays mounted', async ({
    page,
    visit,
  }) => {
    await visit('/mymessages/inbox');
    await expect(page).toHaveURL(/\/mymessages\/inbox/);

    // the inbox ships three messages, all unread
    await expect(unreadRows(page)).toHaveCount(3);

    // the same table element must survive both opens, or the guard proves nothing
    await table(page).evaluate((element) => {
      Object.assign(element, { e2eMarker: true });
    });

    const sameTable = () =>
      expect(
        table(page).evaluate((element) => 'e2eMarker' in element),
        'the same <sample-message-table>',
      ).resolves.toBe(true);

    for (const remaining of [2, 1]) {
      // messageId -> messageId without leaving the list on the second pass
      await unreadRows(page).first().click();
      await expect(page).toHaveURL(/\/mymessages\/inbox\/[\w-]+$/);
      await sameTable();
      await expect(activeRow(page)).toHaveCount(1);
      await expect(activeRow(page).locator(UNREAD_DOT)).toHaveCount(0);
      await expect(unreadRows(page)).toHaveCount(remaining);
    }
  });
});

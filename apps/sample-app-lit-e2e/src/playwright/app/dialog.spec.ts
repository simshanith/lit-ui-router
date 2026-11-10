import type { Page } from '@playwright/test';

import {
  authenticate,
  backdrop,
  expect,
  test,
  type Visit,
} from './fixtures.ts';

const openDeleteDialog = async (
  page: Page,
  visit: Visit,
  name: string,
  id: string,
) => {
  await visit('/contacts');
  await page.getByRole('link', { name }).click();
  await expect(page).toHaveURL(new RegExp(id));
  await page.getByRole('link', { name: 'Edit Contact' }).click();
  await expect(page).toHaveURL(/edit/);
  await page.getByRole('button', { name: 'Delete' }).click();

  const dialog = page.getByRole('dialog');

  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`Delete contact: ${name}`);
  await expect(dialog).toContainText('Are you sure?');
  // The card slides in; a click mid-animation can land on the overlay, which cancels.
  await expect
    .poll(() =>
      dialog.evaluate((el) => el.getAnimations({ subtree: true }).length),
    )
    .toBe(0);

  return dialog;
};

test.describe('confirmation dialog', () => {
  authenticate();

  // Render/design assertions (modal `in` class, backdrop dim, centering,
  // card width, deny-closes) live in the component spec:
  // apps/sample-app-shared/src/app/global/Dialog.spec.ts

  test('deletes the contact when confirmed', async ({ page, visit }) => {
    const dialog = await openDeleteDialog(
      page,
      visit,
      'Delia Hunter',
      'dhunter',
    );

    await dialog.getByRole('button', { name: 'Yes' }).click();
    await expect(backdrop(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/dhunter/);
    await expect(page.getByRole('link', { name: 'Delia Hunter' })).toHaveCount(
      0,
    );
  });

  test('keeps the contact when dismissed by clicking outside', async ({
    page,
    visit,
  }) => {
    const dialog = await openDeleteDialog(
      page,
      visit,
      'Underwood Owens',
      'uowens',
    );

    const box = await dialog.boundingBox();

    // the overlay below the card, at the bottom edge's midpoint
    await dialog.click({
      position: { x: box!.width / 2, y: box!.height - 1 },
    });
    await expect(backdrop(page)).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Underwood Owens' }),
    ).toBeVisible();
  });
});

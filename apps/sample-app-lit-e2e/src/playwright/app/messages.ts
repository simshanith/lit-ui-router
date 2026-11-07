import type { Page } from '@playwright/test';

/** The message table's body rows; the header row sits in the first row group. */
export const messageRows = (page: Page) =>
  page.getByRole('table').getByRole('rowgroup').last().getByRole('row');

import { authenticate, expect, test } from './fixtures.ts';
import { messageRows } from './messages.ts';

const CONTACT = 'Delia Hunter';

/**
 * Navigation controls are anchors and carry an href; plain actions, and the
 * two controls that cannot be links, stay buttons and carry none.
 *
 * The button/anchor split is the point, so every assertion here names the role.
 */
test.describe('link semantics', () => {
  authenticate();

  test('renders the home tiles as anchors with hrefs', async ({
    page,
    visit,
  }) => {
    await visit('/home');

    const main = page.getByRole('main');

    for (const name of ['Messages', 'Contacts', 'Preferences']) {
      await expect(main.getByRole('link', { name })).toHaveAttribute(
        'href',
        /./,
      );
    }

    await expect(main.getByRole('button')).toHaveCount(0);
  });

  test('renders the welcome buttons as anchors with hrefs', async ({
    page,
    visit,
  }) => {
    await visit('/welcome');

    const main = page.getByRole('main');

    for (const name of ['Messages', 'Contacts', 'Preferences']) {
      await expect(main.getByRole('link', { name })).toHaveAttribute(
        'href',
        /./,
      );
    }
  });

  test('navigates on a plain click of a converted control', async ({
    page,
    visit,
  }) => {
    await visit('/welcome');
    await page
      .getByRole('main')
      .getByRole('link', { name: 'Contacts' })
      .click();
    await expect(page).toHaveURL(/\/contacts/);
  });

  test('renders one New Contact control, an anchor with an href', async ({
    page,
    visit,
  }) => {
    await visit('/contacts');
    // the nested <a><button> gave two tab stops; there is one control now
    await expect(
      page.getByRole('link', { name: 'New Contact' }),
    ).toHaveAttribute('href', /./);
    await expect(page.getByRole('button', { name: 'New Contact' })).toHaveCount(
      0,
    );
  });

  test('keeps Edit Contact an anchor and Message a button', async ({
    page,
    visit,
  }) => {
    await visit('/contacts');
    await page.getByRole('link', { name: CONTACT }).click();

    await expect(
      page.getByRole('link', { name: 'Edit Contact' }),
    ).toHaveAttribute('href', /./);

    // mymessages.compose takes a non-url `message` param, so an href here
    // would be a lossy link — assignHref: 'auto' withholds it
    const message = page.getByRole('button', { name: 'Message' });

    await expect(message).not.toHaveAttribute('href');
    await message.click();
    await expect(page).toHaveURL(/\/compose/);
  });

  test('keeps Cancel a button with no href, and it still navigates', async ({
    page,
    visit,
  }) => {
    await visit('/contacts');
    await page.getByRole('link', { name: CONTACT }).click();
    await page.getByRole('link', { name: 'Edit Contact' }).click();
    await expect(page).toHaveURL(/edit/);

    const cancel = page.getByRole('button', { name: 'Cancel' });

    await expect(cancel).not.toHaveAttribute('href');
    await cancel.click();
    await expect(page).not.toHaveURL(/edit/);
  });

  test('links each message row by its subject, and the row still navigates', async ({
    page,
    visit,
  }) => {
    await visit('/mymessages');
    await expect(page).toHaveURL(/\/mymessages\/inbox/);

    const row = messageRows(page).first();

    // one link per row, the subject; the row itself is no link
    await expect(row.getByRole('link')).toHaveCount(1);
    await expect(row.getByRole('link')).toHaveAttribute('href', /./);
    // the row's leading corner, away from the subject text: the stretched link takes it
    await row.click({ position: { x: 4, y: 4 } });
    await expect(page).toHaveURL(/\/inbox\/.+/);
  });
});

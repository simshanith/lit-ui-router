import { expect, test, type Page } from '@playwright/test';

// Paths are relative: baseURL is the /app/ mount, and a leading slash would resolve from the origin.

const EMAIL_ADDRESS = 'myself@angular.dev';

const readAppConfig = (page: Page) =>
  page.evaluate(() => sessionStorage.getItem('appConfig'));

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main' });

const navTab = (page: Page, name: string) =>
  mainNav(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name, exact: true }) });

// the folder icon's font glyph leads the link's accessible name
const folderLink = (page: Page, name: string) =>
  page.getByRole('link', { name: new RegExp(`\\b${name}$`) });

const folder = (page: Page, name: string) =>
  page.getByRole('listitem').filter({ has: folderLink(page, name) });

const logIn = async (page: Page) => {
  await page.getByLabel('Username').selectOption(EMAIL_ADDRESS);
  await page.getByRole('button', { name: 'Log in' }).click();
};

const openCompose = async (page: Page) => {
  await page.getByRole('link', { name: 'New Message' }).click();
  await expect(page).toHaveURL(/\/mymessages\/compose/);
};

const messageTable = (page: Page) => page.getByRole('table');

// The backdrop carries no role, and while it exists it swallows clicks.
const backdrop = (page: Page) => page.locator('#backdrop');

test.describe('unauthenticated sample app', () => {
  test('loads', async ({ page }) => {
    await page.goto('./');
  });

  test('renders home', async ({ page }) => {
    await page.goto('home');

    // navigation controls are anchors, so they carry a real href
    for (const name of ['Messages', 'Contacts', 'Preferences']) {
      await expect(page.getByRole('link', { name })).toHaveAttribute(
        'href',
        /./,
      );
    }
  });

  test('asks for authentication', async ({ page }) => {
    await page.goto('home');
    await page.getByRole('link', { name: 'Preferences' }).click();

    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    expect(await readAppConfig(page)).toBeNull();
  });

  test('can authenticate', async ({ page }) => {
    await page.goto('prefs');

    expect(await readAppConfig(page)).toBeNull();

    await expect(page.getByRole('heading', { name: 'Log In' })).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    await logIn(page);

    await expect(
      page.getByRole('button', { name: 'Reset All Data' }),
    ).toBeVisible();

    const appConfig = await readAppConfig(page);

    expect(appConfig).not.toBeNull();
    expect(JSON.parse(appConfig ?? '{}')).toMatchObject({
      emailAddress: EMAIL_ADDRESS,
    });
  });
});

test.describe('authenticated sample app', () => {
  // one login per worker; later tests seed its appConfig before the app boots
  let appConfig: string | null = null;

  test.beforeEach(async ({ page }) => {
    if (appConfig !== null) {
      await page.addInitScript((value) => {
        sessionStorage.setItem('appConfig', value);
      }, appConfig);

      return;
    }

    await page.goto('login');
    await logIn(page);
    await expect(page).toHaveURL(/\/home/);

    appConfig = await readAppConfig(page);
    expect(appConfig).not.toBeNull();
  });

  test('navigates to Preferences by url', async ({ page }) => {
    await page.goto('prefs');
    await expect(
      page.getByRole('button', { name: 'Reset All Data' }),
    ).toBeVisible();
  });

  test('navigates to Contacts by url', async ({ page }) => {
    await page.goto('contacts');
    await expect(
      page.getByRole('heading', { name: 'Select a contact' }),
    ).toBeVisible();
  });

  test('navigates to Messages by url', async ({ page }) => {
    await page.goto('mymessages');
    await expect(
      messageTable(page).getByRole('button', { name: 'Sender' }),
    ).toBeVisible();
    await expect(
      messageTable(page).getByRole('button', { name: 'Subject' }),
    ).toBeVisible();
  });

  test('can send a message', async ({ page }) => {
    await page.goto('mymessages');
    await expect(page).toHaveURL(/\/mymessages\/inbox/);
    await openCompose(page);

    await page.getByLabel('Recipient').fill('somebody@somewhere.com');
    await page.getByRole('textbox', { name: 'Subject' }).fill('Hello World');
    await page
      .getByRole('textbox', { name: 'Body' })
      .fill('The quick brown fox jumps over the lazy dog');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(
      messageTable(page).getByRole('button', { name: 'Sender' }),
    ).toBeVisible();
    await folderLink(page, 'sent').click();
    await expect(
      messageTable(page).getByRole('link', { name: 'Hello World' }),
    ).toBeVisible();
    await expect(
      messageTable(page).getByRole('cell', { name: 'somebody@somewhere.com' }),
    ).toBeVisible();
  });

  test('can save a draft', async ({ page }) => {
    await page.goto('mymessages');
    await expect(page).toHaveURL(/\/mymessages\/inbox/);
    await openCompose(page);

    await page.getByLabel('Recipient').fill('somebody@somewhere.com');
    await page.getByRole('textbox', { name: 'Subject' }).fill('Hello World');
    await page
      .getByRole('textbox', { name: 'Body' })
      .fill('The quick brown fox jumps over the lazy dog');
    await page.getByRole('button', { name: 'Save as Draft' }).click();

    await expect(
      messageTable(page).getByRole('button', { name: 'Sender' }),
    ).toBeVisible();
    await folderLink(page, 'drafts').click();
    await expect(
      messageTable(page).getByRole('link', { name: 'Hello World' }),
    ).toBeVisible();
    await expect(
      messageTable(page).getByRole('cell', { name: 'somebody@somewhere.com' }),
    ).toBeVisible();
  });

  // `mymessages` is a sticky state, so leaving it inactivates the branch rather
  // than exiting it: the ui-view stays mounted and must keep the same Compose
  // element, unsent draft and all. Regression guard for #723.
  test('retains an unsent draft across a trip out of the sticky branch', async ({
    page,
  }) => {
    await page.goto('mymessages');
    await expect(page).toHaveURL(/\/mymessages\/inbox/);
    await openCompose(page);
    await page
      .getByRole('textbox', { name: 'Subject' })
      .fill('Half-written subject');

    await mainNav(page).getByRole('link', { name: 'Contacts' }).click();
    await expect(page).toHaveURL(/\/contacts/);

    // Deep state redirect returns to the deepest previously-active child.
    await mainNav(page).getByRole('link', { name: 'Messages' }).click();
    await expect(page).toHaveURL(/\/mymessages\/compose/);

    await expect(page.getByRole('textbox', { name: 'Subject' })).toHaveValue(
      'Half-written subject',
    );
  });

  // uiSrefActive on the <li> resolves its target from the uiSref <a> inside
  // it, and `contacts.contact` is a descendant of that target.
  test('keeps the Contacts tab active on a nested contact', async ({
    page,
  }) => {
    await page.goto('contacts');
    await expect(page).toHaveURL(/\/contacts/);
    await expect(navTab(page, 'Contacts')).toHaveClass(/\bactive\b/);

    await page.getByRole('link', { name: /Finley/ }).click();
    await expect(page).toHaveURL(/\/contacts\/[\w-]+$/);
    await expect(navTab(page, 'Contacts')).toHaveClass(/\bactive\b/);
  });

  // Leaving `contacts` inactivates the sticky branch and DSR returns to the
  // open contact: a directive that does not survive a disconnect/reconnect
  // would come back frozen.
  test('keeps the Contacts tab active after a round trip out of the branch', async ({
    page,
  }) => {
    await page.goto('contacts');
    await page.getByRole('link', { name: /Finley/ }).click();
    await expect(page).toHaveURL(/\/contacts\/[\w-]+$/);

    await mainNav(page).getByRole('link', { name: 'Messages' }).click();
    await expect(page).toHaveURL(/\/mymessages/);

    await mainNav(page).getByRole('link', { name: 'Contacts' }).click();
    await expect(page).toHaveURL(/\/contacts\/[\w-]+$/);

    await expect(navTab(page, 'Contacts')).toHaveClass(/\bactive\b/);
    await expect(navTab(page, 'Messages')).not.toHaveClass(/\bactive\b/);
  });

  // `save()` returns to where compose was entered from (contacts), so
  // `mymessages.messagelist` is never activated and compose stays the deepest
  // previously-active child DSR remembers.
  test('does not reopen a saved draft when returning to messages', async ({
    page,
  }) => {
    await page.goto('contacts');
    await expect(page).toHaveURL(/\/contacts/);

    await openCompose(page);
    await page
      .getByRole('textbox', { name: 'Subject' })
      .fill('Saved from contacts');
    await page.getByRole('button', { name: 'Save as Draft' }).click();

    await expect(page).toHaveURL(/\/contacts/);

    await mainNav(page).getByRole('link', { name: 'Messages' }).click();
    await expect(page).toHaveURL(/\/mymessages\/(?!compose)/);
  });

  // Compose is a sticky component, so the instance outlives the visit; a saved
  // draft must not bleed into the next one.
  test('starts a fresh draft after the previous one was saved', async ({
    page,
  }) => {
    await page.goto('mymessages');
    await expect(page).toHaveURL(/\/mymessages\/inbox/);

    await openCompose(page);
    await page.getByRole('textbox', { name: 'Subject' }).fill('Saved subject');
    await page.getByRole('button', { name: 'Save as Draft' }).click();
    await expect(page).toHaveURL(/\/mymessages\/inbox/);

    await openCompose(page);
    await expect(page.getByRole('textbox', { name: 'Subject' })).toHaveValue(
      '',
    );
  });

  test('prompts to save a message being composed', async ({ page }) => {
    await page.goto('mymessages');
    await expect(page).toHaveURL(/\/mymessages\/inbox/);
    await openCompose(page);
    await page.getByLabel('Recipient').fill('somebody@somewhere.com');

    const dialog = page.getByRole('dialog');

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toContainText('Navigate away');
    await dialog.getByRole('button', { name: 'No' }).click();
    await expect(backdrop(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/mymessages\/compose/);

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toContainText('Navigate away');
    await dialog.getByRole('button', { name: 'Yes' }).click();
    await expect(backdrop(page)).toHaveCount(0);

    await expect(
      messageTable(page).getByRole('button', { name: 'Sender' }),
    ).toBeVisible();
    await expect(
      messageTable(page).getByRole('button', { name: 'Subject' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/mymessages\/inbox/);
  });

  test('navigates through folders', async ({ page }) => {
    await page.goto('mymessages');
    await expect(page).toHaveURL(/\/mymessages\/inbox/);

    await expect(folder(page, 'inbox')).toHaveClass(/\bselected\b/);
    await expect(
      messageTable(page).getByRole('link', { name: /Longer in style/ }),
    ).toBeVisible();

    for (const [name, subject] of [
      ['finance', /You look angerly/],
      ['travel', /In areas of lush forest/],
      ['personal', /Mother is not all/],
    ] as const) {
      await folderLink(page, name).click();
      await expect(page).toHaveURL(new RegExp(`/mymessages/${name}`));
      await expect(folder(page, name)).toHaveClass(/\bselected\b/);
      await expect(
        messageTable(page).getByRole('link', { name: subject }),
      ).toBeVisible();
    }
  });

  test('navigates through messages', async ({ page }) => {
    await page.goto('mymessages/finance');
    await expect(folder(page, 'finance')).toHaveClass(/\bselected\b/);

    for (const [subject, guid] of [
      ['You look angerly', '5648b50cf8ea6dfc7d1a40a8'],
      ['Historical change consequent', '5648b50c66b80016c9acc467'],
      ['The gracious Duncan', '5648b50d05f033d24fe5a1a2'],
      ['Rings, does not die', '5648b50c8e0e098cef934e04'],
    ]) {
      await messageTable(page).getByRole('link', { name: subject }).click();
      await expect(page).toHaveURL(new RegExp(guid));
      await expect(
        page.getByRole('heading', { level: 2, name: subject }),
      ).toBeVisible();
    }
  });

  test('navigates through contacts', async ({ page }) => {
    await page.goto('contacts');

    for (const [name, id] of [
      ['Rios Sears', 'rsears'],
      ['Delia Hunter', 'dhunter'],
      ['Underwood Owens', 'uowens'],
    ]) {
      const link = page.getByRole('link', { name });

      await link.click();
      await expect(page).toHaveURL(new RegExp(id));
      await expect(link).toHaveClass(/\bselected\b/);
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }
  });
});

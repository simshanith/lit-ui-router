// axe over the docs pages in both color schemes and each sample-app mount's main routes.

import { AxeBuilder } from '@axe-core/playwright';
import type { Browser, BrowserContext, Page } from 'playwright';

/** WCAG 2.0–2.2 A and AA, plus best-practice. */
const TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
];

/** Accepted exceptions, by axe rule id; each needs a one-line reason. */
const DISABLED_RULES: readonly string[] = [];

const DOCS_CONCURRENCY = 4;

const EMAIL_ADDRESS = 'myself@angular.dev';

export type Scheme = 'light' | 'dark';

export interface Finding {
  page: string;
  scheme: Scheme;
  rule: string;
  impact: string;
  help: string;
  targets: string[];
}

export interface Audit {
  axeVersion: string;
  scans: number;
  findings: Finding[];
}

function newContext(browser: Browser, scheme: Scheme): Promise<BrowserContext> {
  return browser.newContext({ colorScheme: scheme, reducedMotion: 'reduce' });
}

async function scan(
  page: Page,
  label: string,
  scheme: Scheme,
  audit: Audit,
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    .disableRules([...DISABLED_RULES])
    .analyze();

  audit.axeVersion = results.testEngine.version;
  audit.scans++;

  for (const violation of results.violations) {
    audit.findings.push({
      page: label,
      scheme,
      rule: violation.id,
      impact: violation.impact ?? 'unknown',
      help: violation.help,
      targets: violation.nodes.map((node) =>
        node.target.map((part) => [part].flat().join(' >> ')).join(' >> '),
      ),
    });
  }
}

async function goto(page: Page, url: string): Promise<void> {
  const response = await page.goto(url, { waitUntil: 'networkidle' });

  // null is a same-document (hash) navigation
  if (response && response.status() !== 200) {
    throw new Error(`${url} answered ${response.status()}`);
  }
}

/** Lazy same-origin embeds load only on scroll; axe scans a frame only once it has loaded. */
async function loadEmbeds(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const frame of document.querySelectorAll('iframe')) {
      frame.loading = 'eager';
    }
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('iframe')]
      .filter(
        (frame) => new URL(frame.src, location.href).origin === location.origin,
      )
      .every(
        (frame) =>
          frame.contentDocument?.URL !== 'about:blank' &&
          frame.contentDocument?.readyState === 'complete',
      ),
  );
  await page.waitForLoadState('networkidle');
}

export async function auditDocs(
  browser: Browser,
  origin: string,
  paths: readonly string[],
  scheme: Scheme,
  audit: Audit,
): Promise<void> {
  const context = await newContext(browser, scheme);

  try {
    const queue = [...paths];

    const worker = async () => {
      const page = await context.newPage();

      for (let path = queue.shift(); path; path = queue.shift()) {
        await goto(page, origin + path);
        await loadEmbeds(page);
        await scan(page, path, scheme, audit);
      }

      await page.close();
    };

    await Promise.all(Array.from({ length: DOCS_CONCURRENCY }, worker));
  } finally {
    await context.close();
  }
}

/** A sample-app mount, and the query its first load carries (feature flags). */
export interface AppMount {
  mount: string;
  hash: boolean;
  query?: string;
}

/**
 * Logs in, then visits welcome, login, home, inbox, a message, contacts, a
 * contact, its edit form, a new contact, prefs and compose. Compose goes last:
 * leaving it with a draft prompts.
 */
export async function auditApp(
  browser: Browser,
  origin: string,
  app: AppMount,
  audit: Audit,
): Promise<void> {
  const context = await newContext(browser, 'light');
  const page = await context.newPage();

  const url = (path: string) =>
    app.hash ? `${origin}${app.mount}#${path}` : `${origin}${app.mount}${path}`;

  const visit = async (path: string) => {
    await goto(page, url(path));
    await page.locator('main h1').first().waitFor({ state: 'attached' });
  };

  const check = (label: string) =>
    scan(page, `${app.mount} ${label}`, 'light', audit);

  try {
    await goto(page, `${origin}${app.mount}${app.query ?? ''}`);
    await visit('/welcome');
    await check('welcome');

    await visit('/login');
    await check('login');
    await page.locator('select#username').selectOption(EMAIL_ADDRESS);
    await page.getByRole('button', { name: 'Log in' }).click();
    // login returns to the state it came from: welcome under hash, home otherwise
    await page.waitForURL((current) => !current.href.includes('/login'));
    await visit('/home');
    await check('home');

    await visit('/mymessages');
    await page.locator('table tbody tr a').first().waitFor();
    await check('inbox');
    await page.locator('table tbody tr a').first().click();
    await page.locator('.message h2').waitFor();
    await check('message');

    await visit('/contacts');
    await check('contacts');
    await page
      .locator('sample-contact-list a', { hasNotText: 'New Contact' })
      .first()
      .click();
    await page.locator('.details h2').waitFor();
    await check('contact');
    const contact = page.url();
    await goto(page, `${contact}/edit`);
    await page.locator('main input').first().waitFor();
    await check('contact edit');
    await visit('/contacts/new');
    await page.locator('main input').first().waitFor();
    await check('contact new');

    await visit('/prefs');
    await check('prefs');

    await visit('/mymessages/compose');
    await page.locator('.compose').waitFor();
    await check('compose');
  } finally {
    await context.close();
  }
}

// axe over the docs pages in both color schemes and each sample-app mount's main routes.

import { join } from 'node:path';

import { AxeBuilder } from '@axe-core/playwright';
import type { Browser, BrowserContext, Page, Request } from 'playwright';

import {
  type Finding,
  findingOf,
  type Scheme,
  screenshotName,
} from './findings.ts';

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

/** Where a scan with violations saves its page, relative to the working directory. */
export const SCREENSHOT_DIR = 'a11y-screenshots';

const screenshotNames = new Set<string>();

export interface Audit {
  axeVersion: string;
  scans: number;
  findings: Finding[];
}

/** Third-party image hosts the pages show; one that never answers holds load or the request settle. */
const IMAGE_HOSTS = ['https://img.shields.io/**', 'https://placebear.com/**'];

const IMAGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="20"><rect width="80" height="20" fill="#555"/></svg>';

async function newContext(
  browser: Browser,
  scheme: Scheme,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    colorScheme: scheme,
    reducedMotion: 'reduce',
  });

  for (const host of IMAGE_HOSTS) {
    await context.route(host, (route) =>
      route.fulfill({ contentType: 'image/svg+xml', body: IMAGE }),
    );
  }

  return context;
}

const QUIET_MS = 500;

const SETTLE_TIMEOUT_MS = 30_000;

interface Requests {
  /** Resolves once no request has been in flight for QUIET_MS; a timeout names what was. */
  settled: () => Promise<void>;
  /** The URLs in flight now. */
  pending: () => string[];
}

/**
 * The page's requests, every frame included. Stands in for networkidle, which Playwright never
 * re-fires once a request finishes after it and an iframe commit or DOMContentLoaded follows.
 */
function track(page: Page): Requests {
  const inFlight = new Set<Request>();
  let lastChange = Date.now();
  let documentPending = false;

  const update = (change: () => void) => {
    change();
    lastChange = Date.now();
  };

  page.on('request', (request) =>
    update(() => {
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        documentPending = true;
      }

      inFlight.add(request);
    }),
  );
  // recount from each document commit, as networkidle does: the outgoing document's requests never report back
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame() || !documentPending) return;
    documentPending = false;
    update(() => inFlight.clear());
  });
  page.on('requestfinished', (request) =>
    update(() => inFlight.delete(request)),
  );
  page.on('requestfailed', (request) => update(() => inFlight.delete(request)));

  const pending = () => [...inFlight].map((request) => request.url());

  const settled = async () => {
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;

    while (inFlight.size > 0 || Date.now() - lastChange < QUIET_MS) {
      if (Date.now() > deadline) {
        throw new Error(
          `requests unsettled after ${SETTLE_TIMEOUT_MS}ms: ${pending().join(' ')}`,
        );
      }

      await page.waitForTimeout(100);
    }
  };

  return { settled, pending };
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

  if (results.violations.length === 0) return;

  const findings = results.violations.map((violation) =>
    findingOf(violation, label, scheme),
  );

  audit.findings.push(...findings);

  const path = join(
    SCREENSHOT_DIR,
    screenshotName(label, scheme, screenshotNames),
  );

  try {
    await page.screenshot({ path, fullPage: true });
  } catch (error) {
    // a missing screenshot must not fail the walk
    console.error(`check-a11y: no screenshot of ${label} [${scheme}]`, error);

    return;
  }

  for (const finding of findings) finding.screenshot = path;
}

async function goto(
  page: Page,
  requests: Requests,
  url: string,
): Promise<void> {
  let response;

  try {
    response = await page.goto(url, { waitUntil: 'load' });
  } catch (error) {
    const urls = requests.pending().join(' ');

    throw new Error(`no load event; in flight: ${urls}`, { cause: error });
  }

  // null is a same-document (hash) navigation
  if (response && response.status() !== 200) {
    throw new Error(`${url} answered ${response.status()}`);
  }

  await requests.settled();
}

/** Lazy same-origin embeds load only on scroll; axe scans a frame only once it has loaded. */
async function loadEmbeds(page: Page, requests: Requests): Promise<void> {
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
  await requests.settled();
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
      const requests = track(page);

      for (let path = queue.shift(); path; path = queue.shift()) {
        try {
          await goto(page, requests, origin + path);
          await loadEmbeds(page, requests);
          await scan(page, path, scheme, audit);
        } catch (error) {
          throw new Error(`${path} [${scheme}]`, { cause: error });
        }
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
  const requests = track(page);

  const url = (path: string) =>
    app.hash ? `${origin}${app.mount}#${path}` : `${origin}${app.mount}${path}`;

  const visit = async (path: string) => {
    await goto(page, requests, url(path));
    await page.locator('main h1').first().waitFor({ state: 'attached' });
  };

  const check = (label: string) =>
    scan(page, `${app.mount} ${label}`, 'light', audit);

  try {
    await goto(page, requests, `${origin}${app.mount}${app.query ?? ''}`);
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
    await goto(page, requests, `${contact}/edit`);
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

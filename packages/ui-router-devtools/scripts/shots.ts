// Captures the proposal screenshots and runs axe on the open panel. Needs `pnpm dev --port <port>` running.
import { chromium, type Browser, type Page } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

const { values: args } = parseArgs({
  options: {
    port: { type: 'string', default: '5391' },
    out: {
      type: 'string',
      default: join(workspaceRoot, 'docs/visualizer-proposal/screenshots'),
    },
    only: { type: 'string' },
    scale: { type: 'string', default: '2' },
  },
});

const port = args.port;

const out = `${args.out}/`;

const base = `http://localhost:${port}/`;

const TAG = 'ui-router-devtools';

const only = args.only;

type Scheme = 'light' | 'dark';

const SCHEMES: readonly Scheme[] = ['light', 'dark'];

interface Shot {
  name: string;
  width: number;
  open: boolean;
  setup?: (page: Page, scheme: Scheme) => Promise<void>;
  capture?: (page: Page) => Promise<Buffer>;
  forced?: boolean;
  axe?: boolean;
}

const row = (page: Page, text: string) =>
  page.locator(`${TAG} .tx > .line`, { hasText: text }).first();

const showMap = (page: Page) =>
  page.locator(`${TAG} .switch button:visible`, { hasText: 'map' }).click();

const panel = (page: Page) => page.locator(`${TAG} .panel`);

let sessionFile = '';

// Exports the demo session through the EXPORT button, once, for the imported shot.
const exportSession = async (browser: Browser): Promise<string> => {
  if (sessionFile) return sessionFile;
  const page = await browser.newPage();
  await page.goto(`${base}?demo=1`);
  await page.waitForSelector('html[data-demo="done"]', { timeout: 20000 });
  await page.locator(`${TAG} .pill`).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator(`${TAG} .titlestrip button`, { hasText: 'Export' }).click(),
  ]);

  sessionFile = join(mkdtempSync(join(tmpdir(), 'uird-')), 'session.json');
  await download.saveAs(sessionFile);
  await page.close();

  return sessionFile;
};

// Stacks two panel captures, options above the router card, on the page's own surface.
const stack = async (
  page: Page,
  top: Buffer,
  bottom: Buffer,
): Promise<Buffer> => {
  const background = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );

  const sheet = await page.context().newPage();
  const src = (b: Buffer) => `data:image/png;base64,${b.toString('base64')}`;
  await sheet.setContent(
    `<body style="margin:0;padding:24px;background:${background};display:grid;gap:24px;justify-content:start">
      <img src="${src(top)}" style="width:${1280 - 48}px"><img src="${src(bottom)}" style="width:${1280 - 48}px"></body>`,
  );
  const shot = await sheet.screenshot({ fullPage: true });
  await sheet.close();

  return shot;
};

const browser = await chromium.launch();

const shots: Shot[] = [
  { name: '1-pill', width: 1280, open: false },
  {
    name: '2-dock-outline',
    width: 1280,
    open: true,
    axe: true,
    setup: (page) => row(page, '006').click(),
  },
  {
    name: '3-dock-map-rest',
    width: 1280,
    open: true,
    axe: true,
    setup: showMap,
  },
  {
    name: '3-dock-map-state',
    width: 1280,
    open: true,
    axe: true,
    setup: async (page) => {
      await showMap(page);
      await page
        .locator(`${TAG} .box[data-name="galaxy.stars.star"] > .head`)
        .click({ position: { x: 14, y: 12 } });
    },
  },
  {
    name: '3-dock-map',
    width: 1280,
    open: true,
    axe: true,
    setup: async (page) => {
      await row(page, '006').click();
      await showMap(page);
    },
  },
  {
    name: '2-dock-outline-fault',
    width: 1280,
    open: true,
    setup: (page) => row(page, '009').click(),
  },
  {
    name: '3-dock-map-fault',
    width: 1280,
    open: true,
    setup: async (page) => {
      await row(page, '009').click();
      await showMap(page);
    },
  },
  {
    name: '4-side-sheet',
    width: 600,
    open: true,
    axe: true,
    setup: (page) => row(page, '000').click(),
  },
  { name: '5-bottom-sheet-states', width: 390, open: true, axe: true },
  {
    name: '5-bottom-sheet-transitions',
    width: 390,
    open: true,
    setup: async (page) => {
      await page
        .locator(`${TAG} [role="tab"]`, { hasText: 'Transitions' })
        .click();
      await row(page, '009').click();
    },
  },
  {
    name: '6-forced-colors',
    width: 1280,
    open: true,
    forced: true,
    setup: (page) => row(page, '006').click(),
  },
  {
    name: '7-reasons',
    width: 1280,
    open: true,
    axe: true,
    setup: (page) => row(page, 'galaxy.planets').click(),
  },
  {
    name: '8-options-config',
    width: 1280,
    open: true,
    axe: true,
    capture: async (page) => {
      const config = await panel(page).screenshot();
      await row(page, '012').click();
      await page.mouse.move(1, 1);
      await page.waitForTimeout(200);
      const options = await panel(page).screenshot();

      return stack(page, options, config);
    },
  },
  {
    name: '8-router-side-sheet',
    width: 600,
    open: true,
    axe: true,
    setup: (page) => page.locator(`${TAG} .brand`).click(),
  },
  {
    name: '9-imported',
    width: 1280,
    open: true,
    axe: true,
    setup: async (page) => {
      await page
        .locator(`${TAG} input.file`)
        .setInputFiles(await exportSession(browser));
      await row(page, '005').click();
    },
  },
];

const violations: string[] = [];

for (const shot of shots) {
  if (only && !shot.name.startsWith(only)) continue;

  for (const scheme of SCHEMES) {
    if (shot.forced && scheme === 'dark') continue;

    const context = await browser.newContext({
      viewport: { width: shot.width, height: 800 },
      deviceScaleFactor: Number(args.scale),
      colorScheme: scheme,
      forcedColors: shot.forced ? 'active' : 'none',
      reducedMotion: 'reduce',
      acceptDownloads: true,
    });

    const page = await context.newPage();
    const imported = shot.name.startsWith('9-');
    await page.goto(imported ? base : `${base}?demo=1`);

    if (imported) await page.waitForTimeout(800);
    else
      await page.waitForSelector('html[data-demo="done"]', { timeout: 20000 });

    if (shot.open) await page.locator(`${TAG} .pill`).click();
    await shot.setup?.(page, scheme);
    await page.mouse.move(1, 1);
    await page.waitForTimeout(300);
    const path = `${out}${shot.name}-${shot.forced ? 'forced' : scheme}.png`;

    if (shot.axe && scheme === 'light') {
      const result = await new AxeBuilder({ page }).include(TAG).analyze();

      for (const v of result.violations)
        violations.push(
          `${shot.name}: ${v.id} (${v.impact}) x${v.nodes.length} ${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(' | ')}`,
        );
    }

    if (shot.capture) {
      writeFileSync(path, await shot.capture(page));
    } else await page.screenshot({ path });
    await context.close();
  }
}

await browser.close();

console.log(violations.length ? violations.join('\n') : 'axe: no violations');

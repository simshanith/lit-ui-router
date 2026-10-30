// Lighthouse lab metrics for the page, prerendered and cold, in the Chrome Playwright launches.
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';

import lighthouse from 'lighthouse';
import type { Flags } from 'lighthouse';
import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import puppeteer from 'puppeteer-core';
import type { Browser as LighthouseBrowser } from 'puppeteer-core';

import { BOOT_PATHS, DOCUMENT_PATTERNS, fulfillDocument } from './boot.ts';
import type { BootPath } from './boot.ts';
import { CPU_RATE, NETWORK } from './conditions.ts';
import { ms, withRuns, writeSection } from './report.ts';
import { ours } from './targets.ts';

const QUERY = 'lituirouter';

const RUNS = Number(process.env.DOMAIN_SEARCH_RUNS ?? 3);

const target = ours(
  process.env.DOMAIN_SEARCH_ORIGIN ?? 'http://localhost:8787',
);

const kbps = (bytesPerSecond: number): number => (bytesPerSecond * 8) / 1024;

// DevTools throttling with the harness's own CPU and network numbers, on a desktop screen.
const FLAGS: Flags = {
  output: 'json',
  logLevel: 'error',
  onlyCategories: ['performance'],
  formFactor: 'desktop',
  screenEmulation: {
    mobile: false,
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    disabled: false,
  },
  throttlingMethod: 'devtools',
  throttling: {
    requestLatencyMs: NETWORK.latency,
    downloadThroughputKbps: kbps(NETWORK.downloadThroughput),
    uploadThroughputKbps: kbps(NETWORK.uploadThroughput),
    cpuSlowdownMultiplier: CPU_RATE,
  },
};

const CONDITIONS = `Lighthouse (navigation, desktop 1280x800, devtools throttling: CPU ${CPU_RATE}x, ${NETWORK.latency} ms, ${Math.round(kbps(NETWORK.downloadThroughput))} kbit/s down)`;

const METRICS = [
  ['FCP', 'first-contentful-paint', ms],
  ['LCP', 'largest-contentful-paint', ms],
  ['TBT', 'total-blocking-time', ms],
  ['CLS', 'cumulative-layout-shift', (value: number) => value.toFixed(3)],
  ['TTI', 'interactive', ms],
] as const;

type Audit = (typeof METRICS)[number][1];

const runs = (): Record<Audit, number[]> => ({
  'first-contentful-paint': [],
  'largest-contentful-paint': [],
  'total-blocking-time': [],
  'cumulative-layout-shift': [],
  interactive: [],
});

const values: Record<BootPath, Record<Audit, number[]>> = {
  prerendered: runs(),
  cold: runs(),
};

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      // SAFETY: a server listening on a TCP port reports an AddressInfo.
      const { port } = server.address() as AddressInfo;

      server.close(() => resolve(port));
    });
  });

let browser: Browser;

let remote: LighthouseBrowser;

before(async () => {
  const port = await freePort();

  browser = await chromium.launch({
    args: [`--remote-debugging-port=${port}`],
  });
  remote = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
});

after(async () => {
  await remote.disconnect();
  await browser.close();
  await writeSection({
    title: 'domain-search: Lighthouse lab metrics',
    lead: [
      `${target.withQuery(QUERY)}, ${CONDITIONS}, a fresh browser context per run, ${RUNS} runs per path, interleaved; median [runs]. Paths as in the table above.`,
    ],
    header: ['Metric', 'prerendered', 'cold'],
    rows: METRICS.map(([label, id, format]) => [
      label,
      ...BOOT_PATHS.map((path) => withRuns(values[path][id], format)),
    ]),
  });
});

const measure = async (path: BootPath): Promise<void> => {
  const context = await remote.createBrowserContext();

  try {
    const page = await context.newPage();
    const cdp = await page.createCDPSession();

    cdp.on('Fetch.requestPaused', (paused) => {
      void cdp
        .send('Fetch.getResponseBody', { requestId: paused.requestId })
        .then((body) =>
          cdp.send('Fetch.fulfillRequest', fulfillDocument(path, paused, body)),
        );
    });
    await cdp.send('Fetch.enable', { patterns: [...DOCUMENT_PATTERNS] });

    const result = await lighthouse(
      target.withQuery(QUERY),
      FLAGS,
      undefined,
      page,
    );

    assert.ok(result, 'Lighthouse returned a result');
    assert.equal(result.lhr.runtimeError, undefined, `${path}: runtime error`);

    for (const [, id] of METRICS) {
      const value = result.lhr.audits[id]?.numericValue;

      if (value === undefined) assert.fail(`${path}: no ${id} value`);
      values[path][id].push(value);
    }
  } finally {
    await context.close();
  }
};

describe(CONDITIONS, () => {
  test('lab metrics, prerendered and cold', async () => {
    for (let run = 0; run < RUNS; run += 1) {
      for (const path of BOOT_PATHS) await measure(path);
    }
  });
});

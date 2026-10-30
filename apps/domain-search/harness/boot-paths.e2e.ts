// #1698's prerendered vs cold: the same page booted from the served document and from one with nothing to adopt.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { chromium } from 'playwright';
import type { Browser, CDPSession, Page } from 'playwright';

import { BOOT_PATHS, DOCUMENT_PATTERNS, fulfillDocument } from './boot.ts';
import type { BootPath } from './boot.ts';
import { CONDITIONS, frameZero, throttledPage } from './conditions.ts';
import { ms, withRuns, writeSection } from './report.ts';
import { ours } from './targets.ts';
import { VITALS, flushVitals, installVitals, readBlocking } from './vitals.ts';
import type { Blocking, Vital } from './vitals.ts';

const QUERY = 'lituirouter';

const RUNS = Number(process.env.DOMAIN_SEARCH_RUNS ?? 3);

const target = ours(
  process.env.DOMAIN_SEARCH_ORIGIN ?? 'http://localhost:8787',
);

/** What `main.ts` writes on `<html>` once `bootstrap()` resolves. */
const OUTCOME: Record<BootPath, string> = {
  prerendered: 'adopted',
  cold: 'cold',
};

interface Timings {
  fcp: number[];
  focused: number[];
  reflected: number[];
}

const timings: Record<BootPath, Timings> = {
  prerendered: { fcp: [], focused: [], reflected: [] },
  cold: { fcp: [], focused: [], reflected: [] },
};

type Load = Record<Vital | keyof Blocking, (number | undefined)[]>;

const load = (): Load => ({
  LCP: [],
  CLS: [],
  INP: [],
  FCP: [],
  TTFB: [],
  total: [],
  longest: [],
});

// Web Vitals and LoAF blocking from the typing load, per path.
const loads: Record<BootPath, Load> = { prerendered: load(), cold: load() };

const cls = (value: number): string => value.toFixed(3);

// Runs without a value (LCP, when typing beat the largest paint) are counted, not dropped.
const present = (
  values: (number | undefined)[],
  format: (value: number) => string,
): string => {
  const measured = values.filter((value) => value !== undefined);
  const none = values.length - measured.length;

  if (measured.length === 0) return `none [${values.length} runs]`;

  return none === 0
    ? withRuns(measured, format)
    : `${withRuns(measured, format)}, none in ${none}`;
};

const LOAD_ROWS: [string, keyof Load, (value: number) => string][] = [
  ...VITALS.map((name): [string, Vital, (value: number) => string] => [
    name,
    name,
    name === 'CLS' ? cls : ms,
  ]),
  ['LoAF blocking, navigation start → typed query in results', 'total', ms],
  ['Longest animation frame, same window', 'longest', ms],
];

const ROWS: [string, keyof Timings][] = [
  ['First contentful paint (`?q=`)', 'fcp'],
  ['Navigation start → focused input', 'focused'],
  ['Navigation start → typed query in results', 'reflected'],
];

let browser: Browser;

before(async () => {
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await writeSection({
    title: 'domain-search: prerendered vs cold',
    lead: [
      `${target.idle}, ${CONDITIONS}, ${RUNS} runs per path, interleaved; median [runs].`,
      '',
      '- **prerendered:** the served document; `bootstrap()` adopts it.',
      '- **cold:** the same response with `#root` emptied, so `bootstrap()` has nothing to adopt and renders.',
      '- Both documents are paused after the throttled response and fulfilled, so they pay the same.',
      '- Focused input: the first animation frame with the input focused. The cold page has no pre-paint script, so the harness focuses its input on the first frame it exists, as a click would.',
    ],
    header: ['Metric', 'prerendered', 'cold'],
    rows: ROWS.map(([label, key]) => [
      label,
      ...BOOT_PATHS.map((path) => withRuns(timings[path][key], ms)),
    ]),
  });
  await writeSection({
    title: 'domain-search: Web Vitals and Long Animation Frames',
    lead: [
      `${target.idle}, typing \`${QUERY}\`, the same loads as the keystroke row above; median [runs].`,
      '',
      '- [web-vitals](https://github.com/GoogleChrome/web-vitals) with `reportAllChanges`, injected by the harness. INP covers the typing. Chrome stops LCP at the first input, so a run that types before the largest paint has none.',
      '- The page is hidden after the typed query shows, so each metric reports its final value.',
      "- LoAF blocking sums `blockingDuration` over the long animation frames that start before the typed query shows. It stands in for Lighthouse's TBT.",
    ],
    header: ['Metric', 'prerendered', 'cold'],
    rows: LOAD_ROWS.map(([label, key, format]) => [
      label,
      ...BOOT_PATHS.map((path) => present(loads[path][key], format)),
    ]),
  });
});

/** Serves `path`'s document to the page. */
const serve = async (cdp: CDPSession, path: BootPath): Promise<void> => {
  cdp.on('Fetch.requestPaused', (paused) => {
    void cdp
      .send('Fetch.getResponseBody', { requestId: paused.requestId })
      .then((body) =>
        cdp.send('Fetch.fulfillRequest', fulfillDocument(path, paused, body)),
      );
  });
  await cdp.send('Fetch.enable', { patterns: [...DOCUMENT_PATTERNS] });
};

const open = async (
  path: BootPath,
): Promise<{ page: Page; close: () => Promise<void> }> => {
  const { page, cdp, close } = await throttledPage(browser, target);

  await serve(cdp, path);

  return { page, close };
};

// The first frame the input shows focused: the pre-paint script focuses the prerendered input
// while the document parses, and the cold one, once rendered, is focused here, as a click would.
const focusedFrame = (selector: string): Promise<number> =>
  new Promise((resolve) => {
    const frame = (): void => {
      const input = document.querySelector<HTMLInputElement>(selector);

      if (input && document.activeElement !== input) input.focus();

      if (input && document.activeElement === input) resolve(performance.now());
      else requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  });

const firstPaint = async (path: BootPath): Promise<void> => {
  const { page, close } = await open(path);

  try {
    await page.goto(target.withQuery(QUERY), { waitUntil: 'commit' });
    timings[path].fcp.push((await frameZero(page)).fcp);
  } finally {
    await close();
  }
};

const firstKeystroke = async (path: BootPath): Promise<void> => {
  const { page, close } = await open(path);

  try {
    await installVitals(page);
    await page.goto(target.idle, { waitUntil: 'commit' });

    timings[path].focused.push(await page.evaluate(focusedFrame, target.input));
    await page.keyboard.type(QUERY);

    const shown = await page.waitForFunction(
      (needle) =>
        document.body.innerText.replace(/\s/g, '').includes(needle) &&
        performance.now(),
      `${QUERY}.com`,
      { timeout: 120_000, polling: 'raf' },
    );

    const reflected = Number(await shown.jsonValue());

    timings[path].reflected.push(reflected);
    await page.waitForFunction(target.booted, undefined, { timeout: 60_000 });
    assert.equal(
      await page.getAttribute('html', 'data-domain-search-booted'),
      OUTCOME[path],
      `booted ${path}`,
    );

    const blocking = await readBlocking(page, reflected);
    const vitals = await flushVitals(page);

    for (const name of VITALS) loads[path][name].push(vitals[name]);
    loads[path].total.push(blocking.total);
    loads[path].longest.push(blocking.longest);
  } finally {
    await close();
  }
};

describe(`prerendered vs cold, ${CONDITIONS}`, () => {
  test('first contentful paint at ?q=', async () => {
    for (let run = 0; run < RUNS; run += 1) {
      for (const path of BOOT_PATHS) await firstPaint(path);
    }
  });

  test('time to the first useful keystroke, with Web Vitals and LoAF, booted as each path', async () => {
    for (let run = 0; run < RUNS; run += 1) {
      for (const path of BOOT_PATHS) await firstKeystroke(path);
    }
  });
});

// The #1698 measurements: frame 0, typing before boot, time to the first useful keystroke, and the skeleton.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { TestContext } from 'node:test';

import { chromium } from 'playwright';
import type { Browser, Page, Route } from 'playwright';

import { CONDITIONS, frameZero, throttledPage } from './conditions.ts';
import { median } from './report.ts';
import { ours, vercel } from './targets.ts';
import type { Target } from './targets.ts';

const QUERY = 'lituirouter';

const RUNS = Number(process.env.DOMAIN_SEARCH_RUNS ?? 3);

const origin = process.env.DOMAIN_SEARCH_ORIGIN;

const target: Target =
  origin === 'vercel' ? vercel : ours(origin ?? 'http://localhost:8787');

// The query-only elsewhere fix (branch fix/ssr-elsewhere-stale-params) flips these; Vercel's page has no such step.
const PENDING_ELSEWHERE_FIX = target.external
  ? false
  : {
      label:
        'bootstrap keeps the drawn data-view on a query-only elsewhere boot (fix/ssr-elsewhere-stale-params)',
      match: /'idle' !== 'results'/,
    };

let browser: Browser;

before(async () => {
  browser = await chromium.launch();
});

after(() => browser.close());

const open = (): ReturnType<typeof throttledPage> =>
  throttledPage(browser, target);

// page.url() can lag a replaceState; the page's own location cannot.
const queryIn = async (page: Page): Promise<string | null> =>
  new URL(await page.evaluate(() => location.href)).searchParams.get('q');

const isFocused = (selector: string): boolean => {
  const input = document.querySelector(selector);

  return !!input && document.activeElement === input;
};

const whenBooted = async (page: Page): Promise<void> => {
  await page.waitForFunction(target.booted, undefined, { timeout: 120_000 });
};

const report = (t: TestContext, metric: string, values: number[]): void => {
  t.diagnostic(
    `${target.name} ${metric}: median ${Math.round(median(values))} ms of [${values.map(Math.round).join(', ')}]`,
  );
};

describe(`${target.name}, ${CONDITIONS}`, () => {
  test('frame 0: the input is focused and filled from ?q=', async (t) => {
    const fcps: number[] = [];

    for (let run = 0; run < RUNS; run += 1) {
      const { page, close } = await open();

      try {
        await page.goto(target.withQuery(QUERY), { waitUntil: 'commit' });
        const seen = await frameZero(page);

        fcps.push(seen.fcp);
        assert.equal(seen.value, QUERY, 'filled at first contentful paint');
        assert.ok(seen.focused, 'focused at first contentful paint');
      } finally {
        await close();
      }
    }

    report(t, 'first contentful paint (?q=)', fcps);
  });

  test('skeleton: the hero without ?q=', async () => {
    const { page, close } = await open();

    try {
      await page.goto(target.idle, { waitUntil: 'commit' });
      const seen = await frameZero(page);

      assert.ok(seen.hero, 'hero at first contentful paint');
      assert.ok(
        !seen.skeleton,
        'no results skeleton at first contentful paint',
      );
    } finally {
      await close();
    }
  });

  test('skeleton: results without the hero with ?q=', async () => {
    const { page, close } = await open();

    try {
      await page.goto(target.withQuery(QUERY), { waitUntil: 'commit' });
      const seen = await frameZero(page);

      assert.ok(!seen.hero, 'no hero at first contentful paint');
      assert.ok(seen.skeleton, 'results skeleton at first contentful paint');
    } finally {
      await close();
    }
  });

  test('typed before boot: the text survives and the url is synced', async () => {
    const { page, close } = await open();
    const held: Route[] = [];
    let release = false;

    try {
      await page.route(target.appScripts, (route) =>
        release ? route.continue() : held.push(route),
      );
      await page.goto(target.idle, { waitUntil: 'commit' });
      await page.waitForFunction(isFocused, target.input, { timeout: 60_000 });
      await page.keyboard.type(QUERY);

      assert.equal(await queryIn(page), QUERY, 'url synced before boot');
      assert.ok(!(await page.evaluate(target.booted)), 'typed before boot');

      release = true;
      await Promise.all(held.map((route) => route.continue()));
      await whenBooted(page);
      await page.waitForFunction(
        (needle) => document.body.innerText.replace(/\s/g, '').includes(needle),
        `${QUERY}.com`,
        { timeout: 60_000 },
      );

      assert.equal(
        await page.inputValue(target.input),
        QUERY,
        'text survived boot',
      );
      assert.equal(await queryIn(page), QUERY, 'url kept after boot');
    } finally {
      await close();
    }
  });

  test('time to the first useful keystroke', async (t) => {
    const reflected: number[] = [];
    const focused: number[] = [];

    for (let run = 0; run < RUNS; run += 1) {
      const { page, close } = await open();

      try {
        await page.goto(target.idle, { waitUntil: 'commit' });

        const focus = await page.waitForFunction(
          (selector) => {
            const input = document.querySelector(selector);

            return (
              !!input && document.activeElement === input && performance.now()
            );
          },
          target.input,
          { timeout: 60_000, polling: 'raf' },
        );

        focused.push(Number(await focus.jsonValue()));
        await page.keyboard.type(QUERY);

        const shown = await page.waitForFunction(
          (needle) =>
            document.body.innerText.replace(/\s/g, '').includes(needle) &&
            performance.now(),
          `${QUERY}.com`,
          { timeout: 120_000, polling: 'raf' },
        );

        reflected.push(Number(await shown.jsonValue()));
      } finally {
        await close();
      }
    }

    report(t, 'navigation start to focused input', focused);
    report(t, 'navigation start to the keystrokes shown in results', reflected);
  });

  test(
    'after a boot at ?q=, the input sits in the bar',
    { skip: target.external, expectFailure: PENDING_ELSEWHERE_FIX },
    async () => {
      const { page, close } = await open();

      try {
        await page.goto(target.withQuery(QUERY), { waitUntil: 'commit' });
        await whenBooted(page);

        assert.equal(
          await page.getAttribute('.domain-search', 'data-view'),
          'results',
        );
      } finally {
        await close();
      }
    },
  );
});

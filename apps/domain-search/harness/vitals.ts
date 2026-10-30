// Web Vitals (Google's web-vitals) and Long Animation Frames, collected in the page the harness types into.
import { readFile } from 'node:fs/promises';

import type { Page } from 'playwright';
import type { MetricType } from 'web-vitals';

/** The metrics web-vitals reports, in table order. */
export const VITALS = ['LCP', 'CLS', 'INP', 'FCP', 'TTFB'] as const;

export type Vital = (typeof VITALS)[number];

/** A metric web-vitals never reported: LCP when typing beat the largest paint, INP on a load with no input. */
export type Vitals = Record<Vital, number | undefined>;

/** Main-thread blocking from navigation start to the end of the measured window; replaces Lighthouse's TBT. */
export interface Blocking {
  /** Sum of `blockingDuration` over the long animation frames that started in the window. */
  total: number;
  /** The longest of those frames' `duration`. */
  longest: number;
}

interface LoafRecord {
  startTime: number;
  duration: number;
  blockingDuration: number;
}

declare global {
  interface Window {
    __vitals?: Partial<Record<MetricType['name'], number>>;
    __loaf?: PerformanceObserver;
    __loafs?: LoafRecord[];
  }
}

// The IIFE build, a sibling of the package's entry, since its exports map doesn't name it.
const IIFE = new URL('web-vitals.iife.js', import.meta.resolve('web-vitals'));

// `durationThreshold: 16` lets INP count keystrokes under the library's 40 ms default.
const COLLECTOR = `
window.__vitals = {};
const record = (metric) => { window.__vitals[metric.name] = metric.value; };
webVitals.onLCP(record, { reportAllChanges: true });
webVitals.onCLS(record, { reportAllChanges: true });
webVitals.onINP(record, { reportAllChanges: true, durationThreshold: 16 });
webVitals.onFCP(record, { reportAllChanges: true });
webVitals.onTTFB(record, { reportAllChanges: true });
window.__loafs = [];
window.__loaf = new PerformanceObserver((list) => {
  for (const { startTime, duration, blockingDuration } of list.getEntries()) {
    window.__loafs.push({ startTime, duration, blockingDuration });
  }
});
window.__loaf.observe({ type: 'long-animation-frame', buffered: true });
`;

/** Installs web-vitals and the LoAF observer in every document `page` loads; the app's bundle never carries them. */
export const installVitals = async (page: Page): Promise<void> => {
  await page.addInitScript({
    content: `${await readFile(IIFE, 'utf8')}\n${COLLECTOR}`,
  });
};

/** Blocking in the long animation frames that started before `end`. */
export const readBlocking = (page: Page, end: number): Promise<Blocking> =>
  page.evaluate((until) => {
    // SAFETY: installVitals put the observer and its list on the page.
    const loafs = window.__loafs!;

    for (const entry of window.__loaf!.takeRecords()) {
      // SAFETY: the observer watches long-animation-frame entries only.
      const { startTime, duration, blockingDuration } =
        entry as PerformanceEntry & { blockingDuration: number };

      loafs.push({ startTime, duration, blockingDuration });
    }

    const frames = loafs.filter(({ startTime }) => startTime < until);

    return {
      total: frames.reduce((sum, frame) => sum + frame.blockingDuration, 0),
      longest: Math.max(0, ...frames.map(({ duration }) => duration)),
    };
  }, end);

/** Hides the page, as web-vitals' own tests do, so every metric reports its final value; only `absent` may go unreported. */
export const flushVitals = async (
  page: Page,
  absent: readonly Vital[],
): Promise<Vitals> => {
  const reported = await page.evaluate(async () => {
    // let the last keystroke's event-timing entries queue before the flush takes them
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));

    // SAFETY: installVitals put the record on the page.
    return window.__vitals!;
  });

  // SAFETY: one entry per name in VITALS, each outside `absent` checked present.
  return Object.fromEntries(
    VITALS.map((name) => {
      const value = reported[name];

      if (value === undefined && !absent.includes(name)) {
        throw new Error(`web-vitals reported no ${name}`);
      }

      return [name, value];
    }),
  ) as Vitals;
};

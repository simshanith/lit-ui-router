// The throttled Chrome every measurement runs in.
import type { Browser, CDPSession, Page } from 'playwright';

/** CPU slowdown, as DevTools' "4x slowdown". */
export const CPU_RATE = 4;

/** DevTools' "Slow 4G" preset. */
export const NETWORK = {
  offline: false,
  latency: 562.5,
  downloadThroughput: (1.6 * 1024 * 1024 * 0.9) / 8,
  uploadThroughput: (750 * 1024 * 0.9) / 8,
};

export const CONDITIONS = `Chrome (Playwright), CPU ${CPU_RATE}x, Slow 4G (${NETWORK.latency} ms, ${Math.round((NETWORK.downloadThroughput * 8) / 1024)} kbit/s down), 1280x800, cold cache`;

/** What the page saw at first contentful paint. */
export interface FrameZero {
  fcp: number;
  focused: boolean;
  value: string | null;
  hero: boolean;
  skeleton: boolean;
  booted: boolean;
}

declare global {
  interface Window {
    __frameZero?: FrameZero;
  }
}

// Runs in the task after first contentful paint, before anything the module would do later.
const frameZeroProbe = (
  input: string,
  hero: string,
  skeleton: string,
  booted: string,
): string => `
new PerformanceObserver((list, observer) => {
  const entry = list.getEntriesByName('first-contentful-paint')[0];
  if (!entry || window.__frameZero) return;
  observer.disconnect();
  const input = document.querySelector(${JSON.stringify(input)});
  window.__frameZero = {
    fcp: entry.startTime,
    focused: !!input && document.activeElement === input,
    value: input ? input.value : null,
    hero: ${hero},
    skeleton: ${skeleton},
    booted: ${booted},
  };
}).observe({ type: 'paint', buffered: true });
`;

export interface Probes {
  input: string;
  hero: string;
  skeleton: string;
  booted: string;
}

/** A fresh context and page under the throttle, with the frame-0 probe installed. */
export const throttledPage = async (
  browser: Browser,
  probes: Probes,
): Promise<{ page: Page; cdp: CDPSession; close: () => Promise<void> }> => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', NETWORK);
  await page.addInitScript({
    content: frameZeroProbe(
      probes.input,
      probes.hero,
      probes.skeleton,
      probes.booted,
    ),
  });

  return { page, cdp, close: () => context.close() };
};

/** Resolves with what the page saw at first contentful paint. */
export const frameZero = async (page: Page): Promise<FrameZero> => {
  const handle = await page.waitForFunction(
    () => window.__frameZero,
    undefined,
    {
      timeout: 60_000,
    },
  );

  // the predicate resolves only once the probe has written the record
  return (await handle.jsonValue())!;
};

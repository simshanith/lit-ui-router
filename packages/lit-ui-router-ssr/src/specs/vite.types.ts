import type { PrerenderEntry as SitePrerenderEntry } from 'ui-router-server/vite';

import type { PagePayload } from '../prerender.js';
import type { PrerenderEntry } from '../vite.js';

// Type-level checks on definePrerender's entry: the compile is the assertion (package `typecheck`; the umbrella tsconfig covers src/specs), and nothing here runs.

/** A page in the entry's result reads its payload report without a cast. */
export const readsPayload = async (
  entry: PrerenderEntry,
  build: Parameters<PrerenderEntry>[0],
): Promise<PagePayload | undefined> => (await entry(build)).pages[0]?.payload;

/** The entry stays a default export the build step accepts. */
export const asSiteEntry = (entry: PrerenderEntry): SitePrerenderEntry => entry;

/** The result drops the root event target, which the worker can't post back. */
export const dropsRoot: 'root' extends keyof Awaited<ReturnType<PrerenderEntry>>
  ? never
  : true = true;

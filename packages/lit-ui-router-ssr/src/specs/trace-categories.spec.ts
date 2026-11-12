import { trace, UIRouter } from '@uirouter/core';
import type { Trace } from '@uirouter/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  registerTraceCategory,
  traceCategoryEnabled,
} from '../trace-categories.js';

/** Core's own on/off record, keyed by normalized category name. */
const coreEnabled = (): Record<string, boolean> => trace['_enabled'];

const registered = (...names: string[]): UIRouter => {
  const router = new UIRouter();

  for (const name of names) registerTraceCategory(router, name);

  return router;
};

afterEach(() => {
  registered('HYDRATION', 'PRERENDER').trace.disable();
  trace.disable();
  vi.restoreAllMocks();
});

describe('registerTraceCategory', () => {
  it("switches a registered name without touching core's record", () => {
    const router = registered('HYDRATION');

    router.trace.enable('HYDRATION');

    expect(router.trace.enabled('HYDRATION')).toBe(true);
    expect(traceCategoryEnabled('HYDRATION')).toBe(true);
    expect(Object.keys(coreEnabled())).not.toContain('HYDRATION');
    expect(Object.keys(coreEnabled())).not.toContain('undefined');

    router.trace.disable('HYDRATION');

    expect(router.trace.enabled('HYDRATION')).toBe(false);
  });

  it('keeps registered names apart, where core folds unknown names into one', () => {
    const router = registered('HYDRATION', 'PRERENDER');

    router.trace.enable('HYDRATION');

    expect(router.trace.enabled('PRERENDER')).toBe(false);
    trace.enable('ANYTHING');

    try {
      expect(trace.enabled('SOMETHING ELSE')).toBe(true);
      expect(router.trace.enabled('PRERENDER')).toBe(false);
    } finally {
      trace.disable('ANYTHING');
    }
  });

  it('covers registered names with a no-argument enable and disable', () => {
    const router = registered('HYDRATION', 'PRERENDER');

    router.trace.enable();

    expect(router.trace.enabled('HYDRATION')).toBe(true);
    expect(router.trace.enabled('PRERENDER')).toBe(true);
    expect(trace.enabled('TRANSITION')).toBe(true);

    router.trace.disable();

    expect(router.trace.enabled('HYDRATION')).toBe(false);
    expect(trace.enabled('TRANSITION')).toBe(false);
  });

  it('forwards core categories, mixed with registered ones, to core', () => {
    const router = registered('HYDRATION');

    router.trace.enable('TRANSITION', 'HYDRATION');

    expect(trace.enabled('TRANSITION')).toBe(true);
    expect(router.trace.enabled('TRANSITION')).toBe(true);
    expect(router.trace.enabled('RESOLVE')).toBe(false);
    expect(router.trace.enabled('HYDRATION')).toBe(true);
  });

  it("inherits core's trace methods, which read the wrapper's switches", () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const router = registered('HYDRATION');

    router.trace.enable('UIVIEW');
    // SAFETY: core's traceUIViewEvent writes `ui-view (defunct)` for a missing view, which this probe reads.
    router.trace.traceUIViewEvent('Probe', undefined as never);

    expect(log).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^ui-view: Probe {26}ui-view \(defunct\)$/),
    );
  });

  it('agrees across routers sharing core’s singleton', () => {
    const first = registered('HYDRATION');
    const second = registered('HYDRATION');

    first.trace.enable('HYDRATION');

    expect(second.trace.enabled('HYDRATION')).toBe(true);
    expect(first.trace).not.toBe(trace);
  });

  it('installs one wrapper per router however often it registers', () => {
    const router = registered('HYDRATION');
    const wrapper = router.trace;

    registerTraceCategory(router, 'HYDRATION');
    registerTraceCategory(router, 'PRERENDER');

    expect(router.trace).toBe(wrapper);
    expect(Object.getPrototypeOf(wrapper)).toBe(trace);
  });

  it('steps aside for a trace that registers categories itself', () => {
    const router = new UIRouter();
    const registerCategory = vi.fn();

    // SAFETY: an Object.create of core's Trace inherits every member.
    const native = Object.assign(Object.create(trace) as Trace, {
      registerCategory,
    });

    router.trace = native;

    registerTraceCategory(router, 'HYDRATION');

    expect(registerCategory).toHaveBeenCalledExactlyOnceWith('HYDRATION');
    expect(router.trace).toBe(native);
  });

  it("reads a natively registered category through core's own enabled", () => {
    const native = Object.assign(trace, { registerCategory: vi.fn() });

    try {
      vi.spyOn(trace, 'enabled').mockReturnValue(true);

      expect(traceCategoryEnabled('HYDRATION')).toBe(true);
      expect(trace.enabled).toHaveBeenCalledWith('HYDRATION');
    } finally {
      // SAFETY: the member was assigned above, and deleting it restores core's singleton.
      delete (native as Partial<typeof native>).registerCategory;
    }
  });
});

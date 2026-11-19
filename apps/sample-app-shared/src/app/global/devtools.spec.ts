import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';
import type { UIRouterDevtools } from 'ui-router-devtools/plugin';

import { featureFlags } from '../util/featureDetection.js';
import { restSpan } from '../util/restSpan.js';
import {
  exportsSpans,
  installDevtools,
  startAfterDevtools,
  tryInstallDevtools,
} from './devtools.js';

const panel = () =>
  document.querySelector<UIRouterDevtools>('ui-router-devtools');

describe('installDevtools', () => {
  let router: UIRouter;

  beforeEach(() => {
    featureFlags.resetAll();
    router = new UIRouter();
    router.plugin(servicesPlugin);
    router.plugin(memoryLocationPlugin);
  });

  afterEach(() => {
    router.dispose();
    featureFlags.resetAll();
    sessionStorage.clear();
  });

  it('loads no telemetry with enable-otel off', async () => {
    featureFlags.set('enable-otel', false);
    const load = vi.fn(() => import('./telemetry.js'));

    await installDevtools(router, load);

    expect(panel()).not.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('feeds the panel spans with enable-otel on', async () => {
    const load = vi.fn(() => import('./telemetry.js'));

    await installDevtools(router, load);
    await restSpan('GET', 'contacts', () => Promise.resolve([]));

    expect(load).toHaveBeenCalledOnce();
    expect(panel()?.spans.map(({ name }) => name)).toContain('GET contacts');
  });
});

describe('startAfterDevtools', () => {
  const router = new UIRouter();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts the router only once the install has finished', async () => {
    const order: string[] = [];

    const install = vi.fn(async () => {
      await Promise.resolve();
      order.push('installed');
    });

    const started = startAfterDevtools(
      router,
      () => order.push('started'),
      install,
    );

    expect(order).toEqual([]);

    await started;

    expect(install).toHaveBeenCalledWith(router);
    expect(order).toEqual(['installed', 'started']);
  });

  it('starts the router when the install fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const start = vi.fn();
    const failure = new Error('chunk failed to load');

    await startAfterDevtools(router, start, () => Promise.reject(failure));

    expect(start).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith('The devtools are off:', failure);
  });
});

describe('tryInstallDevtools', () => {
  it('warns and settles when the install fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failure = new Error('chunk failed to load');

    await tryInstallDevtools(new UIRouter(), () => Promise.reject(failure));

    expect(warn).toHaveBeenCalledWith('The devtools are off:', failure);
    warn.mockRestore();
  });
});

describe('exportsSpans', () => {
  beforeEach(() => {
    featureFlags.resetAll();
    vi.stubEnv('VITE_OTLP_TRACES_ENDPOINT', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete globalThis.__OTLP_TRACES__;
    featureFlags.resetAll();
  });

  it('is off with no endpoint', () => {
    expect(exportsSpans()).toBe(false);
  });

  it('is on with a harness override', () => {
    globalThis.__OTLP_TRACES__ = {
      endpoint: 'http://127.0.0.1:4318/v1/traces',
    };

    expect(exportsSpans()).toBe(true);
  });

  it("is on with the build's endpoint", () => {
    vi.stubEnv('VITE_OTLP_TRACES_ENDPOINT', 'http://127.0.0.1:4318/v1/traces');

    expect(exportsSpans()).toBe(true);
  });

  it('is off with enable-otel off, whatever the endpoint', () => {
    globalThis.__OTLP_TRACES__ = {
      endpoint: 'http://127.0.0.1:4318/v1/traces',
    };
    featureFlags.set('enable-otel', false);

    expect(exportsSpans()).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';
import type { UIRouterDevtools } from 'ui-router-devtools/plugin';

import { featureFlags } from '../util/featureDetection.js';
import { restSpan } from '../util/restSpan.js';
import { installDevtools } from './devtools.js';

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

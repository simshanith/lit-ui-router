import type { UIRouter } from '@uirouter/core';

import { featureFlags } from '../util/featureDetection.js';

type LoadTelemetry = () => Promise<typeof import('./telemetry.js')>;

/** Adds the devtools panel, then, with `enable-otel`, the telemetry chunk that feeds its Timeline. */
export async function installDevtools(
  router: UIRouter,
  loadTelemetry: LoadTelemetry = () => import('./telemetry.js'),
): Promise<void> {
  const { DevtoolsPlugin } = await import('ui-router-devtools/plugin');
  const devtools = router.plugin(DevtoolsPlugin);

  if (!featureFlags.get('enable-otel')) return;

  const { installTelemetry } = await loadTelemetry();
  installTelemetry(router, () => devtools.element);
}

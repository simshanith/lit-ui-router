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
  await installTelemetry(router, () => devtools.element);
}

/** Starts the router once the devtools are in, so their plugins see its first transition; a failed install still starts it. */
export async function startAfterDevtools(
  router: UIRouter,
  start: () => void,
  install: (router: UIRouter) => Promise<void> = installDevtools,
): Promise<void> {
  try {
    await install(router);
  } catch (error) {
    console.warn('The devtools are off:', error);
  }

  start();
}

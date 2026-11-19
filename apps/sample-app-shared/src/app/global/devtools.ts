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

type Install = (router: UIRouter) => Promise<void>;

/** Installs the devtools and warns when that fails, so a chunk that does not load never stops the app. */
export async function tryInstallDevtools(
  router: UIRouter,
  install: Install = installDevtools,
): Promise<void> {
  try {
    await install(router);
  } catch (error) {
    console.warn('The devtools are off:', error);
  }
}

/** Starts the router once the devtools are in, so their plugins see its first transition; a failed install still starts it. */
export async function startAfterDevtools(
  router: UIRouter,
  start: () => void,
  install: Install = installDevtools,
): Promise<void> {
  await tryInstallDevtools(router, install);
  start();
}

/** Whether spans leave the page: `enable-otel` is on and a harness override or the build names an OTLP endpoint. */
export const exportsSpans = (): boolean =>
  featureFlags.get('enable-otel') &&
  Boolean(
    globalThis.__OTLP_TRACES__?.endpoint ||
    import.meta.env.VITE_OTLP_TRACES_ENDPOINT,
  );

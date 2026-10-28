// The development-only warnings; folded out of dist/*.js by check:dev-split.

import { devGate } from '#dev-gate';

import type { MountDiagnostic, ServerRouter } from './index.ts';

/**
 * Passes each of a new router's mount diagnostics to `console.warn`, prefixed
 * with the package and the call that found it. Under the `node` condition it
 * stays silent when `NODE_ENV` is `production`.
 *
 * @param router - the router `createServerRouter` just built
 * @param diagnose - `diagnoseMounts`
 *
 * @internal
 */
export function warnMountDiagnostics(
  router: ServerRouter,
  diagnose: (router: ServerRouter) => MountDiagnostic[],
): void {
  // DEV folds the whole body out of dist/*.js (`?.`: node --test runs src unbundled); #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env?.DEV || !devGate()) return;

  for (const { message } of diagnose(router))
    console.warn(`ui-router-server: createServerRouter: ${message}`);
}

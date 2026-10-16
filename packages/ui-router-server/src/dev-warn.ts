// The development-only warnings; folded out of dist/*.js by check:dev-split.

import type { MountDiagnostic, ServerRouter } from './index.ts';

/**
 * Passes each of a new router's mount diagnostics to `console.warn`, prefixed
 * with the package and the call that found it. The node build skips it when
 * `NODE_ENV` is `production`.
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
  // DEV folds the whole body out of dist/*.js; `?.` because node --test runs src unbundled.
  if (!import.meta.env?.DEV) return;

  // Only dist/node reads NODE_ENV, at runtime; the other builds fold this away.
  // oxlint-disable-next-line no-restricted-globals -- dist/node only; check:dev-split keeps process out of dist and dist/development
  if (import.meta.env?.NODE && process.env.NODE_ENV === 'production') return;

  for (const { message } of diagnose(router))
    console.warn(`ui-router-server: createServerRouter: ${message}`);
}

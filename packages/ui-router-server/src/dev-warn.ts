// The development-only warnings; folded out of dist/*.js by check:dev-split.

import type { ServerRouter } from './index.ts';
import { reportMountDiagnostics } from './report.ts';

/**
 * Passes each of a new router's mount diagnostics to `console.warn`, prefixed
 * with the package and the call that found it, unless the Vite plugin already
 * reported them.
 *
 * @param router - the router `createServerRouter` just built
 *
 * @internal
 */
export function warnMountDiagnostics(router: ServerRouter): void {
  // DEV folds the whole body out of dist/*.js; `?.` because node --test runs src unbundled.
  if (!import.meta.env?.DEV) return;

  reportMountDiagnostics(router, (message) => {
    console.warn(`ui-router-server: createServerRouter: ${message}`);
  });
}

// The development-only warnings; folded out of dist/*.js by check:dev-split.

import type { MountDiagnostic } from './index.ts';

/**
 * Passes each mount diagnostic's message to `console.warn`, prefixed with the
 * package and the call that found it. Takes a thunk so a production build
 * never computes the diagnostics it would discard.
 *
 * @param diagnose - computes the findings to warn about
 *
 * @internal
 */
export function warnMountDiagnostics(diagnose: () => MountDiagnostic[]): void {
  // DEV folds the whole body out of dist/*.js; `?.` because node --test runs src unbundled.
  if (!import.meta.env?.DEV) return;

  for (const { message } of diagnose())
    console.warn(`ui-router-server: createServerRouter: ${message}`);
}

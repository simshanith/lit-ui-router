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

/**
 * Warns that `prerender` emitted nothing for `path`: no route matched it and
 * its mount declares no `otherwise` projection.
 *
 * @param path - the unclaimed path
 *
 * @internal
 */
export function warnUnclaimed(path: string): void {
  // DEV folds the whole body out of dist/*.js (`?.`: node --test runs src unbundled); #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env?.DEV || !devGate()) return;
  console.warn(
    'ui-router-server: prerender: no route matched this path and its mount declares no otherwise projection, so no page was emitted for it:',
    path,
  );
}

/**
 * Warns when `path`'s mount rejects the trailing slash a static host adds
 * when it serves `<subpath>/index.html`.
 *
 * @param resolver - the resolver `prerender` asks for verdicts
 * @param path - a shell path below its mount root, without a trailing slash
 *
 * @internal
 */
export async function warnStrictSlash(
  resolver: ServerRouter,
  path: string,
): Promise<void> {
  // DEV folds the whole body out of dist/*.js (`?.`: node --test runs src unbundled); #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env?.DEV || !devGate()) return;
  const slashed = await resolver.resolve(`${path}/`);

  if (slashed.kind === 'shell' && slashed.status === undefined) return;
  console.warn(
    'ui-router-server: prerender: this page is written as <subpath>/index.html, which static hosts serve by redirecting <subpath> to <subpath>/, and its mount rejects the trailing slash. Pass `config: { strict: false }` on the mount and call `router.urlService.config.strictMode(false)` on the client:',
    path,
  );
}

/**
 * Warns that `seed` left a resolve to its function because it couldn't
 * rebuild a value a transporter carried.
 *
 * @param state - the name of the state that declares the resolve
 * @param token - the resolve's token
 * @param type - the transporter name the payload records
 * @param reason - why the value wasn't rebuilt
 *
 * @internal
 */
export function warnUntransported(
  state: string,
  token: string,
  type: string,
  reason: string,
): void {
  // DEV folds the whole body out of dist/*.js (`?.`: node --test runs src unbundled); #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env?.DEV || !devGate()) return;
  console.warn(
    `ui-router-server: seed: ${state}'s ${token} resolve carries a ${JSON.stringify(type)} value and ${reason}, so it runs its function`,
  );
}

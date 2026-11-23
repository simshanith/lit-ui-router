/**
 * The verdict API without the simulate tier: the root entry's
 * `createServerRouter` for 'matcher' mounts only. Nothing this entry reaches
 * imports `@uirouter/core`, not even lazily, so a bundler that emits a single
 * file (esbuild without `--splitting`, a Lambda zip) never needs the optional
 * peer. A 'simulate' mount throws at construction; take `createServerRouter`
 * from the root entry for one. Routers from either entry work with every
 * adapter and with {@link diagnoseMounts}.
 *
 * @module matcher-router
 */

import type { RouteDeclaration } from './redirects.ts';
import { createRouter } from './server-router.ts';
import type {
  ExclusiveMarkers,
  MountConfig,
  ServerRouter,
} from './server-router.ts';

export type {
  RedirectRule,
  RedirectStatusCode,
  RedirectTarget,
  RouteDeclaration,
  RouteIndex,
  RouteTableConfig,
} from './redirects.ts';

export { routeTrie } from './route-trie.ts';

export { diagnoseMounts, mergeSearch } from './server-router.ts';

export type {
  ExclusiveMarkers,
  MountConfig,
  MountDiagnostic,
  MountDiagnosticKind,
  ResponseState,
  ServerRouter,
  ServerRouterDeclarations,
  Verdict,
} from './server-router.ts';

export { routesFromStates } from './state-routes.ts';

export type { StateRoutes } from './state-routes.ts';

export type { TrailingSlash, TrailingSlashPolicy } from './trailing-slash.ts';

/**
 * Compiles a mount table of 'matcher' mounts into a resolver: the root
 * entry's {@link index!createServerRouter | `createServerRouter`}, with the
 * same options, validation, verdicts and development-build warnings, minus
 * the simulate tier.
 *
 * @example
 * ```ts
 * import { createServerRouter } from 'ui-router-server/matcher-router';
 *
 * const router = createServerRouter({
 *   mounts: {
 *     '/': { routes: [{ name: 'home', url: '' }, { name: 'item', url: '/items/:id' }] },
 *   },
 * });
 * ```
 *
 * @throws an `Error` for a mount with `strategy: 'simulate'`, and for every
 * table the root entry's `createServerRouter` rejects
 */
export function createServerRouter<
  M extends Record<string, readonly RouteDeclaration[]> = Record<
    string,
    readonly RouteDeclaration[]
  >,
>(
  config: {
    /**
     * The url path the site is served at, such as Vite's `base`. Every mount
     * key lies under it (`/app/` and `/app/admin` under `/app/`), and the
     * router compiles them with it taken off, so `resolve` takes paths under
     * the base and the router reports it as `router.base`.
     */
    base?: string;
    mounts: { [B in keyof M]: MountConfig<M[B]> };
  } & ExclusiveMarkers<M[keyof M][number]>,
): ServerRouter<M[keyof M][number]> {
  return createRouter(config, undefined);
}

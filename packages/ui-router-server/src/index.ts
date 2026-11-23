/**
 * The verdict API: per-mount routing config in, a routing verdict out.
 * Runtime-agnostic — a pathname (or URL-shaped input) in, a plain verdict
 * object out; no fetch/Response, no workers types. The server (worker, node,
 * anything) stays a thin consumer: verdict → HTTP is the caller's one job.
 *
 * Strategy tiers, priced separately: 'matcher' mounts are dependency-free
 * (pattern matching + data redirects); 'simulate' mounts replay the path
 * through a headless @uirouter/core router (the optional peer dependency),
 * loaded lazily on first use — a matcher-only configuration never loads
 * core, and resolve() is async so that boundary can hold.
 */

import type { RouteDeclaration } from './redirects.ts';
import { createRouter } from './server-router.ts';
import type {
  ExclusiveMarkers,
  MountConfig,
  ServerRouter,
} from './server-router.ts';
import { createSimulateTier } from './simulate-tier.ts';

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
 * Compiles a mount table into a resolver. Every mount's routes and redirect
 * table compile (and validate) at construction, whatever its strategy; a
 * config with 'simulate' mounts also starts loading @uirouter/core here.
 * The longest matching mount base owns a pathname outright — a verdict
 * never falls through to a shorter mount.
 *
 * A bare mount base ('/app', '/app/') resolves the empty subpath, which
 * 404s unless the mount supplies a root pattern — a rule like
 * `{ pattern: /^\/?$/, to: ... }` or a `url: ''` route. Construction passes
 * each {@link diagnoseMounts} finding's message to `console.warn` in the
 * development build, which the `development` and `node` export conditions
 * resolve; under `node`, only while `NODE_ENV` is not `production`. The
 * default build never warns.
 *
 * With `base`, the mount keys spell the base and the router takes it off:
 * `createServerRouter({ base: '/app/', mounts: { '/app/': ... } })` resolves
 * as `{ '/': ... }` does, and `resolve` takes paths under the base.
 *
 * The router's `Decls` is the union of every mount's route declarations:
 * typed when each `routes` array is `as const`, {@link RouteDeclaration}
 * otherwise.
 *
 * @throws an `Error` when `base` is relative or a full URL, or a mount key lies outside it
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
  return createRouter(config, createSimulateTier());
}

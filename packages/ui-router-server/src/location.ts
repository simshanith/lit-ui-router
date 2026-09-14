/**
 * An in-memory location for a server-side router: the same DOM-free
 * `MemoryLocationService` core ships, paired with a config whose url shape you
 * choose, so `stateService.href()` builds `/sheet/7B` for a pushState client
 * and `#/sheet/7B` for a hash one, and a server render's links match what the
 * client writes.
 *
 * This tier imports `@uirouter/core` eagerly — it is the router's own
 * location machinery. The root entry stays core-free; only a consumer that
 * reaches for this subpath (or a `simulate` mount) loads core.
 */

import {
  locationPluginFactory,
  MemoryLocationConfig,
  MemoryLocationService,
} from '@uirouter/core';
import type { LocationPlugin, UIRouter } from '@uirouter/core';

/**
 * `@uirouter/core`'s `MemoryLocationConfig` with the `isHtml5` its location
 * plugin passes honored, which the shipped class ignores: it assigns
 * `html5Mode` as an own property in its constructor, so a subclass overrides
 * it by assigning too.
 */
export class ServerLocationConfig extends MemoryLocationConfig {
  /** Takes the router and `isHtml5` a location plugin passes; html5 unless told otherwise. */
  constructor(router?: UIRouter, isHtml5?: boolean) {
    super();
    void router;
    this.html5Mode = () => isHtml5 ?? true;
  }
}

// locationPluginFactory types a service's router as optional; the shipped
// MemoryLocationService requires it, and the factory always passes it.
class ServerLocationService extends MemoryLocationService {
  constructor(router?: UIRouter) {
    super(router!);
  }
}

/** Options for {@link serverLocationPlugin | `serverLocationPlugin`}. */
export interface ServerLocationPluginOptions {
  /**
   * Whether hrefs are paths (`/sheet/7B`) rather than fragments
   * (`#/sheet/7B`). Defaults to `true`; pass `false` for a hash client.
   */
  html5Mode?: boolean;
}

/**
 * The memory location plugin a server render installs, in the url shape its
 * client uses.
 *
 * The router's own `memoryLocationPlugin` is hash-shaped and cannot be asked
 * for anything else — its `html5Mode()` is `false` — so
 * `stateService.href('sheet', { num: '7B' })` comes back as `#/sheet/7B` on
 * the server while a pushState browser writes `/sheet/7B`, and every
 * server-rendered link differs from its hydrated self. This plugin pairs the
 * same in-memory `MemoryLocationService` with
 * {@link ServerLocationConfig | `ServerLocationConfig`}, which takes the mode
 * from {@link ServerLocationPluginOptions.html5Mode | `html5Mode`}: paths by
 * default, to match `pushStateLocationPlugin` or the Navigation API plugin,
 * and fragments under `{ html5Mode: false }`, to match `hashLocationPlugin`.
 *
 * @param uiRouter - the router the plugin is installed on
 * @param options - the url shape the client uses
 * @returns the installed location plugin
 *
 * @example
 * ```ts
 * import { UIRouter } from '@uirouter/core';
 * import { serverLocationPlugin } from 'ui-router-server/location';
 *
 * const router = new UIRouter();
 * router.plugin(serverLocationPlugin);
 * // or, for a hash client:
 * router.plugin(serverLocationPlugin, { html5Mode: false });
 * ```
 */
// A `function` declaration, not an arrow: core's `plugin()` does `new plugin(router, options)`.
export function serverLocationPlugin(
  uiRouter: UIRouter,
  options?: ServerLocationPluginOptions,
): LocationPlugin {
  return locationPluginFactory(
    'server.memoryLocation',
    options?.html5Mode ?? true,
    ServerLocationService,
    ServerLocationConfig,
  )(uiRouter);
}

/** Options for {@link installServerLocation | `installServerLocation`}. */
export interface ServerLocationOptions extends ServerLocationPluginOptions {
  /** The requested path, as the server received it — `/sheet/7B`. */
  url?: string;
  /**
   * The prefix the app is mounted under, added to every href. Pass
   * {@link ServerLocationOptions.url | `url`} without it — the router matches
   * paths relative to the mount, exactly as a `<base href>` client does.
   */
  baseHref?: string;
  /** Whether a trailing slash has to match exactly; most static hosts want `false`. */
  strictMode?: boolean;
}

/**
 * Installs {@link serverLocationPlugin | `serverLocationPlugin`} on `router`,
 * points it at the requested url, and returns the same router.
 *
 * It takes a router rather than constructing one: a server render drives
 * whatever `UIRouter` its client uses — `lit-ui-router`'s `UIRouterLit`
 * included — and constructing one here pins that choice. Build the router
 * yourself and hand it over; it comes back at the type it went in as.
 *
 * The url is set before any transition runs, so `router.start()` (or a
 * `stateService.go()`) settles on the state the request asked for.
 *
 * @typeParam T - the router type, returned unchanged
 * @param router - a freshly constructed router, with no location plugin yet
 * @param options - the request's url, the mount's shape, and the url shape
 * @returns `router`, for chaining
 *
 * @example
 * ```ts
 * import { servicesPlugin, UIRouter } from '@uirouter/core';
 * import { installServerLocation } from 'ui-router-server/location';
 *
 * const router = new UIRouter();
 * router.plugin(servicesPlugin);
 * installServerLocation(router, {
 *   url: new URL(request.url).pathname,
 *   strictMode: false,
 * });
 * states.forEach((state) => router.stateRegistry.register(state));
 * router.start();
 * ```
 */
export const installServerLocation: <T extends UIRouter>(
  router: T,
  options?: ServerLocationOptions,
) => T = <T extends UIRouter>(
  router: T,
  options: ServerLocationOptions = {},
): T => {
  router.plugin(serverLocationPlugin, { html5Mode: options.html5Mode });
  // `urlService.config.baseHref()` only reads; the memory config holds the value
  if (options.baseHref !== undefined)
    (router.locationConfig as MemoryLocationConfig)._baseHref =
      options.baseHref;
  if (options.strictMode !== undefined)
    router.urlService.config.strictMode(options.strictMode);
  if (options.url !== undefined) router.urlService.url(options.url);
  return router;
};

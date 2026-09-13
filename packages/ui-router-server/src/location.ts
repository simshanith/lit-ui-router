/**
 * A path-shaped in-memory location for a server-side router: the same
 * DOM-free `MemoryLocationService` core ships, paired with an html5-mode
 * config, so `stateService.href()` builds `/sheet/7B` instead of `#/sheet/7B`
 * and a server render's links match what a pushState client writes.
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
 * `@uirouter/core`'s `MemoryLocationConfig` in html5 mode, which it cannot
 * otherwise be asked for: the shipped class assigns `html5Mode` as an own
 * property in its constructor, so a subclass overrides it by assigning too.
 */
export class ServerLocationConfig extends MemoryLocationConfig {
  /** Takes the router and `isHtml5` a location plugin passes, and needs neither. */
  constructor(router?: UIRouter, isHtml5?: boolean) {
    super();
    void router;
    void isHtml5;
    this.html5Mode = () => true;
  }
}

// locationPluginFactory types a service's router as optional; the shipped
// MemoryLocationService requires it, and the factory always passes it.
class ServerLocationService extends MemoryLocationService {
  constructor(router?: UIRouter) {
    super(router!);
  }
}

/**
 * A memory location plugin whose urls are paths, not fragments.
 *
 * The router's own `memoryLocationPlugin` is hash-shaped — its `html5Mode()`
 * is `false` — so `stateService.href('sheet', { num: '7B' })` comes back as
 * `#/sheet/7B` on the server while the browser writes `/sheet/7B`, and every
 * server-rendered link differs from its hydrated self. This plugin pairs the
 * same in-memory `MemoryLocationService` with
 * {@link ServerLocationConfig | `ServerLocationConfig`} and gets the path
 * form.
 *
 * Pair it with a path-location client — `pushStateLocationPlugin`, or the
 * Navigation API plugin.
 *
 * @param uiRouter - the router the plugin is installed on
 * @returns the installed location plugin
 *
 * @example
 * ```ts
 * import { UIRouter } from '@uirouter/core';
 * import { serverLocationPlugin } from 'ui-router-server/location';
 *
 * const router = new UIRouter();
 * router.plugin(serverLocationPlugin);
 * ```
 */
export const serverLocationPlugin: (uiRouter: UIRouter) => LocationPlugin =
  locationPluginFactory(
    'server.memoryPathLocation',
    true,
    ServerLocationService,
    ServerLocationConfig,
  );

/** Options for {@link installServerLocation | `installServerLocation`}. */
export interface ServerLocationOptions {
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
 * @param options - the request's url and the mount's shape
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
  router.plugin(serverLocationPlugin);
  // `urlService.config.baseHref()` only reads; the memory config holds the value
  if (options.baseHref !== undefined)
    (router.locationConfig as MemoryLocationConfig)._baseHref =
      options.baseHref;
  if (options.strictMode !== undefined)
    router.urlService.config.strictMode(options.strictMode);
  if (options.url !== undefined) router.urlService.url(options.url);
  return router;
};

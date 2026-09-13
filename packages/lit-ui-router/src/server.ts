// The server half of the router hand-off: a context provider for a render root,
// a synchronous per-render router slot, and a path-shaped location plugin.
// Deliberately DOM-free — no `lit` import — so it loads before any shim.
import {
  locationPluginFactory,
  MemoryLocationConfig,
  MemoryLocationService,
  type LocationPlugin,
  type UIRouter,
} from '@uirouter/core';

import { contextRequestEventName, isRouterContextRequest } from './context.js';
import type { UIRouterLit } from './core.js';

/**
 * Answers `routerContext` requests — `lit-ui-router/context`'s key — that reach
 * `root`, so a server render can hand a router to code that has no element to
 * seek from.
 *
 * The provider is the server-side twin of `<ui-router>`: it listens for
 * `context-request`, guards with `isRouterContextRequest`, calls
 * `stopImmediatePropagation()` so an outer provider does not answer twice, and
 * delivers the router synchronously. A `subscribe: true` request gets a no-op
 * unsubscribe — a server render has one router for its whole lifetime.
 *
 * `root` is any `EventTarget`. Under `@lit-labs/ssr` that is
 * `globalThis.litServerRoot`, the bottom of the renderer's event-target stack,
 * which every element event on the server reaches.
 *
 * Installing twice installs two listeners; the first one still wins, because it
 * stops immediate propagation. Uninstalling is exact — each call's returned
 * function removes only the listener that call added.
 *
 * @param root - the event target server-side requests travel to
 * @param router - the router to answer with
 * @returns a function that uninstalls this provider
 *
 * @example
 * ```ts
 * import '@lit-labs/ssr/lib/install-global-dom-shim.js';
 * import { provideRouter } from 'lit-ui-router/server';
 *
 * const uninstall = provideRouter(globalThis.litServerRoot, router);
 * try {
 *   // …render…
 * } finally {
 *   uninstall();
 * }
 * ```
 *
 * @see {@link withServerRouter} for the slot the same render can set instead
 *
 * @category server
 */
export const provideRouter: (
  root: EventTarget,
  router: UIRouterLit,
) => () => void = (root: EventTarget, router: UIRouterLit): (() => void) => {
  const listener = (event: Event): void => {
    if (!isRouterContextRequest(event)) return;
    event.stopImmediatePropagation();
    event.callback(router, event.subscribe ? () => {} : undefined);
  };
  root.addEventListener(contextRequestEventName, listener);
  return () => root.removeEventListener(contextRequestEventName, listener);
};

/** The per-render router. A plain module slot, never an async context. */
let currentRouter: UIRouterLit | undefined;

/**
 * The router the innermost enclosing
 * {@link withServerRouter | `withServerRouter`} call set, or `undefined`
 * outside one.
 *
 * `@lit-labs/ssr`'s `render()` is a synchronous generator, so a directive's
 * `render()` runs while the caller is still inside `withServerRouter`'s `run`,
 * and this is the cheapest router source a directive has on the server — no
 * element, no event, no ancestry.
 *
 * @returns the router in scope, or `undefined`
 *
 * @category server
 */
export const currentServerRouter: () => UIRouterLit | undefined = ():
  | UIRouterLit
  | undefined => currentRouter;

/**
 * Runs `run` with `router` in the module slot
 * ({@link currentServerRouter | `currentServerRouter`}), restoring whatever was
 * there before — `undefined` included — when it returns or throws.
 *
 * The slot is synchronous on purpose. `@lit-labs/ssr`'s `render()` returns a
 * sync generator, so the whole render happens inside `run` as long as the
 * caller consumes it there: `collectResultSync(render(template))`. Nothing is
 * detected and nothing is upgraded — if `run` returns a thenable the slot is
 * restored and a `TypeError` is thrown, because anything that promise does
 * later would read a slot that is already gone. An async variant, if one is
 * ever wanted, would be a separate explicit export over `AsyncLocalStorage`.
 *
 * Calls nest: an inner call sees its own router, and the outer one is restored
 * on the way out.
 *
 * @typeParam T - whatever `run` returns
 * @param router - the router to publish for the duration of `run`
 * @param run - the render, consumed synchronously
 * @returns whatever `run` returned
 * @throws a `TypeError` if `run` returns a thenable
 *
 * @example
 * ```ts
 * import { render } from '@lit-labs/ssr';
 * import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
 * import { withServerRouter } from 'lit-ui-router/server';
 *
 * const markup = withServerRouter(router, () =>
 *   collectResultSync(render(html`<my-page></my-page>`)),
 * );
 * ```
 *
 * @category server
 */
export const withServerRouter: <T>(router: UIRouterLit, run: () => T) => T = <
  T,
>(
  router: UIRouterLit,
  run: () => T,
): T => {
  const previous = currentRouter;
  currentRouter = router;
  let result: T;
  try {
    result = run();
  } finally {
    currentRouter = previous;
  }
  if (typeof (result as { then?: unknown } | undefined)?.then === 'function') {
    throw new TypeError(
      'withServerRouter() is synchronous: `run` returned a thenable, and the router slot is already restored by the time it settles. Consume the render inside `run` — collectResultSync(render(template)) — or read the router before awaiting.',
    );
  }
  return result;
};

/**
 * `@uirouter/core`'s `MemoryLocationConfig` in html5 mode, which it cannot
 * otherwise be asked for: the shipped class assigns `html5Mode` as an
 * own property in its constructor, so a subclass overrides it by assigning too.
 *
 * @category server
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
 * The router's own `memoryLocationPlugin` is hash-shaped — its `html5Mode()` is
 * `false` — so `stateService.href('sheet', { num: '7B' })` comes back as
 * `#/sheet/7B` on the server while the browser writes `/sheet/7B`, and every
 * server-rendered link differs from its hydrated self. This plugin pairs the
 * same in-memory `MemoryLocationService` with
 * {@link ServerLocationConfig | `ServerLocationConfig`} and gets the path form.
 *
 * Pair it with a path-location client — `pushStateLocationPlugin`, or the
 * Navigation API plugin.
 *
 * @param uiRouter - the router the plugin is installed on
 * @returns the installed location plugin
 *
 * @example
 * ```ts
 * const router = new UIRouterLit();
 * router.plugin(serverLocationPlugin);
 * ```
 *
 * @category server
 */
export const serverLocationPlugin: (uiRouter: UIRouter) => LocationPlugin =
  locationPluginFactory(
    'server.memoryPathLocation',
    true,
    ServerLocationService,
    ServerLocationConfig,
  );

/**
 * Options for {@link configureServerRouter | `configureServerRouter`}.
 *
 * @category server
 */
export interface ServerRouterOptions {
  /** The requested path, as the server received it — `/sheet/7B`. */
  url?: string;
  /**
   * The prefix the app is mounted under, added to every href. Pass
   * {@link ServerRouterOptions.url | `url`} without it — the router matches
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
 * It takes a router rather than constructing one so this entry stays DOM-free:
 * `UIRouterLit` reaches `lit`, which a Node process cannot load before
 * `@lit-labs/ssr`'s shim is installed, while everything here loads anywhere.
 * Construct the router yourself — after the shim, if you are rendering — and
 * hand it over.
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
 * import '@lit-labs/ssr/lib/install-global-dom-shim.js';
 * const { UIRouterLit } = await import('lit-ui-router/pure');
 * const { configureServerRouter } = await import('lit-ui-router/server');
 *
 * const router = configureServerRouter(new UIRouterLit(), {
 *   url: new URL(request.url).pathname,
 *   strictMode: false,
 * });
 * states.forEach((state) => router.stateRegistry.register(state));
 * router.start();
 * ```
 *
 * @category server
 */
export const configureServerRouter: <T extends UIRouterLit>(
  router: T,
  options?: ServerRouterOptions,
) => T = <T extends UIRouterLit>(
  router: T,
  options: ServerRouterOptions = {},
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

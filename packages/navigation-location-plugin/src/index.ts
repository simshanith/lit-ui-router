import {
  BaseLocationServices,
  BrowserLocationConfig,
  LocationConfig,
  LocationPlugin,
  root,
  splitHash,
  splitQuery,
  stripLastPathElement,
  UIRouter,
} from '@uirouter/core';

import { composeNavigateUrl } from './compose-navigate-url.js';

const CURRENT_ENTRY_CHANGE_EVENT = 'currententrychange';
const NAVIGATE_EVENT = 'navigate';

// @uirouter/core types `root` as `any`; it is the global object in browsers.
const globalRoot = root as typeof globalThis;

/**
 * Shape of the `info` payload this plugin passes to `navigation.navigate()`,
 * and the type of {@link UIRouterNavigateEvent.info}.
 *
 * {@link isUIRouterNavigateEvent} checks for it to recognize the plugin's own
 * navigations; read `uiRouter` off a narrowed event to reach the router that
 * started it.
 */
export interface UIRouterNavigateInfo extends Record<
  string | number | symbol,
  unknown
> {
  /** The router whose location service started the navigation. */
  uiRouter: UIRouter;
}

/** A `navigate` event whose `info` marks it as started by this plugin. */
export interface UIRouterNavigateEvent extends NavigateEvent {
  info: UIRouterNavigateInfo;
}

/**
 * Whether a `navigate` event was started by this plugin, as opposed to a link
 * or script.
 *
 * Use it in a `navigate` listener that observes navigations to read the router
 * off `event.info`. The service intercepts these events itself; extra work on
 * them goes through {@link NavigationLocationPluginOptions.intercept}.
 */
export function isUIRouterNavigateEvent(
  event?: NavigateEvent,
): event is UIRouterNavigateEvent {
  return (event as UIRouterNavigateEvent)?.info?.uiRouter instanceof UIRouter;
}

/** Options for {@link navigationLocationPlugin}. */
export interface NavigationLocationPluginOptions {
  /**
   * Called for each navigation the service itself starts, after the router
   * transition has committed.
   *
   * What it returns is handed to `event.intercept()`: `handler` decides what
   * `navigation.transition.finished` waits on and when the browser runs focus
   * reset and scroll restoration, and `focusReset` and `scroll` pass through.
   * The router is available as `event.info.uiRouter`.
   *
   * Absent, the service intercepts with an immediately resolving handler.
   *
   * @example
   * ```ts
   * router.plugin(navigationLocationPlugin, {
   *   intercept: (event) => ({
   *     async handler() {
   *       // view transitions, analytics, progress UI
   *     },
   *   }),
   * });
   * ```
   */
  intercept?: (event: UIRouterNavigateEvent) => NavigationInterceptOptions;
}

/**
 * Location service implementation using the Navigation API.
 *
 * Uses the browser's Navigation API for URL management instead of the
 * History API, providing better integration with browser navigation.
 *
 * The service intercepts the navigations it starts, so a router transition
 * commits as a same-document navigation instead of loading the document
 * afresh. An application's extra work on those navigations — view
 * transitions, analytics, progress UI — goes through the
 * {@link NavigationLocationPluginOptions.intercept | intercept} option.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API
 */
export class NavigationLocationService extends BaseLocationServices {
  /** @internal */
  _config: LocationConfig;

  private readonly _router: UIRouter;

  private readonly _options: NavigationLocationPluginOptions;

  /**
   * Creates a new NavigationLocationService instance.
   * @param router - The UIRouter instance (required despite optional type signature)
   * @param options - How the service intercepts its own navigations
   * @throws Error if router is not provided
   */
  constructor(
    router?: UIRouter,
    options: NavigationLocationPluginOptions = {},
  ) {
    if (!router) {
      throw new Error('NavigationLocationService requires a UIRouter instance');
    }
    super(router, false);
    this._router = router;
    this._options = options;
    this._config = router.urlService.config;
    this._navigation().addEventListener(
      CURRENT_ENTRY_CHANGE_EVENT,
      this._listener,
      false,
    );
    this._navigation().addEventListener(NAVIGATE_EVENT, this._intercept);
  }

  // Keeps this service's own navigations same-document; another router's are not ours.
  private readonly _intercept = (event: NavigateEvent): void => {
    if (
      !event.canIntercept ||
      !isUIRouterNavigateEvent(event) ||
      event.info.uiRouter !== this._router
    ) {
      return;
    }
    event.intercept(
      this._options.intercept?.(event) ?? { handler: () => Promise.resolve() },
    );
  };

  /**
   * The Navigation API object this service drives.
   *
   * Single seam for every `navigation` touch point. Override in a subclass to
   * substitute a stub — tests get to assert against the calls this service
   * makes without booting a browser to spy on a global.
   *
   * @example
   * ```ts
   * class StubbedNavigationLocationService extends NavigationLocationService {
   *   protected override _navigation(): Navigation {
   *     return this.stub;
   *   }
   * }
   * ```
   */
  protected _navigation(): Navigation {
    return globalRoot.navigation;
  }

  /**
   * Gets the base prefix without:
   * - trailing slash
   * - trailing filename
   * - protocol and hostname
   *
   * If <base href='/base/'>, this returns '/base'.
   * If <base href='/foo/base/'>, this returns '/foo/base'.
   * If <base href='/base/index.html'>, this returns '/base'.
   * If <base href='http://localhost:8080/base/index.html'>, this returns '/base'.
   * If <base href='/base'>, this returns ''.
   * If <base href='http://localhost:8080'>, this returns ''.
   * If <base href='http://localhost:8080/'>, this returns ''.
   *
   * See: https://html.spec.whatwg.org/dev/semantics.html#the-base-element
   */
  private _getBasePrefix() {
    return stripLastPathElement(this._config.baseHref());
  }

  /**
   * Gets the current URL path, query, and hash relative to the base href.
   * @returns The current URL string (e.g., '/path?query=value#hash')
   * @internal
   */
  protected _get(): string {
    let { pathname, hash, search } = this._location;
    search = splitQuery(search)[1]; // strip ? if found
    hash = splitHash(hash)[1]; // strip # if found

    const basePrefix = this._getBasePrefix();
    const exactBaseHrefMatch = pathname === this._config.baseHref();
    const startsWithBase = pathname.startsWith(basePrefix);
    pathname = exactBaseHrefMatch
      ? '/'
      : startsWithBase
        ? pathname.substring(basePrefix.length)
        : pathname;

    return pathname + (search ? '?' + search : '') + (hash ? '#' + hash : '');
  }

  /**
   * Sets the URL using the Navigation API's navigate method.
   * @param state - State object to associate with the navigation entry
   * @param title - Title for the navigation (passed via info)
   * @param url - The URL path to navigate to
   * @param replace - If true, replaces current entry instead of pushing
   * @internal
   */
  protected _set(
    state: unknown,
    title: string,
    url: string,
    replace: boolean,
  ): void {
    const fullUrl = composeNavigateUrl(url, this._config.baseHref());

    this._navigation().navigate(fullUrl, {
      state,
      info: {
        uiRouter: this._router,
        title,
      } satisfies UIRouterNavigateInfo,
      history: replace ? 'replace' : 'push',
    });
  }

  /**
   * Cleans up the location service by removing its Navigation API listeners.
   * @param router - The UIRouter instance
   */
  public dispose(router: UIRouter): void {
    super.dispose(router);
    this._navigation().removeEventListener(
      CURRENT_ENTRY_CHANGE_EVENT,
      this._listener,
    );
    this._navigation().removeEventListener(NAVIGATE_EVENT, this._intercept);
  }
}

/** A [UIRouterPlugin](https://ui-router.github.io/core/docs/latest/interfaces/_interface_.uirouterplugin.html) that gets/sets the current location using the browser's `location` and `navigation` apis */
// A function declaration: router.plugin() installs it with `new`.
export function navigationLocationPlugin(
  router: UIRouter,
  options: NavigationLocationPluginOptions = {},
): LocationPlugin {
  const service = (router.locationService = new NavigationLocationService(
    router,
    options,
  ));
  const configuration = (router.locationConfig = new BrowserLocationConfig(
    router,
    true,
  ));
  return {
    name: 'vanilla.navigationLocation',
    service,
    configuration,
    dispose(r: UIRouter) {
      r.dispose(service);
      r.dispose(configuration);
    },
  };
}

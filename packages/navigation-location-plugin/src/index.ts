import {
  BaseLocationServices,
  BrowserLocationConfig,
  LocationConfig,
  LocationPlugin,
  locationPluginFactory,
  LocationServices,
  root,
  splitHash,
  splitQuery,
  stripLastPathElement,
  UIRouter,
} from '@uirouter/core';

const CURRENT_ENTRY_CHANGE_EVENT = 'currententrychange';

// @uirouter/core types `root` as `any`; it is the global object in browsers.
const globalRoot = root as typeof globalThis;

/**
 * Shape of the `info` payload this plugin passes to `navigation.navigate()`,
 * used by {@link isUIRouterNavigateEvent} to recognize its own navigations.
 * @internal
 */
export interface UIRouterNavigateInfo extends Record<
  string | number | symbol,
  unknown
> {
  uiRouter: UIRouter;
}

export interface UIRouterNavigateEvent extends NavigateEvent {
  info: UIRouterNavigateInfo;
}

export function isUIRouterNavigateEvent(
  event?: NavigateEvent,
): event is UIRouterNavigateEvent {
  return (event as UIRouterNavigateEvent)?.info?.uiRouter instanceof UIRouter;
}

/**
 * Composes the absolute URL handed to `navigation.navigate()` from a
 * router-relative `url` and the document's `baseHref`.
 *
 * Pure string math — no DOM, no Navigation API.
 *
 * - `''` and `'/'` resolve to `baseHref` itself (so `<base href='/app/'>`
 *   navigates to `/app/`, not `/app`).
 * - anything else is prefixed with the base prefix
 *   ({@link stripLastPathElement} of `baseHref`), inserting the leading slash
 *   the caller may have omitted.
 *
 * @internal
 */
export function composeNavigateUrl(url: string, baseHref: string): string {
  if (url === '' || url === '/') {
    return baseHref;
  }
  const slash = url.startsWith('/') ? '' : '/';
  return stripLastPathElement(baseHref) + slash + url;
}

/**
 * Location service implementation using the Navigation API.
 *
 * Uses the browser's Navigation API for URL management instead of the
 * History API, providing better integration with browser navigation
 * and enabling interception of navigation events.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API
 */
export class NavigationLocationService extends BaseLocationServices {
  _config: LocationConfig;

  private readonly _router: UIRouter;

  /**
   * Creates a new NavigationLocationService instance.
   * @param router - The UIRouter instance (required despite optional type signature)
   * @throws Error if router is not provided
   */
  constructor(router?: UIRouter) {
    if (!router) {
      throw new Error('NavigationLocationService requires a UIRouter instance');
    }
    super(router, false);
    this._router = router;
    this._config = router.urlService.config;
    this._navigation().addEventListener(
      CURRENT_ENTRY_CHANGE_EVENT,
      this._listener,
      false,
    );
  }

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
   * Cleans up the location service by removing the navigation event listener.
   * @param router - The UIRouter instance
   */
  public dispose(router: UIRouter): void {
    super.dispose(router);
    this._navigation().removeEventListener(
      CURRENT_ENTRY_CHANGE_EVENT,
      this._listener,
    );
  }
}

/** A [UIRouterPlugin](https://ui-router.github.io/core/docs/latest/interfaces/_interface_.uirouterplugin.html) that gets/sets the current location using the browser's `location` and `navigation` apis */
export const navigationLocationPlugin: (router: UIRouter) => LocationPlugin =
  locationPluginFactory(
    'vanilla.navigationLocation',
    true,
    NavigationLocationService satisfies {
      new (uiRouter?: UIRouter): LocationServices;
    },
    BrowserLocationConfig,
  );

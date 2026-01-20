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

  private _router: UIRouter;

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
    root.navigation.addEventListener(
      CURRENT_ENTRY_CHANGE_EVENT,
      this._listener,
      false,
    );
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
  protected _get() {
    let { pathname, hash, search } = this._location;
    search = splitQuery(search)[1]; // strip ? if found
    hash = splitHash(hash)[1]; // strip # if found

    const basePrefix = this._getBasePrefix();
    const exactBaseHrefMatch = pathname === this._config.baseHref();
    const startsWithBase =
      pathname.substring(0, basePrefix.length) === basePrefix;
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
  protected _set(state: unknown, title: string, url: string, replace: boolean) {
    const basePrefix = this._getBasePrefix();
    const slash = url && url[0] !== '/' ? '/' : '';
    const fullUrl =
      url === '' || url === '/'
        ? this._config.baseHref()
        : basePrefix + slash + url;

    root.navigation.navigate(fullUrl, {
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
  public dispose(router: UIRouter) {
    super.dispose(router);
    root.navigation.removeEventListener(
      CURRENT_ENTRY_CHANGE_EVENT,
      this._listener,
    );
  }
}

/** A `UIRouterPlugin` that gets/sets the current location using the browser's `location` and `navigation` apis */
export const navigationLocationPlugin = locationPluginFactory(
  'vanilla.navigationLocation',
  true,
  NavigationLocationService satisfies {
    new (uiRouter?: UIRouter): LocationServices;
  },
  BrowserLocationConfig,
) satisfies (router: UIRouter) => LocationPlugin;

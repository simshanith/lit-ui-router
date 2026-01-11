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

export class NavigationLocationService extends BaseLocationServices {
  _config: LocationConfig;

  constructor(router?: UIRouter) {
    super(router!, false);
    this._config = router!.urlService.config;
    root.navigation.addEventListener(
      'currententrychange',
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

  protected _get() {
    let { pathname, hash, search } = this._location;
    search = splitQuery(search)[1]; // strip ? if found
    hash = splitHash(hash)[1]; // strip # if found

    const basePrefix = this._getBasePrefix();
    const exactBaseHrefMatch = pathname === this._config.baseHref();
    const startsWithBase = pathname.substr(0, basePrefix.length) === basePrefix;
    pathname = exactBaseHrefMatch
      ? '/'
      : startsWithBase
        ? pathname.substring(basePrefix.length)
        : pathname;

    return pathname + (search ? '?' + search : '') + (hash ? '#' + hash : '');
  }

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
        title,
      },
      history: replace ? 'replace' : 'push',
    });
  }

  public dispose(router: UIRouter) {
    super.dispose(router);
    root.navigation.removeEventListener('currententrychange', this._listener);
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

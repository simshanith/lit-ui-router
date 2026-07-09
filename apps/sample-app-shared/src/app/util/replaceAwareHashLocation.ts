import {
  BrowserLocationConfig,
  HashLocationService,
  LocationPlugin,
  locationPluginFactory,
  UIRouter,
} from '@uirouter/core';

/**
 * A `hashLocationPlugin` whose location service can replace the current history
 * entry instead of always pushing a new one.
 *
 * `HashLocationService` predates the widespread History API: assigning
 * `location.hash` was the only way to change the url without a page load, and
 * it always pushes. Honoring `replace` therefore isn't something core left out
 * — the hash strategy exists precisely for browsers that lack `replaceState`.
 *
 * The sample app targets browsers that have it, so it opts in: a url rule that
 * redirects the app root (`''`) to a state would otherwise leave the root in
 * history, where Back re-enters it, re-runs the redirect, and pushes again,
 * making the root a Back-trap. Where `replaceState` is missing, fall back to
 * the base behavior — a spare history entry beats a broken url.
 */
class ReplaceAwareHashLocationService extends HashLocationService {
  // locationPluginFactory types the router as optional; the base class requires it.
  constructor(router?: UIRouter) {
    if (!router) {
      throw new Error('ReplaceAwareHashLocationService requires a UIRouter');
    }
    super(router);
  }

  _set(state: unknown, title: string, url: string, replace: boolean) {
    if (!replace || typeof this._history.replaceState !== 'function') {
      super._set(state, title, url, replace);
      return;
    }
    const { pathname, search } = this._location;
    this._history.replaceState(state, title, `${pathname}${search}#${url}`);
  }
}

export const replaceAwareHashLocationPlugin = locationPluginFactory(
  'sampleApp.replaceAwareHashLocation',
  false,
  ReplaceAwareHashLocationService,
  BrowserLocationConfig,
) satisfies (router: UIRouter) => LocationPlugin;

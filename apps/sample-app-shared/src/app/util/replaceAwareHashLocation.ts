import {
  BrowserLocationConfig,
  HashLocationService,
  locationPluginFactory,
  UIRouter,
} from '@uirouter/core';

/**
 * A `hashLocationPlugin` whose location service honors the `replace` flag.
 *
 * `HashLocationService._set` assigns `location.hash`, which always pushes a
 * history entry — it ignores `replace` entirely. A url rule that redirects the
 * app root (`''`) to a state therefore leaves the root behind in history, and
 * pressing Back re-enters it, re-runs the redirect, and pushes again: the root
 * becomes a Back-trap you can never move past.
 *
 * `replaceState` writes the same hash without adding an entry, so the root is
 * consumed by the redirect and Back reaches whatever preceded it.
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
    if (!replace) {
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
);

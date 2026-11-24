import {
  BrowserLocationConfig,
  HashLocationService,
  type LocationPlugin,
  type UIRouter,
} from '@uirouter/core';

import { replaceFragment, stateUrlOf } from './state-links.ts';

export interface ReplaceAwareHashLocationOptions {
  /**
   * What a state fragment starts with, ahead of the state's URL. With `tour`,
   * `#tour/views` is the state URL `/views`, and `#tour` alone stays the
   * page's anchor. The default, `''`, owns every `#/…` fragment.
   */
  prefix?: string;
  /**
   * How a `{ location: 'replace' }` transition takes over the history entry.
   * `replaceState`, the default, keeps the entry's `history.state`, which a
   * host page's own router may use, and dispatches the `hashchange` the
   * History API does not fire, as a link inside a host's landmark does. `location.replace` lets the browser fire it and
   * drops `history.state`; it suits an app that is the whole document.
   */
  replace?: 'replaceState' | 'location.replace';
}

/**
 * A hash location that honours `{ location: 'replace' }`, which core's pushes,
 * and that can share the fragment with the page around it: it owns the
 * fragments that start with its prefix, any other fragment is the page's own
 * anchor, and the router keeps the state it is in.
 */
export class ReplaceAwareHashLocationService extends HashLocationService {
  private readonly prefix: string;

  private readonly replace: 'replaceState' | 'location.replace';

  // The last state URL the fragment carried: what the router reads while the fragment is the page's.
  private stateUrl = '';

  // The URL of the state the router is in.
  private entered = '';

  constructor(
    router: UIRouter,
    { prefix = '', replace = 'replaceState' }: ReplaceAwareHashLocationOptions,
  ) {
    super(router);
    this.prefix = prefix;
    this.replace = replace;
  }

  _get(): string {
    this.stateUrl =
      stateUrlOf(this._location.hash, this.prefix) ?? this.stateUrl;

    return this.stateUrl;
  }

  /** Records the URL of the state the router has entered, whether or not it was written to the fragment. */
  adopt(url: string | undefined): void {
    this.entered = url ?? this.entered;
    this.stateUrl = this.entered;
  }

  _set(_state: null, _title: string, written: string, replace: boolean): void {
    // Core rolls a refused transition back to the URL it last read, which is '' until a state URL has been in the fragment. That means the state the router is in, never the bare prefix, which is a page anchor.
    const url = written.startsWith('/') ? written : this.entered;

    if (!url) return;

    const hash = `#${this.prefix}${url}`;

    if (!replace) {
      this._location.hash = hash;

      return;
    }

    if (this.replace === 'location.replace') {
      // SAFETY: core types it as the few members it reads; it is the window's own location.
      const location = this._location as Location;

      // The path and query are spelled out: a bare `#…` resolves against a <base href>, not the page's URL.
      location.replace(`${location.pathname}${location.search}${hash}`);

      return;
    }

    replaceFragment(hash);
  }

  // The router syncs only on a fragment of its own; the page's anchors pass it by.
  onChange(callback: EventListener) {
    return super.onChange((event) => {
      if (stateUrlOf(this._location.hash, this.prefix) !== undefined)
        callback(event);
    });
  }
}

/** The plugin, with its concrete service. */
export interface ReplaceAwareHashLocationPlugin extends LocationPlugin {
  service: ReplaceAwareHashLocationService;
}

/** `router.plugin(replaceAwareHashLocationPlugin, { prefix: 'tour' })` */
export function replaceAwareHashLocationPlugin(
  router: UIRouter,
  options: ReplaceAwareHashLocationOptions = {},
): ReplaceAwareHashLocationPlugin {
  const service = new ReplaceAwareHashLocationService(router, options);
  const configuration = new BrowserLocationConfig(router, false);
  const prefix = options.prefix ?? '';

  router.locationService = service;
  router.locationConfig = configuration;
  // href() builds `#<hashPrefix><url>`, so uiSref links and hand-written anchors agree.
  router.urlService.config.hashPrefix(prefix);

  // After core's own URL hook has written the fragment, or not: { location: false } writes none.
  router.transitionService.onSuccess({}, (transition) => {
    const href = router.stateService.href(transition.to(), transition.params());

    service.adopt(href ? stateUrlOf(href, prefix) : undefined);
  });

  return {
    name: 'featuresTour.replaceAwareHashLocation',
    service,
    configuration,
    dispose(disposing: UIRouter) {
      disposing.dispose(service);
      disposing.dispose(configuration);
    },
  };
}

import {
  BrowserLocationConfig,
  HashLocationService,
  type LocationPlugin,
  type UIRouter,
} from '@uirouter/core';

import { stateUrlOf } from './state-links.ts';

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
   * History API does not fire. `location.replace` lets the browser fire it and
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

  constructor(
    router: UIRouter,
    { prefix = '', replace = 'replaceState' }: ReplaceAwareHashLocationOptions,
  ) {
    super(router);
    this.prefix = prefix;
    this.replace = replace;
  }

  _get(): string {
    this.stateUrl = stateUrlOf(location.hash, this.prefix) ?? this.stateUrl;

    return this.stateUrl;
  }

  _set(_state: null, _title: string, url: string, replace: boolean): void {
    const hash = `#${this.prefix}${url}`;

    if (!replace) {
      location.hash = hash;

      return;
    }

    if (this.replace === 'location.replace') {
      location.replace(hash);

      return;
    }

    const oldURL = location.href;

    history.replaceState(history.state, '', hash);
    // replaceState fires no hashchange, and a host page follows the fragment by that event.
    window.dispatchEvent(
      new HashChangeEvent('hashchange', { oldURL, newURL: location.href }),
    );
  }

  // The router syncs only on a fragment of its own; the page's anchors pass it by.
  onChange(callback: EventListener) {
    return super.onChange((event) => {
      if (stateUrlOf(location.hash, this.prefix) !== undefined) callback(event);
    });
  }
}

/** `router.plugin(replaceAwareHashLocationPlugin, { prefix: 'tour' })` */
export function replaceAwareHashLocationPlugin(
  router: UIRouter,
  options: ReplaceAwareHashLocationOptions = {},
): LocationPlugin {
  const service = new ReplaceAwareHashLocationService(router, options);
  const configuration = new BrowserLocationConfig(router, false);

  router.locationService = service;
  router.locationConfig = configuration;
  // href() builds `#<hashPrefix><url>`, so uiSref links and hand-written anchors agree.
  router.urlService.config.hashPrefix(options.prefix ?? '');

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

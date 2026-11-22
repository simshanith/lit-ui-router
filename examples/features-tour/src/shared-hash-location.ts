import {
  BrowserLocationConfig,
  HashLocationService,
  type LocationPlugin,
  type UIRouter,
} from '@uirouter/core';

import { stateUrlOf } from './state-links.ts';

export interface SharedHashLocationOptions {
  /**
   * What a state fragment starts with, ahead of the state's URL. With `tour`,
   * `#tour/views` is the state URL `/views`, and `#tour` alone stays the
   * page's anchor. The default, `''`, owns every `#/…` fragment.
   */
  prefix?: string;
}

/**
 * A hash location for an app inside a page that uses the fragment too. It owns
 * the fragments that start with its prefix; any other fragment is the page's
 * own anchor, and the router keeps the state it is in.
 */
export class SharedHashLocationService extends HashLocationService {
  private readonly prefix: string;

  // The last state URL the fragment carried: what the router reads while the fragment is the page's.
  private stateUrl = '';

  constructor(router: UIRouter, { prefix = '' }: SharedHashLocationOptions) {
    super(router);
    this.prefix = prefix;
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

    const oldURL = location.href;

    // Not location.replace(): that drops history.state, which the host page's own router may keep on the entry.
    history.replaceState(history.state, '', hash);
    // replaceState fires no hashchange, and the host page follows the fragment by that event.
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

/** `router.plugin(sharedHashLocationPlugin, { prefix: 'tour' })` */
export function sharedHashLocationPlugin(
  router: UIRouter,
  options: SharedHashLocationOptions = {},
): LocationPlugin {
  const service = new SharedHashLocationService(router, options);
  const configuration = new BrowserLocationConfig(router, false);

  router.locationService = service;
  router.locationConfig = configuration;
  // href() builds `#<hashPrefix><url>`, so uiSref links and hand-written anchors agree.
  router.urlService.config.hashPrefix(options.prefix ?? '');

  return {
    name: 'sharedHashLocation',
    service,
    configuration,
    dispose(disposing: UIRouter) {
      disposing.dispose(service);
      disposing.dispose(configuration);
    },
  };
}

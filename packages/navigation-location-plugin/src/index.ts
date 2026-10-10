import {
  BaseLocationServices,
  BrowserLocationConfig,
  LocationConfig,
  LocationPlugin,
  root,
  splitHash,
  splitQuery,
  stripLastPathElement,
  type Transition,
  UIRouter,
} from '@uirouter/core';

import { composeNavigateUrl } from './compose-navigate-url.js';

const CURRENT_ENTRY_CHANGE_EVENT = 'currententrychange';

const NAVIGATE_EVENT = 'navigate';

// SAFETY: @uirouter/core types `root` as `any`; it is the global object in browsers.
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
  const info: unknown = event?.info;

  return (
    (typeof info === 'object' || typeof info === 'function') &&
    info !== null &&
    'uiRouter' in info &&
    info.uiRouter instanceof UIRouter
  );
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
   * `focusReset` defaults to `'manual'`, so focus stays where it was, as under
   * `pushStateLocationPlugin`. Return `focusReset: 'after-transition'` to have
   * the browser move focus to `<body>` after each navigation instead.
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
   * } satisfies NavigationLocationPluginOptions);
   * ```
   */
  intercept?: (event: UIRouterNavigateEvent) => NavigationInterceptOptions;

  /**
   * Intercepts back/forward traversals of this document, so the browser
   * restores scroll, and resets focus if asked to, once the router transition
   * the traversal starts has settled.
   *
   * Absent, the service leaves traversals alone and the browser restores
   * their scroll position straight away, before the router transition the
   * traversal starts has run. Passed, the service intercepts each `traverse`
   * navigation it can intercept, other than one this plugin started itself,
   * with a handler that waits for that router transition, including its
   * redirects, to settle. A superseding navigation ends the wait.
   *
   * Pass `true` for the defaults, or a function whose return value is handed
   * to `event.intercept()`. The function runs at `navigate` time, before the
   * router transition exists, so unlike {@link intercept} it cannot read the
   * destination state's `data`. Its `handler` runs after the router
   * transition settles, and the service forces a layout once it settles, so
   * the browser restores scroll against the rendered view. `focusReset` and
   * `scroll` pass through; `focusReset` defaults to `'manual'`, as for
   * {@link intercept}.
   *
   * @example
   * ```ts
   * router.plugin(navigationLocationPlugin, {
   *   interceptTraverse: (event) => ({
   *     async handler() {
   *       // the destination view has rendered
   *     },
   *   }),
   * } satisfies NavigationLocationPluginOptions);
   * ```
   */
  interceptTraverse?:
    | true
    | ((event: NavigateEvent) => NavigationInterceptOptions);
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
      this._onCurrentEntryChange,
      false,
    );
    this._navigation().addEventListener(NAVIGATE_EVENT, this._intercept);
  }

  // Firefox repeats currententrychange, from the entry it is already on, after an intercepted traversal in an iframe (#1192).
  private readonly _onCurrentEntryChange = (
    event: NavigationCurrentEntryChangeEvent,
  ): void => {
    if (
      event.navigationType === 'traverse' &&
      event.from === this._navigation().currentEntry
    ) {
      return;
    }

    this._listener(event);
  };

  // Keeps this service's own navigations same-document; another router's are not ours.
  private readonly _intercept = (event: NavigateEvent): void => {
    if (!event.canIntercept) {
      return;
    }

    if (!isUIRouterNavigateEvent(event)) {
      this._interceptTraverse(event);

      return;
    }

    if (event.info.uiRouter !== this._router) {
      return;
    }

    // Focus stays put, as under pushStateLocationPlugin; the option's own focusReset wins.
    event.intercept({
      focusReset: 'manual',
      ...(this._options.intercept?.(event) ?? {
        handler: () => Promise.resolve(),
      }),
    });
  };

  private _interceptTraverse(event: NavigateEvent): void {
    const option = this._options.interceptTraverse;

    if (!option || event.navigationType !== 'traverse') {
      return;
    }

    // currententrychange runs the URL sync before the handler, so the transition is created by then.
    let transition: Transition | undefined;

    // SAFETY: hook registration returns its deregistration function, typed only as `Function`.
    const stopWatching = this._router.transitionService.onCreate(
      {},
      (created) => {
        if (
          !transition ||
          created.originalTransition() === transition.originalTransition()
        ) {
          transition = created;
        }
      },
    ) as () => void;

    const aborted = new Promise<void>((resolve) =>
      event.signal.addEventListener('abort', () => resolve(), { once: true }),
    );

    void aborted.then(stopWatching);
    const { handler, ...options } = option === true ? {} : option(event);

    const settle = async (): Promise<void> => {
      // A redirect replaces the awaited transition before its promise settles.
      for (let awaited = transition; awaited && !event.signal.aborted;) {
        await Promise.race([awaited.promise.catch(() => undefined), aborted]);
        awaited = awaited === transition ? undefined : transition;
      }

      stopWatching();

      if (!event.signal.aborted) {
        await handler?.();
        // Gecko and WebKit restore scroll against the last layout, so the restored view must be laid out.
        void globalRoot.document.documentElement.scrollHeight;
      }
    };

    // Firefox reruns a pending handler of an intercepted traversal in an iframe (#1192).
    let settled: Promise<void> | undefined;
    event.intercept({
      focusReset: 'manual',
      ...options,
      handler: () => (settled ??= settle()),
    });
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
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- opaque history state, forwarded to navigate() which types it unknown
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
      this._onCurrentEntryChange,
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

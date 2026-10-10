# ui-router-navigation-location-plugin

[![npm version](https://img.shields.io/npm/v/ui-router-navigation-location-plugin.svg)](https://npmx.dev/package/ui-router-navigation-location-plugin)
[![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-navigation-location-plugin@*)](https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-navigation-location-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Flit-ui-router.dev)](https://lit-ui-router.dev)
[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/graph/badge.svg?component=navigation-location-plugin)](https://app.codecov.io/gh/simshanith/lit-ui-router?components%5B0%5D=navigation-location-plugin)
[![Can I Use Navigation API](https://img.shields.io/badge/caniuse-Navigation%20API-orange)](https://caniuse.com/mdn-api_navigation)

A UI-Router location plugin that uses the modern browser Navigation API for URL management.

## Features

- Uses the modern [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) instead of the History API
- Exposes UIRouter context in navigation events
- Proper `<base href>` handling for non-root deployments
- Supports navigation state and title metadata

## Installation

```bash
npm install ui-router-navigation-location-plugin
# or
pnpm add ui-router-navigation-location-plugin
# or
yarn add ui-router-navigation-location-plugin
```

The type declarations reference the global `Navigation`, `NavigateEvent` and `NavigationInterceptOptions` types, which TypeScript ships from 6.0. On TypeScript 5.x, also install `@types/dom-navigation` and add `"dom-navigation"` to `compilerOptions.types`.

## Quick Start

Framework bindings (`UIRouterLit`, and likewise the React and Angular bindings) set up the router's services for you. A plain `@uirouter/core` `UIRouter` needs `servicesPlugin` registered before the location plugin:

```typescript
import { UIRouter, servicesPlugin } from '@uirouter/core';
import { navigationLocationPlugin } from 'ui-router-navigation-location-plugin';

const router = new UIRouter();
router.plugin(servicesPlugin);
router.plugin(navigationLocationPlugin);
```

## Navigation Event Interception

The plugin intercepts the navigations it starts, so a router transition commits as a same-document navigation. The `intercept` option returns the [`NavigationInterceptOptions`](https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent/intercept#options) for each of those navigations, with the router available as `event.info.uiRouter` — it is where the app's extra work goes: view transitions, analytics, progress UI. The function runs after the router transition has committed, so `handler` governs when `navigation.transition.finished` settles and when the browser resets focus and restores scroll, not the transition itself.

```typescript
import {
  navigationLocationPlugin,
  type NavigationLocationPluginOptions,
} from 'ui-router-navigation-location-plugin';

router.plugin(navigationLocationPlugin, {
  intercept: (event) => ({
    async handler() {
      // the app's extra work: view transitions, analytics, progress UI…
    },
  }),
} satisfies NavigationLocationPluginOptions);
```

Without the option, the plugin intercepts with a handler that resolves immediately.

### Focus

The plugin intercepts with `focusReset: 'manual'`, so focus stays where it was across a router navigation, as it does under `pushStateLocationPlugin`. A `focusReset` returned from `intercept` takes precedence; `'after-transition'` restores the platform behaviour of moving focus to `<body>` after each navigation, as a full page load would.

Keeping focus in place suits list–detail and in-page navigation. When a navigation replaces the view that held focus, the focused element leaves the document and focus falls back to `<body>`; move it yourself, for example to the new view's heading:

```typescript
router.transitionService.onSuccess({}, () => {
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>('main h1')?.focus(),
  );
});
```

The heading needs `tabindex="-1"` to take focus. See [Focus handling](https://developer.chrome.com/docs/web-platform/navigation-api#focus_handling) for the platform behaviour.

### Scroll

The plugin leaves `scroll` at the platform default, `'after-transition'`: once `handler` settles, the browser scrolls each router navigation to its URL's fragment, or to the top of the page. `pushStateLocationPlugin` leaves the scroll position where it was. Back and forward are traversals the plugin leaves alone unless asked (see [Back and forward](#back-and-forward)); the browser then restores their scroll position straight away under either plugin.

The default handler resolves immediately, so the browser can scroll before the new view has rendered. `intercept` runs once per navigation, while the router's `globals.transition` is still the transition being committed, so the scroll behaviour can depend on the route. In this example, a state flagged `data: { keepScroll: true }` (say, a message opening beside its list) returns `scroll: 'manual'` and keeps the list where it was. Every other navigation waits a frame for the views to render, then calls `event.scroll()` before any slower work:

```typescript
router.plugin(navigationLocationPlugin, {
  intercept: (event) => {
    const { transition } = event.info.uiRouter.globals;
    if (transition?.to().data?.keepScroll) {
      return { scroll: 'manual' };
    }
    return {
      async handler() {
        await new Promise(requestAnimationFrame);
        event.scroll();
        // slower work: analytics, prefetching…
      },
    };
  },
} satisfies NavigationLocationPluginOptions);
```

See [Scroll handling](https://developer.chrome.com/docs/web-platform/navigation-api#scroll_handling) for the platform behaviour.

#### Back and forward

A back or forward traversal starts a router transition only once the browser has committed it, so the browser restores the scroll position before the previous view is back, and a page that is shorter in the meantime loses it. The `interceptTraverse` option makes the plugin intercept those traversals with a handler that waits for the router transition, including its redirects, so `scroll: 'after-transition'` restores the position once the view has rendered:

```typescript
router.plugin(navigationLocationPlugin, { interceptTraverse: true });
```

Pass a function instead of `true` to return the `NavigationInterceptOptions` for each traversal. The function runs at `navigate` time, before the router transition exists, so unlike `intercept` it cannot read the destination state's `data`. Its `handler` runs after the router transition settles, which is the place to wait for views that render later, and `focusReset` defaults to `'manual'` as it does for `intercept`. Firefox, and WebKit in an iframe, restore scroll against the last layout, so the plugin forces a layout once `handler` settles. A navigation that supersedes the traversal ends the wait.

In WebKit, a traversal that supersedes another traversal (back, then back again) commits, but its `navigation.transition.finished` rejects with an `AbortError`; the router still ends on the state of the URL, so code that awaits `finished` should not treat that rejection as a failed navigation.

Listeners that only observe navigations can tell router-driven ones apart with `isUIRouterNavigateEvent`, which also narrows `event.info` to carry the router.

## What Else Observes Navigation

`navigation.navigate()` does not call `history.pushState`, does not call `history.replaceState`, and does not fire `popstate`. Anything that watches for navigation by patching those methods — Google Analytics' enhanced measurement is the common case, and most session-replay and RUM shims do the same — is blind to router-driven navigation under this plugin. Nothing throws; the events simply stop arriving.

The gap is narrower than it first looks. Taking gtag as the worked example:

| Navigation                | Who sees it                     |
| ------------------------- | ------------------------------- |
| Cold load                 | gtag, via its own `config` call |
| Router transition         | **nobody** — this is the gap    |
| Back/forward (`traverse`) | gtag, via `popstate`            |

So the fix is not "switch the integration off and send everything by hand" — that double-counts traversals. Send exactly what the observer cannot see, by reading the navigation kind off a second `navigate` listener:

```typescript
let lastNavigationType = '';

// records only — a `navigate` listener is an interception boundary
// solely when it calls `event.intercept()`
window.navigation.addEventListener('navigate', (event) => {
  lastNavigationType = event.navigationType;
});

router.transitionService.onSuccess({}, () => {
  // read once per transition: a transition with no `navigate` event of its
  // own must not reuse the previous one's kind
  const navigationType = lastNavigationType;
  lastNavigationType = '';

  if (navigationType === 'push' || navigationType === 'replace') {
    gtag('event', 'page_view', { page_location: location.href });
  }
});
```

See [What else observes navigation](https://lit-ui-router.dev/packages/navigation-plugin#what-else-observes-navigation) for the full walkthrough.

## API

### `navigationLocationPlugin`

Factory function that creates a `LocationPlugin` for use with UIRouter. Options passed to `router.plugin()` reach the location service.

```typescript
router.plugin(navigationLocationPlugin);
router.plugin(navigationLocationPlugin, options);
```

```typescript
function navigationLocationPlugin(
  router: UIRouter,
  options?: NavigationLocationPluginOptions,
): LocationPlugin;
```

### `NavigationLocationPluginOptions`

```typescript
interface NavigationLocationPluginOptions {
  intercept?: (event: UIRouterNavigateEvent) => NavigationInterceptOptions;
  interceptTraverse?:
    | true
    | ((event: NavigateEvent) => NavigationInterceptOptions);
}
```

- `intercept` — called for each navigation the service starts, after the router transition has committed; its return value is handed to `event.intercept()`. See [Navigation Event Interception](#navigation-event-interception).
- `interceptTraverse` — opts back/forward traversals into interception that waits for the router transition they start; a function returns the `NavigationInterceptOptions` for each. See [Back and forward](#back-and-forward).

### `NavigationLocationService`

The location service class that extends `BaseLocationServices` from `@uirouter/core`. Handles URL reading and writing using the Navigation API. Its constructor takes the router and `NavigationLocationPluginOptions`.

#### `protected _navigation(): Navigation`

Returns the Navigation API object the service drives — the single seam through
which every `navigation` touch point goes (`addEventListener` on construct,
`navigate` on `_set`, `removeEventListener` on `dispose`).

Override it in a subclass to substitute a stub, so tests can assert against the
calls the service makes without booting a browser to spy on a global:

```typescript
class StubbedNavigationLocationService extends NavigationLocationService {
  readonly calls: string[] = [];

  protected override _navigation(): Navigation {
    return {
      addEventListener: () => {},
      removeEventListener: () => {},
      navigate: (url: string) => {
        this.calls.push(url);
        return { committed: Promise.resolve(), finished: Promise.resolve() };
      },
    } as unknown as Navigation;
  }
}
```

### `isUIRouterNavigateEvent(event)`

Type guard function to check if a `NavigateEvent` was triggered by UIRouter. Use it in a `navigate` listener that observes navigations to read the router off `event.info`; the plugin intercepts its own navigations, and extra work on them goes through the `intercept` option.

```typescript
function isUIRouterNavigateEvent(
  event?: NavigateEvent,
): event is UIRouterNavigateEvent;
```

### `UIRouterNavigateEvent`

Extended `NavigateEvent` interface with UIRouter metadata in the `info` property.

### `UIRouterNavigateInfo`

Interface for the navigation event info containing the `uiRouter` instance.

```typescript
interface UIRouterNavigateInfo {
  uiRouter: UIRouter;
}
```

## Browser Compatibility

The Navigation API is supported in all modern engines:

| Browser | Support |
| ------- | ------- |
| Chrome  | 102+    |
| Edge    | 102+    |
| Firefox | 147+    |
| Safari  | 26.2+   |

Check [caniuse.com](https://caniuse.com/mdn-api_navigation) for current support status.

The real round-trip specs — `index.spec.ts` and `url-shape.spec.ts`, where navigations actually commit and events actually fire — run on Chromium on every pull request via `test`/`test:coverage`, and on Firefox and WebKit on every push to `main` via `test:engines` (on demand through a `ci-main/` branch or the `mainGraph` dispatch). The Cypress end-to-end suite runs in Electron only.

For older browsers, consider using:

- `pushStateLocationPlugin` - History API based (wide support)
- `hashLocationPlugin` - Hash-based URLs (universal support)

## Comparison with Other Location Plugins

| Feature            | Navigation API | pushState | hash      |
| ------------------ | -------------- | --------- | --------- |
| Modern standard    | Yes            | No        | No        |
| Event interception | Yes            | No        | No        |
| Browser support    | Modern engines | Wide      | Universal |
| SEO friendly       | Yes            | Yes       | No        |
| Clean URLs         | Yes            | Yes       | No        |

## Links

- [Docs - Navigation API Plugin](https://lit-ui-router.dev/packages/navigation-plugin)
- [Docs - Location Plugins guide](https://lit-ui-router.dev/guides/location-plugins)
- [MDN - Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
- [Chrome for Developers - Modern client-side routing: the Navigation API](https://developer.chrome.com/docs/web-platform/navigation-api)
- [@uirouter/core - LocationPlugin](https://ui-router.github.io/core/docs/latest/interfaces/_vanilla_interface_.locationplugin.html)
- [@uirouter/core - LocationServices](https://ui-router.github.io/core/docs/latest/interfaces/_common_coreservices_.locationservices.html)
- [@uirouter/core - BaseLocationServices](https://ui-router.github.io/core/docs/latest/classes/_vanilla_baselocationservice_.baselocationservices.html)
- [Can I Use - Navigation API](https://caniuse.com/mdn-api_navigation)

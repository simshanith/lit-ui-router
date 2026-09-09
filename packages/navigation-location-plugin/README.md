# ui-router-navigation-location-plugin

[![npm version](https://img.shields.io/npm/v/ui-router-navigation-location-plugin.svg)](https://npmx.dev/package/ui-router-navigation-location-plugin)
[![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-navigation-location-plugin@*)](https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-navigation-location-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Flit-ui-router.dev)](https://lit-ui-router.dev)
[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/graph/badge.svg?component=navigation-location-plugin)](https://app.codecov.io/gh/simshanith/lit-ui-router?components%5B0%5D=navigation-location-plugin)
[![Can I Use Navigation API](https://img.shields.io/badge/caniuse-Navigation%20API-orange)](https://caniuse.com/mdn-api_navigation)

> **Experimental**: this plugin is a new implementation without the production mileage of the battle-tested `pushState`/`hash` location services. The underlying [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) is also only recently cross-engine (Firefox 147+, Safari 26.2+), so non-Chromium behavior is lightly exercised.

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

## Quick Start

```typescript
import { UIRouter } from '@uirouter/core';
import { navigationLocationPlugin } from 'ui-router-navigation-location-plugin';

const router = new UIRouter();
router.plugin(navigationLocationPlugin);
```

## Navigation Event Interception

A key feature of this plugin is exposing the UIRouter instance in navigation events, enabling interception:

```typescript
import { isUIRouterNavigateEvent } from 'ui-router-navigation-location-plugin';

window.navigation.addEventListener('navigate', (event) => {
  if (isUIRouterNavigateEvent(event)) {
    // Access UIRouter during navigation
    const { uiRouter } = event.info;
  }
});
```

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

Factory function that creates a `LocationPlugin` for use with UIRouter.

```typescript
router.plugin(navigationLocationPlugin);
```

### `NavigationLocationService`

The location service class that extends `BaseLocationServices` from `@uirouter/core`. Handles URL reading and writing using the Navigation API.

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

Type guard function to check if a `NavigateEvent` was triggered by UIRouter.

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

For older browsers, consider using:

- `pushStateLocationPlugin` - History API based (wide support)
- `hashLocationPlugin` - Hash-based URLs (universal support)

## Comparison with Other Location Plugins

| Feature            | Navigation API | pushState | hash      |
| ------------------ | -------------- | --------- | --------- |
| Modern standard    | Yes            | No        | No        |
| Event interception | Yes            | No        | No        |
| Browser support    | Modern engines | Wide      | Universal |
| Production mileage | New            | Wide      | Wide      |
| SEO friendly       | Yes            | Yes       | No        |
| Clean URLs         | Yes            | Yes       | No        |

## Links

- [Docs - Navigation API Plugin](https://lit-ui-router.dev/packages/navigation-plugin)
- [Docs - Location Plugins guide](https://lit-ui-router.dev/guides/location-plugins)
- [MDN - Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
- [@uirouter/core - LocationPlugin](https://ui-router.github.io/core/docs/latest/interfaces/_vanilla_interface_.locationplugin.html)
- [@uirouter/core - LocationServices](https://ui-router.github.io/core/docs/latest/interfaces/_common_coreservices_.locationservices.html)
- [@uirouter/core - BaseLocationServices](https://ui-router.github.io/core/docs/latest/classes/_vanilla_baselocationservice_.baselocationservices.html)
- [Can I Use - Navigation API](https://caniuse.com/mdn-api_navigation)

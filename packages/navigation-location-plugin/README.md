# ui-router-navigation-location-plugin

[![npm version](https://img.shields.io/npm/v/ui-router-navigation-location-plugin.svg)](https://www.npmjs.com/package/ui-router-navigation-location-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Can I Use Navigation API](https://img.shields.io/badge/caniuse-Navigation%20API-orange)](https://caniuse.com/mdn-api_navigation)

> **Experimental**: This plugin uses the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API), which has limited browser support.

A UI-Router location plugin that uses the modern browser Navigation API for URL management.

## Features

- Uses the modern [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) instead of the History API
- Exposes UIRouter context in navigation events for interception
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
    const { uiRouter } = event.info;

    event.intercept({
      async handler() {
        // Access UIRouter during navigation
        console.log('Navigating via UIRouter:', uiRouter);
      },
    });
  }
});
```

## API

### `navigationLocationPlugin`

Factory function that creates a `LocationPlugin` for use with UIRouter.

```typescript
router.plugin(navigationLocationPlugin);
```

### `NavigationLocationService`

The location service class that extends `BaseLocationServices` from `@uirouter/core`. Handles URL reading and writing using the Navigation API.

### `isUIRouterNavigateEvent(event)`

Type guard function to check if a `NavigateEvent` was triggered by UIRouter.

```typescript
function isUIRouterNavigateEvent(event?: NavigateEvent): event is UIRouterNavigateEvent;
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

The Navigation API has limited browser support:

| Browser | Support |
|---------|---------|
| Chrome | 102+ |
| Edge | 102+ |
| Firefox | Not supported |
| Safari | Not supported |

Check [caniuse.com](https://caniuse.com/mdn-api_navigation) for current support status.

For broader browser support, consider using:
- `pushStateLocationPlugin` - History API based (wide support)
- `hashLocationPlugin` - Hash-based URLs (universal support)

## Comparison with Other Location Plugins

| Feature | Navigation API | pushState | hash |
|---------|----------------|-----------|------|
| Modern standard | Yes | No | No |
| Event interception | Yes | No | No |
| Browser support | Limited | Wide | Universal |
| SEO friendly | Yes | Yes | No |
| Clean URLs | Yes | Yes | No |

## Links

- [MDN - Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
- [@uirouter/core - LocationPlugin](https://ui-router.github.io/core/docs/latest/interfaces/_vanilla_interface_.locationplugin.html)
- [@uirouter/core - LocationServices](https://ui-router.github.io/core/docs/latest/interfaces/_common_coreservices_.locationservices.html)
- [@uirouter/core - BaseLocationServices](https://ui-router.github.io/core/docs/latest/classes/_vanilla_baselocationservice_.baselocationservices.html)
- [Can I Use - Navigation API](https://caniuse.com/mdn-api_navigation)

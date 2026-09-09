---
title: Navigation API Plugin
description: Manage URLs with the modern browser Navigation API using ui-router-navigation-location-plugin
---

# ui-router-navigation-location-plugin

<p class="badges">
<a href="https://npmx.dev/package/ui-router-navigation-location-plugin" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/ui-router-navigation-location-plugin" /></a>
<a href="https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-navigation-location-plugin" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-navigation-location-plugin@*" /></a>
</p>

[`ui-router-navigation-location-plugin`](https://npmx.dev/package/ui-router-navigation-location-plugin)
is a UI-Router [location plugin](#how-location-plugins-fit-in) that manages
URLs with the modern browser
[Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
instead of the History API — and exposes the router inside navigation events,
something the classic plugins cannot do.

It works with **any** `@uirouter/core`-based router, not just lit-ui-router.

::: warning Experimental
This plugin is a new implementation without the production mileage of the
battle-tested `pushState`/`hash` location services. The Navigation API itself
is also only recently cross-engine (Firefox 147+, Safari 26.2+), so
non-Chromium behavior is lightly exercised.
:::

## How location plugins fit in

UI-Router delegates all URL reading and writing to a pluggable location
service. `@uirouter/core` ships two: `hashLocationPlugin` (`/#/path`) and
`pushStateLocationPlugin` (`/path`, History API). This package adds a third
strategy with the same clean URLs as `pushState`:

| Feature            | Navigation API | pushState | hash      |
| ------------------ | -------------- | --------- | --------- |
| Modern standard    | Yes            | No        | No        |
| Event interception | Yes            | No        | No        |
| Browser support    | Modern engines | Wide      | Universal |
| Production mileage | New            | Wide      | Wide      |
| SEO friendly       | Yes            | Yes       | No        |
| Clean URLs         | Yes            | Yes       | No        |

## Installation

```bash
npm install ui-router-navigation-location-plugin
# or
pnpm add ui-router-navigation-location-plugin
```

## Quick start

```ts
import { navigationLocationPlugin } from 'ui-router-navigation-location-plugin';
import { UIRouterLit } from 'lit-ui-router';

const router = new UIRouterLit();
router.plugin(navigationLocationPlugin);
```

### Feature-detect with a fallback

The Navigation API is supported in Chrome/Edge 102+, Firefox 147+, and Safari
26.2+ ([caniuse](https://caniuse.com/mdn-api_navigation)). For older browsers,
fall back to the History API — the URLs are identical:

```ts
import { pushStateLocationPlugin } from '@uirouter/core';
import { navigationLocationPlugin } from 'ui-router-navigation-location-plugin';

router.plugin(
  'navigation' in window ? navigationLocationPlugin : pushStateLocationPlugin,
);
```

This is the strategy the <a href="/app" target="_self">sample app</a> uses by
default — its Preferences → Feature Flags panel lets you switch between all
three plugins and shows browser compatibility for each.

## Navigation event interception

The plugin's headline feature: it passes the `UIRouter` instance along in each
navigation's [`info`](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/navigate#info)
metadata, so a global `navigate` listener can distinguish router-driven
navigations from everything else and access the router while handling them:

```ts
import { isUIRouterNavigateEvent } from 'ui-router-navigation-location-plugin';

window.navigation.addEventListener('navigate', (event) => {
  if (isUIRouterNavigateEvent(event)) {
    // A UIRouter transition drove this navigation
    const { uiRouter } = event.info;
    event.intercept({
      async handler() {
        // e.g. integrate view transitions, analytics, progress UI…
      },
    });
  }
});
```

## What else observes navigation

`navigation.navigate()` does not call `history.pushState`, does not call
`history.replaceState`, and does not fire `popstate`. Anything that watches for
navigation by patching those methods — Google Analytics' enhanced measurement is
the common case, and most session-replay and RUM shims do the same — is
therefore blind to router-driven navigation under this plugin. Nothing throws;
the events simply stop arriving, which is the kind of thing you discover in
production a week later.

The gap is narrower than it first looks. Taking gtag as the worked example:

| Navigation                | Who sees it                     |
| ------------------------- | ------------------------------- |
| Cold load                 | gtag, via its own `config` call |
| Router transition         | **nobody** — this is the gap    |
| Back/forward (`traverse`) | gtag, via `popstate`            |

So the fix is not "switch the integration off and send everything by hand" —
that double-counts traversals. Send exactly what the observer cannot see, by
reading the navigation kind off a second `navigate` listener:

```ts
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

The <a href="/app" target="_self">sample app</a> boots this plugin by default,
so it is running the rule live: see
[`ga.js`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/util/ga.js),
whose Cypress suite asserts the resulting `page_view` counts separately under
each location plugin.

## API summary

- **`navigationLocationPlugin`** — the plugin factory; pass it to
  `router.plugin(...)`
- **`NavigationLocationService`** — the location service class (extends
  `BaseLocationServices` from `@uirouter/core`); handles URL reads/writes via
  the Navigation API, including `<base href>` handling for non-root
  deployments and navigation state/title metadata
- **`isUIRouterNavigateEvent(event)`** — type guard: was this `NavigateEvent`
  triggered by UIRouter?
- **`UIRouterNavigateEvent` / `UIRouterNavigateInfo`** — the extended event
  and `info` types carrying the `uiRouter` instance

See the full [API reference](/api/navigation-location-plugin/).

## Further reading

- [MDN — Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
- [Can I Use — Navigation API](https://caniuse.com/mdn-api_navigation)
- [@uirouter/core — LocationPlugin](https://ui-router.github.io/core/docs/latest/interfaces/_vanilla_interface_.locationplugin.html)

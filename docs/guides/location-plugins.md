---
title: Location Plugins
description: Choosing a URL strategy - hash, pushState, or the Navigation API
---

# Location Plugins

UI-Router delegates all URL reading and writing to a pluggable **location
service**. Exactly one location plugin must be registered before
`router.start()`; which one you choose determines what your URLs look like
and what your server must do.

| Plugin       | URL format | Browser support                              | Server requirements          |
| ------------ | ---------- | -------------------------------------------- | ---------------------------- |
| `hash`       | `/#/path`  | All browsers                                 | None                         |
| `pushState`  | `/path`    | Modern browsers                              | Rewrite URLs to `index.html` |
| `navigation` | `/path`    | Chrome/Edge 102+, Firefox 147+, Safari 26.2+ | Rewrite URLs to `index.html` |

## Hash URLs

The fragment (`#`) portion of a URL never reaches the server, so hash routing
works on any static file host with zero configuration — the right default for
demos, StackBlitz examples, and file-based deployments:

```ts
import { hashLocationPlugin } from '@uirouter/core';

router.plugin(hashLocationPlugin);
// URLs look like https://example.com/#/people/3
```

The trade-offs: URLs are less clean, and the fragment is invisible to servers
and most crawlers, so hash URLs are a poor fit when SEO matters.

## HTML5 pushState

`pushStateLocationPlugin` uses the History API for real paths:

```ts
import { pushStateLocationPlugin } from '@uirouter/core';

router.plugin(pushStateLocationPlugin);
// URLs look like https://example.com/people/3
```

Two things to configure:

**Server rewrites.** A user can bookmark or refresh `/people/3`, and the
browser will request that path from your server. The server must respond with
your `index.html` for every application route (an "SPA fallback" — most
hosts have a one-line setting for this).

**Base tag.** When the app is served from a subdirectory rather than the
origin root, declare it with a `<base>` tag so the router resolves paths
correctly:

```html
<base href="/my-app/" />
```

## Navigation API

[`ui-router-navigation-location-plugin`](https://www.npmjs.com/package/ui-router-navigation-location-plugin)
is an experimental companion package that produces the same clean URLs as
`pushState`, but drives them with the modern
[Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
and exposes the router inside `navigate` events for interception. Since the
API is only recently cross-engine, pair it with a fallback:

```ts
import { pushStateLocationPlugin } from '@uirouter/core';
import { navigationLocationPlugin } from 'ui-router-navigation-location-plugin';

router.plugin('navigation' in window ? navigationLocationPlugin : pushStateLocationPlugin);
```

The <a href="/app" target="_self">sample app</a> ships all three strategies —
its Preferences → Feature Flags panel switches between them and shows browser
compatibility for each.

## The initial rule

Whatever plugin you choose, tell the router where to go when the app loads at
its root URL (empty path) — otherwise nothing renders until the user clicks a
link:

```ts
router.urlService.rules.initial({ state: 'home' });
```

`initial` only matches the empty initial URL. For URLs that match no state at
all, add an `otherwise` rule — see
[Unmatched URLs (404)](./unmatched-urls).

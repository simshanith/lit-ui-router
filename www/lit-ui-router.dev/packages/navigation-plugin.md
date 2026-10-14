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

The real round-trip specs — `index.spec.ts` and `url-shape.spec.ts`, where
navigations actually commit and events actually fire — run on Chromium on every
pull request via `test`/`test:coverage`, and on Firefox and WebKit on every
push to `main` via `test:engines` (on demand through a `ci-main/` branch or the
`mainGraph` dispatch). The Cypress end-to-end suite runs in Chrome only.

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
| SEO friendly       | Yes            | Yes       | No        |
| Clean URLs         | Yes            | Yes       | No        |

## Installation

```bash
npm install ui-router-navigation-location-plugin
```

The type declarations reference the global `Navigation` and `NavigateEvent`
types, which TypeScript ships from 6.0. On TypeScript 5.x, also install
`@types/dom-navigation` and add `"dom-navigation"` to `compilerOptions.types`.

## Quick start

```ts
import { navigationLocationPlugin } from 'ui-router-navigation-location-plugin';
import { UIRouterLit } from 'lit-ui-router';

const router = new UIRouterLit();
router.plugin(navigationLocationPlugin);
```

Framework bindings (`UIRouterLit`, and likewise the React and Angular bindings)
set up the router's services for you. A plain `@uirouter/core` `UIRouter` needs
`router.plugin(servicesPlugin)` registered before the location plugin.

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

The plugin intercepts the navigations it starts, so a router transition commits
as a same-document navigation rather than loading the document afresh.

The `intercept` option returns the
[`NavigationInterceptOptions`](https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent/intercept#options)
for each of those navigations, with the router available as
`event.info.uiRouter`. It is where the app's extra work goes:

```ts
import { navigationLocationPlugin } from 'ui-router-navigation-location-plugin';

router.plugin(navigationLocationPlugin, {
  intercept: (event) => ({
    async handler() {
      // the app's extra work: view transitions, analytics, progress UI…
    },
  }),
});
```

The function runs after the router transition has committed, so `handler`
governs when `navigation.transition.finished` settles and when the browser
resets focus and restores scroll, not the transition itself. Without the option,
the plugin intercepts with a handler that resolves immediately.

### Focus

The plugin intercepts with `focusReset: 'manual'`, so focus stays where it was
across a router navigation, as it does under `pushStateLocationPlugin`. A
`focusReset` returned from `intercept` takes precedence; `'after-transition'`
restores the platform behaviour of moving focus to `<body>` after each
navigation.

When a navigation replaces the view that held focus, the focused element leaves
the document and focus falls back to `<body>`. Move it yourself from an
`onSuccess` hook, for example to the new view's heading (with
`tabindex="-1"`). See
[Focus handling](https://developer.chrome.com/docs/web-platform/navigation-api#focus_handling).

### Scroll

The plugin leaves `scroll` at the platform default, `'after-transition'`: once
`handler` settles, the browser scrolls each router navigation to its URL's
fragment, or to the top of the page. `pushStateLocationPlugin` leaves the scroll
position where it was. Back and forward are traversals the plugin leaves alone
unless asked (see [Back and forward](#back-and-forward)); the browser then
restores their scroll position straight away under either plugin.

The default handler resolves immediately, so the browser can scroll before the
new view has rendered. `intercept` runs once per navigation, while the router's
`globals.transition` is still the transition being committed, so the scroll
behaviour can depend on the route. In this example, a state flagged
`data: { keepScroll: true }` (say, a message opening beside its list) returns
`scroll: 'manual'` and keeps the list where it was. Every other navigation waits
a frame for the views to render, then calls `event.scroll()` before any slower
work:

```ts
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
});
```

The <a href="/app" target="_self">sample app</a> runs this example in
[`router.config.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/router.config.ts),
flagging its message and contact detail states with `keepScroll`.

See
[Scroll handling](https://developer.chrome.com/docs/web-platform/navigation-api#scroll_handling)
for the platform behaviour.

#### Back and forward

A back or forward traversal starts a router transition only once the browser
has committed it, so the browser restores the scroll position before the
previous view is back, and a page that is shorter in the meantime loses it. The
`interceptTraverse` option makes the plugin intercept those traversals with a
handler that waits for the router transition, including its redirects, so
`scroll: 'after-transition'` restores the position once the view has rendered:

```ts
router.plugin(navigationLocationPlugin, { interceptTraverse: true });
```

The <a href="/app" target="_self">sample app</a> passes `interceptTraverse: true`
alongside its `intercept` in
[`router.config.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/router.config.ts).

Pass a function instead of `true` to return the `NavigationInterceptOptions` for
each traversal. The function runs at `navigate` time, before the router
transition exists, so unlike `intercept` it cannot read the destination state's
`data`. Its `handler` runs after the router transition settles, which is the
place to wait for views that render later
([#982](https://github.com/simshanith/lit-ui-router/issues/982) tracks a
`lit-ui-router` signal for that moment), and `focusReset` defaults to
`'manual'` as it does for `intercept`. Firefox, and WebKit in an iframe,
restore scroll against the last layout, so the plugin forces a layout once
`handler` settles. A navigation that supersedes the traversal ends the wait.

In WebKit, a traversal that supersedes another traversal (back, then back
again) commits, but its `navigation.transition.finished` rejects with an
`AbortError`; the router still ends on the state of the URL, so code that awaits
`finished` should not treat that rejection as a failed navigation.

The plugin passes the `UIRouter` instance along in each of its navigations'
[`info`](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/navigate#info)
metadata, so a listener that observes navigations can tell router-driven ones
apart with `isUIRouterNavigateEvent`, which narrows `event.info` to carry the
router.

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

## Reaching past the router

The plugin is a drop-in location strategy: swap it in and nothing else in the
app changes. Links go through `uiSref`, guards through transition hooks, and
extra work on a router navigation through `intercept`. A `navigate` listener of
the app's own reaches past the router, and it is correct in one case only: a
navigation the router does not own.

### When it is correct

A link or form that leaves the app, to a page the server renders, a sign-out
endpoint or a download, never becomes a router transition. The plugin leaves it
alone, the browser loads a new document, and no transition hook runs. The
`navigate` event is the only place the app sees it coming, so holding it while
a draft is unsaved belongs there:

```ts
import { isUIRouterNavigateEvent } from 'ui-router-navigation-location-plugin';

navigation.addEventListener('navigate', (event) => {
  const leavesTheApp =
    !isUIRouterNavigateEvent(event) &&
    (event.navigationType === 'push' || event.navigationType === 'replace') &&
    !event.hashChange;

  if (leavesTheApp && hasUnsavedDraft() && event.cancelable) {
    event.preventDefault();
    askBeforeLeaving(event.destination.url);
  }
});
```

Under this plugin, a push or replace that the router did not start loads a new
document unless something intercepts it, which is what makes `leavesTheApp`
hold. To leave after all, call `navigation.navigate(url, { info })` with an
`info` the listener recognises and lets through. `navigate` fires only for
navigations the document starts; a typed URL or a closed tab never reaches it,
so `beforeunload` stays the backstop.

### When it is a smell

A listener that acts on the router's own navigations, or on URLs the router
matches, is routing around it:

- Cancelling a navigation to keep the user on a state is a transition hook's
  job: return `false` from `onBefore` or `onExit`, and the router knows the
  transition did not happen.
- Extra work on a router navigation goes through
  [`intercept`](#navigation-event-interception), which hands over the same
  event.
- `event.intercept()` on a navigation the router did not start commits its URL
  as a same-document navigation, and the plugin then syncs that URL into the
  router. If the destination renders in the app, it is a state.
- A plain `<a href>` to a router URL loads a new document under this plugin,
  as it does under `pushStateLocationPlugin`. Link with `uiSref`.

### Work scoped to a navigation

Each navigation the plugin intercepts carries an `event.signal`, which aborts
when a newer navigation supersedes it. Work handed to `intercept` that should
not outlive its navigation, such as a prefetch, takes that signal:

```ts
router.plugin(navigationLocationPlugin, {
  intercept: (event) => ({
    handler: () => prefetch(event.destination.url, { signal: event.signal }),
  }),
});
```

The router transition has committed by the time `handler` runs, so an aborted
or failed handler settles `navigation.transition.finished`, not the transition.

### Example

The example holds its Sign out link while the draft is unsaved, and prefetches
on every router navigation through `intercept`. Click between Inbox and Archive
faster than the prefetch finishes to see the superseded one abort. Its log is a
`navigate` listener too, so it shows every router navigation that a
`history.pushState` patch misses (see
[What else observes navigation](#what-else-observes-navigation)).

<LiveExample name="navigation-api" />

## API summary

- **`navigationLocationPlugin`** — the plugin factory; pass it to
  `router.plugin(...)`, with `NavigationLocationPluginOptions` as the second
  argument
- **`NavigationLocationPluginOptions`** — `intercept`, which returns the
  `NavigationInterceptOptions` for each navigation the plugin starts, and
  `interceptTraverse`, which opts back/forward traversals into interception
  that waits for the router transition they start
- **`NavigationLocationService`** — the location service class (extends
  `BaseLocationServices` from `@uirouter/core`); handles URL reads/writes via
  the Navigation API, including `<base href>` handling for non-root
  deployments and navigation state/title metadata
- **`isUIRouterNavigateEvent(event)`** — type guard: was this `NavigateEvent`
  triggered by UIRouter? The plugin intercepts those itself; a listener that
  observes navigations uses the guard to read the router off `event.info`
- **`UIRouterNavigateEvent` / `UIRouterNavigateInfo`** — the extended event
  and `info` types carrying the `uiRouter` instance

See the full [API reference](/api/navigation-location-plugin/).

## Further reading

- [MDN — Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
- [Chrome for Developers — Modern client-side routing: the Navigation API](https://developer.chrome.com/docs/web-platform/navigation-api)
- [Can I Use — Navigation API](https://caniuse.com/mdn-api_navigation)
- [@uirouter/core — LocationPlugin](https://ui-router.github.io/core/docs/latest/interfaces/_vanilla_interface_.locationplugin.html)

---
title: Guides
description: Task-oriented guides for lit-ui-router, grouped by topic
---

# Guides

Task-oriented pages for the concepts real apps hit after the
[tutorial](/tutorial/helloworld). Each guide is grounded in the
[sample app](/sample-app)'s working implementation — a webmail + contacts
client deployed across every point on the server-support spectrum.

## URLs & Location

- [Location Plugins](./location-plugins) — choosing a URL strategy: hash,
  pushState, or the Navigation API; server rewrites, the `<base>` tag, and
  the `initial` rule
- [Navigation API Plugin](./navigation-plugin) — the experimental
  `ui-router-navigation-location-plugin` companion package: clean URLs via
  the modern Navigation API, with navigation event interception
- [Unmatched URLs (404)](./unmatched-urls) — route URLs that match no state
  to a deliberate 404 state with `urlService.rules.otherwise`
- [Server-Side Routing](./server-route-matching) — serve routing verdicts
  at the edge with `ui-router-server`: the app shell for real routes, 302
  entry redirects, and real 404s for everything else, across the full
  server-support spectrum (every level [live on the site](/sample-app)).
  Routing honesty ships today; content rendering — build-time pre-rendering
  and server-side rendering — is the roadmap next axis on the same spine

## Transitions & Guards

- [Route Guards](./route-guards) — protect states with transition hooks: the
  `requiresAuth` pattern, redirect-to-login, and returning the user after
  authentication
- [Component Lifecycle Hooks](./component-lifecycle) — `uiCanExit` for
  unsaved-changes prompts and `uiOnParamsChanged` for dynamic parameters

## Reactivity

- [Reactive Components](./reactive-components) — keep components outside
  `<ui-view>` in sync with the router using the zero-dependency
  `TransitionController`
- [MobX Bindings](./mobx) — the `lit-ui-router-mobx` companion package: an
  observable router store and reaction-based controllers

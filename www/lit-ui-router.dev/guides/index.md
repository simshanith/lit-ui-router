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
- [Unmatched URLs (404)](./unmatched-urls) — route URLs that match no state
  to a deliberate 404 state with `urlService.rules.otherwise`
- [Server-Side Routing](./server-route-matching) — serve routing verdicts
  at the edge with `ui-router-server`: the app shell for real routes, 302
  entry redirects, and real 404s for everything else, across the full
  server-support spectrum (every level [live on the site](/sample-app)), and
  [`lit-ui-router-ssr`](/packages/ssr) for prerendering those verdicts to
  static html at build time

## Transitions & Guards

- [Route Guards](./route-guards) — protect states with transition hooks: the
  `requiresAuth` pattern, redirect-to-login, and returning the user after
  authentication
- [Loading and Error Views](./loading-and-error-views) — a pending indicator
  while a transition runs, skeletons for `NOWAIT` resolves, and an error view
  with retry when a transition fails
- [Component Lifecycle Hooks](./component-lifecycle) — `uiCanExit` for
  unsaved-changes prompts and `uiOnParamsChanged` for dynamic parameters
- [Routed Components](./routed-components) — reading a state's params
  through a resolve, code-splitting a route's element with an awaited import
  or a `lazyLoad` future state, and reaching the element a view rendered

## Links & Markup

- [View Fallback Content](./view-fallback-content) — what a `<ui-view>`
  renders when no routed component is active: the capture rules, the
  master/detail idiom, and what a prerendered shell emits
- [Design System Links](./design-system-links) — driving a design system's
  link component (`<sp-link>`, `<md-*>`, an in-house one) with `uiSref`:
  `assignHref: true` is the option for a custom element that declares its own
  `href`, and `'auto'` scopes the attribute to real `<a>` elements, with a
  live example contrasting all three cases

## Builds & Diagnostics

- [Development and Production Builds](./development-builds) — the `development`
  export condition, the warnings the development build carries and the
  production build cannot print, and which packages ship two builds at all

## Reactivity

- [Reactive Components](./reactive-components) — keep components outside
  `<ui-view>` in sync with the router using the zero-dependency
  `TransitionController`

## Companion Packages

The [companion packages](/packages/) — Effect, MobX and Signals bindings, the
Navigation API location plugin, typed state names, server-side routing
verdicts, static prerendering and ESLint rules — are optional and
independently versioned, each with its own guide and API reference.

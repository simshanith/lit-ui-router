---
title: Companion Packages
description: Optional packages that layer extra integrations on lit-ui-router — MobX bindings and the Navigation API location plugin — each independently versioned with its own guide and API reference
---

# Companion Packages

`lit-ui-router` is the core package. **Companion packages** layer optional
integrations on top of it — each is published and versioned independently and
depends on the core only as a peer, so you add exactly the ones you need and
nothing you don't.

## Published

### `lit-ui-router-mobx`

[MobX](https://mobx.js.org) bindings: an observable `RouterStore` that mirrors
the current route, plus reaction-based Lit `ReactiveController`s
(`RouterReactionController`, `ReactionController`) that keep components in sync
with router and store state — no manual `requestUpdate()` plumbing.

```bash
npm install lit-ui-router-mobx
```

- [**Guide**](/guides/mobx) — observable router state and reaction-based
  controllers
- [**API reference**](/api/lit-ui-router-mobx/)

### `ui-router-navigation-location-plugin`

An experimental location plugin that manages URLs with the modern
[Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
and exposes the router in navigation events — clean pushState-style paths
through the platform's newest navigation primitive.

```bash
npm install ui-router-navigation-location-plugin
```

- [**Guide**](/guides/navigation-plugin) — clean URLs via the Navigation API
- [**API reference**](/api/navigation-location-plugin/)

## In development

`ui-router-server` — server-side routing verdicts at the edge — and its
roadmap render-axis companions are taking shape on the same model. The
[Server-Side Routing guide](/guides/server-route-matching) and the
[sample app](/sample-app) cover what ships today; content rendering (build-time
and server-side) is the roadmap next axis.

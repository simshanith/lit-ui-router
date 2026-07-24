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

| Package                                                                 | Version                                                                                                                                                                                                                                                                                                                                                                                                        | What it is                                                                                                                                                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [**lit-ui-router-mobx**](/packages/mobx)                                | [![NPM Version](https://npmx.dev/api/registry/badge/version/lit-ui-router-mobx?label=npmx)](https://npmx.dev/package/lit-ui-router-mobx) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-mobx@*)](https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router-mobx)                                                                         | [MobX](https://mobx.js.org) bindings: an observable `RouterStore` and reaction-based Lit controllers that keep components in sync with router state.                                             |
| [**ui-router-navigation-location-plugin**](/packages/navigation-plugin) | [![NPM Version](https://npmx.dev/api/registry/badge/version/ui-router-navigation-location-plugin?label=npmx)](https://npmx.dev/package/ui-router-navigation-location-plugin) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-navigation-location-plugin@*)](https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-navigation-location-plugin) | An experimental location plugin that manages URLs with the modern [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) and exposes the router in navigation events. |

Each package page has its own install snippet, guide, and API reference.

## In development

`ui-router-server` — server-side routing verdicts at the edge — and its
roadmap render-axis companions are taking shape on the same model. The
[Server-Side Routing guide](/guides/server-route-matching) and the
[sample app](/sample-app) cover what ships today; content rendering (build-time
and server-side) is the roadmap next axis.

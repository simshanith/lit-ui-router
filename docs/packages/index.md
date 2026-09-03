---
title: Companion Packages
description: Optional packages that layer extra integrations on lit-ui-router — MobX bindings, the Navigation API location plugin, server-side routing verdicts, and directive-aware ESLint rules — each independently versioned with its own guide and API reference
---

# Companion Packages

`lit-ui-router` is the core package. **Companion packages** layer optional
integrations on top of it — each is published and versioned independently and
depends on the core only as a peer, so you add exactly the ones you need and
nothing you don't.

## Published

| Package                                                                 | Version                                                                                                                                                                                                                                                                                                                                                                              | What it is                                                                                                                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [**eslint-plugin-lit-ui-router**](/packages/eslint-plugin)              | [![NPM Version](https://img.shields.io/npm/v/eslint-plugin-lit-ui-router)](https://npmx.dev/package/eslint-plugin-lit-ui-router) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=eslint-plugin-lit-ui-router@*)](https://github.com/simshanith/lit-ui-router/releases/?q=eslint-plugin-lit-ui-router)                                     | ESLint rules that understand the router's directives: a vendored `anchor-is-valid` where a `uiSref` element part counts as the href it assigns at runtime.                                       |
| [**lit-ui-router-mobx**](/packages/mobx)                                | [![NPM Version](https://img.shields.io/npm/v/lit-ui-router-mobx)](https://npmx.dev/package/lit-ui-router-mobx) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-mobx@*)](https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router-mobx)                                                                         | [MobX](https://mobx.js.org) bindings: an observable `RouterStore` and reaction-based Lit controllers that keep components in sync with router state.                                             |
| [**ui-router-navigation-location-plugin**](/packages/navigation-plugin) | [![NPM Version](https://img.shields.io/npm/v/ui-router-navigation-location-plugin)](https://npmx.dev/package/ui-router-navigation-location-plugin) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-navigation-location-plugin@*)](https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-navigation-location-plugin) | An experimental location plugin that manages URLs with the modern [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) and exposes the router in navigation events. |
| [**ui-router-server**](/packages/server)                                | [![NPM Version](https://img.shields.io/npm/v/ui-router-server)](https://npmx.dev/package/ui-router-server) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-server@*)](https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-server)                                                                                 | Server-side routing verdicts: honest 404/302/200 HTTP for static SPAs, run at the edge with the client's own route table.                                                                        |

Each package page has its own install snippet, guide, and — where the package
has a runtime API — its own reference.

`eslint-plugin-lit-ui-router` is the odd one out: it ships lint rules rather
than runtime code, so its only peer is `eslint` rather than the router
itself. It is a **release candidate** today
(`1.0.0-rc.0`, on the `rc` dist-tag) — the shape is final, the stable number
waits on the [1.0 bar](https://github.com/simshanith/lit-ui-router/issues/667).

`ui-router-server` is the newest of these and still an early `0.x` line: it
ships, this site's own Worker runs it in production, and its API can still
move in a minor. The [package page](/packages/server), the
[Server-Side Routing guide](/guides/server-route-matching), and the
[sample app](/sample-app) cover what ships today; content rendering
(build-time and server-side) is the roadmap next axis, on the same
companion-package model.

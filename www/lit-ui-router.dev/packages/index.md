---
title: Companion Packages
description: Optional packages that layer extra integrations on lit-ui-router — Effect, MobX and TC39 Signals bindings, the Navigation API location plugin, server-side routing verdicts, static prerendering, framework-agnostic Signals, Effect and MobX mirrors of the router, and directive-aware ESLint rules — each independently versioned with its own guide and API reference
---

# Companion Packages

`lit-ui-router` is the core package. **Companion packages** layer optional
integrations on top of it — each is published and versioned independently and
depends on the core only as a peer, so you add exactly the ones you need and
nothing you don't.

## Published

| Package                                                                 | Version                                                                                                                                                                                                                                                                                                                                                                              | What it is                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [**eslint-plugin-lit-ui-router**](/packages/eslint-plugin)              | [![NPM Version](https://img.shields.io/npm/v/eslint-plugin-lit-ui-router)](https://npmx.dev/package/eslint-plugin-lit-ui-router) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=eslint-plugin-lit-ui-router@*)](https://github.com/simshanith/lit-ui-router/releases/?q=eslint-plugin-lit-ui-router)                                     | ESLint rules that understand the router's directives: six rules covering hrefless anchors, inert `href`s, misplaced directives, and each of the three ways a link goes active without saying so to assistive technology. |
| [**lit-ui-router-effect**](/packages/lit-ui-router-effect)              | [![NPM Version](https://img.shields.io/npm/v/lit-ui-router-effect)](https://npmx.dev/package/lit-ui-router-effect) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-effect@*)](https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router-effect)                                                                 | [Effect](https://effect.website) bindings: a `SubscriptionRef` of the route and ref-following Lit controllers that keep components in sync with router state.                                                            |
| [**lit-ui-router-mobx**](/packages/lit-ui-router-mobx)                  | [![NPM Version](https://img.shields.io/npm/v/lit-ui-router-mobx)](https://npmx.dev/package/lit-ui-router-mobx) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-mobx@*)](https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router-mobx)                                                                         | [MobX](https://mobx.js.org) bindings: an observable `RouterStore` and reaction-based Lit controllers that keep components in sync with router state.                                                                     |
| [**lit-ui-router-signals**](/packages/lit-ui-router-signals)            | [![NPM Version](https://img.shields.io/npm/v/lit-ui-router-signals)](https://npmx.dev/package/lit-ui-router-signals) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-signals@*)](https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router-signals)                                                             | [TC39 Signals](https://github.com/tc39/proposal-signals) bindings: watcher-based Lit controllers over `ui-router-signals` that keep components in sync with router state.                                                |
| [**lit-ui-router-ssr**](/packages/ssr)                                  | [![NPM Version](https://img.shields.io/npm/v/lit-ui-router-ssr)](https://npmx.dev/package/lit-ui-router-ssr) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=lit-ui-router-ssr@*)](https://github.com/simshanith/lit-ui-router/releases/?q=lit-ui-router-ssr)                                                                             | Static prerendering: a `ui-router-server` mount table in, an emitted site out — one html file per shell verdict, a host rules file for the redirects.                                                                    |
| [**ui-router-effect**](/packages/ui-router-effect)                      | [![NPM Version](https://img.shields.io/npm/v/ui-router-effect)](https://npmx.dev/package/ui-router-effect) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-effect@*)](https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-effect)                                                                                 | [Effect](https://effect.website) for UI-Router: a framework-agnostic `SubscriptionRef` of the router's current state, with no Lit dependency.                                                                            |
| [**ui-router-mobx**](/packages/ui-router-mobx)                          | [![NPM Version](https://img.shields.io/npm/v/ui-router-mobx)](https://npmx.dev/package/ui-router-mobx) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-mobx@*)](https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-mobx)                                                                                         | [MobX](https://mobx.js.org) for UI-Router: a framework-agnostic observable store of the router's current state, with no Lit dependency.                                                                                  |
| [**ui-router-navigation-location-plugin**](/packages/navigation-plugin) | [![NPM Version](https://img.shields.io/npm/v/ui-router-navigation-location-plugin)](https://npmx.dev/package/ui-router-navigation-location-plugin) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-navigation-location-plugin@*)](https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-navigation-location-plugin) | A location plugin that manages URLs with the modern [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) and exposes the router in navigation events.                                       |
| [**ui-router-server**](/packages/server)                                | [![NPM Version](https://img.shields.io/npm/v/ui-router-server)](https://npmx.dev/package/ui-router-server) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-server@*)](https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-server)                                                                                 | Server-side routing verdicts: honest 404/302/200 HTTP for static SPAs, run at the edge with the client's own route table.                                                                                                |
| [**ui-router-signals**](/packages/ui-router-signals)                    | [![NPM Version](https://img.shields.io/npm/v/ui-router-signals)](https://npmx.dev/package/ui-router-signals) [![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-signals@*)](https://github.com/simshanith/lit-ui-router/releases/?q=ui-router-signals)                                                                             | [TC39 Signals](https://github.com/tc39/proposal-signals) for UI-Router: a framework-agnostic signal mirror of the router's current state, with no Lit dependency.                                                        |

<figure class="atlas-thumb">
  <a href="https://atlas.lit-ui-router.dev/bricks/" target="_blank" rel="noopener">
    <img class="light-only" src="https://atlas.lit-ui-router.dev/thumbs/bricks.webp" width="600" height="800" loading="lazy" alt="The companion packages as LEGO bricks seated on the core's baseplate, drawn in the round" />
    <img class="dark-only" src="https://atlas.lit-ui-router.dev/thumbs/bricks-dark.webp" width="600" height="800" loading="lazy" alt="" />
  </a>
  <figcaption>
    <a href="https://atlas.lit-ui-router.dev" target="_blank" rel="noopener">The Altitude Atlas</a>
    draws each runtime companion as a brick sized by its authored files and
    seated on what it peers, in a model you can turn and explode.
  </figcaption>
</figure>

Each package page has its own install snippet, guide, and — where the package
has a runtime API — its own reference.

The Effect, MobX and Signals bindings each come as two packages: a
framework-agnostic one for `@uirouter/core`, and a Lit one for
`lit-ui-router`. The [Effect](/packages/effect), [MobX](/packages/mobx) and
[Signals](/packages/signals) overviews say which to install.

`eslint-plugin-lit-ui-router` is the odd one out: it ships lint rules rather
than runtime code, so its only peer is `eslint` rather than the router
itself. Its `1.0` line is stable, and its
[semver policy](/packages/eslint-plugin#semver-policy) treats any tightening
of `recommended` as a major.

`ui-router-server` is still an early `0.x` line: it
ships, this site's own Worker runs it in production, and its API can still
move in a minor. The [package page](/packages/server), the
[Server-Side Routing guide](/guides/server-route-matching), and the
[sample app](/sample-app) cover what it answers.

`lit-ui-router-ssr` builds on those verdicts: it renders each shell verdict
into a static html file with the router handed to `@lit-labs/ssr`.

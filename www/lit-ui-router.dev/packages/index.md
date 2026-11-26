---
title: Packages
description: Every package in the lit-ui-router family, grouped by role — the renderer, Effect, MobX and Signals bindings, the Navigation API location plugin, server-side routing verdicts and static prerendering, typed state names and params, development tooling with a transition recorder and panel, directive-aware ESLint rules, and OpenTelemetry spans for transitions — with each package's facets, entry points, API reference and releases
type: index
aside: false
---

# Packages

[`lit-ui-router`](/packages/lit-ui-router) renders the router's views as Lit
components. The other packages layer optional integrations on it or on
`@uirouter/core`; each is published and versioned independently and takes the
router as a peer, so you add only the ones you need. All published packages carry
`subject: router`.

The Effect, MobX and Signals bindings each come as two packages: a
framework-agnostic one for `@uirouter/core`, and a Lit one for `lit-ui-router`.
The [Effect](/packages/effect), [MobX](/packages/mobx) and
[Signals](/packages/signals) overviews say which to install.

<!-- package-index -->

<figure class="atlas-thumb">
  <a href="https://atlas.lit-ui-router.dev/bricks/" target="_blank" rel="noopener">
    <img class="light-only" src="https://atlas.lit-ui-router.dev/thumbs/bricks.webp" width="600" height="800" loading="lazy" alt="The companion packages as LEGO bricks, drawn in the round, each seated on the core's baseplate or on the brick it peers, the server on a plate of its own" />
    <img class="dark-only" src="https://atlas.lit-ui-router.dev/thumbs/bricks-dark.webp" width="600" height="800" loading="lazy" alt="The companion packages as LEGO bricks, drawn in the round, each seated on the core's baseplate or on the brick it peers, the server on a plate of its own" />
  </a>
  <figcaption>
    <a href="https://atlas.lit-ui-router.dev" target="_blank" rel="noopener">The Altitude Atlas</a>
    draws each runtime companion as a brick sized by its authored files and
    seated on what it peers, in a model you can turn and explode.
  </figcaption>
</figure>

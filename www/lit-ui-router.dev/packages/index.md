---
title: Packages
description: Every package in the lit-ui-router family, grouped by role — the renderer, Effect, MobX and Signals bindings, the Navigation API location plugin, server-side routing verdicts and static prerendering, typed state names and params, and directive-aware ESLint rules — with each package's facets, entry points, API reference and releases
type: index
---

# Packages

[`lit-ui-router`](/packages/lit-ui-router) renders the router's views as Lit
components. The other packages layer optional integrations on it or on
`@uirouter/core`; each is published and versioned independently and takes the
router as a peer, so you add only the ones you need.

Each entry lists its facets:

- **subject:** `router` for the router family; `lit` for Lit tooling with no
  router dependency.
- **layer:** `agnostic` when the package peers on `@uirouter/core` and its
  runtime only, `lit` when it also peers on `lit` or `lit-ui-router`.
  `eslint-plugin-lit-ui-router` peers only on `eslint` and is `lit` by what it
  lints.
- **runtime:** where its code runs: `browser`, `server`, `build`,
  `type-check`, `editor` or `ci`.
- **entry points:** the import specifiers its `package.json` `exports` map
  offers.

The Effect, MobX and Signals bindings each come as two packages: a
framework-agnostic one for `@uirouter/core`, and a Lit one for
`lit-ui-router`. The [Effect](/packages/effect), [MobX](/packages/mobx) and
[Signals](/packages/signals) overviews say which to install.

<!-- package-index -->

<figure class="atlas-thumb">
  <a href="https://atlas.lit-ui-router.dev/bricks/" target="_blank" rel="noopener">
    <img class="light-only" src="https://atlas.lit-ui-router.dev/thumbs/bricks.webp" width="600" height="800" loading="lazy" alt="The companion packages as LEGO bricks seated on the core's baseplate, drawn in the round" />
    <img class="dark-only" src="https://atlas.lit-ui-router.dev/thumbs/bricks-dark.webp" width="600" height="800" loading="lazy" alt="The companion packages as LEGO bricks seated on the core's baseplate, drawn in the round" />
  </a>
  <figcaption>
    <a href="https://atlas.lit-ui-router.dev" target="_blank" rel="noopener">The Altitude Atlas</a>
    draws each runtime companion as a brick sized by its authored files and
    seated on what it peers, in a model you can turn and explode.
  </figcaption>
</figure>

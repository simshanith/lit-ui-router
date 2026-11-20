---
title: Examples
description: Every lit-ui-router example app, with its language, location plugin, bindings, render mode, registry and lint facets, and links to run it, open it in StackBlitz and read its source
type: index
---

# Examples

Every example app in the repository. Run it opens the built app this site serves; Open in
StackBlitz boots an editable workspace installed from the published npm
packages. The tutorial walks through three of them in order, starting with
[Hello World](/tutorial/helloworld). Embedded in names the pages that run an
example inline; [Live examples](/examples/live) runs the ones no other page
embeds.

Each entry lists its facets, read from the example's own files:

- **kind:** `tutorial` for a tutorial rung or a variant of one, `example` for
  an app that shows one feature.
- **lang:** `ts` or `js`.
- **location:** the location plugin it hands the router: `navigation`,
  `pushState` or `hash`. A hash URL keeps navigation inside an embed's frame.
- **bindings:** the reactivity bindings it uses: `none`, `mobx`, `signals` or
  `effect`.
- **render:** `client` when the browser renders every page, `prerender` when
  a build writes them with `lit-ui-router-ssr`.
- **registry:** `on` when it types its state names with `ui-router-registry`.
- **lint:** `on` when the example's own project runs
  `eslint-plugin-lit-ui-router`, so a copy keeps the rules. The repository's
  lint runs the same rules over every example either way.

<!-- example-index -->

## Sample apps

The [sample app](/sample-app) is a full webmail and contacts client, built from
this repository and mounted live on this site. It runs once per reactivity
binding, so the variants compare the same routes with Vanilla, MobX, Effect and
Signals client state. [The sample app overview](/sample-app) lists each mount,
what it demonstrates and its source.

## Elsewhere

This site is a consumer too: its worker answers each request with
`ui-router-server`, and renders the release pages
with `lit-ui-router-ssr`. [How this site runs](/site/) describes it, and the
[server-side overview](/guides/server) lists it beside the other hosts.

The [Altitude Atlas](https://atlas.lit-ui-router.dev) draws the packages and
their sources as interactive models; it is built from this repository too.

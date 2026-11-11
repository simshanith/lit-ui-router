---
title: Examples
description: Every lit-ui-router example app and live sample-app mount, with its language, location plugin, bindings, render mode, registry and lint facets, and links to run it, open it in StackBlitz and read its source
type: index
---

# Examples

Every example app in the repository, and every live mount of the
[sample app](/sample-app). Run it opens the built app this site serves; Open in
StackBlitz boots an editable workspace installed from the published npm
packages. The tutorial walks through three of them in order, starting with
[Hello World](/tutorial/helloworld).

Each entry lists its facets, read from the example's own files:

- **kind:** `tutorial` for a tutorial rung or a variant of one, `example` for
  an app that shows one feature, `sample-app` for a live sample-app mount.
- **lang:** `ts` or `js`.
- **location:** the location plugin it hands the router: `navigation`,
  `pushState` or `hash`. A hash URL keeps navigation inside an embed's frame.
  The sample apps choose theirs at boot, so they carry none.
- **bindings:** the reactivity bindings it uses: `none`, `mobx`, `signals` or
  `effect`.
- **render:** `client` when the browser renders every page, `prerender` when
  a build writes them with `lit-ui-router-ssr`.
- **registry:** `on` when it types its state names with `ui-router-registry`.
- **lint:** `on` when it runs `eslint-plugin-lit-ui-router`.

<!-- example-index -->

## Elsewhere

This site is a consumer too: its worker answers each request with
`ui-router-server`, and renders the release pages
with `lit-ui-router-ssr`. [How this site runs](/site/) describes it, and the
[server-side overview](/guides/server) lists it beside the other hosts.

The [Altitude Atlas](https://atlas.lit-ui-router.dev) draws the packages and
their sources as interactive models; it is built from this repository too.

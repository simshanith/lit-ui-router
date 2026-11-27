---
title: Examples
description: Every lit-ui-router example app, with its language, location plugin, bindings, render mode, registry and lint facets, and links to run it, open it in StackBlitz and read its source
type: index
aside: false
---

# Examples

Every example app in the repository. Run it opens the built app this site serves;
StackBlitz boots an editable workspace installed from npm. The tutorial walks
through three of them in order, starting with [Hello World](/tutorial/helloworld).
Each entry links the pages that embed it inline, or
[Live examples](/examples/live) when no other page does.

Every facet is read directly from the example's own files.

<llm-exclude>

Filter by adding facet rows from the dropdown, or click any facet pill on an
entry to narrow the list.

</llm-exclude>

<!-- example-index -->

## Sample apps

The [sample app](/sample-app) is a full webmail and contacts client, built from
this repository and mounted live on this site: one mount per reactivity binding
(Vanilla, MobX, Effect and Signals), plus a hash-location build. That page lists
each mount, what it demonstrates and its source.

## Elsewhere

This site is a consumer too: its worker answers each request with
`ui-router-server`, and renders the release pages
with `lit-ui-router-ssr`. [How this site runs](/site/) describes it, and the
[server-side overview](/guides/server) lists it beside the other hosts.

The [Altitude Atlas](https://atlas.lit-ui-router.dev) draws the packages and
their sources as interactive models; it is built from this repository too.

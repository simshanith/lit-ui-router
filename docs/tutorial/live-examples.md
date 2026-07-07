---
title: Live Examples
description: The tutorial example apps, running live inside the docs site
---

# Live Examples

All three tutorial examples run right here — built from
[`examples/`](https://github.com/simshanith/lit-ui-router/tree/main/examples)
and served by this site, no StackBlitz boot required. Each frame below is the
real app, installed from the published npm packages.

The examples route with `hashLocationPlugin`, so navigation stays inside each
frame. Open one in its own tab to watch the URL change as you click around, or
head to its tutorial for the full walkthrough with an editable StackBlitz
workspace.

## Hello World

Two sibling states, one `<ui-view>`, and `uiSref` navigation — the smallest
possible router. Walkthrough: [Hello World tutorial](./helloworld).

<ExampleEmbed src="/examples/helloworld/" title="helloworld example" height="150px" />

## Hello Solar System

A master-detail list of the real solar system: URL parameters, async resolves,
and transition-driven data loading. Walkthrough:
[Hello Solar System tutorial](./hellosolarsystem).

<ExampleEmbed src="/examples/hellosolarsystem/" title="hellosolarsystem example" height="800px" />

## Hello Galaxy

Nested states and views: a star catalog in a three-level state tree, resolve
inheritance, and a lazily loaded 3D astronaut (the `model-viewer` chunk only
downloads when you visit the astronaut state — watch the network tab).
Walkthrough: [Hello Galaxy tutorial](./hellogalaxy).

<ExampleEmbed src="/examples/hellogalaxy/" title="hellogalaxy example" height="720px" />

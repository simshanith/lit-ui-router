---
title: All Examples
description: Every tutorial example app in one place, running live
---

# All Examples

Every tutorial example in one place. The Preview tab runs the built app served
by this site; the Edit in StackBlitz tab boots an editable workspace installed
from the published npm packages. Each example routes with
`hashLocationPlugin`, so navigation stays inside the frame — open one in its
own tab to watch the URL change.

## Hello World

Two sibling states, one `<ui-view>`, and `uiSref` navigation — the smallest
possible router. Walkthrough: [Hello World tutorial](./helloworld).

<LiveExample name="helloworld" />

## Hello Solar System

A master-detail list of the real solar system: URL parameters, async resolves,
and transition-driven data loading. Walkthrough:
[Hello Solar System tutorial](./hellosolarsystem).

<LiveExample name="hellosolarsystem" />

## Hello Solar System (MobX)

The same states, URLs and resolves as above, rebuilt on the
[MobX bindings](/packages/mobx): reaction controllers for route params and
app state, resolves still on view props. Compare the two `src/main.ts` files
side by side.

<LiveExample name="hellosolarsystem-mobx" />

## Hello Galaxy

Nested states and views: a star catalog in a three-level state tree, resolve
inheritance, and a lazily loaded 3D astronaut. Walkthrough:
[Hello Galaxy tutorial](./hellogalaxy).

<LiveExample name="hellogalaxy" />

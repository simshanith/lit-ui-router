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
[MobX bindings](/packages/lit-ui-router-mobx): resolves still arrive on view props, while an
observable router store, a `computed` tour and a pair of reaction controllers
cover everything that outlives one activation. It is the minimal layering; the
sample apps are where the two idioms are compared at application scale.

<LiveExample name="hellosolarsystem-mobx" />

## Hello Solar System (Signals)

The same states and resolves, on the [Signals bindings](/packages/signals),
with `planetId` declared as an `int` param. The header follows the route through a
`RouterSignalController` for previous/next links (or the arrow keys). The
header provides a distance-unit signal through `@lit/context`, and the routed
views consume it: context hands over the signal once, and the signal carries
every change. The arrow keys reach the router through `routerContext`. The detail
view's light-travel clock ticks only while something watches it, and the tab
title tracks the route with no component at all.

<LiveExample name="hellosolarsystem-signals" />

## Hello Galaxy

Nested states and views: a star catalog in a three-level state tree, resolve
inheritance, and a lazily loaded 3D astronaut. Walkthrough:
[Hello Galaxy tutorial](./hellogalaxy).

<LiveExample name="hellogalaxy" />

## Hello Galaxy (Effect)

The same states, URLs and views as above, rebuilt on
[Effect](https://effect.website) and the [Effect bindings](/packages/lit-ui-router-effect):
resolves still arrive on view props, `RouterRefController` keeps the un-routed
shell's marker lit from the route ref, and an inlined plugin spike turns
resolves, hooks and state lifetimes into effects, fibers and scopes. The fiber
log at the foot shows them run.

<LiveExample name="hellogalaxy-effect" />

## Hello Galaxy (Signals)

The same states, URLs and resolves, with a star chart that nested views share.
`@lit-labs/signals` and the [Signals bindings](/packages/signals) read one
signal graph. The star list follows the chart through a `SignalController`.
The `SignalWatcher` shell binds a summary with `watch()`, so charting updates
that text alone. A `RouterSignalController` builds the shell's breadcrumb from
the route and the star its state resolved.

<LiveExample name="hellogalaxy-signals" />

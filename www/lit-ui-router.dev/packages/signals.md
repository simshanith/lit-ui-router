---
title: Signals
description: The TC39 Signals packages for UI-Router — ui-router-signals mirrors the router's state into signals, and lit-ui-router-signals builds Lit controllers on that mirror
---

# Signals

Two packages bring [TC39 Signals](https://github.com/tc39/proposal-signals)
to UI-Router, one layered on the other:

| Package                                                      | Builds on                            | What it is                                                                        |
| ------------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------- |
| [**ui-router-signals**](/packages/ui-router-signals)         | `@uirouter/core`, `signal-polyfill`  | `RouterSignals`, a signal mirror of the router's current state, with no Lit       |
| [**lit-ui-router-signals**](/packages/lit-ui-router-signals) | `ui-router-signals`, `lit-ui-router` | Lit controllers that watch that mirror and update their host when a value changes |

`ui-router-signals` is enough for code outside Lit, and for a
`@lit-labs/signals` `SignalWatcher` that reads `RouterSignals` fields in
`render()`. `lit-ui-router-signals` adds controllers that select a value,
compare it under `equals`, and find the router from the enclosing
`<ui-router>`.

## One signal graph

Every signal reader and writer in a bundle has to share one copy of
`signal-polyfill`: `ui-router-signals`, `@lit-labs/signals`, and the
application's own `Signal.State`s. Two copies keep two separate graphs, and a
watcher on one never sees a write to the other. `npm ls signal-polyfill`
should list a single version.

## In use

- [Hello Solar System (Signals)](/tutorial/live-examples#hello-solar-system-signals)
  follows the route from an un-routed header with a `RouterSignalController`,
  shares a `Signal.State` between routed and un-routed views, and sets the
  tab title with a bare `watchSelection`.
- [Hello Galaxy (Signals)](/tutorial/live-examples#hello-galaxy-signals) puts
  `@lit-labs/signals` and `lit-ui-router-signals` on one graph: a star chart
  that nested views share, and a breadcrumb built from `RouterSignals`.
- The <a href="/app-signals" target="_self">Signals sample app</a> keeps its
  client state in `Signal.State`s and renders it with `@lit-labs/signals`,
  beside `RouterSignalController` for the route.
- Both stand on [the Altitude Atlas](https://atlas.lit-ui-router.dev/bricks/?focus=lit-ui-router-signals) as
  bricks in sheet 2's model in the round, each sized by its authored files and
  seated on what it peers.

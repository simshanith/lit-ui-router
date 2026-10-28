---
title: Effect
description: The Effect packages for UI-Router — ui-router-effect holds the router's state in a SubscriptionRef, and lit-ui-router-effect provides ref-following Lit controllers
---

# Effect

Two packages bring [Effect](https://effect.website) to UI-Router:

| Package                                                    | Builds on                           | What it is                                                                  |
| ---------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| [**ui-router-effect**](/packages/ui-router-effect)         | `@uirouter/core`, `effect`          | `routeRef`, a `SubscriptionRef` of the router's current state, with no Lit  |
| [**lit-ui-router-effect**](/packages/lit-ui-router-effect) | `ui-router-effect`, `lit-ui-router` | Lit controllers that follow the route's ref and any other `SubscriptionRef` |

`ui-router-effect` is for Effect programs that follow the route without Lit;
`lit-ui-router-effect` is for Lit components. Each package page has its own
install snippet.

Both support Effect 3 and 4; [Effect 3 and 4](/packages/lit-ui-router-effect#effect-3-and-4)
covers the one difference the bindings' callers see.

## In use

- [Hello Galaxy (Effect)](/tutorial/live-examples#hello-galaxy-effect) runs
  the galaxy tutorial on `lit-ui-router-effect`.
- The <a href="/app-effect" target="_self">Effect sample app</a> keeps its
  client state in `SubscriptionRef`s through the same bindings.
- Both stand on [the Altitude Atlas](https://atlas.lit-ui-router.dev/bricks/?focus=lit-ui-router-effect) as
  bricks in sheet 2's model in the round, each sized by its authored files and
  seated on what it peers.

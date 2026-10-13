---
title: Effect
description: The Effect packages for UI-Router — ui-router-effect holds the router's state in a SubscriptionRef, and lit-ui-router-effect adds ref-following Lit controllers
---

# Effect

Two packages bring [Effect](https://effect.website) to UI-Router:

| Package                                            | Builds on                  | What it is                                                                               |
| -------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| [**ui-router-effect**](/packages/ui-router-effect) | `@uirouter/core`, `effect` | `routeRef`, a `SubscriptionRef` of the router's current state, with no Lit               |
| [**lit-ui-router-effect**](/packages/effect)       | `lit-ui-router`, `effect`  | the same `routeRef`, plus Lit controllers that follow it and any other `SubscriptionRef` |

`lit-ui-router-effect` exports `routeRef` and `RouteSnapshot` itself, so a Lit
application installs that one package. `ui-router-effect` is for Effect
programs that follow the route without Lit.

Both support Effect 3 and 4; [Effect 3 and 4](/packages/effect#effect-3-and-4)
covers the one difference the bindings' callers see.

## In use

- [Hello Galaxy (Effect)](/tutorial/live-examples#hello-galaxy-effect) runs
  the galaxy tutorial on `lit-ui-router-effect`.
- The <a href="/app-effect" target="_self">Effect sample app</a> keeps its
  client state in `SubscriptionRef`s through the same bindings.

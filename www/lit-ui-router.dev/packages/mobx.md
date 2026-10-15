---
title: MobX
description: The MobX packages for UI-Router — ui-router-mobx holds the router's state in an observable store, and lit-ui-router-mobx provides reaction-based Lit controllers
---

# MobX

Two packages bring [MobX](https://mobx.js.org) to UI-Router:

| Package                                                | Builds on                         | What it is                                                                    |
| ------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------- |
| [**ui-router-mobx**](/packages/ui-router-mobx)         | `@uirouter/core`, `mobx`          | `RouterStore`, an observable store of the router's current state, with no Lit |
| [**lit-ui-router-mobx**](/packages/lit-ui-router-mobx) | `ui-router-mobx`, `lit-ui-router` | Lit controllers that follow the router's store and any other MobX state       |

`ui-router-mobx` is for MobX reactions that follow the route without Lit;
`lit-ui-router-mobx` is for Lit components. Each package page has its own
install snippet.

Both support MobX 6 and 7; [MobX 6 and 7](/packages/lit-ui-router-mobx#mobx-6-and-7)
covers the one difference the bindings' callers see.

## In use

- [Hello Solar System (MobX)](/tutorial/live-examples#hello-solar-system-mobx)
  runs the solar system tutorial on `lit-ui-router-mobx`.
- The <a href="/app-mobx" target="_self">MobX sample app</a> keeps its client
  state in MobX stores through the same bindings.

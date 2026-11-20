---
title: Sample App
description: Overview and live mounts of the lit-ui-router sample app — a webmail and contacts client built in Vanilla, MobX, Effect, and Signals variants
type: index
---

# Sample App

The sample app is a **webmail + contacts client** that puts lit-ui-router's
guides together in one running application: nested and named views, protected
routes with a login flow, lazy-loaded feature modules, sticky states, unsaved-changes
guards, 404 handling, and a live feature-flags panel for switching location
plugins.

Authentication is mocked locally — pick any user and enter `password` to sign
in.

## What it demonstrates

| Feature                                                                 | Source file                                                                                                                                                                                                                                                                                                                                                                              | Guide                                                                                                                        |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Route guards & login redirect                                           | [`requiresAuth.hook.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/global/requiresAuth.hook.ts), [`Login.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/main/Login.ts)                                                                                                                             | [Route Guards](./guides/route-guards)                                                                                        |
| Lazy-loaded `.**` future states                                         | [`main/states.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/main/states.ts)                                                                                                                                                                                                                                                                  | [Routed Components](./guides/routed-components#lazy-load-a-whole-feature-with-a-future-state)                                |
| Named views (`mymessages`, `contacts`, `messagelist`, `messagecontent`) | [`App.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-lit-vanilla/src/app/main/App.ts), [`MyMessages.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/mymessages/MyMessages.ts), [`mymessages/states.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/mymessages/states.ts) | [Named Views](./guides/named-views)                                                                                          |
| Unsaved-changes guard (`uiCanExit`)                                     | [`contacts/EditContact.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/contacts/EditContact.ts)                                                                                                                                                                                                                                                | [Component Lifecycle Hooks](./guides/component-lifecycle#uicanexit-confirm-or-block-navigation)                              |
| Sticky states & deep state redirect                                     | [`contacts/states.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/contacts/states.ts), [`mymessages/states.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/mymessages/states.ts)                                                                                                                     | [`@uirouter/sticky-states`](https://github.com/ui-router/sticky-states), [`@uirouter/dsr`](https://github.com/ui-router/dsr) |
| Location plugins & runtime switching                                    | [`prefs/FeatureFlagsPanel.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/prefs/FeatureFlagsPanel.ts)                                                                                                                                                                                                                                          | [Location Plugins](./guides/location-plugins)                                                                                |
| Unmatched URLs & server verdicts                                        | [`main/NotFound.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/main/NotFound.ts), [`routes.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-routes/src/routes.ts)                                                                                                                                                   | [Unmatched URLs (404)](./guides/unmatched-urls), [Server-Side Routing](./guides/server-route-matching)                       |
| Typed state names                                                       | [`registry/states.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/registry/states.ts), [`contacts/states.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-shared/src/app/contacts/states.ts)                                                                                                                             | [`ui-router-registry`](/packages/ui-router-registry)                                                                         |

### Devtools and visualizer

The sample app includes an in-repo devtools panel showing the state tree and
each transition. Append `?feature-enable-visualizer=true` to any mount's URL to
also load [`@uirouter/visualizer`](https://github.com/ui-router/visualizer) (add
`&feature-enable-devtools=false` to run the visualizer on its own).

## Live mounts

The same routing table is deployed in four client-state variants (all behind the
same route-aware edge worker) plus a hash-location build:

| Mount                                                    | Spectrum level | Client state & routing                                                                                                                                                                 |
| -------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a href="/app" target="_self">`/app`</a>                 | 3+4            | **Vanilla** (`TransitionController`) — flagship route-aware server (shell for real routes, computed 302s, real 404s).                                                                  |
| <a href="/app-mobx" target="_self">`/app-mobx`</a>       | 3+4            | **[MobX](./packages/lit-ui-router-mobx)** — identical routes and server verdicts, with client state in MobX stores.                                                                    |
| <a href="/app-effect" target="_self">`/app-effect`</a>   | 3+4            | **[Effect](./packages/lit-ui-router-effect)** — identical routes and server verdicts, with client state in `SubscriptionRef`s.                                                         |
| <a href="/app-signals" target="_self">`/app-signals`</a> | 3+4            | **[Signals](./packages/signals)** — identical routes and server verdicts, with client state in TC39 Signals via `@lit-labs/signals`.                                                   |
| <a href="/app-hash" target="_self">`/app-hash`</a>       | 1              | **[Hash location](./guides/location-plugins#hash-urls)** — the route lives in the fragment, so the server serves the shell at **200** at the mount root and needs no routing verdicts. |

### Server-semantics exhibits

Three additional `noindex` mounts deploy the same app behind different server
configurations so you can compare each point on the
[server-support spectrum](./guides/server-route-matching#the-server-support-spectrum)
side by side:

| Mount                                                                | Spectrum level | What it shows                                                                                                                                                                     |
| -------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a href="/not-found-naive" target="_self">`/not-found-naive`</a>     | 2              | The **anti-pattern baseline**: every path answers **200** with the shell, no matching at all — the soft-404 fallback most SPAs ship. `noindex`.                                   |
| <a href="/not-found-spa" target="_self">`/not-found-spa`</a>         | 4              | **Shell-at-404**: real routes serve the shell at **200**; only a genuine miss serves the app shell at an honest **404**, where the client renders its in-app 404 view. `noindex`. |
| <a href="/simulated-routing" target="_self">`/simulated-routing`</a> | 5              | Every verdict computed by a **real headless `@uirouter/core` router** replaying the URL per request — redirects and `otherwise()` run as real rules. `noindex`.                   |

## Two axes, one app

Across the routing axis — `/app`, `/app-hash`, and the three exhibits above —
the mounts differ only in the HTTP **verdict** a URL earns (the four `/app*`
variants share the same route table and verdicts, varying only client-state
bindings). The [Server-Side Routing guide](./guides/server-route-matching) is
the deep dive on that routing axis.

How the page body is rendered is a separate choice: it does not change which
status or redirect a URL gets. Today the sample app mounts are
**client-rendered** throughout; build-time prerendering
([Prerender with Vite](./guides/prerender-with-vite),
[Prerender with Eleventy](./guides/prerender-with-eleventy)) and request-time
server rendering
([Rendering one page per request](/packages/lit-ui-router-ssr#rendering-one-page-per-request))
live in [`lit-ui-router-ssr`](/packages/lit-ui-router-ssr).

## Source

The repository's lint runs the
[`eslint-plugin-lit-ui-router`](/packages/eslint-plugin-lit-ui-router) rules
over every app. Compare the four client-state entry points side by side against
the shared routing and UI layers:

- **Vanilla app** —
  [`apps/sample-app-lit-vanilla`](https://github.com/simshanith/lit-ui-router/tree/main/apps/sample-app-lit-vanilla)
- **MobX app** —
  [`apps/sample-app-lit-mobx`](https://github.com/simshanith/lit-ui-router/tree/main/apps/sample-app-lit-mobx)
- **Effect app** —
  [`apps/sample-app-lit-effect`](https://github.com/simshanith/lit-ui-router/tree/main/apps/sample-app-lit-effect)
- **Signals app** —
  [`apps/sample-app-lit-signals`](https://github.com/simshanith/lit-ui-router/tree/main/apps/sample-app-lit-signals)
- **Shared app implementation** —
  [`apps/sample-app-shared`](https://github.com/simshanith/lit-ui-router/tree/main/apps/sample-app-shared)
- **Shared routing projection** — the route, redirect, and mount tables the edge
  worker imports:
  [`apps/sample-app-routes`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-routes/src/routes.ts)
- **Edge worker** — turns each verdict into HTTP:
  [`www/lit-ui-router.dev/worker/index.ts`](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/worker/index.ts)

---
title: Sample App
description: The lit-ui-router sample app — a webmail + contacts client — and every live mount it runs behind on lit-ui-router.dev, one per point on the server-support spectrum
---

# Sample App

Every guide here is grounded in one running example: a small **webmail +
contacts client** built with lit-ui-router. It is deployed several times over
on lit-ui-router.dev — the same app (or a deliberate anti-pattern of it) behind
different server configurations — so each mount is a live point on the
[server-support spectrum](./guides/server-route-matching#the-server-support-spectrum).

## Live mounts

| Mount                                                                | Level          | What it shows                                                                                                                                                                                                                    |
| -------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a href="/app" target="_self">`/app`</a>                             | 3+4 · flagship | The **route-aware server**: the shell for real routes, computed 302s, and a real **404** for everything else. Vanilla reactivity.                                                                                                |
| <a href="/app-mobx" target="_self">`/app-mobx`</a>                   | 3+4 · flagship | The same app and the same verdicts, with [MobX bindings](./packages/mobx) for state — routing is identical, so this varies the client-state axis, not a routing one.                                                             |
| <a href="/app-hash" target="_self">`/app-hash`</a>                   | 1 · hash       | [Hash location](./guides/location-plugins#hash-urls) done right: the route lives in the fragment, so the server serves the shell at **200** at the mount root and never redirects it. Needs no routing verdicts — and shows why. |
| <a href="/not-found-naive" target="_self">`/not-found-naive`</a>     | 2 · exhibit    | The **anti-pattern baseline**: every path answers **200** with the shell, no matching at all — the soft-404 fallback most SPAs ship. `noindex`.                                                                                  |
| <a href="/not-found-spa" target="_self">`/not-found-spa`</a>         | 4 · exhibit    | **Shell-at-404**: the `otherwise` projection serves the app shell at an honest **404**, and the client renders its in-app 404 view at the retained URL. `noindex`.                                                               |
| <a href="/simulated-routing" target="_self">`/simulated-routing`</a> | 5 · exhibit    | Every verdict computed by a **real headless `@uirouter/core` router** replaying the URL per request — redirects and `otherwise()` run as real rules. `noindex`.                                                                  |

The three `noindex` **exhibits** exist to teach server semantics side by side;
they alias the vanilla shell and stay out of the search index. `/app`,
`/app-mobx`, and `/app-hash` are the real, indexable app.

## Two axes, one app

Every mount above differs only in its **routing** — the HTTP verdict a URL
earns. That is the axis this app ships today, end to end; the
[Server-Side Routing guide](./guides/server-route-matching) is the deep dive.

A second axis — **how the page body is rendered** — is orthogonal: it would
ride the same routing spine and return the identical verdict at every setting.
Today the sample app is **client-rendered** throughout; build-time
pre-rendering and request-time server-rendering are on the roadmap. The sample
app is the vehicle that axis will grow on.

## Source

- **Routing projection** — the shared route / redirect / mount tables the edge
  imports:
  [`apps/sample-app-routes`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-routes/src/routes.ts)
- **App implementation** — shared across the vanilla, MobX, and hash builds:
  [`apps/sample-app-shared`](https://github.com/simshanith/lit-ui-router/tree/main/apps/sample-app-shared)
- **Edge worker** — turns each verdict into HTTP:
  [`docs/worker/index.ts`](https://github.com/simshanith/lit-ui-router/blob/main/docs/worker/index.ts)

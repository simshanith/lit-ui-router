---
title: Server-Side Overview
description: Where to start with server-side routing - what the router decides for a request, whether the server renders the page, and which host serves it
type: index
---

# Server-Side Overview

Three choices place an app on the server: the **verdict** the router gives a
request, how much of the page the server **renders**, and the **host** that
serves it. [`ui-router-server`](/packages/ui-router-server) owns the verdict
and the hosts; [`lit-ui-router-ssr`](/packages/lit-ui-router-ssr) owns the
render. Pick one of each, then follow the row in
[Find your combination](#find-your-combination).

## Verdict

What the router decides for a request from its url alone, before any of the
app's code runs. [The verdict](/packages/ui-router-server#the-verdict) lists
the shapes; [which decides when](/packages/lit-ui-router-ssr#page-response-state-or-redirect-which-decides-when)
covers the answers a transition changes later.

| Answer         | Declared as                                      | Read                                                                                                    |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Page           | a state with a url                               | [Server-Side Routing](./server-route-matching#the-verdict)                                              |
| Redirect       | a pattern rule in `redirects`, or a `redirectTo` | [Redirects: data until they need code](./server-route-matching#redirects-data-until-they-need-code)     |
| 404            | no matching state, or the mount's `otherwise`    | [Real 404s, per mount](./server-route-matching#real-404s-per-mount), [Unmatched URLs](./unmatched-urls) |
| Response state | `response: true` and a host handler              | [Response states](/packages/ui-router-server#response-states)                                           |
| Delegate       | `delegate` and a host handler                    | [Delegating states](/packages/ui-router-server#delegating-states)                                       |

## Render

What the server sends for a page verdict.

- **None.** The server answers with the app's shell and the client renders the
  page. The verdict still sets the status, so a typo gets a real 404:
  [Server-Side Routing](./server-route-matching).
- **Static prerender.** The build writes one HTML page per route, a 404 page
  and the host's redirect rules, and the client adopts the served page:
  [Prerender with Vite](./prerender-with-vite),
  [Prerender with Eleventy](./prerender-with-eleventy).
- **Server render with hydration.** A host renders each request's page with
  [`renderToString`](/packages/lit-ui-router-ssr#rendering-one-page-per-request),
  and the client wakes it under
  [the hydration model](/packages/lit-ui-router-ssr#the-hydration-model).

## Host

The runtime or framework that serves the request. Each host is an entry point
of `ui-router-server`.

| Host                                   | Entry point                                                            | Read                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Fetch runtimes: Workers, Deno, Bun     | [`ui-router-server/fetch`](/reference/ui-router-server/fetch/)         | [fetch](/packages/ui-router-server#fetch-—-the-edge)                        |
| Hono                                   | [`ui-router-server/hono`](/reference/ui-router-server/hono/)           | [hono](/packages/ui-router-server#hono)                                     |
| Connect and Express                    | [`ui-router-server/connect`](/reference/ui-router-server/connect/)     | [connect](/packages/ui-router-server#connect-—-node-servers)                |
| `vite dev` and `vite preview`          | [`ui-router-server/vite`](/reference/ui-router-server/vite/)           | [vite](/packages/ui-router-server#vite-—-dev-prod-parity)                   |
| A static host, from the build's output | [`ui-router-server/prerender`](/reference/ui-router-server/prerender/) | [Emitting a static site](/packages/ui-router-server#emitting-a-static-site) |

## Find your combination

| Render           | Host                       | Start with                                                                                   | Working code                                                                                                                                                                                       |
| ---------------- | -------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| None             | Workers                    | [Server-Side Routing](./server-route-matching)                                               | This site's [docs worker](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/worker/index.ts), serving the [sample app mounts](./server-route-matching#live-on-this-site) |
| None             | `vite dev`, `vite preview` | [vite](/packages/ui-router-server#vite-—-dev-prod-parity)                                    | This site's [`vite.config.ts`](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/.vitepress/vite.config.ts)                                                              |
| None             | Hono, Connect              | [Adapters](/packages/ui-router-server#adapters)                                              |                                                                                                                                                                                                    |
| Static prerender | Vite build                 | [Prerender with Vite](./prerender-with-vite)                                                 | [`hellosolarsystem-ssr`](https://github.com/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem-ssr); [The Altitude Atlas](https://atlas.lit-ui-router.dev), prerendered and hydrated     |
| Static prerender | Eleventy                   | [Prerender with Eleventy](./prerender-with-eleventy)                                         | [`hellosolarsystem-eleventy`](https://github.com/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem-eleventy)                                                                            |
| Server render    | Workers                    | [Rendering one page per request](/packages/lit-ui-router-ssr#rendering-one-page-per-request) | This site's [release pages](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/worker/releases/serve.ts), rendered per request without hydration                          |

This site is the working code for the Workers rows; [How this site runs](/site/)
describes its worker, the release ledger and the release pages.

The API references for both packages are at
[`/reference/ui-router-server/`](/reference/ui-router-server/) and
[`/reference/lit-ui-router-ssr/`](/reference/lit-ui-router-ssr/).

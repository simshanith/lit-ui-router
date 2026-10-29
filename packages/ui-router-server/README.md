# ui-router-server

[![npm version](https://img.shields.io/npm/v/ui-router-server.svg)](https://npmx.dev/package/ui-router-server)
[![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-server@*)](https://lit-ui-router.dev/gh/releases/ui-router-server/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Flit-ui-router.dev)](https://lit-ui-router.dev/packages/server)
[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/graph/badge.svg?component=ui-router-server)](https://app.codecov.io/gh/simshanith/lit-ui-router?components%5B0%5D=ui-router-server)

Server-side routing for ui-router state trees. Given per-mount routing config and a request URL, it resolves the path against the registered states and returns a plain routing verdict (render, redirect, or miss) — runtime-agnostic, with no fetch/Response or workers types in the core. Adapters turn verdicts into HTTP for Connect/Vite middleware and fetch/Hono handlers. Matcher-only mounts are dependency-free; `simulate` mounts lazily replay the path through a headless `@uirouter/core` router (an optional peer dependency).

The matcher composes each state's url along its parent as `@uirouter/core` does: a state's parent is its `parent:`, otherwise its name minus the last dotted segment.

**Status: early `0.x`** — published to npm and dogfooded in production by
[lit-ui-router.dev](https://lit-ui-router.dev), but young: the API is covered
by tests and can still move in a minor release before `1.0`, so pin what you
install.

```bash
npm install ui-router-server
```

`@uirouter/core` (only for `simulate` mounts and the `/location`, `/ssr` and
`/ssr/client` entries) and `hono` are optional peer
dependencies. Full docs:
[lit-ui-router.dev/packages/server](https://lit-ui-router.dev/packages/server).

## Delegating states

A state can name a host handler by key, `{ name: 'claims', url: '/claims', delegate: 'ledger' }`,
and the fetch and Hono adapters map keys to fetch-shaped handlers, so a Hono app's `fetch` fits
bare: `createFetchHandler(router, { serveShell, delegates: { ledger: ledgerApp.fetch } })`.
A delegate receives exactly the host's handler arguments: `(request, env, ctx)` on Workers,
`(request, c.env, c.executionCtx)` behind `serverRouterHono`, as Hono's `app.fetch` takes them,
and Connect's own `(req, res, next)` downstream. Wrap or bind a handler whose extra parameters are
optional, so a host argument never lands in one. The request keeps its url,
mount base included: route on the `subpath` that `delegateContext(c.req.raw, 'ledger')` returns,
or mount the delegating states at `/`. A request of any method that matches a delegating state
gets the handler's `Response`, untouched; other non-navigations only match urls and never run a
transition. A mount without pages (every state with a url delegates, and no `otherwise`) claims
only its delegating urls, so every other request under it passes through, navigations included,
and a router made only of such mounts needs no `serveShell`. Construction throws for a key the
tree names and `delegates` lacks, or for a missing `serveShell` the router needs, and `as const`
routes make both compile errors, whether the host's arguments are inferred, written out
(`createFetchHandler<typeof router, [Env]>`) or annotated on the result. The Connect adapter throws for delegate keys unless you pass
`delegates: 'next'` and serve those states downstream. `prerender()` from
`ui-router-server/prerender` writes no page and no rules line for a delegating state: it counts
the path in `result.tally.delegate` and lists it in `result.delegated`, so route those paths to
your server; on Cloudflare, list them in the Worker's `assets.run_worker_first` so the asset layer
doesn't answer them first. See
[delegating states](https://lit-ui-router.dev/packages/server#delegating-states).

## Attribution

URL-matching logic (`src/url-matcher.ts`) is derived from [@uirouter/core](https://github.com/ui-router/core) (MIT) — see [LICENSE](./LICENSE).

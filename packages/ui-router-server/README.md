# ui-router-server

[![npm version](https://img.shields.io/npm/v/ui-router-server.svg)](https://npmx.dev/package/ui-router-server)
[![GitHub Release](https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-server@*)](https://lit-ui-router.dev/gh/releases/ui-router-server/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Flit-ui-router.dev)](https://lit-ui-router.dev/packages/ui-router-server)
[![codecov](https://codecov.io/gh/simshanith/lit-ui-router/graph/badge.svg?component=ui-router-server)](https://app.codecov.io/gh/simshanith/lit-ui-router?components%5B0%5D=ui-router-server)

Server-side routing for ui-router state trees. Given per-mount routing config and a request URL, it resolves the path against the registered states and returns a plain routing verdict (render, redirect, or miss) — runtime-agnostic, with no fetch/Response or workers types in the core. Adapters turn verdicts into HTTP for Connect/Vite middleware and fetch/Hono handlers. Matcher-only mounts are dependency-free; `simulate` mounts lazily replay the path through a headless `@uirouter/core` router (an optional peer dependency). The routers `simulate` builds register copies of the mount's declarations, so inside a declaration's own functions (`redirectTo`, resolves, hooks) `transition.to()` and `state.self` are the copy, not the app's object; compare states by `name`, as UI-Router code does.

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
[lit-ui-router.dev/packages/ui-router-server](https://lit-ui-router.dev/packages/ui-router-server).

## When to use it

Use it when a server has to honour a ui-router state tree that already exists for another reason,
usually the client app's own route tables. Reusing that tree is what makes the setup worthwhile.
Each use adds one concept and leaves the ones before it unchanged:

1. **An honest SPA host:**
   [real 404s](https://lit-ui-router.dev/guides/server-route-matching#real-404s-per-mount),
   redirects, and the shell for the client's routes, with `createServerRouter`, an adapter, and a
   `serveShell`.
2. **Server-rendered pages:** the same states' resolves and views, rendered with
   `lit-ui-router-ssr` on `settle` and `prerender`, which `serverRouterPlugin` runs after
   [`vite build`](https://lit-ui-router.dev/guides/prerender-with-vite).
3. **Response states:** a state answers with its own `Response` (a redirect, JSON, a badge) built
   from its resolves once `settle` lands it.
4. **Commands whose url the tree defines:** delegating states hand a url to a host handler.
   Delegate when the tree is the authority for the url: a command that shares params with a page,
   or a path `prerender` must skip.
5. **Outside HTTP:** the verdict core has no HTTP dependency; a pathname goes in and a plain
   object comes out.

It is not for urls no state tree defines. Route those at the host, ahead of the router: a platform
route, an earlier middleware, or in Hono a route registered before the router's catch-all. Paths
outside every mount already pass through (the fetch adapter returns `null`, and the Hono and Connect
middleware call `next()`), so the host keeps its own fallthrough and 404 handling. A path a mount
owns but no state matches is that mount's 404, which `serveNotFound` can answer with the app's own
404 page. A path that begins with `//` below its mount (`//about`, `/docs//about` in a `/docs`
mount) is answered from its collapsed spelling, so no state matches it with an empty leading param:
a `302` to that spelling, the redirect that spelling itself answers, or `notFound` when it matches
no route. A non-navigation request to a response state or a delegate is matched as written. See
[when to use it](https://lit-ui-router.dev/packages/ui-router-server#when-to-use-it).

## Sharing states with the client

Keep one data-only module of names, urls and redirects. The client spreads each entry into a state
and adds its component and resolves; the server compiles its mount from the same module with
`routesFromStates`:

```ts
// states.ts: data only, so vite.config.ts and a Worker can import it.
import type { StateDeclaration } from '@uirouter/core';

export const states = [
  { name: 'planets', url: '/' },
  { name: 'planet', url: '/planets/:planetId' },
  { name: 'legacy', url: '/legacy', redirectTo: 'planets' },
  { name: 'notFound' },
] as const satisfies readonly StateDeclaration[];
```

Keep `as const satisfies`: an array annotated `readonly StateDeclaration[]` loses its literal names
and no longer fits `routesFromStates`.

```ts
// vite.config.ts
import { createServerRouter, routesFromStates } from 'ui-router-server';

import { states } from './src/states.ts';

const router = createServerRouter({
  mounts: {
    '/': { routes: routesFromStates(states), otherwise: { state: 'notFound' } },
  },
});
```

Each route keeps only the fields a mount reads, and a function or `TargetState` `redirectTo`, or an
abstract state with a url, throws at the call. See
[sharing states with the client](https://lit-ui-router.dev/packages/ui-router-server#sharing-states-with-the-client).

## After `vite build`

`serverRouterPlugin` prerenders the built app after `vite build`, through a prerender script whose
default export calls `prerender()` with a renderer of its own. The script runs in a worker thread,
one per build, after the modules listed in `preload`, so whatever they install never reaches Vite's
process:

```ts
serverRouterPlugin(router, {
  prerender: { entry: './src/prerender.ts', preload: ['./src/dom-shim.ts'] },
});
```

[Prerender with Vite](https://lit-ui-router.dev/guides/prerender-with-vite) walks through the
plugin option and the script.

## Hosts without redirect rules

`prerender()` hands redirects to the host as rules lines, and `rules` decides what happens to them:
`'_redirects'` (the default) writes the file Cloudflare Pages and Netlify read, `'none'` leaves
them in `result.rules`, and a function receives them with the run's `write`, `outDir` and written
`pages`. A host with no redirect rules, such as GitHub Pages or a plain bucket, takes
`redirectPages()` from `ui-router-server/prerender`: each line becomes a page at
`<from>/index.html` holding a `location.replace` that keeps the request's query and fragment when
the target has none, a meta refresh, a plain link, a canonical link to the target, and `noindex`.
The page answers 200, so the line's status never reaches the host; the canonical link tells search
engines the content moved. A line whose page would replace one the run wrote throws, as does a
pattern line; the first line for a page wins, and a line between a path's two spellings, as a
mount's trailing-slash policy adds, writes nothing. `base` is the url path `outDir` is served at, and
`redirectsFile: true` also writes `_redirects`. `page` replaces the template: it receives each
line (`from`, `to`, `status`) and returns the HTML, or a promise of it. `redirectPage` is the
default, exported to wrap or reuse; it escapes `to` with
[`escape-html`](https://www.npmjs.com/package/escape-html). A template gets `to` unescaped, so
HTML-escape it in markup (`escape-html` or the template's own escaper), and escape it as a script
string too if it goes in a script.

```ts
import { redirectPage, redirectPages } from 'ui-router-server/prerender';

const rules = redirectPages({
  page: (line) => redirectPage(line).replace('</head>', `${analytics}</head>`),
});
```

See
[hosts without redirect rules](https://lit-ui-router.dev/packages/ui-router-server#hosts-without-redirect-rules).

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
transition. Construction throws for a key the tree names and `delegates` lacks, and `as const`
routes make that a compile error, whether the host's arguments are inferred, written out
(`createFetchHandler<typeof router, [Env]>`) or annotated on the result. The Connect adapter
throws for delegate keys unless you pass
`delegates: 'next'` and serve those states downstream. `prerender()` from
`ui-router-server/prerender` writes no page and no rules line for a delegating state: it counts
the path in `result.tally.delegate` and lists it in `result.delegated`, so route those paths to
your server; on Cloudflare, list them in the Worker's `assets.run_worker_first` so the asset layer
doesn't answer them first. See
[delegating states](https://lit-ui-router.dev/packages/ui-router-server#delegating-states).

## Response states

A state marked `response: true`, `{ name: 'badge', url: '/{pkg}/badge.svg', response: true }`,
answers with a `Response` built from its resolves instead of a page. The tree carries only the
marker; the host binds a handler to the state's name, typed with `ResponseHandlers` from
`ui-router-server/ssr`, which requires a handler for exactly the states `as const` routes mark.
A handler receives `{ resolves, request }`. The verdict is `response`, decided by url matching
alone, so a host tells it from a page before rendering. A response state needs a url and no
`redirectTo`, and can't also delegate; `createServerRouter` throws for each, and `as const` routes
make a row with both markers a compile error. A url whose pattern is sometimes a page and sometimes a
redirect needs a `redirectTo` function instead, answered after `settle` with `redirectedTo(router,
transition)` from `ui-router-server/ssr` at the state's `redirectStatusCode` (`302` by default),
which a data `redirectTo`'s verdict honors too; see
[which decides when](https://lit-ui-router.dev/packages/lit-ui-router-ssr#page-response-state-or-redirect-which-decides-when). The fetch and Hono adapters pass a GET or HEAD of any
`Accept` that matches one to `serveResponse(verdict, request, ...args)` and answer other methods
with a 405; the Connect adapter throws unless you pass `responses: 'next'`. `prerender()` hands a
response state to its `respond` hook and writes a 2xx body at the path its url spells
(`badge.svg`), or a 3xx as a `_redirects` line, counting it in `result.tally.response`. See
[response states](https://lit-ui-router.dev/packages/ui-router-server#response-states).

## Trailing slashes

A mount's `config` can name the canonical spelling of a trailing slash per kind of state, so the
route table spells no slash and both sides agree on it:

```ts check
import type { RouterUrlConfig } from 'ui-router-server/url-config';

const urlConfig = {
  strict: false,
  trailingSlash: { pages: 'always' },
} satisfies RouterUrlConfig;
```

`pages` covers states answered with a page and `responses` covers response states, each
`'always'`, `'never'` or `'as-requested'` (the default). A delegating state's url belongs to its
host handler and keeps the spelling requested. A navigation in the other spelling verdicts as a
`308` redirect to the canonical one, so a shell's canonical `Link` names that spelling, a data `redirectTo` lands in its target's canonical spelling,
and a non-navigation request to a response state or delegate is answered at either spelling. The
policy needs `strict: false`, so both spellings match before it picks one; `createServerRouter`,
`compileRedirects` and `applyUrlConfig` throw without it. `applyUrlConfig` installs a
`stateRegistry` url decorator, so `href()` and the urls a transition pushes come out canonical on a
client router and on a server one built with `installServerLocation(router, { urlConfig })`.
`prerender()` follows the mount's policy: it writes a `308` line from each page's or response
state's other spelling onto the canonical path it was listed at. A
Cloudflare `assets.html_handling` of `force-trailing-slash` maps to `{ pages: 'always' }`, and
`drop-trailing-slash` to `{ pages: 'never' }`. See
[trailing slashes](https://lit-ui-router.dev/packages/ui-router-server#trailing-slashes).

## Values beyond plain JSON

`dehydrate` from `ui-router-server/ssr` and `seed` from `ui-router-server/ssr/client` take a
`transport`: a record of transporters, each carrying one type of value plain JSON can't, keyed by a
name both sides share. `encode` answers with plain JSON data for a value it carries and `false`,
`null` or `undefined` for any other, so an encoding of `false` or `null` must be wrapped, as in
`[false]`; `decode` rebuilds the value on the client. A value nested in an array or plain
object is carried too.

```ts check
import type { Transporter } from 'ui-router-server/ssr';

export const transport = {
  Date: {
    encode: (value) => value instanceof Date && value.toISOString(),
    decode: (encoded) => new Date(encoded as string),
  } satisfies Transporter<Date>,
};

// server: dehydrate(transition, { transport }); client: seed(router, payload, { transport })
```

The payload lists where each carried value sits, apart from the values, so a value of the app's
own never passes for one. A resolve whose value the client can't rebuild, for want of a transporter
or because `decode` throws, runs its function, and `seed` warns in development. See
[values beyond plain JSON](https://lit-ui-router.dev/packages/ui-router-server#values-beyond-plain-json)
and [`dehydrate`](https://lit-ui-router.dev/reference/ui-router-server/ssr/functions/dehydrate).

## Attribution

URL-matching logic (`src/url-matcher.ts`) is derived from [@uirouter/core](https://github.com/ui-router/core) (MIT) — see [LICENSE](./LICENSE).

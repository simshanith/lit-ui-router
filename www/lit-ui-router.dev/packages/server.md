---
title: Server-Side Routing
description: Honest HTTP verdicts for a static SPA with ui-router-server — the client's route table, running on the server or the edge
---

# ui-router-server

<p class="badges">
<a href="https://npmx.dev/package/ui-router-server" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/ui-router-server" /></a>
<a href="https://lit-ui-router.dev/gh/releases/ui-router-server/latest" target="_blank" class="badge"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/simshanith/lit-ui-router?filter=ui-router-server@*" /></a>
</p>

[`ui-router-server`](https://npmx.dev/package/ui-router-server) runs the
client's route table on the server, so a static single-page app can answer
deep links honestly: the app shell for real routes, a computed 302 for
redirects, and a real 404 for everything else.

It is a **verdict** engine, not a framework. A pathname goes in and a plain
object comes out — no `fetch`, no `Response`, no runtime assumptions in the
core — and turning that verdict into HTTP is the server's one job. Adapters
for Connect/Express, Vite, WinterCG `fetch`, and Hono ship that last step for
you.

::: warning Early days
This package is published and dogfooded — the Worker behind this site runs it
in production, serving
[every level of the spectrum](/guides/server-route-matching#live-on-this-site)
side by side, and the VitePress dev server runs the same mounts through the
Vite plugin — but it is still `0.x`. The APIs below are live and covered by tests; they
can still move in a minor release before `1.0`, so pin what you install.
:::

## When to use it

Use it when a server has to honour a ui-router state tree that already exists
for another reason, usually the client app's own route tables. Reusing that
tree is what makes the setup worthwhile: the server answers the same urls the
client routes, from one declaration. Each use below adds one concept and
leaves the ones before it unchanged:

1. **An honest SPA host.**
   [Real 404s](/guides/server-route-matching#real-404s-per-mount),
   redirects, and the shell for the client's routes:
   [`createServerRouter`](#quick-start), an [adapter](#adapters), and a
   `serveShell`.
2. **Server-rendered pages.** The same states' resolves and views, rendered
   with [`lit-ui-router-ssr`](/packages/ssr) on
   [`settle`](#settling-a-server-router) and
   [`prerender`](#emitting-a-static-site).
3. **Representations of a state.** [Response states](#response-states)
   answer with their own `Response` (a redirect, JSON, a badge) built from
   their resolves once `settle` lands them.
4. **Commands whose url the tree defines.**
   [Delegating states](#delegating-states) hand a url to a host handler.
   Delegate when the tree is the authority for the url: a command that shares
   params with a page, or a path `prerender` must skip.
5. **Outside HTTP.** The [verdict](#the-verdict) core has no HTTP dependency:
   a pathname goes in and a plain object comes out.

It is not for urls no state tree defines. Route those at the host, ahead of
the router: a platform route, an earlier middleware, or in Hono a route
registered before the router's catch-all.

```ts
const app = new Hono<{ Bindings: Env }>();

// No state defines /healthz, so the host answers it first.
app.get('/healthz', (c) => c.text('ok'));

app.use('*', (c, next) =>
  serverRouterHono(router, {
    serveShell: (_mount, request) => c.env.ASSETS.fetch(request),
  })(c, next),
);
```

Paths outside every mount already pass through: the fetch adapter returns
`null`, and the Hono and Connect middleware call `next()`, so the host keeps
its own fallthrough and 404 handling. A path a mount owns but no state matches
is that mount's 404, which `serveNotFound` can answer with the app's own
404 page ([real 404s, per mount](/guides/server-route-matching#real-404s-per-mount)).
[One request at a time](/guides/server-route-matching#one-request-at-a-time)
traces each case, and the client's side of the same miss is the
[404 state](/guides/unmatched-urls).

## What problem it solves

With [pushState URLs](/guides/location-plugins#html5-pushstate), every deep
link reaches the server, and the universal SPA fallback answers **200 with
the shell for every path** — including garbage ones. Users see the right
page because the in-router
[404 state](/guides/unmatched-urls) renders, while HTTP tells crawlers and
monitoring that everything is fine
([soft 404s](https://support.google.com/webmasters/answer/7440203)).

This package closes the gap by giving the server the same route patterns the
client matches, projected as pure data. That is **HTTP-semantics SEO** — the
status, redirect, and 404 a URL earns — and deliberately not content SEO:
the body is still the client-rendered shell. Rendering is a separate axis, and
[`lit-ui-router-ssr`](/packages/ssr) is what turns these verdicts into
prerendered html.

The [Server-Side Routing guide](/guides/server-route-matching) is the full
treatment: the six-level server-support spectrum, the routes-as-data
projection, and every level running live on this site. This page is the
package tour.

## The tiers

Capabilities are priced as separate entry points, measured min+gzip by the
package's own esbuild probe:

| Entry point                   | Needs `@uirouter/core`?               | Cost             | What it answers                                                                        |
| ----------------------------- | ------------------------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| `ui-router-server/matcher`    | no                                    | ~2.9 KiB gzip    | does this pathname match this pattern, with which params — and the inverse, `format()` |
| `ui-router-server/redirects`  | no                                    | ~3.6 KiB gzip    | given routes and a redirect table, where does this pathname go                         |
| `ui-router-server` (root)     | only for a `simulate` mount           | ~4.7 KiB gzip    | mounts in, verdicts out                                                                |
| `ui-router-server/simulate`   | yes (optional peer)                   | +~27.4 KiB, lazy | what would the real router do                                                          |
| `ui-router-server/location`   | yes (optional peer)                   | ~0.3 KiB gzip    | a path-shaped in-memory location for a server-side router                              |
| `ui-router-server/url-config` | no; it configures the router you pass | ~0.4 KiB gzip    | one url config for the client router, the mounts, and a server render                  |
| `ui-router-server/prerender`  | only for a `simulate` mount           | ~6.3 KiB gzip    | which files and host rules does this mount table make, around your render              |
| `ui-router-server/ssr`        | yes (optional peer)                   | ~1.1 KiB gzip    | when has a server router landed, and which of its resolves can the client adopt        |
| `ui-router-server/ssr/client` | yes (optional peer)                   | ~0.7 KiB gzip    | let the client's boot transition adopt the resolves a server render drew               |

The dependency-free tiers are a standalone port of core's matching subset,
type-pinned to core's signatures and differential-tested against its output.
The simulate tier carries `@uirouter/core` whole, behind a dynamic import
that bundles as a lazy chunk — a matcher-only configuration never loads it.

Picking one:

- **`/matcher`** — you already have server code and one question: does this
  path match, with which params. `urlMatcherFactory().compile(pattern)`,
  then [`exec`](https://github.com/simshanith/lit-ui-router/blob/main/packages/ui-router-server/src/url-matcher.ts),
  `format`, and `compare`.
- **`/redirects`** — pattern matching plus declarative redirect evaluation
  over a route table (`compileRoutes`, `matchRoute`, `compileRedirects`,
  `evaluateRedirects`), without mount bookkeeping. Synchronous, dependency-free.
- **root** — the default: `createServerRouter({ mounts })`, verdicts out.
- **`/simulate`** (or `strategy: 'simulate'` on a mount) — replay the URL
  through a real headless router, so redirect rules and `otherwise()` run as
  actual rules. Both strategies consume the same declaration data and produce
  identical verdicts today (the package tests assert parity), so `strategy`
  is a pure cost knob. A simulate mount's `prewarm` count builds idle routers
  once core loads, so its first requests skip the cold build.
- **`/location`** — you drive a real `@uirouter/core` router yourself, on the
  server, and want its `href()`s to match what the client writes: paths by
  default, for a [pushState](/guides/location-plugins#html5-pushstate) client,
  or `#` fragments under `html5Mode: false`.
  `installServerLocation(router, { url, baseHref, urlConfig, html5Mode })`.
- **`/url-config`** — the client router and the mounts should compile urls
  alike. `applyUrlConfig(router, config)` applies a mount's `config` to any
  `@uirouter/core` router before its states register, and imports no server
  code, so the client bundle can take it.
- **`/ssr`** — you render pages from a server router, with any renderer, and
  need each path's transition landed before you draw it, and its resolved
  values handed to the client's boot through `/ssr/client`.
  [`settle(router, path)`](#settling-a-server-router), then
  [`dehydrate` and `seed`](#handing-resolves-to-the-client).
- **`/prerender`** — you want the mount table written out as a static site:
  a page per shell verdict from your render, a `_redirects` line per
  redirect, and the 404 document.
  [`prerender(options)`](#emitting-a-static-site).

## Installation

```bash
npm install ui-router-server
```

Nothing else is required: `@uirouter/core` (only for
[`simulate` mounts and the `/location`, `/ssr` and `/ssr/client` entries](#the-tiers)) and
`hono` are **optional** peer
dependencies, and every other adapter targets a host you already have.

`latest` is the stable line (`0.1.0` today), and the only dist-tag — the
pre-release seed tags have been retired.

## Quick start

Routes are **data**, not state declarations — a server runtime cannot import
components:

```ts
import type { MountConfig, RouteDeclaration } from 'ui-router-server';

const routes: RouteDeclaration[] = [
  { name: 'welcome', url: '/welcome' },
  { name: 'contacts', url: '/contacts' },
  { name: 'contacts.contact', url: '/:contactId' },
  // Url-less: structural only, but declarable as an `otherwise` projection.
  { name: 'notFound' },
];

const app: MountConfig = {
  routes,
  redirects: [{ pattern: /^\/?$/, to: 'welcome' }],
  strategy: 'matcher',
};

export const mounts: Record<string, MountConfig> = { '/app': app };
```

Urls append along each state's parent, exactly as states do in the router:
the parent is the state's `parent:`, otherwise its name minus the last dotted
segment. `contacts.contact` folds to `/contacts/:contactId`, and
`{ name: 'contactHelp', parent: 'contacts', url: '/help' }` to
`/contacts/help`.

Then compile the mounts once and resolve pathnames against them:

```ts
import { createServerRouter } from 'ui-router-server';

// Mounts validate at construction: unknown redirect targets, cycles, and a
// bad `otherwise` target throw at startup, never per-request.
const router = createServerRouter({ mounts });

// Accepts a pathname, an absolute url string, or anything with a `pathname`.
const verdict = await router.resolve('/app/contacts/3');
// → { kind: 'shell', mount: '/app' }
```

The longest matching mount base owns a pathname outright. A bare mount base
(`/app`) resolves the empty subpath, which the `/^\/?$/` rule above claims;
construction [warns in development](/guides/development-builds#server-runtimes)
for each mount other than `/` that leaves it to 404. To catch that in CI,
assert in a test that
[`diagnoseMounts(router)`](/api/ui-router-server/index/functions/diagnoseMounts)
returns an empty array: it reports, as data and in every build, the findings
the warning prints.

## The verdict

```ts
type Verdict =
  | { kind: 'shell'; mount: string; status?: number }
  | { kind: 'redirect'; mount: string; location: string; status: number }
  | {
      kind: 'delegate';
      mount: string;
      subpath: string;
      delegate: string;
      state: string;
      params: RawParams;
    }
  | {
      kind: 'response';
      mount: string;
      subpath: string;
      state: string;
      params: RawParams;
    }
  | { kind: 'notFound'; mount?: string };
```

- **`shell`** — serve the app shell. An absent `status` means default shell
  handling, conditional 304s included; a set `status` (404 from the
  `otherwise` projection today) wins outright, and the consumer must strip
  the request's validators so the asset fetch returns a body to relabel.
- **`redirect`** — `location` is the mount-joined target path and may already
  carry a query string, so preserve the request's search with the exported
  `mergeSearch(location, incoming)` rather than concatenating. Verdicts fix
  `status: 302`: a redirect table is configuration that changes with the next
  deploy, and browsers cache 301s past it.
- **`delegate`** — the path matched a state that names a host handler by key
  ([delegating states](#delegating-states)); the handler answers the request.
- **`response`** — the path matched a [response state](#response-states); the
  handler bound to its name answers with a `Response`, never the shell.
- **`notFound`** — `mount` set means a mount owned the path but nothing
  matched (serve that app's 404 page); absent means no mount claimed it at
  all (not this router's problem).

## Adapters

Four entry points turn verdicts into HTTP. Each is a thin wrapper — all the
routing intelligence stays in the verdict API.

| Entry point                | Export                    | For                                                  |
| -------------------------- | ------------------------- | ---------------------------------------------------- |
| `ui-router-server/connect` | `createConnectMiddleware` | Connect / Express middleware stacks                  |
| `ui-router-server/vite`    | `serverRouterPlugin`      | `vite dev` and `vite preview`                        |
| `ui-router-server/fetch`   | `createFetchHandler`      | WinterCG `Request` → `Response` (Workers, Deno, Bun) |
| `ui-router-server/hono`    | `serverRouterHono`        | Hono middleware                                      |

They share one contract: a verdict is either **answered** or **passed on**.
The fetch adapter returns `Response | null`; the Connect adapter either
writes or calls `next()`. Both default `shouldHandle` to the navigation
heuristic `connect-history-api-fallback` established — GET/HEAD requests
whose `Accept` includes `text/html` — so module and asset fetches pass
through untouched. Override with `() => true` when the adapter sits behind
the static layer and should judge everything.

### fetch — the edge

A minimal Cloudflare Worker, with each mount's shell at its base and a
`404.html` under it:

```ts
import { mounts } from './mounts';
import { createServerRouter } from 'ui-router-server';
import { createFetchHandler } from 'ui-router-server/fetch';

// Module scope: the mount tables compile once per isolate.
const router = createServerRouter({ mounts });

export default {
  async fetch(request, env) {
    const handler = createFetchHandler(router, {
      // Asset IO is the one thing a runtime-neutral adapter can't default.
      // The Request arrives already rewritten to the shell path (and, for a
      // status'd shell, stripped of validators) — the host just fetches it.
      serveShell: (_mount, shellRequest) => env.ASSETS.fetch(shellRequest),
      // Mount-owned miss: that app's own 404 page, at an honest 404.
      serveNotFound: async (mount, req) => {
        // Built from the original request, so a HEAD stays a HEAD.
        const page = await env.ASSETS.fetch(
          new Request(new URL(`${mount}/404.html`, req.url), req),
        );
        return new Response(page.body, {
          status: 404,
          headers: new Headers(page.headers),
        });
      },
      // The Worker runs after the assets layer, so judge everything.
      shouldHandle: () => true,
    });

    // null is the pass-through: a path this router doesn't own.
    return (await handler(request)) ?? env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
```

The adapter owns the verdict → HTTP mechanics: status mapping, `mergeSearch`
on redirect `Location`s, stripping validators and relabelling status'd
shells, and the canonical `Link` header (status-less shells only — a 404 is
not an alternate representation of anything).

This site's Worker
([`www/lit-ui-router.dev/worker/index.ts`](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/worker/index.ts))
builds on the same shape: a `shellPath` that points several pushState mounts
at one shared shell, a pass-through when a mount has no `404.html`, and
`noindex` on its teaching exhibits.

### vite — dev/prod parity

The honest-status upgrade of Vite's built-in SPA fallback: `vite dev` and
`vite preview` answer the same 302s and mount-owned 404s the production
server does, from the same mounts table. The plugin installs its middleware
in the pre position — before Vite's always-200 HTML fallback — and its
returned object is a structural subset of Vite's `Plugin`, so Vite stays a
type-only peer this package never imports.

In this example each mount's HTML entry is built to `<mount>.html`:

```ts
import { createServerRouter } from 'ui-router-server';
import { serverRouterPlugin } from 'ui-router-server/vite';
import { defineConfig } from 'vite';

const router = createServerRouter({ mounts });

export default defineConfig({
  plugins: [
    serverRouterPlugin(router, {
      // Where each mount's HTML entry lives, when it isn't the base.
      shellPath: (mount) => `${mount}.html`,
    }),
  ],
});
```

This site's dev server runs the plugin with its own `shellPath` table and a
`serveNotFound` that serves each mount's 404 page
([`www/lit-ui-router.dev/.vitepress/vite.config.ts`](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/.vitepress/vite.config.ts)).

### connect — Node servers

`createConnectMiddleware(router, options)` returns a plain
`(req, res, next)` middleware. Mount it **before** the static layer: the
default `serveShell` rewrites `req.url` to the mount base and `next()`s into
whatever serves your HTML.

```ts
import express from 'express';
import { createServerRouter } from 'ui-router-server';
import { createConnectMiddleware } from 'ui-router-server/connect';

const app = express();
app.use(createConnectMiddleware(createServerRouter({ mounts })));
app.use(express.static('dist'));
```

The request/response types are structural subsets of `http.IncomingMessage`
and `http.ServerResponse`, so Node, Express, and Connect objects all fit
without the package depending on Node types.

Connect can't call [delegate handlers](#delegating-states), so
`createConnectMiddleware` throws at construction for a router whose states
name delegate keys. Pass `delegates: 'next'` to pass navigations that match a
delegating state to the downstream stack, and serve those states there.
[Response states](#response-states) work the same way: it throws for a router
that declares them unless you pass `responses: 'next'`, and answer them
downstream.

### hono

`serverRouterHono` wraps the fetch handler in Hono's continuation: a verdict
`Response` is returned, anything else `next()`s. Mount it before the
static layer. `hono` is a **type-only** optional peer — the import is erased
at build, so the bundle never requires it.

```ts
import { Hono } from 'hono';
import { createServerRouter } from 'ui-router-server';
import { serverRouterHono } from 'ui-router-server/hono';

const router = createServerRouter({ mounts });
const app = new Hono<{ Bindings: Env }>();

app.use('*', (c, next) =>
  serverRouterHono(router, {
    serveShell: (_mount, request) => c.env.ASSETS.fetch(request),
  })(c, next),
);
```

### Delegating states

A state with a `delegate` key hands its url to a host handler: a command
endpoint, a form POST, a JSON feed. The tree carries only the key, so the
client and the server can share it. The fetch and Hono adapters map keys to
fetch-shaped handlers in their `delegates` option. A delegate receives
exactly the host's handler arguments: `(request, env, ctx)` on Workers,
`(request, c.env, c.executionCtx)` behind `serverRouterHono`, and Connect's
own `(req, res, next)` downstream, so a Hono app's `fetch` or a Worker handler
fits bare. Wrap or bind a handler whose extra parameters are optional, so a
host argument such as `ctx` never lands in one:

```ts
import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { createServerRouter } from 'ui-router-server';
import { createFetchHandler, delegateContext } from 'ui-router-server/fetch';

const routes = [
  { name: 'home', url: '' },
  { name: 'claims', url: '/claims/{id}', delegate: 'ledger' },
] as const;

const router = createServerRouter({ mounts: { '/app': { routes } } });

// The delegate gets the original request, '/app' prefix included.
const ledger = new Hono<{ Bindings: Env }>().basePath('/app');

ledger.post('/claims/:id', async (c) => {
  const { params } = delegateContext(c.req.raw, 'ledger', router);
  await c.env.CLAIMS.send({ id: params.id, claim: await c.req.json() });
  return c.body(null, 202);
});

const handler = createFetchHandler(router, {
  serveShell: (_mount, shellRequest) => env.ASSETS.fetch(shellRequest),
  delegates: { ledger: ledger.fetch },
});

export default {
  async fetch(request, env, ctx) {
    // env and ctx reach ledger.fetch untouched.
    return (await handler(request, env, ctx)) ?? env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
```

`serverRouterHono` forwards `c.env` and `c.executionCtx` after the request,
so `delegates: { ledger: ledger.fetch }` works behind the middleware too, and
`ui-router-server/hono` re-exports `delegateContext`.

A request of any method and any `Accept` that matches a delegating state goes
to its handler. The handler gets the original Request object, body unread and
url unchanged, which is what keeps `delegateContext` working; its `Response`
goes out untouched. Unlike Hono's `app.mount()`, nothing strips the mount
base, so route on the context's `subpath`, give the delegate the mount base
(`basePath('/app')` above), or put delegating states on the `/` mount.
Requests that match no delegating state keep the navigation contract above.

`delegateContext(request, key, router?)` returns
`{ mount, subpath, delegate, state, params }` for the match. `subpath` is the
pathname within the mount (`''` at the bare base). `params` holds what the
pathname alone resolves: search params keep their declared defaults, so read
the query from the request. It throws when the request wasn't delegated, was
delegated to a different key, or came through a router other than the one
passed. The context is keyed by the Request object, so a `request.clone()` or
a `new Request(request)` has none: read it from the request the handler
received (`c.req.raw` in Hono).

- A delegating state needs a url and no `redirectTo`, and its children don't
  inherit the key. A `redirectTo` or redirect rule that targets a delegating
  state is rejected too, since redirects answer navigations only and a POST
  would never reach the handler. `createServerRouter` throws for each.
- A redirect rule whose pattern also matches a delegating url is ordered as
  the tier orders any rule against a state: `matcher` mounts evaluate rules
  first and redirect, while `simulate` mounts follow core's rule sort, where
  an equally specific state url wins. Keep rule patterns off delegating urls.
- `createFetchHandler` throws at construction when the router names a key
  that `delegates` doesn't map. Extra keys in `delegates` are allowed.
- A handler that throws rejects the adapter's promise, so the host's own error
  handling answers it.
- Requests outside `shouldHandle` only match urls: they never run a
  transition, even on a `simulate` mount. When the router names no delegate
  keys they pass as `null` without matching.
- A delegating state never runs a transition, so its resolves don't run
  either.
- The Connect adapter throws for delegate keys unless `delegates: 'next'`,
  as its section above describes.

#### Typing delegates

Declare `routes` `as const` and the router's type carries its state names
and delegate keys: `delegates` must then map every key the routes name, a
missing key is a compile error, and `delegateContext(request, key, router)`
narrows `state` to the states that name `key`. Each router is typed on its
own, so two routers in one program can name different keys. Untyped routes
keep `string` keys and states and core's `RawParams`.

The router's type is `createFetchHandler`'s first type parameter and the
host's arguments its second, so the key check holds however the arguments
are given: inferred from the handlers, written out as
`createFetchHandler<typeof router, [env: Env]>`, or annotated on the result
as `const handler: FetchHandler<[env: Env]> = createFetchHandler(…)`.
`serverRouterHono<typeof router, AppEnv>` takes them in the same order.

`params` reads the `DelegateSeam` interface that `ui-router-server/fetch`
exports empty. A typed state registry augments it with a `params` member
indexed by state name, and `DelegateParams<N>` returns that entry, or
`RawParams` for a state it doesn't name.

`ui-router-server` augments `@uirouter/core`'s `StateDeclaration` with an
optional `delegate?: string`, so a client tree typed with core's declarations
can carry the key. The augmentation applies in programs that import
`ui-router-server`; a client-only program adds `import type {} from 'ui-router-server';`.

### Response states

A state marked `response: true` answers with a `Response` built from its
resolves (a redirect, JSON, a badge) instead of a page. The tree carries only
the marker; the host binds a handler to the state's name, so client bundles
never import server code. Its verdict is `response`, decided by url matching
alone with no transition, so a host can tell it from a page before rendering
anything, for example to skip a trailing-slash redirect it gives pages.

```ts
import type { ResponseHandlers } from 'ui-router-server/ssr';

const routes = [
  { name: 'home', url: '' },
  { name: 'badge', url: '/{pkg}/badge.svg', response: true },
] as const;

const responses = {
  badge: ({ resolves }) =>
    new Response(resolves.svg, {
      headers: { 'Content-Type': 'image/svg+xml' },
    }),
} satisfies ResponseHandlers<
  (typeof routes)[number],
  { badge: { svg: string } }
>;
```

A handler receives `{ resolves, request }`: the values the state's
transition landed with, inherited ones included, and the request it answers.
`ResponseHandlers` requires a handler for exactly the states the routes mark,
and its second parameter types each handler's resolves by state name.

- A response state needs a url and no `redirectTo`, can't also delegate, and
  its children don't inherit the marker. `createServerRouter` throws for each,
  and `as const` routes make a row with both markers a compile error. A
  redirect may target a response state.
- The fetch and Hono adapters pass a GET or HEAD of any `Accept` that matches
  a response state to `serveResponse(verdict, request, ...args)`, so an
  `<img>` reaches its badge, and answer other methods with a 405. The host
  settles the state there and runs its handler; the `Response` goes out
  untouched. A typed router that declares response states requires
  `serveResponse` at compile time, and construction throws without it.
- The Connect adapter throws for response states unless `responses: 'next'`.
- `ui-router-server` augments core's `StateDeclaration` with
  `response?: true`, as it does with `delegate`.

## Server-side hrefs

`installServerLocation` puts a real `@uirouter/core` router on an in-memory
location whose url shape you pick, so the links a server render emits match
the ones the client writes. It is path-shaped by default, for a
[pushState](/guides/location-plugins#html5-pushstate) client, and builds
`/sheet/7B`; core's own `memoryLocationPlugin` is fixed at `html5Mode()`
`false` and builds `#/sheet/7B`.

```ts
import { servicesPlugin, UIRouter } from '@uirouter/core';
import { installServerLocation } from 'ui-router-server/location';

const { pathname, search } = new URL(request.url);
const router = new UIRouter();
router.plugin(servicesPlugin);
installServerLocation(router, {
  url: pathname + search,
  baseHref: '/app/',
  urlConfig: { strict: false },
});
```

`baseHref` is the mount prefix: it is added to every href, and `url` is
passed without it, exactly as a `<base href>` client matches. `urlConfig`
takes the same object as a mount's `config` and goes through
[`applyUrlConfig`](/api/ui-router-server/url-config/functions/applyUrlConfig)
first, so it throws, leaving the router as it was, if a state's url already
compiled. For a
[hash-location](/guides/location-plugins#hash-urls) client, pass
`html5Mode: false` and the same router builds `#/sheet/7B`. The plugin itself
is exported as `serverLocationPlugin` — `router.plugin(serverLocationPlugin,
{ html5Mode: false })` — and its config as `ServerLocationConfig`, for a
router that installs its own plugins. Simulate mounts run on the same
location.

## Settling a server router

A server render reads the router only once its transition has landed.
[`settle(router, path)`](/api/ui-router-server/ssr/functions/settle) from
`ui-router-server/ssr` sets the url, syncs the router to it, and resolves
with the transition that landed, resolves included, so a synchronous render
after it reads every value. A page loop calls it once per path on the same
router, started or not.

```ts
import { installServerLocation } from 'ui-router-server/location';
import { settle } from 'ui-router-server/ssr';

installServerLocation(router, { urlConfig: { strict: false } });

for (const path of ['/', '/sheet/7B']) {
  await settle(router, path);
  pages.set(path, render(router));
}
```

It rejects rather than hangs: on a url no rule matches, on a failed
transition, and past its
[`timeout`](/api/ui-router-server/ssr/interfaces/SettleOptions). The entry
imports `@uirouter/core` and no renderer, so it runs under any renderer.
[`lit-ui-router-ssr`](/packages/ssr) builds its
prerender on the same step.

### Handing resolves to the client

A client booting over a server-rendered page would run every resolve the
server already ran.
[`dehydrate(transition)`](/api/ui-router-server/ssr/functions/dehydrate)
draws the resolved values of a landed transition into a JSON payload, keyed by
state and token, along with the state and url parameters it was drawn for.
[`seed(router, payload)`](/api/ui-router-server/ssr-client/functions/seed)
from `ui-router-server/ssr/client`, called on the client router before it
starts, makes the boot transition adopt those
values instead of calling their resolve functions.

```ts
// server, per path: ui-router-server/ssr
const { payload, unserializable } = dehydrate(await settle(router, path));

// client, before the router starts: ui-router-server/ssr/client
seed(router, payload);
```

The boot is still a real transition, with every hook it fires. Every resolve
the payload does not cover runs as usual:

- **A value that is not
  [plain JSON data](/api/ui-router-server/ssr/type-aliases/JsonValue).** A
  `Date`, a `Map`, a class instance or `undefined` would come back changed, so
  `dehydrate` lists it in `unserializable` instead, and the client runs its
  resolve. A [codec](#values-beyond-plain-json) can carry more.
- **A `NOWAIT` resolve.** `dehydrate` neither awaits nor draws it; it stays
  with the client.
- **A resolve the call keeps out.**
  [`shouldDehydrate`](/api/ui-router-server/ssr/interfaces/DehydrateOptions)
  decides per state and token, such as for data every page shares that the
  client loads once from a cacheable file. A resolve it declines is not
  listed in `unserializable`.
- **Another target.** A boot to a state, or url parameters, the payload was
  not drawn for adopts nothing, and neither does a missing payload or one
  drawn with another codec.
- **Later transitions.** The seed disarms once a transition succeeds.

The client entry imports `@uirouter/core` and nothing from the server entry,
so a browser bundle takes it alone; it exports the payload types too.
Where the payload goes in the document is the renderer's choice.

#### Values beyond plain JSON

`dehydrate` and `seed` take a
[`codec`](/api/ui-router-server/ssr/interfaces/ResolveCodec): `encode` turns
each drawn value into plain JSON data, throwing for one it can't carry, and
`decode` turns it back on the client. The payload stays plain JSON, so its
`state` and `params` read the same with any codec. The default, `jsonCodec`,
carries plain JSON data as it is. A library such as devalue fits as it ships:

```ts
import { parse, stringify } from 'devalue';
import type { ResolveCodec } from 'ui-router-server/ssr';

export const codec: ResolveCodec = {
  name: 'devalue',
  encode: (value) => stringify(value),
  decode: (value) => parse(value as string),
};

// server: dehydrate(transition, { codec }); client: seed(router, payload, { codec })
```

The payload records the codec's name, and `seed` adopts nothing from a payload
drawn with another, warning in development. See
[`dehydrate`](/api/ui-router-server/ssr/functions/dehydrate).

## Emitting a static site

[`prerender(options)`](/api/ui-router-server/prerender/functions/prerender) asks
the mount table for a verdict per path and writes the site. A shell verdict
becomes `<subpath>/index.html`, holding whatever `render` returns for it. A
redirect becomes a `_redirects` line, paired with and without the trailing
slash, and no page. The `otherwise` projection becomes `404.html`. A path that
matches nothing is counted, listed in `result.warnings`, and warned about in
development. A path that matches a [delegating state](#delegating-states)
gets no page and no rules line: it is counted in `result.tally.delegate` and
listed in `result.delegated`, in enumeration order. A path that matches a
[response state](#response-states) is answered by the `respond` hook: a 2xx
body, read as text, is written at the path its url spells (`badge.svg`), its
headers dropped, and a 3xx becomes a `_redirects` line to its `Location`.
Either is counted in `result.tally.response`; another status throws, as does
a response state with no `respond`. A verdict kind the loop doesn't know
throws instead of being counted.

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { prerender } from 'ui-router-server/prerender';
import { settle } from 'ui-router-server/ssr';

const result = await prerender({
  mounts,
  outDir: 'dist',
  paths: ['/', '/sheet/7B', '/legacy'],
  render: async (verdict, { path }) => {
    await settle(router, path);
    return page(router);
  },
  write: async (file, body) => {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
  },
});
```

The loop never touches a filesystem itself: `write` receives each file with
`outDir` joined on, so the same call emits through `node:fs`, a virtual fs, or
a `Map`, under any runtime.
[`lit-ui-router-ssr`](/packages/ssr)'s `prerender` is this loop with a lit
render, and writes through `node:fs` by default.

A delegated path has no static file, so the host must send it to the server.
On Cloudflare Workers, list `result.delegated` in
[`assets.run_worker_first`](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/#run-worker-first-for-selective-paths)
so the Worker sees those paths before static assets do.

## What the server can't see

Client state — auth flags, remembered navigation targets, feature flags —
does not exist at the edge, so routing that depends on it stays out of the
projection and the shell verdict is the degrade path: the client router
re-runs the URL with its full configuration. The simulate tier applies the
same rule to itself, degrading failed or timed-out simulations to the shell
rather than a wrong redirect or a spurious 404. Trailing slashes are strict
on both sides; if your client relaxes `strictMode`, pass the same relaxation
as the mount's `config`, or share one object through
[`applyUrlConfig`](/api/ui-router-server/url-config/functions/applyUrlConfig).
A static host that serves `<subpath>/index.html` by redirecting onto the
slashed url makes that relaxation mandatory
([static hosts add a trailing slash](/packages/ssr#static-hosts-add-a-trailing-slash)).
Nor does it see which ids exist: a `:id` param
matches any value, so narrow it to the known ids when the build can list them
([parameterized routes and soft 404s](/guides/server-route-matching#parameterized-routes-and-soft-404s)).

## Further reading

- [API reference](/api/ui-router-server/) — every entry point, one module
  per subpath import
- [Server-Side Routing guide](/guides/server-route-matching) — the spectrum,
  the projection, and the live mounts
- [`lit-ui-router-ssr`](/packages/ssr) — these verdicts prerendered into a
  static site
- [Unmatched URLs](/guides/unmatched-urls) — the client-side 404 state this
  pairs with
- [Location plugins](/guides/location-plugins) — why path-location clients
  are the ones that need any of this
- [On the Altitude Atlas](https://atlas.lit-ui-router.dev/bricks/?focus=ui-router-server) — this package as
  a brick in sheet 2's model in the round, sized by its authored files and
  seated on what it peers

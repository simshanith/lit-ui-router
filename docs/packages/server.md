---
title: Server-Side Routing
description: Honest HTTP verdicts for a static SPA with ui-router-server — the client's route table, running on the server or the edge
---

# ui-router-server

<p class="badges">
<a href="https://npmx.dev/package/ui-router-server" target="_blank" class="badge"><img alt="NPM Version" src="https://img.shields.io/npm/v/ui-router-server" /></a>
</p>

[`ui-router-server`](https://www.npmjs.com/package/ui-router-server) runs the
client's route table on the server, so a static single-page app can answer
deep links honestly: the app shell for real routes, a computed 302 for
redirects, and a real 404 for everything else.

It is a **verdict** engine, not a framework. A pathname goes in and a plain
object comes out — no `fetch`, no `Response`, no runtime assumptions in the
core — and turning that verdict into HTTP is the server's one job. Adapters
for Connect/Express, Vite, WinterCG `fetch`, and Hono ship that last step for
you.

::: warning In development
This package is not yet usable from npm. The name currently holds an empty
placeholder seed (`0.0.1-alpha.0`, published to stand up the release
machinery); the code ships from
[this repository](https://github.com/simshanith/lit-ui-router/tree/main/packages/ui-router-server)
today, and a real `0.x` alpha is the next step — follow
[issue #354](https://github.com/simshanith/lit-ui-router/issues/354). The
APIs below are live and dogfooded, but they can still move before the first
alpha.
:::

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
the body is still the client-rendered shell. Rendering is a separate,
roadmap axis.

The [Server-Side Routing guide](/guides/server-route-matching) is the full
treatment: the six-level server-support spectrum, the routes-as-data
projection, and every level running live on this site. This page is the
package tour.

## The tiers

Capabilities are priced as separate entry points, measured min+gzip by the
package's own esbuild probe:

| Entry point                  | Needs `@uirouter/core`?     | Cost             | What it answers                                                                        |
| ---------------------------- | --------------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| `ui-router-server/matcher`   | no                          | ~2.9 KiB gzip    | does this pathname match this pattern, with which params — and the inverse, `format()` |
| `ui-router-server/redirects` | no                          | ~3.6 KiB gzip    | given routes and a redirect table, where does this pathname go                         |
| `ui-router-server` (root)    | only for a `simulate` mount | ~4.7 KiB gzip    | mounts in, verdicts out                                                                |
| `ui-router-server/simulate`  | yes (optional peer)         | +~27.4 KiB, lazy | what would the real router do                                                          |

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
  is a pure cost knob.

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

Dotted names nest and urls append, exactly as states do in the router:
`contacts.contact` folds to `/contacts/:contactId`.

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

The longest matching mount base owns a pathname outright.

## The verdict

```ts
type Verdict =
  | { kind: 'shell'; mount: string; status?: number }
  | { kind: 'redirect'; mount: string; location: string; status: number }
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

The representative example, and what serves this site
([`docs/worker/index.ts`](https://github.com/simshanith/lit-ui-router/blob/main/docs/worker/index.ts)):

```ts
import { mounts } from 'sample-app-routes';
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
        const page = await env.ASSETS.fetch(
          new URL(`${mount}/404.html`, req.url),
        );
        return new Response(page.body, {
          status: 404,
          headers: new Headers(page.headers),
        });
      },
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

### vite — dev/prod parity

The honest-status upgrade of Vite's built-in SPA fallback: `vite dev` and
`vite preview` answer the same 302s and mount-owned 404s the production
server does, from the same mounts table. The plugin installs its middleware
in the pre position — before Vite's always-200 HTML fallback — and its
returned object is a structural subset of Vite's `Plugin`, so Vite stays a
type-only peer this package never imports.

```ts
import { createServerRouter } from 'ui-router-server';
import { serverRouterPlugin } from 'ui-router-server/vite';
import { defineConfig } from 'vite';

const router = createServerRouter({ mounts });

export default defineConfig({
  plugins: [
    serverRouterPlugin(router, {
      // Where each mount's HTML entry actually lives, when it isn't the base.
      shellPath: (mount) => `${mount}.html`,
    }),
  ],
});
```

This site's own dev server runs it
([`docs/.vitepress/vite.config.ts`](https://github.com/simshanith/lit-ui-router/blob/main/docs/.vitepress/vite.config.ts)).

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

## What the server can't see

Client state — auth flags, remembered navigation targets, feature flags —
does not exist at the edge, so routing that depends on it stays out of the
projection and the shell verdict is the degrade path: the client router
re-runs the URL with its full configuration. The simulate tier applies the
same rule to itself, degrading failed or timed-out simulations to the shell
rather than a wrong redirect or a spurious 404. Trailing slashes are strict
on both sides; if your client relaxes `strictMode`, pass the same relaxation
as the mount's `config`.

## Status

- **npm**: [`ui-router-server`](https://www.npmjs.com/package/ui-router-server)
  holds an empty placeholder seed only. There is nothing useful to install
  yet.
- **Source**:
  [`packages/ui-router-server`](https://github.com/simshanith/lit-ui-router/tree/main/packages/ui-router-server)
  — the code, its tests, and the bundle-size probes behind the tier table.
- **Dogfood**: the Cloudflare Worker behind lit-ui-router.dev runs this
  package in production today, serving
  [every level of the spectrum](/guides/server-route-matching#live-on-this-site)
  side by side; the VitePress dev server runs the same mounts through the
  Vite plugin.
- **Next**: a real `0.x` alpha, tracked in
  [issue #354](https://github.com/simshanith/lit-ui-router/issues/354).

## Further reading

- [API reference](/api/ui-router-server/) — every entry point, one module
  per subpath import
- [Server-Side Routing guide](/guides/server-route-matching) — the spectrum,
  the projection, and the live mounts
- [Unmatched URLs](/guides/unmatched-urls) — the client-side 404 state this
  pairs with
- [Location plugins](/guides/location-plugins) — why path-location clients
  are the ones that need any of this

---
title: Server-Side Routing
description: Serve routing verdicts at the edge with ui-router-server - the app shell for real routes, real 404s for everything else
---

# Server-Side Routing

With [pushState-style URLs](./location-plugins#html5-pushstate), a deep link
like `/contacts/3/edit` reaches your server first, and the usual answer is a
blanket SPA fallback: serve `index.html` for every path. That works, but the
server now answers **200 with the app shell for garbage URLs too**. The
in-router [404 state](./unmatched-urls) renders, so users see the right page —
while HTTP tells crawlers and monitoring that everything is fine.

The fix is to let the server share the client's routing: the same URL
patterns, matched with the same semantics, deciding between the shell, a
redirect, and a real 404.
[`ui-router-server`](https://github.com/simshanith/lit-ui-router/tree/main/packages/ui-router-server)
packages that decision as a **routing verdict** — a pathname in, a plain
object out; no `fetch`, no `Response`, no runtime assumptions — so the server
itself stays a thin consumer. This site runs the pattern in production: the
Cloudflare Worker behind lit-ui-router.dev resolves verdicts for the sample
apps' mounts, so `/app/contacts/3/edit` serves the
<a href="/app" target="_self">sample app</a>'s shell, `/app/` 302s to
`/app/welcome`, and `/app/definitely-not` gets a real 404.

## The tier ladder

The package prices its capabilities as separate entry points, measured
min+gzip by its own esbuild probe:

| import                       | needs `@uirouter/core`?               | cost            | what it answers                                                                        |
| ---------------------------- | ------------------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| `ui-router-server/matcher`   | no                                    | 2.7 KiB         | does this pathname match this pattern, with which params — and the inverse, `format()` |
| `ui-router-server/redirects` | no                                    | 3.4 KiB         | given routes and a redirect table, where does this pathname go                         |
| `ui-router-server` (root)    | only when a `simulate` mount resolves | 4.1 KiB         | mounts in, verdict out                                                                 |
| `ui-router-server/simulate`  | yes (optional peer)                   | +27.3 KiB, lazy | what would the real router do                                                          |

The ladder's shape is measured, not aesthetic. Deep-importing
`@uirouter/core` internals carves a matching-only consumer from 43 KiB gzip
down to 14 — `UrlMatcher` and the param machinery sit near the leaves of
core's module graph — but it **cannot carve a headless router below the
~43 KiB floor**: everything substantive hangs off the `UIRouter` constructor,
and dropping the barrel imports sheds only empty re-export shims (~0.3 KiB).
So the dependency-free tiers are a standalone _port_ of the matching subset
(type-pinned to core's signatures, differential-tested against core's own
output), while the simulate tier carries core whole — behind a dynamic import
that bundles as a lazy chunk, so a matcher-only configuration never loads it.

Picking a tier:

- **`/matcher`** — you have server code already and one question: does this
  path match, with which params. No route table, no verdicts.
- **`/redirects`** — pattern matching plus declarative redirect evaluation
  over a route table, without mount bookkeeping.
- **root** — the default. Mounts in, verdicts out; costs matcher-tier bytes
  until a mount opts into simulation.
- **`/simulate`** (or `strategy: 'simulate'` on a mount) — replay the URL
  through a real headless router. Today both strategies consume the same
  declaration subset and produce identical verdicts (the package tests assert
  parity), so `strategy` is a pure cost knob; this is the tier where routing
  that data cannot express — hooks, resolves, `redirectTo` functions — will
  live as the config widens.

## The projection: routes as data

A server runtime cannot import the client's state definitions — they import
components, which register custom elements at module scope. Instead, the
sample apps project their url-bearing states into pure data
([`sample-app-routes`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-routes/src/routes.ts)):

```ts
export const routes: RouteDeclaration[] = [
  { name: 'welcome', url: '/welcome' },
  { name: 'home', url: '/home' },
  { name: 'login', url: '/login' },
  { name: 'contacts', url: '/contacts' },
  { name: 'contacts.contact', url: '/:contactId' },
  { name: 'contacts.contact.edit', url: '/edit' },
  { name: 'contacts.new', url: '/new' },
  { name: 'mymessages', url: '/mymessages' },
  { name: 'mymessages.compose', url: '/compose' },
  { name: 'mymessages.messagelist', url: '/:folderId' },
  { name: 'mymessages.messagelist.message', url: '/:messageId' },
  { name: 'prefs', url: '/prefs' },
];
```

Dotted names nest and urls append, exactly as states do in the router:
`mymessages.messagelist.message` folds to `/mymessages/:folderId/:messageId`.
What the projection **leaves out** is as deliberate as what it includes:

```ts
// Mirrors router.config.ts: the app root has no state url; a when(/^\/?$/)
// rule routes it to welcome. Its otherwise() -> notFound rule is NOT
// mirrored, so unknown paths stay notFound verdicts (real server 404s).
export const redirects: RedirectRule[] = [{ pattern: /^\/?$/, to: 'welcome' }];

// 'matcher': the tables above are pure data, so the dependency-free tier
// suffices. Routing the client decides conditionally (mymessages' DSR
// default, requiresAuth) is deliberately absent — the server must not pick a
// winner. If a rule ever needs hooks or resolves, flipping a mount to
// 'simulate' is config, not code.
const app: MountConfig = { routes, redirects, strategy: 'matcher' };

/** Both sample apps run the same route tree, each under its own mount. */
export const mounts: Record<string, MountConfig> = {
  '/app': app,
  '/app-mobx': app,
};
```

Three omissions to copy:

- **The client's `otherwise()` rule stays client-side.** Mirroring it would
  turn every unknown path back into a 200 shell — the exact lie this pattern
  exists to stop. Unmatched paths stay `notFound` verdicts.
- **Conditional routing stays client-side.** The client redirects
  `/mymessages` to a remembered folder (a DSR default) and bounces
  unauthenticated users to login (the
  [`requiresAuth` hook](./route-guards)) — both decided by client state the
  server cannot see. The server serves the shell and lets the client's full
  configuration run.
- **Param defaults the projection doesn't need.** `RouteDeclaration` accepts
  `params`, but the client's `folderId: 'inbox'` default only matters once
  the app is running; `/mymessages` already matches its parent state's
  pattern. Audit yours.

The projection mirrors the client's states rather than importing them, so it
can drift; the app pins it with
[contract tests](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-routes/test/routes.test.ts)
that resolve every verdict the worker will serve — shells, the root redirect,
real 404s, and the shell-not-redirect verdicts for the client-conditional
routes — through the real package API.

## The verdict

`createServerRouter` compiles and validates every mount at construction —
unknown redirect targets and cycles throw at startup, never per-request — and
the longest matching mount base owns a pathname outright. `resolve()` accepts
a pathname, an absolute URL string, or anything with a `pathname`:

```ts
type Verdict =
  | { kind: 'shell'; mount: string; status?: number }
  | { kind: 'redirect'; mount: string; location: string; status: number }
  | { kind: 'notFound'; mount?: string };
```

`shell.status` is absent today — it is reserved for a future data tier
(401/403-with-shell), and when set it wins outright over normal shell
handling. `redirect.location` is the mount-joined target path, and
`notFound.mount` distinguishes "a mount owned this path but nothing matched"
from "no mount at all".

## The worker: verdict → HTTP

The whole handler
([`docs/worker/index.ts`](https://github.com/simshanith/lit-ui-router/blob/main/docs/worker/index.ts)):

```ts
import { mounts } from 'sample-app-routes';
import { createServerRouter, mergeSearch } from 'ui-router-server';

// All routing intelligence lives in ui-router-server; the worker's one job
// is verdict -> HTTP. Module scope: the mount tables compile once per isolate.
const router = createServerRouter({ mounts });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const verdict = await router.resolve(url);
    if (verdict.kind === 'shell') {
      // Constructing the shell request from the original carries the
      // conditional headers along, so deep-link revalidations still 304.
      const shell = await env.ASSETS.fetch(
        new Request(new URL(verdict.mount, request.url), request),
      );
      const headers = new Headers(shell.headers);
      headers.set('Link', `<${verdict.mount}>; rel="canonical"`);
      // Status precedence per the Verdict contract: absent (always, today)
      // means default shell handling, 304s included. When a data tier sets
      // an explicit status, this fetch must also strip the request's
      // validators so there is a 200 body to relabel — never a bare 304.
      return new Response(shell.body, {
        status: verdict.status ?? shell.status,
        headers,
      });
    }
    if (verdict.kind === 'redirect') {
      return new Response(null, {
        status: verdict.status,
        headers: { Location: mergeSearch(verdict.location, url.search) },
      });
    }
    // notFound: fall through to the assets binding's 404.html handling.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
```

That is the argument for the library-first shape: one verdict switch, and
every routing decision — mount ownership, matching, redirect evaluation —
lives in a package that node scripts, tests, and other servers call the same
way. The HTTP-specific touches are the worker's whole contribution: the
canonical `Link` header keeps crawlers from indexing every deep link as a
duplicate of the shell, and forwarding the original request preserves
conditional headers so revalidations still 304.

Cloudflare Workers
[static assets](https://developers.cloudflare.com/workers/static-assets/)
serve the built site; the worker script runs only where a routing decision is
needed ([`wrangler.jsonc`](https://github.com/simshanith/lit-ui-router/blob/main/wrangler.jsonc)):

```jsonc
{
  "main": "./docs/worker/index.ts",
  "assets": {
    "directory": "./docs/dist",
    "binding": "ASSETS",
    "not_found_handling": "404-page",
    // Only sample-app deep links invoke the worker; other misses serve 404.html.
    "run_worker_first": ["/app/*", "/app-mobx/*"],
  },
}
```

`run_worker_first` sends every request under the SPA mounts through the
worker — it has to see misses like `/app/definitely-not` to judge them —
while `not_found_handling: "404-page"` gives unmatched paths `404.html` with
a real 404 status. The patterns deliberately exclude the bare `/app`: every
docs link targets it, and routing it through the worker would make each one
pay the root rule's 302.

## Redirects: data until they need code

The redirect table takes two kinds of entry, both pure data:

- **`when()`-style rules** — `{ pattern, to }`, evaluated first, in
  declaration order. A string pattern compiles as a matcher pattern and its
  extracted params carry into the target; a `RegExp` contributes no params.
  The sample apps' root rule above is the canonical example.
- **Per-state `redirectTo`** — a route entry like
  `{ name: 'people', url: '/people', redirectTo: 'contacts' }` sends a URL
  landing on that state elsewhere, mirroring the router's `redirectTo`
  subset: a string target keeps the matched params, a `{ state, params }`
  target replaces them. Chains are followed; cycles are rejected at compile
  time.

That is the boundary: redirects expressible as **data** belong in the table.
Anything that needs **code** to decide — hooks, resolves, `redirectTo`
functions, injected services — is simulate-tier territory, and the sample
apps deliberately keep those decisions client-side instead.

Two contracts worth internalizing:

**Queries merge; they never concatenate.** A redirect target with declared
search params can format to a location that already carries a query, so
appending `url.search` would produce `?page=2?flag=1`. The worker uses the
package's `mergeSearch`: target params win, remaining request params append.
`/app/?flag=1` 302s to `/app/welcome?flag=1`. The matcher tier resolves
pathnames only — incoming search values never flow into redirect params.

**302, not 301.** The redirect table is configuration that changes with the
next deploy, and browsers cache 301s so aggressively that a mis-shipped
permanent redirect outlives the config that produced it. Verdicts fix
`status: 302`; a per-rule 301 for genuinely legacy moves would be a table
extension.

::: warning Path-mode guidance
Server redirects assume path-location clients. A
[hash-location](./location-plugins#hash-urls) app keeps its route state in
the fragment, which never reaches the server — `/app/#/contacts/3` is just
the path `/app/` — so a mount-root redirect rule would rewrite the visible
path on every entry. Hash-location apps should serve the shell at the mount
root instead. The sample apps switch location strategies at runtime, so
their hash-mode entry point is the bare `/app` — outside `run_worker_first` —
precisely to stay clear of the root rule.
:::

## Real 404s, per mount

A `notFound` verdict falls through to the assets binding, and
`not_found_handling: "404-page"` answers with the site's `404.html` and a
real 404 status. Try it: `/app/contacts/3/edit` is the shell,
`/app/contacts/3/edit/extra` is this site's 404.

`notFound.mount` is the hook for going further: when it is set, a mount owned
the path, so the worker can serve that app's own 404 page —
`ASSETS.fetch('<mount>/404.html')` re-wrapped with status 404 — and give the
user a way back into the app they were deep-linked into, instead of the
site-wide page. Everything the worker needs is already in the verdict.

## What the server can't see

**The fragment.** Hash URLs never leave the browser, so hash-mode deep links
are all the mount root server-side — see the path-mode caveat above.

**Client state.** Auth flags in `sessionStorage`, remembered navigation
targets, feature flags: none of it exists at the edge. Every routing decision
that depends on it stays out of the projection, and the shell verdict is the
degrade path — the client router re-runs the URL with its full configuration.
The simulate tier applies the same principle to itself: failed, timed-out, or
throwing simulations degrade to the shell, never to a wrong redirect or a
spurious 404.

**Trailing slashes are strict on both sides.** `/app/welcome/` 404s just as
the client would refuse to match it. If your client relaxes
[`strictMode`](https://ui-router.github.io/core/docs/latest/interfaces/_url_interface_.urlmatcherconfig.html),
pass the same relaxation as the mount's `config`.

**The 404 UX is asymmetric — by design.** Client-side navigation to an
unknown URL still renders the in-router [404 state](./unmatched-urls) (HTTP
200; no request is made), while a _direct load_ of the same URL gets the
server's 404 page instead of the shell. That is the goal: the app handles bad
links gracefully once loaded, and the server stops vouching for URLs that
don't exist.

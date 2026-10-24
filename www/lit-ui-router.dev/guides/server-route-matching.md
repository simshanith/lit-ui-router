---
title: Server-Side Routing
description: Serve routing verdicts at the edge with ui-router-server - the spectrum from zero server requirements to a shared router, every level live on this site
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
itself stays a thin consumer (the [package page](/packages/server) covers the
tiers, adapters, and status). This site runs the pattern in production, and
not just the destination: the Cloudflare Worker behind lit-ui-router.dev
serves the whole spectrum below, live and side by side, from the
platform-default fallback to a full headless router per request.

## The server-support spectrum

How much server does a single-page app need? It is a spectrum, not a
yes-or-no — running from location strategies that need no server at all to a
full-stack system where the same router executes on both sides. Each level
is defined by what the app asks of its server; find yours, and what moving
up would buy.

<!--@include: ../public/diagrams/server-route-matching-spectrum.svg-->

**Level 0 — memory location: no URL.** `memoryLocationPlugin` runs the
router with no address bar at all — tests, embedded widgets, headless
tooling. Nothing can be deep-linked, so there is no server story to need.

**Level 1 — hash location: any static host.** The URL lives in the
fragment, which never leaves the browser — by design. Zero server
requirements: any static file host suffices, and none of this guide's
machinery applies. Hash-mode apps are
[deliberately out of scope](#path-location-clients), not at risk.

**Level 2 — path location, platform-default fallback.** The moment routes
move into the path, every deep link reaches the server — and this is the
industry-default deployment for path-location SPAs. Serving the shell at
200 for every
unknown path is the one fallback every major router's deployment guide
prescribes
([Vue Router](https://router.vuejs.org/guide/essentials/history-mode.html)
says outright that "your server will no longer report 404 errors";
[React Router](https://reactrouter.com/how-to/spa) notes some hosts do it
by default; Angular documents the same rule), the out-of-the-box behavior
on platforms like
[Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/)
and
[Workers' single-page-application mode](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/),
and a documented one-liner everywhere else: nginx
`try_files $uri /index.html;`, a Netlify `/* /index.html 200` redirect. The
pattern even ships as a package —
[`connect-history-api-fallback`](https://npmx.dev/package/connect-history-api-fallback),
~14 million weekly downloads — and it is what this site itself shipped
before this stack.

Users get the right page; HTTP starts lying. This is the level where the
costs arrive: pages classified as
[soft 404s](https://support.google.com/webmasters/answer/7440203) drop out
of the index,
[crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget)
burns on garbage URLs, and legitimate pages risk misclassification
([HTTP status codes and Search](https://developers.google.com/search/docs/crawling-indexing/http-network-errors),
[John Mueller on soft-404s](https://johnmu.com/soft-404s-your-site/)).

Not every ecosystem starts here. SSR-default ecosystems launch at the far
end instead: Next.js and React Router's framework mode ship
[`ssr: true` by default](https://reactrouter.com/how-to/spa), making full
server routing the default launch state, with SPA mode as the documented
opt-out that lands on exactly level 2's `/* /index.html 200` rule.
[TanStack Start](https://tanstack.com/start) has the same shape around
TanStack Router's client-side matcher: server rendering by default, and an
[SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode)
that prerenders the root route to a `_shell.html` and rewrites every miss to
it. Same tools, both ends of the spectrum.

<FrameworkSpectrum />

<FrameworkCards />

**Level 3 — path location, static error rules.** The app needs honest
errors: a real 404 status with a helpful page. Ordinary hosting has
conventions for exactly that — nginx `error_page`, a `404.html` at the site
root — but a host that doesn't know the app's routes can only apply them to
asset misses; it cannot tell a deep link from a typo. The static page
itself stays valuable at every level above this one: it is a free
structural boundary for
[segregated 404 tracking](https://plausible.io/docs/error-pages-tracking-404),
and it serves scanners and typo probes a few bytes instead of an app.

**Level 4 — path location, route-aware server.** The missing piece: a
server that can tell the app's deep links from garbage. That was always
possible by hand — ops teams maintain nginx `location` and regex blocks,
Apache rewrites, or CDN rules that mirror the app's routes, re-synced
manually on every route change — so this is an old capability with a
maintenance problem, not a new capability. The shared route table attacks
the maintenance: it is a data projection of the app's own route
definitions ([the projection below](#the-projection-routes-as-data)),
exercised by the app's contract tests on every CI run — versus config in a
different language, in a different layer of the stack, verified by nobody.
Drift-resistant through a test-pinned seam, not drift-impossible — and it
expresses what static server rules cannot: parameterized matching with the
client's exact semantics, and redirect targets computed by `format()`.
Teach the server the routes — the package's dependency-free matcher tier,
pure data — and every answer becomes exact: the shell for real routes,
computed redirects, real 404s for everything else. This is this site's
flagship tier.

Whether the 404 body is the static page or the app shell rendering its own
404 view is a free choice at this level, and it is **not** an SEO question:
Google ignores the body content of 4xx responses outright. It is analytics
and weight — a shell-at-404 boots the whole app for every garbage probe and
mixes error views into entrance reports unless the error state opts out
(real-world,
[a 404 page has ranked as a site's second-highest landing page](https://www.searchviu.com/en/404-errors-google-analytics/)).
This site's flagships keep the static page.

**Level 5 — full-stack: the shared router.** The far end: the same router
executing server-side. The simulate tier replays every URL through a real
headless `@uirouter/core` router — redirect rules and `otherwise()` actually
run as rules, not reimplementations — and it is where routing that data
cannot express (hooks, resolves, auth-aware verdicts) will live.

### Live on this site

Every level from 1 up runs behind lit-ui-router.dev — same worker, same
`wrangler.jsonc`, the differences are configuration:

| Level | Mount(s)                                           | Behavior                                                                                                                                  |
| ----- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `/app-hash`                                        | Hash routing done right: the mount root serves the shell at **200** with no redirect, so the fragment survives entry; deep paths stay 404 |
| 2     | `/not-found-naive`                                 | Every path serves the shell at **200**, no route matching — the platform-default fallback, reproduced                                     |
| 3+4   | `/app`, `/app-mobx`, `/app-effect`, `/app-signals` | Route-aware verdicts: shell, 302, or a **real 404** with a per-mount static 404 page (the flagship)                                       |
| 4     | `/not-found-spa`                                   | Route-aware, shell-at-404: real routes serve **200**; a miss serves the shell at **404** and the client renders its in-app 404 view       |
| 5     | `/simulated-routing`                               | Every verdict computed by a **real headless router** replaying the URL                                                                    |

Try them on a URL that matches nothing:
<a href="/not-found-naive/no-such-page" target="_self">`/not-found-naive/no-such-page`</a>
answers 200 (the lie),
<a href="/app/no-such-page" target="_self">`/app/no-such-page`</a> is a real
404 page,
<a href="/not-found-spa/no-such-page" target="_self">`/not-found-spa/no-such-page`</a>
is a 404 whose body is the app itself rendering its 404 state, and
<a href="/simulated-routing/no-such-page" target="_self">`/simulated-routing/no-such-page`</a>
is a 404 decided by a real `otherwise()` rule settling inside a headless
router — while
<a href="/simulated-routing/" target="_self">`/simulated-routing/`</a> 302s to
`/simulated-routing/welcome` because a real `when()` rule ran. And
<a href="/app-hash/" target="_self">`/app-hash/`</a> does the opposite of a
flagship root — it serves the shell at **200**, un-redirected, because a hash
client carries its route in the fragment the server never sees.

Two honesty notes about the exhibits. Every **exhibit** response
(`/not-found-naive`, `/not-found-spa`, `/simulated-routing`) carries
`X-Robots-Tag: noindex`: the level-2 exhibit deliberately manufactures
soft-404s, and the site must not be penalized by its own teaching material.
And every exhibit mount serves the vanilla sample app's **one** shell, which
derives its base from `location.pathname` at boot against the prefix list in
[`shellMounts.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-routes/src/shellMounts.ts)
— so the client router strips that prefix and renders real routes under the
mount, exactly like the flagship. What makes them exhibits is
the **server** verdict each demonstrates (the soft-404 lie, shell-at-404, the
headless replay), not any client limitation; `noindex` simply keeps the
teaching material out of the search index. `/app-hash` keeps a build of its
own for hash mode: its `--mode hash` build bakes `<base href="/app-hash/">`
and the hash location plugin, so it is a fully working, indexable hash client
rather than an exhibit.

## Path-location clients

This machinery is for **path-location clients** — apps whose routes live in
the URL path and therefore reach the server on every deep link:
[`pushStateLocationPlugin`](./location-plugins#html5-pushstate), or its most
modern shape, this repo's own
[`ui-router-navigation-location-plugin`](/packages/navigation-plugin) companion
package, which produces the same clean paths through the Navigation API.
Path-addressed routes are the ones a server is asked to vouch for; that is
what earns them routing verdicts.

A [hash-location](./location-plugins#hash-urls) app needs none of this — by
design. The hash strategy exists to avoid server-side requirements: the
fragment never leaves the browser, so `/#/contacts/3` asks the server only
for `/`, and a plain 200 shell is the correct, complete server story. Even
the level-2 fallback above is a perfectly sound server for a hash-mode
app — the soft-404 concern is about path-addressed content, and a hash app
addresses nothing by path. If you route in the fragment, you are
deliberately out of scope here, not at risk.

## The package tiers

The package prices its capabilities as separate entry points, measured
min+gzip by its own esbuild probe:

| import                        | needs `@uirouter/core`?               | cost                                | what it answers                                                                        |
| ----------------------------- | ------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| `ui-router-server/matcher`    | no                                    | ~6.6 KiB min / ~2.9 KiB gzip        | does this pathname match this pattern, with which params — and the inverse, `format()` |
| `ui-router-server/redirects`  | no                                    | ~8.7 KiB min / ~3.6 KiB gzip        | given routes and a redirect table, where does this pathname go                         |
| `ui-router-server` (root)     | only when a `simulate` mount resolves | ~11.5 KiB min / ~4.7 KiB gzip       | mounts in, verdict out                                                                 |
| `ui-router-server/simulate`   | yes (optional peer)                   | +~92 KiB min / ~27.4 KiB gzip, lazy | what would the real router do                                                          |
| `ui-router-server/location`   | yes (optional peer)                   | ~0.5 KiB min / ~0.3 KiB gzip        | a path-shaped in-memory location for a server-side router                              |
| `ui-router-server/url-config` | no; it configures the router you pass | ~0.6 KiB min / ~0.4 KiB gzip        | one url config for the client router, the mounts, and a server render                  |

<!--@include: ../public/diagrams/server-route-matching-package-tiers.svg-->

The tiers' shape is measured, not aesthetic. Deep-importing
`@uirouter/core` internals carves a matching-only consumer from 43 KiB gzip
down to 14 — `UrlMatcher` and the param machinery sit near the leaves of
core's module graph — but it **cannot carve a headless router below the
~43 KiB floor**: everything substantive hangs off the `UIRouter` constructor,
and dropping the barrel imports sheds only empty re-export shims (~0.3 KiB).
So the dependency-free tiers are a standalone _port_ of the matching subset
(type-pinned to core's signatures, differential-tested against core's own
output), while the simulate tier carries core whole — behind a dynamic import
that bundles as a lazy chunk, so a matcher-only configuration never loads it.
That shape gives the matcher tier its contract: dependency-free, and held
to a borrowed size discipline — AWS CloudFront Functions' 10,240-byte
ceiling, the tightest edge-runtime budget around, which the package's
bundle checks log the matcher against and its ~6.6 KiB minified bundle
still clears. A discipline, not a deployment target: a working CloudFront
function already crowds that ceiling and grows with core fidelity, so the
plausible path there is generating a route-specific function from the same
route data, not shipping this bundle.

Picking a tier:

- **`/matcher`** — you have server code already and one question: does this
  path match, with which params. No route table, no verdicts.
- **`/redirects`** — pattern matching plus declarative redirect evaluation
  over a route table, without mount bookkeeping.
- **root** — the default. Mounts in, verdicts out; costs matcher-tier bytes
  until a mount opts into simulation.
- **`/simulate`** (or `strategy: 'simulate'` on a mount) — replay the URL
  through a real headless router: redirect rules and the `otherwise`
  projection register as real `when()`/`otherwise()` rules and a transition
  actually runs. Both strategies consume the same declaration subset and
  produce identical verdicts (the package tests assert parity), so
  `strategy` stays a pure cost knob until routing that data cannot express —
  hooks, resolves, `redirectTo` functions — arrives with a wider config.
  A simulate mount's `prewarm` count builds idle routers once core loads, so
  its first requests skip the cold build.
- **`/location`** — you drive a real `@uirouter/core` router yourself, on the
  server, and want its `href()`s to be paths rather than `#` fragments, so a
  server render's links match what a
  [pushState](./location-plugins#html5-pushstate) client writes.
  `installServerLocation(router, { url, baseHref, urlConfig })`.
- **`/url-config`** — you want the client router and the mounts to compile
  urls alike. `applyUrlConfig(router, config)` applies a mount's `config` to
  any `@uirouter/core` router before its states register; it imports no
  server code, so the client bundle can take it.

A `'matcher'` mount finds its route with a linear scan by default, trying
every pattern. `routeIndex: routeTrie` swaps in a segment trie that tries
only the routes whose segments fit the path, with the same verdicts, so a
path whose first segment no route declares runs no pattern at all. The trie
can't express a case-insensitive url config or a path param whose pattern
may match a `/` (such as `{path:.*}`). A mount that opts in with either
throws at construction, naming the route, and a `'simulate'` mount that
sets `routeIndex` throws too. A bundle only carries the trie if it imports
`routeTrie`. Whether it pays depends on the table: the `acceptance (bench)`
job summary times each of this site's mounts both ways, and the site stays
on the scan.

## The projection: routes as data

<!--@include: ../public/diagrams/server-route-matching-projection.svg-->

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
  // Url-less, as in main/states.ts: structural only — never matched, never a
  // redirect target — but declarable as an otherwise projection.
  { name: 'notFound' },
];
```

Dotted names nest and urls append, exactly as states do in the router:
`mymessages.messagelist.message` folds to `/mymessages/:folderId/:messageId`.
What the flagship config **leaves out** is as deliberate as what it
includes:

```ts
// Mirrors router.config.ts: the app root has no state url; a when(/^\/?$/)
// rule routes it to welcome. Its otherwise() -> notFound rule is deliberately
// NOT projected for the flagship mounts: unknown paths stay notFound verdicts
// (the not-found-static pattern) — 404 views stay out of entrance analytics
// and scanners get a few bytes; shell-at-404 is the /not-found-spa exhibit.
export const redirects: RedirectRule[] = [{ pattern: /^\/?$/, to: 'welcome' }];

// 'matcher': the tables above are pure data, so the dependency-free tier
// suffices. Routing the client decides conditionally (mymessages' DSR
// default, requiresAuth) is deliberately absent — the server must not pick a
// winner. If a rule ever needs hooks or resolves, flipping a mount to
// 'simulate' is config, not code.
const app: MountConfig = { routes, redirects, strategy: 'matcher' };
```

Three omissions to copy:

- **The client's `otherwise()` rule is a level choice.** The flagships don't
  project it, so unknown paths stay `notFound` verdicts and misses serve the
  static 404 page — the analytics case from
  [level 4](#the-server-support-spectrum). Projecting it is one line of
  config, shown on the `/not-found-spa` exhibit
  [below](#shell-at-404-the-otherwise-projection).
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

<!--@include: ../public/diagrams/server-route-matching-verdict-flow.svg-->

`createServerRouter` compiles and validates every mount at construction —
unknown redirect targets, cycles, and a bad `otherwise` target throw at
startup, never per-request — and the longest matching mount base owns a
pathname outright. A mount's bare base (`/app`) resolves the empty subpath,
so it 404s unless a `url: ''` route or a rule such as
`{ pattern: /^\/?$/, to: 'welcome' }` claims it. Construction
[warns in development](./development-builds#server-runtimes) for each mount
other than `/` that leaves it unclaimed. `resolve()` accepts a
pathname, an absolute URL string, or anything with a `pathname`:

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
  | { kind: 'notFound'; mount?: string };
```

`shell.status` follows a documented precedence: absent means default shell
handling, conditional 304s included; set — 404 from the `otherwise`
projection today, 401/403-with-shell for a future auth tier — it wins
outright, with consumer obligations covered
[below](#shell-at-404-the-otherwise-projection). `redirect.location` is the
mount-joined target path, and `notFound.mount` distinguishes "a mount owned
this path but nothing matched" from "no mount at all". `delegate` answers a
state that hands its url to a host handler
([delegating states](/packages/server#delegating-states)).

To catch an unclaimed bare base in CI rather than in a log, assert in a test
that
[`diagnoseMounts(router)`](/api/ui-router-server/index/functions/diagnoseMounts)
returns an empty array for a router built from the table. It returns the
findings the warning prints, in every build; `apps/sample-app-routes` runs that
assertion over the tables above.

A mount that means its bare base to 404 turns the finding off with
[`ignoreDiagnostics`](/api/ui-router-server/index/interfaces/MountConfig#ignorediagnostics);
the warning and `diagnoseMounts` both skip it for that mount.

## The worker: verdicts → HTTP

The worker
([`www/lit-ui-router.dev/worker/index.ts`](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/worker/index.ts))
builds the router from the `mounts` table once per isolate and fronts every
routed mount with a single call: `createFetchHandler` turns the router into a
`(Request) => Promise<Response | null>`, and the worker supplies only what the
generic adapter can't know. The adapter owns the
verdict → HTTP mechanics — status mapping, `mergeSearch` on redirect
`Location`s, stripping validators and relabelling status'd shells, and the
canonical `Link` header (status-less shells only — a 404 is not an alternate
representation of anything). The worker supplies the host IO (`serveShell` /
`serveNotFound` over `env.ASSETS`) and the site policy the adapter has no seam
for: the level-2 exhibit bypasses the adapter entirely (it demonstrates the
_absence_ of server routing), `shellPath` points the vanilla pushState mounts
at the one base-agnostic vanilla shell while every other mount serves its own,
and `withNoindex` quarantines the exhibits on the way out. A
`null` return is the adapter's pass-through — a path this router doesn't own —
served however the assets binding would. `Env` is generated by `wrangler types`
from the config's bindings, so the handler needs no hand-written environment
interface.

Cloudflare Workers
[static assets](https://developers.cloudflare.com/workers/static-assets/)
serve the built site; the worker script runs only where a routing decision is
needed ([`wrangler.jsonc`](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/wrangler.jsonc)):
it binds the built site as `ASSETS` with `not_found_handling: "404-page"` and
lists every mount prefix under `run_worker_first`.

`run_worker_first` sends every request under the mounts through the worker —
it has to see misses like `/app/definitely-not` to judge them — while
`not_found_handling: "404-page"` gives unmatched paths `404.html` with a
real 404 status. Every mount also lists its **bare** path, not just the `/*`
wildcard: `/*` matches `/app/foo` but not the bare `/app`, and the mount root
is exactly where a verdict differs from the plain asset — the flagship's
`/` → `welcome` 302, and `/app-hash`'s shell-at-200. Omit the bare path and
Cloudflare's `html_handling` answers before the worker runs, shadowing that
verdict. The exhibits list their bare paths for the same reason plus one more:
no asset exists there, so the whole prefix is the demo.

[How this site runs](../about-this-site) maps the rest of lit-ui-router.dev
around this worker: the static assets and the release-ledger worker.

The routing side stays light in production, too: the deployed worker —
handler, fetch adapter, the `mounts` table, and the headless router behind the
simulate mount — gzips to a small fraction of even the free plan's Workers
size limit. The dogfood measures itself: the site package's `bundle:worker`
task (a cached `wrangler deploy --dry-run`) prints the upload size, and
`codecov:bundle` sends the same bundle to Codecov's size tracking as
`docs-worker-esm`. The site itself ships as static assets through the
binding, outside that budget entirely.

### One request at a time

Each diagram follows one request through the four lanes in production.

#### Static page <span style="margin-left: 6px; padding: 0 6px; border-radius: 4px; font-family: var(--vp-font-family-mono); font-size: 12px; font-weight: 600; vertical-align: 2px; background: var(--vp-c-green-soft, rgba(16,185,129,0.14)); color: var(--vp-c-green-1, #18794e)">200</span>

Not a `run_worker_first` path, and the file exists. The worker never runs.

<!--@include: ../public/diagrams/server-route-matching-seq-1-static-page.svg-->

#### Static miss <span style="margin-left: 6px; padding: 0 6px; border-radius: 4px; font-family: var(--vp-font-family-mono); font-size: 12px; font-weight: 600; vertical-align: 2px; background: var(--vp-c-yellow-soft, rgba(234,179,8,0.14)); color: var(--vp-c-yellow-1, #915930)">404</span>

Not a `run_worker_first` path, and no file: `not_found_handling` serves the site’s `404.html`.

<!--@include: ../public/diagrams/server-route-matching-seq-2-static-miss.svg-->

#### App deep link <span style="margin-left: 6px; padding: 0 6px; border-radius: 4px; font-family: var(--vp-font-family-mono); font-size: 12px; font-weight: 600; vertical-align: 2px; background: var(--vp-c-green-soft, rgba(16,185,129,0.14)); color: var(--vp-c-green-1, #18794e)">200</span>

A route in a mount: the verdict is `shell`, and the worker fetches the app shell through `ASSETS`. A revalidation that gets a 304 passes it on.

<!--@include: ../public/diagrams/server-route-matching-seq-3-app-deep-link.svg-->

#### App redirect <span style="margin-left: 6px; padding: 0 6px; border-radius: 4px; font-family: var(--vp-font-family-mono); font-size: 12px; font-weight: 600; vertical-align: 2px; background: var(--vp-c-indigo-soft, rgba(100,108,255,0.14)); color: var(--vp-c-indigo-1, #3451b2)">302</span>

A redirect rule at the mount root: the verdict is `redirect`, and nothing is fetched from assets.

<!--@include: ../public/diagrams/server-route-matching-seq-4-app-redirect.svg-->

#### Unknown path, mount with `otherwise` <span style="margin-left: 6px; padding: 0 6px; border-radius: 4px; font-family: var(--vp-font-family-mono); font-size: 12px; font-weight: 600; vertical-align: 2px; background: var(--vp-c-yellow-soft, rgba(234,179,8,0.14)); color: var(--vp-c-yellow-1, #915930)">404</span>

`/not-found-spa` declares an `otherwise`, so the verdict is the shell with status 404. The shell request goes without validators, so assets answer with a full body, never a 304.

<!--@include: ../public/diagrams/server-route-matching-seq-5-unknown-path-otherwise.svg-->

#### Unknown path, mount without `otherwise` <span style="margin-left: 6px; padding: 0 6px; border-radius: 4px; font-family: var(--vp-font-family-mono); font-size: 12px; font-weight: 600; vertical-align: 2px; background: var(--vp-c-yellow-soft, rgba(234,179,8,0.14)); color: var(--vp-c-yellow-1, #915930)">404</span>

The verdict is `notFound` with a mount, and the worker serves that mount’s 404 page.

<!--@include: ../public/diagrams/server-route-matching-seq-6-unknown-path-no-otherwise.svg-->

#### No mount <span style="margin-left: 6px; padding: 0 6px; border-radius: 4px; font-family: var(--vp-font-family-mono); font-size: 12px; font-weight: 600; vertical-align: 2px; background: var(--vp-c-default-soft, rgba(142,150,170,0.14)); color: var(--vp-c-text-1, #3c3c43)">as served</span>

The pass-through, for a worker-first path no mount owns: the verdict is `notFound` without a mount, the adapter returns `null`, and the worker hands the request to `ASSETS` unchanged.

<!--@include: ../public/diagrams/server-route-matching-seq-7-no-mount.svg-->

`vitepress dev` sends the sample-app navigations through the same verdicts
with the `ui-router-server/vite` plugin, Vite standing in for Cloudflare and
the assets: the plugin answers a redirect itself, and for a shell or a
mount-owned 404 it rewrites the request to the HTML file and lets Vite serve
it, as the site's
[`.vitepress/vite.config.ts`](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/.vitepress/vite.config.ts)
sets up.

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
functions, injected services — is where the simulate tier is headed (a planned
`MountConfig` widening; not yet reachable in the verdict API), and the sample
apps deliberately keep those decisions client-side today.

Contracts worth internalizing:

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

**Mount-root rules are for path-mode entries.** Server redirects rewrite
the path, and a hash-location client keeps its route state where the server
never sees it — so don't declare a mount-root redirect rule for a mount that
serves hash-mode entries; the shell at the mount root already is hash mode's
[whole server story](#path-location-clients). That is exactly why hash mode
gets its own [`/app-hash` mount](#a-real-router-per-request) — a `url: ''` root
that serves shell-at-200 with no redirect — rather than riding the flagship's
`/` → `welcome` rule: a 302 at the root would strip the fragment the hash
client entered with.

## Shell-at-404: the `otherwise` projection

The `/not-found-spa` exhibit is the flagship `app` config plus one field:
`MountConfig.otherwise` projects the client's `otherwise()` rule, so its
entry in
[`routes.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-routes/src/routes.ts)
spreads the flagship config and adds `otherwise: { state: 'notFound' }`.

The semantics mirror the client rule they project. The target must be a
**declared, url-less** state — enforced at construction — for the same
reason the client's [404 state declares no `url`](./unmatched-urls#the-404-state):
the unmatched URL stays in the address bar, like a server-rendered 404 page.
A url-full target would move the client's address bar, and the honest
projection of _that_ is a redirect, not a shell-404 at the retained path.
Redirect rules and route matches take precedence, exactly as `otherwise()`
only fires after every registered rule has failed; unknown paths then
verdict as `{ kind: 'shell', status: 404 }` — the shell IS the error page,
never a 200 — and the client boots at the retained URL, where its own
`otherwise()` rule renders the rich notFound view.

A status'd shell puts two obligations on the server, both handled by the
fetch adapter: strip the request's validators (`If-None-Match`,
`If-Modified-Since`) before the assets fetch so it returns a 200 body to
relabel — never relabel a bare 304, which has no body (a 404 with a null
body is malformed) and would let a probe read cache freshness for a path
that doesn't exist — and emit no canonical `Link`.

## A real router per request

The far end of the spectrum swaps the evaluation engine while keeping the
same data: the `/simulated-routing` mount is the flagship route and redirect
tables plus the `otherwise` projection, with `strategy: 'simulate'`.

The `mounts` table in
[`routes.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-routes/src/routes.ts)
puts every level side by side: the flagship config mounted once per sample
app, plus the demo mounts — `/not-found-spa`, `/simulated-routing`, and
`/app-hash`. The hash demo is a single url-less root route (`url: ''`) with
`strict: false`: a hash client keeps its whole route in the fragment, so the
server only ever sees the bare mount (with or without a trailing slash) and
must serve the shell there at 200 with no redirect. Deep paths never occur
under a hash client, so they stay honest 404s. `/not-found-naive` has no
entry; it is the absence of routing config, served worker-side.

On a simulate mount nothing is approximated: the redirect table registers as
real `when()` rules, `otherwise` as a real `otherwise()` rule, and a
transition actually runs against a fresh in-memory router per request —
`/simulated-routing/` 302s because that transition redirected, and the 404
is a transition that settled on the `notFound` state. The cost is the full
core chunk plus per-request router construction, and it is small: measured
under `wrangler dev` (workerd), the first simulate request took 12.4 ms
total, warm ones ~5–6 ms, against ~3 ms for matcher verdicts. The level
earns its keep the day a redirect needs hooks, resolves, or a `redirectTo`
function — until then the flagships stay on the matcher tier and the switch
remains one word of config.

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

## Parameterized routes and soft 404s

The projection carries url **patterns**, not the records behind them. A
route like `{ name: 'sheet', url: '/sheet/:num' }` accepts any segment, so
`/sheet/99` earns a `shell` verdict and a 200 whether or not sheet 99
exists. The client boots, finds nothing, and renders its in-router
[404 state](./unmatched-urls) under a URL the server vouched for: the
[level-2 soft 404](#the-server-support-spectrum), reintroduced by the shape
of the app's own url. Every `:id` route ships it by default.

When the ids are known at build time, narrow the param to them. An inline
`{name:regexp}` placeholder replaces the default segment pattern:

```ts
const ids = ['1', '2A', '12i']; // build-time data: the sheets that exist

const routes: RouteDeclaration[] = [
  { name: 'sheet', url: `/sheet/{num:(?:${ids.join('|')})}` },
];
```

Now `/sheet/99` matches nothing and verdicts `notFound`, a real 404, while
`/sheet/2A` stays a shell. Keep the group non-capturing: the matcher wraps
each param's pattern in its own capture group. If ids can contain regex
metacharacters, escape each one before joining.

Matching is case-sensitive by default, so with cased ids `/sheet/2a` is now
a 404 too. When the lowercase form should reach the canonical url, add a
case-insensitive redirect rule per id:

```ts
const redirects: RedirectRule[] = ids.map((num) => ({
  pattern: new RegExp(`^/sheet/${num}$`, 'i'),
  to: { state: 'sheet', params: { num } },
}));
```

Rules run before route matching, so `/sheet/2a` 302s to `/sheet/2A`; the
canonical url matches its own rule too, but a redirect that lands where it
started is a no-op, and it stays a shell.

This only works for an id set the build can enumerate, and the narrowed
pattern is as current as the build that produced it. Ids that live in a
database or API stay `:num`: the shell verdict and the client's 404 state
are the correct degrade for what the server can't know.

## Links a server renderer can read

Everything above is the verdict for one URL. The links the page ships are the
other half, and the two directive forms differ there.
[`uiSref`](/api/reference/directives/uiSref) and
[`uiSrefActive`](/api/reference/directives/uiSrefActive) are element parts:
they sit on the element and write to it from the outside, which only a live
browser does. A server renderer runs `render()` and never `update()`, so what
it emits is an `<a>` with no `href` — and a static analyser reading the
template sees the same thing.

[`srefHref`](/api/reference/directives/srefHref),
[`srefAriaCurrent`](/api/reference/directives/srefAriaCurrent) and
[`srefActiveClass`](/api/reference/directives/srefActiveClass) bind from
inside the attribute they affect, so the `href` is a real attribute in the
template. A whole nav:

```ts
import { html, LitElement } from 'lit';
import { srefActiveClass, srefAriaCurrent, srefHref } from 'lit-ui-router';

class AppNav extends LitElement {
  render() {
    return html`<nav>
      ${['home', 'users', 'about'].map(
        (state) =>
          html`<a
            href=${srefHref(state)}
            class="nav-link ${srefActiveClass({ state, activeClasses: ['active'] })}"
            aria-current=${srefAriaCurrent({ state })}
            >${state}</a
          >`,
      )}
    </nav>`;
  }
}
```

While the router sits at `users`, that link is
`<a href="/users" class="nav-link active" aria-current="page">`; at
`users.detail` the `active` class stays and `aria-current` is gone, because
the token is exact-match only. The three are covered in
[Attribute-part forms](/api/#attribute-part-forms).

`srefHref`'s `render()` is a function of the router and its arguments alone —
it returns the `href` string, or `nothing` for a state with no url — and it
touches no DOM. It finds the router from its element in a browser and from the
render-scoped router described in
[The router on the server](#the-router-on-the-server) under `@lit-labs/ssr`.
What is left in `update()` is what genuinely needs the element: the click
handler and announcing the target to an enclosing container.

**With no router in reach all three return `noChange`**, which leaves the
attribute exactly as authored rather than clearing it: an `href` a server wrote
by another route survives hydration untouched, and the client takes over on the
first update that finds a router. Container mode — `srefActiveClass` with no
`state` — is the one shape that always lands there on the server, since the
enclosed links announce themselves through element events a server render has
no element to fire.

For the flip side — composing the active flag with `classMap` instead of
letting a directive own the `class` attribute — see
[`SrefStatusController`](./reactive-components#active-link-status).

## The router on the server

A router is easy to build on the server; handing it to the code that renders is
the hard part. In a browser every binding finds the router by asking its own
element — `<ui-router>` answers a
[`context-request`](/guides/reactive-components#router-discovery)
on the way up the tree. A server render has no tree to walk: the
renderer calls a directive's `render()` with no element behind it, so there is
nothing to dispatch from and nothing to listen on.

`lit-ui-router/context` answers that with two tree-less providers, and
[`ui-router-server/location`](/packages/server) supplies the location half — a
memory plugin in html5 mode, so `stateService.href()` builds the same path the
pushState client writes rather than the `#/…` form `memoryLocationPlugin`
returns.

```ts
import '@lit-labs/ssr/lib/install-global-dom-shim.js';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { installServerLocation } from 'ui-router-server/location';

const { UIRouterLit } = await import('lit-ui-router/pure');
const { provideRouter, withRouterSync } = await import('lit-ui-router/context');

// one router per request, at the url the request asked for, query included
const { pathname, search } = new URL(request.url);
const router = new UIRouterLit();
installServerLocation(router, {
  url: pathname + search,
  urlConfig: { strict: false },
});
states.forEach((state) => router.stateRegistry.register(state));
router.start();

const uninstall = provideRouter(globalThis.litServerRoot, router);
let markup: string;
try {
  markup = withRouterSync(router, () => collectResultSync(render(page())));
} finally {
  uninstall();
}
```

`withRouterSync(router, run)` is a synchronous slot, not an async context: it
sets a module-level variable, runs `run`, and restores the previous value in a
`finally`. That is enough because `render()` from `@lit-labs/ssr` is a _sync
generator_ — consume it inside `run` with `collectResultSync` and every
directive's `render()` has already happened by the time `withRouterSync`
returns, `getScopedRouter()` reading the router each time. Return a promise from
`run` instead and you get a `TypeError` rather than a router that silently went
missing; the `Sync` suffix names the constraint the guard enforces. An async
variant is a separate export.

`provideRouter(root, router)` is the other half: it answers the
`context-request` protocol on any `EventTarget`, which on the server means
`globalThis.litServerRoot`, the bottom of the renderer's event-target stack. Use
it for elements that ask for their router by protocol — the same code path
`<ui-router>` serves in a browser — and pair it with `withRouterSync` when the
same render also contains attribute bindings. It returns its own uninstall
function; call it in a `finally` once the render is done, or a throwing render
leaves the listener behind for the next request.

`serverLocationPlugin` from the same `ui-router-server/location` entry is the
plugin `installServerLocation` installs, for a render that wires the rest by
hand.

[`lit-ui-router-ssr`](/packages/ssr) packages this hand-off: it owns the
`@lit-labs/ssr` call, the `provideRouter`/`withRouterSync` pairing, and the
`finally` — so a build that prerenders a whole mount table writes none of the
above by hand. [The Altitude Atlas](https://atlas.lit-ui-router.dev) prerenders
every page this way, and on each render reads a `lit-ui-router-effect`
`RouterRefController` under `withRouterSync` to check it sees the settled route.

**The attribute directives read the slot.** `srefHref`, `srefActiveClass` and
`srefAriaCurrent` have no element to seek from, so they take the router
`withRouterSync` scoped and nothing else: a `provideRouter` on the render root
serves elements, not attribute parts. A nav rendered inside `withRouterSync`
ships the real `href`, the `active` and exact classes, and `aria-current` for
the state the request settled on — the markup the client would paint first, so
hydration has nothing to correct.

## What the server can't see

**The fragment.** The server never sees it — which is exactly why a
[hash-location app needs no verdicts at all](#path-location-clients). For a
path-location app the fragment carries no routing state, so nothing is lost.

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
pass the same relaxation as the mount's `config`: keep one config object and
hand it to both the mount and
[`applyUrlConfig`](/api/ui-router-server/url-config/functions/applyUrlConfig)
on the client router, which throws if a state's url already compiled. A
static host that serves `<subpath>/index.html` by redirecting onto the
slashed url makes that relaxation mandatory — see
[static hosts add a trailing slash](/packages/ssr#static-hosts-add-a-trailing-slash).

**The 404 UX is asymmetric — by design.** With the flagship pattern,
client-side navigation to an unknown URL still renders the in-router
[404 state](./unmatched-urls) (HTTP 200; no request is made), while a
_direct load_ of the same URL gets the server's 404 page instead of the
shell. That is the goal: the app handles bad links gracefully once loaded,
and the server stops vouching for URLs that don't exist. The shell-at-404
level trades that asymmetry away — both paths land in the in-app 404 view,
and HTTP stays honest either way.

**The rendered content.** Everything above is the routing verdict — the
status, redirect, and 404 a URL earns from the same route table the client
runs — and deliberately not the page body. That is the line between
HTTP-semantics SEO, which this guide delivers, and content SEO: a rendered
body a crawler can read. Rendering is a second, orthogonal axis on the same
routing spine, which returns the identical verdict at every setting. Left
alone, `ui-router-server` sits at that axis's first setting —
**client-rendered**, the shell hydrating in the browser, so a crawler loading
a real route gets a correct 200 over an empty shell.
[`lit-ui-router-ssr`](/packages/ssr) is the next setting: it consumes these
same verdicts and renders each one to a static html file at build time.

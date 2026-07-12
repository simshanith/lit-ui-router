---
title: Server-Side Routing
description: Serve routing verdicts at the edge with ui-router-server - the 404-handling ladder from soft-404s to a simulated router, every rung live on this site
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
itself stays a thin consumer. This site runs the pattern in production, and
not just the destination: the Cloudflare Worker behind lit-ui-router.dev
serves **every rung of the adoption ladder below, live and side by side**,
from the anti-pattern to a full headless router per request.

## The 404 ladder

Each rung is a mount on this site — same worker, same `wrangler.jsonc`, the
differences are configuration:

| Rung                  | Mount(s)             | Server behavior                                                                                                                            |
| --------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **not-found-naive**   | `/not-found-naive`   | The classic SPA-host fallback: every path serves the shell at **200**, no route matching at all                                            |
| **not-found-static**  | `/app`, `/app-mobx`  | Route-matched + declarative redirects; unknown paths get a **static 404 page** (this site's flagship)                                      |
| **not-found-spa**     | `/not-found-spa`     | The `otherwise` projection: unknown paths serve the shell at an **honest 404**; the client renders its in-app 404 view at the retained URL |
| **simulated-routing** | `/simulated-routing` | `strategy: 'simulate'`: every verdict computed by a **real headless router** replaying the URL                                             |
| _full-stack_          | _(future)_           | auth-aware verdicts (401/403-with-shell)                                                                                                   |

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
`/simulated-routing/welcome` because a real `when()` rule ran.

The naive rung is not a straw man: it is
[Cloudflare's own single-page-application mode](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
— the platform default for SPAs — and it is what this site itself shipped
before this stack.

Two honesty notes about the exhibits. Every demo-mount response carries
`X-Robots-Tag: noindex`: the naive rung deliberately manufactures soft-404s,
and the site must not be penalized by its own teaching material. And the
demo mounts alias the vanilla sample app's shell (they have no build of
their own), which works because the built shell's asset URLs are absolute —
but the shell also bakes `<base href="/app/">`, so the client router cannot
match deep links under a foreign prefix. Full client-side parity on a demo
mount would need a per-prefix shell build; the exhibits instead teach
**server** semantics and stay quarantined from crawlers.

## Choosing a rung: SEO and analytics

Google's soft-404 machinery penalizes exactly one rung — the naive 200+shell
baseline: pages classified as
[soft 404s](https://support.google.com/webmasters/answer/7440203) drop out of
the index,
[crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget)
burns on garbage URLs, and legitimate pages risk misclassification
([HTTP status codes and Search](https://developers.google.com/search/docs/crawling-indexing/http-network-errors),
[John Mueller on soft-404s](https://johnmu.com/soft-404s-your-site/)).

Between the honest rungs, crawlers cannot tell the difference: Google
ignores the body content of 4xx responses outright, so a static 404 page and
a shell-at-404 are equally clean SEO. Static-versus-shell is an analytics
and weight question instead:

- a static page is a free structural boundary for
  [segregated 404 tracking](https://plausible.io/docs/error-pages-tracking-404),
  and serves scanners and typo probes a few bytes instead of an app;
- a shell-at-404 boots the whole app for every garbage probe and mixes error
  views into entrance reports unless the error state opts out — real-world,
  [a 404 page has ranked as a site's second-highest landing page](https://www.searchviu.com/en/404-errors-google-analytics/).

That is why this site's flagship mounts stay on the static rung; SEO alone
condemns only the naive one.

## The package tiers

The package prices its capabilities as separate entry points, measured
min+gzip by its own esbuild probe:

| import                       | needs `@uirouter/core`?               | cost            | what it answers                                                                        |
| ---------------------------- | ------------------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| `ui-router-server/matcher`   | no                                    | 2.7 KiB         | does this pathname match this pattern, with which params — and the inverse, `format()` |
| `ui-router-server/redirects` | no                                    | 3.4 KiB         | given routes and a redirect table, where does this pathname go                         |
| `ui-router-server` (root)    | only when a `simulate` mount resolves | 4.1 KiB         | mounts in, verdict out                                                                 |
| `ui-router-server/simulate`  | yes (optional peer)                   | +27.3 KiB, lazy | what would the real router do                                                          |

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









```

Three omissions to copy:

- **The client's `otherwise()` rule is a rung choice.** The flagships don't
  project it, so unknown paths stay `notFound` verdicts and misses serve the
  static 404 page — the analytics case [above](#choosing-a-rung-seo-and-analytics).
  Projecting it is one line of config, shown on the `/not-found-spa` rung
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

`createServerRouter` compiles and validates every mount at construction —
unknown redirect targets, cycles, and a bad `otherwise` target throw at
startup, never per-request — and the longest matching mount base owns a
pathname outright. `resolve()` accepts a pathname, an absolute URL string,
or anything with a `pathname`:

```ts
type Verdict =
  | { kind: 'shell'; mount: string; status?: number }
  | { kind: 'redirect'; mount: string; location: string; status: number }
  | { kind: 'notFound'; mount?: string 
```

`shell.status` follows a documented precedence: absent means default shell
handling, conditional 304s included; set — 404 from the `otherwise`
projection today, 401/403-with-shell for a future auth tier — it wins
outright, with consumer obligations covered
[below](#shell-at-404-the-otherwise-projection). `redirect.location` is the
mount-joined target path, and `notFound.mount` distinguishes "a mount owned
this path but nothing matched" from "no mount at all".

## The worker: verdicts → HTTP

The whole handler
([`docs/worker/index.ts`](https://github.com/simshanith/lit-ui-router/blob/main/docs/worker/index.ts)):

```ts
import { mounts } from 'sample-app-routes';
import { createServerRouter, mergeSearch } from 'ui-router-server';

// All routing intelligence lives in ui-router-server; the worker's one job
// is verdict -> HTTP. Module scope: the mount tables compile once per isolate.
const router = createServerRouter({ mounts });

// The 404-pattern exhibit mounts have no shell asset of their own — they
// serve the vanilla app's (its asset urls are absolute, so the shell works
// under any prefix). Mounts without an alias serve the shell at their base.
const SHELL_PATHS: Record<string, string> = {
  '/not-found-spa': '/app',
  '/simulated-routing': '/app',


// Every exhibit response carries noindex: the naive rung deliberately serves
// soft-404s, and the site must not be penalized by its own teaching material.
const EXHIBITS = new Set([
  '/not-found-naive',
  '/not-found-spa',
  '/simulated-routing',
]);
const noindexed = (mount: string, headers: Headers): Headers => {
  if (EXHIBITS.has(mount)) headers.set('X-Robots-Tag', 'noindex');
  return headers;


// The not-found-naive exhibit: the classic SPA-host fallback — every path
// serves the shell at 200, no route matching at all (the soft-404
// anti-pattern baseline, and what this site itself shipped before this
// stack). It bypasses resolve() deliberately: the rung demonstrates the
// ABSENCE of server routing.
const NAIVE_MOUNT = '/not-found-naive';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      url.pathname === NAIVE_MOUNT ||
      url.pathname.startsWith(`${NAIVE_MOUNT}/`)
    ) {
      const shell = await env.ASSETS.fetch(
        new Request(new URL('/app', request.url), request),
      );
      return new Response(shell.body, {
        status: shell.status,
        headers: noindexed(NAIVE_MOUNT, new Headers(shell.headers)),
      });
    }
    const verdict = await router.resolve(url);
    if (verdict.kind === 'shell') {
      // Constructing the shell request from the original carries the
      // conditional headers along, so deep-link revalidations still 304.
      const shellRequest = new Request(
        new URL(SHELL_PATHS[verdict.mount] ?? verdict.mount, request.url),
        request,
      );
      // Status precedence per the Verdict contract: absent means default
      // shell handling, 304s included. An explicit status (404 via the
      // otherwise projection) wins outright, and the validators must go so
      // the fetch returns a 200 body to relabel — never a bare 304.
      if (verdict.status !== undefined) {
        shellRequest.headers.delete('If-None-Match');
        shellRequest.headers.delete('If-Modified-Since');
      }
      const shell = await env.ASSETS.fetch(shellRequest);
      const headers = noindexed(verdict.mount, new Headers(shell.headers));
      // No canonical Link on status'd shells: a 404 is not an alternate
      // representation of the mount root.
      if (verdict.status === undefined)
        headers.set('Link', `<${verdict.mount}>; rel="canonical"`);
      return new Response(shell.body, {
        status: verdict.status ?? shell.status,
        headers,
      });
    }
    if (verdict.kind === 'redirect') {
      const headers = new Headers({
        Location: mergeSearch(verdict.location, url.search),
      });
      return new Response(null, {
        status: verdict.status,
        headers: noindexed(verdict.mount, headers),
      });
    }
    // notFound: fall through to the assets binding's 404.html handling.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
```

The flagship path through the handler is still just the verdict switch:
resolve, then shell / redirect / notFound become HTTP. Everything else is
the ladder living in one worker — the naive rung bypasses `resolve()` on
purpose (it demonstrates the _absence_ of server routing), `SHELL_PATHS`
aliases the vanilla shell under the exhibit prefixes, and `noindexed`
quarantines the exhibits. The worker's own HTTP contributions: the canonical
`Link` header keeps crawlers from indexing every deep link as a duplicate of
the shell (status-less shells only — a 404 is not an alternate
representation of anything), and forwarding the original request preserves
conditional headers so revalidations still 304. `Env` is generated by
`wrangler types` from the config's bindings, so the handler needs no
hand-written environment interface.

Cloudflare Workers
[static assets](https://developers.cloudflare.com/workers/static-assets/)
serve the built site; the worker script runs only where a routing decision is
needed ([`wrangler.jsonc`](https://github.com/simshanith/lit-ui-router/blob/main/wrangler.jsonc)):

```jsonc
// https://developers.cloudflare.com/workers/static-assets/configuration/
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "lit-ui-router",
  "compatibility_date": "2026-07-01",
  "main": "./docs/worker/index.ts",
  "assets": {
    "directory": "./docs/dist",
    "binding": "ASSETS",
    "not_found_handling": "404-page",
    // Sample-app deep links and the 404-pattern exhibits invoke the worker;
    // other misses serve 404.html. Exhibits include their bare paths — no
    // asset exists there, and the whole prefix is the demo.
    "run_worker_first": [
      "/app/*",
      "/app-mobx/*",
      "/not-found-naive",
      "/not-found-naive/*",
      "/not-found-spa",
      "/not-found-spa/*",
      "/simulated-routing",
      "/simulated-routing/*",
    ],
  },
}
```

`run_worker_first` sends every request under the mounts through the worker —
it has to see misses like `/app/definitely-not` to judge them — while
`not_found_handling: "404-page"` gives unmatched paths `404.html` with a
real 404 status. The flagship patterns deliberately exclude the bare `/app`:
every docs link targets it, and routing it through the worker would make
each one pay the root rule's 302. The exhibits include their bare paths
because no asset exists there — the whole prefix is the demo.

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

## Shell-at-404: the `otherwise` projection

The `/not-found-spa` rung is one config line: `MountConfig.otherwise`
projects the client's `otherwise()` rule
([`routes.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-routes/src/routes.ts)):

```ts











```

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

A status'd shell puts two obligations on the consumer, both visible in the
worker above: strip the request's validators (`If-None-Match`,
`If-Modified-Since`) before the assets fetch so it returns a 200 body to
relabel — never relabel a bare 304, which has no body (a 404 with a null
body is malformed) and would let a probe read cache freshness for a path
that doesn't exist — and emit no canonical `Link`.

## A real router per request

The last shipped rung swaps the evaluation engine while keeping the same
data, plus the mount table that puts every rung side by side:

```ts














};
};
};
};
};
};
};
};
};
};
};

```

On a simulate mount nothing is approximated: the redirect table registers as
real `when()` rules, `otherwise` as a real `otherwise()` rule, and a
transition actually runs against a fresh in-memory router per request —
`/simulated-routing/` 302s because that transition redirected, and the 404
is a transition that settled on the `notFound` state. The cost is the full
core chunk plus per-request router construction, and it is small: measured
under `wrangler dev` (workerd), the first simulate request took 12.4 ms
total, warm ones ~5–6 ms, against ~3 ms for matcher verdicts. The rung earns
its keep the day a redirect needs hooks, resolves, or a `redirectTo`
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

**The 404 UX is asymmetric — by design.** With the flagship pattern,
client-side navigation to an unknown URL still renders the in-router
[404 state](./unmatched-urls) (HTTP 200; no request is made), while a
_direct load_ of the same URL gets the server's 404 page instead of the
shell. That is the goal: the app handles bad links gracefully once loaded,
and the server stops vouching for URLs that don't exist. The `otherwise`
rung trades that asymmetry away — both paths land in the in-app 404 view,
and HTTP stays honest either way.

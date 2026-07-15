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
itself stays a thin consumer. This site runs the pattern in production, and
not just the destination: the Cloudflare Worker behind lit-ui-router.dev
serves the whole spectrum below, live and side by side, from the
platform-default fallback to a full headless router per request.

## The server-support spectrum

How much server does a single-page app need? It is a spectrum, not a
yes-or-no — running from location strategies that need no server at all to a
full-stack system where the same router executes on both sides. Each level
is defined by what the app asks of its server; find yours, and what moving
up would buy.

<svg viewBox="0 0 720 414" width="100%" style="max-width: 720px" role="img" aria-label="The server-support spectrum: six levels from memory location (no server story) up to a full-stack shared router, with the live mounts on lit-ui-router.dev" xmlns="http://www.w3.org/2000/svg">
  <title>The server-support spectrum</title>
  <defs>
    <marker id="arr-spectrum" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0L8 4L0 8z" fill="var(--vp-c-text-3, #929295)" />
    </marker>
  </defs>
  <g font-family="var(--vp-font-family-base, ui-sans-serif, system-ui, sans-serif)">
    <!-- legend -->
    <rect x="404" y="6" width="10" height="10" rx="3" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" stroke="var(--vp-c-brand-1, #3451b2)" stroke-width="0.75" />
    <text x="420" y="15" font-size="11" fill="var(--vp-c-text-3, #929295)">= live mount on lit-ui-router.dev</text>
    <!-- axis -->
    <line x1="24" y1="400" x2="24" y2="34" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-spectrum)" />
    <text x="-214" y="18" font-size="11" fill="var(--vp-c-text-3, #929295)" transform="rotate(-90)">what the app asks of its server</text>
    <!-- L5 -->
    <rect x="48" y="28" width="656" height="54" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <rect x="60" y="41" width="28" height="28" rx="14" fill="var(--vp-c-bg, #ffffff)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="74" y="60" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)" text-anchor="middle">5</text>
    <text x="102" y="49" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Path &#183; full-stack shared router</text>
    <text x="102" y="68" font-size="12" fill="var(--vp-c-text-2, #67676c)">a real headless router replays every URL server-side</text>
    <rect x="559" y="44" width="133" height="20" rx="6" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" />
    <text x="625" y="58" font-size="11" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="middle">/simulated-routing</text>
    <!-- L4 (flagship) -->
    <rect x="48" y="90" width="656" height="54" rx="8" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" stroke="var(--vp-c-brand-1, #3451b2)" />
    <rect x="60" y="103" width="28" height="28" rx="14" fill="var(--vp-c-bg, #ffffff)" stroke="var(--vp-c-brand-1, #3451b2)" />
    <text x="74" y="122" font-size="13" font-weight="600" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="middle">4</text>
    <text x="102" y="111" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Path &#183; route-aware server</text>
    <text x="102" y="130" font-size="12" fill="var(--vp-c-text-2, #67676c)">the server knows the routes: shells, redirects, real 404s</text>
    <text x="692" y="107" font-size="11" font-weight="600" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="end">&#9733; flagship</text>
    <rect x="460" y="116" width="40" height="18" rx="6" fill="var(--vp-c-bg, #ffffff)" stroke="var(--vp-c-brand-1, #3451b2)" stroke-width="0.75" />
    <text x="480" y="129" font-size="11" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="middle">/app</text>
    <rect x="506" y="116" width="74" height="18" rx="6" fill="var(--vp-c-bg, #ffffff)" stroke="var(--vp-c-brand-1, #3451b2)" stroke-width="0.75" />
    <text x="543" y="129" font-size="11" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="middle">/app-mobx</text>
    <rect x="586" y="116" width="106" height="18" rx="6" fill="var(--vp-c-bg, #ffffff)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="639" y="129" font-size="11" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="middle">/not-found-spa</text>
    <!-- L3 -->
    <rect x="48" y="152" width="656" height="54" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <rect x="60" y="165" width="28" height="28" rx="14" fill="var(--vp-c-bg, #ffffff)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="74" y="184" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)" text-anchor="middle">3</text>
    <text x="102" y="173" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Path &#183; static error rules</text>
    <text x="102" y="192" font-size="12" fill="var(--vp-c-text-2, #67676c)">honest 404s, but only for asset misses &#8212; can't judge deep links</text>
    <text x="692" y="185" font-size="11" fill="var(--vp-c-text-3, #929295)" text-anchor="end">per-mount 404.html</text>
    <!-- L2 -->
    <rect x="48" y="214" width="656" height="54" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <rect x="60" y="227" width="28" height="28" rx="14" fill="var(--vp-c-bg, #ffffff)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="74" y="246" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)" text-anchor="middle">2</text>
    <text x="102" y="235" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Path &#183; platform-default fallback</text>
    <text x="102" y="254" font-size="12" fill="var(--vp-c-text-2, #67676c)">every path answers 200 with the shell &#8212; HTTP lies (soft-404s)</text>
    <rect x="572" y="224" width="120" height="20" rx="6" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" />
    <text x="632" y="238" font-size="11" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="middle">/not-found-naive</text>
    <text x="692" y="260" font-size="11" font-weight="600" fill="var(--vp-c-red-1, #b8272c)" text-anchor="end">200 for everything</text>
    <!-- L1 -->
    <rect x="48" y="276" width="656" height="54" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <rect x="60" y="289" width="28" height="28" rx="14" fill="var(--vp-c-bg, #ffffff)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="74" y="308" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)" text-anchor="middle">1</text>
    <text x="102" y="297" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Hash location</text>
    <text x="102" y="316" font-size="12" fill="var(--vp-c-text-2, #67676c)">the fragment never leaves the browser &#8212; any static host suffices</text>
    <text x="692" y="309" font-size="11" fill="var(--vp-c-text-3, #929295)" text-anchor="end">out of scope &#8212; by design</text>
    <!-- L0 -->
    <rect x="48" y="338" width="656" height="54" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <rect x="60" y="351" width="28" height="28" rx="14" fill="var(--vp-c-bg, #ffffff)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="74" y="370" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)" text-anchor="middle">0</text>
    <text x="102" y="359" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Memory location</text>
    <text x="102" y="378" font-size="12" fill="var(--vp-c-text-2, #67676c)">no URL, no address bar &#8212; tests, embedded widgets, headless tooling</text>
    <text x="692" y="371" font-size="11" fill="var(--vp-c-text-3, #929295)" text-anchor="end">no server story to need</text>
  </g>
</svg>

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
[`connect-history-api-fallback`](https://www.npmjs.com/package/connect-history-api-fallback),
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
opt-out that lands on exactly level 2's `/* /index.html 200` rule. Same
tools, both ends of the spectrum.

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

| Level | Mount(s)             | Behavior                                                                                                                                  |
| ----- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `/app-hash`          | Hash routing done right: the mount root serves the shell at **200** with no redirect, so the fragment survives entry; deep paths stay 404 |
| 2     | `/not-found-naive`   | Every path serves the shell at **200**, no route matching — the platform-default fallback, reproduced                                     |
| 3+4   | `/app`, `/app-mobx`  | Route-aware verdicts: shell, 302, or a **real 404** with a per-mount static 404 page (the flagship)                                       |
| 4     | `/not-found-spa`     | Route-aware, shell-at-404: the `otherwise` projection; the client renders its in-app 404 at the retained URL                              |
| 5     | `/simulated-routing` | Every verdict computed by a **real headless router** replaying the URL                                                                    |

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
And those exhibit mounts alias the vanilla sample app's shell (they have no
build of their own), which works because the built shell's asset URLs are
absolute — but the shell also bakes `<base href="/app/">`, so the client
router cannot match deep links under a foreign prefix; they teach **server**
semantics and stay quarantined from crawlers. `/app-hash` is the exception
that proves the rule: it has its own `--mode hash` build with
`<base href="/app-hash/">` baked in, so it is a fully working, indexable hash
client, not an exhibit.

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

| import                       | needs `@uirouter/core`?               | cost            | what it answers                                                                        |
| ---------------------------- | ------------------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| `ui-router-server/matcher`   | no                                    | 2.7 KiB         | does this pathname match this pattern, with which params — and the inverse, `format()` |
| `ui-router-server/redirects` | no                                    | 3.4 KiB         | given routes and a redirect table, where does this pathname go                         |
| `ui-router-server` (root)    | only when a `simulate` mount resolves | 4.1 KiB         | mounts in, verdict out                                                                 |
| `ui-router-server/simulate`  | yes (optional peer)                   | +27.3 KiB, lazy | what would the real router do                                                          |

<svg viewBox="0 0 720 248" width="100%" style="max-width: 720px" role="img" aria-label="Package tiers by size: matcher 2.7 KiB, redirects 3.4 KiB, root 4.1 KiB - all dependency-free - and simulate, which adds a lazy 27.3 KiB chunk carrying @uirouter/core" xmlns="http://www.w3.org/2000/svg">
  <title>The package tiers, to scale</title>
  <g font-family="var(--vp-font-family-base, ui-sans-serif, system-ui, sans-serif)">
    <!-- dependency-free group -->
    <rect x="8" y="10" width="704" height="138" rx="8" fill="none" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="700" y="27" font-size="11" font-weight="600" fill="var(--vp-c-text-2, #67676c)" text-anchor="end">no @uirouter/core needed</text>
    <text x="700" y="41" font-size="10" fill="var(--vp-c-text-3, #929295)" text-anchor="end">a differential-tested port of core's matching subset</text>
    <text x="20" y="60" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-1, #3c3c43)">ui-router-server/matcher</text>
    <rect x="230" y="50" width="41" height="16" rx="4" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" stroke="var(--vp-c-brand-1, #3451b2)" stroke-width="0.75" />
    <text x="279" y="63" font-size="11" fill="var(--vp-c-text-2, #67676c)"><tspan font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">2.7 KiB</tspan> &#183; does this path match, with which params &#8212; and format()</text>
    <text x="20" y="92" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-1, #3c3c43)">ui-router-server/redirects</text>
    <rect x="230" y="82" width="51" height="16" rx="4" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" stroke="var(--vp-c-brand-1, #3451b2)" stroke-width="0.75" />
    <text x="289" y="95" font-size="11" fill="var(--vp-c-text-2, #67676c)"><tspan font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">3.4 KiB</tspan> &#183; + declarative redirect evaluation over a route table</text>
    <text x="20" y="124" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-1, #3c3c43)">ui-router-server</text>
    <rect x="230" y="114" width="62" height="16" rx="4" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" stroke="var(--vp-c-brand-1, #3451b2)" stroke-width="0.75" />
    <text x="300" y="127" font-size="11" fill="var(--vp-c-text-2, #67676c)"><tspan font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">4.1 KiB</tspan> &#183; mounts in, verdicts out &#8212; the default</text>
    <!-- simulate group -->
    <rect x="8" y="158" width="704" height="74" rx="8" fill="none" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="700" y="171" font-size="11" font-weight="600" fill="var(--vp-c-purple-1, #8e18aa)" text-anchor="end">needs @uirouter/core &#8212; optional peer</text>
    <text x="20" y="196" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-1, #3c3c43)">ui-router-server/simulate</text>
    <rect x="230" y="186" width="62" height="16" rx="4" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" stroke="var(--vp-c-brand-1, #3451b2)" stroke-width="0.75" />
    <rect x="294" y="186" width="408" height="16" rx="4" fill="var(--vp-c-purple-soft, rgba(159,122,234,0.14))" stroke="var(--vp-c-purple-1, #8e18aa)" stroke-width="0.75" stroke-dasharray="5 3" />
    <text x="498" y="199" font-size="11" font-weight="600" fill="var(--vp-c-purple-1, #8e18aa)" text-anchor="middle">+27.3 KiB &#183; lazy chunk &#8212; core, whole</text>
    <text x="230" y="222" font-size="10" fill="var(--vp-c-text-3, #929295)">loads only when a simulate mount resolves &#8212; a matcher-only configuration never fetches it</text>
    <!-- scale note -->
    <text x="712" y="244" font-size="10" fill="var(--vp-c-text-3, #929295)" text-anchor="end">min+gzip, measured by the package's own esbuild probe &#183; linear scale</text>
  </g>
</svg>

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

<svg viewBox="0 0 720 340" width="100%" style="max-width: 720px" role="img" aria-label="The projection: the client app's url-bearing states are projected into a pure-data route table in sample-app-routes, which the edge worker imports; components and conditional routing deliberately stay client-side, and contract tests pin the projection on every CI run" xmlns="http://www.w3.org/2000/svg">
  <title>Routes as data: the projection</title>
  <defs>
    <marker id="arr-proj" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0L8 4L0 8z" fill="var(--vp-c-text-3, #929295)" />
    </marker>
  </defs>
  <g font-family="var(--vp-font-family-base, ui-sans-serif, system-ui, sans-serif)">
    <!-- client panel -->
    <rect x="16" y="28" width="216" height="230" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="32" y="52" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Client app</text>
    <text x="32" y="68" font-size="10" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-3, #929295)">sample-app &#183; states.ts</text>
    <!-- projected rows -->
    <rect x="28" y="80" width="192" height="22" rx="5" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" />
    <text x="36" y="95" font-size="11" fill="var(--vp-c-brand-1, #3451b2)">url-bearing states</text>
    <rect x="28" y="106" width="192" height="22" rx="5" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" />
    <text x="36" y="121" font-size="11" fill="var(--vp-c-brand-1, #3451b2)">root redirect &#8212; when(/^\/?$/)</text>
    <line x1="28" y1="140" x2="220" y2="140" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="220" y="154" font-size="10" font-style="italic" fill="var(--vp-c-text-3, #929295)" text-anchor="end">deliberately stays client-side</text>
    <text x="36" y="174" font-size="11" fill="var(--vp-c-text-2, #67676c)">components &#8212; register custom</text>
    <text x="36" y="188" font-size="11" fill="var(--vp-c-text-2, #67676c)">elements at module scope</text>
    <text x="36" y="208" font-size="11" fill="var(--vp-c-text-2, #67676c)">conditional routing &#8212; DSR</text>
    <text x="36" y="222" font-size="11" fill="var(--vp-c-text-2, #67676c)">defaults, requiresAuth hook</text>
    <text x="36" y="242" font-size="11" fill="var(--vp-c-text-2, #67676c)">otherwise() &#8212; a level choice</text>
    <!-- projection arrow -->
    <line x1="232" y1="104" x2="284" y2="104" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-proj)" />
    <text x="258" y="94" font-size="10" fill="var(--vp-c-text-2, #67676c)" text-anchor="middle">projected</text>
    <text x="258" y="118" font-size="10" fill="var(--vp-c-text-2, #67676c)" text-anchor="middle">as data</text>
    <!-- data panel -->
    <rect x="288" y="28" width="188" height="230" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-brand-1, #3451b2)" />
    <text x="304" y="52" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Pure data</text>
    <text x="304" y="68" font-size="10" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-3, #929295)">sample-app-routes</text>
    <g font-family="var(--vp-font-family-mono, ui-monospace, monospace)" font-size="11" fill="var(--vp-c-text-1, #3c3c43)">
      <text x="304" y="94">routes: [</text>
      <text x="312" y="110">{ name, url },</text>
      <text x="312" y="126">&#8230;</text>
      <text x="304" y="142">]</text>
      <text x="304" y="166">redirects: [</text>
      <text x="312" y="182">{ pattern, to },</text>
      <text x="304" y="198">]</text>
    </g>
    <text x="304" y="226" font-size="10" fill="var(--vp-c-text-3, #929295)">no imports, no components &#8212;</text>
    <text x="304" y="240" font-size="10" fill="var(--vp-c-text-3, #929295)">safe in any server runtime</text>
    <!-- import arrow -->
    <line x1="476" y1="104" x2="528" y2="104" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-proj)" />
    <text x="502" y="94" font-size="10" fill="var(--vp-c-text-2, #67676c)" text-anchor="middle">imported</text>
    <!-- worker panel -->
    <rect x="532" y="28" width="172" height="230" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="548" y="52" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Edge worker</text>
    <text x="548" y="68" font-size="10" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-3, #929295)">docs/worker/index.ts</text>
    <g font-family="var(--vp-font-family-mono, ui-monospace, monospace)" font-size="11" fill="var(--vp-c-text-1, #3c3c43)">
      <text x="548" y="98">createServerRouter(</text>
      <text x="556" y="114">{ mounts })</text>
      <text x="548" y="142">resolve(url)</text>
      <text x="556" y="158">&#8594; verdict</text>
    </g>
    <text x="548" y="186" font-size="11" fill="var(--vp-c-text-2, #67676c)">its one job:</text>
    <text x="548" y="202" font-size="11" fill="var(--vp-c-text-2, #67676c)">verdict &#8594; HTTP</text>
    <!-- contract-test seam -->
    <rect x="16" y="278" width="460" height="46" rx="8" fill="none" stroke="var(--vp-c-green-1, #18794e)" stroke-dasharray="5 4" />
    <line x1="382" y1="278" x2="382" y2="262" stroke="var(--vp-c-green-1, #18794e)" stroke-dasharray="5 4" />
    <text x="32" y="298" font-size="11" font-weight="600" fill="var(--vp-c-green-1, #18794e)">contract tests pin the seam &#8212; every CI run</text>
    <text x="32" y="314" font-size="11" fill="var(--vp-c-text-2, #67676c)">every verdict the worker will serve, resolved through the real package API</text>
    <text x="548" y="302" font-size="10" font-style="italic" fill="var(--vp-c-text-3, #929295)">drift-resistant through a</text>
    <text x="548" y="316" font-size="10" font-style="italic" fill="var(--vp-c-text-3, #929295)">test-pinned seam</text>
  </g>
</svg>

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

<svg viewBox="0 0 720 292" width="100%" style="max-width: 720px" role="img" aria-label="Verdict flow: an incoming request pathname goes through createServerRouter's resolve, which returns one of three verdicts - shell, redirect, or notFound - and the worker turns each into HTTP: 200, 302, or 404" xmlns="http://www.w3.org/2000/svg">
  <title>Request to verdict to HTTP</title>
  <defs>
    <marker id="arr-verdict" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0L8 4L0 8z" fill="var(--vp-c-text-3, #929295)" />
    </marker>
  </defs>
  <g font-family="var(--vp-font-family-base, ui-sans-serif, system-ui, sans-serif)">
    <!-- column headings -->
    <text x="540" y="18" font-size="11" fill="var(--vp-c-text-3, #929295)" text-anchor="middle">verdict &#8212; a plain object</text>
    <text x="660" y="18" font-size="11" fill="var(--vp-c-text-3, #929295)" text-anchor="middle">HTTP</text>
    <!-- request -->
    <rect x="16" y="110" width="152" height="64" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="92" y="136" font-size="12" fill="var(--vp-c-text-2, #67676c)" text-anchor="middle">incoming request</text>
    <text x="92" y="156" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-1, #3c3c43)" text-anchor="middle">/app/contacts/3</text>
    <line x1="168" y1="142" x2="214" y2="142" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-verdict)" />
    <!-- resolve -->
    <rect x="218" y="102" width="196" height="80" rx="8" fill="var(--vp-c-brand-soft, rgba(100,108,255,0.14))" stroke="var(--vp-c-brand-1, #3451b2)" />
    <text x="316" y="132" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="middle">createServerRouter(&#8230;)</text>
    <text x="316" y="150" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-brand-1, #3451b2)" text-anchor="middle">.resolve(url)</text>
    <text x="316" y="169" font-size="11" fill="var(--vp-c-text-2, #67676c)" text-anchor="middle">longest mount base wins</text>
    <text x="316" y="202" font-size="11" fill="var(--vp-c-text-3, #929295)" text-anchor="middle">no fetch, no Response &#8212;</text>
    <text x="316" y="217" font-size="11" fill="var(--vp-c-text-3, #929295)" text-anchor="middle">mounts validate at construction</text>
    <!-- fan-out arrows -->
    <line x1="414" y1="128" x2="466" y2="58" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-verdict)" />
    <line x1="414" y1="142" x2="466" y2="142" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-verdict)" />
    <line x1="414" y1="156" x2="466" y2="226" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-verdict)" />
    <!-- verdict: shell -->
    <rect x="470" y="30" width="140" height="52" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="540" y="52" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-1, #3c3c43)" text-anchor="middle">kind: 'shell'</text>
    <text x="540" y="70" font-size="11" fill="var(--vp-c-text-2, #67676c)" text-anchor="middle">mount, status?</text>
    <!-- verdict: redirect -->
    <rect x="470" y="116" width="140" height="52" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="540" y="138" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-1, #3c3c43)" text-anchor="middle">kind: 'redirect'</text>
    <text x="540" y="156" font-size="11" fill="var(--vp-c-text-2, #67676c)" text-anchor="middle">location, status</text>
    <!-- verdict: notFound -->
    <rect x="470" y="200" width="140" height="52" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <text x="540" y="222" font-size="12" font-family="var(--vp-font-family-mono, ui-monospace, monospace)" fill="var(--vp-c-text-1, #3c3c43)" text-anchor="middle">kind: 'notFound'</text>
    <text x="540" y="240" font-size="11" fill="var(--vp-c-text-2, #67676c)" text-anchor="middle">mount?</text>
    <!-- verdict -> HTTP -->
    <line x1="610" y1="56" x2="634" y2="56" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-verdict)" />
    <line x1="610" y1="142" x2="634" y2="142" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-verdict)" />
    <line x1="610" y1="226" x2="634" y2="226" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-verdict)" />
    <!-- HTTP: 200 -->
    <rect x="638" y="34" width="44" height="22" rx="11" fill="var(--vp-c-green-soft, rgba(16,185,129,0.14))" />
    <text x="660" y="49" font-size="12" font-weight="600" fill="var(--vp-c-green-1, #18794e)" text-anchor="middle">200</text>
    <text x="663" y="72" font-size="10" fill="var(--vp-c-text-3, #929295)" text-anchor="middle">app shell (304s ok);</text>
    <text x="663" y="84" font-size="10" fill="var(--vp-c-text-3, #929295)" text-anchor="middle">status'd shell: 404</text>
    <!-- HTTP: 302 -->
    <rect x="638" y="120" width="44" height="22" rx="11" fill="var(--vp-c-yellow-soft, rgba(234,179,8,0.14))" />
    <text x="660" y="135" font-size="12" font-weight="600" fill="var(--vp-c-yellow-1, #915930)" text-anchor="middle">302</text>
    <text x="663" y="158" font-size="10" fill="var(--vp-c-text-3, #929295)" text-anchor="middle">Location: computed</text>
    <text x="663" y="170" font-size="10" fill="var(--vp-c-text-3, #929295)" text-anchor="middle">by format()</text>
    <!-- HTTP: 404 -->
    <rect x="638" y="204" width="44" height="22" rx="11" fill="var(--vp-c-red-soft, rgba(244,63,94,0.14))" />
    <text x="660" y="219" font-size="12" font-weight="600" fill="var(--vp-c-red-1, #b8272c)" text-anchor="middle">404</text>
    <text x="663" y="242" font-size="10" fill="var(--vp-c-text-3, #929295)" text-anchor="middle">per-mount 404.html,</text>
    <text x="663" y="254" font-size="10" fill="var(--vp-c-text-3, #929295)" text-anchor="middle">a real status</text>
  </g>
</svg>

`createServerRouter` compiles and validates every mount at construction —
unknown redirect targets, cycles, and a bad `otherwise` target throw at
startup, never per-request — and the longest matching mount base owns a
pathname outright. `resolve()` accepts a pathname, an absolute URL string,
or anything with a `pathname`:

```ts
type Verdict =
  | { kind: 'shell'; mount: string; status?: number }
  | { kind: 'redirect'; mount: string; location: string; status: number }
  | { kind: 'notFound'; mount?: string };
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
import { createServerRouter } from 'ui-router-server';
import { createFetchHandler } from 'ui-router-server/fetch';

// All routing intelligence lives in ui-router-server; the ./fetch adapter
// turns a verdict into an HTTP Response. Module scope: the mount tables
// compile once per isolate.
const router = createServerRouter({ mounts });

// The 404-pattern exhibit mounts have no shell asset of their own — they serve
// the vanilla app's (its asset urls are absolute, so the shell works under any
// prefix). Mounts without an alias serve the shell at their own base, which is
// the adapter's shellPath default.
const SHELL_PATHS: Record<string, string> = {
  '/not-found-spa': '/app',
  '/simulated-routing': '/app',
};

// Every exhibit response carries noindex: the naive rung deliberately serves
// soft-404s, and the site must not be penalized by its own teaching material.
// The generic adapter owns verdict -> HTTP; SEO policy stays the site's,
// layered on the adapter's OUTPUT — a redirect Response the adapter builds has
// no host hook, so noindex rides the request path, not a per-verdict callback.
const EXHIBITS = ['/not-found-naive', '/not-found-spa', '/simulated-routing'];
const isExhibit = (pathname: string): boolean =>
  EXHIBITS.some((m) => pathname === m || pathname.startsWith(`${m}/`));

const withNoindex = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(response.body, { status: response.status, headers });
};

// The not-found-naive exhibit: the classic SPA-host fallback — every path
// serves the shell at 200, no route matching at all (the soft-404 anti-pattern
// baseline, and what this site shipped before this stack). It has no mounts
// entry BY DESIGN: the rung demonstrates the ABSENCE of server routing, so it
// bypasses the router entirely rather than riding a verdict.
const NAIVE_MOUNT = '/not-found-naive';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      url.pathname === NAIVE_MOUNT ||
      url.pathname.startsWith(`${NAIVE_MOUNT}/`)
    ) {
      // Construct the shell request from the original so its conditional
      // headers ride along and a repeat load can still 304.
      const shell = await env.ASSETS.fetch(
        new Request(new URL('/app', request.url), request),
      );
      return withNoindex(shell);
    }

    // The fetch adapter fronts every routed mount: it owns status mapping,
    // mergeSearch on redirect Locations, validator stripping + status relabel
    // on status'd shells, and the canonical Link header. The host supplies the
    // asset IO (env.ASSETS) and the two policies the adapter can't know: shell
    // aliasing (SHELL_PATHS) and the real 404 page.
    const handler = createFetchHandler(router, {
      shellPath: (mount) => SHELL_PATHS[mount] ?? mount,
      // The adapter hands over a shell Request already rewritten to shellPath
      // and (for a status'd shell) stripped of validators — the host's job is
      // the raw asset fetch; the adapter owns the relabel and Link on the way
      // out. Deep-link revalidations still 304: a non-status'd shell request
      // carries the conditional headers along from the original.
      serveShell: (_mount, shellRequest) => env.ASSETS.fetch(shellRequest),
      // Mount-owned miss: serve that app's 404 page re-wrapped at an honest
      // 404; anything but the page itself (or an asset with no 404.html) falls
      // through to the assets binding's own 404.html handling.
      serveNotFound: async (mount, req) => {
        const page = await env.ASSETS.fetch(
          new URL(`${mount}/404.html`, req.url),
        );
        return page.status === 200
          ? new Response(page.body, {
              status: 404,
              headers: new Headers(page.headers),
            })
          : env.ASSETS.fetch(request);
      },
      // The worker runs FIRST for the mount prefixes (wrangler
      // run_worker_first) and real assets live at /assets, never under a
      // mount — so it judges every request that reaches it, not just
      // navigations.
      shouldHandle: () => true,
    });

    const response = await handler(request);
    // null is the adapter's pass-through: a notFound without a mount (the path
    // isn't this router's), served however the assets binding would.
    if (response === null) return env.ASSETS.fetch(request);
    // Quarantine the teaching exhibits from crawlers, layered on the adapter's
    // output (the redirect Response it builds has no host hook of its own).
    return isExhibit(url.pathname) ? withNoindex(response) : response;
  },
} satisfies ExportedHandler<Env>;
```

The flagship path is now a single call: `createFetchHandler` turns the router
into a `(Request) => Promise<Response | null>`, and the worker shrinks to
supplying what the generic adapter can't know. The adapter owns the
verdict → HTTP mechanics — status mapping, `mergeSearch` on redirect
`Location`s, stripping validators and relabelling status'd shells, and the
canonical `Link` header (status-less shells only — a 404 is not an alternate
representation of anything). The worker supplies the host IO (`serveShell` /
`serveNotFound` over `env.ASSETS`) and the site policy the adapter has no seam
for: the level-2 exhibit bypasses the adapter entirely (it demonstrates the
_absence_ of server routing), `SHELL_PATHS` aliases the vanilla shell under the
exhibit prefixes, and `withNoindex` quarantines the exhibits on the way out. A
`null` return is the adapter's pass-through — a path this router doesn't own —
served however the assets binding would. `Env` is generated by `wrangler types`
from the config's bindings, so the handler needs no hand-written environment
interface.

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
    // other misses serve 404.html. EVERY mount lists its bare path too, not
    // just the `/*` wildcard: a `/*` pattern matches `/app/foo` but NOT the
    // bare mount root `/app`, and the root is exactly where the verdict that
    // differs from the plain asset lives — the flagship's `/` -> welcome 302,
    // and /app-hash's shell-at-200 (its own `app-hash.html`, not the vanilla
    // shell html_handling would serve at `/app-hash`). Omit the bare path and
    // html_handling answers before the worker runs, shadowing that verdict.
    // The exhibits also need their bare paths because no asset exists there —
    // the whole prefix is the demo.
    "run_worker_first": [
      "/app",
      "/app/*",
      "/app-mobx",
      "/app-mobx/*",
      "/app-hash",
      "/app-hash/*",
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
real 404 status. Every mount also lists its **bare** path, not just the `/*`
wildcard: `/*` matches `/app/foo` but not the bare `/app`, and the mount root
is exactly where a verdict differs from the plain asset — the flagship's
`/` → `welcome` 302, and `/app-hash`'s shell-at-200. Omit the bare path and
Cloudflare's `html_handling` answers before the worker runs, shadowing that
verdict. The exhibits list their bare paths for the same reason plus one more:
no asset exists there, so the whole prefix is the demo.

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

The `/not-found-spa` exhibit is one config line: `MountConfig.otherwise`
projects the client's `otherwise()` rule
([`routes.ts`](https://github.com/simshanith/lit-ui-router/blob/main/apps/sample-app-routes/src/routes.ts)):

```ts
// The not-found-spa exhibit: the otherwise projection (mirroring the client's
// otherwise() -> notFound rule) makes every path under this mount serve the
// app shell at an honest 404 — the client boots at the retained url and
// renders the rich in-app notFound state. It deliberately carries NO
// url-bearing routes: the shell bakes <base href="/app/">, so the client
// router cannot match deep links under this prefix — a shell-200 here would
// be exactly the soft-404 shape the flagship mounts avoid.
const notFoundSpaDemo: MountConfig = {
  routes: [{ name: 'notFound' }],
  otherwise: { state: 'notFound' },
};
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

The far end of the spectrum swaps the evaluation engine while keeping the
same data, plus the mount table that puts every level side by side:

```ts
// The simulated-routing exhibit: full router semantics server-side — the
// same tables, but every verdict computed by replaying the url through a
// headless @uirouter/core router (redirect rules, otherwise, and one day
// hooks/resolves all ride). Deep links serve shell-200 here, but the shell's
// baked <base href="/app/"> means the client renders its in-app notFound
// under this prefix — the exhibit teaches SERVER semantics; noindex (worker)
// quarantines it from crawlers.
const simulatedRoutingDemo: MountConfig = {
  routes,
  redirects,
  strategy: 'simulate',
  otherwise: { state: 'notFound' },
};

// The hash-location demo: a hash client keeps the whole route in the fragment,
// so the server only ever sees the bare mount — and it MUST serve the shell at
// 200 there. A redirect at the root (the flagship's `/` -> welcome rule) would
// 302 the mount, and a 302 sends the browser to a new path, stripping the
// route the hash client entered with; that is exactly why hash mode is not
// first-class at the flagship mounts. A single url-less-prefix root route
// (`url: ''`) matches the empty subpath to a shell verdict with no redirect;
// `strict: false` extends it to the trailing-slash form (`/app-hash/`). Deep
// paths never occur under a hash client, so they stay honest 404s.
const hashDemo: MountConfig = {
  routes: [{ name: 'root', url: '' }],
  config: { strict: false },
};

/**
 * Both sample apps run the same route tree, each under its own mount
 * (not-found-static); the demo mounts exhibit the not-found-spa and
 * simulated-routing rungs (not-found-naive lives worker-side — it is the
 * absence of routing config), and /app-hash the hash-location shape (shell at
 * the root, no redirect, so the fragment survives entry).
 */
export const mounts: Record<string, MountConfig> = {
  '/app': app,
  '/app-mobx': app,
  '/app-hash': hashDemo,
  '/not-found-spa': notFoundSpaDemo,
  '/simulated-routing': simulatedRoutingDemo,
};
```

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
pass the same relaxation as the mount's `config`.

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
runs — and deliberately not the page body. A crawler that loads a real route
gets a correct 200, but what comes back is still the empty client shell. That
is the line between HTTP-semantics SEO, which this guide delivers, and content
SEO: a rendered body a crawler can read. Rendering is a second, orthogonal
axis, and today this package sits at its first setting: **client-rendered** —
the shell hydrates in the browser. Build-time pre-rendering and request-time
[server-rendering](https://lit.dev/docs/ssr/overview/) are on the roadmap — a
per-route dial that would ride this same routing spine, which returns the
identical verdict at every setting. The honest HTTP status is here today;
content rendering is the next axis to build on top of it.

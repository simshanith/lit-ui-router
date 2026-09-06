# SSR verdict — `ui-router-server@0.1.1` + `@lit-labs/ssr@4.1.0` from a consumer's chair

Written while building `diagrams/app`, a real 21-route `lit-ui-router` app
prerendered at build time for Cloudflare Pages. Everything below is something
this app actually did; the probes that produced the quoted output run on every
`npm run build` (`prerender.ts`, `probeClientTemplates`).

Versions: `ui-router-server@0.1.1`, `lit-ui-router@1.11.2`, `@uirouter/core@6.1.2`,
`ui-router-navigation-location-plugin@0.3.0`, `lit@3.3.3`, `@lit-labs/ssr@4.1.0`,
`vite@8.2.2`, node 24.18.0.

Layout note: the app was first deployed under `/app/` and moved to the site
root on 2026-09-05 (the flat set now lives under `/set/`). Paths below are the
current ones; where a finding only made sense under a prefix it says so.

---

## 1. The headline

**`ui-router-server` does not render, and says so.** It is a verdict engine:
pathname in, `{ kind: 'shell' | 'redirect' | 'notFound' }` out
(`packages/ui-router-server/src/index.ts:67-90`). The docs are explicit —
"Rendering is a separate, roadmap axis" (`docs/packages/server.md:44`, and again
at :324). So "SSR the initial state with `ui-router-server`" is not a thing the
package offers, and no amount of reading the API changes that.

What it *is* excellent at is the half of the problem nobody else does: telling
you, from the client's own route table, **which** URLs deserve a page, which
deserve a 302, and which deserve a 404. That turned out to be exactly the input
a build-time prerenderer needs. The split this app landed on:

| Question                                   | Answered by             |
| ------------------------------------------ | ----------------------- |
| does `/sheet/12i` exist, and at what status? | `ui-router-server`      |
| what bytes go in `<div id="root">`?        | `@lit-labs/ssr` + my own server templates |

That division works, and it is a good division. It is also not what a reader of
the README expects to have to assemble themselves.

## 2. What the API felt like

Good, and small enough to hold in your head.

- `createServerRouter({ mounts })` (`src/index.ts:353`) compiles and validates at
  construction. A bad `otherwise` target threw at startup with a message that
  told me the rule (`src/index.ts:183-186`: "must be url-less (the unmatched url
  stays in the address bar)"). That is the right place to fail.
- Routes-as-data is the load-bearing idea and it holds. `src/routes.ts` in this
  app is a `RouteDeclaration[]` that the browser imports for its urls and the
  server imports for its mounts. There is no drift because there is no copy.
- `serverRouterPlugin` (`src/vite.ts:47`) is the best thing in the package for a
  static-SPA author: `vite preview` answered exactly what the deploy will —
  re-verified with curl against this app's own build at the root (2026-09-05;
  preview now also serves the prerendered file for a shell verdict, so the
  `<title>` of `/sheet/7/` is the sheet's, not the shell's):

  ```
  /sheet/7        →  200   (the prerendered page)
  /sheet/7/       →  200   (same page — strict: false on both sides)
  /office         →  302   Location: /sheet/14
  /sheet/14i      →  200   (the fourth interactive lane, added 2026-09-05:
                            a sheet id like any other, so the narrowed mount,
                            the prerender and the ←/→ walk picked it up with
                            no change beyond the manifest row)
  /sheet/2a       →  302   Location: /sheet/2A
  /sheet/99       →  404   (url kept; the shell, at 404)
  /no-such-thing  →  404
  /city           →  200   (the shell carries the whole 3D plate as markup;
                            the WebGL scene is client-only — three.js is a
                            resolve, so nothing runs and nothing loads on the
                            server side, and a no-JS reader still gets the
                            legend, the reading panel and the basis note)
  /specimen       →  200   (the type specimen, added 2026-09-05: the sheet
                            head, title and standfirst are markup; the bench
                            itself is an empty <atlas-specimen> the client
                            fills, because the pairings, the two readouts and
                            the webfont <link> are all measurements of a LIVE
                            document — nothing about them is server-knowable)
  /megacanvas     →  301   Location: /set/megacanvas.html  (retired from the
                            app 2026-09-05; a static _redirects line from
                            prerender.ts, so preview does not answer it)
  /app/sheet/7    →  404   (the /app/* → /:splat 301 is a Pages _redirects
                            rule that stage-site.mjs adds; preview has no
                            site-level rules)
  ```

- One documented sharp edge I hit anyway, back when the app was mounted at
  `/app`: **a bare mount base resolves the empty subpath and is `notFound`
  unless you supply a root pattern** (`src/index.ts:349-351`). `/app` 404ing
  while `/app/` worked is a confusing first ten minutes. One
  `redirects: [{ pattern: /^$/, to: 'atlas.gallery' }]` fixes it (the rule is
  still in `routes.ts`, inert at a root mount). It would be better as a default,
  or at least as a construction-time warning.
- A second edge, found only on the deployed site: **static hosts add a trailing
  slash**. Cloudflare Pages serves `sheet/7/index.html` and 308s `/sheet/7` onto
  `/sheet/7/`; `@uirouter/core`'s default `strictMode` rejects the slash, so
  every prerendered deep link booted into `notFound` while `vite preview`
  (which does not 308) looked fine. The fix is two lines —
  `urlService.config.strictMode(false)` in the browser and
  `config: { strict: false }` on the mount — but nothing pointed at it, and
  the prerender recipe writes exactly the directory layout that triggers it.

### The finding I did not expect

**The projection is of PATTERNS, not of existence.** My client route is
`/sheet/:num`. `/sheet/99` matches that pattern perfectly, so the honest
verdict is `shell`/200 — and the app then renders its in-router 404 at a URL the
server just told the world was fine. That is precisely the soft-404 the package
exists to abolish, reintroduced by the shape of my own url.

The fix is available and cheap, and it is worth documenting: narrow the param to
an alternation built from data the server side has on disk.

```ts
// src/routes.ts — mountsFor()
url: `/sheet/{num:(?:${alternates.join('|')})}`;
```

With 23 sheet ids in that alternation, `/sheet/99` became a real 404 and
`/sheet/12i` stayed a 200 (and, since the ids are cased, `/sheet/2a` is a
redirect rule to `/sheet/2A` in the same mount — one directory per sheet on
disk, one canonical url). Nothing in the docs pointed at this; the
"HTTP-semantics SEO" pitch would be much stronger with a section on it, because
**every `:id` route in every app has this problem by default**.

## 3. What rendered, and what did not

`@lit-labs/ssr` is what actually produces bytes. Results, verbatim from the
build's own probe:

### `uiSref` — renders nothing at all, silently

```
uiSref on a bare anchor:
  <!--lit-part 0eizGSDDbUw=--><!--lit-node 0--><a >Home</a><!--/lit-part-->
uiSrefActive + uiSref:
  <!--lit-part Q0yMh/JlDJA=--><!--lit-node 0--><a >Home</a ><!--/lit-part-->
```

No `href`. No `class`. No error, no warning — a `<!--lit-node 0-->` marker and an
anchor with a stray space where the directive would have been. This confirms
repo issue #564 (`@lit-labs/ssr` emits no element parts) with the symptom
spelled out: **the failure mode is a dead link in prerendered HTML, not a build
failure**. `uiSref` is an element-part directive by construction —
`packages/lit-ui-router/src/ui-sref.ts:382` takes `part: ElementPart` — so this
is structural, not a bug to fix in passing.

A literal `href` written *alongside* the directive does survive:

```
<a href="/home" ${uiSref('home')}>Home</a>
  → <!--lit-node 0--><a href="/home" >Home</a>
```

That is the workaround this app ships (see §4), and it is worth the package
recommending out loud.

### `<ui-view>` — throws

```
the client ShellView (rail + nested ui-view):
  THREW TypeError: document.createDocumentFragment is not a function
```

From `packages/lit-ui-router/src/ui-view.ts:89`:

```ts
private readonly inner = document.createDocumentFragment();
```

That is a **field initialiser**, so it runs the moment `@lit-labs/ssr`
constructs the element to render it — before `connectedCallback`, before
`render()`. `@lit-labs/ssr`'s DOM shim does not provide
`createDocumentFragment`. Feeding it a stub does not help: the element is a live
view host whose whole job is to swap components in response to a running
router, and there is no router on the server.

`<ui-router>` **does** render (shadow root with a `<slot>`), so the wrapper is
not the blocker; `<ui-view>` is.

### A registration trap, reproducible

```
before import:          undefined / undefined
after dynamic import:   function / function
```

Loading `lit-ui-router` with a **static** `import` in the same module as
`import '@lit-labs/ssr/lib/install-global-dom-shim.js'` leaves `<ui-view>` and
`<ui-router>` unregistered. `customElements.get()` returns `undefined`, and the
templates then render as **inert unknown elements with no error at all** — the
page looks like it worked. A **dynamic** `await import('lit-ui-router')` after
the shim module has evaluated registers both. I have not chased the mechanism,
but the rule is reproducible and `prerender.ts` depends on it.

### What DID render

Everything that is not a router primitive:

- plain `lit` templates: fine.
- `unsafeHTML`: fine, and it emits `<script>` tags verbatim — which is exactly
  the static-page behaviour I wanted, since the client re-creates them.
- **the 3D plate's shell.** `dist/city/index.html` is the same story one step
  further: the fragment renders whole — legend, controls, reading panel, basis
  note — with an empty `.cs-canvas` where the scene will be. The library that
  fills it is a `resolve` (`import('three')`), so the server never touches it
  and the prerendered page costs nothing extra.
- **the plates themselves.** `dist/sheet/7/index.html` is 69 KB and contains
  12 `<svg>` elements and 37 real `href`s. A crawler or a JS-less reader gets
  the whole drawing, the rail, and working navigation. That is genuine content
  SSR of a 21-route app, and it took about forty lines of server templates.

## 4. Workarounds this app ships

1. **Two template sets, not one.** `src/views.ts` (client, `uiSref`) and the
   server templates inside `prerender.ts` (plain `href`). They share the
   manifest and the route table, so the *data* never drifts; the markup is
   written twice. This is the real cost of #564 and it is not small.
2. **No hydration — takeover.** Because the two template sets differ, the
   server markup can never be `@lit-labs/ssr-client`-hydratable. `main.ts` does
   `root.replaceChildren()` and renders fresh. Correct, but it means a visible
   swap on load, and it throws away every byte the server rendered.
3. **Every generated link is a real `<a href>`.** The cross-sheet references the
   generator writes into the prose carry `href` *and* `data-sheet`; a delegated
   click handler turns them into `stateService.go`. One link, both worlds — and
   the only option anyway, since a directive cannot be attached to markup
   inserted with `innerHTML`.
4. **A narrowed param for the server mount** (§2), built from the manifest.
5. **`shouldHandle` overridden** in the Vite plugin to the html-Accept
   heuristic, so preview judges navigations and not asset fetches; and
   `serveShell` overridden to serve the prerendered `<subpath>/index.html`
   when the build wrote one, so preview and Pages serve the same bytes.
6. **`strict: false` on both sides** (§2), because the prerender's own
   directory layout makes the host add a slash.
7. **A `navigate` interceptor for the Navigation API plugin** (`src/router.ts`).
   Not an SSR matter, but found by the same pass: the plugin calls
   `navigation.navigate()` and registers no `navigate` listener of its own, so
   without `event.intercept()` in the app every router-driven navigation is a
   cross-document load — the SPA reloads on each click and the prerendered
   page is what you see. See ask 9.

## 5. Concrete package-level asks

Ordered by how much each would have saved me.

1. **`lit-ui-router`: make `<ui-view>` SSR-safe enough not to throw.** Move
   `ui-view.ts:89`'s `document.createDocumentFragment()` out of the field
   initialiser and into `connectedCallback` / first render. Even if `<ui-view>`
   can only ever render an empty shell on the server, *not throwing* is the
   difference between "prerender the shell and let the client fill it" and
   "write a second template set".
2. **`lit-ui-router`: an SSR-safe `srefHref` companion.** Repo #689 already
   plans an `srefHref` attribute directive. An **attribute**-part directive can
   be server-rendered, which is the whole game: `<a href=${srefHref('sheet', {num})}>`
   would let one template serve both sides and make hydration possible. This is
   the single highest-value item on the list.
3. **`lit-ui-router`: document the DOM-shim import order.** One line in the docs
   ("load `lit-ui-router` via dynamic import after installing the shim") would
   save the next person a silent, error-free wrong answer.
4. **`ui-router-server`: a "patterns are not existence" section.** With the
   `{num:(?:a|b|c)}` recipe. Every `:id` route ships a soft-404 without it, and
   that is the exact thing the package is for.
5. **`ui-router-server`: default the bare-mount-base redirect**, or warn at
   construction when a mount has no rule for the empty subpath.
6. **`ui-router-server`: a prerender adapter.** `resolve()` per path is easy, but
   every consumer will then write the same loop: enumerate routes, resolve,
   write `<subpath>/index.html`, emit `_redirects` / `_headers`. An
   `ui-router-server/prerender` entry that takes the mounts and a
   `renderShell(verdict, path) => string` callback would be ~60 lines in the
   package and would delete ~120 from every consumer. It also keeps the
   "verdict engine, not a framework" line intact: the caller still renders.
7. **`lit-ui-router`: document "the view has re-rendered."** Unrelated to SSR
   but found in the same build. `document.startViewTransition()` needs a promise
   that resolves when the DOM has changed. `onSuccess` fires when the
   *transition* succeeded and `<ui-view>` swaps its component in a lit update
   *after* that, so resolving on `onSuccess` cross-fades to the old content.
   The first cut of `src/experimental/view-transitions.ts` released on
   `transition.promise` + two animation frames + a 900 ms cap — and that froze
   the deployed site for four seconds per sheet, because rendering is
   suspended while the snapshot is held, frames never fire, and the browser's
   DOM-update timeout was the only release. The answer was already in the
   package: `<ui-view>` is a `LitElement`, so `transition.promise` then
   `updateComplete` on every `<ui-view>` (and on the element it rendered) is
   the exact moment (`src/experimental/view-rendered.ts`; `ready` now resolves
   in ~15 ms). It deserves a line in the docs — "await
   `transition.promise`, then each `<ui-view>`'s `updateComplete`" — and the
   same recipe fixed a second bug in the same layer: polling the DOM by frame
   after `onSuccess` finds the *outgoing* view's element first.
8. **Types: `LitStateDeclaration<T>`'s resolves generic is hard to use.** A view
   typed `RoutedLitTemplate<{ manifest: Manifest }>` is not assignable to
   `LitStateDeclaration`'s default `Record<string, any>` — parameter
   contravariance, and the error points at `component:` rather than at the
   generic. The fix a consumer has to find is "declare the resolves type as an
   **object type alias with all members optional**". Worth a docs line, or a
   looser default.
9. **`ui-router-navigation-location-plugin@0.3.0`: intercept your own
   navigations, or say in the Quick Start that the app must.** Found by a
   Playwright pass against the deployed site: with the plugin installed per
   its README (`router.plugin(navigationLocationPlugin)` and nothing else),
   every `uiSref` click was a full document load. The plugin's `_set`
   (`src/index.ts:167-183`) calls `navigation.navigate(fullUrl, { info,
   history })` and the service registers only a `currententrychange` listener
   (`src/index.ts:90-94`); no `navigate` listener, no `event.intercept()`. A
   same-origin `navigate()` that nobody intercepts is a cross-document
   navigation, so the "SPA" reloads on every click — silently, since the
   prerendered page it lands on looks right. The README's "Navigation event
   interception" section presents `event.intercept()` as an optional feature
   for analytics and view transitions; it is in fact the line that makes the
   plugin a location plugin at all (the plugin's own browser specs install
   exactly such a catch-all interceptor before every test —
   `src/specs/real-navigation.ts:16-23` — and the flagship sample app wires
   one in `apps/sample-app-shared/src/router.config.ts:77-91`). Either
   intercept `isUIRouterNavigateEvent` navigations inside the service by
   default (an opt-out for apps that want the cross-document behaviour), or
   move the listener into the Quick Start as required setup. This app wires
   the listener in `src/router.ts`.
10. **`ui-router-server` docs: a "static hosts add a slash" note.** The
    prerender recipe (`<subpath>/index.html`) is the layout Pages, Netlify and
    S3-style hosts 308 onto a trailing slash, and core's default `strictMode`
    then rejects every deep link. `strict: false` on the mount and
    `strictMode(false)` in the browser is the pairing; the prerender adapter
    from ask 6 should default to it.

## 6. Verdict, in one paragraph

`ui-router-server` did its job and did it cleanly: one route table, honest 302s
and 404s in dev, preview and the prerender, and no surprises past the two
documented edges. It is not an SSR package and does not claim to be, and the
gap between "verdicts" and "a prerendered site" is real but small — about a
hundred lines of glue, most of which the package could absorb. The blocker for
*true* SSR of a `lit-ui-router` app is not on the server side at all: it is that
`uiSref` is an element-part directive and `<ui-view>` throws on construction
under a DOM shim. Fix those two and this app's server templates collapse into
its client templates, and hydration becomes possible. Until then, prerendering a
`lit-ui-router` app means writing the markup twice — which is entirely doable,
and is what `prerender.ts` does, but should be said out loud in the docs.

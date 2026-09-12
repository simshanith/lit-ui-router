# SSR verdict — `ui-router-server@0.1.1` + `@lit-labs/ssr@4.1.0` from a consumer's chair

## Filed

The package-level asks in §5 are filed on `simshanith/lit-ui-router`:

- **1** `<ui-view>` throws under the DOM shim (`createDocumentFragment` in a
  field initialiser) — #803
- **2** an SSR-safe attribute-position `sref` — #564 (pre-existing)
- **3** document the DOM-shim import order (the static-import finding in §3) — #808
- **4** patterns are not existence: every `:id` route ships a soft-404 — #804
- **5** default the bare-mount-base rule, or warn at construction — #805
- **6** a prerender entry: mounts + `renderShell` — #806
- **7** "the view has re-rendered" has no documented signal — `onSuccess`
  settles before `<ui-view>` swaps; the recipe is `transition.promise` then
  `updateComplete` on every view and its element — #812
- **9** the Navigation API plugin's interception hazard — #750 (pre-existing)
- **10** static hosts add a trailing slash; `strict: false` on both sides — #807
- **8** the resolves generic: a typed `RoutedLitTemplate` rejected at
  `component:` with the error pointing away from the generic — #813. Filed
  with a correction to §5's account (four shapes compiled under `--strict`):
  threading the generic onto the declaration, `LitStateDeclaration<{ manifest:
  Manifest }>[]`, is the fix for a homogeneous table, and a bare
  `RoutedLitTemplate` still drops in beside a typed view. All-optional members
  are forced only by a heterogeneous table — two views with different required
  shapes — which is the atlas's case, at the cost of `?.` at every use site.

All ten asks are accounted for. One more, found after the verdict:
`urlService.rules.initial({ state })` erases a first-load query string (see
`src/router.ts`; DESIGN-REVIEW §T54) — #815, on this repo as a docs rough
edge (`location-plugins.md`, `unmatched-urls.md` teach the object form). The
behaviour is `@uirouter/core`'s alone; that report is held behind the #25
outreach by the user's call, since the function form is a complete fix — a
probe showed `go()` runs the search through the state's own param types.

Written while building `www/atlas.lit-ui-router.dev/app`, a real `lit-ui-router` app prerendered at
build time for Cloudflare Pages. Everything below is something this app actually
did; the probes that produced the quoted output run on every `npm run build`
(`prerender.ts`, `probeClientTemplates`). Versions: `ui-router-server@0.1.1`,
`lit-ui-router@1.11.2`, `@uirouter/core@6.1.2`,
`ui-router-navigation-location-plugin@0.3.0`, `lit@3.3.3`, `@lit-labs/ssr@4.1.0`,
`vite@8.2.2`, node 24.18.0. Paths are the current ones — the app sits at the site
root, the flat set under `/set/` — and a finding that only made sense under the
app's first `/app/` prefix says so.

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
  told me the rule (`src/index.ts:183-186`: "must be url-less"). The right place
  to fail.
- Routes-as-data is the load-bearing idea and it holds: `src/routes.ts` is a
  `RouteDeclaration[]` the browser imports for its urls and the server imports
  for its mounts. No drift, because there is no copy.
- `serverRouterPlugin` (`src/vite.ts:47`) is the best thing in the package for a
  static-SPA author: `vite preview` answers exactly what the deploy will —
  verified with curl against this app's own build at the root (preview serves
  the prerendered file for a shell verdict, so the `<title>` of `/sheet/7/` is
  the sheet's, not the shell's):

  ```text
  /sheet/7        →  200   (the prerendered page)
  /sheet/7/       →  200   (same page — strict: false on both sides)
  /office         →  302   Location: /sheet/14
  /sheet/14i      →  200   (a sheet id like any other: adding a lane costs
                            nothing beyond its manifest row)
  /sheet/2a       →  302   Location: /sheet/2A
  /sheet/99       →  404   (url kept; the shell, at 404)
  /no-such-thing  →  404
  /city           →  200   (the shell carries the whole 3D plate as markup; the
                            WebGL scene is client-only — three.js is a resolve,
                            so nothing runs server-side and a no-JS reader still
                            gets the legend, panel and basis note)
  /specimen       →  200   (head and standfirst are markup; the bench itself is
                            an empty <atlas-specimen> the client fills — its
                            pairings and readouts measure a LIVE document)
  /megacanvas     →  301   Location: /set/megacanvas.html  (a static _redirects
                            line, so preview does not answer it)
  /app/sheet/7    →  404   (the /app/* → /:splat 301 is a Pages rule that
                            stage-site.mjs adds; preview has no site rules)
  ```

- One documented sharp edge I hit anyway, back when the app was mounted at
  `/app`: **a bare mount base resolves the empty subpath and is `notFound`
  unless you supply a root pattern** (`src/index.ts:349-351`). `/app` 404ing
  while `/app/` worked is a confusing first ten minutes; one
  `redirects: [{ pattern: /^$/, to: 'atlas.gallery' }]` fixes it. See ask 5.
- A second edge, found only on the deployed site: **static hosts add a trailing
  slash**. Cloudflare Pages serves `sheet/7/index.html` and 308s `/sheet/7` onto
  `/sheet/7/`; `@uirouter/core`'s default `strictMode` rejects the slash, so
  every prerendered deep link booted into `notFound` while `vite preview`
  (which does not 308) looked fine. The fix is two lines —
  `urlService.config.strictMode(false)` in the browser and
  `config: { strict: false }` on the mount — but nothing pointed at it, and the
  prerender recipe writes exactly the layout that triggers it. See ask 10.

### The finding I did not expect: patterns are not existence

**The projection is of PATTERNS, not of existence.** My client route is
`/sheet/:num`. `/sheet/99` matches that pattern perfectly, so the honest verdict
is `shell`/200 — and the app then renders its in-router 404 at a URL the server
just told the world was fine: precisely the soft-404 the package exists to
abolish, reintroduced by the shape of my own url. The fix is cheap — narrow the
param to an alternation built from data the server side has on disk.

```ts
// src/routes.ts — mountsFor()
url: `/sheet/{num:(?:${alternates.join('|')})}`;
```

With 23 sheet ids in that alternation, `/sheet/99` became a real 404 and
`/sheet/12i` stayed a 200 (and, the ids being cased, `/sheet/2a` is a redirect
rule to `/sheet/2A` in the same mount — one directory per sheet, one canonical
url). **Every `:id` route in every app has the problem by default.** See ask 4.

## 3. What rendered, and what did not

`@lit-labs/ssr` is what produces bytes. Results, verbatim from the build's probe:

### `uiSref` — renders nothing at all, silently

```text
uiSref on a bare anchor:
  <!--lit-part 0eizGSDDbUw=--><!--lit-node 0--><a >Home</a><!--/lit-part-->
uiSrefActive + uiSref:
  <!--lit-part Q0yMh/JlDJA=--><!--lit-node 0--><a >Home</a ><!--/lit-part-->
```

No `href`. No `class`. No error, no warning — a `<!--lit-node 0-->` marker and an
anchor with a stray space where the directive would have been. This confirms
repo issue #564 (`@lit-labs/ssr` emits no element parts) with the symptom spelled
out: **the failure mode is a dead link in prerendered HTML, not a build
failure**. `uiSref` is an element-part directive by construction
(`packages/lit-ui-router/src/ui-sref.ts:382` takes `part: ElementPart`), so this
is structural. A literal `href` written *alongside* the directive does survive:

```text
<a href="/home" ${uiSref('home')}>Home</a>
  → <!--lit-node 0--><a href="/home" >Home</a>
```

That is the workaround this app ships (§4), and worth recommending out loud.

### `<ui-view>` — throws

```text
the client ShellView (rail + nested ui-view):
  THREW TypeError: document.createDocumentFragment is not a function
```

From `packages/lit-ui-router/src/ui-view.ts:89`:

```ts
private readonly inner = document.createDocumentFragment();
```

That is a **field initialiser**, so it runs the moment `@lit-labs/ssr` constructs
the element to render it — before `connectedCallback`, before `render()` — and
the DOM shim does not provide `createDocumentFragment`. Feeding it a stub does
not help: the element is a live view host whose whole job is to swap components
in response to a running router, and there is no router on the server.
`<ui-router>` **does** render (shadow root with a `<slot>`), so the wrapper is
not the blocker; `<ui-view>` is.

### A registration trap, reproducible

```text
before import:          undefined / undefined
after dynamic import:   function / function
```

Loading `lit-ui-router` with a **static** `import` in the same module as
`import '@lit-labs/ssr/lib/install-global-dom-shim.js'` leaves `<ui-view>` and
`<ui-router>` unregistered: `customElements.get()` returns `undefined` and the
templates render as **inert unknown elements with no error at all** — the page
looks like it worked. A **dynamic** `await import('lit-ui-router')` after the
shim module has evaluated registers both. The mechanism is unchased; the rule is
reproducible, and `prerender.ts` depends on it.

### What DID render

Everything that is not a router primitive:

- plain `lit` templates: fine.
- `unsafeHTML`: fine, and it emits `<script>` tags verbatim — exactly the
  static-page behaviour I wanted, since the client re-creates them.
- **the 3D plate's shell.** `dist/city/index.html` renders whole — legend,
  controls, reading panel, basis note — with an empty `.cs-canvas` where the
  scene will be. The library that fills it is a `resolve` (`import('three')`),
  so the server never touches it and the page costs nothing extra.
- **the plates themselves.** `dist/sheet/7/index.html` is 69 KB and contains 12
  `<svg>` elements and 37 real `href`s: a crawler or a JS-less reader gets the
  whole drawing, the rail, and working navigation. Genuine content SSR, in about
  forty lines of server templates.

## 4. Workarounds this app ships

1. **Two template sets, not one.** `src/views.ts` (client, `uiSref`) and the
   server templates inside `prerender.ts` (plain `href`). They share the manifest
   and the route table, so the *data* never drifts; the markup is written twice.
   This is the real cost of #564 and it is not small.
2. **No hydration — takeover.** Because the two template sets differ, the server
   markup can never be `@lit-labs/ssr-client`-hydratable: `main.ts` does
   `root.replaceChildren()` and renders fresh. Correct, but a visible swap on
   load, and it throws away every byte the server rendered.
3. **Every generated link is a real `<a href>`.** The cross-sheet references the
   generator writes into the prose carry `href` *and* `data-sheet`; a delegated
   click handler turns them into `stateService.go`. The only option anyway, since
   a directive cannot be attached to markup inserted with `innerHTML`.
4. **A narrowed param for the server mount** (§2), built from the manifest.
5. **`shouldHandle` overridden** in the Vite plugin to the html-Accept heuristic,
   so preview judges navigations and not asset fetches; and `serveShell`
   overridden to serve the prerendered `<subpath>/index.html` when the build
   wrote one, so preview and Pages serve the same bytes.
6. **`strict: false` on both sides** (§2), because the prerender's own directory
   layout makes the host add a slash.
7. **A `navigate` interceptor for the Navigation API plugin** (`src/router.ts`).
   Not an SSR matter, but found by the same pass, and the reason every
   router-driven navigation was a cross-document load. See ask 9.

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
   **object type alias with all members optional**" — true for a heterogeneous
   route table; for a homogeneous one, thread the generic onto the declaration
   instead (see Filed, #813). Worth a docs line, or a looser default.
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

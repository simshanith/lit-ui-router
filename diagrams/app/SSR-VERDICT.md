# SSR verdict — `ui-router-server@0.1.1` + `@lit-labs/ssr@4.1.0` from a consumer's chair

Written while building `diagrams/app`, a real 21-route `lit-ui-router` app
prerendered at build time for Cloudflare Pages. Everything below is something
this app actually did; the probes that produced the quoted output run on every
`npm run build` (`prerender.ts`, `probeClientTemplates`).

Versions: `ui-router-server@0.1.1`, `lit-ui-router@1.11.2`, `@uirouter/core@6.1.2`,
`lit@3.3.3`, `@lit-labs/ssr@4.1.0`, `vite@8.2.2`, node 24.18.0.

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
| does `/app/sheet/12i` exist, and at what status? | `ui-router-server`      |
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
  verified with curl against this app's own build:

  ```
  /app/sheet/7   →  200
  /app/office    →  302  Location: /app/sheet/14
  /app/sheet/99  →  404   (url kept)
  /app           →  302  Location: /app/
  ```

- One documented sharp edge I hit anyway: **a bare mount base resolves the empty
  subpath and is `notFound` unless you supply a root pattern**
  (`src/index.ts:349-351`). `/app` 404ing while `/app/` worked is a confusing
  first ten minutes. One `redirects: [{ pattern: /^$/, to: 'atlas.gallery' }]`
  fixes it. It would be better as a default, or at least as a construction-time
  warning.

### The finding I did not expect

**The projection is of PATTERNS, not of existence.** My client route is
`/sheet/:num`. `/app/sheet/99` matches that pattern perfectly, so the honest
verdict is `shell`/200 — and the app then renders its in-router 404 at a URL the
server just told the world was fine. That is precisely the soft-404 the package
exists to abolish, reintroduced by the shape of my own url.

The fix is available and cheap, and it is worth documenting: narrow the param to
an alternation built from data the server side has on disk.

```ts
// src/routes.ts — mountsFor()
url: `/sheet/{num:(?:${alternates.join('|')})}`;
```

With 21 sheet ids in that alternation, `/app/sheet/99` became a real 404 and
`/app/sheet/12i` stayed a 200. Nothing in the docs pointed at this; the
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
   heuristic, so preview judges navigations and not asset fetches.

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
7. **`lit-ui-router`: a hook for "the view has re-rendered."** Unrelated to SSR
   but found in the same build. `document.startViewTransition()` needs a promise
   that resolves when the DOM has changed. `onSuccess` fires when the
   *transition* succeeded and `<ui-view>` swaps its component in a lit update
   *after* that, so resolving on `onSuccess` cross-fades to the old content.
   `src/experimental/view-transitions.ts` releases on
   `transition.promise` + two animation frames + a 900 ms cap, which is a guess
   wearing a seatbelt. An `onViewRendered` hook — or simply exposing
   `updateComplete` on `<ui-view>` — would make View-Transitions integration a
   three-line recipe instead of a comment block.
8. **Types: `LitStateDeclaration<T>`'s resolves generic is hard to use.** A view
   typed `RoutedLitTemplate<{ manifest: Manifest }>` is not assignable to
   `LitStateDeclaration`'s default `Record<string, any>` — parameter
   contravariance, and the error points at `component:` rather than at the
   generic. The fix a consumer has to find is "declare the resolves type as an
   **object type alias with all members optional**". Worth a docs line, or a
   looser default.

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

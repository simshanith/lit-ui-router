# diagrams/app — The Altitude Atlas, routed

The drawing set in `diagrams/` as one `lit-ui-router` single-page app. Shaped
like the repo's tutorial examples (`examples/helloworld`, `examples/hellosolarsystem-mobx`):
plain `npm`, its own `package-lock.json`, and every dependency taken from the
**published** registry — no workspace links.

```bash
npm install
npm run dev        # vite, with ui-router-server answering real 302s / 404s
npm run build      # vite build + node prerender.ts
npm run build:artifact  # vite build --mode artifact + node artifact.ts
npm run preview
npm run typecheck
```

The content is generated, never transcribed: `node generator/build.mjs .` from
`diagrams/` writes `app/public/sheets/<id>.html` (one chrome-less fragment per
sheet), `app/public/sheets/atlas.css` (the sheets' own chrome) and
`app/public/manifest.json` (one row per sheet: title, rev, the gallery index's
own ALTITUDE wording and FIT VERDICT line, which census plates it reads, the
cross-sheet references found in its prose, and the sheet's standalone filename
in the flat set). Twenty-four fragments: the twenty-three sheets plus one
`extras` row, the 3D city, which has no sheet number because the flat set only
ever published it inside its gallery. The manifest also carries a `cover`
object — the flat gallery's stat bar, general survey, prose column and
colophon line as rendered HTML, plus the CSS they need — so the routed index
draws the same bytes the flat one does rather than a paraphrase. The same seam writes
`app/src/generated/city-init.js` (below). The seam is
`diagrams/generator/emit-app.mjs`.

## The routes

| State            | Url            | View            | Resolves                          |
| ---------------- | -------------- | --------------- | --------------------------------- |
| `atlas`          | — (abstract)   | `ShellView`     | `manifest`                        |
| `atlas.gallery`  | `/`            | `GalleryView`   | —                                 |
| `atlas.sheet`    | `/sheet/:num`  | `SheetView`     | `sheet`, `fragment`               |
| `atlas.city`     | `/city`        | `CityView`      | `extra`, `fragment`, **`three`**  |
| `atlas.office`   | `/office`      | — `redirectTo`  | — (302 to `atlas.sheet` 14)       |
| `atlas.about`    | `/about`       | `AboutView`     | —                                 |
| `atlas.notFound` | — (url-less)   | `NotFoundView`  | — (the `otherwise` projection)    |

The twenty-three sheets are the nineteen SVG plates and four interactive lanes
— 1i, 2B, 12i and **14i**, the survey office as a live cytoscape graph, which
joins the ascent right after sheet 14 exactly as 12i sits after 12 and carries
a standalone page of its own in the flat set
(`sheet-14i-the-survey-office-interactive.html`).

`atlas.city` is the 3D plate and the only state that loads a library on entry
(see **Dependencies on demand**). It is deliberately not a sheet: it carries no
sheet number, sits in the manifest's `extras` rather than its `sheets`, and so
is invisible to the ascent order, the ← / → walk and the server's narrowed
`/sheet/{num:…}` — a rail entry and a cover card, nothing more.

`atlas.megacanvas` was **retired from the app on 2026-09-05**. The flat set
still publishes the whole reel as one page, so the prerender writes
`/megacanvas` and `/megacanvas/` → `/set/megacanvas.html` 301 into `_redirects`
and the reel's pan/zoom layer is gone from `src/experimental/`.

## Where it lives

The app owns the site root of atlas.lit-ui-router.dev: `/`, `/sheet/7`,
`/city`, `/about`, `/office`. The flat drawing set — the pages this
app was cut from — is staged beside it under `/set/` as the version to compare
against, and the two link to each other: the rail's THE FLAT SET entry and each
sheet's STANDALONE PLATE crumb go out; the flat gallery's cover links back to
THE ROUTED SET. `src/routes.ts` holds the ONE base constant (`MOUNT`, `BASE`,
`SET`, and the `href` table both template sets use); vite's `base`,
`<base href>` (via `%BASE_URL%`), the generator's fragment links and the staged
`_redirects` all derive from it. `diagrams/generator/stage-site.mjs` assembles
`dist/`: this app's `dist/` at the root, the flat set under `dist/set/`, and one
merged `_redirects` (the prerender's own lines, every old flat filename → `/set/`,
and `/app/*` → `/:splat` so links to the app's first home survive).

## Base vs experimental

The app is deliberately two layers, and they do not mix.

**Base — `src/*.ts`.** Exemplary, boring `lit-ui-router`: a route table
(`routes.ts`) projected as data and shared with the server, states with
`component` and `resolve` (`router.ts`), an abstract `atlas` shell whose view
renders the nav rail and a nested `<ui-view>` (`views.ts`), `uiSref` and
`uiSrefActive` on every link, `redirectTo` for `/office` → sheet 14, a
url-less `atlas.notFound` as the `otherwise` target, the Navigation API
location plugin with a `pushState` fallback, and document titles set on
`onSuccess` from `titles.ts` (the same strings the prerender writes). Nothing
in `src/*.ts` imports anything from `src/experimental/`. This layer is meant to
be liftable into `examples/` as-is.

Three base-layer details a Playwright pass against the deployed site taught,
each with a comment at the line:

- `router.urlService.config.strictMode(false)` (`router.ts`). Cloudflare Pages
  serves `dist/sheet/7/index.html` and 308s `/sheet/7` onto `/sheet/7/`; core's
  default strict matching rejected the slash and booted every deep link into
  `atlas.notFound`. The server mount is compiled with the same `strict: false`.
- A `navigate` listener that calls `event.intercept()` for
  `isUIRouterNavigateEvent(event)` (`router.ts`). The Navigation API plugin
  calls `navigation.navigate()` and leaves interception to the app; without the
  listener every click was a cross-document load.
- Cased ids are canonical (`/sheet/2A`). `/sheet/2a` redirects to it on both
  sides: an `onBefore` guard in the browser, a redirect rule in the mount, and
  therefore a `_redirects` line from the prerender.

**Experimental — `src/experimental/`.** Optional motion, wired in by a single
call in `main.ts`. Delete the directory and that one line and the base app is
unchanged.

| Module                | What it does                                    | Router hook                                          |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| `view-transitions.ts` | slideshow between sheets (View Transitions API, CSS keyframe fallback) | `onBefore` for the snapshot; `transition.promise` + `viewRendered()` for the release |
| `view-rendered.ts`    | the missing "view has re-rendered" promise: lit's `updateComplete` on every `<ui-view>`, then on the `<atlas-plate>` it rendered | none — shared by the two below |
| `keyboard.ts`         | ← / → walk the set; focus lands on the arriving sheet's title | none — reads `router.globals`            |
| `analytics.ts`        | only the `page_view`s gtag cannot see for itself (below), and only if the staged page carries gtag (`VITE_GOOGLE_ANALYTICS_TRACKING_ID` at stage time, the flagship's own id) | `onSuccess` |

**The analytics rule.** The atlas shares the flagship's GA stream, whose
enhanced measurement counts "page changes based on browser history events". So
gtag already owns the initial `page_view` *and* every pushState / replaceState /
popstate — and the staged tag is now plain `gtag('config', id)` on every page,
routed and flat alike. The one thing gtag cannot see is
`navigation.navigate()`, which the Navigation API location plugin uses and
which touches `history.pushState` never. `analytics.ts` therefore sends on
`onSuccess` only when the router took that plugin (`NAVIGATION_API`, exported
from `router.ts` so the flag is not re-derived) AND the `navigate` event behind
the transition was a `push` or `replace`. A `traverse` is back/forward, which
fires popstate and is gtag's; under the pushState fallback nothing is sent at
all. No doubles, no misses — verified in Playwright with a stubbed `gtag`: one
router `page_view` per rail click, zero on back, zero either way under the
fallback.

**Dependencies on demand.** `atlas.city` is the one state that loads a library
when it is entered: `resolve: [{ token: 'three', resolveFn: () => import('three') }]`.
Vite gives that dynamic import its own chunk (`three.module-*.js`, 675 kB), and
a Playwright request log confirms `/sheet/7/` never fetches it while `/city/`
does — the router is the loader, and the view is handed the namespace as a
resolve like any other value. The scene itself is
`src/generated/city-init.js`, written by the same generator seam from the flat
gallery's inline module: the app cannot run an inserted
`<script type="module">` (see `src/fragment.ts`) and its import must be
bundled, not a cdnjs url, so the generator emits the identical scene body as
an ES module `initCity(root, THREE)` that returns a teardown. The flat
gallery's copy is byte-for-byte unchanged. **`<atlas-city>` (`views.ts`) owns
that teardown**, not a router hook: the scene holds a WebGL context, two
observers, a media listener and pending frames, the experimental layer is
deletable by design and this is not optional, and the element that created the
scene is the one thing whose lifetime already matches it —
`disconnectedCallback` disposes, `updated` + the plate's own `updateComplete`
raises.

Why `onBefore` for the slideshow: `document.startViewTransition()` snapshots
the document at the moment it is called, so it must run **before** any resolve
starts — `onStart` fires after resolves are already in flight, and a slow
fetch would then be frozen inside the old snapshot. Why
`transition.promise` + `updateComplete` for the release: ui-router has no "the
view has re-rendered" hook. `onSuccess` fires when the *transition* succeeded,
and `<ui-view>` swaps its component in a lit update after that — releasing on
`onSuccess` cross-fades to the old content. The first cut released two
`requestAnimationFrame`s later, and that froze the page for four seconds per
sheet: rendering is suspended while the snapshot is held, so the frames never
fire and only the browser's DOM-update timeout lets go. `<ui-view>` is a
`LitElement`, so its `updateComplete` is the promise that was missing;
`view-rendered.ts` awaits it (and then the plate's). That gap is written up as
a package-level ask in [`SSR-VERDICT.md`](./SSR-VERDICT.md).

Every animation is inside `@media (prefers-reduced-motion: no-preference)`,
and each module also checks `matchMedia('(prefers-reduced-motion: reduce)')`
before doing any work.

## Artifact build

`npm run build:artifact` emits `dist-artifact/index.html` — the whole atlas as
ONE self-contained file (~2.64 MB — three.js is a quarter of it) that can be
published as a claude.ai Artifact. That host is strict in four ways, and each one is a line in the
build:

- **One file, no fetches — not even same-origin.** `artifact.ts` bakes
  `public/manifest.json` and all twenty-four generated fragments into a
  `<script type="application/json" id="atlas-data">` island (every `<` escaped
  as `\u003c`, so a fragment's own `</script>` cannot close it) and inlines
  `public/sheets/atlas.css` as a `<style>`. `src/manifest.ts` reads the island
  when it is present and falls back to the fetches the site uses. The cytoscape
  and three dynamic imports are folded into the single chunk by
  `vite-plugin-singlefile` (`useRecommendedBuildConfig`, which sets
  `output.codeSplitting = false` on vite 8), so `#/city` raises the isometric
  scene with the network entirely blocked.
- **The host owns the document skeleton.** The published file must carry no
  `<!DOCTYPE>`/`<html>`/`<head>`/`<body>` of its own, and only its first 8KB is
  scanned for `<title>`, so `artifact.ts` strips the wrapper and moves the title
  to byte 0.
- **The page sits on an opaque origin path**, so path routing is out:
  `src/router.ts` takes `hashLocationPlugin` instead of the Navigation
  API/pushState pair, and every url becomes `#/sheet/7`. `uiSref` writes those
  hrefs itself; `views.ts` prefixes its static `href` attributes to match.
- **The flat set does not exist offline**, so `THE FLAT SET ↗` and each sheet's
  `STANDALONE PLATE ↗` point at `https://atlas.lit-ui-router.dev/set/…` in a
  new tab.

`src/mode.ts` is the one flag (`import.meta.env.MODE === 'artifact'`) the three
readers share. Analytics is skipped in this mode. Nothing above changes the
site build: `npm run build` prerenders 26 pages + `404.html` and 9 redirects.

## Server side

`src/routes.ts` is the one route table. `ui-router-server` compiles it into a
mount at the site root and is used twice:

- **`vite.config.ts`** — `serverRouterPlugin`, so `vite dev` and
  `vite preview` answer the same 302 for `/office` and the same honest 404
  for `/sheet/99` the deployed site does. Preview also serves the prerendered
  `dist/<subpath>/index.html` for a shell verdict (with or without the trailing
  slash), so what you curl is what Pages serves.
- **`prerender.ts`** — after `vite build`, every route is resolved to a
  verdict: `shell` writes `dist/<subpath>/index.html` with server-rendered
  markup, `redirect` becomes a line in `dist/_redirects`, and the `otherwise`
  projection becomes `dist/404.html`.

What rendered, what did not, and what the package would need to close the gap
is in [`SSR-VERDICT.md`](./SSR-VERDICT.md).

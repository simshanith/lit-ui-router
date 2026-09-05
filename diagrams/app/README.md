# diagrams/app — The Altitude Atlas, routed

The drawing set in `diagrams/` as one `lit-ui-router` single-page app. Shaped
like the repo's tutorial examples (`examples/helloworld`, `examples/hellosolarsystem-mobx`):
plain `npm`, its own `package-lock.json`, and every dependency taken from the
**published** registry — no workspace links.

```bash
npm install
npm run dev        # vite, with ui-router-server answering real 302s / 404s
npm run build      # vite build + node prerender.ts
npm run preview
npm run typecheck
```

The content is generated, never transcribed: `node generator/build.mjs .` from
`diagrams/` writes `app/public/sheets/<id>.html` (one chrome-less fragment per
sheet), `app/public/sheets/atlas.css` (the sheets' own chrome) and
`app/public/manifest.json` (one row per sheet: title, rev, which census plates
it reads, the cross-sheet references found in its prose, and the sheet's
standalone filename in the flat set). The seam is
`diagrams/generator/emit-app.mjs`.

## Where it lives

The app owns the site root of atlas.lit-ui-router.dev: `/`, `/sheet/7`,
`/megacanvas?at=7`, `/about`, `/office`. The flat drawing set — the pages this
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
| `view-rendered.ts`    | the missing "view has re-rendered" promise: lit's `updateComplete` on every `<ui-view>`, then on the `<atlas-plate>` it rendered | none — shared by the three below |
| `keyboard.ts`         | ← / → walk the set; focus lands on the arriving sheet's title | none — reads `router.globals`            |
| `megacanvas-pan.ts`   | the megacanvas as a reel that pans/zooms to `?at=<sheet>` | `onSuccess` + `viewRendered()`             |
| `analytics.ts`        | every `page_view` (the first included — the staged config has `send_page_view:false`), only if the staged page carries gtag (`VITE_GOOGLE_ANALYTICS_TRACKING_ID` at stage time, the flagship's own id) | `onSuccess` |

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

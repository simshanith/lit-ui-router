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
it reads, and the cross-sheet references found in its prose). The seam is
`diagrams/generator/emit-app.mjs`.

## Base vs experimental

The app is deliberately two layers, and they do not mix.

**Base — `src/*.ts`.** Exemplary, boring `lit-ui-router`: a route table
(`routes.ts`) projected as data and shared with the server, states with
`component` and `resolve` (`router.ts`), an abstract `atlas` shell whose view
renders the nav rail and a nested `<ui-view>` (`views.ts`), `uiSref` and
`uiSrefActive` on every link, `redirectTo` for `/office` → sheet 14, a
url-less `atlas.notFound` as the `otherwise` target, and the Navigation API
location plugin with a `pushState` fallback. Nothing in `src/*.ts` imports
anything from `src/experimental/`. This layer is meant to be liftable into
`examples/` as-is.

**Experimental — `src/experimental/`.** Optional motion, wired in by a single
call in `main.ts`. Delete the directory and that one line and the base app is
unchanged.

| Module                | What it does                                    | Router hook                                          |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| `view-transitions.ts` | slideshow between sheets (View Transitions API, CSS keyframe fallback) | `onBefore` for the snapshot; `transition.promise` + two animation frames for the release |
| `keyboard.ts`         | ← / → walk the set                              | none — reads `router.globals`                        |
| `megacanvas-pan.ts`   | the megacanvas as a reel that pans/zooms to `?at=<sheet>` | `onSuccess`                                |
| `analytics.ts`        | one `page_view` per navigation, only if the staged page carries gtag (`VITE_GOOGLE_ANALYTICS_TRACKING_ID` at stage time) | `onSuccess` |

Why `onBefore` for the slideshow: `document.startViewTransition()` snapshots
the document at the moment it is called, so it must run **before** any resolve
starts — `onStart` fires after resolves are already in flight, and a slow
fetch would then be frozen inside the old snapshot. Why
`transition.promise` + two frames for the release: ui-router has no "the view
has re-rendered" hook. `onSuccess` fires when the *transition* succeeded, and
`<ui-view>` swaps its component in a lit update after that — releasing on
`onSuccess` cross-fades to the old content. That gap is written up as a
package-level ask in [`SSR-VERDICT.md`](./SSR-VERDICT.md).

Every animation is inside `@media (prefers-reduced-motion: no-preference)`,
and each module also checks `matchMedia('(prefers-reduced-motion: reduce)')`
before doing any work.

## Server side

`src/routes.ts` is the one route table. `ui-router-server` compiles it into a
mount at `/app` and is used twice:

- **`vite.config.ts`** — `serverRouterPlugin`, so `vite dev` and
  `vite preview` answer the same 302 for `/app/office` and the same honest 404
  for `/app/sheet/99` the deployed site does.
- **`prerender.ts`** — after `vite build`, every route is resolved to a
  verdict: `shell` writes `dist/<subpath>/index.html` with server-rendered
  markup, `redirect` becomes a line in `dist/_redirects`, and the `otherwise`
  projection becomes `dist/404.html`.

What rendered, what did not, and what the package would need to close the gap
is in [`SSR-VERDICT.md`](./SSR-VERDICT.md).

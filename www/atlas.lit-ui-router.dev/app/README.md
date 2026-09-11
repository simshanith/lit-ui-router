# www/atlas.lit-ui-router.dev/app — The Altitude Atlas, routed

The drawing set in `www/atlas.lit-ui-router.dev/` as one `lit-ui-router` single-page app. Shaped like the repo's
tutorial examples (`examples/helloworld`, `examples/hellosolarsystem-mobx`): plain `npm`, its own
`package-lock.json`, and every dependency taken from the **published** registry — no workspace links.

```bash
npm install
npm run dev            # vite, with ui-router-server answering real 302s / 404s
npm run build          # vite build + node prerender.ts
npm run build:spa      # vite build alone, no prerender
npm run build:artifact # vite build --mode artifact + node artifact.ts
npm run preview
npm run typecheck
```

The content is generated, never transcribed. `node generator/build.mjs .` from `www/atlas.lit-ui-router.dev/` — the
seam is `generator/emit-app.mjs` — writes `public/sheets/<id>.html` (one chrome-less fragment per
plate), `public/sheets/atlas.css`, `src/generated/city-init.js`, and `public/manifest.json`: one row
per plate (title, rev, ALTITUDE wording, FIT VERDICT line, census plates read, cross-sheet
references, standalone filename in the flat set), an `issueLog` array, and a `cover` object carrying
the flat gallery's stat bar, survey, prose column and colophon as rendered HTML, so the routed index
draws the same bytes the flat one does. Twenty-five fragments: twenty-three sheets, one `appendix`
row (A1) and one `extras` row, the 3D city.

## The routes

| State            | Url            | View            | Resolves                          |
| ---------------- | -------------- | --------------- | --------------------------------- |
| `atlas`          | — (abstract)   | `ShellView`     | `manifest`                        |
| `atlas.gallery`  | `/?subject&projection&mode&basis&kv` | `GalleryView` | — (the key index's filter, five nullable params) |
| `atlas.sheet`    | `/sheet/:num`  | `SheetView`     | `sheet`, `fragment`               |
| `atlas.city`     | `/city`        | `CityView`      | `extra`, `fragment`, **`three`**  |
| `atlas.specimen` | `/specimen`    | `SpecimenView`  | **`specimen`** (its own element)  |
| `atlas.log`      | `/log`         | `LogView`       | `manifest` (its `issueLog`)       |
| `atlas.office`   | `/office`      | — `redirectTo`  | — (302 to `atlas.sheet` 14)       |
| `atlas.about`    | `/about`       | `AboutView`     | —                                 |
| `atlas.notFound` | — (url-less)   | `NotFoundView`  | — (the `otherwise` projection)    |

The twenty-three sheets are the nineteen SVG plates and four interactive lanes (1i, 2B, 12i, 14i).
`atlas.log` is the set's issue record — every REV across every plate, latest first — read from the
manifest. The megacanvas is not a state: the flat set publishes the whole reel as one page, so the
prerender writes `/megacanvas` and `/megacanvas/` → `/set/megacanvas.html` 301 into `_redirects`.

The manifest's **`appendix`** array is the third list, beside `sheets` and `extras`: a plate whose
subject is the atlas itself, at no altitude and with no census plate — today **A1 THE SPRITE
STUDY**. Its id is letter-FIRST, which is what marks it, and it is deliberately out of `sheets`, so
the rail's ascent block, the ← / → walk and the gallery's main card grid never pick it up; it rides
its own `APPENDIX` section and card grid. `mountsFor()` is fed BOTH lists, so `/sheet/A1` narrows
into the server's `/sheet/{num:…}` alternation and `/sheet/a1` 302s to the cased id exactly as
`/sheet/2a` does. `allSheets()`, `findSheet()` and `isAppendix()` in `src/manifest.ts` own it.

`atlas.city` is the 3D plate and the only state that loads a library on entry (see **Dependencies on
demand**). It is deliberately not a sheet: no sheet number, in the manifest's `extras` rather than
its `sheets`, and so invisible to the ascent order, the ← / → walk and the server's narrowed
`/sheet/{num:…}` — a rail entry and a cover card, nothing more.

`atlas.specimen` is a **bench, not a plate**: a type specimen that draws ONE mock sheet from the
set's own chrome and swaps every role token (`--display`, `--title`, `--rail-title`, `--data`,
`--prose`, `--hand`, `--code`) on its root by inline style, so six candidate pairings plus eight
independent knobs can be judged on real copy in both themes. It opens on `5 · THE ATLAS SET`, the
pairing the set ships; the other five are the record of what it was chosen against. It carries no
sheet number, is not in the manifest, and rides at the bottom of the rail as `S0·T`. It is the
second state to load something on entry: `src/specimen.ts` is a `resolve`, and its FIRST KNOB TOUCH
injects a Google Fonts `<link>` for the CANDIDATE stand-ins, on demand and on no other page.

**One font host per page.** `atlas.css` declares `--display` / `--title` / `--data` / `--prose` /
`--code` / `--hand` with the Adobe family first and the Google stand-in second (the PLATES keep
`--mono`, whose advance every SVG label is hand-placed against), and `index.html` carries the
Google links. On the site,
`generator/stage-site.mjs` injects the typekit `<link>` into **every staged page, routed and flat**,
when `VITE_ADOBE_FONTS_KIT` is set — it sits beside the GA id in the gitignored
`.config/mise/cloudflare.local.env` — **and strips the Google links**, so a staged page never
references `fonts.googleapis.com` or `fonts.gstatic.com`. Unset, the stage logs
`Adobe Fonts kit: none` and the stand-ins draw everywhere. The artifact build never passes through
the stager and keeps the Google links: its host allows that origin and no other. The specimen's
LOADED FACES readout reports which family actually rendered (ADOBE / STAND-IN / SYSTEM), and its
GLYPH SIZE readout measures the data face against the mono it replaces.

**The article, and the two wordmarks.** Almost every title in the set begins with THE. On a sheet
title and on a cover card it is drawn as `sup.art` (in `sheets/atlas.css`, from
`generator/chrome.mjs`): the word kept, set as a lowercase superior in the data face at 0.6em, soft
ink — no kit glyph, so the site, the flat set and the artifact draw it identically. The plates'
title block is the one exception: its SHEET TITLE field uses `.art-inline` instead, the same word at
the value's own size on its own baseline, because a ledger field is read as a value, not a headline.

The atlas's own name has exactly TWO variants. The FULL wordmark is plain uppercase
`THE ALTITUDE ATLAS` in the display face, and it belongs to the rail head and the cover title, so the
homepage says the name once in one voice. The CONDENSED wordmark is the ledger name — the SAME
display face for the name (`.mark`, at a measured 1.06em so its cap sits on the ledger line's), with
the article drawn as HWT Catchwords key `e` (`.cw`) on a host that DECLARES the kit, and as the
same `sup.art` superior off it — and it belongs to every sheet-head PROJECT line
(`the ALTITUDE ATLAS — DRAWING SET` / `— INTERACTIVE PLATE`) and to the title block's PROJECT value.
A guard script asks the FontFaceSet for the family and sets `data-catchwords` (`index.html` for the
app, `CATCHWORD_SCRIPT` in `chrome.mjs` for the flat pages), so the catchword can never degrade to a
bare letter; it is drawn at a flat 20px on `vertical-align: sub`, the size at which the two-line
mark still reads and the height at which it sits on the cap band of the name beside it.
`titles.ts`, `<title>` and every aria name keep the plain `THE ALTITUDE ATLAS`.

## Where it lives

The app owns the site root of atlas.lit-ui-router.dev: `/`, `/sheet/7`, `/city`, `/specimen`,
`/log`, `/about`, `/office`. The flat drawing set — the pages this app was cut from — is staged
beside it under `/set/` as the version to compare against, and the two link to each other: the
rail's THE FLAT SET entry and each sheet's STANDALONE PLATE crumb go out, the flat gallery's cover
links back. `src/routes.ts` holds the ONE base constant (`MOUNT`, `BASE`, `SET`, and the `href`
table both template sets use); vite's `base`, `<base href>` (via `%BASE_URL%`), the generator's
fragment links and the staged `_redirects` all derive from it. `generator/stage-site.mjs` assembles
`dist/`: this app at the root, the flat set under `dist/set/`, and one merged `_redirects` (the
prerender's lines, every old flat filename → `/set/`, and `/app/*` → `/:splat`).

## Base vs experimental

The app is deliberately two layers, and they do not mix.

**Base — `src/*.ts`.** Exemplary, boring `lit-ui-router`: a route table (`routes.ts`) projected as
data and shared with the server, states with `component` and `resolve` (`router.ts`), an abstract
`atlas` shell whose view renders the nav rail and a nested `<ui-view>` (`views.ts`), `uiSref` and
`uiSrefActive` on every link, `redirectTo` for `/office` → sheet 14, a url-less `atlas.notFound` as
the `otherwise` target, the Navigation API location plugin with a `pushState` fallback, document
titles set on `onSuccess` from `titles.ts` (the same strings the prerender writes), and the cover's
key index carried as typed query params on `atlas.gallery` — every chip a `uiSref`, every filtered
index a link. Every card and every plate page's `.plate-data` strip then draws the same
`keyBlock`: FORM's keys as a miniature of the plates' own title block (hairline cells, the data
face, no field names — position is the key), subject and the basis qualifier down the left,
a drawn projection glyph and the interactive lamp down the right. A carried slot is a `uiSref`
back into the filtered index and `uiSrefActive` echoes the applied filter on it. Two slots are
asymmetric on purpose: the mode lamp is drawn only when a plate is interactive (twenty STATIC
badges in twenty-five is noise) and `basis` holds its slot with an em dash off the city group.
The card is therefore an `<article>`, not an `<a>`: the `h3`'s link is the one primary link and
stretches over the card through a `::after`, and the key block sits above it on `z-index`, so
nothing interactive is nested inside a link. One finding from that: `rules.initial({ state })` targets the state with no params and
erases a first-load query; the function form hands `url.search` through (`router.ts`). Nothing in
`src/*.ts` imports anything from `src/experimental/`. This layer is meant to be liftable into
`examples/` as-is.

Three base-layer details a Playwright pass against the deployed site taught, each with a comment at
the line:

- `router.urlService.config.strictMode(false)` (`router.ts`). Cloudflare Pages serves
  `dist/sheet/7/index.html` and 308s `/sheet/7` onto `/sheet/7/`; core's default strict matching
  rejected the slash and booted every deep link into `atlas.notFound`. The server mount is compiled
  with the same `strict: false`.
- A `navigate` listener that calls `event.intercept()` for `isUIRouterNavigateEvent(event)`
  (`router.ts`). The Navigation API plugin calls `navigation.navigate()` and leaves interception to
  the app; without the listener every click was a cross-document load.
- Cased ids are canonical (`/sheet/2A`). `/sheet/2a` redirects to it on both sides: an `onBefore`
  guard in the browser, a redirect rule in the mount, and therefore a `_redirects` line from the
  prerender.

**Experimental — `src/experimental/`.** Optional motion, wired in by a single call in `main.ts`.
Delete the directory and that one line and the base app is unchanged.

| Module                | What it does                                    | Router hook                                          |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| `view-transitions.ts` | slideshow between sheets (View Transitions API, CSS keyframe fallback) | `onBefore` for the snapshot; `transition.promise` + `viewRendered()` for the release |
| `view-rendered.ts`    | the missing "view has re-rendered" promise: lit's `updateComplete` on every `<ui-view>`, then on the `<atlas-plate>` it rendered | none — shared by the two below |
| `keyboard.ts`         | ← / → walk the set; focus lands on the arriving sheet's title | none — reads `router.globals`            |
| `analytics.ts`        | only the `page_view`s gtag cannot see for itself (below), and only if the staged page carries gtag (`VITE_GOOGLE_ANALYTICS_TRACKING_ID` at stage time) | `onSuccess` |

**The analytics rule.** The atlas shares the flagship's GA stream, whose enhanced measurement counts
"page changes based on browser history events", so gtag already owns the initial `page_view` *and*
every pushState / replaceState / popstate. The one thing it cannot see is `navigation.navigate()`,
which the Navigation API location plugin uses and which never touches `history.pushState`.
`analytics.ts` therefore sends on `onSuccess` only when the router took that plugin
(`NAVIGATION_API`, exported from `router.ts`) AND the `navigate` event was a `push` or `replace` — a
`traverse` is back/forward, which fires popstate and is gtag's, and under the pushState fallback
nothing is sent. Verified in Playwright with a stubbed `gtag`.

**Dependencies on demand.** `atlas.city` is the one state that loads a library when it is entered:
`resolve: [{ token: 'three', resolveFn: () => import('three') }]`. Vite gives that dynamic import
its own chunk (`three.module-*.js`, 675 kB), and a Playwright request log confirms `/sheet/7/` never
fetches it while `/city/` does — the router is the loader, and the view is handed the namespace as a
resolve like any other value. The scene itself is `src/generated/city-init.js`, written by the
generator from the flat gallery's inline module: the app cannot run an inserted
`<script type="module">` (see `src/fragment.ts`) and its import must be bundled, not a cdnjs url, so
the generator emits the identical scene body as an ES module `initCity(root, THREE)` returning a
teardown. **`<atlas-city>` (`views.ts`) owns that teardown**, not a router hook: the scene holds a
WebGL context, two observers, a media listener and pending frames, the experimental layer is
deletable by design and this is not optional, and the element that created the scene is the one
thing whose lifetime matches it.

Why `onBefore` for the slideshow: `document.startViewTransition()` snapshots the document at the
moment it is called, so it must run **before** any resolve starts — `onStart` fires after resolves
are already in flight, and a slow fetch would then be frozen inside the old snapshot. Why
`transition.promise` + `updateComplete` for the release: ui-router has no "the view has re-rendered"
hook. `onSuccess` fires when the *transition* succeeded and `<ui-view>` swaps its component in a lit
update after that, so releasing there cross-fades to the old content; releasing two
`requestAnimationFrame`s later instead froze the page for four seconds per sheet, because rendering
is suspended while the snapshot is held and the frames never fire. `<ui-view>` is a `LitElement`, so
its `updateComplete` is the promise that was missing; `view-rendered.ts` awaits it, then the plate's
— a package-level ask in [`SSR-VERDICT.md`](./SSR-VERDICT.md).

Every animation is inside `@media (prefers-reduced-motion: no-preference)`, and each module also
checks `matchMedia('(prefers-reduced-motion: reduce)')` before doing any work.

## Artifact build

`npm run build:artifact` emits `dist-artifact/index.html` — the whole atlas as ONE self-contained
file (~2.8 MB; three.js is a quarter of it) that can be published as a claude.ai Artifact. That host
is strict in four ways, and each one is a line in the build:

- **One file, no fetches — not even same-origin.** `artifact.ts` bakes `public/manifest.json` and
  all twenty-five fragments into a `<script type="application/json" id="atlas-data">` island (every
  `<` escaped, so a fragment's own `</script>` cannot close it) and inlines `atlas.css` as a
  `<style>`; `src/manifest.ts` reads the island when present and falls back to the fetches the site
  uses. The cytoscape and three dynamic imports are folded into the single chunk by
  `vite-plugin-singlefile` (`useRecommendedBuildConfig`, which sets `output.codeSplitting = false`
  on vite 8), so `#/city` raises the scene with the network entirely blocked.
- **The host owns the document skeleton.** The published file must carry no
  `<!DOCTYPE>`/`<html>`/`<head>`/`<body>` of its own, and only its first 8KB is scanned for
  `<title>`, so `artifact.ts` strips the wrapper and moves the title to byte 0.
- **The page sits on an opaque origin path**, so path routing is out: `src/router.ts` takes
  `hashLocationPlugin` instead of the Navigation API/pushState pair, and every url becomes
  `#/sheet/7`. `uiSref` writes those hrefs itself; `views.ts` prefixes its static `href` attributes.
- **The flat set does not exist offline**, so `THE FLAT SET ↗` and each sheet's `STANDALONE PLATE ↗`
  point at `https://atlas.lit-ui-router.dev/set/…` in a new tab.

`src/mode.ts` is the one flag (`import.meta.env.MODE === 'artifact'`) the readers share; analytics
is skipped in this mode. Nothing above changes the site build, which prerenders 29 pages +
`404.html` and 10 redirects.

## Server side

`src/routes.ts` is the one route table. `ui-router-server` compiles it into a mount at the site root
and is used twice:

- **`vite.config.ts`** — `serverRouterPlugin`, so `vite dev` and `vite preview` answer the same 302
  for `/office` and the same honest 404 for `/sheet/99` the deployed site does. Preview also serves
  the prerendered `dist/<subpath>/index.html` for a shell verdict, slash or no slash, so what you
  curl is what Pages serves.
- **`prerender.ts`** — after `vite build`, every route is resolved to a verdict: `shell` writes
  `dist/<subpath>/index.html` with server-rendered markup, `redirect` becomes a line in
  `dist/_redirects`, and the `otherwise` projection becomes `dist/404.html`.

What rendered, what did not, and what the package would need to close the gap is in
[`SSR-VERDICT.md`](./SSR-VERDICT.md).

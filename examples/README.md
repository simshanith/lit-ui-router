# Examples

This folder contains standalone example projects demonstrating lit-ui-router usage. The tutorial examples escalate in scope — start with **helloworld**, then work outward through the solar system and into the galaxy. **helloworld-buildless** is the first rung again in plain JavaScript, loaded by the browser as written through an import map, with no build step. **design-system-links** is not a tutorial rung: it is live documentation for one API surface, embedded in the guide that explains it. **hellosolarsystem-mobx** is not a rung either: it is the solar-system rung rebuilt on the MobX bindings, embedded in the pages that document them. Nor is **hellosolarsystem-signals**: it is the solar-system rung with app state and router state joined through [TC39 Signals](https://lit-ui-router.dev/packages/signals), and handed to routed views through [`@lit/context`](https://lit.dev/docs/data/context/). Nor is **hellogalaxy-effect**: it is the galaxy rung rebuilt on [Effect](https://effect.website) and the [Effect bindings](https://lit-ui-router.dev/packages/lit-ui-router-effect), with the resolve-and-scope plugin it also needs inlined as a spike that neither Effect package ships. Nor is **hellogalaxy-signals**: it is the galaxy rung with both Lit signal bindings, `@lit-labs/signals` and [`lit-ui-router-signals`](https://lit-ui-router.dev/packages/lit-ui-router-signals), on one signal graph. Nor is **lint-eslint**: it is the consumer wiring of [`eslint-plugin-lit-ui-router`](https://lit-ui-router.dev/packages/eslint-plugin), installed from npm exactly as a consumer would, and it renders its own lint report in the page. Nor is **navigation-api**: it is the escape hatch documented on the [Navigation API plugin page](https://lit-ui-router.dev/packages/navigation-plugin#reaching-past-the-router), a `navigate` listener for the one navigation the router does not own. Nor is **loading-and-error-views**: it is the [Loading and Error Views guide](https://lit-ui-router.dev/guides/loading-and-error-views)'s recipes in one app, built on transition hooks and state `data`.

## StackBlitz Integration

Each example is a self-contained TypeScript project (Vite for the tutorial rungs) designed to run directly on [StackBlitz](https://stackblitz.com/). You can open any example in the table below using the GitHub integration:

```text
https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/<example-name>
```

See [StackBlitz Tips & Best Practices](https://developer.stackblitz.com/guides/integration/open-from-github#tips-best-practices)

### Available Examples

| Example                      | Description                                                                                                  | StackBlitz                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **helloworld**               | Ultra-minimal starter: two states with `uiSref`/`uiSrefActive` navigation                                    | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/helloworld)               |
| **helloworld-buildless**     | The same starter in plain JavaScript: an import map to a CDN, no TypeScript and no build step                | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/helloworld-buildless)     |
| **hellosolarsystem**         | Solar System tour: route parameters and async `resolve` data with a master/detail flow                       | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem)         |
| **hellosolarsystem-mobx**    | The same tour rebuilt on `lit-ui-router-mobx`: an observable router store, reactions, and a computed tour    | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem-mobx)    |
| **hellosolarsystem-signals** | The same tour with `lit-ui-router-signals` and `@lit/context`: a provided unit signal, the consumed router   | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem-signals) |
| **hellogalaxy**              | Milky Way explorer: nested states and views, resolve inheritance, and a 3D model-viewer surprise             | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellogalaxy)              |
| **hellogalaxy-effect**       | The same explorer rebuilt on Effect: typed resolve inheritance, state-scoped fibers, and interruptible loads | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellogalaxy-effect)       |
| **hellogalaxy-signals**      | The same explorer with both Lit signal bindings: a star chart shared by nested views, route-driven crumbs    | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellogalaxy-signals)      |
| **design-system-links**      | `uiSref` driving a design-system link element (`<sp-link>`): `assignHref: true` vs `'auto'`                  | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/design-system-links)      |
| **lint-eslint**              | `eslint-plugin-lit-ui-router` the ESLint-only way, with the lint report rendered in the page                 | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/lint-eslint)              |
| **navigation-api**           | `ui-router-navigation-location-plugin` with an app `navigate` listener that holds a link leaving the app     | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/navigation-api)           |
| **loading-and-error-views**  | Per-route pending and error views from transition hooks and inherited `data`, a NOWAIT resolve, and retry    | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/loading-and-error-views)  |

## What Each Example Teaches

### helloworld

The smallest possible lit-ui-router app.

- Defining states with `LitStateDeclaration` and registering them with the router
- Navigating with the `uiSref` directive
- Highlighting the current route with `uiSrefActive`
- Rendering routed content with inline `html` template components in a `<ui-view>`

### helloworld-buildless

**helloworld** in plain JavaScript, with no build step. The browser loads `public/main.js` as written.

- **An import map** in `public/index.html` resolves `lit`, `@uirouter/core` and `lit-ui-router` to [esm.sh](https://esm.sh), at the exact versions its `package-lock.json` installs; `embeds.test.ts` fails when they drift apart. `lit-ui-router`'s URL carries esm.sh's `*` prefix, which leaves its own imports bare for the map to resolve, so the page loads one copy of `lit`
- **No decorators or type annotations:** `customElements.define` registers the shell, and the state declarations are plain objects
- **No bundler.** `public/` is the whole site, served as written by [`serve`](https://github.com/vercel/serve); `npm run build` copies it to `dist/`
- **Still typechecked.** The other npm dependencies are for the editor: `tsconfig.json` checks `main.js` against the published types with `checkJs`, so the editor (StackBlitz included) shows completions, hover types and type errors without a single annotation, and `typecheck:example:helloworld-buildless` enforces it in CI. Nothing at runtime reads `node_modules`

### hellosolarsystem

A tour of the Sun, all 8 planets, and a beloved dwarf-planet easter egg — real facts (distance, diameter, moons, orbital period) with CSS-gradient orbs log-scaled by diameter. No extra dependencies.

- Route parameters: a `planets` list state and a `planet` detail state at `/planets/:planetId`
- Fetching data before a state activates with `resolve` and a data service with simulated async latency
- Reading route parameters inside a resolve via `deps: ['$transition$']`
- Consuming resolved data in components through `UIViewInjectedProps`

### hellosolarsystem-mobx

The same states, URLs, resolves and templates as **hellosolarsystem**, rebuilt with the [MobX bindings](https://lit-ui-router.dev/packages/lit-ui-router-mobx). Resolves still arrive as `UIViewInjectedProps`; everything that outlives a single activation is observed instead.

It layers on four things, each answering a different question:

- **Where am I now?** `RouterReactionController` in the un-routed `<app-root>`, which never receives fresh view props. These states are flat, as the vanilla rung's are — nesting is **hellogalaxy**'s lesson — so `uiSrefActive` cannot keep the nav lit on the detail view by itself. The controller selects `RouterStore.includes('planet')`, the observable form of the same primitive, and the nav goes on answering to the route rather than to app state
- **Where have I been, and what did the route resolve?** One `onSuccess` hook records both, because both are facts about the same completed arrival: it reads the state's own resolve and appends a stop. `onSuccess` rather than `onEnter` on purpose — an entering hook fires while the transition is still in flight, and a later hook can still redirect or fail it, so a tour built on `onEnter` can record arrivals that never happened. No component parses a route param
- **What is worth doing outside the component tree?** A plain MobX `reaction` over `RouterStore` drives the tab title. No host, no controller, nothing to re-render — the bindings' store is an ordinary observable, so application code can react to the router without a component in the middle
- **What follows from all that?** `visited` is a `computed` over the trail, so revisiting the list never inflates it. `<planet-list>` selects it through a `ReactionController`; `<app-root>` selects an object off the same store with `equals: compareStructural`, so it re-renders when that selection changes rather than on every stop added

The states are declared `as const` and registered with [`ui-router-registry`](https://lit-ui-router.dev/packages/ui-router-registry), whose `/mobx` entry point types `RouterStore`: `includes('planet')` takes only a registered state name.

It is the minimal layering, not a rewrite: the vanilla example's plumbing stays put and MobX goes only where the router stops helping. The [sample apps](../apps) are the direct side-by-side — two complete builds of the same application, one on `TransitionController` and one on these bindings

### hellosolarsystem-signals

**hellosolarsystem** on [`lit-ui-router-signals`](https://lit-ui-router.dev/packages/lit-ui-router-signals), with the router's `RouterSignals` and the app's own `Signal.State`s read side by side. The states and resolves are the vanilla ones. The one change is that `planetId` uses ui-router's `int` param type, so it reaches every reader as a number.

- `<app-root>` sits outside every `<ui-view>`, so a `RouterSignalController` selects the body the URL names and renders previous/next links for it. The arrow keys step along the same links.
- The routed list and detail are constructed by the router, so `<app-root>` cannot pass them props. It `@provide`s a distance-unit `Signal.State` instead, and each view `@consume`s it. Context delivers the signal once, when the view connects; the signal carries every change after that, read through `SignalController`, so the provider never re-provides and no request subscribes.
- `<app-root>` `@consume`s `routerContext` from `lit-ui-router/context` for the arrow keys, rather than closing over the module's router. `<ui-router>` answers the request, the same one `RouterSignalController` makes to find the router.
- The detail view's light-travel clock is a `Signal.State` whose `watched`/`unwatched` callbacks start and stop its timer, so the clock runs only while a view reads it.
- `document.title` follows the route through a bare `watchSelection` from `ui-router-signals`, with no component involved.
- The states are declared `as const` and registered with [`ui-router-registry`](https://lit-ui-router.dev/packages/ui-router-registry). Its `/signals` entry point types the `RouterSignals.route` snapshot, so `includes('planet')` narrows `params.planetId` to a number with no cast, and a `TypedStateService` checks the arrow keys' `go('planet', { planetId })`.

### hellogalaxy

A Milky Way explorer built on a real star catalog (Sirius, Vega, Polaris, Betelgeuse, Proxima Centauri, and more) with spectral class, constellation, distance, and magnitude data — plus the Smithsonian's 3D scan of Neil Armstrong's spacesuit rendered with [`@google/model-viewer`](https://modelviewer.dev/).

- Nested states via dot notation: `galaxy` → `galaxy.stars` → `galaxy.stars.star`, with `redirectTo` on the parent
- Nested `<ui-view>` elements for a master/detail layout, with slotted fallback content
- Resolve inheritance: the `star` resolve declares `deps: ['$transition$', 'stars']` on the parent state's resolved catalog
- Relative sref targets (`.star`) for linking to child states
- Sibling states: `galaxy.astronaut` renders a 3D model alongside the star explorer, lazy-loading model-viewer via a resolve

### hellogalaxy-effect

The same states, URLs, templates, star catalog and model-viewer as **hellogalaxy**, rebuilt on [Effect](https://effect.website). Resolves still arrive as `UIViewInjectedProps`; what changes is what a resolve, a hook and a state's lifetime are made of. The route ref comes from [`ui-router-effect`](https://lit-ui-router.dev/packages/ui-router-effect) and the controllers that follow it from [`lit-ui-router-effect`](https://lit-ui-router.dev/packages/lit-ui-router-effect), both installed from npm. The plugin that bridges the rest — `src/effect-plugin.ts` — is inlined in the example on purpose: it is a spike that neither package ships, so it consumes `effect` directly and touches only public `@uirouter/core` API.

It layers on four things, each answering a different question:

- **Who provides what?** `galaxy.stars` resolves its catalog with `provide(StarCatalog, ...)` — a resolve whose token is the `Context.Service`'s key. `galaxy.stars.star` then writes `const catalog = yield* StarCatalog` with no `deps` array at all: the plugin builds a `Context` from every service-tagged resolve already resolved on the path, plus a `CurrentTransition` service, and provides it to the child's Effect. An unknown `:starId` is a typed `StarNotFound`, caught with `Effect.catchTag` in a hook-bridge `onBefore` that returns a `TargetState` redirect instead of a failed transition
- **What lives as long as a state?** A `scoped` property on the declaration, bracketed on `onSuccess` only — never `onEnter`/`onExit`, which fire while the transition can still be superseded. `galaxy` opens an observatory session for the whole visit; `galaxy.stars.star` forks a one-second ticker into its own `Scope`. Star-to-star navigation closes and reopens the child scope while the session above it survives, and leaving for the astronaut releases only the star's
- **What happens when the user changes their mind mid-load?** The astronaut resolve is an Effect: the model-viewer import, then the ~9 MB `.glb` itself, downloaded with `effect/http`'s `HttpClient` under `Effect.timeout` and a short retry `Schedule`. The bytes become a blob URL the view hands to `<model-viewer src>`, so the model crosses the network once and the state's `scoped` bracket revokes it on exit. Every hook effect and every resolve for a transition is forked into a per-transition `FiberSet`, interrupted the moment another transition **starts** — a transition's own promise only rejects once its in-flight resolves settle, which is far too late to abort them, and `onStart` rather than `onCreate` because core creates a transition before deciding it duplicates the one already running. So clicking Astronaut then Stars aborts the download rather than racing it, and clicking Astronaut twice does not abort itself
- **Where am I now?** `lit-ui-router-effect`'s `RouterRefController` in the un-routed `<app-root>`, which never receives fresh view props. It follows the package's route ref — a `SubscriptionRef` fed from one `onSuccess` hook — and selects `route.includes('galaxy.stars')` so the marker stays lit on the nested detail view — the same reasoning as the MobX rung, on a stream instead of a reaction. `<star-detail>` and `<fiber-log>` follow the example's own refs through the base `RefController`, on the app's `ManagedRuntime`

The states are declared `as const` and registered with [`ui-router-registry`](https://lit-ui-router.dev/packages/ui-router-registry), whose `/effect` entry point types the route ref: `route.includes('galaxy.stars')` and the hook's `TypedStateService` redirect take only registered state names.

`<fiber-log>` at the foot of the page renders the plugin's log ref, so every scope open and close, every resolve start, finish and interruption is visible in the order the fibers ran them.

It is the minimal layering, not a rewrite: the vanilla rung's plumbing stays put and Effect goes only where the router stops helping

### hellogalaxy-signals

**hellogalaxy** with a star chart. The two Lit signal bindings share one `signal-polyfill` graph. States, URLs and resolves are unchanged.

- The `charted` set is a `signal` from [`@lit-labs/signals`](https://www.npmjs.com/package/@lit-labs/signals). The star detail's toggle writes it, and the star list reads it through a `SignalController` from [`lit-ui-router-signals`](https://lit-ui-router.dev/packages/lit-ui-router-signals). The list stays mounted while `galaxy.stars.star` changes beneath it.
- The `galaxy` shell is a `SignalWatcher`. It binds a `computed` summary of the chart with `watch()`, so charting a star updates that text node and never re-renders the shell.
- The shell's own view props never change while its children do. A `RouterSignalController` builds its breadcrumb from `RouterSignals.current`, and the star's crumb takes its label from the transition's resolved `star` rather than a second lookup.
- The states are declared `as const` and registered with [`ui-router-registry`](https://lit-ui-router.dev/packages/ui-router-registry), whose `/signals` entry point types the `RouterSignals.route` snapshot by their names and params.

### design-system-links

Three links to two states, printing each element's live `href` attribute: an [`<sp-link>`](https://opensource.adobe.com/spectrum-web-components/components/link/) with `assignHref: true`, the same element with `'auto'`, and a plain `<a>` with `'auto'`. All three navigate; only the `href` differs. Embedded in the [Design System Links guide](https://lit-ui-router.dev/guides/design-system-links).

- `assignHref: true` — the escape hatch for a custom element that declares its own `href`
- `assignHref: 'auto'` — writes the attribute only to `<a>`, `<area>` and SVG `<a>`
- Spectrum Web Components (`@spectrum-web-components/link` + `theme`) as a real published design system, npm-installed like every other example dependency

### lint-eslint

A Vite project that lints itself: the same small lit app as **helloworld**, an `eslint.config.js` wired the way the [plugin README](../packages/eslint-plugin-lit-ui-router/README.md) documents, and a `<lint-report>` panel under the nav showing what ESLint found.

- `litA11y.configs.recommended` first, then `...litUiRouter.configs.recommended` — ours turns `lit-a11y/anchor-is-valid` off and enables `lit-ui-router/anchor-is-valid`
- `settings.linkElements: ['sp-link']` — the design system's link element declared once for both rules that ask whether a tag is a link, with its own ✓/✗ pair in the gallery
- `typescript-eslint` over `src/**/*.ts`, syntax-only: the rule reads the template AST, never type information
- `typescript` pinned to the 6 line, because typescript-eslint needs the TypeScript JS API that TS 7 no longer ships
- A local Vite plugin in `vite.config.ts` (no extra dependency) serving a `virtual:lint-report` module: `ESLint#lintFiles()` in its `load` hook, re-run on save via `server.reloadModule`, baked into `dist` by `vite build`
- Two views of the same results on a tab strip: a data-only `<lint-report>` lit element, and an `<iframe>` of ESLint's own built-in `html` formatter
- `uiSref` anchors that lint clean, with the positive control written up in the example's README
- `lint:tap` (one TAP line per file) alongside the plain `lint`, and `lint:watch` (chokidar-cli + `eslint-formatter-pretty`) as the terminal-only alternative to the dev server

The oxlint wiring (`jsPlugins` in `.oxlintrc.json`) has no example of its own: this monorepo's root config already lints every example with it, and oxlint ships native bindings with no `wasm32-wasi` build, so it cannot run on StackBlitz at all.

### navigation-api

An inbox on [`ui-router-navigation-location-plugin`](https://lit-ui-router.dev/packages/navigation-plugin), with a draft field kept outside the `<ui-view>` and a log of every Navigation API event. Embedded in the plugin page's [Reaching past the router](https://lit-ui-router.dev/packages/navigation-plugin#reaching-past-the-router) section, which says when an app's own `navigate` listener is correct and when it is a smell.

- **The navigation the router does not own.** Sign out is a plain `<a href>` to `signed-out.html`, a static page in `public/`. The router never sees it, so the app's `navigate` listener holds it with `preventDefault()` while the draft is unsaved, and "Leave anyway" re-issues it with an `info` the listener lets through. `beforeunload` covers the typed URL and the closed tab, which never fire `navigate`
- **The navigations the router does own.** Inbox and Archive are `uiSref` links. The listener only logs them, recognised with `isUIRouterNavigateEvent`; the plugin intercepts them itself
- **Work scoped to a navigation.** The plugin's `intercept` option runs a simulated prefetch on each router navigation, bound to `event.signal`, so a navigation that supersedes it aborts it and the log shows the `AbortError`
- **A static host.** `<base href="%BASE_URL%">` gives the plugin the embed's path prefix, and the one state keeps its URLs on that path with a `?folder` query parameter, so a reload or a back into the app never asks the host for a path it does not serve
- **No Navigation API.** The page says so and stops; an app falls back to `pushStateLocationPlugin`, which has no `navigate` event to listen to

### loading-and-error-views

Three pages behind a simulated server, with a _Fail requests_ checkbox that makes every request reject. Embedded in the [Loading and Error Views guide](https://lit-ui-router.dev/guides/loading-and-error-views).

- **Pending views.** A `TransitionController` in the shell observes `onStart` and clears its flag when the transition's `promise` settles, on success or failure. While it is set past a short delay, the shell hides the `<ui-view>` and renders the pending view the target state's `data.pending` names, or a default spinner
- **Inherited `data`.** `account` names a skeleton and an `account.error` state in its `data`; `account.profile` and `account.activity` inherit both, while the top-level `report` falls back to the shell's spinner and the `error` state
- **Error views.** An `onError` hook sends a transition whose resolve rejected to the error state its target inherits, with the failed `TargetState` as a param and `{ location: false }`. The error view's Retry is a new transition to that target
- **NOWAIT.** `account.activity`'s resolve does not hold the transition: the view renders the promise with `until()`, shows a skeleton, and retries a rejection in place with `stateService.reload`

## Running Locally

To run an example locally:

```bash
cd examples/<example-name>
npm install
npm run dev
```

The lint example runs the same way; `npm run lint` gives you the same report in the terminal, and `npm run lint:watch` re-lints on save without a browser.

In the monorepo, a root `pnpm install` also installs each example's own npm dependencies via this package's `postinstall` hook. pnpm skips lifecycle scripts when the workspace is already up to date, so to restore a manually deleted `examples/<example-name>/node_modules` run the hook directly:

```bash
pnpm --filter examples postinstall
# or a single example:
pnpm --filter examples example:install:<example-name>
```

`pnpm --filter examples lint:examples` fans out over each example's own `lint` script; `lint:oxlint` is one `oxlint` pass against the repo's root config, which covers every example with the same plugin rule. `turbo run lint` runs both.

## Docs Embeds

Each example is also built for the docs site (`turbo run build:embeds --filter=examples`) and embedded same-origin at `/examples/<example-name>/`. The docs reserve the embed's height up front — before the iframe loads, so the page doesn't shift when the example paints — from the `EXAMPLES` map in `www/lit-ui-router.dev/.vitepress/theme/components/examples.ts`.

Changing what an example renders can outgrow that reservation, which shows up as a scrollbar inside the embed. Reservations are capped (see `examples/embeds.ts`); an example taller than the cap reserves the cap and scrolls inside the embed. Measure it:

```bash
turbo run check:embeds --filter=@www/lit-ui-router.dev
```

It drives every state each built example's own links reach, in headless Chromium at the docs content column, and reports the tallest against the declared height — with the value to use when one no longer fits. Text wraps at engine-specific metrics, so the numbers are host-dependent by a percent or so; that is why the reservations carry slack and why this is a local check rather than a CI gate.

## Project Structure

Every example follows the same structure (the lint example adds `eslint.config.js`; **helloworld-buildless** has `public/index.html` and `public/main.js` in place of `index.html`, `src/main.ts` and `vite.config.ts`):

```text
<example-name>/
├── index.html          # Entry HTML file
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite configuration
└── src/
    └── main.ts         # Application entry point
```

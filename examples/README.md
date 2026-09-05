# Examples

This folder contains standalone example projects demonstrating lit-ui-router usage. The tutorial examples escalate in scope — start with **helloworld**, then work outward through the solar system and into the galaxy. **design-system-links** is not a tutorial rung: it is live documentation for one API surface, embedded in the guide that explains it. **hellosolarsystem-mobx** is not a rung either: it is the solar-system rung rebuilt on the MobX bindings, embedded in the pages that document them. Nor is **hellogalaxy-effect**: it is the galaxy rung rebuilt on [Effect](https://effect.website), with the router plugin it would need inlined as a spike of a future `ui-router-effect` package. Nor is **lint-eslint**: it is the consumer wiring of [`eslint-plugin-lit-ui-router`](https://lit-ui-router.dev/packages/eslint-plugin), installed from npm exactly as a consumer would, and it renders its own lint report in the page.

## StackBlitz Integration

Each example is a self-contained TypeScript project (Vite for the tutorial rungs) designed to run directly on [StackBlitz](https://stackblitz.com/). You can open any example in the table below using the GitHub integration:

```text
https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/<example-name>
```

See [StackBlitz Tips & Best Practices](https://developer.stackblitz.com/guides/integration/open-from-github#tips-best-practices)

### Available Examples

| Example                   | Description                                                                                                  | StackBlitz                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **helloworld**            | Ultra-minimal starter: two states with `uiSref`/`uiSrefActive` navigation                                    | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/helloworld)            |
| **hellosolarsystem**      | Solar System tour: route parameters and async `resolve` data with a master/detail flow                       | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem)      |
| **hellosolarsystem-mobx** | The same tour rebuilt on `lit-ui-router-mobx`: an observable router store, reactions, and a computed tour    | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem-mobx) |
| **hellogalaxy**           | Milky Way explorer: nested states and views, resolve inheritance, and a 3D model-viewer surprise             | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellogalaxy)           |
| **hellogalaxy-effect**    | The same explorer rebuilt on Effect: typed resolve inheritance, state-scoped fibers, and interruptible loads | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellogalaxy-effect)    |
| **design-system-links**   | `uiSref` driving a design-system link element (`<sp-link>`): `assignHref: true` vs `'auto'`                  | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/design-system-links)   |
| **lint-eslint**           | `eslint-plugin-lit-ui-router` the ESLint-only way, with the lint report rendered in the page                 | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/lint-eslint)           |

## What Each Example Teaches

### helloworld

The smallest possible lit-ui-router app.

- Defining states with `LitStateDeclaration` and registering them with the router
- Navigating with the `uiSref` directive
- Highlighting the current route with `uiSrefActive`
- Rendering routed content with inline `html` template components in a `<ui-view>`

### hellosolarsystem

A tour of the Sun, all 8 planets, and a beloved dwarf-planet easter egg — real facts (distance, diameter, moons, orbital period) with CSS-gradient orbs log-scaled by diameter. No extra dependencies.

- Route parameters: a `planets` list state and a `planet` detail state at `/planets/:planetId`
- Fetching data before a state activates with `resolve` and a data service with simulated async latency
- Reading route parameters inside a resolve via `deps: ['$transition$']`
- Consuming resolved data in components through `UIViewInjectedProps`

### hellosolarsystem-mobx

The same states, URLs, resolves and templates as **hellosolarsystem**, rebuilt with the [MobX bindings](https://lit-ui-router.dev/packages/mobx). Resolves still arrive as `UIViewInjectedProps`; everything that outlives a single activation is observed instead.

It layers on four things, each answering a different question:

- **Where am I now?** `RouterReactionController` in the un-routed `<app-root>`, which never receives fresh view props. These states are flat, as the vanilla rung's are — nesting is **hellogalaxy**'s lesson — so `uiSrefActive` cannot keep the nav lit on the detail view by itself. The controller selects `RouterStore.includes('planet')`, the observable form of the same primitive, and the nav goes on answering to the route rather than to app state
- **Where have I been, and what did the route resolve?** One `onSuccess` hook records both, because both are facts about the same completed arrival: it reads the state's own resolve and appends a stop. `onSuccess` rather than `onEnter` on purpose — an entering hook fires while the transition is still in flight, and a later hook can still redirect or fail it, so a tour built on `onEnter` can record arrivals that never happened. No component parses a route param
- **What is worth doing outside the component tree?** A plain MobX `reaction` over `RouterStore` drives the tab title. No host, no controller, nothing to re-render — the bindings' store is an ordinary observable, so application code can react to the router without a component in the middle
- **What follows from all that?** `visited` is a `computed` over the trail, so revisiting the list never inflates it. `<planet-list>` selects it through a `ReactionController`; `<app-root>` selects an object off the same store with `equals: compareStructural`, so it re-renders when that selection changes rather than on every stop added

It is the minimal layering, not a rewrite: the vanilla example's plumbing stays put and MobX goes only where the router stops helping. The [sample apps](../apps) are the direct side-by-side — two complete builds of the same application, one on `TransitionController` and one on these bindings

### hellogalaxy

A Milky Way explorer built on a real star catalog (Sirius, Vega, Polaris, Betelgeuse, Proxima Centauri, and more) with spectral class, constellation, distance, and magnitude data — plus the Smithsonian's 3D scan of Neil Armstrong's spacesuit rendered with [`@google/model-viewer`](https://modelviewer.dev/).

- Nested states via dot notation: `galaxy` → `galaxy.stars` → `galaxy.stars.star`, with `redirectTo` on the parent
- Nested `<ui-view>` elements for a master/detail layout, with slotted fallback content
- Resolve inheritance: the `star` resolve declares `deps: ['$transition$', 'stars']` on the parent state's resolved catalog
- Relative sref targets (`.star`) for linking to child states
- Sibling states: `galaxy.astronaut` renders a 3D model alongside the star explorer, lazy-loading model-viewer via a resolve

### hellogalaxy-effect

The same states, URLs, templates, star catalog and model-viewer as **hellogalaxy**, rebuilt on [Effect](https://effect.website). Resolves still arrive as `UIViewInjectedProps`; what changes is what a resolve, a hook and a state's lifetime are made of. The plugin that bridges the two — `src/effect-plugin.ts` and `src/router-ref-controller.ts` — is inlined in the example on purpose: it is a spike of a future `ui-router-effect` package, not a published one, so it consumes `effect` directly and touches only public `@uirouter/core` API.

It layers on four things, each answering a different question:

- **Who provides what?** `galaxy.stars` resolves its catalog with `provide(StarCatalog, ...)` — a resolve whose token is the `Context.Tag`'s key. `galaxy.stars.star` then writes `const catalog = yield* StarCatalog` with no `deps` array at all: the plugin builds a `Context` from every service-tagged resolve already resolved on the path, plus a `CurrentTransition` service, and provides it to the child's Effect. An unknown `:starId` is a typed `StarNotFound`, caught with `Effect.catchTag` in a hook-bridge `onBefore` that returns a `TargetState` redirect instead of a failed transition
- **What lives as long as a state?** A `scoped` property on the declaration, bracketed on `onSuccess` only — never `onEnter`/`onExit`, which fire while the transition can still be superseded. `galaxy` opens an observatory session for the whole visit; `galaxy.stars.star` forks a one-second ticker into its own `Scope`. Star-to-star navigation closes and reopens the child scope while the session above it survives, and leaving for the astronaut releases only the star's
- **What happens when the user changes their mind mid-load?** The astronaut resolve is an Effect: a deliberate `Effect.sleep`, then the model-viewer import and a real `fetch` of the `.glb` whose `AbortSignal` is wired to interruption, under `Effect.timeout` and a short retry `Schedule`. Every hook effect and every resolve for a transition is forked into a per-transition `FiberSet`, interrupted the moment another transition is created — a transition's own promise only rejects once its in-flight resolves settle, which is far too late to abort them. So clicking Astronaut then Stars aborts the download rather than racing it
- **Where am I now?** `RouterRefController` in the un-routed `<app-root>`, which never receives fresh view props. It forks `Stream.runForEach` over a `SubscriptionRef` the plugin updates from one `onSuccess` hook, and selects `includes('galaxy.stars')`-style state so the marker stays lit on the nested detail view — the same reasoning as the MobX rung, on a stream instead of a reaction

`<fiber-log>` at the foot of the page renders the plugin's log ref, so every scope open and close, every resolve start, finish and interruption is visible in the order the fibers ran them.

It is the minimal layering, not a rewrite: the vanilla rung's plumbing stays put and Effect goes only where the router stops helping

### design-system-links

Three links to two states, printing each element's live `href` attribute: an [`<sp-link>`](https://opensource.adobe.com/spectrum-web-components/components/link/) with `assignHref: true`, the same element with `'auto'`, and a plain `<a>` with `'auto'`. All three navigate; only the `href` differs. Embedded in the [Design System Links guide](https://lit-ui-router.dev/guides/design-system-links).

- `assignHref: true` — the escape hatch for a custom element that declares its own `href`
- `assignHref: 'auto'` — writes the attribute only to `<a>`, `<area>` and SVG `<a>`
- Spectrum Web Components (`@spectrum-web-components/link` + `theme`) as a real published design system, npm-installed like every other example dependency

### lint-eslint

A Vite project that lints itself: the same small lit app as **helloworld**, an `eslint.config.js` wired the way the [plugin README](../packages/eslint-plugin-lit-ui-router/README.md) documents, and a `<lint-report>` panel under the nav showing what ESLint found.

- `litA11y.configs.recommended` first, then `...litUiRouter.configs.recommended` — ours turns `lit-a11y/anchor-is-valid` off and enables `lit-ui-router/anchor-is-valid`
- `typescript-eslint` over `src/**/*.ts`, syntax-only: the rule reads the template AST, never type information
- `typescript` pinned to the 6 line, because typescript-eslint needs the TypeScript JS API that TS 7 no longer ships
- A local Vite plugin in `vite.config.ts` (no extra dependency) serving a `virtual:lint-report` module: `ESLint#lintFiles()` in its `load` hook, re-run on save via `server.reloadModule`, baked into `dist` by `vite build`
- Two views of the same results on a tab strip: a data-only `<lint-report>` lit element, and an `<iframe>` of ESLint's own built-in `html` formatter
- `uiSref` anchors that lint clean, with the positive control written up in the example's README
- `lint:tap` (one TAP line per file) alongside the plain `lint`, and `lint:watch` (chokidar-cli + `eslint-formatter-pretty`) as the terminal-only alternative to the dev server

The oxlint wiring (`jsPlugins` in `.oxlintrc.json`) has no example of its own: this monorepo's root config already lints every example with it, and oxlint ships native bindings with no `wasm32-wasi` build, so it cannot run on StackBlitz at all.

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

`pnpm --filter examples lint` fans out over each example's own `lint` script plus one `oxlint` pass against the repo's root config, which covers every example with the same plugin rule.

## Docs Embeds

Each example is also built for the docs site (`turbo run build:embeds --filter=examples`) and embedded same-origin at `/examples/<example-name>/`. The docs reserve the embed's height up front — before the iframe loads, so the page doesn't shift when the example paints — from the `EXAMPLES` map in `docs/.vitepress/theme/components/examples.ts`.

Changing what an example renders can outgrow that reservation, which shows up as a scrollbar inside the embed. Measure it:

```bash
turbo run check:embeds --filter=docs
```

It drives every state each built example's own links reach, in headless Chromium at the docs content column, and reports the tallest against the declared height — with the value to use when one no longer fits. Text wraps at engine-specific metrics, so the numbers are host-dependent by a percent or so; that is why the reservations carry slack and why this is a local check rather than a CI gate.

## Project Structure

Every example follows the same structure (the lint example adds `eslint.config.js`):

```text
<example-name>/
├── index.html          # Entry HTML file
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite configuration
└── src/
    └── main.ts         # Application entry point
```

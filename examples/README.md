# Examples

This folder contains standalone example projects demonstrating lit-ui-router usage. The tutorial examples escalate in scope — start with **helloworld**, then work outward through the solar system and into the galaxy. **design-system-links** is not a tutorial rung: it is live documentation for one API surface, embedded in the guide that explains it. **lint-eslint** is not a rung either: it is the consumer wiring of [`eslint-plugin-lit-ui-router`](https://lit-ui-router.dev/packages/eslint-plugin), installed from npm exactly as a consumer would, and it renders its own lint report in the page.

## StackBlitz Integration

Each example is a self-contained TypeScript project (Vite for the tutorial rungs) designed to run directly on [StackBlitz](https://stackblitz.com/). You can open any example in the table below using the GitHub integration:

```text
https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/<example-name>
```

See [StackBlitz Tips & Best Practices](https://developer.stackblitz.com/guides/integration/open-from-github#tips-best-practices)

### Available Examples

| Example                 | Description                                                                                      | StackBlitz                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **helloworld**          | Ultra-minimal starter: two states with `uiSref`/`uiSrefActive` navigation                        | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/helloworld)          |
| **hellosolarsystem**    | Solar System tour: route parameters and async `resolve` data with a master/detail flow           | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem)    |
| **hellogalaxy**         | Milky Way explorer: nested states and views, resolve inheritance, and a 3D model-viewer surprise | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellogalaxy)         |
| **design-system-links** | `uiSref` driving a design-system link element (`<sp-link>`): `assignHref: true` vs `'auto'`      | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/design-system-links) |
| **lint-eslint**         | `eslint-plugin-lit-ui-router` the ESLint-only way, with the lint report rendered in the page     | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/lint-eslint)         |

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

### hellogalaxy

A Milky Way explorer built on a real star catalog (Sirius, Vega, Polaris, Betelgeuse, Proxima Centauri, and more) with spectral class, constellation, distance, and magnitude data — plus the Smithsonian's 3D scan of Neil Armstrong's spacesuit rendered with [`@google/model-viewer`](https://modelviewer.dev/).

- Nested states via dot notation: `galaxy` → `galaxy.stars` → `galaxy.stars.star`, with `redirectTo` on the parent
- Nested `<ui-view>` elements for a master/detail layout, with slotted fallback content
- Resolve inheritance: the `star` resolve declares `deps: ['$transition$', 'stars']` on the parent state's resolved catalog
- Relative sref targets (`.star`) for linking to child states
- Sibling states: `galaxy.astronaut` renders a 3D model alongside the star explorer, lazy-loading model-viewer via a resolve

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

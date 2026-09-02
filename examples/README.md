# Examples

This folder contains standalone example projects demonstrating lit-ui-router usage. The tutorial examples escalate in scope — start with **helloworld**, then work outward through the solar system and into the galaxy. **design-system-links** is not a tutorial rung: it is live documentation for one API surface, embedded in the guide that explains it. **lint-eslint** and **lint-oxlint** are not rungs either: they are the two consumer wirings of [`eslint-plugin-lit-ui-router`](https://lit-ui-router.dev/packages/eslint-plugin), installed from npm and run in a terminal rather than a browser.

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

## Node Examples

These run in a terminal, not a browser: `npm ci && npm run lint` is the whole story, there is no page to open and no StackBlitz link. **lint-eslint** simply has no browser surface. **lint-oxlint** additionally cannot run in a WebContainer at all: oxlint ships native bindings with no `wasm32-wasi` build, so `npm ci` succeeds on StackBlitz but the binary does not execute.

| Example         | Description                                                                               |
| --------------- | ----------------------------------------------------------------------------------------- |
| **lint-eslint** | `eslint-plugin-lit-ui-router` the ESLint-only way: `configs.recommended` after lit-a11y's |
| **lint-oxlint** | `eslint-plugin-lit-ui-router` the oxlint-only way: `jsPlugins` in a `.oxlintrc.json`      |

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

A lint-only project: no Vite, no dev server, just a small lit app and an `eslint.config.js`. It is the ESLint-only shape from the [plugin README](../packages/eslint-plugin-lit-ui-router/README.md), installed from npm exactly as a consumer would.

- `litA11y.configs.recommended` first, then `...litUiRouter.configs.recommended` — ours turns `lit-a11y/anchor-is-valid` off and enables `lit-ui-router/anchor-is-valid`
- `typescript-eslint` over `src/**/*.ts`, syntax-only: the rule reads the template AST, never type information
- `typescript` pinned to the 6 line, because typescript-eslint needs the TypeScript JS API that TS 7 no longer ships
- `uiSref` anchors that lint clean, with the positive control written up in the example's README

### lint-oxlint

The same app, the oxlint-only shape: `.oxlintrc.json` loads the plugin through `jsPlugins` and names the rule, with no ESLint installed at all. Local and CI only — see [Node Examples](#node-examples).

## Running Locally

To run an example locally:

```bash
cd examples/<example-name>
npm install
npm run dev
```

The lint examples have no dev server and no page; run `npm run lint` instead.

In the monorepo, a root `pnpm install` also installs each example's own npm dependencies via this package's `postinstall` hook. pnpm skips lifecycle scripts when the workspace is already up to date, so to restore a manually deleted `examples/<example-name>/node_modules` run the hook directly:

```bash
pnpm --filter examples postinstall
# or a single example:
pnpm --filter examples example:install:<example-name>
```

`pnpm --filter examples lint` fans out over each example's own `lint` script plus one `oxlint` pass against the repo's root config. That pass runs with `--disable-nested-config`: `lint-oxlint/.oxlintrc.json` registers the same JS plugin the root config does, and oxlint rejects the second registration.

## Project Structure

Each tutorial example follows the same structure (the lint examples drop `index.html` and `vite.config.ts` and add a lint config):

```text
<example-name>/
├── index.html          # Entry HTML file
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite configuration
└── src/
    └── main.ts         # Application entry point
```

# Examples

This folder contains standalone example projects demonstrating lit-ui-router usage. The tutorial examples escalate in scope — start with **helloworld**, then work outward through the solar system and into the galaxy. **design-system-links** is not a tutorial rung: it is live documentation for one API surface, embedded in the guide that explains it.

## StackBlitz Integration

Each example is a self-contained Vite + TypeScript project designed to run directly on [StackBlitz](https://stackblitz.com/). You can open any example in StackBlitz using the GitHub integration:

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

## Running Locally

To run an example locally:

```bash
cd examples/<example-name>
npm install
npm run dev
```

In the monorepo, a root `pnpm install` also installs each example's own npm dependencies via this package's `postinstall` hook. pnpm skips lifecycle scripts when the workspace is already up to date, so to restore a manually deleted `examples/<example-name>/node_modules` run the hook directly:

```bash
pnpm --filter examples postinstall
# or a single example:
pnpm --filter examples example:install:<example-name>
```

## Docs Embeds

Each example is also built for the docs site (`turbo run build:embeds --filter=examples`) and embedded same-origin at `/examples/<example-name>/`. The docs reserve the embed's height up front — before the iframe loads, so the page doesn't shift when the example paints — from the `EXAMPLES` map in `docs/.vitepress/theme/components/examples.ts`.

Changing what an example renders can outgrow that reservation, which shows up as a scrollbar inside the embed. Measure it:

```bash
turbo run check:embeds --filter=docs
```

It drives every state each built example's own links reach, in headless Chromium at the docs content column, and reports the tallest against the declared height — with the value to use when one no longer fits. Text wraps at engine-specific metrics, so the numbers are host-dependent by a percent or so; that is why the reservations carry slack and why this is a local check rather than a CI gate.

## Project Structure

Each example follows the same structure:

```text
<example-name>/
├── index.html          # Entry HTML file
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite configuration
└── src/
    └── main.ts         # Application entry point
```

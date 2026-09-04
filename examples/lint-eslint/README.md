# lint-eslint

The **ESLint-only** shape of [`eslint-plugin-lit-ui-router`](https://lit-ui-router.dev/packages/eslint-plugin): a standalone Vite project that installs the published plugin from npm, lints a small lit app whose anchors carry `uiSref` instead of a static `href`, and renders the lint result in the page.

`eslint.config.js` spreads `litA11y.configs.recommended` first, then `...litUiRouter.configs.recommended`. That order is required: ours turns `lit-a11y/anchor-is-valid` off and enables `lit-ui-router/anchor-is-valid` in its place, so the anchors report as valid while the rest of the lit-a11y ruleset keeps running.

`src/main.ts` is TypeScript, parsed by `typescript-eslint`. `typescript` is pinned to the 6 line because typescript-eslint needs the TypeScript JS API, which TS 7 no longer ships; Vite transpiles without it. The rule itself reads the template AST: no project service, no type information.

## Running

```bash
npm ci
npm run dev      # dev server, lint report in the page
npm run lint     # the same lint, in the terminal
npm run lint:tap # one TAP line per file
npm run build    # bakes the report into dist/
```

`npm run lint:tap` prints one [TAP](https://testanything.org/) line per file (`ok 1 - src/lint-report.ts` for the clean ones, `not ok` for the violation gallery). ESLint 9 dropped its bundled `tap` formatter; this one comes from `eslint-formatter-tap`. `npm run lint:watch` is the terminal-only alternative to the dev server: `chokidar-cli` re-runs `eslint . --format pretty` on every save.

## How the in-page report works

`vite.config.ts` carries a local plugin — no extra dependency, just `vite` and `eslint`. It serves a virtual module, `virtual:lint-report`, whose `load` hook runs `new ESLint({ cwd }).lintFiles(['src/**/*.ts'])` and emits the results as JSON, plus a rule-id-to-docs-URL map from `getRulesMetaForResults()`. Lint problems are the payload, never a build failure.

In dev, the plugin watches `src/` and `eslint.config.js` on the Vite file watcher and calls `server.reloadModule()` on the virtual module, which re-runs the lint and pushes an HMR update; `src/report-views.ts` accepts it and re-renders the connected views in place. `vite build` runs the same `load` once and bakes the report into `dist`. Either way the terminal gets a one-line summary (`lint-report: 4 problems in 4 files`).

The formatter stamps `Generated on <date>` into its output, which would put a fresh timestamp in the bundle on every build and change its content hash without a source change. The plugin strips that one line so `dist` is byte-stable, and warns if the stamp ever stops matching rather than silently letting the nondeterminism back in.

The page shows the same lint two ways, and the two ways are the router's two states: `report` (`#/report`) is that custom panel, `eslint-html` (`#/eslint-html`) is an `<iframe>` of ESLint's own built-in `html` formatter over the same results (a loaded formatter supplies `cwd` and `rulesMeta` itself, so its rule links work). The tab strip is a `<nav>` of `uiSref` anchors and the panel below it is the `<ui-view>` — no local tab state, no click handlers, and the hash is a shareable link to either view.

ESLint's formatter ships every message row hidden behind a click on its file header, which reads badly in a docs embed and leaves the report's height a runtime fact. The view clicks those headers open on load and sizes the frame to the document it gets — `srcdoc` is same-origin, so the report's own layout is readable — rather than pinning a height and nesting one scroll area inside another. The docs embed reserves that height up front, so the report arrives open instead of growing into place. The frame's floor matches the `report` panel beside it, so switching tabs does not resize the page.

`src/report-views.ts` holds the two routed elements — `<lint-report-view>` and `<eslint-html-view>` — registered as each state's `component`, which takes a `LitElement` class directly. `src/lint-report.ts` is a plain `<lint-report>` lit element that takes `.results` (the ESLint result shape) and `.ruleDocs` as properties. It knows nothing about ESLint or Vite, so a browser-side linter could drive the same element.

## What the panel shows

`src/violations.ts` is a gallery: one ✓ GOOD / ✗ BAD pair per rule in the plugin's `recommended` config, marked inline the way [`eslint-plugin-vue`](https://eslint.vuejs.org/rules/) marks its rule docs. The panel opens on those four warnings, each rule id linked to its own docs page. The module is never imported — it exists to be linted, not run, which is also what makes the `directive-position` case safe to ship: that one throws at render time by design.

`eslint.config.js` scopes those four rules to `warn` **for that file only**. `recommended` ships them at `error` and `src/main.ts` is held to that, so the app stays a clean consumer while the demo still has something to report and `npm run lint` still exits 0.

Two of the rules are auto-fixable, so `eslint . --fix` repairs the gallery and empties the panel. `git restore src/violations.ts` puts it back.

Whenever the plugin's `recommended` config gains or drops a rule, the gallery gains or drops its pair — that is what keeps this example an honest picture of what installing the plugin gives you.

For the reverse check, delete `${uiSref('eslint-html')}` from the second tab in `src/main.ts` and save: `lit-ui-router/anchor-is-valid` reports against the app itself, as an error this time — and the tab stops navigating, which is the whole reason the rule exists.

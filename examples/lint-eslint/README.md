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

`npm run lint:tap` prints one [TAP](https://testanything.org/) line per file (`ok 3 - src/main.ts`), so a clean run says so. ESLint 9 dropped its bundled `tap` formatter; this one comes from `eslint-formatter-tap`. `npm run lint:watch` is the terminal-only alternative to the dev server: `chokidar-cli` re-runs `eslint . --format pretty` on every save.

## How the in-page report works

`vite.config.ts` carries a local plugin — no extra dependency, just `vite` and `eslint`. It serves a virtual module, `virtual:lint-report`, whose `load` hook runs `new ESLint({ cwd }).lintFiles(['src/**/*.ts'])` and emits the results as JSON, plus a rule-id-to-docs-URL map from `getRulesMetaForResults()`. Lint problems are the payload, never a build failure.

In dev, the plugin watches `src/` and `eslint.config.js` on the Vite file watcher and calls `server.reloadModule()` on the virtual module, which re-runs the lint and pushes an HMR update; `src/main.ts` accepts it and re-renders. `vite build` runs the same `load` once and bakes the report into `dist`. Either way the terminal gets a one-line summary (`lint-report: 0 problems in 2 files`).

`src/lint-report.ts` is a plain `<lint-report>` lit element that takes `.results` (the ESLint result shape) and `.ruleDocs` as properties. It knows nothing about ESLint or Vite, so a browser-side linter could drive the same element.

## Positive control

Delete `${uiSref('about')}` from the second anchor in `src/main.ts` and save: the panel reports `lit-ui-router/anchor-is-valid` on the now-hrefless anchor at `23:9`, with the rule id linked to its docs. Restore it and the panel goes back to `✓ 0 problems`. `npm run lint` reports the same thing in the terminal.

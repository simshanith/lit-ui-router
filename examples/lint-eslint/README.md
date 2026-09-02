# lint-eslint

The **ESLint-only** shape of [`eslint-plugin-lit-ui-router`](https://lit-ui-router.dev/packages/eslint-plugin): a standalone project that installs the published plugin from npm and lints a small lit app whose anchors carry `uiSref` instead of a static `href`.

`eslint.config.js` spreads `litA11y.configs.recommended` first, then `...litUiRouter.configs.recommended`. That order is required: ours turns `lit-a11y/anchor-is-valid` off and enables `lit-ui-router/anchor-is-valid` in its place, so the anchors report as valid while the rest of the lit-a11y ruleset keeps running.

`src/main.ts` is TypeScript, parsed by `typescript-eslint`. `typescript` is pinned to the 6 line because typescript-eslint needs the TypeScript JS API, which TS 7 no longer ships. The rule itself reads the template AST: no project service, no type information.

## Running

```bash
npm ci
npm run lint
```

This is a Node-side project: no page to open, no dev server, just the lint.

## Positive control

Delete `${uiSref('about')}` from the second anchor in `src/main.ts` and re-run `npm run lint`: `lit-ui-router/anchor-is-valid` reports the now-hrefless anchor. Restore it and the lint is clean again.

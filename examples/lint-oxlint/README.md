# lint-oxlint

The **oxlint-only** shape of [`eslint-plugin-lit-ui-router`](https://lit-ui-router.dev/packages/eslint-plugin): the same small lit app as `lint-eslint`, linted by [oxlint](https://oxc.rs) with no ESLint installed at all.

oxlint does not consume `configs.recommended`, so `.oxlintrc.json` loads the package through `jsPlugins` and names the rule explicitly:

```json
{
  "jsPlugins": ["eslint-plugin-lit-ui-router"],
  "rules": {
    "lit-ui-router/anchor-is-valid": "error"
  }
}
```

No lit-a11y `off` line is needed here: oxlint ships no lit-a11y rules. `eslint` is imported type-only by the plugin, so an oxlint-only host does not need it.

oxlint's `jsPlugins` is alpha and outside semver. `oxlint` is pinned exactly for that reason: a break in a later oxlint surfaces on the bump, not in a lint run.

## Running

```bash
npm ci
npm run lint
```

**Local and CI only.** oxlint ships native `@oxlint/binding-*` optional dependencies and no `wasm32-wasi` build, so the binary cannot run inside StackBlitz's WebContainer. `npm ci` still succeeds there (unmatched optional bindings are skipped); only `npm run lint` fails.

## Positive control

Delete `${uiSref('about')}` from the second anchor in `src/main.ts` and re-run `npm run lint`: `lit-ui-router/anchor-is-valid` reports the now-hrefless anchor. Restore it and the lint is clean again.

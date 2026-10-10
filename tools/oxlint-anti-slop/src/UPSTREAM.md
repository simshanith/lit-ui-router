# Vendored anti-slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), commit `e6676e8d0bf17c678cb45b9dacb2bd6ca8dea53a`, path `skills/install-anti-slop/assets/anti-slop/` (skill folder tree `89044d21c75a367eac1ddbaf208e650b1a7d5820`).

Every file in this directory is a verbatim copy of that path, installed by the skill's `scripts/install.mjs`. `vendor/eslint-stylistic/` keeps its own `LICENSE` and `UPSTREAM.md`.

## Local deviations

- Installed as the workspace package `@tools/oxlint-anti-slop` (`../package.json`) rather than the skill's default `tools/oxlint/anti-slop/`. `.oxlintrc.json` names the package exports `@tools/oxlint-anti-slop` and `@tools/oxlint-anti-slop/effect` in `jsPlugins`.
- The Effect rules are enabled through an `.oxlintrc.json` override that lists only the packages built on Effect. Their heuristics (`make*` imports, chained literal ternaries) misfire on code that doesn't use Effect.
- `anti-slop/no-runtime-typeof` runs with `allowInTypeGuards: true` (upstream default `false`), so a named type guard may use `typeof`.
- Lint and format skip this directory: `.oxlintrc.json` ignores it, the package has no `lint:oxlint` or `format:oxfmt` script, and `tools/eslint/complexity-ceiling.ts` gives `rules/no-widen-then-assert.ts` a per-file limit.
- `../tsconfig.json` typechecks it under the repo's `tsconfig.base.json`.

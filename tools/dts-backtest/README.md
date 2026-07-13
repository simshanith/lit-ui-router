# dts-backtest

Backtests the published packages' declaration output against the oldest
TypeScript a consumer might use, so this repo's own TypeScript can be
upgraded without raising the `.d.ts` floor for consumers.

## What it checks

`run.ts` typechecks the [consumer fixtures](./fixtures) — real-world usage
of `lit-ui-router`, `lit-ui-router-mobx`, and
`ui-router-navigation-location-plugin` — under a matrix of:

- **TypeScript versions**: the pinned floor (`typescript-5.0` → 5.0.4) and
  the repo's current catalog version. The 6.x leg rides the shared
  `typescript6` catalog (also vue-check's, for Volar), so bumping that
  catalog bumps both consumers deliberately.
- **module resolution modes**: `bundler` and `NodeNext`

The fixture compiles with `skipLibCheck: false`, so the packages' built
`dist/*.d.ts` are themselves fully parsed **and** typechecked under each
version — new declaration-emit syntax that an older TypeScript cannot handle
fails the run. Diagnostics originating in third-party declarations (lit,
mobx, `@uirouter/core`, `lib.dom`) are counted but tolerated, matching what
a consumer running `skipLibCheck: true` would experience while still holding
our own declarations to the strict bar.

Every run starts with a **self-test** proving the harness can fail: it
injects a `NoInfer<>` probe (TypeScript 5.4+ syntax) into a dist `.d.ts`,
asserts the floor version rejects it and the current version accepts it,
then restores the file. A green matrix therefore can't be the result of a
broken diagnostic filter silently classifying everything as third-party.

## Running

```sh
turbo run test --filter=dts-backtest   # builds the packages first
```

## Authoring rule for the published packages

The floor constrains only what surfaces in the emitted `dist/*.d.ts` —
public API signatures and exported types. Implementation code may use any
feature of the repo's current TypeScript; a newer-TS construct is only a
problem when it leaks into a declaration (e.g. `NoInfer<T>` in an exported
signature). When `dts-backtest#test` fails on your change, either keep the
construct out of the public surface, or you are proposing a floor raise —
see below.

## Raising the floor

Bumping the supported consumer floor is a semver-major signal for the
published packages: change the `typescript-5.0` devDependency alias (and
`VERSIONS` in `run.ts`) and rename accordingly. If the new floor is ≥ 5.4
the self-test's `NoInfer` probe no longer discriminates — swap it for a
construct the new floor still rejects.

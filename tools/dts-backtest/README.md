# dts-backtest

Backtests the published packages' declaration output against the oldest
TypeScript a consumer might use, so this repo's own TypeScript can be
upgraded without raising the `.d.ts` floor for consumers.

## What it checks

`run.mjs` typechecks the [consumer fixtures](./fixtures) — real-world usage
of `lit-ui-router`, `lit-ui-router-mobx`, and
`ui-router-navigation-location-plugin` — under a matrix of:

- **TypeScript versions**: the pinned floor (`typescript-5.0` → 5.0.4) and
  the repo's current catalog version
- **module resolution modes**: `bundler` and `NodeNext`

The fixture compiles with `skipLibCheck: false`, so the packages' built
`dist/*.d.ts` are themselves fully parsed **and** typechecked under each
version — new declaration-emit syntax that an older TypeScript cannot handle
fails the run. Diagnostics originating in third-party declarations (lit,
mobx, `@uirouter/core`, `lib.dom`) are counted but tolerated, matching what
a consumer running `skipLibCheck: true` would experience while still holding
our own declarations to the strict bar.

## Running

```sh
turbo run test --filter=dts-backtest   # builds the packages first
```

## Raising the floor

Bumping the supported consumer floor is a semver-major signal for the
published packages: change the `typescript-5.0` devDependency alias (and
`VERSIONS` in `run.mjs`) and rename accordingly.

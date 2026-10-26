# dts-backtest

Backtests the published packages' declaration output against the oldest
TypeScript a consumer might use, so this repo's own TypeScript can be
upgraded without raising the `.d.ts` floor for consumers.

## What it checks

`run.ts` typechecks the [consumer fixtures](./fixtures) — real-world usage
of `lit-ui-router`, `lit-ui-router-mobx`,
`ui-router-navigation-location-plugin`, and `ui-router-server` — under a
matrix of:

- **TypeScript versions**: the classic-API legs in `API_VERSIONS` and the
  native TypeScript 7 leg in `NATIVE_VERSION` (`run.ts`), each a pinned
  `typescript-*` devDependency alias in `package.json`, so no leg tracks the
  repo's own `typescript`. The first classic leg is the consumer floor. The
  6.x leg rides the shared `typescript6` catalog (also vue-check's, for
  Volar), so bumping that catalog bumps both consumers deliberately.
- **module resolution modes**: `bundler` and `NodeNext`

A module augmentation reaches the whole program, so the [registered
consumer](./registered), which registers states and loads the
`ui-router-registry` adapter entry points, is a second program with its own
`tsconfig.fixture*.json` pair. The [routed consumers](./routed), whose
`lit-ui-router` components read the registry they're registered in, are three
more, one per table:

- `classes` and `templates` check `TypedLitStateDeclaration`. `MIN_VERSION`
  in `run.ts` skips `templates` on legs older than TypeScript 5.5.
- `legacy` must fail: `EXPECTED_CODES` in `run.ts` names the circularity
  errors `LitStateDeclaration` reports there.

`lit-ui-router` reads `ui-router-registry` as an optional peer. Inside the
workspace the registry always resolves through pnpm's real paths, so the
[optional-peer consumers](./optional-peer) run from a temp dir that unpacks the
`@tools/release#pack:all` tarballs, with or without the registry:

- `absent`: no registry, no augmentation. Targets are `string` and params
  `RawParams`, and an equality check rejects `any`.
- `absent-augmented` must fail with TS2664 at the augmentation and nothing
  else (`EXPECTED_ONLY`), so calls fall back to `string` without cascading.
- `installed`: registry installed and augmented; a misspelled name and a
  missing required param fail.

The packed manifest must list the registry as an optional peer, and no
packed `.js` file may name it. A second self-test swaps the guard in the
packed `registry.d.ts` for an `IsAny` guard and asserts that TypeScript 5.5
and later fail `absent` while older legs pass.

The fixture compiles with `skipLibCheck: false`, so the packages' built
`dist/*.d.ts` are themselves fully parsed **and** typechecked under each
version — new declaration-emit syntax that an older TypeScript cannot handle
fails the run. Diagnostics originating in third-party declarations (lit,
mobx, `@uirouter/core`, hono, `lib.dom`) are counted but tolerated, matching what
a consumer running `skipLibCheck: true` would experience while still holding
our own declarations to the strict bar.

Every run starts with a **self-test** proving the harness can fail. It
compiles a probe `.d.ts` from a scratch directory alongside the fixtures; the
shipped `dist/` is never touched. The classic legs' probe uses `NoInfer<>`
(TypeScript 5.4+ syntax): the floor must reject it and the newest classic
version accept it. The native TypeScript 7 leg has its own ownership filter
and its own probe, an unresolvable type name it must report as ours;
`--versions=current` runs only this one. A green matrix therefore can't be
the result of a broken diagnostic filter silently classifying everything as
third-party. See `selftest` and `selftestNative` in `run.ts`.

## Running

```sh
turbo run test --filter=@tools/dts-backtest          # current-TS leg (PR CI)
turbo run test:matrix --filter=@tools/dts-backtest   # full version matrix (main-push CI)
```

Both build the packages first. `node run.ts` defaults to the full matrix;
`--versions=current` restricts it to the repo-current (native TS 7) leg.
The old-TS legs only guard shipped packages, so the full matrix runs on
main pushes — still ahead of any release — while PRs get fast current-TS
feedback.

## Authoring rule for the published packages

The floor constrains only what surfaces in the emitted `dist/*.d.ts` —
public API signatures and exported types. Implementation code may use any
feature of the repo's current TypeScript; a newer-TS construct is only a
problem when it leaks into a declaration (e.g. `NoInfer<T>` in an exported
signature). When `@tools/dts-backtest#test` fails on your change, either keep the
construct out of the public surface, or you are proposing a floor raise —
see below.

## Raising the floor

Bumping the supported consumer floor is a semver-major signal for the
published packages: change the `typescript-5.0` devDependency alias (and
`API_VERSIONS` in `run.ts`) and rename accordingly. If the new floor is ≥ 5.4
the self-test's `NoInfer` probe no longer discriminates — swap it for a
construct the new floor still rejects.

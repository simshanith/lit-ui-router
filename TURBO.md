# Turborepo Workflow Guide

This monorepo uses [Turborepo](https://turbo.build/) for orchestrating builds, tests, and other tasks across workspaces.

## Installation

Turbo is the workspace devDependency (pinned in the pnpm catalog), resolved from `node_modules/.bin`, which [mise](https://mise.jdx.dev) puts on `PATH` (see [`.config/mise/config.toml`](./.config/mise/config.toml) and [CONTRIBUTING.md](./CONTRIBUTING.md#development) for setup). After `mise install` and `mise run setup`, bare `turbo` runs the workspace-pinned version — no separate global install needed.

## Workspace Structure

Turbo manages these workspaces (defined in `pnpm-workspace.yaml`):

| Directory    | Purpose                                     | In CI               |
| ------------ | ------------------------------------------- | ------------------- |
| `packages/*` | Published libraries (lit-ui-router, etc.)   | Yes                 |
| `apps/*`     | Sample applications and e2e tests           | Yes                 |
| `tools/*`    | Internal build tools                        | Yes                 |
| `docs`       | Documentation site                          | Yes                 |
| `examples`   | Standalone tutorial apps (helloworld, etc.) | Only `build:embeds` |

The apps inside `examples/` (helloworld, hellogalaxy, hellosolarsystem) are intentionally outside the main turbo graph. They are standalone Vite dev servers meant for learning, and they use npm (not pnpm) for Stackblitz compatibility. The one turbo touchpoint is `examples#build:embeds` (see `examples/turbo.json`), which builds them as embeds for the docs site:

```bash
cd examples/helloworld
npm install
npm run dev
```

## Task Dependency Graph

### Root Configuration (`turbo.json`)

The root `turbo.json` defines shared task configurations inherited by all workspaces:

```text
ci:pull_request
├── build
├── test
├── test:coverage
├── test:lit2-compat
├── test:mobx6-compat
├── lint
│   ├── //#lint:root           (with)
│   ├── //#lint:package-json   (with)
│   ├── //#lint:workflows      (with)
│   │   ├── //#lint:actionlint (with)
│   │   ├── //#lint:zizmor     (with)
│   │   ├── //#lint:toml       (with)
│   │   └── //#lint:shellcheck (with)
│   └── //#check:patches       (with)
├── typecheck
│   ├── //#typecheck:root      (with)
│   ├── typecheck:src          (with)
│   ├── typecheck:lit2         (with)
│   └── typecheck:mobx6        (with)
├── format:check
│   └── //#format:check:root   (with)
├── check:bundle
└── codecov:bundle

ci:main
├── ci:pull_request
├── test:engines
├── @tools/release#check:pack
└── @tools/dts-backtest#test:matrix

build
├── ^build
├── build:js
└── build:types
    └── ^build:types

dev
└── ^build

e2e
├── ^build
├── ^docs
└── ^e2e

docs
├── ^build
└── ^docs:api
```

**Key concepts:**

- `^task` means "run this task on dependencies first"
- `dependsOn` defines execution order (unmarked edges above)
- `with` runs root-level tasks alongside workspace tasks (marked edges above)
- `outputs` defines cacheable artifacts
- `inputs` scopes cache invalidation
- Every build output lives under a `dist/` dir, so every traversal ignore is one `**/dist/**` glob (no sibling `dist-*` patterns): single-output packages use plain `dist/`; multi-output packages namespace each variant as `dist/<variant>/` (disjoint outputs globs, each vite build empties only its own subdir)
- Nothing writes machinery under `dist/` — probe/scratch output lives in gitignored `.cache/` dirs (e.g. `.cache/bundle-stats/`), because anything under a `dist/` can be captured by build caching or pack staging mid-graph; shipped packages keep the `!dist/.*/**` files negation as a backstop, and `check:published-diff` backstops the boundary

Exceptions: `docs/api/**` (generated VitePress content, not a bundle output) and `tools/release/.cache/**` (turbo-hashed input cache).

**Graph notes:**

- `ci:pull_request` is what every PR and branch push runs; `ci` is its back-compat alias. `ci:main` runs on main pushes only, adding the main-only guards.
- `test:engines` is the Firefox + WebKit full-suite vitest pass (lit-ui-router, navigation-location-plugin); PR chromium correctness rides `test:coverage`.
- `@tools/dts-backtest#test:matrix` runs the full TS version matrix; PRs run only the current-TS `test` leg.
- `build` composes the two own-package passes: `build:js` (JS) and `build:types` (d.ts, self-chaining via `^build:types`).
- `check:bundle` holds the bundle invariants (size budgets, deps-none probes); `codecov:bundle` uploads bundle analysis, uncached.
- `dev`, `e2e`, and `docs` are persistent, uncached tasks.
- Per-task `inputs`/`outputs` live in `turbo.json` itself — see [Cache Control](#cache-control).

**Deliberately outside both ci graphs:** `docs#check:embeds` measures every built example in headless Chromium and checks the heights `docs/.vitepress/theme/components/examples.ts` reserves for their embeds. Text wraps at engine-specific metrics, so the measurement is host-dependent — a Linux runner and a macOS laptop do not have to agree — and gating on it would make the docs' reserved space a property of whoever ran it. Run it locally when an example's content changes.

That host-dependence is also why the task is uncached: the Chromium build and the font set decide the numbers, neither is nameable in `inputs`, and a cache hit would replay a measurement the current machine never took. Being uncacheable, it is not audited by `check-task-inputs` either — a task turbo will not hash-and-skip has no stale-cache failure mode.

`typecheck:peer-floor` typechecks an adapter against its published peer-floor version. The floor pin can only reference published versions, so putting it in the ci graph would break atomic core-API + adapter-adoption PRs. It runs as a non-gating per-package check run on main pushes (the Release signals workflow) and as a hard gate at bump time.

### Workspace Extensions

Workspaces extend the root configuration using `"extends": ["//"]`:

| Workspace                                                 | Custom Configuration                                                                                                                                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/lit-ui-router`                                  | Runs `build:custom-elements` with build, configures `docs:api` outputs                                                                                                                                                              |
| `packages/lit-ui-router-mobx`                             | Configures `docs:api` outputs                                                                                                                                                                                                       |
| `packages/navigation-location-plugin`                     | Configures `docs:api` outputs                                                                                                                                                                                                       |
| `packages/ui-router-server`                               | `test` rides the `transit` chain (no build needed); adds `typecheck:tests`                                                                                                                                                          |
| `apps/sample-app-lit-vanilla`                             | Adds env vars for build (VITE\_\*), runs `build:hash` with build                                                                                                                                                                    |
| `apps/sample-app-lit-mobx`                                | Adds env vars for build (VITE\_\*)                                                                                                                                                                                                  |
| `apps/sample-app-lit-e2e`                                 | Caches `test` via dependency edges; CYPRESS\_\* passes through un-hashed                                                                                                                                                            |
| `apps/sample-app-routes`, `apps/sample-app-shared`        | Widens `test` inputs beyond the root's `src/**/*.ts` (non-TS/config surface)                                                                                                                                                        |
| `docs`                                                    | Adds `check:embeds`, `docs:preview`, `wrangler:dev`, worker tasks (`types:worker`, `typecheck:worker`, `typecheck:worker:tests`, `bundle:worker`); `test` runs the worker contract tests in node; requires `^docs:api` before build |
| `examples`                                                | Adds `build:embeds` (tutorial apps built as docs embeds)                                                                                                                                                                            |
| `tools/release`                                           | Adds `check:pack`, `resolve:published` (uncached registry read), `check:published-diff`                                                                                                                                             |
| `tools/workers-builds`                                    | Adds `check` (live Cloudflare API diff; uncached); over-approximated `test` inputs                                                                                                                                                  |
| `tools/build_and_test`, `tools/shared`, `tools/happy-dom` | Over-approximated `test` inputs (`$TURBO_DEFAULT$`)                                                                                                                                                                                 |

## Common Commands

```bash
# Build all packages
turbo build

# Run all tests
turbo test

# Run tests with coverage
turbo test:coverage

# Lint all packages
turbo lint

# Check formatting
turbo format:check

# Fix formatting
turbo format

# PR CI pipeline (build + test + coverage + lint + typecheck + format:check
# + bundle checks); `ci` is the back-compat alias of `ci:pull_request`
turbo ci

# PR pipeline plus the main-only guards (Firefox/WebKit engines pass,
# check:pack, dts-backtest TS matrix)
turbo ci:main

# Development server (persistent)
turbo dev

# E2E tests
turbo e2e
```

### Filtering

```bash
# Single package
turbo build --filter=lit-ui-router

# Package and its dependencies
turbo build --filter=lit-ui-router...

# Package and its dependents
turbo build --filter=...lit-ui-router

# Only changed packages
turbo build --filter=[HEAD^1]

# Specific directory
turbo build --filter=./packages/*
```

### Cache Control

```bash
# Force rebuild (ignore cache)
turbo build --force

# Dry run (show what would run)
turbo build --dry-run

# Show cache status
turbo build --summarize
```

## CI Integration

The GitHub Actions workflow (`.github/workflows/build-test.yml`) runs the CI pipeline:

1. **Checkout** - Clone repository
2. **Setup** - mise installs Node.js (version pinned in `.nvmrc`) and a bootstrap pnpm that self-swaps to the `packageManager` pin; `mise run setup` installs dependencies
3. **Install browsers** - Playwright and Cypress for e2e tests, restored from `actions/cache` keyed on the installed package versions
4. **Build and Test** - PRs and branch pushes run `mise run ci` (turbo `ci:pull_request`); main pushes, `mainGraph` dispatches and `ci-main/` branches run `mise run ci_main` (turbo `ci:main`, adding the main-only guards)
5. **Coverage reports** - Vitest coverage for PR comments, Codecov upload
6. **Tag** (main pushes only) - a green run calls the Tag & push workflow, so release tags fire only after green main CI

Manual dispatch of the workflow has two deflake inputs: `force` (`TURBO_FORCE`) bypasses the turbo cache, and `mainGraph` runs the `ci:main` superset on demand — combine them to deflake the full main graph without pushing a commit (tagging stays push-only). Dispatch takes a ref, so this is also how you run the main graph against an arbitrary branch. CI also sets `CYPRESS_video: 'false'` (passed through un-hashed, so it never affects cache validity); local runs keep video recording.

### Smoke-testing the main graph before merge

The main-only guards (`test:engines`, `check:pack`, the full `dts-backtest` matrix) run after merge, so a break in them surfaces on main rather than on the PR. Two ways to pull that signal forward:

- **Per run** — dispatch **Build and Test** with `mainGraph: true` and pick the branch as the ref. Nothing needs to be pushed, and the branch needs no PR.
- **Per branch** — name the branch `ci-main/<topic>`. Every push to it builds `ci:main` instead of the PR graph, and it runs even when the branch merges cleanly (a `pull_request` run would only cover the PR graph). The prefix is the whole opt-in; there is no other flag.

The prefix affects the graph only. Tagging and publishing stay bound to pushes to `main`, so a `ci-main/` branch can never release.

### CI Environment Variables

```yaml
TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }} # Remote cache auth
TURBO_API: ${{ vars.TURBO_API }} # Cache API endpoint
TURBO_TEAM: ${{ vars.TURBO_TEAM }} # Team identifier
TURBO_REMOTE_CACHE_SIGNATURE_KEY: ${{ secrets.TURBO_REMOTE_CACHE_SIGNATURE_KEY }} # Artifact signing
```

### Task-to-CI Mapping

| Turbo Task                             | CI Placement                                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `build`                                | `ci:pull_request` (every PR and push)                                                                                                                                                                              |
| `test`                                 | `ci:pull_request`                                                                                                                                                                                                  |
| `test:coverage`                        | `ci:pull_request`, feeds coverage reports                                                                                                                                                                          |
| `lint`                                 | `ci:pull_request`                                                                                                                                                                                                  |
| `typecheck`                            | `ci:pull_request`                                                                                                                                                                                                  |
| `test:lit2-compat`, `typecheck:lit2`   | `ci:pull_request` — unit suites and types against the lit-2 alias, separate tasks so a runtime failure never masks the typecheck; `typecheck:lit2` arrives via `typecheck`'s `with`, not its own `dependsOn` entry |
| `test:mobx6-compat`, `typecheck:mobx6` | `ci:pull_request` — same split against the mobx-6 alias (lit-ui-router-mobx only); `typecheck:mobx6` likewise arrives via `typecheck`'s `with`                                                                     |
| `format:check`                         | `ci:pull_request`                                                                                                                                                                                                  |
| `check:bundle`, `codecov:bundle`       | `ci:pull_request`                                                                                                                                                                                                  |
| `test:engines`                         | `ci:main` only — Firefox + WebKit vitest pass (lit-ui-router, navigation-location-plugin)                                                                                                                          |
| `@tools/release#check:pack`            | `ci:main` only                                                                                                                                                                                                     |
| `@tools/dts-backtest#test:matrix`      | `ci:main` only; PRs run the current-TS `#test` leg                                                                                                                                                                 |
| `docs#check:embeds`                    | Neither ci graph — manual and uncached: measures the examples' embed heights (host-dependent font metrics)                                                                                                         |
| `typecheck:peer-floor`                 | Neither ci graph — Release signals check runs + bump gate                                                                                                                                                          |

## Remote Caching

Turborepo remote caching accelerates CI builds by sharing cached artifacts across runs.

**When to use remote cache:**

- CI builds - automatically enabled when `TURBO_TOKEN` is set
- Local development with slow rebuilds
- Team collaboration on large changes

**Setup:** See [REMOTE_CACHE.md](./REMOTE_CACHE.md) for detailed configuration.
Artifacts are signed: `remoteCache.signature` in `turbo.json` makes turbo tag
each upload with an HMAC and verify it on download, so a cache that serves
tampered or foreign artifacts fails the task instead of poisoning the build.
Optional and maintainer-only — the worker takes one shared token issued out of
band; without it turbo just uses the local cache.

**Quick start for local development:**

1. `mise run turbo_login` - prompts for the token and signature key, writes the gitignored `.config/mise/turbo.local.env` (values via shell builtins, never on a child process's argv)
2. Run `turbo build` - artifacts upload/download automatically

## Troubleshooting

### Cache Not Working

```bash
# Check what turbo sees as inputs
turbo build --dry-run --summarize

# Force fresh build
turbo build --force

# Clear local cache
rm -rf node_modules/.cache/turbo
```

### Task Ordering Issues

If tasks run in wrong order, check:

1. `dependsOn` in turbo.json
2. Workspace dependencies in `package.json`
3. Use `--dry-run` to verify execution order

### Unexpected Cache Hits

Tasks may cache unexpectedly if:

- `inputs` don't include all source files
- Environment variables aren't in `env` array
- Outputs aren't in `outputs` array

```bash
# Debug cache keys
TURBO_LOG_VERBOSITY=debug turbo build
```

### E2E Tests Timing Out

E2E tasks (`e2e`, `dev`, `docs`) are `persistent: true` and don't cache:

```json
{
  "e2e": {
    "cache": false,
    "persistent": true
  }
}
```

Run these separately from cached tasks.

### Root-Level Tasks Not Running

Root tasks use `//#` prefix and back onto scripts in root `package.json` —
except a virtual node with no script, which turbo runs nothing for and just
fans out via `with`:

- `//#lint:root` - lints root-level files (workspace directories excluded)
- `//#lint:package-json` - lints every `package.json` and `pnpm-workspace.yaml`
- `//#lint:elements` - eslint (lit, wc, lit-a11y) over `{packages,apps,examples}/*/src/**/*.ts`, plus the warning ratchet (see below)
- `//#lint:workflows` - virtual node (no script); fans out via `with` to the four per-tool tasks below
- `//#lint:actionlint` - actionlint over GitHub Actions workflows
- `//#lint:zizmor` - zizmor security audit over GitHub Actions workflows
- `//#lint:toml` - taplo lint over every tracked `.toml`
- `//#lint:shellcheck` - shellcheck over the repo shell surface (`*.sh`/`*.bash` + extensionless mise task scripts)
- `//#typecheck:root` - typechecks root-level scripts
- `//#format:root` - formats root-level files
- `//#format:check:root` - checks root-level formatting

These run alongside workspace tasks via `with` configuration.

### Choosing an ESLint Formatter

The two eslint-backed root tasks read eslint's report differently, because the
per-file list is worth different things to each:

- `lint:package-json` keeps `--format tap` — the list _is_ the output, naming
  every package it linted. Any flag appended to the script reaches eslint, and
  the **last** `--format` wins, so reach for another one directly:

  ```bash
  pnpm lint:package-json --format stylish
  ```

  Append it directly — **not** `pnpm lint:package-json -- --format stylish`.
  pnpm forwards the `--` itself, and eslint reads everything after it as a file
  pattern (`No files matching the pattern "--format"`).

- `lint:elements` runs eslint under `@tools/lint-elements` with `--format json`
  and prints its own findings-only report — the machine-readable report is what
  the warning ratchet below compares. The script takes one flag, `--update`; to
  experiment with a formatter, call eslint directly:

  ```bash
  pnpm exec eslint --format tap "{packages,apps,examples}/*/src/**/*.ts"
  ```

### Warn-Only Lanes

A task that exits 0 while emitting warnings is invisible to the rest of CI.
`turbo_summary` reports every run, but its input carries only
`startTime`/`endTime`/`exitCode` per task — a task with 36 warnings and one with
zero are byte-identical in that JSON. So warn-only-ness cannot be derived; the
watched lanes are an explicit list in `@tools/warn-lanes`, and each one asserts
its own state by printing a `warn-lane:` marker line into its
task log (which turbo replays verbatim on a cache hit). The run summary reads
those markers back out in its **overview** — the always-on half, so a warn lane
is named on a green run and not only when something else broke.

`//#lint:elements` is the first such lane. Its floor is
`tools/lint-elements/warnings.json`, a snapshot of which warnings exist, keyed
per file per rule:

- a warning entry that is **not in the snapshot** fails the lane — including one
  that keeps the total flat by replacing an entry that was fixed, which a scalar
  `--max-warnings N` budget cannot see;
- **fewer** warnings than the snapshot passes, loudly: fixing a warning should
  never be blocked on bookkeeping. Regenerate with `pnpm lint:elements:snapshot`
  and commit the smaller snapshot in the same change.

The snapshot is a holding measure and a worklist, not an end state: each entry
is one warning awaiting a fix, a suppression, or a rule re-evaluation. When it
empties, the rules move to `error` and the ratchet goes away.

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

```
ci:pull_request   (every PR and branch push; `ci` is its back-compat alias)
├── build         (outputs: dist/**)
├── test          (inputs: src/**/*.ts, vitest.config.ts, cypress.config.ts)
├── test:coverage (outputs: coverage/**)
├── lint          (runs with //#lint:root, //#lint:package-json, //#lint:workflows)
├── typecheck     (runs with //#typecheck:root, typecheck:src)
├── format:check  (runs with //#format:check:root)
├── check:bundle  (bundle invariants: size budgets, deps-none probes)
└── codecov:bundle (bundle analysis upload; not cached)

ci:main           (main pushes only: the PR graph plus the main-only guards)
├── ci:pull_request
├── @tools/release#check:pack        (pack-surface manifest check)
└── @tools/dts-backtest#test:matrix  (full dts-backtest TS version matrix;
                                      PRs run only the current-TS #test leg)

build
├── ^build      (depends on workspace dependencies' builds)
├── build:js    (own-package JS pass)
└── build:types (own-package d.ts pass; self-chains via ^build:types)

dev
└── ^build      (persistent, not cached)

e2e
├── ^build
├── ^docs
└── ^e2e        (persistent, not cached)

docs
├── ^build
└── ^docs:api   (persistent, not cached)
```

**Key concepts:**

- `^task` means "run this task on dependencies first"
- `dependsOn` defines execution order
- `outputs` defines cacheable artifacts
- `inputs` scopes cache invalidation
- `with` runs root-level tasks alongside workspace tasks

**Deliberately outside both ci graphs:** `typecheck:peer-floor` typechecks an adapter against its published peer-floor version. The floor pin can only reference published versions, so putting it in the ci graph would break atomic core-API + adapter-adoption PRs. It runs as a non-gating per-package check run on main pushes (the Release signals workflow) and as a hard gate at bump time.

### Workspace Extensions

Workspaces extend the root configuration using `"extends": ["//"]`:

| Workspace                                          | Custom Configuration                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/lit-ui-router`                           | Runs `build:custom-elements` with build, configures `docs:api` outputs                                                                     |
| `packages/lit-ui-router-mobx`                      | Configures `docs:api` outputs                                                                                                              |
| `packages/navigation-location-plugin`              | Configures `docs:api` outputs                                                                                                              |
| `packages/ui-router-server`                        | `test` rides the `transit` chain (no build needed); adds `typecheck:tests`                                                                 |
| `apps/sample-app-lit-vanilla`                      | Adds env vars for build (VITE\_\*), runs `build:hash` with build                                                                           |
| `apps/sample-app-lit-mobx`                         | Adds env vars for build (VITE\_\*)                                                                                                         |
| `apps/sample-app-lit-e2e`                          | Caches `test` via dependency edges; CYPRESS\_\* passes through un-hashed                                                                   |
| `apps/sample-app-routes`, `apps/sample-app-shared` | Widens `test` inputs beyond the root's `src/**/*.ts` (non-TS/config surface)                                                               |
| `docs`                                             | Adds `docs:preview`, `wrangler:dev`, worker tasks (`types:worker`, `typecheck:worker`, `bundle:worker`), requires `^docs:api` before build |
| `examples`                                         | Adds `build:embeds` (tutorial apps built as docs embeds)                                                                                   |
| `tools/release`                                    | Adds `check:pack`, `resolve:published` (uncached registry read), `check:published-diff`                                                    |
| `tools/workers-builds`                             | Adds `check` (live Cloudflare API diff; uncached); over-approximated `test` inputs                                                         |
| `tools/build_and_test`, `tools/shared`             | Over-approximated `test` inputs (`$TURBO_DEFAULT$`)                                                                                        |

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

# PR pipeline plus the main-only guards (check:pack, dts-backtest TS matrix)
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
2. **Setup** - mise installs Node.js (version pinned in `.nvmrc`) and corepack; `mise run setup` corepack-installs the `packageManager`-pinned pnpm, then installs dependencies
3. **Install browsers** - Playwright and Cypress for e2e tests, restored from `actions/cache` keyed on the installed package versions
4. **Build and Test** - PRs and branch pushes run `mise run ci` (turbo `ci:pull_request`); main pushes run `mise run ci_main` (turbo `ci:main`, adding the main-only guards)
5. **Coverage reports** - Vitest coverage for PR comments, Codecov upload
6. **Tag** (main pushes only) - a green run calls the Tag & push workflow, so release tags fire only after green main CI

Manual dispatch of the workflow has a `force` input (`TURBO_FORCE`) that bypasses the turbo cache — the deflake-reproduction path. CI also sets `CYPRESS_video: 'false'` (passed through un-hashed, so it never affects cache validity); local runs keep video recording.

### CI Environment Variables

```yaml
TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }} # Remote cache auth
TURBO_API: ${{ vars.TURBO_API }} # Cache API endpoint
TURBO_TEAM: ${{ vars.TURBO_TEAM }} # Team identifier
```

### Task-to-CI Mapping

| Turbo Task                        | CI Placement                                              |
| --------------------------------- | --------------------------------------------------------- |
| `build`                           | `ci:pull_request` (every PR and push)                     |
| `test`                            | `ci:pull_request`                                         |
| `test:coverage`                   | `ci:pull_request`, feeds coverage reports                 |
| `lint`                            | `ci:pull_request`                                         |
| `typecheck`                       | `ci:pull_request`                                         |
| `format:check`                    | `ci:pull_request`                                         |
| `check:bundle`, `codecov:bundle`  | `ci:pull_request`                                         |
| `@tools/release#check:pack`       | `ci:main` only (main pushes)                              |
| `@tools/dts-backtest#test:matrix` | `ci:main` only; PRs run the current-TS `#test` leg        |
| `typecheck:peer-floor`            | Neither ci graph — Release signals check runs + bump gate |

## Remote Caching

Turborepo remote caching accelerates CI builds by sharing cached artifacts across runs.

**When to use remote cache:**

- CI builds - automatically enabled when `TURBO_TOKEN` is set
- Local development with slow rebuilds
- Team collaboration on large changes

**Setup:** See [REMOTE_CACHE.md](./REMOTE_CACHE.md) for detailed configuration.

**Quick start for local development:**

1. Create `.turbo/config.json` with team config
2. Export `TURBO_TOKEN` in your shell
3. Run `turbo build` - artifacts upload/download automatically

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

Root tasks use `//#` prefix and require scripts in root `package.json`:

- `//#lint:root` - lints root-level files (workspace directories excluded)
- `//#lint:package-json` - lints every `package.json` and `pnpm-workspace.yaml`
- `//#lint:workflows` - actionlint + zizmor over GitHub Actions workflows
- `//#typecheck:root` - typechecks root-level scripts
- `//#format:root` - formats root-level files
- `//#format:check:root` - checks root-level formatting

These run alongside workspace tasks via `with` configuration.

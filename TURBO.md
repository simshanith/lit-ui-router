# Turborepo Workflow Guide

This monorepo uses [Turborepo](https://turbo.build/) for orchestrating builds, tests, and other tasks across workspaces.

## Installation

[Install turbo globally](https://turborepo.dev/docs/getting-started/installation#global-installation) for the best developer experience:

```bash
pnpm add turbo --global
```

## Workspace Structure

Turbo manages these workspaces (defined in `pnpm-workspace.yaml`):

| Directory     | Purpose                                    | In CI |
| ------------- | ------------------------------------------ | ----- |
| `packages/*`  | Published libraries (lit-ui-router, etc.)  | Yes   |
| `apps/*`      | Sample applications and e2e tests          | Yes   |
| `tools/*`     | Internal build tools                       | Yes   |
| `docs`        | Documentation site                         | Yes   |

**Excluded from turbo:**

| Directory   | Purpose                                          |
| ----------- | ------------------------------------------------ |
| `examples/` | Standalone tutorial apps (helloworld, etc.)      |

The `examples/` directory contains tutorial applications (helloworld, hellogalaxy, hellosolarsystem) that are intentionally excluded from turbo. These are standalone Vite dev servers meant for learning - they have no turbo.json files and are not part of the CI pipeline. They use npm (not pnpm) for Stackblitz compatibility:

```bash
cd examples/helloworld
npm install
npm run dev
```

## Task Dependency Graph

### Root Configuration (`turbo.json`)

The root `turbo.json` defines shared task configurations inherited by all workspaces:

```
ci
├── build       (outputs: dist/**)
├── test        (inputs: src/**/*.ts, vitest.config.ts, cypress.config.ts)
├── test:coverage (outputs: coverage/**)
├── lint        (runs with //#lint:root)
└── format:check (runs with //#format:check:root)

build
└── ^build      (depends on workspace dependencies' builds)

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

### Workspace Extensions

Workspaces extend the root configuration using `"extends": ["//"]`:

| Workspace                 | Custom Configuration                                                         |
| ------------------------- | ---------------------------------------------------------------------------- |
| `packages/lit-ui-router`  | Adds `build:custom-elements` before build, configures `docs:api`             |
| `apps/sample-app-lit`     | Adds env vars for build (VITE\_\*)                                           |
| `apps/sample-app-lit-e2e` | Disables test caching for e2e tests                                          |
| `docs`                    | Adds `docs:preview`, `wrangler:dev` tasks, requires `^docs:api` before build |

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

# Full CI pipeline (build + test + coverage + lint + format:check)
turbo ci

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

The GitHub Actions workflow (`.github/workflows/build-test.yml`) runs the full CI pipeline:

1. **Checkout** - Clone repository
2. **Setup** - Install pnpm, Node.js 22.17.1, dependencies
3. **Install browsers** - Playwright and Cypress for e2e tests
4. **Build and Test** - `pnpm run ci` (triggers turbo ci task)
5. **Coverage reports** - Vitest coverage for PR comments, Codecov upload

### CI Environment Variables

```yaml
TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }} # Remote cache auth
TURBO_API: ${{ vars.TURBO_API }} # Cache API endpoint
TURBO_TEAM: ${{ vars.TURBO_TEAM }} # Team identifier
```

### Task-to-CI Mapping

| Turbo Task      | CI Step                                   |
| --------------- | ----------------------------------------- |
| `build`         | Part of `ci` task                         |
| `test`          | Part of `ci` task                         |
| `test:coverage` | Part of `ci` task, feeds coverage reports |
| `lint`          | Part of `ci` task                         |
| `format:check`  | Part of `ci` task                         |

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

- `//#lint:root` - lints examples directory
- `//#format:root` - formats root-level files
- `//#format:check:root` - checks root-level formatting

These run alongside workspace tasks via `with` configuration.

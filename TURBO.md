# Turborepo Workflow Guide

This monorepo uses [Turborepo](https://turbo.build/) for orchestrating builds, tests, and other tasks across workspaces.

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

| Workspace | Custom Configuration |
|-----------|---------------------|
| `packages/lit-ui-router` | Adds `build:custom-elements` before build, configures `docs:api` |
| `apps/sample-app-lit` | Adds env vars for build (VITE_*) |
| `apps/sample-app-lit-e2e` | Disables test caching for e2e tests |
| `docs` | Adds `docs:preview`, `wrangler:dev` tasks, requires `^docs:api` before build |

## Common Commands

```bash
# Build all packages
pnpm turbo run build

# Run all tests
pnpm turbo run test

# Run tests with coverage
pnpm turbo run test:coverage

# Lint all packages
pnpm turbo run lint

# Check formatting
pnpm turbo run format:check

# Fix formatting
pnpm turbo run format

# Full CI pipeline (build + test + coverage + lint + format:check)
pnpm turbo run ci

# Development server (persistent)
pnpm turbo run dev

# E2E tests
pnpm turbo run e2e
```

### Filtering

```bash
# Single package
pnpm turbo run build --filter=lit-ui-router

# Package and its dependencies
pnpm turbo run build --filter=lit-ui-router...

# Package and its dependents
pnpm turbo run build --filter=...lit-ui-router

# Only changed packages
pnpm turbo run build --filter=[HEAD^1]

# Specific directory
pnpm turbo run build --filter=./packages/*
```

### Cache Control

```bash
# Force rebuild (ignore cache)
pnpm turbo run build --force

# Dry run (show what would run)
pnpm turbo run build --dry-run

# Show cache status
pnpm turbo run build --summarize
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
TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}  # Remote cache auth
TURBO_API: ${{ vars.TURBO_API }}         # Cache API endpoint
TURBO_TEAM: ${{ vars.TURBO_TEAM }}       # Team identifier
```

### Task-to-CI Mapping

| Turbo Task | CI Step |
|------------|---------|
| `build` | Part of `ci` task |
| `test` | Part of `ci` task |
| `test:coverage` | Part of `ci` task, feeds coverage reports |
| `lint` | Part of `ci` task |
| `format:check` | Part of `ci` task |

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
3. Run `pnpm turbo build` - artifacts upload/download automatically

## Troubleshooting

### Cache Not Working

```bash
# Check what turbo sees as inputs
pnpm turbo run build --dry-run --summarize

# Force fresh build
pnpm turbo run build --force

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
TURBO_LOG_VERBOSITY=debug pnpm turbo run build
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

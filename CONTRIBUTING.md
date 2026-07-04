# Contributing to lit-ui-router

## Development

This repo uses [mise](https://mise.jdx.dev) to pin the Node.js, pnpm, and turbo versions used by contributors and CI. Versions are declared in [`.config/mise/config.toml`](./.config/mise/config.toml).

```bash
# Install mise: https://mise.jdx.dev/getting-started.html
mise trust
mise install
pnpm install
turbo build
```

`mise install` provisions the pinned Node, pnpm, and turbo (as a global tool) and puts them on `PATH` via mise's shims — no `nvm use` or `pnpm add --global` needed. See [TURBO.md](./TURBO.md) for detailed turbo commands and workflows.

## Running Tests

```bash
# Run all tests
pnpm run ci

# Run unit tests only
pnpm --filter lit-ui-router test

# Run E2E tests
pnpm --filter sample-app-lit-e2e test
```

## Pull Requests

- Fork PRs won't run CI automatically (secrets aren't available to forks)
- A maintainer will review and run CI on your behalf
- Ensure your changes pass local tests before submitting

## Releases

Releases are handled by maintainers using GitHub Actions. See [RELEASE.md](./RELEASE.md) for the complete release workflow documentation.

**Quick overview:**

1. Maintainer triggers "Bump version" workflow
2. Release PR is created and reviewed
3. Merge triggers automatic tagging
4. Tag triggers NPM publish and GitHub Release

## Deployment

The [Cloudflare Github integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/) deploys documentation on push. See [DEPLOY.md](./DEPLOY.md) for details.

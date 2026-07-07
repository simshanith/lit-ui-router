# Contributing to lit-ui-router

## Development

This repo uses [mise](https://mise.jdx.dev) to provision the Node.js, pnpm, and turbo versions used by contributors and CI. Node comes from [`.nvmrc`](./.nvmrc) (mise reads it automatically); pnpm and turbo are pinned in [`.config/mise/config.toml`](./.config/mise/config.toml).

```bash
# Install mise: https://mise.jdx.dev/getting-started.html
mise trust
mise install
pnpm install
turbo build
```

`mise install` provisions the pinned Node, pnpm, and turbo (as a global tool) and puts them on `PATH` via mise's shims — no separate `nvm use` or `pnpm add --global` needed. See [TURBO.md](./TURBO.md) for detailed turbo commands and workflows.

## Running Tests

```bash
# Run all tests
pnpm run ci

# Run unit tests only
pnpm --filter lit-ui-router test

# Run E2E tests
pnpm --filter sample-app-lit-e2e test
```

## TypeScript authoring

The published packages support consumers on **TypeScript 5.0+**, while the
repo itself builds with a newer TypeScript (pinned in the pnpm catalog).
The floor constrains only the **public API surface**: whatever appears in
the emitted `dist/*.d.ts` (exported types, signatures) must be valid under
TypeScript 5.0. Implementation code may freely use features of the repo's
current TypeScript — they only matter if they leak into a declaration
(e.g. `NoInfer<T>` in an exported signature breaks 5.0 consumers; the same
type inside a function body emits nothing and is fine).

This is enforced in CI by [`tools/dts-backtest`](./tools/dts-backtest/README.md),
which typechecks the built declarations with TypeScript 5.0.4 and the
current version, in `bundler` and `NodeNext` resolution modes. If
`dts-backtest#test` fails on your change, keep the newer-TS construct out
of the public surface — or raise the floor, which is a semver-major
discussion (see the tool README).

## Pull Requests

- Fork PRs won't run CI automatically (secrets aren't available to forks)
- A maintainer will review and run CI on your behalf
- Ensure your changes pass local tests before submitting

## Commit conventions

Every change lands on `main` as a **squash merge**, and the squash commit is
built from the PR itself:

- **PR title → commit subject.** Must be a [Conventional Commit](https://www.conventionalcommits.org/)
  header, e.g. `fix(navigation-location-plugin): handle hash-only URLs`.
  Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
  `build`, `ci`, `chore`, `revert`. Scope is optional.
- **PR body → commit body.** Write it as you'd write a commit body. An empty
  body is fine. `BREAKING CHANGE:` footers must start their own line. Don't
  leave HTML comments (`<!-- … -->`) in the body — they'd land in the commit.

The `Semantic PR` workflow (`.github/workflows/semantic-pr.yml`) enforces both
on every PR. Individual commits on your branch don't need to follow the
convention — only the PR title and body do.

### Enforcement gaps

Honest limits of this setup:

- The merge dialog lets whoever merges overwrite the pre-filled message;
  auto-merge (`gh pr merge --squash --auto`) avoids that edit entirely.
- Repository admins (including the release automation's PAT) bypass the
  `main` ruleset and can push non-conventional commits directly.
- Release PRs from the "Bump version" workflow are titled `Release X.Y.Z`
  and rely on the `release` label (or admin bypass) to skip the title lint.
- A well-formed `BREAKING CHANGE:` line in a body is taken at face value —
  the check validates format, not intent.

## Releases

Releases are handled by maintainers using GitHub Actions. See [RELEASE.md](./RELEASE.md) for the complete release workflow documentation.

**Quick overview:**

1. Maintainer triggers "Bump version" workflow
2. Release PR is created and reviewed
3. Merge triggers automatic tagging
4. Tag triggers NPM publish and GitHub Release

## Deployment

The [Cloudflare Github integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/) deploys documentation on push. See [DEPLOY.md](./DEPLOY.md) for details.

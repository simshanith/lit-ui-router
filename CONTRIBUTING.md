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
  `build`, `ci`, `chore`, `revert`. Scope is optional; `!` after the
  type/scope marks a breaking change.
- **Branch commit messages → commit body.** The squash body is assembled from
  the PR's individual commit messages (GitHub's `COMMIT_MESSAGES` setting), so
  write branch commits as conventional commits too — a `BREAKING CHANGE:`
  footer in a commit message (or `!` in the PR title) is what signals a major.
- **PR description → review artifact only.** It never lands in git history;
  write whatever helps reviewers, HTML comments and all.

The `Semantic PR` workflow (`.github/workflows/semantic-pr.yml`) enforces the
title on every PR. The `Commitlint` workflow
(`.github/workflows/commitlint.yml`) lints the PR's individual commits — the
messages that become the squash body — with
[commitlint](https://commitlint.js.org/) via
`wagoid/commitlint-github-action`. The rules live in `commitlint.config.mjs`:
`@commitlint/config-conventional` plus its default ignores (GitHub's
`Merge branch '…'` wordings, reverts, `fixup!`/`squash!`) and one extra ignore
for hand-typed `merge <x> into <y>` freshens. To check a message locally:

```sh
echo "feat(scope): my subject" | pnpm exec commitlint
```

Commits are also checked at commit time: run `pnpm run hooks:install` once
per clone to install a `commit-msg` hook via [prek](https://prek.j178.dev/)
(mise-managed, configured in `.pre-commit-config.yaml`) that runs commitlint
locally, and CI re-checks the same messages via the `lint_pr_commits` job.

### Enforcement gaps

Honest limits of this setup:

- The merge dialog lets whoever merges overwrite the pre-filled message;
  auto-merge (`gh pr merge --squash --auto`) avoids that edit entirely.
- Repository admins (including the release automation's PAT) bypass the
  `main` ruleset and can push non-conventional commits directly.
- Release PRs from the "Bump version" workflow are titled `Release X.Y.Z`
  and rely on the `release` label (or admin bypass) to skip the title lint.
- Merge commits are exempt from the commit lint, so refreshing a branch via
  merge adds `Merge branch 'main' into …` noise bullets to the squash body —
  prefer rebase to refresh.

## Releases

Releases are handled by maintainers using GitHub Actions. See [RELEASE.md](./RELEASE.md) for the complete release workflow documentation.

**Quick overview:**

1. Maintainer triggers "Bump version" workflow
2. Release PR is created and reviewed
3. Merge triggers automatic tagging
4. Tag triggers NPM publish and GitHub Release

## Deployment

The [Cloudflare Github integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/) deploys documentation on push. See [DEPLOY.md](./DEPLOY.md) for details.

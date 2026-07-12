# Contributing to lit-ui-router

## Development

This repo uses [mise](https://mise.jdx.dev) to provision the toolchain used by contributors and CI. Node comes from [`.nvmrc`](./.nvmrc) (mise reads it automatically); pnpm is pinned (with an integrity hash) by `packageManager` in [`package.json`](./package.json) and provisioned by corepack (itself a mise-pinned tool); turbo is the workspace devDependency, resolved from `node_modules/.bin`, which mise puts on `PATH`.

```bash
# Install mise: https://mise.jdx.dev/getting-started.html
mise trust
mise install     # provisions node, corepack, actionlint
mise run setup   # corepack-installs the pinned pnpm, then pnpm install
turbo build
```

`mise install` provisions the pinned Node and corepack. `mise run setup` is the bootstrap layer pnpm scripts can't own (there is no `node_modules` yet): its `corepack` dependency task enables corepack and installs the `packageManager`-pinned pnpm, then `pnpm install` runs — frozen-lockfile automatically in CI. No separate `nvm use`, `pnpm add --global`, or global turbo needed. With mise active, `node_modules/.bin` is on `PATH`, so bare `turbo` (and every other workspace binary) runs the workspace-pinned version; everything after bootstrap belongs to turbo/pnpm scripts. See [TURBO.md](./TURBO.md) for detailed turbo commands and workflows.

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
`wagoid/commitlint-github-action`. The rules live in `commitlint.config.ts`:
`@commitlint/config-conventional` plus its default ignores (GitHub's
`Merge branch '…'` wordings, reverts, `fixup!`/`squash!`) and one extra ignore
for hand-typed `merge <x> into <y>` freshens. To check a message locally:

```sh
echo "feat(scope): my subject" | pnpm exec commitlint
```

Commits are also checked at commit time: `mise run setup` (pnpm install) installs a
[husky](https://typicode.github.io/husky/) `commit-msg` hook (via the root
`prepare` script) that runs commitlint locally, and CI re-checks the same
messages via the `lint_pr_commits` job. If the hook is missing — pnpm 11
skips lifecycle scripts on "Already up to date" installs — run
`pnpm run prepare`. To skip the hook for one commit (`git commit -n`) or
disable husky entirely (`HUSKY=0`, which CI sets), see
[husky's how-to](https://typicode.github.io/husky/how-to.html).

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

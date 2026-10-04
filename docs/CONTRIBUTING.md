# Contributing to lit-ui-router

## Development

This repo uses [mise](https://mise.jdx.dev) to provision the toolchain used by contributors and CI. Each tool has exactly one version authority — one place to bump, no drift between duplicate pins:

| Tool       | Provided by                                     | Pinned in                                                                 |
| ---------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| node       | mise                                            | [`.nvmrc`](../.nvmrc)                                                     |
| npm        | mise (shadows node's bundled npm)               | [`.config/mise/config.toml`](../.config/mise/config.toml)                 |
| pnpm       | mise, held equal to `packageManager`            | `packageManager` in [`package.json`](../package.json) (+sha512 integrity) |
| turbo      | pnpm (`node_modules/.bin` on `PATH` via mise)   | [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) catalog                   |
| actionlint | mise (aqua backend, checksummed in `mise.lock`) | [`.config/mise/config.toml`](../.config/mise/config.toml)                 |
| zizmor     | mise (aqua backend, checksummed in `mise.lock`) | [`.config/mise/config.toml`](../.config/mise/config.toml)                 |

```bash
# Install mise: https://mise.jdx.dev/getting-started.html
mise trust
mise install     # provisions node, pnpm, npm, actionlint, zizmor
mise run setup   # pnpm install
turbo build
```

`mise install` provisions the pinned Node and pnpm. `mise run setup` is the bootstrap layer pnpm scripts can't own (there is no `node_modules` yet): `pnpm install` runs — frozen-lockfile automatically in CI.

The mise pin is **the version that runs**. `pnpm-workspace.yaml` sets `pmOnFail: ignore`, which turns off pnpm's swap to `packageManager` and with it the environment document pnpm would otherwise prepend to `pnpm-lock.yaml` — a second YAML document that GitHub's dependency graph and pnpm's own prune settings do not read. `packageManager` stays the version authority: [`tools/repo-checks/pnpm-pin.test.ts`](../tools/repo-checks/pnpm-pin.test.ts) holds the mise config and `mise.lock` equal to it and keeps `pnpm-lock.yaml` a single document, and [Cloudflare Workers Builds](../www/DEPLOY.md) installs the exact version it names. mise tasks always run the pinned pnpm; a bare `pnpm` runs whatever is first on `PATH`, and nothing swaps it, so check `pnpm --version` before a lockfile change. The aqua backend needs no Node, makes no first-use network fetch, and records a checksum **per platform** in `mise.lock` plus GitHub artifact attestations. corepack can also install pnpm 12 (the published package ships a `bin/pnpm.mjs` that fetches the pinned native binary on first use), and a contributor whose environment reaches for it still gets an integrity-checked binary: it enforces the `+sha512` carried in `packageManager`. No separate `nvm use`, `pnpm add --global`, or global turbo needed. With mise active, `node_modules/.bin` is on `PATH`, so bare `turbo` (and every other workspace binary) runs the workspace-pinned version; everything after bootstrap belongs to turbo/pnpm scripts. mise-owned binaries (actionlint, zizmor) are invoked via mise tasks; package.json scripts delegate with `mise run`, never `mise exec`.

pnpm's isolated `node_modules` means a workspace member's devDep binaries (`vitest`, `typedoc`, `vitepress`, …) live in that member's own `node_modules/.bin`, not the root one. When your shell is cd'd into a member directory, mise also puts that member's `.bin` first on `PATH`, so bare invocations resolve exactly as the member's own pnpm scripts would — including a member-local version shadowing the root one (e.g. `tools/vue-check`'s TypeScript 6 `tsc`). This only applies at the member's root directory, not its subdirectories; `pnpm run` inside the member works everywhere regardless. See [TURBO.md](./TURBO.md) for detailed turbo commands and workflows.

### mise environment

Only an activated shell, `mise run` and `mise exec` apply the `[env]` block in
[`.config/mise/config.toml`](../.config/mise/config.toml). A shell that reaches
tools through mise shims resolves `pnpm` but not that environment; if
`mise env | grep VAR` shows a variable that `echo $VAR` doesn't, run the command
through `mise exec --`. CI is unaffected: `jdx/mise-action` exports `[env]` to
every later step.

An `[env]` assignment overrides the inherited value, and the checked-in config
evaluates before `config.local.toml`, so a default declared there defeats a
per-checkout override. A value meant to be overridable keeps its default in code
(`WWW_DEV_PORT` in `www/lit-ui-router.dev/dev-port.ts`).

Tools installed globally through mise sit on `PATH` behind `node_modules/.bin`.
When you remove a dependency, a script that still calls its binary can resolve
the global copy locally and pass, then fail in CI with `not found`; hide the
global binary before trusting a local run.

## Running Tests

```bash
# Run the PR CI pipeline (build, tests, coverage, lint, typecheck,
# format check, bundle checks) — what every PR runs
mise run ci

# PR pipeline plus the main-only guards (Firefox/WebKit vitest engines pass,
# pack check, dts-backtest TS matrix) — what a push to main runs
mise run ci_main

# Run unit tests only
pnpm --filter lit-ui-router test

# Run E2E tests (builds the site, serves it, then the suites through turbo)
mise run test_e2e

# Or hold a server open and drive individual suites against it
mise run //www/lit-ui-router.dev:serve
turbo run test:e2e:hash
```

See [the suite README](../apps/sample-app-lit-e2e/README.md) for suite
selection, and for serving an already-built site without mise.

`pnpm run crap` ranks each vitest package's functions by CRAP score
(complexity against coverage) from the coverage `test:coverage` writes,
flagging those over crap4ts' default threshold. It never fails and no CI
lane runs it. With coverage already on disk, `pnpm --filter lit-ui-router
run crap 25` prints a longer list for one package.

`mise run ci` and `mise run ci_main` are the same invocations CI uses. `pnpm run ci` remains as an alias for the PR pipeline.

They are the same invocations, not the same room: CI builds from a fresh
checkout, a local run reuses whatever `dist/` already holds. No build here
empties its `dist/` first, and `dist/` is gitignored, so a source file deleted
or renamed on a branch leaves its old emit behind, where `files: ["dist/**"]`
and `./dist/*` exports still ship it. Turbo hashes inputs, not output
directories, and never notices. Before a local check that reads `dist/` as
shipped output (`check:pack`, `npm pack`, a `file:` install into another
project), list the ignored files first:

```bash
git clean -Xdn -- packages/*/dist tools/*/dist
```

then remove them:

```bash
git clean -Xdf -- packages/*/dist tools/*/dist
```

`-X` removes only ignored files, so untracked work survives.

Pull requests run the vitest browser specs in Chrome only; `test:engines`
(the `firefox` and `safari` projects) runs on `main`. A PR that adds or edits a
spec in a package's `browserOnlySpecs` should run it in those engines first:

```bash
VITEST_BROWSER_API_PORT=63399 pnpm -C packages/lit-ui-router exec vitest run --project=firefox --project=safari src/specs/<spec>.spec.ts
```

Each package script sets its own `VITEST_BROWSER_API_PORT`, and the vitest
config keys its Vite cache directory by it; pick a port no script uses so the
run can't collide with a turbo task. Install the browsers with
`mise run '//tools/build_and_test:playwright'` if they are missing.

### Reproducing a CI failure

A `Build and Test` job ends with the `Turbo run summary` step. It reads every
`--summarize` JSON the job wrote (the ci graph, the docs build, the e2e suites)
and reports only the tasks that failed; turbo's stream also prints `ELIFECYCLE`
for every task it cancelled. Its headline is a run annotation, so
`gh run view <run-id>` shows it:

```text
X 1 failing task: @tools/repo-checks#check:task-inputs — 10 succeeded, 217 cached, 229 attempted
```

Each failing task gets a log excerpt and two commands, in the step summary and
in the job log:

```text
── @tools/repo-checks#check:task-inputs (exit 1)
   repro: turbo run check:task-inputs --filter=@tools/repo-checks --force
   exact: cd tools/repo-checks && node check-task-inputs.ts
```

A red build fails the summary step, not the build step, so the job opens on the
report. The build step prints output only for failing tasks; the
`turbo-task-logs` artifact holds every task's full log, and the summary links
it. Locally, `mise run ci` prints everything unless `TURBO_OUTPUT_LOGS` says
otherwise.

`gh run view <run-id> --log-failed` returns the failed steps' logs. Save it to a
file and search for `repro:`. Run the `repro:` line: `--force` re-runs that task while its dependencies stay
cached. `exact:` is the command turbo ran, from the directory it ran in.

Two workflows run the same job:

- `build-test.yml` (`build_and_test / run`) runs on pull requests and pushes to
  `main`. A pull-request run tests the branch merged into `main`, not the
  branch head.
- `build-test-branch.yml` (`build_and_test (branch) / run`) runs on pushes that
  no pull-request run covers: a branch with no PR, a PR with conflicts (it has
  no merge ref), and `ci-main/` branches, which build the `ci:main` graph. It
  tests the branch head. Its signal gate skips it when a PR run covers the
  push, so a skipped branch job is not a missing run. `gh run list --branch <branch>`
  lists both workflows' runs.

The line at the top of the run's log names the commit it tested, for every
trigger:

```text
Uses: simshanith/lit-ui-router/.github/workflows/build-test-run.yml@refs/pull/1036/merge (b6d39e4ad2d99bafb05ed84c4a16c916d44ee4ad)
```

Check out that SHA. `refs/pull/<n>/merge` moves with `main` and disappears
once the PR merges, but the SHA still fetches:

```bash
git fetch origin b6d39e4ad2d99bafb05ed84c4a16c916d44ee4ad
git switch --detach FETCH_HEAD
```

Where the `repro:` line isn't enough:

- A headline of `no task reported a non-zero exit` means the run died outside
  a task (a turbo error, a runner timeout, a cancellation). The full step log
  is the only source.
- `test:e2e:*` tasks need a server. Reproduce one with `mise run test_e2e <suite>`
  ([the suite README](../apps/sample-app-lit-e2e/README.md)). The
  `cypress-videos` and `wrangler-logs` artifacts hold the run's videos and
  server logs.
- The uncapped summaries are the `turbo-run-summaries` artifact:
  `gh run download <run-id> -n turbo-run-summaries`.

### Reproducing a Codecov failure

The Codecov PR comment names the file with missing lines, not the line. Patch
status is `target: auto` with no threshold, so one uncovered changed line fails
it when base coverage is near 100%. The `codecov/project/<pkg>` checks are
`component_management` components, not flags; see
[`.github/codecov.yml`](../.github/codecov.yml).

The line comes from the local run CI uploads:

```bash
turbo run test:coverage --filter=lit-ui-router
```

vitest's text reporter prints an `Uncovered Line #s` column, and the package's
`coverage/` holds `lcov.info` (`DA:<line>,0` is an unhit line) and
`coverage-final.json` (v8 statement and branch maps — a branch miss on a line
that did run shows there, not in the line column). `ui-router-server` runs
`node --test` instead, which prints an `uncovered lines` column and writes
`coverage/lcov.info` rewritten to repo-relative paths by `rebase-lcov`.

To list only the files the branch touched (per file, not per line):

```bash
turbo run test:coverage --filter=lit-ui-router -- --coverage.reporter=text --coverage.changed=origin/main
```

The narrowed run prints the table only and drops the package's `coverage/` files;
run the full command again to write them back. Do not pass the test-level
`--changed`: it drops specs that don't import the changed files, so coverage
reads lower than CI's. An uncovered line is often an unreachable branch rather
than a missing test, and the fix can be deleting it.
`CODECOV_TOKEN` is an upload-only CI secret; it cannot read reports and is not
needed locally.

## TypeScript authoring

The published packages support consumers on **TypeScript 5.0+**, while the
repo itself builds with a newer TypeScript (pinned in the pnpm catalog).
The floor constrains only the **public API surface**: whatever appears in
the emitted `dist/*.d.ts` (exported types, signatures) must be valid under
TypeScript 5.0. Implementation code may freely use features of the repo's
current TypeScript — they only matter if they leak into a declaration
(e.g. `NoInfer<T>` in an exported signature breaks 5.0 consumers; the same
type inside a function body emits nothing and is fine).

This is enforced in CI by [`tools/dts-backtest`](../tools/dts-backtest/README.md),
which typechecks the built declarations in `bundler` and `NodeNext`
resolution modes. PRs run the current-TS leg (`@tools/dts-backtest#test`);
pushes to `main` run the full TypeScript version matrix down to 5.0.4
(`@tools/dts-backtest#test:matrix`, part of the `ci:main` graph). If
`@tools/dts-backtest#test` fails on your change, keep the newer-TS construct out
of the public surface — or raise the floor, which is a semver-major
discussion (see the tool README).

## Pull Requests

- Fork PRs won't run CI automatically (secrets aren't available to forks)
- A maintainer will review and run CI on your behalf
- Ensure your changes pass local tests before submitting

### Automated review

[CodeRabbit](https://docs.coderabbit.ai) reviews by request, not by default —
the free OSS tier meters reviews, so they are worth spending deliberately. Label
a PR `coderabbit:review` to ask for one; it is one-shot, and
[`coderabbit-oneshot.yml`](../.github/workflows/coderabbit-oneshot.yml) strips
the label again once the review lands, so pushing more commits does not spend a
second review. Re-label to ask for another pass, or comment
`@coderabbitai review`, which works on any PR without touching a label. Label a
PR `coderabbit:skip` to record that it is reviewed by hand: that veto wins even
if `coderabbit:review` is also on. Drafts are not reviewed — work here sits in
draft a long time and a WIP push is not a review request — but the label
survives the flip, so labelling a draft queues the review up for the moment it
is marked ready. It is advisory either way: no required status check, nothing it says blocks a
merge. `mise run ci` remains the gate.

Expect roughly a minute between marking a PR ready and the review appearing,
with no progress indicator in between: CodeRabbit posts one summary comment when
the PR opens and rewrites that same comment in place when the review lands, so
nothing new shows up while it works. Wait it out rather than adjusting labels —
adding `coderabbit:skip` to a PR whose review is already in flight can cancel it.

Stacked PRs work the same way. `base_branches` is set to `.*`, so a PR based on
another branch is reviewable on request like any other; it used to list `main`
alone, which is the default branch and so matched nothing, and CodeRabbit
declined every stacked PR whether or not it was labelled.

The `release` exclusion is still listed. It does nothing while review is opt-in,
but the label is applied by the release automation, so it stays as the standing
exclusion if this ever flips back to opt-out. The older `no-coderabbit` opt-out
is retired.

Its behaviour lives in [`.coderabbit.yaml`](../.coderabbit.yaml), read from the
PR's own branch, so a PR may adjust its own review — and a long-lived branch
keeps the rules it was cut with until it picks up `main`. The static analysers this
repo already gates (oxlint, ESLint, actionlint, zizmor, shellcheck, rumdl,
yamllint) are switched off there to avoid a second, weaker copy of CI; secret
scanning is left on because nothing else covers it.

Because the config is read from the PR branch, a PR can also disable its own
review — including the `gitleaks` secret scan. Treat CodeRabbit as defence in
depth, never as the secret-scanning floor: that belongs to GitHub's own secret
scanning and push protection, which no PR can reach.

Useful comment commands: `@coderabbitai review` for an incremental pass,
`@coderabbitai full review` to re-review from scratch, `@coderabbitai pause` and
`resume`, and `@coderabbitai configuration` to print the resolved settings.
Replying to a review comment in plain English teaches it a durable convention.

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
`wagoid/commitlint-github-action`. The rules live in `.commitlintrc.ts`:
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
- Dependabot's commits carry the whole PR body (update table and metadata
  YAML), which fails `lint_pr_commits` on line length even though the subject
  is conventional. No exemption exists; the redo described under
  [Dependabot PRs](#dependabot-prs) sidesteps it.
- GitHub counts a skipped required check as passing, so a required check name
  must be one that a skipped job never emits (see the header of
  [`commitlint.yml`](../.github/workflows/commitlint.yml)).

## Updating dependencies

The ground rules (bump the catalog entry, then `mise run setup`; no routine
`pnpm update`; `parent>child` overrides; scoped `mise lock`) and the Dependabot
edits to reject are in
[AGENTS.md: pnpm and dependencies](../AGENTS.md#pnpm-and-dependencies).

### Dependabot PRs

Treat a Dependabot PR as a notification, not a merge candidate. Never push to a
`dependabot/*` branch: Dependabot rebases, closes or reopens its PRs and takes
your commits with it. Redo the bump on your own branch off `main`, hand-applying
the good catalog edits from the PR's `pnpm-workspace.yaml` hunk, and open a PR
that references it. Then comment `@dependabot close` on the superseded PR. Never
`@dependabot ignore this major version` there: it suppresses every future major
of that dependency, and nothing on the PR shows it later. If the bot doesn't act
on the comment, close the PR by hand.

Dependabot's pnpm updater can also rewrite a `catalog:` specifier in
`pnpm-lock.yaml` to a literal version. Every frozen install then fails with
`ERR_PNPM_OUTDATED_LOCKFILE` at setup, before any test runs; regenerating the
lock from `main`'s on your own branch fixes it.

### Hand-authored bumps

`pnpm outdated -r` lists the candidates. Edit the catalog entries, then
`mise run setup`. `autoDedupe` collapses compatible duplicates as the install
resolves, and `lint` runs `check:dedupe` and `check:single-version` over the
result. Neither catches everything:

- An exact pin beside a newer range (a dependency's own `esbuild` pin against
  the catalog's caret) has no common version. Pin it up with a scoped override
  rather than lowering the catalog range, and drop the override once the
  dependency catches up.
- A locked resolution whose range already admits the new version stays where
  it is. Add a temporary exact override, install, delete it and install again:
  the lock keeps the new version and no override is committed.
- `check:single-version` covers catalog, direct and override names only; a
  split in a transitive exact pin passes it.

Every package that runs vitest declares the same set of vitest's optional peers
(`@types/node` and `happy-dom`, `catalog:`), even a browser-only package that
never touches `happy-dom`. An undeclared peer is auto-installed at its latest
version, which gives that package's vitest a second peer key and surfaces
elsewhere as `TS2769` in a `vitest.config.ts`. `pnpm-lock.yaml` should hold one
peer-keyed `vitest@<version>(...)` entry.

`minimumReleaseAge` (with `minimumReleaseAgeStrict`) in
[`pnpm-workspace.yaml`](../pnpm-workspace.yaml) refuses versions younger than
a day. To take one early, add exact `name@version` entries to
`minimumReleaseAgeExclude`: excluding a package does not exclude its
per-platform binaries or the rest of its release family, so harvest the full
list from the install error. Say in the PR that the exclusion
is temporary, and remove it once the versions age past the window; deleting an
aged exclusion leaves `pnpm-lock.yaml` byte-identical.

### Bumping pnpm

`packageManager` in [`package.json`](../package.json) carries the version and
the hex sha512 of the npm tarball; convert the registry's base64 `dist.integrity`
rather than downloading it. Move the `aqua:pnpm/pnpm` pin in
[`.config/mise/config.toml`](../.config/mise/config.toml) and its version in
`.config/mise/mise.lock` to match, then `mise lock aqua:pnpm/pnpm`.
[`pnpm-pin.test.ts`](../tools/repo-checks/pnpm-pin.test.ts) fails the PR if any
of them disagree. Read the release notes for changes to the executable before
picking a version: 12.2.0 broke the upgrade path this repo takes out of 12.1 on
POSIX.

### Patched dependencies

`patchedDependencies` in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) maps
each package to a file in [`patches/`](../patches), and `check:patches` fails
when a hunk no longer lands in the installed package. To extend a patch:

- `pnpm patch <pkg>@<version>` extracts the pristine package. Re-apply every
  existing hunk in the edit directory, or the new patch drops them.
- `pnpm patch-commit` writes a version-keyed patch file and manifest entry
  beside the existing ones. Move the new file over the existing path, revert
  the manifest change, and run `pnpm install` to refresh the lock's patch hash.
- If the package ships `dist/*.d.ts` and its `types` points there, a JSDoc
  change to the `.js` doesn't reach consumers; patch the declaration too.

## Dependency audit

[`dependency-audit.yml`](../.github/workflows/dependency-audit.yml) runs
`pnpm audit --audit-level high` on every lockfile or workspace-config change to
`main`, weekly, and on dispatch. It runs outside turbo, so a cached result never
hides a newly published advisory. Accepted advisories go in the `audit:` section
of `pnpm-workspace.yaml`.

## Releases

Releases are handled by maintainers using GitHub Actions. See [RELEASE.md](./RELEASE.md) for the complete release workflow documentation.

**Quick overview:**

1. Maintainer triggers "Bump version" workflow
2. Release PR is created and reviewed
3. Merge runs main CI; a green run tags the release automatically (manual
   dispatch of "Tag & push" is the escape hatch)
4. Tag triggers NPM publish and GitHub Release

## Deployment

The [Cloudflare Github integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/) deploys documentation on push. See [`www/DEPLOY.md`](../www/DEPLOY.md) for details.

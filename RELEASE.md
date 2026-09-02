# Release Guide

This document describes the release workflow for `lit-ui-router`.

## Overview

The release process is automated through GitHub Actions with protected environments for security. Releases follow a multi-stage pipeline:

1. **Version Bump** - Create a release PR with version changes
2. **Build & Test** - Validate the PR on CI
3. **Merge** - Merge the release PR to main
4. **Tag** - A green main CI run automatically tags the release
5. **Publish** - Publish to NPM and create GitHub Release

## Tag and Branch Conventions

| Pattern                        | Purpose                    | Example                        |
| ------------------------------ | -------------------------- | ------------------------------ |
| `lit-ui-router@X.Y.Z`          | Package release tags       | `lit-ui-router@1.2.3`          |
| `release/lit-ui-router/vX.Y.Z` | Release prep branches      | `release/lit-ui-router/v1.2.3` |
| `main`                         | Primary integration branch | -                              |

## Protected Environments

The release workflows use GitHub protected environments to ensure proper authorization:

| Environment    | Purpose               | Required For                  |
| -------------- | --------------------- | ----------------------------- |
| `bump-version` | Version bump workflow | Creating release branches/PRs |
| `tag-release`  | Tagging workflow      | Pushing release tags          |
| `publish`      | NPM publishing        | Publishing to NPM registry    |

### Environment Secrets

- **`GH_PERSONAL_ACCESS_TOKEN`** - Used by `bump-version` and `tag-release` environments for:
  - Creating branches
  - Pushing tags
  - Creating PRs that trigger downstream workflows

This is a [Fine-Grained Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#fine-grained-personal-access-tokens) with **Read** and **Write** access to [artifact metadata](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens?apiVersion=2022-11-28#repository-permissions-for-artifact-metadata), [attestations api](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens?apiVersion=2022-11-28#repository-permissions-for-attestations), [code](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens?apiVersion=2022-11-28#repository-permissions-for-contents), and [pull requests](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens?apiVersion=2022-11-28#repository-permissions-for-pull-requests)

- **`CODECOV_TOKEN`** - Used for uploading coverage reports

The `publish` environment uses **OIDC Trusted Publishing** instead of NPM tokens. See [NPM Trusted Publishers](https://docs.npmjs.com/trusted-publishers) for setup.

### Repository Variables (Turbo Remote Cache)

The following [repository variables](https://docs.github.com/en/actions/reference/variables) enable turborepo remote caching via Cloudflare R2:

| Variable     | Purpose                                      |
| ------------ | -------------------------------------------- |
| `TURBO_API`  | Worker endpoint URL (no trailing slash)      |
| `TURBO_TEAM` | Team identifier (e.g., `team_lit-ui-router`) |

### Repository Secrets (Turbo Remote Cache)

| Secret        | Purpose                               |
| ------------- | ------------------------------------- |
| `TURBO_TOKEN` | Authentication token for remote cache |

These are consumed by `build-test.yml` and `publish-npm.yml` to enable remote caching during CI builds.

## Workflows

### 1. Build and Test (`build-test.yml`)

**Triggers:** Pull requests, `main` pushes, manual dispatch

[Actions ▸ Build and Test ▸ **Run workflow**](https://github.com/simshanith/lit-ui-router/actions/workflows/build-test.yml)

Runs the CI pipeline including:

- Build verification
- Unit tests with Vitest
- E2E tests with Playwright and Cypress
- Lint, typecheck, format, and bundle checks
- Coverage reporting to Codecov
- PR coverage comments (on PRs)

Pushes to `main` run the same graph plus the main-only guards (turbo
`ci:main`): the Firefox/WebKit vitest engines pass (`test:engines`), the
pack-surface manifest check (`check:pack`), and the full dts-backtest
TypeScript matrix. A green main run then calls the Tag & push workflow — a
red run means no tag, hence no publish. Manual dispatch can run the
`ci:main` graph on demand against any ref via the `mainGraph` input
(combine with `force` to deflake the full main graph), and a branch named
`ci-main/<topic>` builds it on every push — so the guards that gate a
release can be smoke-tested before merge. Tagging stays push-to-`main`
only, so neither path can release.

**Security:** Only runs on first-party PRs (not forks) to protect secrets.

#### Companion files

The pipeline is one set of steps split across three files by trigger, so that
neither event can instantiate the other's jobs:

| File                    | Trigger                      | Reports                                                         |
| ----------------------- | ---------------------------- | --------------------------------------------------------------- |
| `build-test.yml`        | PRs, `main` pushes, dispatch | `build_and_test / run` — the required status check              |
| `build-test-branch.yml` | pushes to any other branch   | `build_and_test (signal gate)`, `build_and_test (branch) / run` |
| `build-test-run.yml`    | `workflow_call` only         | the `run` job both callers share                                |

Branch-head pushes are gated: `build_and_test (signal gate)` asks whether a
`pull_request` run will cover the SHA anyway, and skips the duplicate when it
will. It cannot skip when a base conflicts (GitHub builds no merge ref) or when
no PR is open, which are exactly the SHAs that would otherwise get no CI.

The split is what makes `build_and_test / run` safe to require: a branch push
never runs `build-test.yml`, so it cannot report that name — and GitHub counts
a _skipped_ required check as passing.

### 2. Bump Version (`bump-version.yml`)

**Triggers:** Manual dispatch only

[Actions ▸ Bump version ▸ **Run workflow**](https://github.com/simshanith/lit-ui-router/actions/workflows/bump-version.yml)

Creates a release PR by:

1. Calculating the new version based on increment type
2. Creating a release branch (`release/lit-ui-router/vX.Y.Z`)
3. Committing version changes
4. Opening a PR against `main`

**Inputs:**

- `increment` - Version bump type: `major`, `minor`, `patch`, `other`, `none`
- `other` - Custom version string (when using `other`)
- `prBase` - Target branch (default: `main`)
- `branchPrefix` - Branch prefix (default: `release/lit-ui-router/v`)

### 3. Tag & Push (`publish-gh.yml`)

**Triggers:** Called by Build and Test after a green `main` run (`workflow_call`); manual dispatch is the CI-bypass escape hatch

[Actions ▸ Tag & push ▸ **Run workflow**](https://github.com/simshanith/lit-ui-router/actions/workflows/publish-gh.yml)

When a release PR merges and main CI is green:

1. Uses release-it to create a git tag per package (`<package>@X.Y.Z`)
2. Pushes the tag to origin
3. Tag push triggers the publish workflow

**Note:** The tag and push steps classify their own idempotent outcomes (#674): a tag that already exists (locally, or on the remote at this or another commit) is skipped and the step succeeds. Any other failure, including a rejected push, fails the run. A remote tag on an older commit is the steady state, not an anomaly: the workflow runs on every `main` push and tags the current manifest version, so the tag trails `HEAD` as soon as `main` advances past the release commit. That is why the skip is silent rather than a warning annotation.

### 4. Publish to NPM (`publish-npm.yml`)

**Triggers:** Tag push matching a published package tag (`lit-ui-router@*`, `lit-ui-router-mobx@*`, `ui-router-navigation-location-plugin@*`, `ui-router-server@*`, `eslint-plugin-lit-ui-router@*`); manual dispatch for dry runs

[Actions ▸ Publish to NPM ▸ **Run workflow**](https://github.com/simshanith/lit-ui-router/actions/workflows/publish-npm.yml)

The final release stage:

1. Builds the package
2. Creates a tarball
3. Generates build provenance attestation
4. Publishes to NPM using OIDC trusted publishing
5. Creates a draft GitHub Release with the tarball
6. Marks the GitHub Release as final

### 5. Release signals (`release-signals.yml`)

**Triggers:** Pushes to `main`; called by Publish to NPM after a publish; manual dispatch

[Actions ▸ Release signals ▸ **Run workflow**](https://github.com/simshanith/lit-ui-router/actions/workflows/release-signals.yml)

Non-gating per-package check runs on main's head — `published-diff (<pkg>)`
(does the pack surface differ from the published `latest`?) and
`peer-floor (<pkg>)` (is an adapter's published peer floor stale?). The
README badges read these check runs; `action_required` renders orange,
meaning a release or floor bump is owed — never a CI failure.

## Step-by-Step Release Process

### Standard Release

1. **Start the version bump:**
   - Go to Actions → "Bump version"
   - Click "Run workflow"
   - Select increment type (`patch`, `minor`, or `major`)
   - Run the workflow

2. **Review the release PR:**
   - Wait for CI to pass
   - Review version changes in `package.json`
   - Check changelog updates

3. **Merge the release PR:**
   - Merge with squash commit
   - The merge runs main CI (including the main-only guards); a green run
     triggers tagging automatically
   - Merge it on its own and let its main run reach tagging before merging
     anything else — a queued main run can be evicted by a later push, which
     silently skips the tag (see [Tag workflow not running](#tag-workflow-not-running))

4. **Verify the release:**
   - Check Actions for tag-release workflow
   - Check Actions for publish-npm workflow
   - Verify on [npmjs.com/package/lit-ui-router](https://www.npmjs.com/package/lit-ui-router)
   - Check GitHub Releases page

### Prerelease / Custom Version

For prereleases like `1.2.3-beta.0`:

1. Run "Bump version" workflow with:
   - `increment`: `other`
   - `other`: `1.2.3-beta.0` (your custom version)

2. Follow standard process from step 2

   The publish creates a dist-tag named after the prerelease identifier
   (`1.2.3-beta.0` → `beta`) automatically; `latest` is untouched.

3. Retire that dist-tag once the line ships — see [Dist-Tags](#dist-tags)

### First Publish (New Package)

A package cannot use OIDC trusted publishing until it exists on npm, and it
cannot be published by the workflow until trusted publishing is configured.
Break the cycle by hand, once, before adding the package to any workflow list:

1. **Seed the package manually** — from a scratch directory containing a
   **minimal hand-written `package.json`** (name and a throwaway prerelease
   version such as `0.0.1-alpha.0`, nothing else), run
   `npm publish --tag latest` with a real token.

   Publishing a stub rather than the real package is deliberate: a minimal
   manifest has no `workspace:` or `catalog:` specifiers, so none of the
   pack-time rewriting the pipeline relies on
   (`publishPath`, `check:pack`) has to be reproduced by hand. The seed only
   has to make the name exist.

   **`--tag latest`, never a channel tag.** A package's first publish always
   takes `latest` regardless — npm requires that tag to exist — and npm 12
   refuses to publish a prerelease without an explicit `--tag`, so name the
   tag it would take anyway. `--tag alpha` cannot protect `latest`; it only
   points a _second_ tag at the seed, and that one strands as a fossil once the
   real release moves `latest` on. Both fossils this repo
   accumulated came from exactly that: `lit-ui-router-mobx` seeded at
   `0.1.0-rc.0` under `next` (superseded by `0.1.0` twenty minutes later, tag
   stranded for five weeks), and `ui-router-server` at `0.0.1-alpha.1` under
   `alpha`. Both have since been retired — every package now carries `latest`
   only, which is the steady state [Dist-Tags](#dist-tags) describes.

   The seed therefore holds `latest` until step 5 supersedes it. That is
   expected, and is why it should be a version nobody would want: short-lived
   and obviously prerelease.

   **When the first real release is itself a prerelease** (a package that opens
   at `1.0.0-rc.0`, say), step 5 does not supersede the seed: release-it
   publishes that version under its own channel tag, so the seed keeps `latest`
   until the first stable release. The channel tag is current for as long as
   that prerelease line lives, not a fossil. A maintainer who wants `latest` off
   the stub sooner can move it by hand with
   `npm dist-tag add <package>@<version> latest`.

2. **Configure the trusted publisher** on npmjs.com for the new package,
   pointing at `publish-npm.yml`.

3. **Admit the tag** on the GitHub side: add `<package>@*` to the release
   tags ruleset and to the `publish` environment's deployment tag policies.
   Without the latter the tag run fails with "not allowed to deploy to
   publish due to environment protection rules"; fix the policy and rerun.

   ```bash
   gh api -X POST repos/simshanith/lit-ui-router/environments/publish/deployment-branch-policies \
     -f name='<package>@*' -f type=tag
   ```

4. **Add the package** to the `bump-version.yml`, `publish-gh.yml`, and
   `publish-npm.yml` package lists, and to `tools/release`'s
   devDependencies (the self-dependency guard). This lands last:
   `publish-gh.yml` tags the current version on the very next push to
   `main`.

5. **Cut the real release** through the standard process.

6. **Confirm the tag state** once the first stable release holds `latest`:

   ```bash
   npm view <package> dist-tags
   ```

   Expect `latest` only at that point. Anything else is a fossil from a `--tag`
   on the seed or from a prerelease bump; retire it — see
   [Dist-Tags](#dist-tags). Before the first stable release the live channel tag
   of an open prerelease line stays put.

### Dist-Tags

npm gives built-in meaning to exactly one tag: `latest`, the default install
target. `next`, `canary`, `alpha`, `beta` are conventions with no registry
semantics.

**Channel tags are created automatically — you never opt in.** Publishing any
prerelease version creates one, except on a package's very first publish, which
always takes `latest` regardless. release-it resolves the dist-tag from the
version itself (`lib/plugin/npm/npm.js`, `resolveTag`): a non-prerelease gets
`latest`, and a prerelease gets its own identifier — `1.8.0-canary.0` publishes
to `canary`, `0.2.0-beta.1` to `beta`. A prerelease with no identifier falls
back to any existing non-`latest` tag on the package, then to `next`.

Two consequences:

- Every prerelease line manufactures a tag that outlives it. Retiring the tag
  is a recurring step after each prerelease, not a one-off cleanup.
- A leftover tag can silently capture a later identifier-less prerelease
  through that fallback, republishing a channel nobody meant to revive.

**Policy: `latest` only in the steady state.** A channel tag exists solely
while a prerelease on that channel is live. Retiring it is the closing step of
the prerelease, not an optional cleanup.

**A channel tag must never resolve older than `latest`.** `npm i pkg@next`
pointing at an older version than `npm i pkg` is a silent downgrade for anyone
who opts into the channel. Prerelease versions don't match caret ranges, so a
stale tag can't leak into ordinary installs — the blast radius is limited to
people who explicitly ask for it, which is exactly the audience it misleads.

Retire a tag with:

```bash
npm dist-tag rm <package> <tag>
```

This does **not** unpublish. The version stays installable by exact version and
the tag can be re-added later. Note that dist-tag changes are not covered by
OIDC trusted publishing — they need a local npm token with write access, so
this is a manual maintainer step rather than something CI does.

Check the current state of every package with:

```bash
npm view <package> dist-tags
```

## Troubleshooting

### Build failing on PR

- Check Vitest and Playwright test output
- Ensure all dependencies are properly installed
- Verify TypeScript compilation passes

### Tag workflow not running

- Verify the PR was merged (not closed)
- Check that the main Build and Test run is green — tagging only fires after
  green main CI; `workflow_dispatch` on Tag & push is the escape hatch
- Check whether the run was **cancelled with zero jobs**. Main pushes share one
  concurrency group holding at most one running plus one pending run, so a
  third merge in quick succession evicts the queued one
  (`Canceling since a higher priority waiting request ... exists`). `tag_push`
  needs `build_and_test`, so an evicted run skips tagging with nothing marked
  red. Self-heals on the next green main run, since tagging uses
  `--no-increment` and tags whatever version main currently carries; force it
  sooner with `workflow_dispatch` on Tag & push
- Check that `GH_PERSONAL_ACCESS_TOKEN` has correct permissions
- Ensure the `tag-release` environment is configured

### NPM publish failing

- Verify OIDC trusted publishing is configured on npmjs.com
- Check that the `publish` environment exists
- Ensure tag format matches `lit-ui-router@*`

### Fork PRs not running CI

This is intentional. Fork PRs don't have access to repository secrets for security. Maintainers should:

1. Review the fork PR code
2. Pull the fork branch locally
3. Push to a first-party branch to run CI

## Release Configuration

Release behavior is configured once, in `@tools/release-config`
(`tools/release-config/src/release-it.js`):

```js
export default {
  git: {
    tagName: '${npm.name}@${version}',
  },
  github: {
    releaseName: 'Release ${npm.name}@${version}',
  },
};
```

Each publishable package carries a one-line `.release-it.js` re-exporting it, so
release-it's cwd-based config lookup still resolves when the pipeline (or you)
runs it inside a package directory:

```js
export { default } from '@tools/release-config';
```

The config defaults most options to `false` so workflows can enable them explicitly via CLI flags.

It is plain JS rather than JSON because `conventional-changelog-writer` 9 takes
template partials as functions.

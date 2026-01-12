# Release Guide

This document describes the release workflow for `lit-ui-router`.

## Overview

The release process is automated through GitHub Actions with protected environments for security. Releases follow a multi-stage pipeline:

1. **Version Bump** - Create a release PR with version changes
2. **Build & Test** - Validate the PR on CI
3. **Merge** - Merge the release PR to main
4. **Tag** - Automatically tag the release
5. **Publish** - Publish to NPM and create GitHub Release

## Tag and Branch Conventions

| Pattern | Purpose | Example |
|---------|---------|---------|
| `lit-ui-router@X.Y.Z` | Package release tags | `lit-ui-router@1.2.3` |
| `release/lit-ui-router/vX.Y.Z` | Release prep branches | `release/lit-ui-router/v1.2.3` |
| `main` | Primary integration branch | - |

## Protected Environments

The release workflows use GitHub protected environments to ensure proper authorization:

| Environment | Purpose | Required For |
|-------------|---------|--------------|
| `bump-version` | Version bump workflow | Creating release branches/PRs |
| `tag-release` | Tagging workflow | Pushing release tags |
| `publish` | NPM publishing | Publishing to NPM registry |

### Environment Secrets

- **`GH_PERSONAL_ACCESS_TOKEN`** - Used by `bump-version` and `tag-release` environments for:
  - Creating branches
  - Pushing tags
  - Creating PRs that trigger downstream workflows

This is a [Fine-Grained Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#fine-grained-personal-access-tokens) with  **Read** and **Write** access to [artifact metadata](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens?apiVersion=2022-11-28#repository-permissions-for-artifact-metadata), [attestations api](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens?apiVersion=2022-11-28#repository-permissions-for-attestations), [code](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens?apiVersion=2022-11-28#repository-permissions-for-contents), and [pull requests](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens?apiVersion=2022-11-28#repository-permissions-for-pull-requests)

- **`CODECOV_TOKEN`** - Used for uploading coverage reports

The `publish` environment uses **OIDC Trusted Publishing** instead of NPM tokens. See [NPM Trusted Publishers](https://docs.npmjs.com/trusted-publishers) for setup.

## Workflows

### 1. Build and Test (`build-test.yml`)

**Triggers:** Pull requests, pushes to `main`

Runs the CI pipeline including:
- Build verification
- Unit tests with Vitest
- E2E tests with Playwright and Cypress
- Coverage reporting to Codecov
- PR coverage comments (on PRs)

**Security:** Only runs on first-party PRs (not forks) to protect secrets.

### 2. Bump Version (`bump-version.yml`)

**Triggers:** Manual dispatch only

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

**Triggers:** Push to `main`

When a release PR merges:
1. Uses release-it to create a git tag (`lit-ui-router@X.Y.Z`)
2. Pushes the tag to origin
3. Tag push triggers the publish workflow

**Note:** Uses `continue-on-error: true` because tagging is idempotent - if the tag already exists, the workflow succeeds.

### 4. Publish to NPM (`publish-npm.yml`)

**Triggers:** Tag push matching `lit-ui-router@*`

The final release stage:
1. Builds the package
2. Creates a tarball
3. Generates build provenance attestation
4. Publishes to NPM using OIDC trusted publishing
5. Creates a draft GitHub Release with the tarball
6. Marks the GitHub Release as final

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
   - The merge triggers tagging automatically

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

## Troubleshooting

### Build failing on PR

- Check Vitest and Playwright test output
- Ensure all dependencies are properly installed
- Verify TypeScript compilation passes

### Tag workflow not running

- Verify the PR was merged (not closed)
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

Release behavior is configured via `packages/lit-ui-router/.release-it.json`:

```json
{
  "git": {
    "tagName": "${npm.name}@${version}"
  },
  "github": {
    "releaseName": "Release ${npm.name}@${version}"
  }
}
```

The config defaults most options to `false` so workflows can enable them explicitly via CLI flags.

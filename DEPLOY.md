# Deploy Guide

---

<p align="center">
<img src="https://raw.githubusercontent.com/cloudflare/workers-sdk/main/cloudflare-workers-outline.png" alt="workers-logo" width="120px" height="120px"/>
<br />
<a href="https://github.com/cloudflare/workers-sdk">Cloudflare Workers SDK</a>
<br />
</p>

---

## [Cloudflare Workers](https://developers.cloudflare.com/workers/) with [Static Assets](https://developers.cloudflare.com/workers/static-assets/)

The Cloudflare [Github integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/) deploys documentation on push.

- Production `main` branch deploys to [lit-ui-router.dev](https://lit-ui-router.dev)
- Development branches deploy to [preview URLs](https://developers.cloudflare.com/workers/configuration/previews/) with the `-lit-ui-router.shane-cf1.workers.dev` domain suffix

### Configuration Files

| File                   | Purpose                                                                                                                                                                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wrangler.jsonc`       | [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) - defines worker name, entry point, assets directory, and routing                                                                                                                                         |
| `docs/worker/index.ts` | [Worker script](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) - serves `ui-router-server` verdicts for `/app/*` and `/app-mobx/*` (shell, 302, or 404) from the tables in `sample-app-routes`; everything else serves static assets, misses fall back to `404.html` |
| `docs/public/_headers` | [Headers](https://developers.cloudflare.com/pages/configuration/headers/) - sets security headers (COOP, COEP)                                                                                                                                                                                        |

### Wrangler Setup

Wrangler is installed in both:

- Root `package.json` - for deployment commands
- `docs/package.json` - wrangler discovers the root `wrangler.jsonc` by walking up from the docs directory

See: [Wrangler Commands](https://developers.cloudflare.com/workers/wrangler/commands/)

### Build & Deploy Commands

| Environment                                                                                             | Build                                                                | Deploy                         |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------ |
| Production                                                                                              | `npx pnpm@11.21.0 install --frozen-lockfile && npx turbo docs#build` | `npx wrangler deploy`          |
| Preview ([Versions](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/)) | `npx pnpm@11.21.0 install --frozen-lockfile && npx turbo docs#build` | `npx wrangler versions upload` |

The build command owns the dependency install because Workers Builds provisions pnpm with
corepack, which cannot install a pnpm-12 `packageManager` pin at all — the npm package is
a wrapper whose real binary is materialized by a `preinstall` hook out of an optional
platform dependency, and corepack runs neither lifecycle scripts nor optional
dependencies. So `SKIP_DEPENDENCY_INSTALL=1` turns off Cloudflare's install step and npx
bootstraps the last pnpm 11 instead — no preinstall hook, so npx handles it — which then
reads `packageManager` and self-swaps to whatever the branch pins. Every later command
goes through npx as well, because the unusable corepack `pnpm` shim stays first on `PATH`.

`npx pnpm@11.21.0` is a **bootstrap floor**, not the version that runs: it needs to be at
or above 11.20.0 to read a pnpm-12 lockfile, and `packageManager` decides the rest.

These three move together — the commands and the variable are one state. Apply and verify
preview before production.

### Dashboard as Code

The private [`tools/workers-builds`](./tools/workers-builds) package owns
[`workers-builds-triggers.config.jsonc`](./tools/workers-builds/workers-builds-triggers.config.jsonc), which mirrors
the dashboard values above plus the declared [build environment variables](#build-environment-variables),
and diffs it against the live triggers: `pnpm check:workers-builds` is read-only
(exit 1 on drift); `pnpm check:workers-builds -- --apply` updates.
Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token must be **user-scoped** — account-owned
tokens do not cover the Workers Builds API — and carry two permissions: **Workers Scripts: Read**, which
resolves the worker name to the tag the triggers endpoint is keyed by, and **Workers Builds Configuration:
Read** for the diff itself, raised to **Edit** only for `--apply`.

Applying is manual-only: `--apply` writes production deploy configuration, and no automation holds an
Edit-scoped token.

Both belong in `.config/mise/cloudflare.local.env`, a gitignored dotenv that the checked-in
`.config/mise/config.toml` loads via `[env] _.file` (the same mechanism as the
[Remote Cache](./REMOTE_CACHE.md) credentials, but a separate file — `mise run turbo_login` rewrites
that one). It is deliberately not symlinked into git worktrees, so run `check:workers-builds` from
the owning checkout.

From 1Password, two mise tasks wrap `op` over gitignored files that hold `op://` references instead
of values (no secrets, but the vault layout they encode is personal rather than repo config, so they
stay untracked). Create whichever the chosen task needs:

| Task                                      | Reads                                    | Reference form | Token at rest    |
| ----------------------------------------- | ---------------------------------------- | -------------- | ---------------- |
| `mise run cloudflare_login`               | `.config/mise/cloudflare.local.env.tmpl` | `{{ op://… }}` | yes, `chmod 600` |
| `mise run check_workers_builds [--apply]` | `.config/mise/cloudflare.op.env`         | bare `op://…`  | no               |

`cloudflare_login` regenerates the dotenv above with `op inject`, so edit the template and re-run
rather than editing the dotenv. `check_workers_builds` skips the dotenv entirely and runs the diff
under `op run`, which injects into that process only — the path to prefer for `--apply`, whose
**Edit**-scoped token is the one worth never writing to disk.

One file per task, because the two syntaxes are mutually exclusive: `op inject` substitutes
`{{ op://… }}` and passes a bare `op://…` through untouched, so pointing it at the `op run` file
yields a dotenv of literal reference strings, surfacing as an auth failure from Cloudflare rather
than as an error from `op`.

Neither task is required — both only supply the two variables, so `pnpm check:workers-builds` with
them already in the environment works the same. `op` is deliberately not a pinned `[tools]` entry: a
mise-managed copy would shadow the system one and lose its desktop-app integration.

#### CD-pipeline verification signal

[`release-signals.yml`](./.github/workflows/release-signals.yml) runs the same read-only diff on every push to
`main` — the push that Workers Builds deploys from — plus a weekly sweep, and reports it as the
`workers-builds (triggers)` check run alongside its `published-diff` and `peer-floor` siblings. It is
non-gating: green in sync, orange (`action_required`) on drift, grey (`neutral`) when the check could not run.
It never applies; resolving drift is still a local `--apply`.

Two repository secrets drive it. Both are optional — absent, the signal reports grey rather than failing:

| Secret                  | Value                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | A **user-scoped** API token with **Workers Scripts: Read** and **Workers Builds Configuration: Read** — both, or the run 403s on the tag lookup before it reaches the triggers. CI must never hold the Edit scope. |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account ID. A secret rather than a variable so it stays out of public logs.                                                                                                                         |

Rotation is manual: mint a replacement in the Cloudflare dashboard under **My Profile → API Tokens** (user
tokens, not **Manage Account → API Tokens**), update the repository secret, and revoke the old one. A stale
token shows up as the grey `workers-builds (triggers)` badge, not a red run.

`publish-npm.yml` forwards both into its post-publish `workflow_call`; secrets do not auto-propagate, and
without that the badge would go grey after every release.

### Build Environment Variables

Managed per key, not per map: `check:workers-builds` diffs only the keys declared in
[`workers-builds-triggers.config.jsonc`](./tools/workers-builds/workers-builds-triggers.config.jsonc)
and leaves every other variable on the trigger untouched.

**Declared** (plaintext, committed, `--apply` writes them):

- `SKIP_DEPENDENCY_INSTALL=1` — **required.** Hands the dependency install to the build
  command, per [Build & Deploy Commands](#build--deploy-commands). Without it Cloudflare
  runs its own corepack-provisioned `pnpm install` first and the build fails there;
  deleting it in the dashboard breaks every deploy.

**Unmanaged** (dashboard-only; listed in the diff output as `(unmanaged)`, never diffed or patched):

- `VITE_GOOGLE_ANALYTICS_TRACKING_ID`
- `TURBO_`-prefixed [Remote Cache](./REMOTE_CACHE.md) variables and secrets

Drift semantics for a declared key: a wrong or absent live value is drift and is patched; a key
the dashboard has marked secret is reported and **not** overwritten, since the config holds
plaintext only. Secrets therefore can never be committed here nor clobbered by `--apply`.

### Local Development

```bash
# with pnpm
pnpm --filter docs wrangler:dev
# with turbo
turbo docs#wrangler:dev
```

See Cloudflare Workers Testing Docs: [Local Development](https://developers.cloudflare.com/workers/testing/local-development/)

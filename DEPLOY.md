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

| File                     | Purpose                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wrangler.jsonc`         | [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) - defines worker name, assets directory, and SPA routing |
| `docs/public/_redirects` | [Redirects](https://developers.cloudflare.com/pages/configuration/redirects/) - configures URL rewriting for SPA routes                              |
| `docs/public/_headers`   | [Headers](https://developers.cloudflare.com/pages/configuration/headers/) - sets security headers (COOP, COEP) and canonical links                   |

### Wrangler Setup

Wrangler is installed in both:

- Root `package.json` - for deployment commands
- `docs/package.json` - references root config via `--config ../wrangler.jsonc`

See: [Wrangler Commands](https://developers.cloudflare.com/workers/wrangler/commands/)

### Build & Deploy Commands

| Environment                                                                                             | Build                  | Deploy                          |
| ------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------- |
| Production                                                                                              | `npx turbo docs#build` | `pnpm wrangler deploy`          |
| Preview ([Versions](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/)) | `npx turbo docs#build` | `pnpm wrangler versions upload` |

The table above mirrors the Workers Builds dashboard configuration today. `pnpm wrangler …` resolves through the
`wrangler` script alias in `docs/package.json` when run from `docs/`, and through pnpm's exec fallback to the
root `wrangler` devDependency when run from the repo root.

#### Alias-free alternatives (verified)

The dashboard's root-directory setting is not visible in this repo, so the commands below were verified from
**both** the repo root and `docs/` (with the docs `wrangler` script alias removed) against wrangler 4.107.0.
Wrangler discovers `wrangler.jsonc` by walking up from the working directory and resolves `assets.directory`
relative to the config file, so every form below reads the root config and uploads `docs/dist` from either
working directory.

| Dashboard field | Current (dashboard)             | Alias-free, ranked                                                                       |
| --------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| Deploy command  | `pnpm wrangler deploy`          | 1. `pnpm wrangler deploy` 2. `pnpm --filter docs exec wrangler deploy`                   |
| Version command | `pnpm wrangler versions upload` | 1. `pnpm wrangler versions upload` 2. `pnpm --filter docs exec wrangler versions upload` |

- The current `pnpm wrangler …` values are already alias-free-safe: with the alias deleted, pnpm falls back to
  `pnpm exec wrangler`, which resolves the workspace-pinned binary, and config discovery does the rest.
- `pnpm --filter docs exec wrangler …` additionally pins the working directory to `docs/`, so it is immune to
  any future root-directory change in the dashboard.
- `npx wrangler …` also works today (it resolves the locally installed binary), but is not recommended: if the
  `wrangler` devDependency were ever removed, `npx` would silently download an unpinned latest wrangler.

### Dashboard as Code

The Workers Builds trigger configuration lives only in the Cloudflare dashboard and has no PR trail.
[`scripts/workers-builds-triggers.ts`](./scripts/workers-builds-triggers.ts) keeps a reviewable copy: its
`DESIRED` constant mirrors the dashboard values above and diffs them against the live triggers.

```bash
# read-only drift check (exit 1 on drift)
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… pnpm check:workers-builds
# update drifted triggers to match DESIRED
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… pnpm check:workers-builds --apply
```

The token is a user-scoped API token with **Workers Builds Configuration: Edit**. The script is intentionally
not part of any CI task graph — it reads (and with `--apply`, writes) production deploy configuration.

### Build Environment Variables

- `VITE_GOOGLE_ANALYTICS_TRACKING_ID`
- `TURBO_`-prefixed [Remote Cache](./REMOTE_CACHE.md) variables and secrets

### Local Development

```bash
# with pnpm
pnpm --filter docs wrangler:dev
# with turbo
turbo docs#wrangler:dev
```

See Cloudflare Workers Testing Docs: [Local Development](https://developers.cloudflare.com/workers/testing/local-development/)

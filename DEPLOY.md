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
- `docs/package.json` - wrangler discovers the root `wrangler.jsonc` by walking up from the docs directory

See: [Wrangler Commands](https://developers.cloudflare.com/workers/wrangler/commands/)

### Build & Deploy Commands

| Environment                                                                                             | Build                  | Deploy                          |
| ------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------- |
| Production                                                                                              | `npx turbo docs#build` | `pnpm wrangler deploy`          |
| Preview ([Versions](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/)) | `npx turbo docs#build` | `pnpm wrangler versions upload` |

### Dashboard as Code

The private [`tools/workers-builds`](./tools/workers-builds) package owns
[`workers-builds-triggers.config.jsonc`](./tools/workers-builds/workers-builds-triggers.config.jsonc), which mirrors
the dashboard values above, and diffs it against the live triggers: `pnpm check:workers-builds` is read-only
(exit 1 on drift); `pnpm check:workers-builds -- --apply` updates.
Requires `CLOUDFLARE_API_TOKEN` (user-scoped, **Workers Builds Configuration: Edit**) and `CLOUDFLARE_ACCOUNT_ID`.
Manual-only — never part of CI.

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

# Development

```
nvm use
npm i -g turbo
pnpm install
turbo build
```

## Deployment

Documentation is deployed to [lit-ui-router.dev](https://lit-ui-router.dev) via [Cloudflare Workers](https://developers.cloudflare.com/workers/) with [Static Assets](https://developers.cloudflare.com/workers/static-assets/).

### Configuration Files

| File | Purpose |
|------|---------|
| `wrangler.jsonc` | [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) - defines worker name, assets directory, and SPA routing |
| `docs/public/_redirects` | [Redirects](https://developers.cloudflare.com/pages/configuration/redirects/) - configures URL rewriting for SPA routes |
| `docs/public/_headers` | [Headers](https://developers.cloudflare.com/pages/configuration/headers/) - sets security headers (COOP, COEP) and canonical links |

### Wrangler Setup

Wrangler is installed in both:
- Root `package.json` - for deployment commands
- `docs/package.json` - references root config via `--config ../wrangler.jsonc`

See: [Wrangler Commands](https://developers.cloudflare.com/workers/wrangler/commands/)

### Build & Deploy Commands

| Environment | Build | Deploy |
|-------------|-------|--------|
| Production | `npx turbo docs#build` | `pnpm wrangler deploy` |
| Preview ([Versions](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/)) | `npx turbo docs#build` | `pnpm wrangler versions upload` |

### Local Development

```bash
pnpm --filter docs wrangler:dev
```

See: [Local Development](https://developers.cloudflare.com/workers/testing/local-development/)

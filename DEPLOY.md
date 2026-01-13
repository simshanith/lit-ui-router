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

### Environment Variables

`VITE_GOOGLE_ANALYTICS_TRACKING_ID` is set as a Worker build variable.

### Local Development

```bash
# with pnpm
pnpm --filter docs wrangler:dev
# with turbo
turbo docs#wrangler:dev
```

See Cloudflare Workers Testing Docs: [Local Development](https://developers.cloudflare.com/workers/testing/local-development/)

## Turborepo Remote Cache

https://adirishi.github.io/turborepo-remote-cache-cloudflare/

Deployed to https://lit-ui-router-turborepo-remote-cache.shane-cf1.workers.dev

### Local Development Setup

1. Create `.turbo/config.json` (gitignored):

```json
{
  "teamId": "team_lit-ui-router",
  "apiUrl": "https://lit-ui-router-turborepo-remote-cache.shane-cf1.workers.dev"
}
```

2. Export `TURBO_TOKEN` in shell
3. Run `pnpm turbo build --force` to test cache upload
4. Run `pnpm turbo build` to test cache retrieval

### Free Tier Limits (Monthly)

#### R2 Storage

| Resource           | Free Allowance                      |
| ------------------ | ----------------------------------- |
| Storage            | 10 GB-month                         |
| Class A Operations | 1 million (uploads, deletes, lists) |
| Class B Operations | 10 million (reads)                  |
| Egress             | Free (always)                       |

#### Workers (turborepo-remote-cache)

| Resource | Free Allowance      |
| -------- | ------------------- |
| Requests | 100,000/day         |
| CPU time | 10ms per invocation |

### Paid Tier (Beyond Free)

| Resource   | Cost                   |
| ---------- | ---------------------- |
| R2 Storage | $0.015/GB-month        |
| R2 Class A | $4.50/million          |
| R2 Class B | $0.36/million          |
| Workers    | $0.30/million requests |

### Alert Thresholds (80% of free tier)

| Metric         | Threshold | Rationale        |
| -------------- | --------- | ---------------- |
| R2 Storage     | 8 GB      | 80% of 10GB free |
| R2 Class A Ops | 800,000   | 80% of 1M free   |
| R2 Class B Ops | 8,000,000 | 80% of 10M free  |

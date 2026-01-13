# Turborepo Remote Cache

https://adirishi.github.io/turborepo-remote-cache-cloudflare/

Deployed to https://lit-ui-router-turborepo-remote-cache.shane-cf1.workers.dev

Expires after 7 days

## Local Development Setup

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

## Cloudflare Workers Build Varaiables & Secrets

```sh
TURBO_API=https://lit-ui-router-turborepo-remote-cache.shane-cf1.workers.dev
TURBO_TEAM=team_lit-ui-router
TURBO_TOKEN=
```

## Free Tier Limits (Monthly)

### R2 Storage

| Resource           | Free Allowance                      |
| ------------------ | ----------------------------------- |
| Storage            | 10 GB-month                         |
| Class A Operations | 1 million (uploads, deletes, lists) |
| Class B Operations | 10 million (reads)                  |
| Egress             | Free (always)                       |

### Workers (turborepo-remote-cache)

| Resource | Free Allowance      |
| -------- | ------------------- |
| Requests | 100,000/day         |
| CPU time | 10ms per invocation |

## Paid Tier (Beyond Free)

| Resource   | Cost                   |
| ---------- | ---------------------- |
| R2 Storage | $0.015/GB-month        |
| R2 Class A | $4.50/million          |
| R2 Class B | $0.36/million          |
| Workers    | $0.30/million requests |

## Alert Thresholds (80% of free tier)

| Metric         | Threshold | Rationale        |
| -------------- | --------- | ---------------- |
| R2 Storage     | 8 GB      | 80% of 10GB free |
| R2 Class A Ops | 800,000   | 80% of 1M free   |
| R2 Class B Ops | 8,000,000 | 80% of 10M free  |

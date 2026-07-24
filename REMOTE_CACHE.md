# Turborepo Remote Cache

https://adirishi.github.io/turborepo-remote-cache-cloudflare/

Deployed to https://lit-ui-router-turborepo-remote-cache.shane-cf1.workers.dev

Expires after 7 days

## Local Development Setup

Optional, and maintainer-only: the cache is a speedup, not a prerequisite.
Without a token turbo silently uses the local cache and everything still works,
so contributors need nothing here. The worker authenticates one shared static
bearer token — there is no per-user issuance and no `turbo login` flow (that
talks to Vercel), so the token arrives out of band.

1. Store the credentials (`mise run turbo_login --help` for the flags):

```sh
mise run turbo_login --token <token>
```

2. Run `turbo build --force` to test cache upload
3. Run `turbo build` to test cache retrieval

The task writes `TURBO_API`/`TURBO_TEAM`/`TURBO_TOKEN` — the same variables CI
sets, so there is one mechanism to learn — into `.config/mise/config.local.toml`
(gitignored; loads after the checked-in `config.toml` and wins). `--api` and
`--team` default to the values above; `--token` also reads a `TURBO_TOKEN`
already in your environment, which migrates an ambient export into the file.
mise shims export the result, so a bare `turbo` picks it up.

Never commit a blank placeholder for these: an empty value in a mise config
wins over an ambient `export`, silently disabling the remote cache for anyone
who already has a token.

### Rotation

The token lives in four places — rotate all of them together, since a stale
holder gets 401s on every task rather than cache misses:

| Location                  | Set via                            |
| ------------------------- | ---------------------------------- |
| Worker                    | `TURBO_TOKEN` secret on the Worker |
| GitHub Actions            | repo secret `TURBO_TOKEN`          |
| Cloudflare Workers Builds | build env var (see below)          |
| Local                     | `.config/mise/config.local.toml`   |

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

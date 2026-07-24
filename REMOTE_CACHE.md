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

Two secrets are involved: the bearer token above, and the signature key that
signs and verifies artifacts (`remoteCache.signature` in `turbo.json`).

1. Store the credentials (`mise run turbo_login --help` for the flags):

```sh
# prompts for each, echo off
mise run turbo_login

# both from a password manager in one command, neither on argv
mise run turbo_login \
  --token-file <(op read 'op://Private/…/token') \
  --signature-key-file <(op read 'op://Private/…/signature-key')

# one from stdin, the other from a path (only one field may be -)
printf '%s\n' "$TURBO_TOKEN" | mise run turbo_login --token-file - --signature-key-file key.txt
```

2. Run `turbo build --force` to test cache upload
3. Run `turbo build` to test cache retrieval

The task writes `TURBO_API`/`TURBO_TEAM`/`TURBO_TOKEN`/
`TURBO_REMOTE_CACHE_SIGNATURE_KEY` — the same variables CI sets, so there is one
mechanism to learn — into `.config/mise/config.local.toml` (gitignored,
`chmod 600`; loads after the checked-in `config.toml` and wins). `--api` and
`--team` default to the values above. mise shims export the result, so a bare
`turbo` picks it up.

It also writes `TURBO_CACHE=remote:r,local:rw`, making the local machine
**read-only** against the shared cache: it pulls CI's warm artifacts but never
pushes. CI owns provenance — a laptop is a softer target than GitHub's secret
store, so keeping it out of the write path means a compromised machine cannot
inject artifacts a later CI run would trust and serve. Because this lives in the
gitignored local file, CI is unaffected and keeps writing. Pass `--local-writes`
to opt in to pushing from this machine (rarely wanted; it trades that guarantee
for warming CI's cache from local builds).

Prefer a `*-file` source over a `--token`/`--signature-key` literal: a literal
lands in shell history and is visible in `ps` while the command runs. Process
substitution keeps both secrets off argv in a single command. Stdin is read only
on an explicit `-`, so the task never consumes a line from a stream a caller
attached for something else, and only one field may claim it — ordered lines on
one pipe would silently swap the two values. Re-running the task rotates in
place and leaves other local overrides alone.

The signature key is generated **once** and shared, never per machine:

```sh
openssl rand -base64 32
```

A key that differs between machines is worse than a missing one: turbo rejects
artifacts whose tag does not verify, so mismatched keys produce hard task
failures, not cache misses.

Never commit a blank placeholder for these: an empty value in a mise config
wins over an ambient `export`, silently disabling the remote cache for anyone
who already has a token.

### Rotation

Both secrets live in the same places — rotate every row together:

| Location                  | Token                              | Signature key                                  |
| ------------------------- | ---------------------------------- | ---------------------------------------------- |
| Worker                    | `TURBO_TOKEN` secret on the Worker | n/a (the worker only round-trips the tag)      |
| GitHub Actions            | repo secret `TURBO_TOKEN`          | repo secret `TURBO_REMOTE_CACHE_SIGNATURE_KEY` |
| Cloudflare Workers Builds | build env var (see below)          | build env var (see below)                      |
| Local                     | `.config/mise/config.local.toml`   | same file, same task                           |

A stale token gets 401s; a stale signature key gets verification failures. Both
are hard failures rather than cache misses, so partial rotation breaks builds
until every row matches.

The worker needs no signature configuration: it accepts `x-artifact-tag` on
upload, stores it as R2 custom metadata, and echoes it back on download.
Signing and verification are entirely client-side.

## Cloudflare Workers Build Varaiables & Secrets

```sh
TURBO_API=https://lit-ui-router-turborepo-remote-cache.shane-cf1.workers.dev
TURBO_TEAM=team_lit-ui-router
TURBO_TOKEN=
TURBO_REMOTE_CACHE_SIGNATURE_KEY=
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

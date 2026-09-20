# Turborepo Remote Cache

<https://adirishi.github.io/turborepo-remote-cache-cloudflare/>

Deployed to a Cloudflare Worker at a `*.workers.dev` URL. The URL is kept out of
this public repo (a public endpoint invites free-tier request exhaustion); it
lives in the `TURBO_API` GitHub **secret** and your password manager.

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
mechanism to learn — into `.config/mise/turbo.local.env` (gitignored,
`chmod 600`), a dotenv the checked-in `config.toml` loads via `[env] _.file`.
Values are written with shell builtins, never passed to a child process, so no
secret (or the sensitive worker domain) ever lands in `ps`/`/proc/<pid>/cmdline`.
`--team` defaults to `team_lit-ui-router`; `--api` has no default (the worker URL
is sensitive) — supply it on first setup, and later runs preserve the stored
value. mise shims export the result, so a bare `turbo` picks it up.

It also writes `TURBO_CACHE=remote:r,local:rw`, making the local machine
**read-only** against the shared cache: it pulls CI's warm artifacts but never
pushes. CI owns provenance — a laptop is a softer target than GitHub's secret
store, so keeping it out of the write path means a compromised machine cannot
inject artifacts a later CI run would trust and serve. Because this lives in the
gitignored local file, CI is unaffected and keeps writing. Pass `--local-writes`
to opt in to pushing from this machine (rarely wanted; it trades that guarantee
for warming CI's cache from local builds). That posture covers this checkout
only; worktrees get their own (see below).

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
who already has a token. The worktree pin below spends that same behaviour
deliberately, from a gitignored file that reaches one worktree.

### Worktrees

`_.file` is config-root scoped and the dotenv is gitignored, so a worktree
outside the owning checkout has no credentials; one nested under it inherits
every `TURBO_*`, because mise reads a config from every ancestor directory.

Either way `mise run setup` pins the worktree to the local cache through its
`turbo_pin_worktree` leg, which no-ops in the owning checkout and wherever there
are no credentials to begin with, CI included.

To opt one worktree back into remote reads, delete its
`.config/mise/conf.d/turbo-worktree.local.toml`. A nested worktree then has its
credentials already; one outside the owner tree needs
`<owner>/.config/mise/turbo.local.env` symlinked into its own `.config/mise/` by
hand.

### Local cache posture

The owning checkout runs `remote:r,local:rw`. Every worktree runs `local:rw`
with a blank `TURBO_TOKEN` — no remote reads, no remote writes, no request of
any kind, and the inherited `TURBO_API`/`TURBO_TEAM`/signature key go unread.
Turbo keys its filesystem cache off the git common dir, so the worktrees and the
owner all read and write one `<owner>/.turbo/cache`; a worktree's own `.turbo/`
holds task logs only.

`turbo_pin_worktree` copies `.config/mise/templates/turbo-worktree.toml` into
the worktree's gitignored `.config/mise/conf.d/turbo-worktree.local.toml` and
trusts it. The location matters: a `conf.d` entry is beaten by an `_.file` in
the same config root, so the pin holds because the only `TURBO_*` dotenv belongs
to the owning checkout, a root farther out. That leaves `config.local.toml` free
as the maintainer's own override slot.

The blank token is load-bearing on its own: empty reads as unset, so turbo
builds no analytics sender, where `local:rw` alone still POSTs
`/v8/artifacts/events` once per run.

The workflow that pairs with it:

- CI writes every pushed branch, not just main: no workflow sets `TURBO_CACHE`,
  so turbo's default `remote:rw,local:rw` applies on branch pushes and on
  pull-request merge-head runs alike. Once a branch's CI has finished, its
  build, lint and typecheck artifacts are in the remote cache.
- From any worktree, `mise run turbo_backfill` makes one deliberate
  `remote:r,local:rw` pass — about one request per task hash — that lands those
  artifacts in the shared `<owner>/.turbo/cache`. The task never touches the
  pin, so every later run in that worktree is back on `local:rw`. It also
  unsets `TURBO_FORCE`. Reach for it after a push whose CI has finished, or
  after pulling `main` into the branch.
- Owning checkout: after pulling `main`, `mise run ci` still does the job, since
  that checkout is already `remote:r`; `turbo_backfill` from there is
  equivalent. Either way the run is all hits except the test tasks.

The `test`, `test:coverage`, `test:engines`, `test:lit2-compat` and
`test:mobx6-compat` tasks hash `CI` in `turbo.json`, so their artifacts carry a
key no laptop can produce: those always run locally, backfill or not.

Without the backfill, a worktree computes everything its branch changed and
hits the shared cache for the rest, never re-probing the remote.

`TURBO_FORCE` outranks all of this: turbo reads it as `--force`, which means
`--cache=local:w,remote:w` and *replaces* `TURBO_CACHE` rather than narrowing
it, so even `local:rw` uploads once a token is in the environment. Only the
literal values `true` and `1` turn it on. Every mise task that runs turbo
depends on `turbo_force_guard`, which fails the run before turbo starts when
that combination would push from a checkout meant to read — it passes in CI,
where `TURBO_CACHE` is unset and the write is the point, and in a worktree,
whose blank token keeps turbo off the network. A bare `turbo` call goes around
the guard, since mise only wraps its own tasks.

### Rotation

Both secrets live in the same places — rotate every row together:

| Location                  | Token                              | Signature key                                  |
| ------------------------- | ---------------------------------- | ---------------------------------------------- |
| Worker                    | `TURBO_TOKEN` secret on the Worker | n/a (the worker only round-trips the tag)      |
| GitHub Actions            | repo secret `TURBO_TOKEN`          | repo secret `TURBO_REMOTE_CACHE_SIGNATURE_KEY` |
| Cloudflare Workers Builds | build env var (see below)          | build env var (see below)                      |
| Local                     | `.config/mise/turbo.local.env`     | same file, same task                           |

A stale token gets 401s; a stale signature key gets verification failures. Both
are hard failures rather than cache misses, so partial rotation breaks builds
until every row matches.

The worker needs no signature configuration: it accepts `x-artifact-tag` on
upload, stores it as R2 custom metadata, and echoes it back on download.
Signing and verification are entirely client-side.

## Cloudflare Workers Build Variables & Secrets

```sh
TURBO_API=https://<your-worker>.workers.dev
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

# @www/release-ledger.lit-ui-router.dev

The release ledger: a D1 database that records what the git tag, npm and
GitHub say about each `<pkg>@<version>`, and the worker that writes it. The
design is [#1424](https://github.com/simshanith/lit-ui-router/issues/1424) and
[#1430](https://github.com/simshanith/lit-ui-router/issues/1430); the model it
stores, its regions and the fold, is
[`@tools/release-ledger`](../../tools/release-ledger/README.md).

- [`migrations/`](./migrations): the D1 schema. A `versions` row stores facts,
  never a state; the `version_states` view derives each region's state and an
  overall status. `claims` holds one row per queue message with how it ended,
  and each `ledger_events` row points at the claim that caused it.
- [`src/ledger-statements.ts`](./src/ledger-statements.ts): the statements
  the queue consumer runs to write a claim's row and, in one D1 batch with it,
  a fold's outcome.
- [`worker/index.ts`](./worker/index.ts): the worker's entry points.

## Worker

[`wrangler.jsonc`](./wrangler.jsonc) holds the bindings, vars and queue settings.

- **`POST /claims`** ([`src/ingest.ts`](./src/ingest.ts)) takes a GitHub Actions
  OIDC id-token as a bearer token, verifies it against GitHub's JWKS, checks it
  against the `OIDC_*` vars, and enqueues the claim. It answers 202 and writes
  nothing to D1. `repair` is refused here. `publish-npm.yml`'s `ledger_claim`
  job posts here after each publish.
- **The queue consumer** ([`src/consume.ts`](./src/consume.ts)) is the only D1
  writer. Per claim, it observes the tag, npm and GitHub, taking a 404 as the
  source reporting the fact absent, folds the observation through
  `@tools/release-ledger`, and writes the
  outcome in one D1 batch, its `claims` row first. A GitHub
  release ahead of npm is folded as seen. Fetches retry through Effect's
  `HttpClient.retryTransient`, which also takes GitHub's rate-limit 403s;
  a wait over 10 seconds (`Retry-After`, GitHub's `x-ratelimit-reset`) becomes
  the redelivery delay instead ([`src/observe.ts`](./src/observe.ts)).
  Redeliveries back off exponentially with jitter.
  A 404 for the package's dist-tags leaves the recorded dist-tags untouched.
  A message that is not a claim is recorded `undecodable` without retries. The
  dead-letter queue's consumer records a claim whose retries ran out as
  `exhausted`, unless its message already has a row.
- **The Cron Trigger** ([`src/sweep.ts`](./src/sweep.ts)) lists the
  repository's tags through `git/matching-refs` and enqueues an ordinary claim
  for each release tag, so the ledger heals without an Actions run.
- **`LedgerReader`** ([`worker/index.ts`](./worker/index.ts)) is a `WorkerEntrypoint`
  for other workers to read through a service binding; its rows carry the
  derived states from `version_states`. A D1 binding would give them write
  access too.

The consumer reads GitHub with the `GITHUB_TOKEN` secret, a read-only token.

## Backfill / manual claims

[`src/enqueue.ts`](./src/enqueue.ts) publishes `manual` claims to the claims
queue over Cloudflare's
[Queues HTTP API](https://developers.cloudflare.com/queues/examples/publish-to-a-queue-via-http/),
so the ledger fills without waiting for the Cron Trigger. It lists release tags
the way the sweep does, reading GitHub with `GITHUB_TOKEN` if set. To claim
every release tag:

```sh
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… pnpm --filter @www/release-ledger.lit-ui-router.dev enqueue -- --all --actor <login>
```

Pass `<name>@<version>` releases in place of `--all` to claim only those, and
`--dry-run` to print the claims without sending them. The token needs the
Queues Edit permission, which is what vouches for the claim; `--actor` is a
label recorded in `claims.actor`, not checked. `/claims` never accepts a manual
claim: it builds every claim's origin from the verified OIDC token.

## Local development

`/claims` skips token verification only when `LEDGER_DEV_SKIP_OIDC` is `true`
and `OIDC_AUDIENCE` is unset or empty. With an audience set, the flag is ignored
and the token is verified. `wrangler dev` merges `.dev.vars` over the `vars` in
`wrangler.jsonc`, which set the audience, so a local `.dev.vars` blanks it:

```sh
OIDC_AUDIENCE=""
LEDGER_DEV_SKIP_OIDC=true
```

The claims are still decoded and checked against the other `OIDC_*` vars. If
`OIDC_AUDIENCE` is empty and the flag is not set, `/claims` answers 500.

## Migrations

Plain SQL in [`migrations/`](./migrations), applied by
`wrangler d1 migrations apply`. Effect's `Migrator` can't apply them, because it
runs inside `sql.withTransaction`, which the D1 driver does not support.

## Tests

`pnpm test` runs `node --test`. [`src/worker.test.ts`](./src/worker.test.ts)
runs the worker in workerd through wrangler's `createTestHarness`, and drives the
consumer against the harness's local D1 with the observations stubbed.

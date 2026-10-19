# @www/release-ledger.lit-ui-router.dev

The release ledger: a D1 database that records what the git tag, npm and
GitHub say about each `<pkg>@<version>`, and the worker that writes it. The
design is [#1424](https://github.com/simshanith/lit-ui-router/issues/1424) and
[#1430](https://github.com/simshanith/lit-ui-router/issues/1430).

- [`migrations/`](./migrations): the D1 schema. A `versions` row stores facts,
  never a state; the `version_states` view derives each region's state and an
  overall status.
- [`src/release-ledger.core.ts`](./src/release-ledger.core.ts): `REGIONS`,
  `fold`, `repair`, the dist-tag moves, and the statements the queue
  consumer runs in one D1 batch.
- [`worker/index.ts`](./worker/index.ts): the worker's entry points.

## Worker

[`wrangler.jsonc`](./wrangler.jsonc) holds the bindings, vars and queue settings.

- **`POST /claims`** ([`src/ingest.ts`](./src/ingest.ts)) takes a GitHub Actions
  OIDC id-token as a bearer token, verifies it against GitHub's JWKS, checks it
  against the `OIDC_*` vars, and enqueues the claim. It answers 202 and writes
  nothing to D1. `repair` is refused here.
- **The queue consumer** ([`src/consume.ts`](./src/consume.ts)) is the only D1
  writer. Per claim, it observes the tag, npm and GitHub, taking a 404 as the
  source reporting the fact absent, folds the observation through
  [`src/release-ledger.core.ts`](./src/release-ledger.core.ts), and writes the
  outcome in one D1 batch, its `pipeline_events` row first. A GitHub
  release ahead of npm is folded as seen. Fetches retry through Effect's
  `HttpClient.retryTransient`, which also takes GitHub's rate-limit 403s;
  a wait over 10 seconds (`Retry-After`, GitHub's `x-ratelimit-reset`) becomes
  the redelivery delay instead ([`src/observe.ts`](./src/observe.ts)).
  Redeliveries back off exponentially with jitter.
  Claims whose retries run out land in `dead_letters`.
- **The Cron Trigger** ([`src/sweep.ts`](./src/sweep.ts)) lists the
  repository's tags through `git/matching-refs` and enqueues an ordinary claim
  for each release tag, so the ledger heals without an Actions run.
- **`LedgerReader`** ([`worker/index.ts`](./worker/index.ts)) is a `WorkerEntrypoint`
  for other workers to read through a service binding; its rows carry the
  derived states from `version_states`. A D1 binding would give them write
  access too.

The consumer reads GitHub with the `GITHUB_TOKEN` secret, a read-only token.

## Local development

Token verification is skipped only when `.dev.vars` sets
`LEDGER_DEV_SKIP_OIDC=true`. The claims are still decoded and checked against the
`OIDC_*` vars. If `OIDC_AUDIENCE` is unset and the flag is not set, `/claims`
answers 500.

## Migrations

Plain SQL in [`migrations/`](./migrations), applied by
`wrangler d1 migrations apply`. Effect's `Migrator` can't apply them, because it
runs inside `sql.withTransaction`, which the D1 driver does not support.

## Tests

`pnpm test` runs `node --test`. [`src/worker.test.ts`](./src/worker.test.ts)
runs the worker in workerd through wrangler's `createTestHarness`, and drives the
consumer against the harness's local D1 with the observations stubbed.

## Regions

Generated from `REGIONS`; `src/release-ledger.readme.test.ts` fails when this
copy differs.

| Region | Lifecycle                                                                      | Fixed facts                                                   | Mutable facts    | Conflict       | Cleared by   |
| ------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ---------------- | -------------- | ------------ |
| tag    | —                                                                              | `git_sha`                                                     | —                | `tag_conflict` | `repair tag` |
| npm    | absent → active, absent → deprecated, active → deprecated, deprecated → active | `npm_integrity`, `npm_published_at`                           | `npm_deprecated` | `npm_conflict` | `repair npm` |
| gh     | none → final                                                                   | `gh_release_id`, `gh_url`, `gh_prerelease`, `gh_published_at` | `gh_body`        | `gh_conflict`  | `repair gh`  |

Each region moves only on its own source. An observation that contradicts a
recorded fixed fact, or reports it absent, stores itself in the region's
conflict column and leaves the fact as recorded; mutable facts keep following
the source. `repair` adopts the current observation for one region and clears
its conflict, and cannot erase recorded facts.

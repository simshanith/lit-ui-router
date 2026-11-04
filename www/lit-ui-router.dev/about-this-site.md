---
title: How this site runs
description: lit-ui-router.dev on Cloudflare — static assets, the docs worker that routes the sample apps and release pages, and the release-ledger worker behind them
---

# How this site runs

lit-ui-router.dev is a Cloudflare Worker with static assets. The docs are
plain files; a worker answers only the paths that need a routing decision —
the sample apps, through `ui-router-server`, and the release pages, from a
second worker that keeps the release ledger.
[Server-Side Routing](./guides/server-route-matching#one-request-at-a-time)
follows a single request through the docs worker.

<!--@include: ./public/diagrams/about-this-site-architecture.svg-->

1. **Readers** load `lit-ui-router.dev`: the docs, the sample apps, the
   `/releases` pages and the `/gh` redirects the README badges link to.
2. **Static assets** answer every path outside `run_worker_first` in the
   site's
   [`wrangler.jsonc`](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/wrangler.jsonc),
   with `404.html` for misses; the worker never sees those requests. The
   sample-app mounts, the 404 exhibits, `/releases` and `/gh` go to the docs
   worker instead.
3. **The docs worker**
   ([`worker/index.ts`](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/worker/index.ts))
   answers the sample-app mounts with
   [`ui-router-server` verdicts](./guides/server-route-matching#the-verdict):
   a redirect, a 404, or the app's shell, fetched back from static assets
   like its 404 pages and any path it doesn't route. It also renders the
   release pages and `/gh` redirects from ledger rows it reads over RPC. It
   has no database of its own.
4. **The ledger worker** keeps the release ledger; the docs worker reads it
   through the `LEDGER` service binding.
   [The release ledger](#the-release-ledger) below draws what is behind it.

## The release ledger

The ledger worker
([`release-ledger`](https://github.com/simshanith/lit-ui-router/blob/main/www/release-ledger.lit-ui-router.dev/README.md))
records what the git tag, npm and GitHub say about each release. Claims come
in, a queue consumer checks them against the sources and writes the outcome,
and other workers read the result. Badges 2, 3, 5 and 8 are the worker's own
entry points.

<!--@include: ./public/diagrams/about-this-site-ledger.svg-->

1. **GitHub Actions** sends a claim after each npm publish, from the
   `publish-npm.yml` workflow with an Actions OIDC token.
2. **`POST /claims`** verifies the token and enqueues the claim. It answers
   202 and writes nothing to D1.
3. **The sweep**, a daily Cron Trigger, lists the repository's release tags
   and enqueues a claim for each, so the ledger heals without an Actions run.
4. **Queues** hold claims until the consumer takes them, one at a time, with a
   dead-letter queue for claims that run out of retries.
5. **The consumer** observes each claim's release, folds the observation and
   is the only thing that writes to D1.
6. **GitHub and npm** are the sources it observes: tags, releases, versions
   and dist-tags.
7. **D1** stores the release ledger.
8. **`LedgerReader`** is the worker's read-only RPC entry point.
9. **The docs worker** renders the release pages and `/gh` redirects from the
   rows it reads.

The ledger worker's bindings, queue settings and schedule are in its
[`wrangler.jsonc`](https://github.com/simshanith/lit-ui-router/blob/main/www/release-ledger.lit-ui-router.dev/wrangler.jsonc).

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
   release pages and `/gh` redirects from ledger rows it reads over RPC,
   through the `LEDGER` service binding. It has no database of its own.
4. **The ledger worker**
   ([`release-ledger`](https://github.com/simshanith/lit-ui-router/blob/main/www/release-ledger.lit-ui-router.dev/README.md))
   takes release claims at `POST /claims`, consumes them from the queue, and
   is the only thing that writes to D1. A daily Cron Trigger enqueues a claim
   for every release tag.
5. **Queues** hold claims until the consumer takes them, one at a time, with a
   dead-letter queue for claims that run out of retries.
6. **D1** stores the release ledger.
7. **GitHub** sends a claim after each npm publish, from the `publish-npm.yml`
   workflow with an Actions OIDC token. The consumer reads its tags and
   releases.
8. **npm** versions and dist-tags, read by the consumer.

The ledger worker's bindings, queue settings and schedule are in its
[`wrangler.jsonc`](https://github.com/simshanith/lit-ui-router/blob/main/www/release-ledger.lit-ui-router.dev/wrangler.jsonc).

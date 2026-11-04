---
title: How this site runs
description: lit-ui-router.dev on Cloudflare — static assets, the docs worker that routes the sample apps and release pages, and the release-ledger and release-diffs workers behind them
---

# How this site runs

lit-ui-router.dev is a Cloudflare Worker with static assets. The docs are
plain files; a worker answers only the paths that need a routing decision —
the sample apps, through `ui-router-server`, and the release pages, from two
workers behind it: one keeps the release ledger, the other builds release
diffs.
[Server-Side Routing](./guides/server-route-matching#one-request-at-a-time)
follows a single request through the docs worker.

<DiagramEmbed src="/diagrams/about-this-site-architecture.svg">

<!--@include: ./public/diagrams/about-this-site-architecture.svg-->

</DiagramEmbed>

1. **Readers** load `lit-ui-router.dev`: the docs, the sample apps, the
   <a href="/releases/" target="_self">release pages</a> and the `/gh`
   redirects the README badges link to.
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
   release pages and `/gh` redirects from ledger rows it reads over RPC, and
   the release diff pages from diffs it fetches over RPC. It has no database
   or bucket of its own.
4. **The diffs worker**
   ([`release-diffs`](https://github.com/simshanith/lit-ui-router/blob/main/www/release-diffs.lit-ui-router.dev/README.md))
   builds each pair of releases' npm diff once and serves it from R2; the
   docs worker calls it through the `RELEASE_DIFFS` service binding.
   [The release-diffs worker](#the-release-diffs-worker) below draws what is
   behind it.
5. **The ledger worker** keeps the release ledger; the docs worker reads it
   through the `LEDGER` service binding.
   [The release ledger](#the-release-ledger) below draws what is behind it.

## The release ledger

The ledger worker
([`release-ledger`](https://github.com/simshanith/lit-ui-router/blob/main/www/release-ledger.lit-ui-router.dev/README.md))
records what the git tag, npm and GitHub say about each release. Claims come
in, a queue consumer checks them against the sources and writes the outcome,
and other workers read the result.

<DiagramEmbed src="/diagrams/about-this-site-ledger.svg">

<!--@include: ./public/diagrams/about-this-site-ledger.svg-->

</DiagramEmbed>

1. **GitHub** runs `publish-npm.yml`, which sends a claim with an Actions
   OIDC token after each npm publish. Its tags and releases are one of the
   sources the ledger observes.
2. **npm** is the other source: versions and dist-tags.
3. **The ledger worker** verifies each claim at `POST /claims`, enqueues it
   and answers 202 without touching D1. A daily sweep, run by a Cron Trigger,
   lists the repository's release tags and enqueues a claim for each, so the
   ledger heals without an Actions run. The queue consumer observes each
   claim's release on GitHub and npm and is the only thing that writes D1.
4. **Queues** hold claims until the consumer takes them, one at a time, with a
   dead-letter queue for claims that run out of retries.
5. **D1** stores the release ledger. Other workers read it over RPC through
   `LedgerReader`; the docs worker does, as the site diagram shows.

The ledger worker's bindings, queue settings and schedule are in its
[`wrangler.jsonc`](https://github.com/simshanith/lit-ui-router/blob/main/www/release-ledger.lit-ui-router.dev/wrangler.jsonc).

## The release-diffs worker

A third worker keeps the patch `npm diff` prints between two published
versions of a package, built once per version pair.

<DiagramEmbed src="/diagrams/about-this-site-release-diffs.svg">

<!--@include: ./public/diagrams/about-this-site-release-diffs.svg-->

</DiagramEmbed>

1. **The release-diffs worker**
   ([`worker/index.ts`](https://github.com/simshanith/lit-ui-router/blob/main/www/release-diffs.lit-ui-router.dev/worker/index.ts))
   answers three RPC methods: `index` lists a pair's files, `files` streams
   the patch sections one file preset shows, and `patch` streams the whole
   patch. Each reads the pair's entry from R2 first. It has no route and no
   `workers.dev` or Preview URL, so the docs worker's service binding is the
   only way in.
2. **A `ReleaseDiff` Durable Object**, one per pair, builds a missing entry.
3. **npm** serves the packument and both tarballs a build diffs.
4. **R2** holds one entry per pair under `v1/<pkg>/<from>...<to>/`: the
   patch, each preset's sections, and `index.json`, written last, so an entry
   with an index is complete. The object is its only writer; the worker only
   reads it.

The worker's bucket and Durable Object bindings are in its
[`cloudflare.config.ts`](https://github.com/simshanith/lit-ui-router/blob/main/www/release-diffs.lit-ui-router.dev/cloudflare.config.ts);
a Preview writes its own bucket.

### Building one diff

<DiagramEmbed src="/diagrams/about-this-site-release-diff-build.svg">

<!--@include: ./public/diagrams/about-this-site-release-diff-build.svg-->

</DiagramEmbed>

The worker addresses a pair's object by name, `<pkg>@<from>...<to>`, and its
first call creates it. The object keeps nothing in storage: calls that arrive
while a build runs share that build, and each build reads `index.json` again
first, in case another just finished. A build fetches the packument and both
tarballs, unpacks and diffs them in memory, then writes the patch and each
preset's sections before `index.json`. A build that fails before the index
lands leaves the pair without one, so the next miss builds it again. An idle
object is evicted, with nothing to clean up.

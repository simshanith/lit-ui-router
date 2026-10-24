# @www/release-diffs.lit-ui-router.dev

The release-diffs worker: the patch `npm diff` prints between two published
versions of a package, built once per version pair and kept in R2. It has no
hostname; the docs worker reaches it through a service binding. The directory
takes a domain-shaped name because every `www/` package is keyed by one (see
[`www/README.md`](../README.md)).

- [`cloudflare.config.ts`](./cloudflare.config.ts): a
  [`cf` project config](https://developers.cloudflare.com/cf/projects/cloudflare-config/)
  with no route and no `workers.dev` or Preview URL. It binds the
  `release-diffs` R2 bucket as `DIFFS`, `release-diffs-preview` for a Preview,
  and declares the `ReleaseDiff` Durable Object class.
- [`worker/index.ts`](./worker/index.ts): the entry point. Its default export is
  a `WorkerEntrypoint` whose RPC methods, `index`, `files` and `patch`, read a
  pair's entry from R2 and, on a miss, have that pair's `ReleaseDiff` object
  build it. One object per pair, named by `idFromName`, keeps a pair to one
  build at a time; it stores nothing itself.
- [`src/`](./src): the build engine, run by the worker and by node's test
  runner. [`registry.ts`](./src/registry.ts) reads both tarballs from the npm
  registry, [`format-diff.ts`](./src/format-diff.ts) prints the patch the way
  libnpmdiff does, [`file-filter.ts`](./src/file-filter.ts) holds the Source,
  Published JS, Types and All presets, and [`store.ts`](./src/store.ts) the R2
  layout.

A pair's entry sits under `v1/<pkg>/<from>...<to>/`: `patch`, one
`files/<preset>` per preset holding that preset's sections of the patch, and
`index.json`, written last, so an entry with an index is complete. Pairs are
immutable, so an entry is never rewritten; a format change bumps the `v1`
prefix.

`test` runs the engine's suites and the worker in workerd through wrangler's
test harness, under the config `cloudflare.config.ts` gives production, with
[`worker/test/registry-stub.ts`](./worker/test/registry-stub.ts) answering the
registry. `test:npm-diff` checks the patch against the npm CLI's, byte for byte,
in the `acceptance (npm-diff)` job.

It deploys through Workers Builds like every site in [`www/`](../README.md),
with its branches built as Workers Previews, but through `cf` rather than
Wrangler; see [`DEPLOY.md`](../DEPLOY.md#cf-setup).

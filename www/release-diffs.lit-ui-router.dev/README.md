# @www/release-diffs.lit-ui-router.dev

The release-diffs worker, before the release diffs: it answers 404 to every
request. It has no hostname; the docs worker will reach it through a service
binding. The directory takes a domain-shaped name because every `www/`
package is keyed by one (see [`www/README.md`](../README.md)).

- [`wrangler.jsonc`](./wrangler.jsonc): no route, no `workers.dev` or Preview
  URL, and an empty `previews` block.
- [`worker/index.ts`](./worker/index.ts): the worker's entry point.

It deploys through Workers Builds like every site in [`www/`](../README.md),
with its branches built as Workers Previews; see [`DEPLOY.md`](../DEPLOY.md).

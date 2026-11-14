# v1.versions.lit-ui-router.dev

The frozen 1.x docs: an assets-only Worker, `lit-ui-router-docs-v1`, that serves the 1.x docs
under `/v1/`. The docs worker hands every `/v1/*` request to it through a service binding, so it has
no route, custom domain or `workers.dev` URL of its own, and no Workers Builds trigger: it is
deployed by hand, once per snapshot.

- `cloudflare.config.ts` names the Worker and its asset handling; `wrangler.config.ts` points `cf`
  at `dist/` for the assets.
- `dist/` (gitignored) holds the built snapshot under `v1/`, with its `_redirects` and `_headers`
  at the root. The repo keeps its manifest instead, in
  [`catalog/snapshots/v1.json`](../lit-ui-router.dev/catalog/snapshots/v1.json).

[www/DEPLOY.md](../DEPLOY.md#frozen-1x-docs-at-v1) covers building, deploying and replacing it.

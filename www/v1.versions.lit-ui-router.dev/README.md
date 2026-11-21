# v1.versions.lit-ui-router.dev

The 1.x docs' former Worker, `lit-ui-router-docs-v1`: an assets-only Worker that served the 1.x
docs under `/v1/` through a service binding from the docs worker. The docs worker now serves `/v1/`
from the docs snapshot bucket, so nothing reaches this Worker; it stays deployed until it is
retired.

- `cloudflare.config.ts` names the Worker and its asset handling; `wrangler.config.ts` points `cf`
  at `dist/` for the assets.
- `dist/` (gitignored) is where `docs:snapshot` bakes the snapshot under `v1/`, with its
  `_redirects` and `_headers` at the root, and where `docs:snapshot:publish` uploads it from. The
  repo keeps its manifest instead, in
  [`catalog/snapshots/v1.json`](../lit-ui-router.dev/catalog/snapshots/v1.json).

[www/DEPLOY.md](../DEPLOY.md#frozen-1x-docs-at-v1) covers building and publishing it.

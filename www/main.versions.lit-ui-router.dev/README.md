# main.versions.lit-ui-router.dev

The unreleased docs: an assets-only Worker, `lit-ui-router-docs-main`, that serves the docs built
from `main` under `/main/`. The docs worker hands every `/main/*` request to it through a service
binding, so it has no route, custom domain or `workers.dev` URL of its own.

- `cloudflare.config.ts` names the Worker and its asset handling; `wrangler.config.ts` points `cf`
  at `dist/` for the assets.
- `build` runs the docs site's `docs:snapshot` for the `main` version, after that site's own build.
  It writes `dist/` (gitignored): the site under `main/`, with its `_redirects` and `_headers` at
  the root. Nothing is committed in its place; the build checks every page's canonical link itself.
- `test` runs the docs site's `test:preview` against that `dist/`.

[www/DEPLOY.md](../DEPLOY.md#unreleased-docs-at-main) covers how it is built, served and deployed.

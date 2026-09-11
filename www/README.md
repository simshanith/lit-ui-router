# www

The sites this repo publishes, one directory per domain. Each directory is a
workspace package that owns its own content, its own Cloudflare Worker, and its
own wrangler config; the pipeline that ships them is shared.

| Directory                                   | Site                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`lit-ui-router.dev/`](./lit-ui-router.dev) | [lit-ui-router.dev](https://lit-ui-router.dev) — the VitePress docs site and the Cloudflare Worker that serves it |

## Adding a site

A new site is a package under `www/<domain>/`, named for the domain it serves:

- **Package name.** Site packages take the `@www/` scope — `@www/<domain>` — the
  way `@tools/*` mirrors `tools/`. The root [`.npmrc`](../.npmrc) points that
  scope at an RFC 6761 `.invalid` host, so a forgotten `workspace:*` fails loudly
  instead of resolving to a public-npm squatter.
- **Worker config.** Its own `wrangler.jsonc`, beside the package's `worker/`
  entry point and its static assets. The deploy runs from the repo root, so the
  path is named explicitly rather than found by walking up.
- **Trigger config.** An entry in
  [`workers-builds-triggers.config.jsonc`](../tools/workers-builds/workers-builds-triggers.config.jsonc)
  whose `build_command` and `deploy_command` name the shared
  [`cloudflare-build.sh`](../tools/workers-builds/cloudflare-build.sh) — a shim over
  [`cloudflare-build.ts`](../tools/workers-builds/cloudflare-build.ts) — and
  [`cloudflare-deploy.ts`](../tools/workers-builds/cloudflare-deploy.ts), plus the
  build environment variables that script expects.

## Shared conventions

Every site deploys through Cloudflare Workers Builds, and every trigger points at
the two scripts in [`tools/workers-builds`](../tools/workers-builds) rather than
holding the build and deploy steps inline. A trigger holds one command for every
branch it matches, so inlined steps mean a branch cannot change them — and a
package-manager change or a moved `wrangler.jsonc` is exactly a branch that needs
to change them. Pinning the script path instead lets the steps differ per branch
while the declared value stays constant, so divergence never reads as drift and
never needs an `--apply` to test. The same package diffs the config against the
live triggers
(`pnpm check:workers-builds`) and reports it as the non-gating `workers-builds
(triggers)` check run.

The current deployment guide for the shared pipeline and
[`lit-ui-router.dev`](./lit-ui-router.dev) is [`DEPLOY.md`](./DEPLOY.md). Future
sites can add their own guide when their deployment details differ.

# @www/release-ledger.lit-ui-router.dev

The release-ledger worker, before the ledger: it answers 404 to every request
on [release-ledger.lit-ui-router.dev](https://release-ledger.lit-ui-router.dev).
The design is [#1424](https://github.com/simshanith/lit-ui-router/issues/1424)
and [#1430](https://github.com/simshanith/lit-ui-router/issues/1430).

- [`wrangler.jsonc`](./wrangler.jsonc): the route and the `DB` binding to the
  `release-ledger` D1 database. It sets no `migrations_dir`, so the production
  deploy applies no migrations.
- [`worker/index.ts`](./worker/index.ts): the worker's entry point.

It deploys through Workers Builds like every site in [`www/`](../README.md);
see [`DEPLOY.md`](../DEPLOY.md).

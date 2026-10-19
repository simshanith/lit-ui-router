# @www/release-ledger.lit-ui-router.dev

The release ledger's D1 database, and the worker that will write it. The worker
answers 404 to every request on
[release-ledger.lit-ui-router.dev](https://release-ledger.lit-ui-router.dev) for
now. The design is
[#1424](https://github.com/simshanith/lit-ui-router/issues/1424) and
[#1430](https://github.com/simshanith/lit-ui-router/issues/1430); the model it
stores is [`@tools/release-ledger`](../../tools/release-ledger/README.md).

- [`migrations/`](./migrations): the D1 schema. The `version_states` view
  derives each region's state and an overall status from the `versions` facts.
- [`src/ledger-statements.ts`](./src/ledger-statements.ts): the statements the
  queue consumer will run in one D1 batch to write a fold's outcome.
- [`wrangler.jsonc`](./wrangler.jsonc): the route and the `DB` binding, whose
  `migrations_dir` names the migrations the production deploy applies.
- [`worker/index.ts`](./worker/index.ts): the worker's entry point.

It deploys through Workers Builds like every site in [`www/`](../README.md);
see [`DEPLOY.md`](../DEPLOY.md).

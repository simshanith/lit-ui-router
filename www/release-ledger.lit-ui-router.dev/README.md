# @www/release-ledger.lit-ui-router.dev

No site yet: the release ledger's D1 database. The model it stores is
[`@tools/release-ledger`](../../tools/release-ledger/README.md).

- [`migrations/`](./migrations): the D1 schema. The `version_states` view
  derives each region's state and an overall status from the `versions` facts.
- [`src/ledger-statements.ts`](./src/ledger-statements.ts): the statements the
  queue consumer will run in one D1 batch to write a fold's outcome.
- [`wrangler.jsonc`](./wrangler.jsonc): the database binding
  `wrangler d1 migrations` reads.

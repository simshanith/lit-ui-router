# @tools/cloudflare-api

Our Cloudflare client code, written in the shape of
[`@distilled.cloud/cloudflare`](https://www.npmjs.com/package/@distilled.cloud/cloudflare)
so each piece can run beside the generated operations.
[`tools/workers-builds`](../workers-builds) and
[`www/release-ledger.lit-ui-router.dev`](../../www/release-ledger.lit-ui-router.dev/README.md)
import it.

- [`src/call.ts`](./src/call.ts) (`./call.ts`): `call` and `callResult` run
  one operation with an API token, retry on throttling only, and redact the
  account id and token from errors.
- [`src/builds-settings.ts`](./src/builds-settings.ts)
  (`./builds-settings.ts`): `getWorkerBuildSettings` and
  `updateWorkerBuildSettings`, declared with distilled's `API.make`, traits,
  protocol and retry.

## Upstreaming

An operation here is a candidate to upstream to distilled. Once distilled ships
it, import it from `@distilled.cloud/cloudflare` and delete it here.

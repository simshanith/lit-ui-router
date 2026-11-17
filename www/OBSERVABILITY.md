# Observability

What the Workers under `www/` report about each request, and where it goes. Deploying them is
[DEPLOY.md](./DEPLOY.md).

## What is collected

Each Worker has [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
and [Workers traces](https://developers.cloudflare.com/workers/observability/traces/) on. The
traces are the platform's own: one trace per invocation, with spans for the handler and for the
calls it makes to bindings and `fetch`. The release ledger adds its own on top, named `ledger.*`
and `GET <source>`, through the tracer its `worker/index.ts` provides; the other two add none.

| Worker         | Config                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Docs site      | `observability` in [`lit-ui-router.dev/wrangler.jsonc`](./lit-ui-router.dev/wrangler.jsonc)                                         |
| Release ledger | `observability` in [`release-ledger.lit-ui-router.dev/wrangler.jsonc`](./release-ledger.lit-ui-router.dev/wrangler.jsonc)           |
| Release diffs  | `observability` in [`release-diffs.lit-ui-router.dev/cloudflare.config.ts`](./release-diffs.lit-ui-router.dev/cloudflare.config.ts) |

Sampling is the platform default; `head_sampling_rate` (`headSamplingRate` in
`cloudflare.config.ts`) under `traces` lowers it. The three blocks are held equal by a test, so
a change goes in each config and in the test's expected block.

## Where it goes

Logs stay in Cloudflare, in Workers Observability. Traces go to [Honeycomb](https://www.honeycomb.io/)
only, through the destination each config names in `traces.destinations`. `traces.persist` is
off, so Cloudflare stores none of them: from December 1, 2026 stored traces count toward the
account's [Observability usage](https://developers.cloudflare.com/observability/pricing/).

A Workers Preview deploys the same config, so a branch's traces go there as well.

### The Honeycomb destination

`honeycomb-traces` is a
[Workers Observability destination](https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/)
on the Cloudflare account, not in the repo. It holds:

| Field            | Value                                                                             |
| ---------------- | --------------------------------------------------------------------------------- |
| `logpushDataset` | `opentelemetry-traces`, the kind of telemetry it carries                          |
| Endpoint         | `https://api.honeycomb.io/v1/traces`, Honeycomb's OTLP endpoint for the US region |
| Header           | `x-honeycomb-team`, carrying an ingest key of the Honeycomb team                  |

Cloudflare never returns the key: reading the destination lists the header's name with no
value. A config names the destination and nothing else, so no credential is in the repo or in a
Worker's environment.

## Operating it

Account changes go through the [`cf` CLI](./DEPLOY.md#cf-setup), with `--dry-run` first.

- **Check delivery.** `cf o11y destinations list` prints each destination's `jobStatus`:
  `last_complete` and `last_error` are the times of the last successful and last failed push,
  and `error_message` says why it failed.
- **Rotate the key.** Make a new ingest key in Honeycomb, then run
  `cf o11y destinations update honeycomb-traces --enabled --configuration-type logpush --configuration-url <endpoint> --configuration-headers @<file>`,
  where the file is a JSON object of the header. `cf` wants the type and the endpoint repeated
  whenever a header changes. Delete the old key in Honeycomb once `jobStatus` shows a push
  after the change. Keep the file out of the checkout and remove it afterwards.
- **Add a Worker.** Give its config the `observability` block the others have.
  `worker-observability.test.ts` in `tools/workers-builds` fails until every config listed in
  [`workers-builds-triggers.config.jsonc`](../tools/workers-builds/workers-builds-triggers.config.jsonc)
  carries the same block, whichever kind of file it is.
- **Stop exporting.** Remove the name from each config before deleting the destination.

## Not covered

The [Altitude Atlas](./DEPLOY.md#cloudflare-pages-the-altitude-atlas) is on Cloudflare Pages
and reports nothing here.

The router's own spans, from the server's transitions or from a page, are not sent anywhere
yet, and neither are build timings from CI. Both are tracked in
[issue 2220](https://github.com/simshanith/lit-ui-router/issues/2220).

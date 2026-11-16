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
`cloudflare.config.ts`) under `traces` lowers it for one Worker.

## Where it goes

Logs stay in Cloudflare. Traces go to two places:

- **Workers Observability**, in the Cloudflare dashboard, since `traces.persist` keeps its
  default.
- **[Honeycomb](https://www.honeycomb.io/)**, through the destination each config names in
  `traces.destinations`.

A Workers Preview deploys the same config, so a branch's traces go to both as well.

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

- **Check delivery.** `cf o11y destinations list` prints each destination's `jobStatus`: the time
  of the last push that completed, and the last error if there was one.
- **Rotate the key.** Make a new ingest key in Honeycomb, then run
  `cf o11y destinations update honeycomb-traces --enabled --configuration-type logpush --configuration-url <endpoint> --configuration-headers @<file>`,
  where the file is a JSON object of the header. `cf` wants the type and the endpoint repeated
  whenever a header changes. Delete the old key in Honeycomb once `jobStatus` shows a push
  after the change. Keep the file out of the checkout and remove it afterwards.
- **Add a Worker.** Set `traces.enabled` and name the destination in `traces.destinations` in
  its config. A Worker configured by `cloudflare.config.ts` has no `wrangler.jsonc` to search,
  so check both kinds when looking for one that was missed.
- **Stop exporting.** Remove the name from each config before deleting the destination.

## Not covered

The router's own spans, from the server's transitions or from a page, are not sent anywhere
yet, and neither are build timings from CI. Both are tracked in
[issue 2220](https://github.com/simshanith/lit-ui-router/issues/2220).

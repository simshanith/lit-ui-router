# sample-app-shared

Internal (private, source-only) package holding everything the sample apps
have in common: the contacts/mymessages/prefs feature modules, router
configuration, data sources, styles, and the simulated REST fixtures in
`public/`.

The apps — `sample-app-lit-vanilla`, `sample-app-lit-mobx`,
`sample-app-lit-effect` and `sample-app-lit-signals` — differ only in their reactivity idiom, so each app
keeps just the handful of modules that express that idiom:

- `src/app/global/appConfig.ts` and `authService.ts` — plain singletons vs
  MobX observables vs Effect `SubscriptionRef`s vs `Signal.State`s
- `src/app/main/App.ts` and `NavHeader.ts` — `TransitionController` vs
  `ReactionController` / `RouterReactionController` vs `RefController` /
  `RouterRefController` vs `SignalWatcher` / `RouterSignalController`
- `src/app/mymessages/Compose.ts` and `MessageList.ts` — plus each app's
  store helper (`storeCommitController.ts` / `messagesStore.ts`)

## How the inversion works

`src/app/global/appModules.ts` is the contract: it declares the types of the
app-provided modules and exports them as (initially unassigned) live
bindings. Each app's `src/main.ts` implements the contract, calls
`registerAppModules({ AppConfig, AuthService, App, Compose, MessageList })`,
and then boots the shared entry point with `await import('sample-app-shared/main.js')`.

Shared code just imports the bindings — e.g.
`import { AppConfig } from './appModules.js'` — and because ESM exports are
live, every read after registration sees the app's implementation. The one
rule this imposes: shared code must read these bindings lazily (inside
constructors, methods, or lazy-loaded state definitions), never at module
scope, since shared modules evaluate before `registerAppModules` runs. Work
that must start eagerly can `await appModulesRegistered` instead (see the
mobx app's `messagesStore.ts`).

There is no build step: apps consume the TypeScript sources directly via the
package `exports` (`sample-app-shared/app/...js` resolves to
`./src/app/....ts`).

## The state tables

The states' names, urls, params, parents and resolve tokens live in
data-only tables, one per module on its own subpath
(`sample-app-routes/state-table/app`, `/contacts`, `/mymessages`,
`/prefs`). The `app` table also holds each lazy module's future state. The
server mounts read all of them, through `sample-app-routes/state-table`, as
their routes.

Each `src/app/*/states.ts` binds components, resolve functions and
client-only config to its own table by state name (`src/registry/bind.ts`),
so a lazy chunk carries only its own rows. The same file registers the
table's rows with `'ui-router-registry'` (`RegisteredStates`) and asserts
they don't collide (`AssertNoCollisions`), so no app augments the registry.
The registration sits here rather than in the table package because one
row's param type (`mymessages.compose`'s `Partial<Message>` draft) names a
domain type the runtime-neutral tables can't import.
`src/registry/states.ts` holds those param types, each resolve token's
value type, and the resolves each state's views receive.

## Exporting spans

`src/app/global/telemetry.ts` gives the devtools Timeline the router's spans, and can send them to an OTLP/HTTP
receiver too, through a `BatchSpanProcessor` and the OTLP/HTTP exporter, which load as their own chunk
(`otlpExport.ts`). It takes the receiver from the first of:

1. `globalThis.__OTLP_TRACES__`, set before the app boots: `{ endpoint, headers? }`.
2. The build variables `VITE_OTLP_TRACES_ENDPOINT` and `VITE_OTLP_TRACES_HEADERS`, for a local or one-off build.
   Each app's `turbo.json` lists them in its build task's `env`.

The endpoint is a full traces URL. Headers are `name=value` pairs joined by commas, the shape of
`OTEL_EXPORTER_OTLP_HEADERS`. Each app's `.env` sets `VITE_OTLP_SERVICE_NAME`, the `service.name` of its spans.
With neither, the exporter chunk is never loaded and nothing is sent; the deployed docs site sets neither. With
an endpoint the plugin is installed with `redaction: { messages: false }`, so no error message leaves the page, and
the Timeline shows none either, since redaction applies to a span and not to where it is sent.

The processor sends a batch every few seconds and when the page is hidden, which includes unloading it; the
exporter sends with `keepalive`, so the request outlives the page. The receiver must allow the page's origin
through CORS.

CI builds the apps without either variable, so its builds match the `run` job's and share its cache. The e2e jobs
of `.github/workflows/build-test-run.yml` set `OTLP_TRACES_ENDPOINT` and `OTLP_TRACES_HEADERS` from the
`OTLP_TRACES_ENDPOINT` repository variable and the `OTLP_TRACES_HEADERS_CI` secret. When both are set, the app
suites' `page` fixture (`apps/sample-app-lit-e2e/src/playwright/app/fixtures.ts`) sets `__OTLP_TRACES__` from them in
an init script. Playwright closes a test's context without hiding its page, so the fixture's teardown calls
`__OTLP_TRACES__.flush`, which the app sets once it exports, to send the spans still batched. The suite tasks list both in `passThroughEnv`, outside every cache key, so a suite replayed from the
cache exports nothing. After the key is added or changed, a run of `build-test.yml` with its `force` input reruns
the suites and shows whether spans arrive. The key is in no built bundle and no cache entry, but a Playwright trace records the init
script and the requests' headers, so a failed suite's `playwright-traces-<group>` artifact carries it: use an
ingest-only key.

## Adding to the shared surface

If a module is identical in both apps, move it here and keep relative
imports. If it needs to reach an app-specific module, add the member to the
`AppModules` contract in `appModules.ts` and import the live binding — both
apps' `registerAppModules` call sites will then fail to typecheck until they
provide it.

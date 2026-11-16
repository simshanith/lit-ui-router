# ui-router-otel

[OpenTelemetry](https://opentelemetry.io) spans for any [UI-Router](https://ui-router.github.io) `@uirouter/core` router: one span per transition, with a child span for each phase and, on request, each resolve.

The package is private and unpublished, so it is workspace-only for now. Its peers are `@uirouter/core` and `@opentelemetry/api`; it has no other runtime dependency and adds no exporter. `DevtoolsSpanProcessor` sends spans to the devtools panel's Timeline. It reads the router through the same adapter as [`ui-router-devtools`](../ui-router-devtools/README.md), private shared source ([`@repo/router-events`](../shared/router-events/)) that the build inlines into `dist/shared/`, so neither package depends on the other. Nothing in it reads `window` or `document`, so it attaches to a headless router as well as a browser one.

## Usage

The app owns the tracer provider, its processors and its exporter; the plugin takes a tracer.

```ts check
import { trace } from '@opentelemetry/api';
import { UIRouter } from '@uirouter/core';
import { OtelPlugin } from 'ui-router-otel';

declare const router: UIRouter;

const otel = router.plugin(OtelPlugin, {
  tracer: trace.getTracer('my-app'),
  redaction: { params: ['folderId'] },
});

// Ends the spans still open and stops reporting.
otel.dispose();
```

`router.dispose()` disposes the plugin too.

## Options

| Option                  | Default                          | Effect                                                                                                                                                      |
| ----------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tracer`                | required                         | The `Tracer` every span starts on                                                                                                                           |
| `redaction`             | `{ params: [], messages: true }` | What reaches a span; the same model as a devtools session export, below                                                                                     |
| `timeResolves`          | `false`                          | Times each resolve as a child span by wrapping its `resolveFn`; off by default because it patches core objects, as in the devtools                          |
| `activateResolveSpans`  | `false`                          | Runs each resolve's function with its resolve span active, so a span the app starts there is that span's child; see [Active spans](#active-spans)           |
| `activateHookSpans`     | `false`                          | Runs each app transition hook with its phase span active, so a span the app starts there is that phase span's child; see [Active spans](#active-spans)      |
| `activateLazyLoadSpans` | `false`                          | Runs each state's `lazyLoad` with a `lazy load <state>` span active, so a span the app starts there is that span's child; see [Active spans](#active-spans) |
| `includeIgnored`        | `false`                          | Reports transitions core ignores (same state and params, no `reload`)                                                                                       |

`redaction` has the two parts of a [`ui-router-devtools`](../ui-router-devtools/README.md#session-files-and-redaction) export:

- `params`: the param keys that become `uirouter.param.<key>` attributes, or `'all'`. A param not listed gets no attribute, and by default no param does. A list param's value is a string array.
- `messages`: whether error messages reach a span's status description and its `exception` event. Messages are free text from the app's hooks and resolves, so they can carry user data such as ids, emails or server responses; set `messages: false` when your traces leave the browser. `error.type` and `uirouter.invalid_params` stay either way.

Spans omit what a session file redacts. A session file keeps every param key with `[redacted]` for its value, because the person reading it needs to see which params a transition had. A span has no such reader: an attribute per param costs storage and cardinality in the tracing backend and, with a placeholder value, tells nobody anything except the param's name. `uirouter.invalid_params` still names the params that failed validation, since an invalid transition is otherwise undiagnosable and the ids come from the state declarations, not from user data.

## Spans

Every span is `SpanKind.INTERNAL`, and its start and end times are the router events' own times (`performance.timeOrigin` plus the event's offset), not the time the reporter ran.

| Span           | Name                                                                         | Parent                                         | Attributes                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transition     | The target state's name                                                      | The context active when the transition started | `uirouter.transition_id`, `uirouter.from`, `uirouter.to`, `uirouter.source` (`url`, `sref`, `redirect`, `otherwise` or `unknown`), `uirouter.reload` (boolean), `uirouter.reload_state` (when `reload` names a state), `uirouter.location` (`true`, `false` or `replace`), `uirouter.entering`, `uirouter.exiting`, `uirouter.retained` (string arrays), `uirouter.outcome`, `uirouter.invalid_params`, `uirouter.param.<key>` (listed params only), `error.type` |
| Phase          | `<phase> <state>`, or `<phase>` for a transition-wide phase such as `before` | The transition span                            | `uirouter.phase`, `uirouter.state`                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Resolve        | `resolve <token>`                                                            | The transition span                            | `uirouter.resolve`, `uirouter.state`, `error.type`                                                                                                                                                                                                                                                                                                                                                                                                                |
| Lazy load      | `lazy load <state>`, only with `activateLazyLoadSpans`                       | The transition span                            | `uirouter.state`, `error.type`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Invalid target | `invalid target`                                                             | The context active when `go()` was called      | `uirouter.from`, `uirouter.to`, `uirouter.outcome`, `uirouter.param.<key>` (listed params only), `error.type`                                                                                                                                                                                                                                                                                                                                                     |

A span name never holds params or a URL. A phase cut short by a redirect, a supersede or `dispose()` ends with its transition. A resolve whose value is already resolved, such as a retained parent's, gets no span.

### Outcomes

| `uirouter.outcome` | Status                                                                                                   | `error.type`                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `success`          | `UNSET`                                                                                                  | none                                                          |
| `redirected`       | `UNSET`; the successor links to it                                                                       | none                                                          |
| `superseded`       | `UNSET`; it links to its superseder                                                                      | none                                                          |
| `aborted`          | `UNSET`                                                                                                  | none                                                          |
| `ignored`          | `UNSET`; reported with `includeIgnored`, or once an app `onBefore` hook has run with `activateHookSpans` | none                                                          |
| `error`            | `ERROR` with the message                                                                                 | The thrown Error's `name`, such as `TypeError`, else `_OTHER` |
| `invalid`          | `ERROR` with the message                                                                                 | `invalid`                                                     |

A redirect, a supersede and an abort are the router doing its job, so they leave the status unset. An error and an invalid transition or target set `ERROR`, with the message as the status description and an `exception` event; a failed resolve does the same on its own span, with `error.type` from its Error. A transition is `invalid` when its param values do not validate, with the failing params in `uirouter.invalid_params`, or when it is redirected to an abstract state.

A redirect's successor carries a span link to the transition it replaced, and a superseded transition carries a span link to the transition that superseded it.

Each transition is the root of its own trace unless a span is active when it starts. The plugin installs no context manager; with one installed (for example `@opentelemetry/context-zone` in a browser), a transition started inside the app's own active span becomes that span's child.

## Active spans

Three options make a router span the active span while the app's own code runs, so a span the app starts there, such as an instrumented `fetch()`, is that router span's child and in the transition's trace. Each is off by default because each patches core objects, and each is independent of the others.

| Option                  | The app code                                                                                                                            | The span active while it runs                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `activateResolveSpans`  | A resolve's function                                                                                                                    | Its `resolve <token>` span, started when core calls the function            |
| `activateHookSpans`     | A transition hook the app registers, on the transition service or on a transition, and a state's own `onEnter`, `onExit` and `onRetain` | The span of the phase the hook runs in, such as `before` or `enter <state>` |
| `activateLazyLoadSpans` | A state's `lazyLoad`                                                                                                                    | Its `lazy load <state>` span, started when core calls the function          |

How long the span stays active depends on the app's context manager:

| Context manager                                                                                                        | The span is active for                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| None                                                                                                                   | Nothing: the API's default manager keeps no context, so no span is a child                                   |
| One that tracks only synchronous code, such as `StackContextManager`                                                   | The function's synchronous part: a `fetch()` called before its first `await` is a child; one after it is not |
| One that follows async work: `@opentelemetry/context-zone` in a browser, `AsyncLocalStorageContextManager` on a server | The whole function, `await`s included                                                                        |

What the app's function returns or throws reaches core untouched, so a hook still redirects, aborts or fails its transition. The devtools recorder observes the same router through its own hooks and wrappers, and either may attach first.

### Resolves

With `activateResolveSpans` the plugin spans resolves itself, so `timeResolves` adds nothing beside it and a resolve is never spanned twice. It wraps each per-transition copy of a resolvable once, beside the devtools recorder's own `timeResolves` wrapper in either order. The devtools Timeline times its resolve rows from these spans when the devtools recorder did not time resolves itself.

### Hooks

`activateHookSpans` adds no span: a hook runs in the phase span the plugin already reports, started when the first hook of that phase runs rather than when the phase ends, with the same name, parent, attributes and times. A span the app starts in an `onEnter` for `users` is a child of `enter users`; one in an `onStart` hook is a child of `start`.

It wraps the callback of each hook registered on the router's transition service, whether before or after the plugin, and each hook registered on a transition, before the phase that runs it. `dispose()` puts the service's callbacks back. It leaves alone:

- Core's own hooks, which run the router's work: redirects, resolves, views, the URL, lazy loading, ignored and invalid transitions. A state's `redirectTo` function runs in one of these, so it is not covered. Core's hooks that call a state's own `onEnter`, `onExit` and `onRetain` are the exception, since they run the app's code.
- A hook registered at a priority of `Number.MAX_SAFE_INTEGER` or more, or its negative or less: that is where the plugin and the devtools recorder bracket each phase, so such a hook is instrumentation rather than the app's.
- `onCreate` hooks, which run while core builds the transition, before it has a span.

A transition's span is otherwise held back until core can no longer ignore the transition. An `onBefore` hook runs before that check, so once one has run with its phase span active the transition is reported even when core then ignores it, with `uirouter.outcome` `ignored`, so the spans the hook started keep their parent.

The plugin finds core's own hooks by running core's private hook registration against a stand-in that keeps each callback, so a core release that renames it turns `activateHookSpans` into a no-op rather than wrapping core. Core's `trace` output names a wrapped hook by the wrapper's source.

### Lazy loads

`activateLazyLoadSpans` adds a `lazy load <state>` span, a child of the transition's span, for each state whose `lazyLoad` core calls, and ends it when the function's promise settles, failed with `error.type` when it rejects. Core calls a lazy load once and shares its promise, so a second transition that waits on a load already running gets no span of its own; the load's span belongs to the transition that started it, usually one the load's retry then redirects. A failed load runs again on the next transition, under a new span. States the load registers are covered by `activateHookSpans` like any other.

The plugin wraps the function on each state as a transition enters it. `dispose()` puts it back, except on a state whose load is still running, where core holds the load's promise on the wrapper; that wrapper then only passes through.

## The devtools Timeline

`DevtoolsSpanProcessor` sends every span a tracer provider starts and ends to the [`ui-router-devtools`](../ui-router-devtools/README.md#timeline) panel, whose Timeline nests the app's spans, such as a fetch, under the transition they ran during. Add it to the provider the plugin's tracer comes from: the router's own spans are how the panel joins a span to a transition.

```ts
import { TracerProvider } from '@opentelemetry/sdk-trace';
import type { UIRouter } from '@uirouter/core';
import {
  DevtoolsSpanProcessor,
  OtelPlugin,
  type SpanSink,
} from 'ui-router-otel';

declare const router: UIRouter;

const provider = new TracerProvider({
  spanProcessors: [
    new DevtoolsSpanProcessor(() =>
      document.querySelector<HTMLElement & SpanSink>('ui-router-devtools'),
    ),
  ],
});

router.plugin(OtelPlugin, { tracer: provider.getTracer('my-app') });
```

The argument is asked for the panel on each span, so the panel may be created after the provider; a span with no panel to take it is dropped. `{ started: false }` sends spans only when they end. The processor reads spans structurally, through `ProcessedSpan`, typed from `@opentelemetry/api` alone: it fits the `SpanProcessor` of `@opentelemetry/sdk-trace-base` 1.x and 2.x and of `@opentelemetry/sdk-trace` 3.x without a peer on either, and reads the parent from `parentSpanContext` or, on 1.x, `parentSpanId`. An attribute value that is not a scalar or an array of scalars is sent as JSON text.

The panel sees spans as they are; only its session export scrubs them, by the [devtools redaction](../ui-router-devtools/README.md#session-files-and-redaction). How a span is joined, and why a fetch in a resolve, a hook or a lazy load is joined as `during` unless the matching option is on, is in [the Timeline](../../docs/visualizer-proposal/timeline.md#joining-a-span).

## Other trace viewers

The plugin's spans are ordinary OpenTelemetry spans, so the provider that feeds the panel can send the same spans to any OTLP receiver, such as a local Jaeger or Grafana Tempo. Add an exporter beside the `DevtoolsSpanProcessor`:

```ts check
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { DevtoolsSpanProcessor, type SpanSink } from 'ui-router-otel';

const provider = new TracerProvider({
  spanProcessors: [
    new DevtoolsSpanProcessor(() =>
      document.querySelector<HTMLElement & SpanSink>('ui-router-devtools'),
    ),
    new BatchSpanProcessor({
      exporter: new OTLPTraceExporter({
        url: 'http://localhost:4318/v1/traces',
      }),
    }),
  ],
});
```

A receiver that takes spans from a page has to allow the page's origin. The views differ in what they are for:

| View                                                                   | Shows                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| The devtools Timeline                                                  | One transition, with its redirect chain, phases, resolves and the spans joined to it                          |
| A trace viewer behind an OTLP receiver                                 | Every trace: search, attribute filters, comparison, and a server's spans when the server sends them there too |
| The browser's Performance panel, from `ui-router-devtools/performance` | Transitions, phases and resolves in a `UI-Router` track group, beside network, rendering and long tasks       |

The Performance track is written from the devtools' recorded events and holds no spans.

## Not covered

- A state's `redirectTo` function, `onCreate` hooks and hooks registered at the plugin's own priorities as active spans; see [Hooks](#hooks).
- Recorded sessions. Turning a recorded devtools `Session` into OTLP JSON after the fact is not built.
- Sentry's navigation span.
- Server transitions, the render that follows them, and trace continuity from a server-rendered page to its first client transition, tracked in [issue 2098](https://github.com/simshanith/lit-ui-router/issues/2098).

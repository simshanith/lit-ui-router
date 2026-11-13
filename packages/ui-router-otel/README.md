# ui-router-otel

[OpenTelemetry](https://opentelemetry.io) spans for any [UI-Router](https://ui-router.github.io) `@uirouter/core` router: one span per transition, with a child span for each phase and, on request, each resolve.

The package is private and unpublished, so it is workspace-only for now. Its peers are `@uirouter/core` and `@opentelemetry/api`; it has no other runtime dependency and adds no exporter. It reads the router through the same adapter as [`ui-router-devtools`](../ui-router-devtools/README.md), private shared source ([`@repo/router-events`](../shared/router-events/)) that the build inlines into `dist/shared/`, so neither package depends on the other. Nothing in it reads `window` or `document`, so it attaches to a headless router as well as a browser one.

## Usage

The app owns the tracer provider, its processors and its exporter; the plugin takes a tracer.

```ts check
import { trace } from '@opentelemetry/api';
import { UIRouter } from '@uirouter/core';
import { OtelPlugin } from 'ui-router-otel';

declare const router: UIRouter;

const otel = router.plugin(OtelPlugin, {
  tracer: trace.getTracer('my-app'),
  params: ['folderId'],
});

// Ends the spans still open and stops reporting.
otel.dispose();
```

`router.dispose()` disposes the plugin too.

## Options

| Option           | Default  | Effect                                                                                                                                                           |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tracer`         | required | The `Tracer` every span starts on                                                                                                                                |
| `params`         | `[]`     | Param keys recorded as `ui_router.param.<key>`. No param is an attribute unless it is listed                                                                     |
| `errorMessage`   | keeps it | `(message) => string \| undefined`, applied to every error message before it reaches a span's status and exception event; return `undefined` to drop the message |
| `timeResolves`   | `false`  | Times each resolve as a child span by wrapping its `resolveFn`; off by default because it patches core objects, as in the devtools                               |
| `includeIgnored` | `false`  | Reports transitions core ignores (same state and params, no `reload`)                                                                                            |

Error messages are free text from the app's hooks and resolves, so they can carry user data such as ids, emails or server responses. Map or drop them with `errorMessage` when your traces leave the browser.

## Spans

Every span is `SpanKind.INTERNAL`, and its start and end times are the router events' own times (`performance.timeOrigin` plus the event's offset), not the time the reporter ran.

| Span           | Name                                                                         | Parent                                         | Attributes                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transition     | The target state's name                                                      | The context active when the transition started | `ui_router.transition_id`, `ui_router.from`, `ui_router.to`, `ui_router.source` (`url`, `sref`, `redirect`, `otherwise` or `unknown`), `ui_router.reload` (boolean), `ui_router.reload_state` (when `reload` names a state), `ui_router.location` (`true`, `false` or `replace`), `ui_router.entering`, `ui_router.exiting`, `ui_router.retained` (string arrays), `ui_router.outcome`, `ui_router.rejection_type`, `ui_router.param.<key>` |
| Phase          | `<phase> <state>`, or `<phase>` for a transition-wide phase such as `before` | The transition span                            | `ui_router.phase`, `ui_router.state`                                                                                                                                                                                                                                                                                                                                                                                                        |
| Resolve        | `resolve <token>`                                                            | The transition span                            | `ui_router.resolve`, `ui_router.state`                                                                                                                                                                                                                                                                                                                                                                                                      |
| Invalid target | `invalid target`                                                             | The context active when `go()` was called      | `ui_router.from`, `ui_router.to`, `ui_router.outcome`, `ui_router.rejection_type`, `ui_router.param.<key>`                                                                                                                                                                                                                                                                                                                                  |

A span name never holds params or a URL. A phase cut short by a redirect, a supersede or `dispose()` ends with its transition. A resolve whose value is already resolved, such as a retained parent's, gets no span.

### Outcomes

| `ui_router.outcome` | `ui_router.rejection_type` | Status                                  |
| ------------------- | -------------------------- | --------------------------------------- |
| `success`           | none                       | `UNSET`                                 |
| `redirected`        | `superseded`               | `UNSET`; the successor links to it      |
| `superseded`        | `superseded`               | `UNSET`                                 |
| `aborted`           | `aborted`                  | `UNSET`                                 |
| `ignored`           | `ignored`                  | `UNSET`, and only with `includeIgnored` |
| `error`             | `error`                    | `ERROR` with the message                |
| `invalid`           | `invalid`                  | `ERROR` with the message                |

A redirect, a supersede and an abort are the router doing its job, so they leave the status unset. An error and an invalid target set `ERROR`, with the message as the status description and an `exception` event; a failed resolve does the same on its own span. Core reports a transition to an abstract state as an `error` whose message names it.

A redirect's successor carries a span link to the transition it replaced. A superseded transition carries none: the router does not record which transition superseded it.

Each transition is the root of its own trace unless a span is active when it starts. The plugin installs no context manager; with one installed (for example `@opentelemetry/context-zone` in a browser), a transition started inside the app's own active span becomes that span's child.

## Not covered

- Resolve and fetch nesting. A resolve's `fetch` span does not nest under the resolve span: the plugin does not make the transition span active while resolves run.
- Recorded sessions. Turning a recorded devtools `Session` into OTLP JSON after the fact is not built.
- Sentry's navigation span.
- Server transitions, the render that follows them, and trace continuity from a server-rendered page to its first client transition, tracked in [issue 2098](https://github.com/simshanith/lit-ui-router/issues/2098).

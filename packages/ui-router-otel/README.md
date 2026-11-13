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
  redaction: { params: ['folderId'] },
});

// Ends the spans still open and stops reporting.
otel.dispose();
```

`router.dispose()` disposes the plugin too.

## Options

| Option           | Default                          | Effect                                                                                                                             |
| ---------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `tracer`         | required                         | The `Tracer` every span starts on                                                                                                  |
| `redaction`      | `{ params: [], messages: true }` | What reaches a span; the same model as a devtools session export, below                                                            |
| `timeResolves`   | `false`                          | Times each resolve as a child span by wrapping its `resolveFn`; off by default because it patches core objects, as in the devtools |
| `includeIgnored` | `false`                          | Reports transitions core ignores (same state and params, no `reload`)                                                              |

`redaction` has two parts, as [`ui-router-devtools`](../ui-router-devtools/README.md#session-files-and-redaction) exports do:

- `params`: the param keys whose values are kept, or `'all'`. Every param is a `uirouter.param.<key>` attribute; a key not listed carries `[redacted]` in place of its value. A list param's value is a string array.
- `messages`: whether error messages reach a span's status description and its `exception` event. Messages are free text from the app's hooks and resolves, so they can carry user data such as ids, emails or server responses; set `messages: false` when your traces leave the browser. `error.type` and `uirouter.invalid_params` stay either way.

## Spans

Every span is `SpanKind.INTERNAL`, and its start and end times are the router events' own times (`performance.timeOrigin` plus the event's offset), not the time the reporter ran.

| Span           | Name                                                                         | Parent                                         | Attributes                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transition     | The target state's name                                                      | The context active when the transition started | `uirouter.transition_id`, `uirouter.from`, `uirouter.to`, `uirouter.source` (`url`, `sref`, `redirect`, `otherwise` or `unknown`), `uirouter.reload` (boolean), `uirouter.reload_state` (when `reload` names a state), `uirouter.location` (`true`, `false` or `replace`), `uirouter.entering`, `uirouter.exiting`, `uirouter.retained` (string arrays), `uirouter.outcome`, `uirouter.invalid_params`, `uirouter.param.<key>`, `error.type` |
| Phase          | `<phase> <state>`, or `<phase>` for a transition-wide phase such as `before` | The transition span                            | `uirouter.phase`, `uirouter.state`                                                                                                                                                                                                                                                                                                                                                                                                           |
| Resolve        | `resolve <token>`                                                            | The transition span                            | `uirouter.resolve`, `uirouter.state`, `error.type`                                                                                                                                                                                                                                                                                                                                                                                           |
| Invalid target | `invalid target`                                                             | The context active when `go()` was called      | `uirouter.from`, `uirouter.to`, `uirouter.outcome`, `uirouter.param.<key>`, `error.type`                                                                                                                                                                                                                                                                                                                                                     |

A span name never holds params or a URL. A phase cut short by a redirect, a supersede or `dispose()` ends with its transition. A resolve whose value is already resolved, such as a retained parent's, gets no span.

### Outcomes

| `uirouter.outcome` | Status                                  | `error.type`                                                  |
| ------------------ | --------------------------------------- | ------------------------------------------------------------- |
| `success`          | `UNSET`                                 | none                                                          |
| `redirected`       | `UNSET`; the successor links to it      | none                                                          |
| `superseded`       | `UNSET`; it links to its superseder     | none                                                          |
| `aborted`          | `UNSET`                                 | none                                                          |
| `ignored`          | `UNSET`, and only with `includeIgnored` | none                                                          |
| `error`            | `ERROR` with the message                | The thrown Error's `name`, such as `TypeError`, else `_OTHER` |
| `invalid`          | `ERROR` with the message                | `invalid`                                                     |

A redirect, a supersede and an abort are the router doing its job, so they leave the status unset. An error and an invalid transition or target set `ERROR`, with the message as the status description and an `exception` event; a failed resolve does the same on its own span, with `error.type` from its Error. A transition is `invalid` when its param values do not validate, with the failing params in `uirouter.invalid_params`, or when it is redirected to an abstract state.

A redirect's successor carries a span link to the transition it replaced, and a superseded transition carries a span link to the transition that superseded it.

Each transition is the root of its own trace unless a span is active when it starts. The plugin installs no context manager; with one installed (for example `@opentelemetry/context-zone` in a browser), a transition started inside the app's own active span becomes that span's child.

## Not covered

- Resolve and fetch nesting. A resolve's `fetch` span does not nest under the resolve span: the plugin does not make the transition span active while resolves run.
- Recorded sessions. Turning a recorded devtools `Session` into OTLP JSON after the fact is not built.
- Sentry's navigation span.
- Server transitions, the render that follows them, and trace continuity from a server-rendered page to its first client transition, tracked in [issue 2098](https://github.com/simshanith/lit-ui-router/issues/2098).

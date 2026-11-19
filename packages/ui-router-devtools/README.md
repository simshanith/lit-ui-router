# ui-router-devtools

Devtools for any [UI-Router](https://ui-router.github.io) `@uirouter/core` router: a recorder of versioned, JSON-safe transition events, a Lit panel that shows the state tree and the transition log, and reporters for the browser's Performance panel and console.

The outline marks what a declaration says about a state: a box in place of the ring for `abstract`, a dot and arrow for `redirectTo` (drawn on the rail into a default child), a circled H for `dsr` or `deepStateRedirect` from `@uirouter/dsr`, and a box split by a dashed line for `sticky` from `@uirouter/sticky-states`. The inspector names each in words.

The Map tab draws the state tree two ways, chosen in the panel header and remembered per viewer: nested boxes, child states inside their parent, and a node-link tree. The nested layout keeps every box at its natural size, composes them for the panel's shape and steps down a fit ladder when the tree is too large; under 560px of width the tree shows. A layout that still does not fit, or one zoomed with `−` and `+` in the panel header, is panned: by a drag, the wheel, Shift with an arrow key or the minimap that shows while it overflows, and `Fit` returns to the fitted view. Zoom moves between whole type sizes and never scales the drawing. No edge is drawn at rest: selecting a transition draws its edge, and selecting a state draws the traffic it has seen, with a count on a line travelled more than once. The inspector's close button, a click on the Map's empty room, a second click on the selection or `Escape` anywhere in the panel clears the selection or closes the Router card, and on the Map hides the inspector popover. Boxes move to their new places when the layout changes, and edges draw in after them; under reduced motion nothing moves. The Map's code loads on first use of the tab. The rules are in [the nested Map](../../docs/visualizer-proposal/map.md).

A click on a state in the Outline, on the Map or in the tree selects it, and a second click clears the selection. A double-click goes to the state, as the inspector's Go button does, and leaves it selected; a lazy state loads first. A state the Go button does not offer, one that is abstract, has a required param or belongs to an imported session, is only selected.

The inspector shows a state's full name, which a box on the Map shortens to its last segment. A copy button beside the name copies it as a target for `go()`, so a lazy `reports.**` copies `reports`, and one beside the URL copies the URL pattern. Each says what it copied through the panel's live region and shows a check for a moment. Where the Clipboard API is missing or refuses, it selects the text in the inspector to copy by hand and says so. Copying works in an imported session too.

A state has one colour wherever it appears: its box on the Map, its glyph and rail in the Outline, its node in the tree and its name in the inspector. The colour follows the state's depth in the tree, from a cycle of four, `--uird-depth-1` to `--uird-depth-4`. While a transition is selected, previewed or running, those colours recede and `--uird-active` and `--uird-exit` mark what it enters, retains and exits. Set the four depth tokens to one value for a monochrome panel.

`observedEdges(session)` folds a recorded session into one edge per ordered pair of states, with its count and outcomes, for exporters as well as the Map.

The package is private and unpublished, so it is workspace-only for now. The design, the screenshots and the open decisions are in the [router visualizer proposal](../../docs/visualizer-proposal/README.md) and its [devtools scope](../../docs/visualizer-proposal/devtools.md).

## Timeline

The Timeline view draws the transition in focus, or the latest, as a waterfall: the transition and its redirect chain as top bars, and its phases and resolves under them on one time axis, each row with its start and its duration as text. A running transition's bars grow with the clock. A phase cut short by a redirect or a supersede, a cached resolve and the resolves of a session recorded without `timeResolves` are tagged, not drawn as bars. The rows are a `tree` with the Outline's keys; Enter shows a bar's details. Its code and styles load on first use of the view. The rules are in [the Timeline](../../docs/visualizer-proposal/timeline.md).

Given spans from a tracer, the Timeline nests the ones that ran during the transition under it, each tagged by how the panel knows it belongs: a child of the router's own span, a span of the same trace, or `during` when it only overlaps in time. The element takes spans in a shape that names no tracing library, `SpanRecord`:

| Member          | Effect                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------ |
| `spans`         | The spans the panel holds, the latest 2000; setting it replaces them all                   |
| `addSpan(span)` | Adds a span, or replaces the one with its `spanId`, so a span can be sent at start and end |

[`ui-router-otel`](../ui-router-otel/README.md#the-devtools-timeline)'s `DevtoolsSpanProcessor` feeds it from an OpenTelemetry tracer provider. A panel that is given no span shows nothing about spans.

The Timeline shows one transition and its redirect chain at a time. It has no search or filter across spans and does not compare transitions; a trace viewer does that from the same spans, as in [other trace viewers](../ui-router-otel/README.md#other-trace-viewers).

## Views

The Views tab draws the router's `ui-view`s as nested boxes, a view inside the view its content sits in, each named with the state that fills it. An empty view is a dashed box tagged `Empty`, and a view a state off the active path still fills, as a sticky state does, is dashed and tagged `Inactive`. View configs no `ui-view` took are listed under the boxes. Selecting a view shows its path, renderer type, creating state, filling state, declaration, target and component; a state there opens the Outline with it selected. Its code and styles load on first use of the view, or of the nested Map once a views snapshot is recorded.

The nested Map draws the same boxes beside the states wherever the views fit at their natural size and the states at some rung of the fit ladder: the states step down to `small` type before the views are left out, and each drawing is centred in its own side, with no column kept for the inspector popover, which takes the dock's end where the drawings leave it free and otherwise stands beside the selection. `View map` in the panel header hides or shows them, and the choice is remembered per viewer; where the dock has no room it maximises the panel, and on a zoomed Map it fits it. There the panel's own inspector shows a selected view, one selection at a time: a selected state marks the views it fills, and a selected view marks the state that fills it and the one whose content created it. The rules, the data and what other renderers would need are in [the view map](../../docs/visualizer-proposal/views.md).

The view data comes from `@uirouter/core` alone and works for any renderer; finding a view on the page needs the renderer, through an optional `ViewLocator` the panel calls when one is set:

| Member            | Effect                                                                        |
| ----------------- | ----------------------------------------------------------------------------- |
| `highlight(view)` | Marks the view's place on the page while the views point at it; `null` clears |
| `describe(view)`  | Optional: where the page shows the view, in words, for the details            |

`litViewLocator` from `ui-router-devtools/lit-ui-router` is the `lit-ui-router` one: it matches `<ui-view>` elements by router and path through open shadow roots and outlines the one in focus. It imports neither `lit-ui-router` nor `lit`.

```ts
import { UIRouter } from '@uirouter/core';
import { DevtoolsPlugin } from 'ui-router-devtools/plugin';
import { litViewLocator } from 'ui-router-devtools/lit-ui-router';

declare const router: UIRouter;

router.plugin(DevtoolsPlugin, { viewLocator: litViewLocator });
```

`viewTree(views)` nests a views snapshot by path, for exporters as well as the panel.

## Entry points

| Subpath                 | Contents                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`                     | `observe` (the adapter), `record` (a ring-buffered recorder), `observedEdges`, `viewTree`, `SCHEMA_VERSION`, the event, session and span types, and `ViewLocator` |
| `./define`              | Registers `<ui-router-devtools>`; set its `router` property                                                                                                       |
| `./plugin`              | `DevtoolsPlugin`, for `router.plugin(DevtoolsPlugin)`; it appends the element to `document.body`                                                                  |
| `./performance`         | `reportToPerformance(events \| recorder)`: User Timing track entries for the Performance panel                                                                    |
| `./console`             | `reportToConsole(events \| recorder)`: one collapsed group per settled transition                                                                                 |
| `./testing`             | `transitions(session \| recorder)`, a snapshot-stable log, and `settled(recorder)`                                                                                |
| `./lit-ui-router`       | `litViewLocator(router)`: finds and outlines a `<ui-view>` for the Views                                                                                          |
| `./session.schema.json` | The session file's JSON Schema                                                                                                                                    |

`lit` and `valibot` are dependencies and `@uirouter/core` the only peer; `valibot` reads an imported session file, in a chunk the panel loads on first import. The adapter and its event schema live in private shared source, [`@repo/router-events`](../shared/router-events/), which the build inlines into `dist/shared/`; [`ui-router-otel`](../ui-router-otel/README.md) carries its own copy. The adapter reads only public hooks, with three exceptions, each isolated in its own module: `options().source`, typed `@internal` in core, tells a URL sync from a `go()` (`transition-source.ts`); the opt-in `timeResolves` option wraps each transition's `resolveFn` copies to time resolves (`resolve-timing.ts`); and the `views` option, which `record` turns on, reads the registered `ui-view`s through `viewService._pluginapi`, also typed `@internal`, after each sync (`views.ts`). `timeResolves` is off by default, because core has no resolve notification and the wrapper patches core objects.

```ts
import { UIRouter } from '@uirouter/core';
import { DevtoolsPlugin } from 'ui-router-devtools/plugin';
import { reportToPerformance } from 'ui-router-devtools/performance';

declare const router: UIRouter;

const { element } = router.plugin(DevtoolsPlugin, { timeResolves: true });
if (element.recorder) reportToPerformance(element.recorder);
```

## Session files and redaction

`recorder.session()` and the panel's Export button write a session file: an envelope (`format: 'ui-router-session'`, `v`, a session `id`, the `generator`'s name and version, `routerId`, `timeOrigin`, the event clock `t` at export, the count of `dropped` events, `timeResolves` and the `redaction` applied) around the latest config, states, current and views snapshots and the recorded events. The `id` names the recording, not the file: every export of one recorder carries the same `id`, and `(id, seq)` identifies an event across them. The types are `Session` and `RouterEvent` in [`src/schema.ts`](src/schema.ts); [`./session.schema.json`](src/session-schema.ts) describes the file for other tools.

A session file from a panel that was given spans also holds them, in an optional `spans` field: the spans that overlap any of its transitions, with epoch times. An export keeps a span's name, ids, times and status, and scrubs its attributes by the `params` field below: with `'all'` every value stays; otherwise the router's own `uirouter.*` attributes stay, a `uirouter.param.<key>` stays when `params` lists the key, and every other attribute keeps its key with `[redacted]` for its value, since span attributes carry URLs and query strings. A file without spans has no field.

The views snapshot is a `views` event: per `ui-view` its id, name, path, renderer type, creating state and what fills it, and the active view configs no view took. It names states and views only, so a redaction leaves it as it is. A file recorded without views imports as before, and its Views say so.

A recorder's ring buffer drops whole transitions, oldest first, and counts the events it dropped in `dropped`; the panel notes them at the end of the log and in the router card. The panel's Import reads a file through the same schema: it refuses a file that is not a session, and skips and counts events of a type it does not know and spans that do not read.

An export is scrubbed by a `Redaction`, the model `ui-router-otel` shares:

| Field      | Default | Effect                                                                                                           |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `params`   | `[]`    | The param keys whose values are kept, or `'all'`. Every other key stays, with `[redacted]` in place of its value |
| `messages` | `true`  | Whether the free-text `message` of a result or resolve is kept; `invalidParams` and `errorName` stay either way  |

`DevtoolsPlugin`'s `redaction` option and the element's `redaction` property set the defaults, and the router card's Export toggles, Param values and Messages, change them for the page. Re-exporting an imported session keeps the file's `id`, `generator` and `routerId`, since it is still that recording, applies the redaction on top of what the file already scrubbed, and records the stricter of the two: the keys both keep, and messages only if both keep them. The live panel and the reporters see every value; only a session leaving the page is scrubbed. [`ui-router-otel`](../ui-router-otel/README.md#options) takes the same `redaction` shape but omits an unlisted param from its spans instead of redacting its value.

## Schema and compatibility

The event schema and the session file are versioned together by `v`, which is `1`. Within v1, a new optional field, a new event type or a new value of an open enum does not bump `v`, so a reader must ignore fields and event types it does not know and tolerate open-enum values it does not know; the panel does. Only a breaking change, such as a removed or renamed field or a changed meaning, bumps `v`. The session file carries no `$id`; `format` identifies it.

Unqualified event `type` values and top-level field names, of the envelope and of each event, belong to this schema. A third party that adds its own namespaces them with a prefix and a colon, such as a `sticky-states:inactivate` event type or a `sticky-states:inactive` field, so a later v1 cannot collide with them.

| Enum                  | Values                                                                          | An unknown value                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PhaseEvent.phase`    | `before`, `start`, `exit`, `retain`, `enter`, `finish`, `success`, `error`      | Open. Kept by its own name: the log, the Performance reporter and `ui-router-otel` show it as written, and pair its start and end only with each other |
| `ResultEvent.outcome` | `success`, `error`, `redirected`, `superseded`, `aborted`, `ignored`, `invalid` | Open. Reads as `aborted`                                                                                                                               |
| `options.source`      | `sref`, `url`, `redirect`, `otherwise`, `unknown`                               | Open. Reads as `unknown`                                                                                                                               |
| `location.kind`       | `hash`, `pushState`, `memory`, `other`                                          | Open. Reads as `other`                                                                                                                                 |
| `PhaseEvent.edge`     | `start`, `end`                                                                  | Closed: a phase is a pair of edges, and a reader cannot pair a third kind. The event is skipped and counted                                            |
| `options.location`    | `true`, `false`, `replace`                                                      | Closed: it mirrors core's `TransitionOptions.location`. The event is skipped and counted                                                               |
| `redaction.params`    | a list of keys, or `all`                                                        | Closed: a reader that does not know what a mode scrubbed cannot say what the file holds. The file is refused                                           |

The published JSON Schema writes an open enum as `anyOf` of the known values and any string.

## Demo

```sh
pnpm -C packages/ui-router-devtools dev --port 5391 --strictPort
```

Open `http://localhost:5391/?demo=1` to play a fixed sequence: a success, a param change, a redirect, a superseded transition, two ignored, an error, a URL change, `location: 'replace'`, `reload: true`, an invalid target and a transition with an invalid param value. `?perf=1` and `?console=1` turn on the two reporters. The demo opts into `timeResolves`. `?spans` sends the panel spans as an instrumented app would: a router span per transition and a fetch span per resolve, the `stars` fetch under a resolve span as `ui-router-otel`'s `activateResolveSpans` sends it, and the others in traces of their own, for the Timeline. `?stress=1` registers a 60-state tree instead, six levels deep with 20 top-level siblings and a 40-character segment, to exercise the nested Map's fit ladder.

The demo fakes what a real app would supply:

- States have no components; the page renders a stub line on success, and registers no `ui-view`, so the Views have nothing to draw. The sample apps show them.
- Resolves are `setTimeout` stubs (40 to 200 ms), and with `?spans` their fetch spans are made up too. `galaxy.blackhole` (a rejecting resolve), `mission` (an abstract state) and `admin.**` (a lazy future state) exist only here.
- `galaxy.stars` declares `dsr` and `sticky` to show their marks; neither plugin is loaded, so the properties do nothing.
- Inspector subsections for hooks and views are not built.

Two scripts work against the running demo: `pnpm shots` writes the proposal screenshots into `docs/visualizer-proposal/screenshots/` and runs axe on the open panel (`--port`, `--out`, `--only <prefix>`, `--scale`), and `pnpm size` reports min and gzip sizes per entry and per chunk with `lit` and `@uirouter/core` external: `with` chunks load with the entry and `lazy` ones on demand.

## Known limits

- An app `onInvalid` handler registered after the devtools that rescues a target still leaves an `invalid` row: callbacks run in registration order and the adapter cannot see the outcome.
- RTL mirrors the rails, map edges and selection bar; Latin text inside rows is not bidi-isolated.
- In the dock the nested Map keeps a column free at its end for the inspector popover whenever the diagram leaves room for one, so a selection moves nothing. When it does not, the popover takes the place that covers least: never the selected box when any place clears it, then edges and the boxes they end at, then pills. The maximised panel shows the inspector below the diagram.
- Selecting a transition whose states sit inside a collapsed compound opens it, which re-packs the diagram.
- The wheel zooms the Map only with Control or Command held, so the page scrolls as usual; without a modifier it pans a Map that overflows.
- An edge's sides are chosen before it is routed, so one that has to go round a third box can take a bend more than it needs; [map.md](../../docs/visualizer-proposal/map.md#edge-routing) lists what still reads poorly.
- Maximised, edges and arrowheads keep their dock weight beside the larger type.
- The transition strip and the log name states in ink; identity colour is on the Map, the Outline, the tree and the inspector.
- The Views show the latest views snapshot, not a history, and have no fit ladder, zoom or pan: a tree larger than the panel scrolls.
- Beside the Map the views do not take a transition's status colours, since the snapshot holds the latest views only; the configs no view took are listed in the Views tab alone. A zoomed Map gives the states the whole room.
- `litViewLocator` matches an element by path, since `<ui-view>`'s registration id is not public; of two views with one path it outlines the first.

# ui-router-devtools

Devtools for any [UI-Router](https://ui-router.github.io) `@uirouter/core` router: a recorder of versioned, JSON-safe transition events, a Lit panel that shows the state tree and the transition log, and reporters for the browser's Performance panel and console.

The outline marks what a declaration says about a state: a box in place of the ring for `abstract`, a dot and arrow for `redirectTo` (drawn on the rail into a default child), a circled H for `dsr` or `deepStateRedirect` from `@uirouter/dsr`, and a box split by a dashed line for `sticky` from `@uirouter/sticky-states`. The inspector names each in words.

The Map tab draws the state tree two ways, chosen in the panel header and remembered per viewer: nested boxes, child states inside their parent, and a node-link tree. The nested layout keeps every box at its natural size, composes them for the panel's shape and steps down a fit ladder when the tree is too large; under 560px of width, or when nothing on the ladder fits, the tree shows. No edge is drawn at rest: selecting a transition draws its edge, and selecting a state draws the traffic it has seen. Boxes move to their new places when the layout changes, and edges draw in after them; under reduced motion nothing moves. The Map's code loads on first use of the tab. The rules are in [the nested Map](../../docs/visualizer-proposal/map.md).

A state has one colour wherever it appears: its box on the Map, its glyph and rail in the Outline, its node in the tree and its name in the inspector. The colour follows the state's depth in the tree, from a cycle of four, `--uird-depth-1` to `--uird-depth-4`. While a transition is selected, previewed or running, those colours recede and `--uird-active` and `--uird-exit` mark what it enters, retains and exits. Set the four depth tokens to one value for a monochrome panel.

`observedEdges(session)` folds a recorded session into one edge per ordered pair of states, with its count and outcomes, for exporters as well as the Map.

The package is private and unpublished, so it is workspace-only for now. The design, the screenshots and the open decisions are in the [router visualizer proposal](../../docs/visualizer-proposal/README.md) and its [devtools scope](../../docs/visualizer-proposal/devtools.md).

## Entry points

| Subpath                 | Contents                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `.`                     | `observe` (the adapter), `record` (a ring-buffered recorder), `observedEdges`, `SCHEMA_VERSION` and the event and session types |
| `./define`              | Registers `<ui-router-devtools>`; set its `router` property                                                                     |
| `./plugin`              | `DevtoolsPlugin`, for `router.plugin(DevtoolsPlugin)`; it appends the element to `document.body`                                |
| `./performance`         | `reportToPerformance(events \| recorder)`: User Timing track entries for the Performance panel                                  |
| `./console`             | `reportToConsole(events \| recorder)`: one collapsed group per settled transition                                               |
| `./testing`             | `transitions(session \| recorder)`, a snapshot-stable log, and `settled(recorder)`                                              |
| `./session.schema.json` | The session file's JSON Schema                                                                                                  |

`lit` and `valibot` are dependencies and `@uirouter/core` the only peer; `valibot` reads an imported session file, in a chunk the panel loads on first import. The adapter and its event schema live in private shared source, [`@repo/router-events`](../shared/router-events/), which the build inlines into `dist/shared/`; [`ui-router-otel`](../ui-router-otel/README.md) carries its own copy. The adapter reads only public hooks, with two exceptions, each isolated in its own module: `options().source`, typed `@internal` in core, tells a URL sync from a `go()` (`transition-source.ts`), and the opt-in `timeResolves` option wraps each transition's `resolveFn` copies to time resolves (`resolve-timing.ts`). `timeResolves` is off by default, because core has no resolve notification and the wrapper patches core objects.

```ts
import { UIRouter } from '@uirouter/core';
import { DevtoolsPlugin } from 'ui-router-devtools/plugin';
import { reportToPerformance } from 'ui-router-devtools/performance';

declare const router: UIRouter;

const { element } = router.plugin(DevtoolsPlugin, { timeResolves: true });
if (element.recorder) reportToPerformance(element.recorder);
```

## Session files and redaction

`recorder.session()` and the panel's Export button write a session file: an envelope (`format: 'ui-router-session'`, `v`, a session `id`, the `generator`'s name and version, `routerId`, `timeOrigin`, the event clock `t` at export, the count of `dropped` events, `timeResolves` and the `redaction` applied) around the latest config, states and current snapshots and the recorded events. The `id` names the recording, not the file: every export of one recorder carries the same `id`, and `(id, seq)` identifies an event across them. The types are `Session` and `RouterEvent` in [`src/schema.ts`](src/schema.ts); [`./session.schema.json`](src/session-schema.ts) describes the file for other tools.

A recorder's ring buffer drops whole transitions, oldest first, and counts the events it dropped in `dropped`; the panel notes them at the end of the log and in the router card. The panel's Import reads a file through the same schema: it refuses a file that is not a session, and skips and counts events of a type it does not know.

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

Open `http://localhost:5391/?demo=1` to play a fixed sequence: a success, a param change, a redirect, a superseded transition, two ignored, an error, a URL change, `location: 'replace'`, `reload: true`, an invalid target and a transition with an invalid param value. `?perf=1` and `?console=1` turn on the two reporters. The demo opts into `timeResolves`. `?stress=1` registers a 60-state tree instead, six levels deep with 20 top-level siblings and a 40-character segment, to exercise the nested Map's fit ladder.

The demo fakes what a real app would supply:

- States have no components; the page renders a stub line on success.
- Resolves are `setTimeout` stubs (40 to 200 ms). `galaxy.blackhole` (a rejecting resolve), `mission` (an abstract state) and `admin.**` (a lazy future state) exist only here.
- `galaxy.stars` declares `dsr` and `sticky` to show their marks; neither plugin is loaded, so the properties do nothing.
- Inspector subsections for hooks and views are not built.

Two scripts work against the running demo: `pnpm shots` writes the proposal screenshots into `docs/visualizer-proposal/screenshots/` and runs axe on the open panel (`--port`, `--out`, `--only <prefix>`, `--scale`), and `pnpm size` reports min and gzip sizes per entry and per chunk with `lit` and `@uirouter/core` external: `with` chunks load with the entry and `lazy` ones on demand.

## Known limits

- An app `onInvalid` handler registered after the devtools that rescues a target still leaves an `invalid` row: callbacks run in registration order and the adapter cannot see the outcome.
- RTL mirrors the rails, map edges and selection bar; Latin text inside rows is not bidi-isolated.
- In the dock the nested Map keeps a column free at its end for the inspector popover whenever the diagram leaves room for one, so a selection moves nothing. When it does not, the popover takes the place that covers least: never the selected box when any place clears it, then edges and the boxes they end at, then pills. The maximised panel shows the inspector below the diagram.
- Selecting a transition whose states sit inside a collapsed compound opens it, which re-packs the diagram.
- A leaf with four or more edges is crowded, and an edge between a compound and its own child is a short stub to the compound's border; [map.md](../../docs/visualizer-proposal/map.md#edge-routing) records what a fix needs.
- Maximised, edges and arrowheads keep their dock weight beside the larger type.
- The transition strip and the log name states in ink; identity colour is on the Map, the Outline, the tree and the inspector.

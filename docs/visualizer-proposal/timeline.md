# The Timeline

The Timeline view draws one transition as a waterfall: the transition as the
top bar, its phases and resolves as bars under it on a shared time axis, and,
when the app gives the panel spans from a tracer, the spans that ran during it.
This page records the rules it follows and how a span is joined to a
transition. The [proposal](README.md) holds the design direction, and
[the nested Map](map.md) the other drawing in the panel.

## Rules

- **One transition, and its redirect chain.** The Timeline shows the
  transition in focus: the one selected, previewed from the strip or the log,
  or running. With none in focus it shows the latest that core did not ignore.
  A redirect is drawn with its chain, from the first transition to the last,
  each a top bar of its own on the one axis. An invalid target ran no
  transition and has no waterfall; the Timeline says so.
- **The session is enough.** Phases, resolves and their times come from the
  recorded events, live or imported. Spans are an addition. A panel that is
  never given a span draws nothing about spans: no flag, no empty section.
- **Durations are text.** Every row has its start, from the axis's zero, and
  its duration in the mono face with tabular figures. A bar is a picture of
  those two numbers and never the only place they are. Under a tenth of a
  millisecond a duration reads `<0.1 ms`.
- **The axis is linear.** It runs from the earliest bar to the latest, with
  gridlines at a step of 1, 2, 2.5 or 5 of a power of ten, at most five of
  them. A sub-millisecond phase beside a 200ms resolve is a 2px mark with its
  own number beside it. A logarithmic axis was weighed: it makes short bars
  visible and makes every bar's length lie about its share of the transition.
- **What a bar cannot say is a tag.** A phase still open when its transition
  settled is `cut short` and ends with it. A resolve whose value was already
  there is `cached`, with no bar. Without `timeResolves` the entering states'
  declared resolves are listed `untimed`, with no bar, because they ran and
  nothing timed them. A redirected transition is `redirected to 007`, a
  superseded one `superseded by 008` when the recorder knows which, and a
  running bar is `running` and grows with the clock.
- **Red means fault.** A failed resolve, the `error` phase and a span with an
  error status are red. A failed transition keeps its outline, with a red
  border and a faint red wash, so the fill is left to the part that failed.
- **Colour says what the transition does.** The Timeline always has a
  transition in focus, so its colours are the panel's status hues: enter and
  retain phases and resolves in `--uird-active`, exit phases in `--uird-exit`,
  transition-wide phases in the neutral rule. A transition the router replaced
  or stopped, redirected, superseded, aborted or ignored, is a dashed outline
  with no fill.
- **Overlap is not belonging.** A span the panel only knows ran during the
  transition is a dashed outline tagged `during`, never a fill. See
  [Joining a span](#joining-a-span).

## Layout

Each row is one grid: the name, the track, the start and the duration.

| Column   | Size                                     |
| -------- | ---------------------------------------- |
| Name     | 32% of the row, from 176px to 320px      |
| Track    | what is left                             |
| Start    | 48px, `+12.3` from the axis's zero       |
| Duration | 64px                                     |
| Indent   | 16px a level, inside the name column     |
| Row      | 24px, 32px under a coarse pointer        |
| Bar      | 6px; the transition 12px, a `during` 8px |

The axis row stays at the top of the waterfall as it scrolls, and its
gridlines run down every row's track. A bar is placed by two custom
properties, its start and its width as fractions of the track, so a resize
moves nothing but the browser's layout.

Below 480px of its own width the name column takes 40% of the row, the start
column goes, and every other gridline label with it; the start stays in each
item's name and in the details. A tag gives way before the name it follows.

In the dock the Timeline owns the panel, as the Map does: the log is the strip
of outcome glyphs below it. The inspector is not shown in the dock; selecting
a bar shows that bar's details beside the waterfall, in a 296px column once the
Timeline is 720px wide and below it otherwise. The maximised panel puts the
Timeline above the full log and inspector. On the sheets it takes the
Outline's place above the log at a fixed 40% of the viewport's height, so a
transition previewed from the log, which redraws the Timeline, never moves the
log under the pointer; a bar's details then take the lower two fifths of it.

## Joining a span

The panel takes spans through its `spans` property and `addSpan` method, in a
shape that names no tracing library: trace and span ids, the parent's span id,
a name, epoch start and end times, a status and a plain record of attributes.
`ui-router-otel`'s `DevtoolsSpanProcessor` sends every span a tracer provider
ends, and each one it starts, so a running fetch grows on the Timeline.

A span is joined to a transition in one of three ways, and the Timeline says
which:

| Relation | When                                                                                  | Drawn                           |
| -------- | ------------------------------------------------------------------------------------- | ------------------------------- |
| child    | it descends from the router's own span for the transition, or a phase or resolve span | nested, filled, no tag          |
| trace    | it shares a trace with the router's span for the transition and overlaps it in time   | nested, filled, tagged in trace |
| during   | it only overlaps the transition, or its redirect chain, in time                       | nested, dashed, tagged during   |

The router's own spans are found among the spans the panel is given, so they
reach it only when the `DevtoolsSpanProcessor` sits on the provider that the
`OtelPlugin`'s tracer comes from. They are used to join and are not drawn: the
session already holds what they say.

### The router's span for a transition

`uirouter.transition_id` is core's `Transition.$id`, unique per router and
counted from 0. Two routers on a page, or a router created again after a
session restarted, reuse ids. The panel takes the router's span for a
transition to be the one whose `uirouter.transition_id`, `uirouter.from` and
`uirouter.to` match the recorded transition and whose start is within 2ms of
the recorded start. The recorder and the reporter each read the clock in their
own `onBefore` hook in the same synchronous pass, so the two starts differ by
microseconds; another router's transition with the same id between the same
states inside those 2ms is the one case this cannot tell apart, and then
neither span is used and the spans fall back to `during`.

A router or session id on the spans was weighed. The reporter and the
recorder are separate packages with their own copy of the adapter, and core
has no public router id: `UIRouter.$id` is internal. Sharing one would take a
global registry on the page or a new option both sides are given; the ends
and the start already tell the transitions apart.

Stamping trace and span ids into the session's events was weighed as well. The
recorder does not start spans and cannot know their ids without depending on
the tracer, and the events would then name one tracing library. The event
schema and the envelope's existing fields are unchanged.

### Why `during` is common

`ui-router-otel` starts its spans with the context that was active when the
transition started, and does not make its own span active while hooks and
resolves run. A fetch started in a resolve is therefore never a child of the
transition's span, even under a context manager that follows async work: it is
a child of whatever span was active, or the root of a trace of its own. With
`@opentelemetry/context-zone` and a span around the user's click, the
transition and the fetch share that click's trace and the fetch is `in trace`.
Without one, the fetch is its own trace and only `during`.

A `during` span is drawn under the transition of the chain that was the latest
to start before it, and a span that overlaps two separate transitions, such as
a superseded one and its superseder, is drawn under each when each is shown. A
child of another transition's router span is that transition's and is never
drawn as `during` here.

## Session files

A session file keeps the spans that overlap any of its transitions, in an
optional `spans` field, so the file's `v` stays 1 and a reader without it
ignores the field. The router's own spans go with them, so an imported file
joins its spans as the live panel did. A file without spans has no field.

Span attributes can carry URLs, query strings and user data, so an export
scrubs them by the same `Redaction`:

- With `params: 'all'`, every attribute value is kept.
- Otherwise the router's own `uirouter.*` attributes, which name states and
  ids, are kept, a `uirouter.param.<key>` is kept when `params` lists `<key>`,
  and every other attribute keeps its key with `[redacted]` for its value.
- Names, ids, times and the status code are kept. A span carries no status
  message. Span names are kept on the conventions' word that a name holds no
  URL or id; an app that names spans after URLs should export with
  `params: []` and check its names.

The panel's Import reads spans one by one and skips and counts one that does
not read, as it does events.

## Accessibility

The waterfall is a `tree`, labelled by the pane's heading, with one
`treeitem` per bar and `aria-level`, `aria-setsize`, `aria-posinset` and, on a
bar with children, `aria-expanded`. An item's name says it all: the
transition's number and outcome, the bar's name, when it started, how long it
took or has been running, and its tags, such as
`resolve stars, at 1.3 ms, took 181 ms` or `GET /api/star, at 191 ms, took
43 ms, during`. The tracks and the axis are hidden from assistive technology.

The keys are the Outline's: up and down move in tree order, Home and End to
the first and last item, right opens a closed item or moves into an open one,
left closes an open item or moves to its parent. Enter and Space select the
item and show its details, and Escape hides them. One item is a tab stop.

The details are a region named for the bar, with its kind, state, start,
duration, how it was joined and, for a span, its status, trace and span ids
and attributes, all as text.

## Loading

The waterfall, its join and its styles are one module,
`src/element/timeline.ts`, that the panel imports on first use of the
Timeline view and whose styles it adopts then. A panel that never shows the
Timeline does not load it. The join and the layout are
`src/element/waterfall.ts`: a transition and spans in, bars out, with no DOM.

## Not covered

- The router's span is never made active while its hooks and resolves run, so
  `child` needs an app that parents its spans to the router's by hand.
- A transition's spans are not shown on the Map or in the log.
- A server's spans for the same request are not fetched; only what reaches the
  page's tracer provider is drawn.

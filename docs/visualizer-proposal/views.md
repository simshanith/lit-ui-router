# The view map

The Views tab draws the router's `ui-view`s: which exist, how they nest, what
each is called, which state's content created it and what fills it. It draws
them as the nested Map draws states, a box per view with the views registered
inside it drawn inside its box, and the Map draws the view path of a state
under it. This page records what it shows, the data it
reads and where the line falls between the part that serves any UI-Router
renderer and the part that needs `lit-ui-router`. The [proposal](README.md)
holds the design direction, and [the nested Map](map.md) the box rules it
borrows.

## What it shows

- **A box per registered view.** Its header names the view, then the state
  that fills it. A view's name is `$default` when it has none, so a name that
  repeats in the tree is written as its full path, its `fqn`, instead.
- **Nesting from the fqn.** A view sits inside the view its `fqn` names
  without its last segment: `$default.mymessages.messagelist` inside
  `$default.mymessages`. When two views share that fqn, the one filled by the
  state the inner view was created in holds it. A view whose enclosing view is
  not registered is drawn at the top.
- **Identity colour.** A filled view takes the colour of the state that fills
  it, on its border and on the state's name, as that state has everywhere else
  in the panel.
- **Empty.** A view nothing fills is a dashed box in the neutral rule, tagged
  `Empty`.
- **Inactive.** A view filled by a state off the active path, as a sticky
  state leaves its views, keeps the state's colour with a dashed border, a
  muted name and an `Inactive` tag.
- **Configs no view took.** A view config that is active but that no `ui-view`
  matched is listed under the boxes, under _No view took_, with the state that
  declared it and its target: `contacts views.side → side@`. Its content is
  nowhere on the page, which is a common reason a view stays blank.
- **Details.** Selecting a view shows its path, its renderer type, the state
  it was created in, the state that fills it, the key that state declared it
  under, its target as `name@anchor` and the component's name. A state in the
  details is a link that opens the Outline with that state selected and
  focused.

The Views draw the latest snapshot: the live router's, or the one an imported
session ends with. They are not a history; the Timeline and the log hold that.

## Layout

The boxes are packed by the nested Map's packer, `pack.ts`, at the Map's dock
step, with a leaf up to 320px wide so a view's name and its state fit one
header. They keep that size: the Views have no fit ladder, zoom or pan, and a
tree larger than its room scrolls. The header, border, selection ring and
focus ring are the Map's. Names and states are set in the mono face; the
`Empty` and `Inactive` tags in the panel's caption type.

In the dock the Views own the panel, as the Timeline does: the log is the
strip of outcome glyphs below them and the inspector is not shown. A selected
view's details stand in a 296px column beside the boxes once the Views are
720px wide, and below them otherwise. Maximised, the Views sit above the full
log and inspector.

The boxes are packed for the room they are drawn in: the Views' area less its
padding, the details' column or row, and the list of configs no view took,
which keeps to the room's foot. The drawing is placed as the Map's fitted view
is, by the same `fitView`: in the middle of the room on an axis it fits, and at
the start of an axis it overflows, so scrolling reaches all of it. The offset
is in whole pixels, set as logical margins so it mirrors in a right-to-left
panel, and nothing is scaled or animated, under reduced motion or not.

Where the details will stand beside the boxes, the boxes are packed for the
room the details leave, and the drawing is placed in the whole room as it is
before any view is selected: in its middle while the details' column stays
free either side, else as near the middle as keeps that column free, as the
Map keeps its inspector's column. Selecting a view moves nothing. Where they
open below, there is no row to keep: selecting a view shortens the room, and
the drawing moves up to the middle of what is left, at once.

## The view path

Under the Map, nested or node-link, one row shows the view path of the
selected state, else of the active state: the views the state fills, inside
the views that hold them, in snapshot order. The Map keeps the rest of the
room; the row's height is taken from it before it is packed. The Views tab
stays as it is.

- **Items.** Each view is an item in the colour of the state that fills it,
  named as in the Views, with that state's name middle-truncated as the Views
  truncate it. A view follows the view that holds it after `›`, and a second
  view the state fills follows the first after `+`. The row ends with the
  count of the snapshot's other views, which opens the Views tab.
- **Which state.** The selected state, else the state whose path a selected
  view was picked from, else the active state. A state on the active path that
  fills no view, one drawn into its parent's view, shows the path of the
  nearest ancestor that fills one, and the row says whose (`of mail.list`). A
  selected state that is not active usually fills no view in the snapshot,
  and the row says so. A sticky state keeps its views filled after it is
  left, so the row draws its path with `Inactive` tags.
- **Long and deep paths.** The row scrolls along its length. Truncating it
  instead would drop the views in the middle, which are the point of a path;
  the state names in it are truncated as everywhere in the Views, with the
  full name in the item's title.
- **The sheet and the tabs.** Below 880px of viewport the same items stack as
  nested boxes, each view's box inside the box of the view that holds it,
  under the node-link tree.
- **Toggle.** `View path`, beside the Map's layout buttons, hides or shows the
  row. It is on unless the viewer turns it off, and the choice is kept in
  `localStorage` (`ui-router-devtools:map-views`) as the layout choice is. It
  is pressed while the row is on, including while its module loads, so a press
  always turns it off. If the view map's module fails to load
  while the row is on, it is disabled and its title says so; with the row off,
  turning it on tries the load again. It is not shown for a session that holds
  no views, which includes a views snapshot with no view in it.
- **Keys.** The row is a toolbar and one tab stop. The arrow keys step through
  its items in order, the inline ones mirrored in a right-to-left panel, Home
  and End go to either end, and Enter or Space selects. The tab stop is the
  item last focused, else the selected view, else the state's own view.
- **One inspector.** The row has no details of its own. A selected view is
  shown in the panel's inspector, the popover in the dock and the pane in the
  maximised panel, with the details listed above; a state there selects that
  state on the Map. The popover is placed beside the selected item, off the
  row's other items, by the rule the Map's popover uses when it has no column.
  A view, a state and a transition are one selection: each takes the place of
  the others, and every way of clearing a selection, Escape included, clears
  a view. A view is inspected only while the row is drawn: when the toggle or
  another tab takes the row away, the inspection and the page's outline go
  with it. The Views tab keeps the view selected for its own details.
- **Marks.** A selected view marks the state that fills it and the state whose
  content created it: in the nested layout on the box that draws it or the
  collapsed compound that holds it, in the node-link tree on its node. A mark
  is the selection's ring, dashed, so it reads without colour; forced colours
  draw it in `Highlight` at 2px. A marked state's
  description says how it is tied: `fills the selected view` or `created the
  selected view`. The selected item carries the selection's ring, which
  forced colours draw as a `Highlight` outline.
- **Page outline.** Pointing at or selecting an item calls the same
  `ViewLocator` as the Views tab.

A selected transition does not recolour the views. The snapshot is the
latest one, so the views a past transition entered or emptied are not in it;
marking them needs a views snapshot per transition, kept with the
transition's events.

## The data

The adapter reads core's view service, through `viewService._pluginapi`, in
one module of the shared adapter, `views.ts`. Core types `_pluginapi`
`@internal`; it is the only source of the registered views and the active
view configs, and the module reads it without changing it.

- `_onSync(listener)` is called after every `sync()`: when a view registers,
  and after a transition activates and deactivates view configs. Its argument
  pairs each registered view with the config that fills it, or none, and lists
  the active configs no view took. A view's deregistration is not followed by a
  sync, so the adapter reads the registry a microtask after each sync: a nested
  view its parent's update removed is gone by then.
- `_registeredUIViews()` and `_activeViewConfigs()` are read then; a view
  registered before the adapter started reports the config it holds, which
  counts only while that config is still active.

Each read becomes a `views` event, sent only when it differs from the last:

| Field             | Holds                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `views[].id`      | The renderer's id for the view, unique among a router's registered views                           |
| `views[].name`    | The view's name, `$default` when it has none                                                       |
| `views[].fqn`     | The names of the enclosing views and its own, outermost first, joined by dots                      |
| `views[].type`    | The renderer's view type: `lit`, `ng1`, `react`                                                    |
| `views[].context` | The state whose content created the view; `''` for the root                                        |
| `views[].fill`    | What fills it, or `null`: the declaring `state`, its `views` key, the `target` and the `component` |
| `unmatched`       | Active view configs no view took, in the shape of `fill`                                           |

`target` is the config's normalized `{ name, anchor }`. `component` is a
string component's value or a class's or function's own name; it is left out
when there is none. Nothing in the event is an element, a function or a
renderer object, so it is as JSON-safe as every other event.

`viewTree(views)`, exported from the package root, nests a snapshot by `fqn`
for any other reader.

## Session files

`views` is a new event type and a snapshot: the recorder keeps the latest
outside its ring buffer, beside `config`, `states` and `current`, and a session
file carries it among the snapshots before the recorded events. The file's `v`
stays 1, as the schema rules allow for a new event type. A file without one
imports as before, and the Views say the session holds no views. A reader that
predates the event skips it and counts it, as it does any event type it does
not know.

A snapshot per sync, not an event per change, keeps files small: one snapshot
replaces the last, and a change is the difference between two of them. A
history of views would need every snapshot in the ring buffer, which the panel
does not draw.

The event names states, views and components, which the `states` event and
the code already name. It carries no params and no free text, so a redaction
leaves it as it is.

`observe` sends `views` only with its `views` option; `record`, and so the
panel, turns it on unless told otherwise. `ui-router-otel` does not ask for it.

## The renderer's part

Everything above reads core alone. What needs the page goes through one
optional interface the panel calls when it is set, `ViewLocator`:

| Member            | Does                                                           |
| ----------------- | -------------------------------------------------------------- |
| `highlight(view)` | Marks the view's place on the page; `null` takes the mark away |
| `describe(view)`  | Optional: where the page shows the view, in words, or `null`   |

The panel marks the view under the pointer, else the selected one, while the
Views tab or the view path under the Map show the live router and the panel is
open. It never calls the locator
for an imported session, whose page is not this one. The details show
`describe`'s answer as _On page_.

`ui-router-devtools/lit-ui-router` exports `litViewLocator(router)`, for
`DevtoolsPlugin`'s `viewLocator` option or the element's `viewLocator`
property. It imports neither `lit-ui-router` nor `lit`, so the root entry and
the panel keep `@uirouter/core` as their only peer:

- It finds `<ui-view>` elements through the document and open shadow roots,
  keeps those whose public `uiRouter` is the router, and matches a view by
  `fqn`, which it builds as `<ui-view>` does: the `name` of each enclosing
  `<ui-view>`, through assigned slots and out of shadow roots to their hosts,
  stopping at a `<ui-router>`, which roots a tree of its own.
- It outlines the element with a fixed overlay in the system `Highlight`
  colour, following scrolls and resizes, under the panel's top layer. A view
  that is not displayed, such as an inactive sticky one hidden by the app, is
  not outlined, and `describe` says `not displayed`.
- `describe` names the element and the shadow host it sits in:
  `<ui-view name="list"> in <test-mail>`.

### Left out: the view's context

A view's Lit context, what `<ui-view>` provides to the elements under it and
the resolves its routed element receives, is not shown. `lit-ui-router` does
not expose what that needs:

- `UiView`'s `fqn`, `viewContext`, `state` and `uiViewData` are `@internal`,
  so an element is matched by rebuilding its `fqn` from the DOM rather than by
  the registration's id. A public `fqn`, or a public lookup from a router and a
  view id to the `<ui-view>`, would make the match exact when two views share
  an fqn.
- The resolve context a view hands its routed element is built inside
  `<ui-view>` from the private registration's config path. Showing it needs a
  public read of the view's `ResolveContext`, or of the `uiViewProps` it last
  gave its routed element.

## Other renderers

The data side is written against core's `ActiveUIView` and `ViewConfig` and
nothing else; `type` says which renderer registered a view.

- **Verified** with `lit-ui-router`, in the package's browser specs and the
  sample apps, and with a renderer of plain objects in the adapter's specs.
- **Not verified** with `@uirouter/angularjs` or `@uirouter/react`. Core's
  view service is the same for every renderer, so their views should read the
  same way, with these open questions:
  - The microtask wait suits a renderer that removes a nested view within a
    microtask of the sync. One that renders later can leave a removed view in
    a snapshot until the next sync.
  - A component declared by name, as AngularJS does, is recorded as written;
    one whose function has no name is left out.
- **A locator per renderer.** Each renderer needs a `ViewLocator` of its own,
  built on its own way from a registered view to the DOM node that shows it.
  The Lit one leans on `<ui-view>` being an element with a public `name` and
  `uiRouter`; a renderer whose view is a component with no element of its own
  needs something else.

## Accessibility

The boxes are a `tree`, labelled by the pane's heading, with one `treeitem`
per view, on its header, and `aria-level`, `aria-setsize` and
`aria-posinset`. A view with views inside it owns their `group` through
`aria-owns` and is `aria-expanded`. An item's name says what it is:
`messagelist view, filled by mymessages.messagelist`,
`messagecontent view, empty` or `contacts view, filled by contacts, inactive`.

The keys are the Outline's: up and down in tree order, Home and End, right
into a view's first nested view and left to the view around it. Enter and
Space select a view and show its details, and Escape hides them. One item is a
tab stop. The page outline is decoration and is hidden from assistive
technology; the details say where the view is in words.

The view path is a toolbar named for its state, `Views of mail.list`, and
each item is a button named as the Views name a view and pressed while it is
selected. The status region announces nothing for a selection there. In a
right-to-left panel the names stay isolated left to right, so a leading `$`
keeps its place.

Forced colours draw every border in `CanvasText` and the selection ring in
`Highlight`. Nothing in the Views moves, so reduced motion changes nothing but
the boxes' fade-in, which the Map's rule already keeps. Boxes are placed from
the inline start, so they mirror in a right-to-left panel.

## Loading

The view map, its layout, the view path under the Map and their styles are
one module, `src/element/viewmap.ts`, that the panel imports on first use of
the Views, or of the Map once a views snapshot is recorded, and whose styles
it adopts then. It shares the packer and `fitView` with the Map in a chunk of
its own, so neither chunk holds the other. A panel that never shows the Views
or the Map does not load it.

## Not covered

- No history: the Views show the latest snapshot only.
- No transition marks on the view path; see
  [The view path](#the-view-path).
- The configs no view took are listed in the Views tab only.
- No hydration or SSR detail: whether a view adopted a server-rendered element
  is `lit-ui-router-ssr`'s, and is not read.

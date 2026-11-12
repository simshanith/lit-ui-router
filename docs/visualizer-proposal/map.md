# The nested Map

The Map tab has two layouts. The node-link tree is the fallback. The nested
layout draws the state tree as statechart containment: a box per state, child
states inside their parent. This page records the prior art behind the nested
layout and the rules it follows. The [proposal](README.md) holds the design
direction, and [devtools scope](devtools.md) the package's wider plans.

## Rules

- **No edges at rest.** UI-Router declares no transitions, so every edge is an
  observed one. Selecting a transition draws its edge and, for a redirect, a
  dashed edge from its origin. Selecting a state draws its traffic in and out,
  one edge per pair of states, with line weight for the count.
- **The diagram owns the panel.** On the Map tab in the wide dock the
  transition log is a strip of outcome glyphs, and the inspector is a popover
  beside the diagram. The maximised panel gives the diagram three fifths of
  its height and shows the full log and inspector below it. On the sheets the
  Map takes the Outline's place above the log.
- **Boxes keep their natural size.** A leaf is its label and padding. A
  compound shrink-wraps its children. Nothing stretches to fill the viewport;
  the diagram sits in the room [left for it](#the-inspector-popover).
- **A selection moves nothing.** Selecting a state draws its edges and shows
  the inspector, and every box stays where it was, so nothing shifts under
  the pointer.
- **Colour is identity, until a transition is in focus.** See
  [Modes](#modes).
- **Red means fault.** A failed transition's edge and the state that failed
  are red, and no identity colour is near it.
- **Type is 12px in the dock.** The layout may shrink to the caption size and
  no further. The maximised panel is the one place it enlarges, in whole
  steps of the [spacing system](#spacing), never by a scale factor.

## Modes

The Map does not make one picture carry every encoding. Colour and arrows have
a different job in each mode, and `data-mode` on the panel names the mode.

| Mode                         | Colour                                                                                                                 | Arrows                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| At rest (`rest`)             | identity, on every border and glyph                                                                                    | none                                               |
| A state selected (`state`)   | identity, so the named boxes can be found                                                                              | the state's traffic, weighted by count             |
| A transition in focus (`tx`) | status: `--uird-active` on what it enters or retains, `--uird-exit` on what it exits, red on a fault; identity recedes | that transition's edge, and its redirect's, dashed |

A transition is in focus while it is selected, previewed from the strip or
running.

Weight, dash, wash and glyph say the rest, and they do not change with the
mode, so greyscale and forced colours read the same:

| Role               | Border              | Glyph            | Also             |
| ------------------ | ------------------- | ---------------- | ---------------- |
| Current            | 2px solid           | solid disc       | wash, weight 700 |
| Active ancestor    | 2px solid           | ring with a dot  |                  |
| Inactive           | 1px solid           | ring             |                  |
| Lazy               | 1px dashed          | dashed ring      | italic, `LAZY`   |
| Entering           | 2px solid           | plus in a ring   | wash on a leaf   |
| Retained           | 1px solid           | bars, or diamond |                  |
| Exiting            | 2px dashed          | minus in a ring  | muted name       |
| Errored            | 2px solid, red      | red square       | red name         |
| Selected           | 1px ink outline     |                  |                  |
| Collapsed compound | stacked second edge |                  | count of states  |

The layout has modes too, and each is designed on its own terms: nested boxes
or the node-link tree, the dock or the maximised panel, a compound open or
collapsed, and each rung of the [fit ladder](#when-it-does-not-fit).
[Motion](#motion) carries the eye between them.

### Identity

A state's colour follows its depth in the declared state tree, from a cycle of
four: `--uird-depth-1` to `--uird-depth-4`, then round again. The idea is an
editor's rainbow brackets: matching levels can be traced at a glance, and a
child never shares its parent's colour.

Depth is read from the declaration, not from the drawing. A merged header, a
collapsed compound and a change of rung alter what a box looks like and leave
its state's depth alone, so the colour does not flicker when the layout
changes. The same state has the same colour as a box on the Map, a glyph and
rail in the Outline, a node and link in the tree layout, the title glyph of
the inspector and the underline of its name wherever the inspector links to
it. The transition strip and the log stay ink: they describe transitions, and
a transition's colours are the status pair.

A colour per state or per branch was weighed and left out. Four to six hues
are all that stay distinct under the common colour-vision deficiencies, and
the stress tree has 20 top-level branches.

| Token            | Light                 | Dark                  | On surface, light and dark |
| ---------------- | --------------------- | --------------------- | -------------------------- |
| `--uird-depth-1` | `oklch(46% 0.19 275)` | `oklch(70% 0.15 275)` | 7.4, 6.7                   |
| `--uird-depth-2` | `oklch(57% 0.1 185)`  | `oklch(86% 0.12 185)` | 4.1, 12.7                  |
| `--uird-depth-3` | `oklch(64% 0.125 85)` | `oklch(82% 0.13 85)`  | 3.3, 10.5                  |
| `--uird-depth-4` | `oklch(46% 0.17 345)` | `oklch(68% 0.13 345)` | 7.6, 6.0                   |

The hues step by about 90 degrees and alternate dark and light, so two colours
that a deficiency brings close in hue still differ in lightness. The least
OKLab distance between any two of the four, under normal vision and simulated
protanopia, deuteranopia and tritanopia (Machado, 2009, full severity), is
0.10 in the light scheme and 0.12 in the dark. The least distance from
`--uird-red` is 0.10 and 0.07. Every border clears 3:1 on the surface and the
raised surface, and the receded mix of the `tx` mode clears 3.8:1.

In greyscale depth 1 and depth 4 are the same grey in the light scheme. Depth
is then read from containment alone, which the boxes draw anyway.

Setting the four tokens to one value gives a monochrome Map and Outline:

```css
ui-router-devtools {
  --uird-depth-1: var(--uird-rule-strong);
  --uird-depth-2: var(--uird-rule-strong);
  --uird-depth-3: var(--uird-rule-strong);
  --uird-depth-4: var(--uird-rule-strong);
}
```

## Layout

No surveyed tool fits its layout to the shape of its container. The XState
visualiser measures HTML nodes and hands them to `elkjs`; Mermaid scales the
whole drawing; KIELER collapses what is out of focus; itemis CREATE moves a
composite's contents to another diagram. A wrapping flex row fills one row
greedily, which leaves a wide dock half empty. Stretching boxes to fill the
dock gives bars for leaves and compounds that are mostly blank.

The packer places every box, and CSS only draws them:

1. Measure each leaf and header. The text widths come from a canvas, so
   packing needs no render.
2. Size each leaf to its label, between 56px and 208px, on the 4px grid.
3. Bottom-up, split each compound's children into contiguous rows in
   declaration order, trying every row count. Within a row, a run of short
   boxes beside a tall one stacks into as many rows as the tall one's height
   holds. Each split is scored on how far its width over height is from a
   target, the Map viewport's for the root and about 2 for inner compounds,
   plus one and a half times the share of its rows left empty. The root
   prefers a split that fits the viewport to a nearer one that does not.
4. A compound is its header, its rows and its padding, and no wider than the
   wider of the two needs.
5. If the root still does not fit, step down the ladder below. In the
   maximised panel, first step up it.
6. The diagram sits in the middle of the viewport at that size, or as near
   the middle as leaves [the popover's column](#the-inspector-popover) free.
   The room left over frames it; no box takes it.

The rule comes from ELK's `rectpacking`, which keeps input order, stacks short
boxes and aims for an aspect ratio. Area-weighted treemaps do not fit: they
have no minimum box size and no notion of a label's width.

The packer is `src/element/pack.ts` in the package: boxes in, placed boxes
out, with no DOM. Its specs hold the layout to four checks, for the sample
tree and the stress tree, in the dock (1230 by 256) and the maximised panel
(1230 by 372): no leaf is wider than its label needs or than the maximum; no
compound is wider than its header and rows need; in every compound the boxes
cover at least half of the rows' bounding box; and the diagram fits, with a
width over height between 0.6 and 1.6 times the viewport's. The two larger
steps are held to the second and third, for the sample tree.

### Spacing

Every distance is a multiple of the panel's 4px unit, and the gaps and padding
are multiples of its 12px module. `METRICS` in `pack.ts` holds the values.

| Distance                                     | Size        |
| -------------------------------------------- | ----------- |
| Leaf block size, and a compound's header row | 24px        |
| Leaf inline size                             | 56 to 208px |
| Padding inside a leaf, inline                | 8px         |
| Compound padding, inline and block           | 24px, 12px  |
| Between leaves in a row, and between rows    | 24px, 24px  |
| Between a compound and its neighbours        | 36px, 36px  |
| Outer margin, from the panel's padding       | 12px        |
| Box corner radius                            | 4px         |

A leaf and the gap beside it are the same 24px, so a block of leaves reads as
an even grid. A compound stands half as far again from its neighbours, so
groups read as groups. The block padding is 12px because the dock is 256px
tall and three levels of nesting must fit in it.

The edge router's margins come from the same numbers: a route keeps 6px from
any border, the middle of the narrowest gutter, and an end's lead is 12px, the
middle of a 24px one.

At the caption-size rung the header is 20px, the padding 16px and 8px, the
leaf gaps 16px and 12px, and the group gaps 24px and 16px.

The maximised panel has two larger steps, each the table above in proportion
to its type, still on the 4px grid:

| Step  | Type | Header | Compound padding | Leaf gaps | Group gaps | Leaf inline size |
| ----- | ---- | ------ | ---------------- | --------- | ---------- | ---------------- |
| Dock  | 12px | 24px   | 24px, 12px       | 24px      | 36px       | 56 to 208px      |
| Roomy | 16px | 32px   | 32px, 16px       | 32px      | 48px       | 76 to 276px      |
| Large | 20px | 40px   | 40px, 20px       | 40px      | 60px       | 92 to 348px      |

A header's glyphs, marks, padding and fold button grow by the same factor,
from one custom property on the diagram. Edge strokes, arrowheads and the
router's margins stay as they are in the dock.

A scale on the whole diagram was weighed against the steps. A scale fills any
viewport exactly, and gives type and borders at sizes that are on no grid; the
steps keep every distance a multiple of 4px and the type at three sizes. A
different target shape for the packer was also weighed: the root already aims
for the viewport's shape, and the sample trees are wider than the maximised
viewport is, so a taller target would give more rows of boxes that are still
the dock's size.

### When it does not fit

In the maximised panel the layout first tries the large step and then the
roomy one, with every compound open, and takes the first that fits with a
tenth of the viewport's width and height to spare. The dock never enlarges.

Otherwise the layout starts at the dock's step with every compound open and
stops at the first step that fits. Each step keeps the ones before it:

1. Collapse compounds off the active path to one box with a count of the
   states inside. A selected transition's states and the ancestors of a
   selected state stay open; the selected box itself stays as it is drawn.
   Opening or closing a box by hand overrides this for that box.
2. Merge a compound with its only visible child, when that child is also a
   compound, into one header.
3. Truncate a name segment longer than 24 characters in the middle. The full
   name stays in the accessible name and the `title`.
4. Shrink to the caption size.
5. Fall back to the node-link tree.

A milder step is restored only once it fits with about 10% of the inline size
to spare, so a resize does not flicker between layouts. A change to the tree,
or a selection that opens a compound, starts again from the top; a selection
that opens nothing keeps the layout it has. Below 560px of inline size the
nested layout is not offered: at that width it is the Outline with borders.

Re-rooting at the deepest compound on the active path, with its ancestors as a
breadcrumb, would sit before the fallback. It is left out: it needs a second
navigation model for the states outside the new root, and the stress tree (60
states, six levels, 20 top-level siblings) fits a 1256px dock without it.

A compound's header ends in a button that closes it, and a collapsed
compound's in one that opens it. A merged header has one, at its end, for the
box the header belongs to.

Pan, zoom and a minimap are left out.

### The inspector popover

The popover is 296px wide, and its column, with a 12px margin either side, is
320px. Whether the dock has that column to spare is decided by the diagram's
size, before anything is selected:

- **Room for a column either side:** the diagram is centred, and the popover
  takes the column at the end.
- **Room for one column:** the diagram sits as near the middle as leaves the
  column free at the end, so the room at its start shrinks first. The popover
  takes that column.
- **No room:** the diagram is centred and the popover goes over it. It tries
  beside the selected box, level with its top or its bottom, then the corners
  of the panel, then every 12px along the panel's top and bottom, and takes
  the place that covers least. The selected box counts a thousand times a
  pill, and a drawn edge or a box an edge ends at twenty times, so the
  selection is covered only when no place clears it.

In the first two the popover is always in the same place, at the end of the
dock, and neither a first selection nor a change of selection moves a box.
Reserving the column at every width was weighed and left out: the stress tree
needs the dock's whole width. So was a start-aligned diagram, which leaves
the same column free and reads as a document, not a drawing.

## Motion

A box changes place and size between modes, and the eye follows a state
through the change by its colour and its movement.

- **Boxes move and change size.** A re-pack on resize, a collapse or an
  expand, a change of rung and the switch between nested boxes and the tree
  all move the same states. Each state's element starts where and as large
  as the state was and eases to its new place and size in 200ms, on
  `--uird-ease-out`. A box that was not drawn before fades in, and is
  clipped by its parent until the parent has grown to hold it. A header
  keeps its final width through the change, so no name is elided on the way.
- **The diagram changes size as one object.** Between the dock and the
  maximised panel the type step changes, so the whole diagram scales from
  its old outline to its new one, about its own middle on the block axis,
  and its boxes ride it. The panel itself changes size at once.
- **Edges draw.** An edge draws in from its start in 240ms and withdraws
  toward its end in 160ms. After a re-pack the edges wait the 200ms the boxes
  take, and then draw, so none is stranded beside a moving box.
- **The popover fades in** over 160ms where it is placed.
- **Reduced motion.** Positions change at once. Edges, new boxes and the
  popover fade, and nothing else animates.

The mechanism is FLIP on the Web Animations API. Before a render that changes
the Map's geometry the panel reads where each state's element is drawn, and
after it reads where each now is and animates a `transform` from the
difference. A child's shift is taken relative to its parent's, since it rides
its parent's transform. Every element is read before any is animated. A box
whose size changed also animates `width` and `height`; the boxes are
absolutely placed, so that layout is theirs alone. Opening and closing a
compound in the stress tree's dock, with 20 to 26 boxes drawn, the frame that
re-packs took 21 to 27ms and every frame after it 16.7ms, in headless
Chromium. A change of type step animates one `transform` with a scale on the
diagram's root instead. Nothing waits on an animation. An interrupted move starts from what is on screen: the
first read is of the drawn position, mid-flight included, and the earlier
animation is cancelled before the second.

Edges are revealed by an SVG mask whose stroke offset animates, so a dashed
edge draws in the same way as a solid one.

The View Transitions API was tried and left out. In Chromium 158 a
`view-transition-name` on a box inside the panel's shadow root, in its
`popover`, got no transition group: only the document root and a light-DOM
probe did. While the transition ran, hit testing anywhere on the page
returned the transition overlay, so the whole document took no input. A
document-level transition is also the host page's to start, and one started
by the panel would cut across the page's own. `Element.startViewTransition`
exists in that build and was not pursued, for the same top-layer and
shadow-root reasons. Firefox and WebKit were not probed.

Path morphing of an edge between two routes is left out; a re-routed edge is
redrawn.

## Edge routing

No package is both small and able to route around several nested obstacles.

| Package                          | Avoids obstacles    | Size (gzip)       | Licence           |
| -------------------------------- | ------------------- | ----------------- | ----------------- |
| `elkjs` 0.12.1                   | lays out and routes | 477 kB            | EPL-2.0           |
| `libavoid-js` 0.5.0-beta.5       | yes                 | 181 kB wasm + 17  | LGPL-2.1          |
| `obstacle-router` 0.1.2          | yes                 | 48 kB             | LGPL-2.1          |
| `@dagrejs/dagre` 3.1.3           | no                  | 17 kB             | MIT               |
| JointJS `manhattan` router       | yes, uniform grid   | part of JointJS   | MPL-2.0           |
| xyflow step and smoothstep edges | no                  | part of xyflow    | MIT               |
| Excalidraw and tldraw elbows     | the two end boxes   | part of each tool | MIT, tldraw's own |

The router is hand-written, after Wybrow, Marriott and Stuckey's "Orthogonal
Connector Routing" (Graph Drawing 2009), the algorithm behind `libavoid`:

- **Obstacles.** Every box that is not an ancestor of either end blocks the
  route. Ancestors are transparent, as in JointJS, but every header row blocks,
  so a route never crosses a label. An edge between a box and its own
  descendant meets the ancestor's border from inside.
- **Grid.** Lines sit at each box's edges offset by a margin, at its centre and
  at gutter midlines, never on a border. A route can cross a border and cannot
  run along one.
- **Leads.** An edge leaves and enters a box at a right angle, with a straight
  lead before its first bend: to the middle of the gutter it faces, and 12px
  into open space. A bend nearer the box than that costs extra, so a side with
  room for a lead is preferred to a nearer one without.
- **Search.** A\* over (node, direction) states, with a penalty per bend and no
  reversal. Ties break on fewer bends, then on a fixed expansion order, so the
  same geometry gives the same route.
- **Ports.** A first pass routes from side midpoints to choose each edge's
  side. A side holds as many ports as fit 12px apart and 6px from its corners,
  two on a leaf's 24px end; the edges past that lose the side and are routed
  again, so they take another. Ports then spread around the side's midpoint
  in the order of where their edges go, and a last pass routes from the fixed
  ports. No edge ends under another's arrowhead.
- **Channels.** A free segment moves to the middle of the gutter it runs in.
  In a gutter wider than 48px it keeps 12px from the nearer border instead.
- **Nudging.** Segments that share a line spread across the channel in a
  fixed order, greedily and without a solver. Opposite edges between one pair
  each keep to their right.
- **Templates.** A self-loop is a fixed shape, not a search: out of the top
  near the end corner and back into the end side, which is kept free of other
  ports. It takes the start side or the bottom when routed edges use the
  other and leave that one free. An edge whose end sits inside a collapsed
  compound stops at that box's border with a stub cap, and one whose ends are
  both inside the same box becomes that box's loop.
- **No route.** A straight dotted line joins the two boxes, and the result is
  flagged as a fallback.
- **Arrowheads.** One head for every weight, 7px long and 7px across, on
  strokes of 1px to 3px. A redirect's dashed edge ends in an open chevron of
  the same size, so the two read apart without colour. Edges are ink with a
  halo of the surface colour, which keeps them clear of the identity colours
  they cross.
- **Output.** Corners are rounded at 4px, 6px on a loop, and coordinates sit
  on the device-pixel grid, mid-pixel for an odd stroke.

The router is `src/element/route.ts`: rects in, paths out. Edges are routed in
id order, so the same boxes and edges give the same paths.

The edges drawn come from `observedEdges` in `src/edges.ts`, which folds a
recorded session into one edge per ordered pair of states with its count and
outcomes. A selected state shows its successful traffic, 1px for one
transition, 2px for two or three and 3px for four or more.

The constraint solver `libavoid` uses for nudging, crossing minimisation and
labels on lines are left out.

Two things read poorly and are left as they are. A leaf with four or more
edges is a knot: a 24px end holds two ports, the pairs take a side each, and
their leads share the 12px gap under the parent's header. An edge between a
compound and its own child is a stub from the child to the nearest border of
the compound, met from inside. Lining that port up with the child was tried:
the stub is then straight, and it moves to whichever border is nearest, which
pushed the self-loop into the corner the other edges already use. A fix needs
three things together: one trunk for the edges that share an end, so a leaf
has one port per neighbour instead of one per edge; a port budget that
counts a leaf's four sides before any edge is routed, instead of relieving a
side after the fact; and a template for the compound and child pair that
ends on the compound's header, which is the part of it that reads as the
state.

### WebAssembly

The router is TypeScript only. A spike built the same search in dependency-free
Rust compiled to WebAssembly and compared the two on identical routes:

|                                      | TypeScript | WebAssembly                  |
| ------------------------------------ | ---------- | ---------------------------- |
| Size, gzip                           | 2.2 kB     | 3.9 kB as a file, 4.9 inline |
| One edge, 14 boxes (Chromium)        | 0.13 ms    | 0.10 ms                      |
| Six edges, 60 boxes (Chromium)       | 3.8 ms     | 2.4 ms                       |
| Cold first call, six edges, 60 boxes | 9.7 ms     | 6.2 ms                       |

Both are well inside a frame. Under `script-src 'self'` every way of loading a
module fails in Chromium and WebKit; WebAssembly needs `'wasm-unsafe-eval'`.
The panel runs inside host apps, so a TypeScript router would have to ship as
the fallback either way. A mode that routes every observed edge at once, a few
hundred per resize, is where a WebAssembly router in a worker would start to
pay.

## Loading

The nested layout, the packer, the edge router and the node-link tree, with
`d3-hierarchy`, are one module, `src/element/map.ts`, that the panel imports
on first use of the Map tab. A panel that only ever shows the Outline does not
load it. The package's build emits a module per source file, so the import is
a relative `import('./element/map.js')` in `dist`, which a bundler turns into
a chunk of its own.

## Accessibility

Containment maps onto a tree. Each box's header is a `treeitem` that owns,
through `aria-owns`, the `group` of child items in the same box, with
`aria-expanded` on compounds only. The header is the item, not the box, so
that an item's name is its header alone: a name computed from a box's content
would take in every state inside it. Arrow keys move in tree order, as in the
Outline, not spatially. A re-pack moves a box's element and does not replace
it, so focus stays on the same state.

The button that closes or opens a compound is named for what it does,
`Collapse contacts` or `Expand contacts`. It is for the pointer and is not a
tab stop: the left and right arrow keys do the same on the item.

A truncated name carries its full name as the label, so there the label and
the visible text differ.

The scrubber is a `listbox` of transitions. Left and right arrows move the
selection, and the selected transition's notation sits beside it.

The edge overlay is hidden from assistive technology. The WAI-ARIA Graphics
Module defines no connector role, and `aria-flowto` support is partial. The
inspector states the same relations in words, as lists of states that select
and focus the box they name.

## References

- Harel, "Statecharts: A visual formalism for complex systems", 1987:
  <https://doi.org/10.1016/0167-6423(87)90035-9>
- Wybrow, Marriott and Stuckey, "Orthogonal Connector Routing", 2009:
  <https://users.monash.edu.au/~mwybrow/papers/wybrow-gd-2009.pdf>
- ELK `rectpacking`:
  <https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-rectpacking.html>
- ELK top-down layout:
  <https://eclipse.dev/elk/blog/posts/2023/23-04-11-topdown-layout.html>
- The XState visualiser's layout, `src/graphUtils.ts`:
  <https://github.com/statelyai/xstate-viz>
- JointJS `manhattan` router:
  <https://github.com/clientIO/joint/blob/master/packages/joint-core/src/routers/manhattan.mjs>
- itemis CREATE subdiagrams:
  <https://www.itemis.com/en/yakindu/state-machine/documentation/edit_using_subdiagrams>
- Schulze, Lasch and von Hanxleden, "Label management", 2016:
  <https://doi.org/10.1109/VLHCC.2016.7739657>
- WAI-ARIA tree view pattern:
  <https://www.w3.org/WAI/ARIA/apg/patterns/treeview/>
- WAI-ARIA Graphics Module: <https://www.w3.org/TR/graphics-aria-1.0/>
- Machado, Oliveira and Fernandes, "A physiologically-based model for
  simulation of color vision deficiency", 2009:
  <https://doi.org/10.1109/TVCG.2009.113>
- FLIP: <https://aerotwist.com/blog/flip-your-animations/>
- The CSS guideline the panel follows: <https://good-css.com>

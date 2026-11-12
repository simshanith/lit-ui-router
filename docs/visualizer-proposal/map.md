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
- **The diagram owns the panel.** On the Map tab the transition log is a strip
  of outcome glyphs, and the inspector is a popover beside the selection. The
  maximised panel shows the full log and inspector below the diagram.
- **Two hues with fixed jobs.** `--uird-active` marks the active path and what
  a selected transition enters or retains. `--uird-exit` marks what it exits.
  Red stays reserved for faults. Border style and glyph repeat every
  distinction, so greyscale and forced colours still read. `--uird-exit` is
  never used for text: in the light scheme it clears 3:1 but not 4.5:1.
- **Type stays at 12px.** The layout may shrink to the caption size and no
  further, and it never enlarges.

## Layout

No surveyed tool fits its layout to the shape of its container. The XState
visualiser measures HTML nodes and hands them to `elkjs`; Mermaid scales the
whole drawing; KIELER collapses what is out of focus; itemis CREATE moves a
composite's contents to another diagram. A wrapping flex row fills one row
greedily, which leaves a wide dock half empty.

The nested layout chooses widths and lets CSS place the boxes:

1. Measure each leaf and header.
2. Bottom-up, split each compound's children into contiguous rows in
   declaration order, trying every row count, and keep the split whose aspect
   ratio is nearest a target: the Map viewport's ratio for the root, about 2
   for inner compounds. Set the compound's inline size to its widest row.
3. If the root still does not fit, step down the ladder below.

The rule comes from ELK's `rectpacking`, which keeps input order and aims for
an aspect ratio. Area-weighted treemaps do not fit: they have no minimum box
size and no notion of a label's width.

### When it does not fit

The layout stops at the first step that fits:

1. Collapse compounds off the active path and outside the selection to one box
   with a child count. This is the resting default.
2. Merge a compound with its only visible child, when that child is also a
   compound, into one header.
3. Truncate a name segment longer than 24 characters in the middle. The full
   name stays in the accessible name and the `title`.
4. Shrink to the caption size.
5. Re-root at the deepest compound on the active path, with its ancestors as a
   breadcrumb.
6. Fall back to the node-link tree.

A fallback is restored only with about 10% of room to spare, so a resize does
not flicker between layouts. Below 560px of inline size the nested layout is
not offered: at that width it is the Outline with borders.

Pan, zoom, a minimap and animated re-layout are left out.

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
  so a route never crosses a label.
- **Grid.** Lines sit at each box's edges offset by a margin, at its centre and
  at gutter midlines, never on a border. A route can cross a border and cannot
  run along one.
- **Search.** A\* over (node, direction) states, with a penalty per bend and no
  reversal. Ties break on fewer bends, then on a fixed expansion order, so the
  same geometry gives the same route.
- **Ports.** A first pass routes from side midpoints to choose each edge's
  side. Ports on a side then spread in the order of where their edges go, and a
  second pass routes from the fixed ports.
- **Nudging.** Segments that share a line spread across the free channel in a
  fixed order. Opposite edges between one pair each keep to their right.
- **Templates.** A self-loop is a fixed shape, not a search. An edge whose end
  sits inside a collapsed compound stops at that box's border with a stub cap.

The constraint solver `libavoid` uses for nudging, crossing minimisation,
labels on lines and path morphing are left out. New edges fade in, and not
under reduced motion.

## Accessibility

Containment maps onto a tree: each box is a `treeitem` holding a `group` of
child items, named by its header, with `aria-expanded` on compounds only. Arrow
keys move in tree order, as in the Outline, not spatially.

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

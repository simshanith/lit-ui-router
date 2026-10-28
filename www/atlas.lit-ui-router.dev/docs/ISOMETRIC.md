# Drawing an isometric sheet

The atlas's isometric sheets (projection `isometric` in [`labels.mjs`](../generator/labels.mjs)) are census drawings. Every mass,
height and count on them is read from a checked-in plate in [`../data/`](../data/). This page is the
recipe they share. The generator modules it links are the source of truth. Rules marked †
come from [anatomy](https://github.com/wheresryan22/anatomy) by Ryan (MIT).

## Projection

[`iso(x, y, z)`](../generator/helpers.mjs) maps a plan point to the screen as
`[(x − y)·0.866, (x + y)·0.5 − z]`. Unit steps along x, y and z all project to length 1, 120°
apart. That makes it a true isometric drawing, with no foreshortening and the plan axes at 30° to
the horizontal. It is not a dimetric. One plan unit and one unit of height are each one screen unit,
so a legend such as "3 px per authored file" is literally true on the page.

The camera looks from +x, +y, +z. Larger x + y is nearer the viewer.

- `isoPt(ox, oy, x, y, z)` gives the screen point of a plan point under a sheet's origin offset.
  Find a structure's screen point for a label, leader or badge with it.
- A sheet fixes its origin (`OX`, `OY`) once, at the top of its module.

## Faces and fills

[`isoBlock(p, ox, oy, x, y, w, d, h, opts)`](../generator/helpers.mjs) draws one axis-aligned block
with three visible faces:

| face                | fill                                      | meaning                                               |
| ------------------- | ----------------------------------------- | ----------------------------------------------------- |
| top                 | `fp`, or `capCls`                         | the roof; a tier can colour it (`fr` halts a publish) |
| left (the +y face)  | `--paper-2`                               | stone                                                 |
| right (the +x face) | a hatch pattern over stone, or `sideFill` | the tier's hatch (`hx`, `hr`, `ha`, `hd`)             |

`z0` lifts a block off the ground and drops a dashed mast from its near corner.

[`face(points, edge, fill)`](../generator/helpers.mjs) is how a face gets filled. Every stroke class
in [`chrome.mjs`](../generator/chrome.mjs) (`sk`, `ska`, `skr`, `skf`, `sks`) declares
`fill: none`, and a CSS declaration outranks a presentation attribute. A polygon that carries both a
stroke class and `fill="…"` therefore draws no fill at all, and everything behind it shows through.
`face()` writes the fill as its own element under a `fnone` outline. The header of
[`iso-hidden.mjs`](../generator/iso-hidden.mjs) has the full account. `solidFaces()` rewrites any
face still written the other way.

A hatch pattern is bare lines with no ground. `face()` lays `--paper-2` stone under any `url(#…)`
fill, so a hatched face is opaque.

Colour encodes data: gate tier, by the same ladder on every city sheet. Each sheet's key spells out
the ladder. Give accent one meaning per sheet, and name that meaning in the key.†

## Painter's order

Faces are opaque only if masses are painted back to front.
[`depthSort(masses)`](../generator/iso-hidden.mjs) takes plan rects `{x, y, w, d, …}` and returns them
in paint order. The sort is topological over a separating-plane relation, not a distance guess. If one
rect's far x edge is at or before another's near x edge, it is behind along every view ray that meets
both, and the same holds for y. When two rects are separated on both axes in opposite senses, their
screen x-ranges do not overlap, so their order does not matter. For disjoint axis-aligned footprints
the order is exact.

The precondition is disjoint footprints. [`assertPlots(sheet, plots)`](../generator/iso-hidden.mjs)
tests the ground rects and throws on any overlap. Both projections the sheets use are affine, so two
footprints intersect on the page exactly when they intersect in plan. `plotsOf()` gives a member's
block and its spec annex as separate plots. Place blocks by hand, and let the census size them. When a
refresh grows a block into its neighbour, the build stops.

The layers of a city sheet, back to front:

1. ground: districts, vacant plots, phantom fields (closed dashed outlines)
2. roads, at full length on the ground, so the masses hide what passes under them
3. masses, through `depthSort`
4. badges, in clear air above the roofline
5. lettering, callouts and leaders

When a mass is not axis-aligned, or wraps another (a frame round a yard, a ring round a block), split
it into pieces that are axis-aligned and disjoint, and sort the pieces. Never bias a sort key to fix one
view.†

## Structures and numbers

A city sheet's structures are one table (`M` in [`sheet3b.mjs`](../generator/sheet3b.mjs) and
[`sheet7.mjs`](../generator/sheet7.mjs)). Each row holds a number, a name, a plan position, the plate
selector it draws and a schedule note.

- **Numbers count 1 to n in schedule order.** The badge on the plan and the row in the structure
  schedule carry the same number.
- **Cite by name.** Prose, callouts and cell lookups reach a structure through a lookup by its
  schedule name, `NO(name)` in `sheet3b.mjs`, which throws on an unknown name. Renumbering then moves
  every citation with its building. A literal `g(12)` in a caption does not move.
- **Plate-driven, throw on missing.** Each sheet reads its plate at build time. A drawn name absent
  from the plate throws (`row()` in sheets 7 and 8, `rowsOf()` in 3B). So does a plate row that no
  structure draws (the `unclaimed` check in 3B, `missed` in [`sheet8.mjs`](../generator/sheet8.mjs)).
  A structure that claims a row another structure has claimed also throws.
- **Schedule totals reconcile the plate.** The TOTALS line is the plate's own sum over the claimed
  rows, so the schedule accounts for every real row exactly once.
- **Prose claims are asserted.** A note that says "one file" or "the tallest" carries a throw that
  checks the plate. An example is sheet 3B's spire caption, against its `TALLEST` row.
- **Basis on the sheet.** Each sheet prints its `BASIS` (ref, sha and date of the plate).

## Lines and leaders

Every open line ends on purpose, and its end is computed from geometry, never typed.†

- **Leader.** It starts at the edge of its lettering and ends on a face of the structure it names, at
  `isoPt` of that structure's roof or face point. A census refresh that resizes the mass moves the end
  with it.
- **Road.** It is routed on the plan grid and trimmed in screen space. The arrowhead stops at a
  clearance derived from the target's height (`clr()` in `sheet7.mjs`: h + 1.15 · gap).
- **District, vacant plot, phantom field.** Each is a closed outline with no ends.
- **Mast.** It runs from a lifted block's near corner to the ground.

Dash marks a kind of line: phantom, soft road, district or chain. It never marks a hidden edge.†
Arrow markers come from `defs(p)` in `chrome.mjs` (`ai`, `aa`, `ar`, `as`).

## Labels

- **Classes.** Lettering uses `txt()` from [`helpers.mjs`](../generator/helpers.mjs) with the `text.lbl*`
  classes in `chrome.mjs`: `lbl` body, `lblb` heading, `lbls` soft, `lblf` faint, `lbla` accent,
  `lblr` red, `lblt` title. All of them set in the data face with tabular figures.
- **Schedules.** A schedule is a table, never SVG text: the sheet's `schedule` (or `schedules`) is built
  with `schedule(title, head, rows, total)` from `helpers.mjs`, and `sheetSection()` in `chrome.mjs` sets
  it under the figure as an HTML table at 12 px in the data face. A row's first cell is its number, the
  badge's; numeric cells are passed as numbers so the table groups them. A register over sixteen rows is
  split in two tables side by side.
- **Keys.** Key rows use `keyRow(swatchSvg, desc)`, a 48 × 18 swatch drawn from the same classes and
  patterns as the plate. Sheet 3B's key sets the order: block, its size encodings, the other kinds,
  then edges. The key is the plate's one legend; the drawing carries no legend box of its own.
- **Where text goes.** Lettering in the drawing is district names, badges and callouts. It sits in
  clear air, never on a mass face. Badges are the exception and sit on or above their own roof
  (`BADGE_LIFT`, `BADGE_ON_ROOF` in `sheet7.mjs`). The sheet title, the subtitle and the key say what
  the drawing is; the drawing does not say it again in a title box.
- **Callout leaders.** A callout's leader is `leader(x1, y1, x2, y2)` from `helpers.mjs`: faint,
  dashed `4 3`, with a 2 px landing dot on the thing it names. A solid hairline reads as a road.
  Accent lettering is editorial, two elements a plate at most; district names are headings, not accents.
- **FORM.** A sheet's FORM phrase is a compound of the keys in
  [`labels.mjs`](../generator/labels.mjs) (subject, projection, mode, basis). `assertLabels()` fails the
  build on an unknown value, or on a `mode` that disagrees with whether the sheet is interactive.
- **Present-state copy.** A sheet's copy is present-state. Its history goes in [`../HISTORY.md`](../HISTORY.md).

## Verification

1. **Build.** [`build.mjs`](../generator/build.mjs) writes every sheet's fragment, and the app
   build prerenders each as a bare plate under `app/dist/plate/<num>/`
   ([`app/prerender.ts`](../app/prerender.ts)). Each throw described above (plots, plate rows,
   labels) stops the build.
2. **Frame audit.** [`audit-frames.mjs`](../generator/audit-frames.mjs) serves `app/dist` and
   drives the bare plates at `/plate/<num>/` through Playwright, reporting three counts per sheet,
   in the SVG's own user units:
   - **escapes:** an element outside the viewBox;
   - **hits:** lettering over a filled mass, tested by separating axis against the real silhouette.
     A panel that contains the label is skipped, and so is a one- or two-digit badge;
   - **text-on-text.**

   All three are zero before a sheet ships; the script exits 1 otherwise and writes every finding to
   `tmp/audit/<tag>.json`.

3. **Photographs.** [`shoot.mjs`](../generator/shoot.mjs) shoots every changed sheet in light and in
   dark at natural width into `tmp/shots/<tag>/`, so a before tag and an after tag hold the same sheets.
   Read every picture.
4. **4× crops at junctions, both themes.**† The junctions are: a badge on its roof, a road's
   arrowhead at a silhouette, an annex beside its block, a mast foot, each leader's end, and the
   schedule gutter. Crop them from the photographs and compare each with the same region in the
   before set.
5. **Phone width.**† Load each changed sheet at 390 CSS px. The page must not scroll sideways.
6. **3D lanes.** [`check-scenes.mjs`](../generator/check-scenes.mjs) reads back the glTF binaries and
   drives the built app in headless Chromium. It runs after `build.mjs`, the app build and the
   artifact build, and `--shots <dir>` photographs both themes, all four corners and a phone.
7. **Reduced motion.**† Under `prefers-reduced-motion: reduce`, each interactive lane (1i, 2B, 12i,
   A2i, city, plant) must land on its end state at once and still answer the pointer and the
   keyboard. `check-scenes.mjs` asserts this for the city.

## What this atlas does not do

The atlas is a census, and every number on it is read from a plate. So it leaves out the parts of
anatomy that serve invented figures:

- **No invented machines.** A structure stands for a real row. Detail that no plate carries would be
  invented data.
- **No live readouts.** There is no model in motion to read from.
- **No WebGL shaders and no turn mode.** The 3D lanes are glTF in model-viewer, generated from the
  same plates.
- **No exploded views, pipe routing or parts-count targets.**
